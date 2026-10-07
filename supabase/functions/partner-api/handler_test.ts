import { assertEquals } from '@std/assert';
import { sha256Hex } from '../_shared/crypto.ts';
import { silent } from '../_shared/log.ts';
import { FakeDb } from '../_shared/testing.ts';
import { createHandler, validateBody } from './handler.ts';

const KEY = 'pk_live_ride_123';

async function partnerDb(): Promise<FakeDb> {
  const db = new FakeDb();
  db.table('partners').push(
    { id: 'p1', name: 'RideCo', key_hash: await sha256Hex(KEY), active: true },
    { id: 'p2', name: 'OldCo', key_hash: await sha256Hex('pk_revoked'), active: false },
  );
  db.onRpc('partner_update_trip', ({ p_link_code }) => p_link_code === 'LINK1234');
  return db;
}

function post(body: unknown, key: string | null = KEY): Request {
  return new Request('http://localhost/partner-api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body),
  });
}

Deno.test('partner-api: missing, unknown or inactive keys are 401', async () => {
  const db = await partnerDb();
  const h = createHandler({ db, log: silent });
  const body = { link_code: 'LINK1234', plate: 'GR 4512-23' };
  assertEquals((await h(post(body, null))).status, 401);
  assertEquals((await h(post(body, 'pk_wrong'))).status, 401);
  assertEquals((await h(post(body, 'pk_revoked'))).status, 401);
  assertEquals(db.callsTo('partner_update_trip').length, 0);
});

Deno.test('partner-api: valid update normalises details and calls partner_update_trip', async () => {
  const db = await partnerDb();
  const res = await createHandler({ db, log: silent })(post({
    link_code: 'LINK1234',
    plate: 'gr-4512-23',
    driver_name: ' Kwame ',
    car: 'Toyota Corolla',
    ride_link: 'https://bolt.eu/ride/abc',
    provider: 'Bolt',
    rider_id: 'r-99',
  }));
  assertEquals(res.status, 200);
  assertEquals(db.callsTo('partner_update_trip'), [{
    p_partner_id: 'p1',
    p_link_code: 'LINK1234',
    p_details: {
      plate: 'GR 4512-23',
      driver_name: 'Kwame',
      car: 'Toyota Corolla',
      ride_link: 'https://bolt.eu/ride/abc',
      provider: 'bolt',
      rider_id: 'r-99',
    },
  }]);
});

Deno.test('partner-api: unknown link code or no active trip is 404', async () => {
  const db = await partnerDb();
  const res = await createHandler({ db, log: silent })(post({ link_code: 'NOPE9999', driver_name: 'Kwame' }));
  assertEquals(res.status, 404);
});

Deno.test('partner-api: validation errors are 400', async () => {
  const db = await partnerDb();
  const h = createHandler({ db, log: silent });
  const bad = [
    {},
    { plate: 'GR 4512-23' },
    { link_code: 'LINK1234' },
    { link_code: 'LINK1234', plate: 'not a plate' },
    { link_code: 'LINK1234', ride_link: 'http://bolt.eu/ride/abc' },
    { link_code: 'LINK1234', ride_link: 'javascript:alert(1)' },
    { link_code: 'LINK1234', provider: 'okada' },
    { link_code: 'LINK1234', driver_name: 42 },
    { link_code: 'LINK1234', driver_name: 'x'.repeat(61) },
  ];
  for (const body of bad) assertEquals((await h(post(body))).status, 400, JSON.stringify(body));
  assertEquals(db.callsTo('partner_update_trip').length, 0);
  assertEquals(validateBody(null).ok, false);
});
