import type { AuthUser, DbClient } from './db.ts';
import { bearerToken, error } from './http.ts';

/** Decode a JWT payload without verifying it (verification is done by auth.getUser). */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export type UserResult = { ok: true; user: AuthUser; jwt: string } | { ok: false; response: Response };

/** Resolve the signed-in user from `Authorization: Bearer <access token>`. */
export async function requireUser(db: DbClient, req: Request): Promise<UserResult> {
  const jwt = bearerToken(req);
  if (!jwt) return { ok: false, response: error(401, 'unauthorized', 'Sign in to continue.') };
  const { data, error: err } = await db.auth.getUser(jwt);
  if (err || !data.user) {
    return { ok: false, response: error(401, 'unauthorized', 'Your session has expired. Sign in again.') };
  }
  return { ok: true, user: data.user, jwt };
}
