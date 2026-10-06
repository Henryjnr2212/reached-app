import { normalizeGhanaPhone, renderSms } from '@reached/core';
import type { DbClient, Env } from '../_shared/db.ts';
import { json } from '../_shared/http.ts';
import type { Logger } from '../_shared/log.ts';
import { type FetchFn, getProvider, type MessageProvider } from '../_shared/providers.ts';
import { verifyStandardWebhook } from '../_shared/webhooks.ts';

/**
 * send-sms — Supabase Auth "Send SMS" hook. Auth calls this instead of a
 * built-in SMS provider whenever it needs to text a one-time code.
 */

export interface SendSmsDeps {
  db: DbClient;
  env: Env;
  fetch: FetchFn;
  log: Logger;
  now: () => number;
  provider?: MessageProvider;
}

function hookError(httpCode: number, message: string): Response {
  return json({ error: { http_code: httpCode, message } }, httpCode);
}

export function otpBody(code: string, appHash?: string): string {
  return renderSms('otp', { code, appHash: appHash || undefined });
}

export function createHandler(deps: SendSmsDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST') return hookError(405, 'Use POST');
    const raw = await req.text();
    const verified = await verifyStandardWebhook(deps.env.SEND_SMS_HOOK_SECRET, req.headers, raw, deps.now());
    if (!verified.ok) {
      deps.log('send_sms_rejected', { reason: verified.reason });
      return hookError(401, 'Invalid hook signature');
    }

    let payload: { user?: { phone?: string }; sms?: { otp?: string } };
    try {
      payload = JSON.parse(raw);
    } catch {
      return hookError(400, 'Invalid JSON');
    }
    const otp = payload.sms?.otp;
    if (!otp || !/^\d{4,10}$/.test(otp)) return hookError(400, 'Missing one-time code');
    const to = normalizeGhanaPhone(String(payload.user?.phone ?? ''));
    if (!to) return hookError(400, 'Reached works with Ghana mobile numbers only.');

    const provider = deps.provider ?? getProvider('sms', deps.env, deps.db, deps.fetch);
    const result = await provider.send({ to, body: otpBody(otp, deps.env.ANDROID_SMS_HASH), channel: 'sms' });
    if (!result.ok) {
      deps.log('otp_send_failed', { to, reason: result.reason });
      return hookError(500, "We couldn't send your code. Try again in a minute.");
    }
    deps.log('otp_sent', { to, provider: provider.name });
    return json({});
  };
}
