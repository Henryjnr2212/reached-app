import { assertEquals, assertStringIncludes } from '@std/assert';
import { fitsOneSms } from '@reached/core';
import { toBase64 } from '../_shared/crypto.ts';
import { silent } from '../_shared/log.ts';
import { FakeDb, noNetwork } from '../_shared/testing.ts';
import { signStandardWebhook, verifyStandardWebhook } from '../_shared/webhooks.ts';
import { createHandler, otpBody } from './handler.ts';

const SECRET = `v1,whsec_${toBase64(new TextEncoder().encode('super-secret-hook-key-0123456789'))}`;
const NOW_MS = Date.UTC(2026, 9, 6, 12, 0, 0);
const NOW_S = Math.floor(NOW_MS / 1000);
const HASH = 'FA+9qCX9VSu';

async function signed(body: unknown, opts: { ts?: number; secret?: string; id?: string } = {}): Promise<Request> {
  const raw = JSON.stringify(body);
  const id = opts.id ?? 'msg_2Lh9KRb0pzN4LePd3XiA4h';
  const ts = String(opts.ts ?? NOW_S);
  const sig = await signStandardWebhook(opts.secret ?? SECRET, id, ts, raw);
  return new Request('http://localhost/send-sms', {
    method: 'POST',
    headers: {
      'webhook-id': id,
      'webhook-timestamp': ts,
      'webhook-signature': sig,
      'content-type': 'application/json',
    },
    body: raw,
  });
}

const PAYLOAD = { user: { id: 'u1', phone: '233241234567' }, sms: { otp: '482913' } };

function handler(db = new FakeDb(), env: Record<string, string> = {}) {
  return createHandler({
    db,
    env: { MESSAGING_MODE: 'fake', SEND_SMS_HOOK_SECRET: SECRET, ANDROID_SMS_HASH: HASH, ...env },
    fetch: noNetwork,
    log: silent,
    now: () => NOW_MS,
  });
}

Deno.test('send-sms: valid signature sends the OTP through the fake provider', async () => {
  const db = new FakeDb();
  const res = await handler(db)(await signed(PAYLOAD));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {});
  const rows = db.table('fake_messages');
  assertEquals(rows.length, 1);
  assertEquals(rows[0]?.to_phone, '+233241234567');
  assertEquals(rows[0]?.channel, 'sms');
  assertEquals(rows[0]?.body, `<#> Your Reached code is 482913. Don't share it with anyone.\n${HASH}`);
});

Deno.test('send-sms: OTP text with and without the Android app hash', () => {
  assertEquals(otpBody('123456'), "<#> Your Reached code is 123456. Don't share it with anyone.");
  const withHash = otpBody('123456', HASH);
  assertStringIncludes(withHash, 'Your Reached code is 123456');
  assertEquals(withHash.split('\n')[1], HASH);
  assertEquals(fitsOneSms(withHash), true);
});

Deno.test('send-sms: bad signature is rejected and nothing is sent', async () => {
  const db = new FakeDb();
  const otherSecret = `v1,whsec_${toBase64(new TextEncoder().encode('a-different-secret'))}`;
  const res = await handler(db)(await signed(PAYLOAD, { secret: otherSecret }));
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error.http_code, 401);
  assertEquals(db.table('fake_messages').length, 0);
});

Deno.test('send-sms: tampered body is rejected', async () => {
  const req = await signed(PAYLOAD);
  const tampered = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ ...PAYLOAD, user: { phone: '233509999999' } }),
  });
  assertEquals((await handler()(tampered)).status, 401);
});

Deno.test('send-sms: stale (>5 min) and far-future timestamps are rejected', async () => {
  assertEquals((await handler()(await signed(PAYLOAD, { ts: NOW_S - 301 }))).status, 401);
  assertEquals((await handler()(await signed(PAYLOAD, { ts: NOW_S + 600 }))).status, 401);
  assertEquals((await handler()(await signed(PAYLOAD, { ts: NOW_S - 299 }))).status, 200);
});

Deno.test('send-sms: missing headers or unset secret are rejected', async () => {
  const plain = new Request('http://localhost/send-sms', { method: 'POST', body: JSON.stringify(PAYLOAD) });
  assertEquals((await handler()(plain)).status, 401);
  const res = await createHandler({ db: new FakeDb(), env: {}, fetch: noNetwork, log: silent, now: () => NOW_MS })(
    await signed(PAYLOAD),
  );
  assertEquals(res.status, 401);
  const r = await verifyStandardWebhook(undefined, new Headers(), '');
  assertEquals(r.ok, false);
});

Deno.test('send-sms: accepts any matching signature in a space-separated list', async () => {
  const req = await signed(PAYLOAD);
  const headers = new Headers(req.headers);
  headers.set('webhook-signature', `v1,AAAA ${req.headers.get('webhook-signature')}`);
  const res = await handler()(new Request(req.url, { method: 'POST', headers, body: JSON.stringify(PAYLOAD) }));
  assertEquals(res.status, 200);
});

Deno.test('send-sms: non-Ghana numbers and missing codes get a hook error', async () => {
  const r1 = await handler()(await signed({ user: { phone: '447700900123' }, sms: { otp: '123456' } }));
  assertEquals(r1.status, 400);
  assertEquals((await r1.json()).error.http_code, 400);
  const r2 = await handler()(await signed({ user: { phone: '233241234567' }, sms: {} }));
  assertEquals(r2.status, 400);
});

Deno.test('send-sms: provider failure returns a 500 hook error', async () => {
  const db = new FakeDb();
  db.failTables.fake_messages = 'down';
  const res = await handler(db)(await signed(PAYLOAD));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error.http_code, 500);
});
