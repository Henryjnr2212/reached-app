import type { LocationSample } from '@reached/core';
import type { Place, Trip } from '@/lib/backend/types';
import { report } from './outbox';
import { stepTracker, type TrackerAction, type TrackerState } from './tracker';

/**
 * Feeds one location sample through the tracker and tells the server about
 * arrivals and departures. The server decides who gets told (rules,
 * duplicate suppression, ask-first). Offline reports wait in the outbox;
 * the server's overdue check covers a dead phone.
 */
export async function processSample(
  state: TrackerState,
  sample: LocationSample,
  places: Place[],
  trip: Trip | null,
): Promise<{ state: TrackerState; actions: TrackerAction[] }> {
  const r = stepTracker(state, sample, places, trip);
  for (const a of r.actions) await report(a, { lat: sample.lat, lng: sample.lng }, sample.at);
  return r;
}
