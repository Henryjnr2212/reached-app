import { maskPhone } from '@reached/core';
import { safeEqual } from '../_shared/crypto.ts';
import { type DbClient, type Env, rpc } from '../_shared/db.ts';
import { bearerToken, error, json, preflight } from '../_shared/http.ts';
import type { Logger } from '../_shared/log.ts';
import { type Channel, type FetchFn, getProvider, type MessageProvider } from '../_shared/providers.ts';
import { renderMessage } from '../_shared/render.ts';
import { deliverPush, type PushSummary } from './push.ts';

/**
 * dispatch — sends the outbox. Called by the database (pg_net kick on insert
 * plus a once-a-minute cron) with x-dispatch-secret, or by an operator with
 * the service-role key.
 */

export interface DispatchDeps {
  db: DbClient;
  env: Env;
  fetch: FetchFn;
  log: Logger;
  now: () => Date;
  /** Override provider selection in tests. */
  provider?: (channel: Channel) => MessageProvider;
}

export interface MessageRow {
  id: string;
  user_id: string;
  event_id: string;
  contact_id: string | null;
  contact_name: string;
  to_phone: string;
  channel: Channel;
  template: string;
  params: Record<string, unknown> | null;
  language: string;
}

export const CLAIM_LIMIT = 50;
const MAX_ROUNDS = 5;
const CONCURRENCY = 10;

export async function authorized(req: Request, env: Env): Promise<boolean> {
  const secret = req.headers.get('x-dispatch-secret');
  if (secret && env.DISPATCH_SECRET && await safeEqual(secret, env.DISPATCH_SECRET)) return true;
  const bearer = bearerToken(req);
  return Boolean(bearer && env.SUPABASE_SERVICE_ROLE_KEY && await safeEqual(bearer, env.SUPABASE_SERVICE_ROLE_KEY));
}

type Outcome = 'sent' | 'failed';

async function sendOne(deps: DispatchDeps, m: MessageRow): Promise<Outcome> {
  const providerFor = deps.provider ?? ((ch: Channel) => getProvider(ch, deps.env, deps.db, deps.fetch));
  const rendered = renderMessage(m.template, m.params, m.language);
  if (!rendered.ok) {
    await rpc(deps.db, 'mark_message', { p_id: m.id, p_status: 'failed', p_reason: rendered.reason });
    deps.log('message_render_failed', { id: m.id, reason: rendered.reason });
    return 'failed';
  }
  const body = rendered.body;
  let result;
  try {
    result = await providerFor(m.channel).send({ to: m.to_phone, body, channel: m.channel });
  } catch (e) {
    result = { ok: false as const, reason: `Reached couldn't send right now (${(e as Error).message})` };
  }
  if (result.ok) {
    await rpc(deps.db, 'mark_message', {
      p_id: m.id,
      p_status: 'sent',
      p_body: body,
      p_provider_id: result.providerId,
    });
    deps.log('message_sent', { id: m.id, channel: m.channel, to: maskPhone(m.to_phone) });
    return 'sent';
  }
  await rpc(deps.db, 'mark_message', { p_id: m.id, p_status: 'failed', p_body: body, p_reason: result.reason });
  deps.log('message_failed', { id: m.id, channel: m.channel, to: maskPhone(m.to_phone), reason: result.reason });
  return 'failed';
}

export interface DispatchSummary {
  messages: { claimed: number; sent: number; failed: number };
  push: PushSummary | { error: string };
}

export async function runDispatch(deps: DispatchDeps): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    messages: { claimed: 0, sent: 0, failed: 0 },
    push: { notifications: 0, pushed: 0, errors: 0, skipped_http: true },
  };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const claimed = (await rpc<MessageRow[]>(deps.db, 'claim_messages', { p_limit: CLAIM_LIMIT })) ?? [];
    summary.messages.claimed += claimed.length;
    for (let i = 0; i < claimed.length; i += CONCURRENCY) {
      const outcomes = await Promise.all(claimed.slice(i, i + CONCURRENCY).map((m) => sendOne(deps, m)));
      for (const o of outcomes) summary.messages[o]++;
    }
    if (claimed.length < CLAIM_LIMIT) break;
  }
  try {
    summary.push = await deliverPush(deps);
  } catch (e) {
    summary.push = { error: (e as Error).message };
    deps.log('push_failed', { reason: (e as Error).message });
  }
  return summary;
}

export function createHandler(deps: DispatchDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const pre = preflight(req);
    if (pre) return pre;
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
    if (!(await authorized(req, deps.env))) return error(401, 'unauthorized', 'Not allowed');
    try {
      const summary = await runDispatch(deps);
      return json({ ok: true, mode: deps.env.MESSAGING_MODE === 'live' ? 'live' : 'fake', ...summary });
    } catch (e) {
      deps.log('dispatch_error', { reason: (e as Error).message });
      return error(500, 'dispatch_failed', (e as Error).message);
    }
  };
}
