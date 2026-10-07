import { assert, assertEquals, assertInstanceOf, assertMatch } from '@std/assert';
import {
  AfricasTalkingSms,
  AT_LIVE_URL,
  AT_SANDBOX_URL,
  FakeProvider,
  getProvider,
  WhatsAppCloud,
} from './providers.ts';
import { FakeDb, noNetwork, recordingFetch } from './testing.ts';

const AT_OK = {
  SMSMessageData: {
    Message: 'Sent to 1/1 Total Cost: GHS 0.03',
    Recipients: [{
      statusCode: 101,
      number: '+233241234567',
      status: 'Success',
      cost: 'GHS 0.03',
      messageId: 'ATXid_1',
    }],
  },
};

Deno.test('test runner forces MESSAGING_MODE=fake', () => {
  // scripts/test-functions.sh exports it; the suite must never run live.
  const mode = Deno.env.get('MESSAGING_MODE');
  assert(mode === undefined || mode === 'fake', `MESSAGING_MODE is ${mode}`);
});

Deno.test('getProvider: fake unless MESSAGING_MODE is exactly "live"', () => {
  const db = new FakeDb();
  for (const mode of [undefined, '', 'fake', 'LIVE', 'Live', ' live', 'production', 'true']) {
    assertInstanceOf(getProvider('sms', { MESSAGING_MODE: mode }, db, noNetwork), FakeProvider);
    assertInstanceOf(getProvider('whatsapp', { MESSAGING_MODE: mode }, db, noNetwork), FakeProvider);
  }
  assertInstanceOf(getProvider('sms', { MESSAGING_MODE: 'live' }, db, noNetwork), AfricasTalkingSms);
  assertInstanceOf(getProvider('whatsapp', { MESSAGING_MODE: 'live' }, db, noNetwork), WhatsAppCloud);
});

Deno.test('getProvider: live SMS uses sandbox URL only when AFRICASTALKING_SANDBOX=true', () => {
  const db = new FakeDb();
  const sandbox = getProvider(
    'sms',
    { MESSAGING_MODE: 'live', AFRICASTALKING_SANDBOX: 'true' },
    db,
  ) as AfricasTalkingSms;
  const live = getProvider('sms', { MESSAGING_MODE: 'live', AFRICASTALKING_SANDBOX: 'false' }, db) as AfricasTalkingSms;
  assertEquals(sandbox.url, AT_SANDBOX_URL);
  assertEquals(live.url, AT_LIVE_URL);
});

Deno.test('FakeProvider writes a fake_messages row and returns a fake_ id', async () => {
  const db = new FakeDb();
  const res = await new FakeProvider(db).send({ to: '+233241234567', body: 'Hello', channel: 'sms' });
  assert(res.ok);
  assertMatch(res.providerId, /^fake_[0-9a-f-]{36}$/);
  const rows = db.table('fake_messages');
  assertEquals(rows.length, 1);
  assertEquals(rows[0]?.to_phone, '+233241234567');
  assertEquals(rows[0]?.channel, 'sms');
  assertEquals(rows[0]?.body, 'Hello');
  assertEquals(rows[0]?.provider_message_id, res.providerId);
});

Deno.test('FakeProvider reports a database error as a failure', async () => {
  const db = new FakeDb();
  db.failTables.fake_messages = 'boom';
  const res = await new FakeProvider(db).send({ to: '+233241234567', body: 'x', channel: 'sms' });
  assertEquals(res.ok, false);
});

Deno.test("Africa's Talking: request format", async () => {
  const rec = recordingFetch(() => Response.json(AT_OK, { status: 201 }));
  const at = new AfricasTalkingSms({ username: 'reached', apiKey: 'k3y', senderId: 'REACHED' }, rec.fetch);
  const res = await at.send({
    to: '+233241234567',
    body: 'Ama has arrived safely at Work (8:42am). - Reached',
    channel: 'sms',
  });
  assertEquals(res, { ok: true, providerId: 'ATXid_1' });
  assertEquals(rec.calls.length, 1);
  const call = rec.calls[0]!;
  assertEquals(call.url, AT_LIVE_URL);
  assertEquals(call.method, 'POST');
  assertEquals(call.headers.get('apiKey'), 'k3y');
  assertEquals(call.headers.get('Accept'), 'application/json');
  assertEquals(call.headers.get('Content-Type'), 'application/x-www-form-urlencoded');
  const form = new URLSearchParams(call.body);
  assertEquals(form.get('username'), 'reached');
  assertEquals(form.get('to'), '+233241234567');
  assertEquals(form.get('message'), 'Ama has arrived safely at Work (8:42am). - Reached');
  assertEquals(form.get('from'), 'REACHED');
});

