import { normalizeGhanaPhone } from '@reached/core';
import { callbackTokenOk } from '../_shared/callback.ts';
import type { DbClient, Env } from '../_shared/db.ts';
import { error, json, readForm } from '../_shared/http.ts';
import { processInbound } from '../_shared/inbound.ts';
import type { Logger } from '../_shared/log.ts';
import { type FetchFn, getProvider, type MessageProvider } from '../_shared/providers.ts';

/**
 * sms-inbound — Africa's Talking incoming SMS callback (form fields from, to,
 * text, date, id). Contacts text STOP / START / REACHED to the two-way number.
 */

export interface SmsInboundDeps {
  db: DbClient;
  env: Env;
  fetch: FetchFn;
  log: Logger;
  provider?: MessageProvider;
  /** Run work after the response (EdgeRuntime.waitUntil). When absent, work is awaited. */
  background?: (work: Promise<unknown>) => void;
}

export function createHandler(deps: SmsInboundDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
    if (!(await callbackTokenOk(req, deps.env))) return error(401, 'unauthorized', 'Bad callback token');
    const form = await readForm(req);
    const from = normalizeGhanaPhone(form.from ?? '');
    if (!from) {
      deps.log('inbound_ignored', { reason: 'not a Ghana mobile number' });
      return json({ ok: true, ignored: true });
    }
    const provider = deps.provider ?? getProvider('sms', deps.env, deps.db, deps.fetch);
    const work = processInbound({ db: deps.db, log: deps.log, provider }, from, form.text ?? '', 'sms')
      .catch((e) => deps.log('inbound_failed', { reason: (e as Error).message }));
    if (deps.background) deps.background(work);
    else await work;
    return json({ ok: true });
  };
}
