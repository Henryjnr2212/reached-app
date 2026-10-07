import { normalizeGhanaPhone } from '@reached/core';
import { type DbClient, rpc } from './db.ts';
import type { Logger } from './log.ts';
import type { Channel, MessageProvider } from './providers.ts';
import { renderMessage } from './render.ts';

export interface InboundReply {
  to: string;
  template: string;
  params?: Record<string, unknown>;
}

export interface InboundResult {
  replies: number;
  sent: number;
  failed: number;
}

/**
 * Shared by sms-inbound and whatsapp-webhook: pass a contact's text to
 * handle_inbound (STOP / START / REACHED …) and send back any replies it
 * returns over the same channel.
 */
export async function processInbound(
  deps: { db: DbClient; log: Logger; provider: MessageProvider },
  from: string,
  body: string,
  channel: Channel,
): Promise<InboundResult> {
  const result: InboundResult = { replies: 0, sent: 0, failed: 0 };
  const replies = (await rpc<InboundReply[] | null>(deps.db, 'handle_inbound', { p_from: from, p_body: body })) ?? [];
  result.replies = replies.length;
  for (const r of replies) {
    const to = normalizeGhanaPhone(String(r.to ?? ''));
    const rendered = renderMessage(r.template, r.params ?? {}, 'en');
    if (!to || !rendered.ok) {
      result.failed++;
      deps.log('inbound_reply_skipped', { to: String(r.to ?? ''), template: r.template });
      continue;
    }
    const sent = await deps.provider.send({ to, body: rendered.body, channel });
    if (sent.ok) result.sent++;
    else {
      result.failed++;
      deps.log('inbound_reply_failed', { to, template: r.template, reason: sent.reason });
    }
  }
  deps.log('inbound_handled', { from, channel, replies: result.replies });
  return result;
}
