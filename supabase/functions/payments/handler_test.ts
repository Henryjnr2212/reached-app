import { assertEquals } from '@std/assert';
import { silent } from '../_shared/log.ts';
import { FakeDb, noNetwork, type Row } from '../_shared/testing.ts';
import { hexHmac } from '../_shared/webhooks.ts';
import type { ChargeRequest, PaymentGateway } from './gateway.ts';
import { createHandler, type PaymentsDeps } from './handler.ts';

const SECRET = 'pay-secret';
const JWT = 'user-jwt';

/** Models activate_subscription: only a pending subscription changes (idempotent). */
function paymentsDb(): FakeDb {
  const db = new FakeDb();
  db.users[JWT] = { id: 'u1' };
  db.table('subscriptions').push({
    id: 's1',
    user_id: 'u1',
    plan: 'premium',
    payment_method: 'mtn_momo',
    pay_phone: '+233241234567',
    status: 'pending',
    provider_ref: 'rch_abc',
    amount_ghs: '15.00',
  });
  db.onRpc('activate_subscription', ({ p_provider_ref, p_success }) => {
    const sub = db.table('subscriptions').find((s) => s.provider_ref === p_provider_ref);
    if (!sub || sub.status !== 'pending') return null;
    sub.status = p_success ? 'active' : 'failed';
    if (p_success) db.table('activations').push({ ref: p_provider_ref });
    return null;
  });
  return db;
}

function handler(db: FakeDb, over: Partial<PaymentsDeps> = {}) {
  return createHandler({
    db,
    env: { PAYMENTS_MODE: 'fake', PAYMENTS_WEBHOOK_SECRET: SECRET, SUPABASE_URL: 'https://x.supabase.co' },
    fetch: noNetwork,
    log: silent,
    ...over,
  });
}

async function webhook(body: unknown, secret = SECRET): Promise<Request> {
  const raw = JSON.stringify(body);
  return new Request('http://localhost/functions/v1/payments/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-signature': await hexHmac(secret, raw) },
    body: raw,
  });
}

function charge(body: unknown, jwt: string | null = JWT): Request {
  return new Request('http://localhost/functions/v1/payments/charge', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  });
}

const sub = (db: FakeDb): Row => db.table('subscriptions')[0]!;

Deno.test('payments webhook: bad or missing signature is rejected', async () => {
  const db = paymentsDb();
  assertEquals((await handler(db)(await webhook({ reference: 'rch_abc', status: 'success' }, 'wrong'))).status, 401);
  const unsigned = new Request('http://localhost/payments/webhook', {
    method: 'POST',
    body: JSON.stringify({ reference: 'rch_abc', status: 'success' }),
  });
  assertEquals((await handler(db)(unsigned)).status, 401);
  const noSecret = createHandler({ db, env: {}, fetch: noNetwork, log: silent });
  assertEquals((await noSecret(await webhook({ reference: 'rch_abc', status: 'success' }))).status, 401);
  assertEquals(db.rpcCalls.length, 0);
  assertEquals(sub(db).status, 'pending');
});

Deno.test('payments webhook: success activates once; repeats are idempotent', async () => {
  const db = paymentsDb();
  for (let i = 0; i < 3; i++) {
    const res = await handler(db)(await webhook({ reference: 'rch_abc', status: 'success' }));
    assertEquals(res.status, 200);
  }
  assertEquals(db.callsTo('activate_subscription'), Array(3).fill({ p_provider_ref: 'rch_abc', p_success: true }));
  assertEquals(sub(db).status, 'active');
  assertEquals(db.table('activations').length, 1);
  // a late "failed" for an active subscription changes nothing
  await handler(db)(await webhook({ reference: 'rch_abc', status: 'failed' }));
  assertEquals(sub(db).status, 'active');
});

Deno.test('payments webhook: validates the body', async () => {
  const db = paymentsDb();
  assertEquals((await handler(db)(await webhook({ reference: 'rch_abc', status: 'maybe' }))).status, 400);
  assertEquals((await handler(db)(await webhook({ status: 'success' }))).status, 400);
});

Deno.test('payments charge: fake mode activates immediately for the owner only', async () => {
  const db = paymentsDb();
  assertEquals((await handler(db)(charge({ subscription_ref: 'rch_abc' }, null))).status, 401);
  db.users.other = { id: 'u2' };
  assertEquals((await handler(db)(charge({ subscription_ref: 'rch_abc' }, 'other'))).status, 404);
  assertEquals((await handler(db)(charge({}))).status, 400);

  const res = await handler(db)(charge({ subscription_ref: 'rch_abc' }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: 'active', mode: 'fake' });
  assertEquals(sub(db).status, 'active');
  // charging again just reports the current status
  assertEquals(await (await handler(db)(charge({ subscription_ref: 'rch_abc' }))).json(), { status: 'active' });
  assertEquals(db.callsTo('activate_subscription').length, 1);
});

Deno.test('payments charge: live mode calls the gateway and waits for the webhook', async () => {
  const db = paymentsDb();
  const requests: ChargeRequest[] = [];
  const gateway: PaymentGateway = {
    charge: (r) => {
      requests.push(r);
      return Promise.resolve({ status: 'pending' });
    },
  };
  const live = createHandler({
    db,
    gateway,
    env: { PAYMENTS_MODE: 'live', PAYMENTS_WEBHOOK_SECRET: SECRET, SUPABASE_URL: 'https://x.supabase.co' },
    fetch: noNetwork,
    log: silent,
  });
  const res = await live(charge({ subscription_ref: 'rch_abc' }));
  assertEquals(await res.json(), { status: 'pending', redirect_url: null });
  assertEquals(requests, [{
    reference: 'rch_abc',
    amountGhs: 15,
    method: 'mtn_momo',
    phone: '+233241234567',
    callbackUrl: 'https://x.supabase.co/functions/v1/payments/webhook',
  }]);
  assertEquals(sub(db).status, 'pending');

  const failing: PaymentGateway = { charge: () => Promise.resolve({ status: 'failed', message: 'Wallet not found' }) };
  const failed = await createHandler({
    db,
    gateway: failing,
    env: { PAYMENTS_MODE: 'live' },
    fetch: noNetwork,
    log: silent,
  })(charge({ subscription_ref: 'rch_abc' }));
  assertEquals(failed.status, 402);
  assertEquals(sub(db).status, 'failed');
});

Deno.test('payments: unknown route is a 404', async () => {
  const res = await handler(paymentsDb())(
    new Request('http://localhost/functions/v1/payments/refund', { method: 'POST' }),
  );
  assertEquals(res.status, 404);
});
