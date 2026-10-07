import { distanceMeters, isInsideZone, type LatLng, type Zone } from './geo.ts';
import { HOUR } from './time.ts';

/**
 * Arrival detection. The OS geofence tells us roughly when we cross a zone
 * edge; this logic decides whether that counts as an arrival (SPEC §13):
 * - the phone must stay inside for a minimum stop time, and
 * - not while the phone reports being in a vehicle (stuck in traffic beside the
 *   destination or waiting at a trotro station is not "arrived").
 */
export interface LocationSample extends LatLng {
  /** epoch ms */
  at: number;
  accuracy?: number;
  /** metres/second when the OS reports it */
  speed?: number | null;
  /** activity recognition result when available */
  activity?: 'still' | 'walking' | 'running' | 'in_vehicle' | 'on_bicycle' | 'unknown';
}

export interface ArrivalConfig {
  /** Seconds the phone must stay inside the zone. */
  minStopSeconds: number;
  /** Above this speed we treat the phone as moving in a vehicle. */
  vehicleSpeedMps: number;
}

export const DEFAULT_ARRIVAL_CONFIG: ArrivalConfig = {
  minStopSeconds: 90,
  vehicleSpeedMps: 4,
};

export type ArrivalState =
  | { phase: 'outside' }
  | { phase: 'settling'; enteredAt: number }
  | { phase: 'arrived'; arrivedAt: number };

export const INITIAL_ARRIVAL_STATE: ArrivalState = { phase: 'outside' };

export function isInVehicle(sample: LocationSample, cfg: ArrivalConfig = DEFAULT_ARRIVAL_CONFIG): boolean {
  if (sample.activity === 'in_vehicle') return true;
  return typeof sample.speed === 'number' && sample.speed > cfg.vehicleSpeedMps;
}

/**
 * Feed one sample; returns the next state and whether this sample completed
 * an arrival. Once arrived, the state sticks until the phone leaves the zone.
 */
export function stepArrival(
  state: ArrivalState,
  zone: Zone,
  sample: LocationSample,
  cfg: ArrivalConfig = DEFAULT_ARRIVAL_CONFIG,
): { state: ArrivalState; arrived: boolean } {
  const inside = isInsideZone(zone, sample, sample.accuracy ?? 0);
  if (!inside) return { state: { phase: 'outside' }, arrived: false };
  if (state.phase === 'arrived') return { state, arrived: false };

  if (isInVehicle(sample, cfg)) {
    // Moving through or sitting in traffic: the stop timer only starts once
    // the phone is out of the vehicle.
    return { state: { phase: 'outside' }, arrived: false };
  }
  if (state.phase === 'outside') {
    return { state: { phase: 'settling', enteredAt: sample.at }, arrived: cfg.minStopSeconds <= 0 };
  }
  if (sample.at - state.enteredAt >= cfg.minStopSeconds * 1000) {
    return { state: { phase: 'arrived', arrivedAt: sample.at }, arrived: true };
  }
  return { state, arrived: false };
}

/** Run a whole track (e.g. from a test or a background batch). */
export function detectArrival(
  zone: Zone,
  samples: LocationSample[],
  cfg: ArrivalConfig = DEFAULT_ARRIVAL_CONFIG,
): number | null {
  let state: ArrivalState = INITIAL_ARRIVAL_STATE;
  for (const s of [...samples].sort((a, b) => a.at - b.at)) {
    const r = stepArrival(state, zone, s, cfg);
    state = r.state;
    if (r.arrived) return s.at;
  }
  return null;
}

/** "You're already at Work. Send arrival now?" check when a trip starts. */
export function alreadyAtDestination(zone: Zone, here: LatLng | null, accuracy = 0): boolean {
  return !!here && isInsideZone(zone, here, accuracy);
}

/** SPEC §13: the same place can't trigger the same message again within 1 hour. */
export const DUPLICATE_WINDOW_MS = HOUR;

export function isDuplicateTrigger(lastSentAt: number | null | undefined, now: number): boolean {
  return lastSentAt != null && now - lastSentAt < DUPLICATE_WINDOW_MS;
}

/** Departure: the phone has left a zone it was in, with a margin to avoid edge bouncing. */
export function hasLeftZone(zone: Zone, sample: LocationSample, marginM = 50): boolean {
  return distanceMeters(zone, sample) > zone.radius + marginM;
}
