import type { DbClient, Env } from '../_shared/db.ts';
import type { Logger } from '../_shared/log.ts';
import type { FetchFn } from '../_shared/providers.ts';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
export const EXPO_BATCH_SIZE = 100;

/**
 * Notification categories registered by the app (SPEC §12). The categoryId is
 * the notification kind, so the app can show these action buttons.
 */
export const PUSH_CATEGORIES: Record<string, string[]> = {
  are_you_okay: ["I'm okay", 'Need more time', 'Get help'],
  ask_first: ['Send', 'Not now'],
  message_failed: ['Retry'],
  alert_sent: ["I'm safe now"],
  heading_out: ['Notify when I arrive', 'Not now'],
  contact_request: ['Accept', 'Decline'],
  permissions: ['Fix'],
};

const URGENT_KINDS = new Set(['are_you_okay', 'alert_sent', 'message_failed']);

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  priority: 'default' | 'high';
  categoryId?: string;
}

export function toExpoMessage(n: NotificationRow, token: string): ExpoMessage {
  const msg: ExpoMessage = {
    to: token,
    title: n.title,
    body: n.body,
    data: { ...(n.data ?? {}), kind: n.kind, notification_id: n.id },
    sound: 'default',
    priority: URGENT_KINDS.has(n.kind) ? 'high' : 'default',
  };
  if (PUSH_CATEGORIES[n.kind]) msg.categoryId = n.kind;
  return msg;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface PushSummary {
  notifications: number;
  pushed: number;
  errors: number;
  skipped_http: boolean;
}

interface PushDeps {
  db: DbClient;
  env: Env;
  fetch: FetchFn;
  log: Logger;
  now: () => Date;
}

/**
 * Deliver unsent notifications as Expo push. Rows are claimed by setting
 * sent_at (only where it is still null) before sending, so two concurrent
 * runs never double-send. In fake mode no HTTP call is made but sent_at is
 * still set.
 */
export async function deliverPush(deps: PushDeps, limit = 200): Promise<PushSummary> {
  const { db, env, log } = deps;
  const summary: PushSummary = { notifications: 0, pushed: 0, errors: 0, skipped_http: env.MESSAGING_MODE !== 'live' };

  const pending = await db.from('notifications').select('id').is('sent_at', null).order('created_at').limit(limit);
  if (pending.error) throw new Error(`notifications: ${pending.error.message}`);
  const ids = ((pending.data ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return summary;

  const claimed = await db.from('notifications').update({ sent_at: deps.now().toISOString() })
    .in('id', ids).is('sent_at', null).select('id, user_id, kind, title, body, data');
  if (claimed.error) throw new Error(`notifications claim: ${claimed.error.message}`);
  const rows = (claimed.data ?? []) as NotificationRow[];
  summary.notifications = rows.length;
  if (!rows.length) return summary;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const tokensRes = await db.from('push_tokens').select('token, user_id').in('user_id', userIds);
  if (tokensRes.error) throw new Error(`push_tokens: ${tokensRes.error.message}`);
  const tokensByUser = new Map<string, string[]>();
  for (const t of (tokensRes.data ?? []) as { token: string; user_id: string }[]) {
    tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
  }

  const outgoing: { notificationId: string; message: ExpoMessage }[] = [];
  for (const n of rows) {
    for (const token of tokensByUser.get(n.user_id) ?? []) {
      outgoing.push({ notificationId: n.id, message: toExpoMessage(n, token) });
    }
  }

  if (summary.skipped_http) {
    summary.pushed = outgoing.length;
    return summary;
  }

  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  const deadTokens: string[] = [];

  for (const batch of chunk(outgoing, EXPO_BATCH_SIZE)) {
    try {
      const res = await deps.fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch.map((b) => b.message)),
      });
      if (!res.ok) throw new Error(`Expo HTTP ${res.status}`);
      const parsed = await res.json() as {
        data?: { status: string; message?: string; details?: { error?: string } }[];
      };
      (parsed.data ?? []).forEach((ticket, i) => {
        if (ticket.status === 'ok') summary.pushed++;
        else {
          summary.errors++;
          if (ticket.details?.error === 'DeviceNotRegistered' && batch[i]) deadTokens.push(batch[i].message.to);
        }
      });
    } catch (e) {
      summary.errors += batch.length;
      log('push_batch_failed', { reason: (e as Error).message, count: batch.length });
      // Release the claim so the next run retries these notifications.
      const retry = [...new Set(batch.map((b) => b.notificationId))];
      await db.from('notifications').update({ sent_at: null }).in('id', retry);
    }
  }

  if (deadTokens.length) await db.from('push_tokens').delete().in('token', deadTokens);
  return summary;
}
