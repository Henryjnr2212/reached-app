import { distanceMeters, type LatLng, type Zone } from './geo.ts';
import type { LocationSample } from './arrival.ts';
import { MINUTE } from './time.ts';

/**
 * Phase 2 smart features, kept pure so they can be unit-tested with recorded
 * tracks:
 * - Auto-detect: notice the user left somewhere and stopped somewhere new.
 * - Heading-out prompt: notice the user leaving a saved place.
 */
export interface Stay extends LatLng {
  startedAt: number;
  endedAt: number;
}

export interface StayConfig {
  /** A stay is at least this long… */
  minStayMinutes: number;
  /** …within this radius. */
  stayRadiusM: number;
  /** A new stay must be at least this far from the previous one to count as a trip. */
  minTripDistanceM: number;
}

export const DEFAULT_STAY_CONFIG: StayConfig = {
  minStayMinutes: 5,
  stayRadiusM: 120,
  minTripDistanceM: 800,
};

function centroid(points: LatLng[]): LatLng {
  const n = points.length;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lng: points.reduce((s, p) => s + p.lng, 0) / n,
  };
}

/** Segment a track into stays (dwell clusters). */
export function findStays(samples: LocationSample[], cfg: StayConfig = DEFAULT_STAY_CONFIG): Stay[] {
  const sorted = [...samples].sort((a, b) => a.at - b.at);
  const stays: Stay[] = [];
  let cluster: LocationSample[] = [];

  const flush = () => {
    if (cluster.length === 0) return;
    const first = cluster[0]!;
    const last = cluster[cluster.length - 1]!;
    if (last.at - first.at >= cfg.minStayMinutes * MINUTE) {
      stays.push({ ...centroid(cluster), startedAt: first.at, endedAt: last.at });
    }
    cluster = [];
  };

  for (const s of sorted) {
    if (cluster.length === 0) {
      cluster.push(s);
      continue;
    }
    const c = centroid(cluster);
    if (distanceMeters(c, s) <= cfg.stayRadiusM) cluster.push(s);
    else {
      flush();
      cluster.push(s);
    }
  }
  flush();
  return stays;
}

export interface AutoArrival {
  from: Stay;
  to: Stay;
  /** Saved place the new stay falls in, if any. */
  placeId: string | null;
}

/**
 * Returns the most recent "left somewhere, stopped somewhere new" movement, or
 * null. Movements that end inside a saved place are reported with its id so
 * the caller can let the place rules handle them instead.
 */
export function detectAutoArrival(
  samples: LocationSample[],
  places: (Zone & { id: string })[],
  cfg: StayConfig = DEFAULT_STAY_CONFIG,
): AutoArrival | null {
  const stays = findStays(samples, cfg);
  for (let i = stays.length - 1; i > 0; i--) {
    const to = stays[i]!;
    const from = stays[i - 1]!;
    if (distanceMeters(from, to) >= cfg.minTripDistanceM) {
      const place = places.find((p) => distanceMeters(p, to) <= p.radius);
      return { from, to, placeId: place?.id ?? null };
    }
  }
  return null;
}

/**
 * Heading-out prompt: the last samples show the user moved beyond a saved
 * place's zone (plus margin) after having been inside it, and is now moving.
 */
export function detectHeadingOut(
  samples: LocationSample[],
  places: (Zone & { id: string })[],
  marginM = 100,
): { placeId: string; at: number } | null {
  const sorted = [...samples].sort((a, b) => a.at - b.at);
  for (const place of places) {
    let wasInside = false;
    for (const s of sorted) {
      const d = distanceMeters(place, s);
      if (d <= place.radius) wasInside = true;
      else if (wasInside && d > place.radius + marginM) {
        const moving = (s.speed ?? 0) > 1 || s.activity === 'in_vehicle' || s.activity === 'walking';
        if (moving) return { placeId: place.id, at: s.at };
      }
    }
  }
  return null;
}

/** Area label for "arrived safely in East Legon" from a reverse-geocode result. */
export function areaName(geo: { district?: string | null; subregion?: string | null; city?: string | null; street?: string | null } | null): string {
  if (!geo) return 'their destination';
  return geo.district || geo.subregion || geo.city || geo.street || 'their destination';
}
