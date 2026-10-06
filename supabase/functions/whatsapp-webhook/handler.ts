import { normalizeGhanaPhone } from '@reached/core';
import { safeEqual } from '../_shared/crypto.ts';
import { type DbClient, type Env, rpc } from '../_shared/db.ts';
import { error, json, text } from '../_shared/http.ts';
import { processInbound } from '../_shared/inbound.ts';
import type { Logger } from '../_shared/log.ts';
import { type FetchFn, getProvider, type MessageProvider } from '../_shared/providers.ts';
import { verifyHexHmac } from '../_shared/webhooks.ts';

/**
 * whatsapp-webhook — WhatsApp Cloud API webhook.
 * GET: Meta's subscription handshake. POST: delivery statuses and inbound
 * messages, signed with X-Hub-Signature-256 (HMAC-SHA256 of the raw body
 * keyed with the app secret).
 */

export interface WhatsAppDeps {
  db: DbClient;
  env: Env;
  fetch: FetchFn;
  log: Logger;
  provider?: MessageProvider;
  background?: (work: Promise<unknown>) => void;
}

interface WaStatus {
  id?: string;
  status?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
}

interface WaMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
}

interface WaPayload {
  object?: string;
  entry?: { changes?: { field?: string; value?: { statuses?: WaStatus[]; messages?: WaMessage[] } }[] }[];
}

/** Plain-language reasons for common WhatsApp error codes. */
export function whatsappFailureReason(err: WaStatus['errors']): string {
  const code = err?.[0]?.code;
  switch (code) {
    case 131026:
      return "They can't receive WhatsApp messages on this number";
    case 131047:
      return "They haven't messaged Reached on WhatsApp recently";
    case 131049:
    case 130472:
      return "WhatsApp didn't deliver it";
    default:
      return "It wasn't delivered on WhatsApp";
  }
}

export async function handlePayload(
  deps: WhatsAppDeps,
  payload: WaPayload,
): Promise<{ statuses: number; inbound: number }> {
  const counts = { statuses: 0, inbound: 0 };
  const provider = deps.provider ?? getProvider('whatsapp', deps.env, deps.db, deps.fetch);
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const s of value.statuses ?? []) {
        if (!s.id) continue;
        if (s.status === 'delivered' || s.status === 'read') {
          await rpc(deps.db, 'update_message_status', { p_provider_id: s.id, p_status: 'delivered', p_reason: null });
          counts.statuses++;
        } else if (s.status === 'failed') {
          await rpc(deps.db, 'update_message_status', {
            p_provider_id: s.id,
            p_status: 'failed',
            p_reason: whatsappFailureReason(s.errors),
          });
          counts.statuses++;
        }
      }
      for (const m of value.messages ?? []) {
        const body = m.type === 'text' ? m.text?.body : m.type === 'button' ? m.button?.text : undefined;
        const from = normalizeGhanaPhone(m.from ?? '');
        if (!body || !from) continue;
        await processInbound({ db: deps.db, log: deps.log, provider }, from, body, 'whatsapp');
        counts.inbound++;
      }
    }
  }
  return counts;
}

export function createHandler(deps: WhatsAppDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'GET') {
      const q = new URL(req.url).searchParams;
      const ok = q.get('hub.mode') === 'subscribe' &&
        await safeEqual(q.get('hub.verify_token'), deps.env.WHATSAPP_VERIFY_TOKEN);
      return ok ? text(q.get('hub.challenge') ?? '') : error(403, 'forbidden', 'Verification failed');
    }
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'Use GET or POST');
    const raw = await req.text();
    if (!(await verifyHexHmac(deps.env.WHATSAPP_APP_SECRET, raw, req.headers.get('x-hub-signature-256')))) {
      return error(401, 'unauthorized', 'Bad signature');
    }
    let payload: WaPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return error(400, 'bad_request', 'Invalid JSON');
    }
    const work = handlePayload(deps, payload).catch((e) => {
      deps.log('whatsapp_webhook_failed', { reason: (e as Error).message });
      return null;
    });
    if (deps.background) {
      deps.background(work);
      return json({ ok: true });
    }
    const counts = await work;
    return json({ ok: true, ...(counts ?? {}) });
  };
}
