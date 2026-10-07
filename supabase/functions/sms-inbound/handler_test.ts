import { assertEquals } from '@std/assert';
import { parseInboundKeyword } from '@reached/core';
import { silent } from '../_shared/log.ts';
import { FakeDb, noNetwork } from '../_shared/testing.ts';
import { createHandler } from './handler.ts';

const TOKEN = 'cb-token-1';

/**
 * A small model of handle_inbound: STOP opts the contact out (no reply),
 * REACHED returns request_unknown for strangers and request_decline for
 * contacts who can't ask.
 */
function inboundDb(): FakeDb {
  const db = new FakeDb();
  db.table('contacts').push(
    { phone: '+233241234567', opted_out_at: null, can_request_location: true, owner: 'Ama' },
    { phone: '+233501112222', opted_out_at: null, can_request_location: false, owner: 'Kofi' },
  );
  db.onRpc('handle_inbound', ({ p_from, p_body }) => {
    const word = parseInboundKeyword(String(p_body));
    const contacts = db.table('contacts').filter((c) => c.phone === p_from);
    if (word === 'STOP') {
      for (const c of contacts) c.opted_out_at = '2026-10-06T12:00:00Z';
      return [];
    }
    if (word === 'REACHED') {
      if (!contacts.length) return [{ to: p_from, template: 'request_unknown', params: {} }];
      return contacts.filter((c) => !c.can_request_location).map((c) => ({
        to: p_from,
        template: 'request_decline',
        params: { name: c.owner },
      }));
    }
    return [];
  });
  return db;
}

function inbound(form: Record<string, string>, token = TOKEN): Request {
  return new Request(`http://localhost/sms-inbound?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
}

function handler(db: FakeDb) {
  return createHandler({
    db,
    env: { MESSAGING_MODE: 'fake', AFRICASTALKING_CALLBACK_TOKEN: TOKEN },
    fetch: noNetwork,
    log: silent,
  });
}

const AT_FIELDS = { to: '20880', date: '2026-10-06 12:00:00', id: 'ATXid_in_1', linkId: 'lk1' };

Deno.test('sms-inbound: wrong or missing token is rejected', async () => {
  const db = inboundDb();
  assertEquals((await handler(db)(inbound({ ...AT_FIELDS, from: '+233241234567', text: 'STOP' }, 'nope'))).status, 401);
  const noToken = createHandler({ db, env: { AFRICASTALKING_CALLBACK_TOKEN: '' }, fetch: noNetwork, log: silent });
  assertEquals((await noToken(inbound({ from: '+233241234567', text: 'STOP' }, ''))).status, 401);
  assertEquals(db.callsTo('handle_inbound').length, 0);
});

Deno.test('sms-inbound: STOP is passed to handle_inbound with an E.164 number and sends no reply', async () => {
  const db = inboundDb();
  const res = await handler(db)(inbound({ ...AT_FIELDS, from: '0241234567', text: ' stop ' }));
  assertEquals(res.status, 200);
  assertEquals(db.callsTo('handle_inbound'), [{ p_from: '+233241234567', p_body: ' stop ' }]);
  assertEquals(db.table('contacts')[0]?.opted_out_at, '2026-10-06T12:00:00Z');
  assertEquals(db.table('fake_messages').length, 0);
});

Deno.test('sms-inbound: REACHED from an unknown number gets the request_unknown reply', async () => {
  const db = inboundDb();
  await handler(db)(inbound({ ...AT_FIELDS, from: '+233279998888', text: 'REACHED' }));
  const sent = db.table('fake_messages');
  assertEquals(sent.length, 1);
  assertEquals(sent[0]?.to_phone, '+233279998888');
  assertEquals(sent[0]?.channel, 'sms');
  assertEquals(
    sent[0]?.body,
    "Reached: we couldn't find who you're asking about. Ask them to add you as a contact first.",
  );
});

Deno.test('sms-inbound: REACHED from a contact who cannot ask gets request_decline', async () => {
  const db = inboundDb();
  await handler(db)(inbound({ ...AT_FIELDS, from: '233501112222', text: 'Reached Kofi' }));
  assertEquals(db.table('fake_messages')[0]?.body, "Kofi can't share right now.");
});

Deno.test('sms-inbound: non-Ghana senders are ignored with 200', async () => {
  const db = inboundDb();
  const res = await handler(db)(inbound({ ...AT_FIELDS, from: '+447700900123', text: 'REACHED' }));
  assertEquals(res.status, 200);
  assertEquals(db.callsTo('handle_inbound').length, 0);
});

Deno.test('sms-inbound: replies can run in the background after the 200', async () => {
  const db = inboundDb();
  const pending: Promise<unknown>[] = [];
  const h = createHandler({
    db,
    env: { AFRICASTALKING_CALLBACK_TOKEN: TOKEN },
    fetch: noNetwork,
    log: silent,
    background: (p) => pending.push(p),
  });
  const res = await h(inbound({ ...AT_FIELDS, from: '+233279998888', text: 'REACHED' }));
  assertEquals(res.status, 200);
  assertEquals(pending.length, 1);
  await Promise.all(pending);
  assertEquals(db.table('fake_messages').length, 1);
});
