import { assertEquals } from '@std/assert';
import { silent } from '../_shared/log.ts';
import { FakeDb, fakeJwt } from '../_shared/testing.ts';
import { createHandler, tokenIsFresh } from './handler.ts';

const NOW_MS = Date.UTC(2026, 9, 6, 12, 0, 0);
const NOW_S = NOW_MS / 1000;

function setup(iat: number | undefined) {
  const db = new FakeDb();
  const jwt = fakeJwt({ sub: 'user-1', role: 'authenticated', ...(iat === undefined ? {} : { iat }) });
  db.users[jwt] = { id: 'user-1', phone: '233241234567' };
  return { db, jwt, handler: createHandler({ db, log: silent, now: () => NOW_MS }) };
}

function post(jwt?: string): Request {
  return new Request('http://localhost/delete-account', {
    method: 'POST',
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  });
}

Deno.test('delete-account: fresh token (re-verified OTP) deletes the user', async () => {
  const { db, jwt, handler } = setup(NOW_S - 60);
  const res = await handler(post(jwt));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(db.deletedUsers, ['user-1']);
});

Deno.test('delete-account: token older than 10 minutes needs re-verification', async () => {
  const { db, jwt, handler } = setup(NOW_S - 11 * 60);
  const res = await handler(post(jwt));
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error.code, 'reauth_required');
  assertEquals(db.deletedUsers, []);
});

Deno.test('delete-account: missing iat, missing or invalid token are rejected', async () => {
  const noIat = setup(undefined);
  assertEquals((await noIat.handler(post(noIat.jwt))).status, 403);
  const { db, handler } = setup(NOW_S);
  assertEquals((await handler(post())).status, 401);
  assertEquals((await handler(post(fakeJwt({ sub: 'someone', iat: NOW_S })))).status, 401);
  assertEquals((await handler(new Request('http://localhost/delete-account'))).status, 405);
  assertEquals(db.deletedUsers, []);
});

Deno.test('tokenIsFresh boundaries', () => {
  assertEquals(tokenIsFresh(fakeJwt({ iat: NOW_S - 600 }), NOW_MS), true);
  assertEquals(tokenIsFresh(fakeJwt({ iat: NOW_S - 601 }), NOW_MS), false);
  assertEquals(tokenIsFresh(fakeJwt({ iat: NOW_S + 3600 }), NOW_MS), false);
  assertEquals(tokenIsFresh(fakeJwt({ iat: 'yesterday' }), NOW_MS), false);
});
