import type { LocationSample } from '@reached/core';
import { getBackend } from '@/lib/backend';
import type { Place, Trip } from '@/lib/backend/types';
import { stepTracker, type TrackerAction, type TrackerState } from './tracker';

/**
 * Feeds one location sample through the tracker and tells the server about
 * arrivals and departures. The server decides who gets told (rules,
 * duplicate suppression, ask-first). Errors are swallowed: the next sample
 * retries, and the server's overdue check covers a dead phone.
 */
export async function processSample(
  state: TrackerState,
  sample: LocationSample,
  places: Place[],
  trip: Trip | null,
): Promise<{ state: TrackerState; actions: TrackerAction[] }> {
  const r = stepTracker(state, sample, places, trip);
  const b = getBackend();
  for (const a of r.actions) {
    try {
      if (a.type === 'trip_arrive') await b.arriveTrip(a.tripId, sample, 'auto');
      else if (a.type === 'place_arrive') await b.reportPlaceEvent(a.placeId, 'arrive', sample);
      else await b.reportPlaceEvent(a.placeId, 'leave', sample);
    } catch {
      // ignored; see above
    }
  }
  return r;
}
