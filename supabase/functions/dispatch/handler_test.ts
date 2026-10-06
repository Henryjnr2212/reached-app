import { assert, assertEquals, assertFalse } from '@std/assert';
import { gsm7Length } from '@reached/core';
import { silent } from '../_shared/log.ts';
import type { MessageProvider, OutboundMessage, SendResult } from '../_shared/providers.ts';
import { FakeDb, noNetwork, recordingFetch, type Row } from '../_shared/testing.ts';
import { createHandler, type DispatchDeps, type MessageRow } from './handler.ts';
import { EXPO_PUSH_URL, PUSH_CATEGORIES } from './push.ts';

const SECRET = 'dispatch-secret-123';
const SERVICE = 'service-role-key';
const NOW = new Date('2026-10-06T12:00:00Z');

function msg(over: Partial<MessageRow> = {}): MessageRow {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    event_id: 'e1',
    contact_id: 'c1',
    contact_name: 'Mom',
    to_phone: '+233241234567',
    channel: 'sms',
    template: 'arrived',
    params: { name: 'Ama', place: 'Work', time: '8:42am' },
    language: 'en',
    ...over,
  };
}

/** claim_messages returns the queue in pages of p_limit, like the real RPC. */
function dbWithQueue(queue: MessageRow[]): FakeDb {
  const pending = [...queue];
  return new FakeDb().onRpc('claim_messages', (a) => pending.splice(0, Number(a.p_limit)));
}

function deps(db: FakeDb, over: Partial<DispatchDeps> = {}): DispatchDeps {
  return {
    db,
    env: { MESSAGING_MODE: 'fake', DISPATCH_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: SERVICE },
    fetch: noNetwork,
    log: silent,
    now: () => NOW,
    ...over,
  };
}

function post(headers: Record<string, string> = { 'x-dispatch-secret': SECRET }): Request {
  return new Request('http://localhost/dispatch', { method: 'POST', headers, body: '{}' });
}

Deno.test('dispatch: rejects missing or wrong credentials', async () => {
  const db = dbWithQueue([msg()]);
  const handler = createHandler(deps(db));
  for (
    const headers of [
      {} as Record<string, string>,
      { 'x-dispatch-secret': 'wrong' },
      { Authorization: 'Bearer wrong' },
      { Authorization: `Bearer ${SECRET}` },
    ]
  ) {
    const res = await handler(post(headers));
    assertEquals(res.status, 401);
  }
  assertEquals(db.callsTo('claim_messages').length, 0);
});

Deno.test('dispatch: empty DISPATCH_SECRET never matches an empty header', async () => {
  const db = dbWithQueue([]);
  const d = deps(db);
  d.env = { ...d.env, DISPATCH_SECRET: '' };
  assertEquals((await createHandler(d)(post({ 'x-dispatch-secret': '' }))).status, 401);
});

Deno.test('dispatch: accepts x-dispatch-secret and service-role bearer', async () => {
  const handler = createHandler(deps(dbWithQueue([])));
  assertEquals((await handler(post())).status, 200);
  assertEquals((await handler(post({ Authorization: `Bearer ${SERVICE}` }))).status, 200);
  assertEquals((await handler(new Request('http://localhost/dispatch'))).status, 405);
});

Deno.test('dispatch: renders, sends through the fake provider and marks each message sent', async () => {
  const m = msg();
  const db = dbWithQueue([m]);
  const res = await createHandler(deps(db))(post());
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.mode, 'fake');
  assertEquals(body.messages, { claimed: 1, sent: 1, failed: 0 });

  const sent = db.table('fake_messages');
  assertEquals(sent.length, 1);
  assertEquals(sent[0]?.body, 'Ama has arrived safely at Work (8:42am). - Reached');
  assertEquals(sent[0]?.to_phone, '+233241234567');

  const marks = db.callsTo('mark_message');
  assertEquals(marks, [{
    p_id: m.id,
    p_status: 'sent',
    p_body: 'Ama has arrived safely at Work (8:42am). - Reached',
    p_provider_id: sent[0]?.provider_message_id,
  }]);
  assertEquals(db.callsTo('claim_messages'), [{ p_limit: 50 }]);
});

Deno.test('dispatch: custom template uses the user wording', async () => {
  const db = dbWithQueue([
    msg({
      template: 'custom',
      params: { custom: '{name} is home safe at {place} ({time}) :)', name: 'Kofi', place: 'Home', time: '10:05pm' },
    }),
  ]);
  await createHandler(deps(db))(post());
  assertEquals(db.table('fake_messages')[0]?.body, 'Kofi is home safe at Home (10:05pm) :)');
});

