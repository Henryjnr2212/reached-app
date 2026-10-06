import { EMPTY_TRACKER, stepTracker, type TrackerState } from '../tracker';
import type { Place, Trip } from '../backend/types';

const WORK: Place = { id: 'work', name: 'Work', icon: 'work', lat: 5.6037, lng: -0.187, radius: 150, address: null, ghanaPostGps: null };
const FAR = { lat: 5.56, lng: -0.205 };
const T0 = Date.UTC(2026, 9, 6, 8, 0);
const sec = (n: number) => T0 + n * 1000;

function trip(over: Partial<Trip> = {}): Trip {
  return {
    id: 't1', placeId: 'work', destName: 'Work', dest: { lat: WORK.lat, lng: WORK.lng }, radius: 150, status: 'active',
    startedAt: new Date(T0).toISOString(), expectedAt: null, graceMinutes: 15, checkOnMe: true, overduePromptedAt: null,
    contactIds: ['c1'], liveToken: 'abcd1234', lastCheckinAt: null, last: null, ...over,
  };
}

function run(samples: { lat: number; lng: number; at: number; speed?: number; activity?: 'in_vehicle' | 'still' }[], places: Place[], tr: Trip | null) {
  let state: TrackerState = EMPTY_TRACKER;
  const actions = [];
  for (const s of samples) {
    const r = stepTracker(state, s, places, tr);
    state = r.state;
    actions.push(...r.actions);
  }
  return actions;
}

describe('stepTracker', () => {
  it('does not report arriving at a place the first sample is already inside', () => {
    expect(run([{ ...WORK, at: sec(0) }, { ...WORK, at: sec(200) }], [WORK], null)).toEqual([]);
  });

  it('reports a place arrival after the minimum stop, then a leave', () => {
    const actions = run(
      [
        { ...FAR, at: sec(0) },
        { ...WORK, at: sec(10) },
        { ...WORK, at: sec(60) },
        { ...WORK, at: sec(120) },
        { ...FAR, at: sec(400) },
      ],
      [WORK],
      null,
    );
    expect(actions).toEqual([
      { type: 'place_arrive', placeId: 'work' },
      { type: 'place_leave', placeId: 'work' },
    ]);
  });

  it('does not count passing through the zone in a vehicle', () => {
    const actions = run(
      [
        { ...FAR, at: sec(0) },
        { ...WORK, at: sec(10), speed: 12, activity: 'in_vehicle' },
        { ...WORK, at: sec(60), speed: 10, activity: 'in_vehicle' },
        { ...FAR, at: sec(130), speed: 12, activity: 'in_vehicle' },
      ],
      [WORK],
      null,
    );
    expect(actions).toEqual([]);
  });

  it('reports a trip arrival for an active trip', () => {
    const actions = run([{ ...FAR, at: sec(0) }, { ...WORK, at: sec(10) }, { ...WORK, at: sec(120) }], [], trip());
    expect(actions).toEqual([{ type: 'trip_arrive', tripId: 't1' }]);
  });

  it('ignores trips that already ended', () => {
    const actions = run([{ ...FAR, at: sec(0) }, { ...WORK, at: sec(10) }, { ...WORK, at: sec(120) }], [], trip({ status: 'arrived' }));
    expect(actions).toEqual([]);
  });
});