Deno.test("Africa's Talking: sandbox URL and no sender id field when unset", async () => {
  const rec = recordingFetch(() => Response.json(AT_OK, { status: 201 }));
  await new AfricasTalkingSms({ username: 'sandbox', apiKey: 'k', sandbox: true }, rec.fetch)
    .send({ to: '+233241234567', body: 'x', channel: 'sms' });
  assertEquals(rec.calls[0]?.url, AT_SANDBOX_URL);
  assertEquals(new URLSearchParams(rec.calls[0]!.body).has('from'), false);
});

Deno.test("Africa's Talking: non-Success recipient status is a failure with the status text", async () => {
  const rec = recordingFetch(() =>
    Response.json({
      SMSMessageData: {
        Message: 'Sent to 0/1',
        Recipients: [{ statusCode: 405, status: 'InsufficientBalance', messageId: 'None' }],
      },
    })
  );
  const res = await new AfricasTalkingSms({ username: 'u', apiKey: 'k' }, rec.fetch)
    .send({ to: '+233241234567', body: 'x', channel: 'sms' });
  assertEquals(res, { ok: false, reason: 'InsufficientBalance' });
});

Deno.test("Africa's Talking: HTTP error, empty recipients and network error are failures", async () => {
  const http = recordingFetch(() => new Response('The supplied authentication is invalid', { status: 401 }));
  const r1 = await new AfricasTalkingSms({ username: 'u', apiKey: 'bad' }, http.fetch)
    .send({ to: '+233241234567', body: 'x', channel: 'sms' });
  assertEquals(r1.ok, false);

  const empty = recordingFetch(() => Response.json({ SMSMessageData: { Message: 'InvalidSenderId', Recipients: [] } }));
  const r2 = await new AfricasTalkingSms({ username: 'u', apiKey: 'k' }, empty.fetch)
    .send({ to: '+233241234567', body: 'x', channel: 'sms' });
  assertEquals(r2, { ok: false, reason: 'InvalidSenderId' });

  const r3 = await new AfricasTalkingSms({ username: 'u', apiKey: 'k' }, () => Promise.reject(new Error('dns')))
    .send({ to: '+233241234567', body: 'x', channel: 'sms' });
  assertEquals(r3.ok, false);
});

Deno.test('WhatsApp: stub refuses to send when not configured (no HTTP call)', async () => {
  for (const cfg of [{}, { accessToken: 't' }, { phoneNumberId: '123' }]) {
    const wa = new WhatsAppCloud(cfg, noNetwork);
    assertEquals(wa.configured, false);
    assertEquals(await wa.send({ to: '+233241234567', body: 'x', channel: 'whatsapp' }), {
      ok: false,
      reason: 'WhatsApp not configured',
    });
  }
});

Deno.test('WhatsApp: configured sends a text message to the Graph API', async () => {
  const rec = recordingFetch(() =>
    Response.json({
      messaging_product: 'whatsapp',
      contacts: [{ wa_id: '233241234567' }],
      messages: [{ id: 'wamid.ABC' }],
    })
  );
  const wa = new WhatsAppCloud({ accessToken: 'tok', phoneNumberId: '1098' }, rec.fetch);
  const res = await wa.send({ to: '+233241234567', body: 'Ama has arrived', channel: 'whatsapp' });
  assertEquals(res, { ok: true, providerId: 'wamid.ABC' });
  const call = rec.calls[0]!;
  assertEquals(call.url, 'https://graph.facebook.com/v21.0/1098/messages');
  assertEquals(call.headers.get('Authorization'), 'Bearer tok');
  const body = JSON.parse(call.body);
  assertEquals(body.messaging_product, 'whatsapp');
  assertEquals(body.to, '233241234567');
  assertEquals(body.type, 'text');
  assertEquals(body.text.body, 'Ama has arrived');
});

Deno.test('WhatsApp: Graph API error is a failure', async () => {
  const rec = recordingFetch(() =>
    Response.json({ error: { message: 'Recipient not in allowed list' } }, { status: 400 })
  );
  const res = await new WhatsAppCloud({ accessToken: 't', phoneNumberId: '1' }, rec.fetch)
    .send({ to: '+233241234567', body: 'x', channel: 'whatsapp' });
  assertEquals(res, { ok: false, reason: 'Recipient not in allowed list' });
});
