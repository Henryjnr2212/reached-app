import { distanceMeters, type LatLng } from './geo.ts';

/** Phase 3: nearest police station finder. Station data lives in the database. */
export interface PoliceStation extends LatLng {
  id: string;
  name: string;
  region: string;
  phone: string | null;
}

export function nearestStations<T extends PoliceStation>(here: LatLng, stations: T[], limit = 5): (T & { distanceM: number })[] {
  return stations
    .map((s) => ({ ...s, distanceM: distanceMeters(here, s) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}
