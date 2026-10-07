import { fromBase64, hmacSha256, timingSafeEqualBytes, toHex } from './crypto.ts';

/**
 * Standard Webhooks (https://www.standardwebhooks.com) verification, as used
 * by Supabase Auth hooks. Secret format: "v1,whsec_<base64>".
 */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function decodeWebhookSecret(secret: string): Uint8Array<ArrayBuffer> {
  const raw = secret.trim().replace(/^v1,/, '').replace(/^whsec_/, '');
  return fromBase64(raw);
}

export async function signStandardWebhook(
  secret: string,
  id: string,
  timestamp: string | number,
  body: string,
): Promise<string> {
  const sig = await hmacSha256(decodeWebhookSecret(secret), `${id}.${timestamp}.${body}`);
  let s = '';
  for (const b of sig) s += String.fromCharCode(b);
  return `v1,${btoa(s)}`;
}

export async function verifyStandardWebhook(
  secret: string | undefined,
  headers: Headers,
  body: string,
  nowMs: number = Date.now(),
): Promise<VerifyResult> {
  if (!secret) return { ok: false, reason: 'Hook secret not configured' };
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');
  if (!id || !timestamp || !signatures) return { ok: false, reason: 'Missing webhook headers' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'Bad timestamp' };
  const age = nowMs / 1000 - ts;
  if (age > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: 'Timestamp too old' };
  if (age < -WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: 'Timestamp in the future' };

  let key: Uint8Array<ArrayBuffer>;
  try {
    key = decodeWebhookSecret(secret);
  } catch {
    return { ok: false, reason: 'Hook secret is not valid base64' };
  }
  const expected = await hmacSha256(key, `${id}.${timestamp}.${body}`);
  for (const part of signatures.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    let given: Uint8Array;
    try {
      given = fromBase64(sig);
    } catch {
      continue;
    }
    if (timingSafeEqualBytes(given, expected)) return { ok: true };
  }
  return { ok: false, reason: 'Bad signature' };
}

/** "sha256=<hex>" (Meta) or bare hex HMAC-SHA256 of the raw body. */
export async function verifyHexHmac(secret: string | undefined, body: string, header: string | null): Promise<boolean> {
  if (!secret || !header) return false;
  const given = header.trim().replace(/^sha256=/i, '').toLowerCase();
  const expected = toHex(await hmacSha256(secret, body));
  const enc = new TextEncoder();
  return timingSafeEqualBytes(enc.encode(given), enc.encode(expected));
}

export async function hexHmac(secret: string, body: string): Promise<string> {
  return toHex(await hmacSha256(secret, body));
}
