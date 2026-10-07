import type { LatLng } from './geo.ts';

/**
 * GhanaPost GPS digital addresses look like "GA-123-4567": a two-letter
 * region+district code, then 3–4 and 4 digits. Users type them in many ways
 * ("ga1234567", "GA 123 4567"), so we normalise before looking them up.
 */
const GPS_RE = /^([A-Z]{2})-?(\d{3,4})-?(\d{4})$/;

export function normalizeGhanaPostGps(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s_.]/g, '').replace(/[–—]/g, '-');
  const m = GPS_RE.exec(compact);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function isGhanaPostGps(input: string): boolean {
  return normalizeGhanaPostGps(input) !== null;
}

export interface GpsLookupResult extends LatLng {
  address: string;
  region?: string;
  district?: string;
}

/** Resolver interface. The live implementation calls the GhanaPost GPS API from an Edge Function. */
export interface GhanaPostResolver {
  resolve(code: string): Promise<GpsLookupResult | null>;
}
