import { assertEquals } from '@std/assert';
import { silent } from '../_shared/log.ts';
import { FakeDb, noNetwork } from '../_shared/testing.ts';
import { hexHmac } from '../_shared/webhooks.ts';
import { createHandler } from './handler.ts';

const ENV = { MESSAGING_MODE: 'fake', WHATSAPP_VERIFY_TOKEN: 'verify-me', WHATSAPP_APP_SECRET: 'app-secret' };

function handler(db = new FakeDb()) {
  return createHandler({ db, env: ENV, fetch: noNetwork, log: silent });
}

async function signedPost(payload: unknown, secret = ENV.WHATSAPP_APP_SECRET): Promise<Request> {
  const raw = JSON.stringify(payload);
  return new Request('http://localhost/whatsapp-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${await hexHmac(secret, raw)}` },
    body: raw,
  });
}

function envelope(value: Record<string, unknown>) {
  return { object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value }] }] };
}

Deno.test('whatsapp: GET verification echoes the challenge only with the right token', async () => {
  const ok = await handler()(
    new Request(
      'http://localhost/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1158201444',
    ),
  );
  assertEquals(ok.status, 200);
  assertEquals(await ok.text(), '1158201444');
  const bad = await handler()(
    new Request('http://localhost/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1'),
  );
  assertEquals(bad.status, 403);
  const wrongMode = await handler()(
    new Request('http://localhost/whatsapp-webhook?hub.mode=unsubscribe&hub.verify_token=verify-me&hub.challenge=1'),
  );
  assertEquals(wrongMode.status, 403);
});

Deno.test('whatsapp: POST without a valid X-Hub-Signature-256 is rejected', async () => {
  const db = new FakeDb();
  const payload = envelope({ statuses: [{ id: 'wamid.1', status: 'delivered' }] });
  assertEquals((await handler(db)(await signedPost(payload, 'wrong-secret'))).status, 401);
  const unsigned = new Request('http://localhost/whatsapp-webhook', { method: 'POST', body: JSON.stringify(payload) });
  assertEquals((await handler(db)(unsigned)).status, 401);
  assertEquals(db.rpcCalls.length, 0);
});

Deno.test('whatsapp: statuses map to update_message_status', async () => {
  const db = new FakeDb();
  const res = await handler(db)(
    await signedPost(envelope({
      statuses: [
        { id: 'wamid.1', status: 'sent' },
        { id: 'wamid.2', status: 'delivered' },
        { id: 'wamid.3', status: 'read' },
        { id: 'wamid.4', status: 'failed', errors: [{ code: 131026, title: 'Message undeliverable' }] },
      ],
    })),
  );
  assertEquals(res.status, 200);
  assertEquals(db.callsTo('update_message_status'), [
    { p_provider_id: 'wamid.2', p_status: 'delivered', p_reason: null },
    { p_provider_id: 'wamid.3', p_status: 'delivered', p_reason: null },
    { p_provider_id: 'wamid.4', p_status: 'failed', p_reason: "They can't receive WhatsApp messages on this number" },
  ]);
});

Deno.test('whatsapp: inbound text goes to handle_inbound and replies go back over WhatsApp', async () => {
  const db = new FakeDb().onRpc('handle_inbound', ({ p_from }) => [
    { to: p_from, template: 'request_accept', params: { name: 'Ama' } },
  ]);
  const res = await handler(db)(
    await signedPost(envelope({
      contacts: [{ wa_id: '233241234567' }],
      messages: [
        { from: '233241234567', id: 'wamid.in', type: 'text', text: { body: 'REACHED' } },
        { from: '233241234567', id: 'wamid.img', type: 'image', image: { id: 'x' } },
      ],
    })),
  );
  assertEquals(res.status, 200);
  assertEquals(db.callsTo('handle_inbound'), [{ p_from: '+233241234567', p_body: 'REACHED' }]);
  const sent = db.table('fake_messages');
  assertEquals(sent.length, 1);
  assertEquals(sent[0]?.channel, 'whatsapp');
  assertEquals(sent[0]?.to_phone, '+233241234567');
  assertEquals(sent[0]?.body, 'Ama will let you know when Ama reaches.');
});

Deno.test('whatsapp: STOP produces no reply', async () => {
  const db = new FakeDb().onRpc('handle_inbound', () => []);
  await handler(db)(
    await signedPost(envelope({ messages: [{ from: '233241234567', type: 'text', text: { body: 'STOP' } }] })),
  );
  assertEquals(db.callsTo('handle_inbound').length, 1);
  assertEquals(db.table('fake_messages').length, 0);
});
