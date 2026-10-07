import { normalizePlate } from '@reached/core';
import { sha256Hex } from '../_shared/crypto.ts';
import { type DbClient, rpc } from '../_shared/db.ts';
import { bearerToken, error, json, readJsonObject } from '../_shared/http.ts';
import type { Logger } from '../_shared/log.ts';

/**
 * partner-api — Phase 3: a ride-hailing partner pushes driver details onto a
 * linked rider's live trip. Auth: `Authorization: Bearer <partner key>`; only
 * the SHA-256 of the key is stored in public.partners.key_hash.
 */

export interface PartnerApiDeps {
  db: DbClient;
  log: Logger;
}

const PROVIDERS = ['uber', 'bolt', 'yango'] as const;

export interface TripDetails {
  plate?: string;
  driver_name?: string;
  car?: string;
  ride_link?: string;
  provider?: string;
  rider_id?: string;
}

export type Validation = { ok: true; linkCode: string; details: TripDetails } | { ok: false; message: string };

function optionalString(body: Record<string, unknown>, key: string, max: number): string | undefined | Error {
  const v = body[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') return new Error(`${key} must be a string`);
  const t = v.trim();
  if (t.length > max) return new Error(`${key} is too long (max ${max})`);
  return t || undefined;
}

export function validateBody(body: Record<string, unknown> | null): Validation {
  if (!body) return { ok: false, message: 'Body must be a JSON object' };
  const linkCode = body.link_code;
  if (typeof linkCode !== 'string' || !/^[A-Za-z0-9_-]{4,64}$/.test(linkCode)) {
    return { ok: false, message: 'link_code is required' };
  }
  const details: TripDetails = {};
  const limits: [keyof TripDetails, number][] = [
    ['plate', 20],
    ['driver_name', 60],
    ['car', 60],
    ['ride_link', 500],
    ['provider', 20],
    ['rider_id', 100],
  ];
  for (const [key, max] of limits) {
    const v = optionalString(body, key, max);
    if (v instanceof Error) return { ok: false, message: v.message };
    if (v !== undefined) details[key] = v;
  }
  if (details.plate !== undefined) {
    const plate = normalizePlate(details.plate);
    if (!plate) return { ok: false, message: 'plate is not a valid Ghana number plate (e.g. GR 4512-23)' };
    details.plate = plate;
  }
  if (details.ride_link !== undefined) {
    let url: URL;
    try {
      url = new URL(details.ride_link);
    } catch {
      return { ok: false, message: 'ride_link must be an https URL' };
    }
    if (url.protocol !== 'https:') return { ok: false, message: 'ride_link must be an https URL' };
    details.ride_link = url.toString();
  }
  if (details.provider !== undefined) {
    const p = details.provider.toLowerCase();
    if (!(PROVIDERS as readonly string[]).includes(p)) {
      return { ok: false, message: `provider must be one of ${PROVIDERS.join(', ')}` };
    }
    details.provider = p;
  }
  if (Object.keys(details).length === 0) return { ok: false, message: 'Send at least one trip detail' };
  return { ok: true, linkCode, details };
}

export function createHandler(deps: PartnerApiDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
    const key = bearerToken(req);
    if (!key) return error(401, 'unauthorized', 'Missing API key');
    const { data, error: err } = await deps.db.from('partners').select('id, name')
      .eq('key_hash', await sha256Hex(key)).eq('active', true).maybeSingle();
    if (err) return error(500, 'lookup_failed', 'Try again');
    const partner = data as { id: string; name: string } | null;
    if (!partner) return error(401, 'unauthorized', 'Invalid API key');

    const v = validateBody(await readJsonObject(req));
    if (!v.ok) return error(400, 'bad_request', v.message);

    let updated: boolean;
    try {
      updated = Boolean(
        await rpc<boolean>(deps.db, 'partner_update_trip', {
          p_partner_id: partner.id,
          p_link_code: v.linkCode,
          p_details: v.details,
        }),
      );
    } catch (e) {
      deps.log('partner_update_failed', { partner: partner.name, reason: (e as Error).message });
      return error(500, 'update_failed', 'Try again');
    }
    if (!updated) return error(404, 'not_found', 'Unknown link code or no active trip for this rider');
    deps.log('partner_trip_updated', { partner: partner.name });
    return json({ ok: true });
  };
}
