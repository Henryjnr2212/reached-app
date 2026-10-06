import { assert, assertEquals, assertInstanceOf } from '@std/assert';
import { distanceMeters } from '@reached/core';
import { silent } from '../_shared/log.ts';
import { FakeDb, noNetwork, recordingFetch } from '../_shared/testing.ts';
import { createHandler } from './handler.ts';
import { FakeGhanaPostResolver, getResolver, HttpGhanaPostResolver } from './resolvers.ts';

const JWT = 'user-jwt';

function handler(env: Record<string, string> = { GHANAPOST_MODE: 'fake' }, fetchFn = noNetwork) {
  const db = new FakeDb();
  db.users[JWT] = { id: 'u1' };
  return createHandler({ db, env, fetch: fetchFn, log: silent });
}

function post(body: unknown, jwt: string | null = JWT): Request {
  return new Request('http://localhost/geocode', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  });
}

Deno.test('geocode: requires a signed-in user', async () => {
  assertEquals((await handler()(post({ code: 'GA-123-4567' }, null))).status, 401);
  assertEquals((await handler()(post({ code: 'GA-123-4567' }, 'bad'))).status, 401);
});

Deno.test('geocode: fake mode normalises the code and returns deterministic coordinates near Accra', async () => {
  const r1 = await handler()(post({ code: 'ga 123 4567' }));
  assertEquals(r1.status, 200);
  const a = await r1.json();
  assertEquals(a.code, 'GA-123-4567');
  assertEquals(typeof a.address, 'string');
  assert(a.address.includes('GA-123-4567'));
  const accraCentral = { lat: 5.6037, lng: -0.187 };
  assert(distanceMeters(accraCentral, a) < 15_000, 'within 15 km of Accra Central');

  const b = await (await handler()(post({ code: 'GA1234567' }))).json();
  assertEquals([b.lat, b.lng], [a.lat, a.lng]);
  const c = await (await handler()(post({ code: 'AK-039-5028' }))).json();
  assert(c.lat !== a.lat || c.lng !== a.lng, 'different codes give different points');
});

Deno.test('geocode: invalid codes are a 400', async () => {
  for (const code of ['', 'hello', 'GA-12-34', 123]) {
    assertEquals((await handler()(post({ code }))).status, 400);
  }
});

Deno.test('geocode: resolver selection and live HTTP contract', async () => {
  assertInstanceOf(getResolver({}), FakeGhanaPostResolver);
  assertInstanceOf(
    getResolver({ GHANAPOST_MODE: 'live', GHANAPOST_API_URL: 'https://gp.example/lookup', GHANAPOST_API_KEY: 'k' }),
    HttpGhanaPostResolver,
  );

  const rec = recordingFetch(() =>
    Response.json({ data: { latitude: 5.61, longitude: -0.2, address: 'Osu, Accra', region: 'Greater Accra' } })
  );
  const env = { GHANAPOST_MODE: 'live', GHANAPOST_API_URL: 'https://gp.example/lookup', GHANAPOST_API_KEY: 'k' };
  const res = await handler(env, rec.fetch)(post({ code: 'GA-123-4567' }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    code: 'GA-123-4567',
    lat: 5.61,
    lng: -0.2,
    address: 'Osu, Accra',
    region: 'Greater Accra',
  });
  assertEquals(rec.calls[0]?.headers.get('Authorization'), 'Bearer k');
  assertEquals(JSON.parse(rec.calls[0]!.body), { code: 'GA-123-4567' });

  const notFound = recordingFetch(() => new Response('', { status: 404 }));
  assertEquals((await handler(env, notFound.fetch)(post({ code: 'GA-123-4567' }))).status, 404);
  const down = recordingFetch(() => new Response('', { status: 500 }));
  assertEquals((await handler(env, down.fetch)(post({ code: 'GA-123-4567' }))).status, 502);
  // live mode without config fails clearly instead of calling anything
  assertEquals((await handler({ GHANAPOST_MODE: 'live' })(post({ code: 'GA-123-4567' }))).status, 502);
});