Deno.test('dispatch: uses the contact language and falls back to English', async () => {
  const db = dbWithQueue([
    msg({ language: 'tw' }),
    msg({ language: 'ee', template: 'on_the_way', params: { name: 'Ama', place: 'Work', due: '6:30pm' } }),
    msg({ language: 'fr' }),
  ]);
  await createHandler(deps(db))(post());
  const bodies = db.table('fake_messages').map((r) => r.body);
  assertEquals(bodies[0], 'Ama adu Work dwoodwoo (8:42am). - Reached');
  // Ewe has no on_the_way translation yet → English
  assertEquals(bodies[1], 'Ama is on the way to Work, expected around 6:30pm. - Reached');
  assertEquals(bodies[2], 'Ama has arrived safely at Work (8:42am). - Reached');
});

Deno.test('dispatch: every body fits one GSM-7 SMS (160 limit)', async () => {
  const long = 'Kotoka International Airport Terminal 3 Departures Hall Gate 12 near the Forex bureau';
  const db = dbWithQueue([
    msg({ params: { name: 'Akosua Nyarko-Mensah-Boateng', place: long, time: '11:59pm' } }),
    msg({
      template: 'overdue_alert',
      params: {
        name: 'Akosua',
        place: long,
        due: '6:30pm',
        lastSeen: '6:12pm',
        link: 'https://reached.app/l/abcdEFGH12',
        phoneMayBeOff: true,
      },
    }),
    msg({ template: 'custom', params: { custom: `${'x'.repeat(200)} {name} 😀 {place}`, name: 'Ama', place: long } }),
  ]);
  await createHandler(deps(db))(post());
  const rows = db.table('fake_messages');
  assertEquals(rows.length, 3);
  for (const r of rows) {
    const len = gsm7Length(String(r.body));
    assert(len <= 160, `${len} septets: ${r.body}`);
  }
  assert(String(rows[1]?.body).includes('https://reached.app/l/abcdEFGH12'), 'alert keeps the live link');
});

Deno.test('dispatch: provider failure and unknown template mark the message failed', async () => {
  const ok = msg();
  const bad = msg({ to_phone: '+233501112222' });
  const unknown = msg({ template: 'mystery' });
  const db = dbWithQueue([ok, bad, unknown]);
  const provider: MessageProvider = {
    name: 'test',
    send(m: OutboundMessage): Promise<SendResult> {
      return Promise.resolve(
        m.to === '+233501112222' ? { ok: false, reason: 'InsufficientBalance' } : { ok: true, providerId: 'p1' },
      );
    },
  };
  const res = await createHandler(deps(db, { provider: () => provider }))(post());
  assertEquals((await res.json()).messages, { claimed: 3, sent: 1, failed: 2 });
  const marks = db.callsTo('mark_message');
  const byId = new Map(marks.map((m) => [m.p_id, m]));
  assertEquals(byId.get(ok.id)?.p_status, 'sent');
  assertEquals(byId.get(bad.id)?.p_status, 'failed');
  assertEquals(byId.get(bad.id)?.p_reason, 'InsufficientBalance');
  assertEquals(byId.get(unknown.id)?.p_status, 'failed');
  assertEquals(byId.get(unknown.id)?.p_reason, 'Unknown template mystery');
});

Deno.test('dispatch: a throwing provider marks failed instead of crashing the run', async () => {
  const db = dbWithQueue([msg()]);
  const provider: MessageProvider = { name: 'x', send: () => Promise.reject(new Error('socket hang up')) };
  const res = await createHandler(deps(db, { provider: () => provider }))(post());
  assertEquals(res.status, 200);
  assertEquals(db.callsTo('mark_message')[0]?.p_status, 'failed');
});

Deno.test('dispatch: WhatsApp rows go through the WhatsApp provider', async () => {
  const db = dbWithQueue([msg({ channel: 'whatsapp' }), msg()]);
  const seen: string[] = [];
  const provider = (ch: string): MessageProvider => ({
    name: ch,
    send: () => {
      seen.push(ch);
      return Promise.resolve({ ok: true, providerId: ch });
    },
  });
  await createHandler(deps(db, { provider }))(post());
  assertEquals(seen.sort(), ['sms', 'whatsapp']);
});

Deno.test('dispatch: keeps claiming while full pages come back', async () => {
  const queue = Array.from({ length: 120 }, () => msg());
  const db = dbWithQueue(queue);
  const res = await createHandler(deps(db))(post());
  assertEquals((await res.json()).messages.sent, 120);
  assertEquals(db.callsTo('claim_messages').length, 3);
  assertEquals(db.callsTo('mark_message').length, 120);
});

// ---- push ------------------------------------------------------------------

function notification(over: Partial<Row> = {}): Row {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    kind: 'arrival_sent',
    title: 'Told Mom you reached Work',
    body: 'Tap to see details',
    data: { event_id: 'e1' },
    created_at: '2026-10-06T11:00:00Z',
    sent_at: null,
    ...over,
  };
}

