import { hasLeftZone, stepArrival, type ArrivalState, type LocationSample } from '@reached/core';
import type { Place, Trip } from '@/lib/backend/types';

/**
 * Pure arrival tracker shared by the foreground watcher (web and phones
 * without background permission) and the native background location task.
 *
 * Keys are "place:<id>" and "trip:<id>". A zone with no state that the first
 * sample is already inside is marked arrived silently, so opening the app at
 * home doesn't text everyone "arrived at Home".
 */
export interface TrackerState {
  zones: Record<string, ArrivalState>;
}

export type TrackerAction =
  | { type: 'place_arrive'; placeId: string }
  | { type: 'place_leave'; placeId: string }
  | { type: 'trip_arrive'; tripId: string };

export const EMPTY_TRACKER: TrackerState = { zones: {} };

export function stepTracker(
  state: TrackerState,
  sample: LocationSample,
  places: Place[],
  trip: Trip | null,
): { state: TrackerState; actions: TrackerAction[] } {
  const zones: Record<string, ArrivalState> = {};
  const actions: TrackerAction[] = [];

  for (const p of places) {
    const key = `place:${p.id}`;
    const zone = { lat: p.lat, lng: p.lng, radius: p.radius };
    const prev = state.zones[key];
    if (!prev) {
      const first = stepArrival({ phase: 'outside' }, zone, sample, { minStopSeconds: 0, vehicleSpeedMps: Infinity });
      zones[key] = first.arrived ? { phase: 'arrived', arrivedAt: sample.at } : { phase: 'outside' };
      continue;
    }
    if (prev.phase === 'arrived' && hasLeftZone(zone, sample)) {
      actions.push({ type: 'place_leave', placeId: p.id });
      zones[key] = { phase: 'outside' };
      continue;
    }
    if (prev.phase === 'arrived') {
      zones[key] = prev;
      continue;
    }
    const r = stepArrival(prev, zone, sample);
    zones[key] = r.state;
    if (r.arrived) actions.push({ type: 'place_arrive', placeId: p.id });
  }

  if (trip?.dest && (trip.status === 'active' || trip.status === 'overdue' || trip.status === 'alerted')) {
    const key = `trip:${trip.id}`;
    const zone = { ...trip.dest, radius: trip.radius };
    const r = stepArrival(state.zones[key] ?? { phase: 'outside' }, zone, sample);
    zones[key] = r.state;
    if (r.arrived) actions.push({ type: 'trip_arrive', tripId: trip.id });
  }

  // A trip arrival already tells the trip's contacts; the place rule for the
  // same place would only duplicate it (the server combines per contact too).
  const tripPlace = trip?.placeId;
  const deduped = actions.some((a) => a.type === 'trip_arrive')
    ? actions.filter((a) => !(a.type === 'place_arrive' && a.placeId === tripPlace))
    : actions;
  return { state: { zones }, actions: deduped };
}
