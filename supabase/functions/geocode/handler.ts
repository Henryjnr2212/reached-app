import { type GhanaPostResolver, normalizeGhanaPostGps } from '@reached/core';
import { requireUser } from '../_shared/auth.ts';
import type { DbClient, Env } from '../_shared/db.ts';
import { error, json, preflight, readJsonObject } from '../_shared/http.ts';
import type { Logger } from '../_shared/log.ts';
import type { FetchFn } from '../_shared/providers.ts';
import { getResolver } from './resolvers.ts';

/** geocode — Phase 2: look up a GhanaPost GPS digital address ("GA-123-4567"). */

export interface GeocodeDeps {
  db: DbClient;
  env: Env;
  fetch: FetchFn;
  log: Logger;
  resolver?: GhanaPostResolver;
}

export function createHandler(deps: GeocodeDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const pre = preflight(req);
    if (pre) return pre;
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
    const auth = await requireUser(deps.db, req);
    if (!auth.ok) return auth.response;
    const body = await readJsonObject(req);
    const code = normalizeGhanaPostGps(typeof body?.code === 'string' ? body.code : '');
    if (!code) {
      return error(400, 'bad_code', 'Enter a GhanaPost GPS address like GA-123-4567.');
    }
    try {
      const resolver = deps.resolver ?? getResolver(deps.env, deps.fetch);
      const result = await resolver.resolve(code);
      if (!result) return error(404, 'not_found', `We couldn't find ${code}. Check the address and try again.`);
      deps.log('geocode_ok', { code_region: code.slice(0, 2) });
      return json({ code, ...result });
    } catch (e) {
      deps.log('geocode_failed', { reason: (e as Error).message });
      return error(502, 'lookup_failed', "We couldn't look that up right now. Try again or pick the place on the map.");
    }
  };
}
