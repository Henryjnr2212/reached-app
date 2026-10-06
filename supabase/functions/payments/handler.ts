import { requireUser } from '../_shared/auth.ts';
import { type DbClient, type Env, rpc } from '../_shared/db.ts';
import { error, json, lastPathSegment, preflight, readJsonObject } from '../_shared/http.ts';
import type { Logger } from '../_shared/log.ts';
import type { FetchFn } from '../_shared/providers.ts';
import { verifyHexHmac } from '../_shared/webhooks.ts';
import { type ChargeRequest, getGateway, type PaymentGateway } from './gateway.ts';

/**
 * payments — Phase 3 subscriptions.
 *   POST /payments/webhook  provider callback, x-signature = hex HMAC-SHA256(raw body, PAYMENTS_WEBHOOK_SECRET)
 *   POST /payments/charge   signed-in user starts paying for a pending subscription
 * PAYMENTS_MODE=fake (default) approves charges immediately without any provider.
 */

export interface PaymentsDeps {
  db: DbClient;
  env: Env;
  fetch: FetchFn;
  log: Logger;
  gateway?: PaymentGateway;
}

/** Shared by the webhook and fake charges. activate_subscription is idempotent. */
export async function applyPaymentResult(db: DbClient, reference: string, success: boolean): Promise<void> {
  await rpc(db, 'activate_subscription', { p_provider_ref: reference, p_success: success });
}

async function webhook(deps: PaymentsDeps, req: Request): Promise<Response> {
  const raw = await req.text();
  if (!(await verifyHexHmac(deps.env.PAYMENTS_WEBHOOK_SECRET, raw, req.headers.get('x-signature')))) {
    return error(401, 'unauthorized', 'Bad signature');
  }
  let body: { reference?: unknown; status?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return error(400, 'bad_request', 'Invalid JSON');
  }
  if (typeof body.reference !== 'string' || !body.reference) return error(400, 'bad_request', 'Missing reference');
  if (body.status !== 'success' && body.status !== 'failed') return error(400, 'bad_request', 'Bad status');
  await applyPaymentResult(deps.db, body.reference, body.status === 'success');
  deps.log('payment_webhook', { reference: body.reference, status: body.status });
  return json({ ok: true });
}

interface SubscriptionRow {
  provider_ref: string;
  status: string;
  amount_ghs: number | string;
  payment_method: ChargeRequest['method'];
  pay_phone: string | null;
}

async function charge(deps: PaymentsDeps, req: Request): Promise<Response> {
  const auth = await requireUser(deps.db, req);
  if (!auth.ok) return auth.response;
  const body = await readJsonObject(req);
  const ref = body?.subscription_ref;
  if (typeof ref !== 'string' || !ref) return error(400, 'bad_request', 'Missing subscription_ref');

  const { data, error: err } = await deps.db.from('subscriptions')
    .select('provider_ref, status, amount_ghs, payment_method, pay_phone')
    .eq('provider_ref', ref).eq('user_id', auth.user.id).maybeSingle();
  if (err) return error(500, 'lookup_failed', "We couldn't start the payment. Try again.");
  const sub = data as SubscriptionRow | null;
  if (!sub) return error(404, 'not_found', 'Subscription not found');
  if (sub.status !== 'pending') return json({ status: sub.status });

  if (deps.env.PAYMENTS_MODE !== 'live') {
    await applyPaymentResult(deps.db, ref, true);
    deps.log('payment_fake_success', { reference: ref });
    return json({ status: 'active', mode: 'fake' });
  }

  try {
    const gateway = deps.gateway ?? getGateway(deps.env, deps.fetch);
    const result = await gateway.charge({
      reference: ref,
      amountGhs: Number(sub.amount_ghs),
      method: sub.payment_method,
      phone: sub.pay_phone,
      callbackUrl: `${deps.env.SUPABASE_URL ?? ''}/functions/v1/payments/webhook`,
    });
    if (result.status === 'failed') {
      await applyPaymentResult(deps.db, ref, false);
      return error(402, 'payment_failed', result.message);
    }
    return json({ status: 'pending', redirect_url: result.redirectUrl ?? null });
  } catch (e) {
    deps.log('payment_charge_failed', { reference: ref, reason: (e as Error).message });
    return error(502, 'charge_failed', "We couldn't reach the payment provider. Try again.");
  }
}

export function createHandler(deps: PaymentsDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const pre = preflight(req);
    if (pre) return pre;
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
    const route = lastPathSegment(req);
    try {
      if (route === 'webhook') return await webhook(deps, req);
      if (route === 'charge') return await charge(deps, req);
    } catch (e) {
      deps.log('payments_error', { route, reason: (e as Error).message });
      return error(500, 'payments_failed', 'Something went wrong. Try again.');
    }
    return error(404, 'not_found', 'Unknown payments route');
  };
}