Deno.test('push: fake mode makes no HTTP call but marks sent_at', async () => {
  const db = dbWithQueue([]);
  db.table('notifications').push(notification(), notification({ kind: 'are_you_okay' }));
  db.table('push_tokens').push({ token: 'ExponentPushToken[a]', user_id: 'u1', platform: 'android' });
  const res = await createHandler(deps(db, { fetch: noNetwork }))(post());
  const body = await res.json();
  assertEquals(body.push.notifications, 2);
  assertEquals(body.push.skipped_http, true);
  for (const n of db.table('notifications')) assertEquals(n.sent_at, NOW.toISOString());
});

Deno.test('push: live mode batches to Expo with data and category ids', async () => {
  const db = dbWithQueue([]);
  const kinds = Object.keys(PUSH_CATEGORIES);
  for (const kind of [...kinds, 'arrival_sent']) db.table('notifications').push(notification({ kind }));
  // one already sent: must not be pushed again
  db.table('notifications').push(notification({ sent_at: '2026-10-06T10:00:00Z', title: 'old' }));
  // 15 devices for u1 → 8 notifications × 15 = 120 messages → 2 Expo requests
  for (let i = 0; i < 15; i++) {
    db.table('push_tokens').push({ token: `ExponentPushToken[${i}]`, user_id: 'u1', platform: 'android' });
  }
  db.table('push_tokens').push({ token: 'ExponentPushToken[other]', user_id: 'u2', platform: 'ios' });

  const rec = recordingFetch(({ body }) => {
    const n = (JSON.parse(body) as unknown[]).length;
    return Response.json({ data: Array.from({ length: n }, (_, i) => ({ status: 'ok', id: `t${i}` })) });
  });
  const d = deps(db, { fetch: rec.fetch });
  d.env = { ...d.env, MESSAGING_MODE: 'live', EXPO_ACCESS_TOKEN: 'expo-tok' };
  const res = await createHandler(d)(post());
  const body = await res.json();

  assertEquals(rec.calls.length, 2);
  for (const c of rec.calls) {
    assertEquals(c.url, EXPO_PUSH_URL);
    assertEquals(c.headers.get('Authorization'), 'Bearer expo-tok');
  }
  const sent = rec.calls.flatMap((c) => JSON.parse(c.body) as Record<string, unknown>[]);
  assertEquals(sent.length, 120);
  assertEquals(JSON.parse(rec.calls[0]!.body).length, 100);
  assertEquals(body.push, { notifications: 8, pushed: 120, errors: 0, skipped_http: false });
  assertFalse(sent.some((m) => m.title === 'old'));
  assertFalse(sent.some((m) => m.to === 'ExponentPushToken[other]'));

  const byKind = (k: string) => sent.find((m) => (m.data as Record<string, unknown>).kind === k)!;
  for (const k of kinds) assertEquals(byKind(k).categoryId, k);
  assertEquals(byKind('arrival_sent').categoryId, undefined);
  assertEquals(byKind('are_you_okay').priority, 'high');
  assertEquals((byKind('arrival_sent').data as Record<string, unknown>).event_id, 'e1');
  assert((byKind('arrival_sent').data as Record<string, unknown>).notification_id);
  assertEquals(PUSH_CATEGORIES.are_you_okay, ["I'm okay", 'Need more time', 'Get help']);
  assertEquals(PUSH_CATEGORIES.contact_request, ['Accept', 'Decline']);
});

Deno.test('push: DeviceNotRegistered tokens are removed; HTTP failure releases the claim', async () => {
  const db = dbWithQueue([]);
  db.table('notifications').push(notification());
  db.table('push_tokens').push(
    { token: 'ExponentPushToken[dead]', user_id: 'u1', platform: 'android' },
    { token: 'ExponentPushToken[live]', user_id: 'u1', platform: 'android' },
  );
  const rec = recordingFetch(({ body }) => {
    const msgs = JSON.parse(body) as { to: string }[];
    return Response.json({
      data: msgs.map((m) =>
        m.to.includes('dead')
          ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: 'x' }
      ),
    });
  });
  const d = deps(db, { fetch: rec.fetch });
  d.env = { ...d.env, MESSAGING_MODE: 'live' };
  await createHandler(d)(post());
  assertEquals(db.table('push_tokens').map((t) => t.token), ['ExponentPushToken[live]']);

  const db2 = dbWithQueue([]);
  db2.table('notifications').push(notification());
  db2.table('push_tokens').push({ token: 'ExponentPushToken[a]', user_id: 'u1', platform: 'android' });
  const d2 = deps(db2, { fetch: () => Promise.resolve(new Response('busy', { status: 503 })) });
  d2.env = { ...d2.env, MESSAGING_MODE: 'live' };
  const body = await (await createHandler(d2)(post())).json();
  assertEquals(body.push.errors, 1);
  assertEquals(db2.table('notifications')[0]?.sent_at, null);
});
