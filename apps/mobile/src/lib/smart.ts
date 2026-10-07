import { detectAutoArrival, HOUR, type LocationSample } from '@reached/core';
import type { Place, Profile, Trip } from '@/lib/backend/types';
import type { TrackerAction } from './tracker';

/**
 * Phase 2 smart arrivals on top of the tracker:
 * - heading-out: leaving a saved place offers "Notify when I arrive";
 * - auto-detect: leaving somewhere and stopping somewhere new (not a saved
 *   place) sends "arrived safely in <area>".
 * Pure so it can be unit-tested; the caller does the side effects.
 */
export interface SmartState {
  samples: LocationSample[];
  /** startedAt of the last stay we reported, so each stop is reported once. */
  lastReportedStay: number | null;
}

export const EMPTY_SMART: SmartState = { samples: [], lastReportedStay: null };
const KEEP_MS = 2 * HOUR;
const MAX_SAMPLES = 400;

export type SmartEffect = { type: 'heading_out'; place: Place } | { type: 'auto_arrival'; at: LocationSample & { startedAt: number } };

export function stepSmart(
  state: SmartState,
  sample: LocationSample,
  actions: TrackerAction[],
  places: Place[],
  profile: Pick<Profile, 'autoDetect' | 'headingOutPrompts'> | null,
  trip: Trip | null,
): { state: SmartState; effects: SmartEffect[] } {
  const samples = [...state.samples.filter((s) => sample.at - s.at <= KEEP_MS), sample].slice(-MAX_SAMPLES);
  const effects: SmartEffect[] = [];
  if (profile?.headingOutPrompts && !trip) {
    for (const a of actions) {
      const place = a.type === 'place_leave' ? places.find((p) => p.id === a.placeId) : undefined;
      if (place) effects.push({ type: 'heading_out', place });
    }
  }
  let lastReportedStay = state.lastReportedStay;
  if (profile?.autoDetect && !trip) {
    const r = detectAutoArrival(
      samples,
      places.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, radius: p.radius })),
    );
    if (r && !r.placeId && r.to.startedAt !== lastReportedStay) {
      lastReportedStay = r.to.startedAt;
      effects.push({ type: 'auto_arrival', at: { lat: r.to.lat, lng: r.to.lng, at: r.to.endedAt, startedAt: r.to.startedAt } });
    }
  }
  return { state: { samples, lastReportedStay }, effects };
}
