import { assert, assertEquals, assertFalse } from '@std/assert';
import { decodeJwtPayload } from './auth.ts';
import { safeEqual, sha256Hex } from './crypto.ts';
import { redact } from './log.ts';
import { renderMessage } from './render.ts';
import { fakeJwt } from './testing.ts';

Deno.test('safeEqual compares secrets', async () => {
  assert(await safeEqual('secret', 'secret'));
  assertFalse(await safeEqual('secret', 'Secret'));
  assertFalse(await safeEqual('secret', 'secret2'));
  assertFalse(await safeEqual('', ''));
  assertFalse(await safeEqual(null, 'x'));
  assertFalse(await safeEqual('x', undefined));
});

Deno.test('sha256Hex matches a known vector', async () => {
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

Deno.test('logs never contain full phone numbers or coordinates', () => {
  const out = redact({ to: '+233241234567', from_phone: '+233501234567', lat: 5.6, lng: -0.18, id: 'x' });
  assertEquals(out, { to: '+233 24 ••• 4567', from_phone: '+233 50 ••• 4567', id: 'x' });
  assertFalse(JSON.stringify(out).includes('241234567'));
  // already-masked values are kept as they are
  assertEquals(redact({ to: '+233 24 ••• 4567' }).to, '+233 24 ••• 4567');
});

Deno.test('renderMessage handles custom, templates, languages and unknown templates', () => {
  assertEquals(
    renderMessage('custom', { custom: '{name} is home at {place}!', name: 'Ama', place: 'Home', time: '9pm' }),
    { ok: true, body: 'Ama is home at Home!' },
  );
  assertEquals(renderMessage('arrived', { name: 'Ama', place: 'Work', time: '8:42am' }, 'xx'), {
    ok: true,
    body: 'Ama has arrived safely at Work (8:42am). - Reached',
  });
  assertEquals(renderMessage('arrived', { name: 'Ama', place: 'Work', time: '8:42am' }, 'tw'), {
    ok: true,
    body: 'Ama adu Work dwoodwoo (8:42am). - Reached',
  });
  assertEquals(renderMessage('nope', {}).ok, false);
  assertEquals(renderMessage('custom', {}).ok, false);
});

Deno.test('decodeJwtPayload reads base64url payloads', () => {
  assertEquals(decodeJwtPayload(fakeJwt({ sub: 'u1', iat: 123 }))?.iat, 123);
  assertEquals(decodeJwtPayload('nope'), null);
  assertEquals(decodeJwtPayload('a.%%%.c'), null);
});
