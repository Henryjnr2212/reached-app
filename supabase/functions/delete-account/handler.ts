import { decodeJwtPayload, requireUser } from '../_shared/auth.ts';
import type { DbClient } from '../_shared/db.ts';
import { error, json, preflight } from '../_shared/http.ts';
import type { Logger } from '../_shared/log.ts';

/**
 * delete-account — permanently deletes the caller's account. SPEC: deleting
 * requires the phone OTP, so the app re-verifies the code just before calling
 * and we only accept an access token issued in the last 10 minutes.
 * Every public table references profiles/auth.users with ON DELETE CASCADE.
 */

export const FRESH_TOKEN_SECONDS = 10 * 60;

export interface DeleteAccountDeps {
  db: DbClient;
  log: Logger;
  now: () => number;
}

export function tokenIsFresh(jwt: string, nowMs: number): boolean {
  const iat = decodeJwtPayload(jwt)?.iat;
  if (typeof iat !== 'number') return false;
  const age = nowMs / 1000 - iat;
  return age <= FRESH_TOKEN_SECONDS && age >= -60;
}

export function createHandler(deps: DeleteAccountDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const pre = preflight(req);
    if (pre) return pre;
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
    const auth = await requireUser(deps.db, req);
    if (!auth.ok) return auth.response;
    if (!tokenIsFresh(auth.jwt, deps.now())) {
      return error(403, 'reauth_required', 'For your safety, confirm the code we text you, then try again.');
    }
    const { error: err } = await deps.db.auth.admin.deleteUser(auth.user.id);
    if (err) {
      deps.log('delete_account_failed', { user_id: auth.user.id, reason: err.message });
      return error(500, 'delete_failed', "We couldn't delete your account. Try again.");
    }
    deps.log('account_deleted', { user_id: auth.user.id });
    return json({ deleted: true });
  };
}
