import type { GhanaPostResolver, GpsLookupResult } from '@reached/core';
import type { Env } from '../_shared/db.ts';
import type { FetchFn } from '../_shared/providers.ts';

/** Accra Central, the centre of the fake lookup area. */
const ACCRA = { lat: 5.6037, lng: -0.187 };

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic fake: the same code always maps to the same point within
 * ~10 km of Accra Central. Used in development and tests (GHANAPOST_MODE=fake).
 */
export class FakeGhanaPostResolver implements GhanaPostResolver {
  resolve(code: string): Promise<GpsLookupResult | null> {
    const h = hash32(code);
    const dLat = ((h & 0xffff) / 0xffff - 0.5) * 0.18;
    const dLng = ((h >>> 16) / 0xffff - 0.5) * 0.18;
    return Promise.resolve({
      lat: Math.round((ACCRA.lat + dLat) * 1e6) / 1e6,
      lng: Math.round((ACCRA.lng + dLng) * 1e6) / 1e6,
      address: `${code}, Accra (test address)`,
      region: 'Greater Accra',
    });
  }
}

/**
 * Live GhanaPost GPS lookup behind a small, provider-neutral contract:
 * POST GHANAPOST_API_URL { code } with Bearer GHANAPOST_API_KEY →
 * { lat, lng, address, region?, district? } (optionally wrapped in { data }).
 * 404 means the code doesn't exist.
 */
export class HttpGhanaPostResolver implements GhanaPostResolver {
  constructor(private url: string, private apiKey: string, private fetchFn: FetchFn = fetch) {}

  async resolve(code: string): Promise<GpsLookupResult | null> {
    const res = await this.fetchFn(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GhanaPost HTTP ${res.status}`);
    const body = await res.json() as Record<string, unknown>;
    const d = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
    const lat = Number(d.lat ?? d.latitude);
    const lng = Number(d.lng ?? d.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      address: typeof d.address === 'string' ? d.address : code,
      region: typeof d.region === 'string' ? d.region : undefined,
      district: typeof d.district === 'string' ? d.district : undefined,
    };
  }
}

export function getResolver(env: Env, fetchFn: FetchFn = fetch): GhanaPostResolver {
  if (env.GHANAPOST_MODE === 'live') {
    if (!env.GHANAPOST_API_URL || !env.GHANAPOST_API_KEY) throw new Error('GhanaPost lookup is not configured');
    return new HttpGhanaPostResolver(env.GHANAPOST_API_URL, env.GHANAPOST_API_KEY, fetchFn);
  }
  return new FakeGhanaPostResolver();
}
