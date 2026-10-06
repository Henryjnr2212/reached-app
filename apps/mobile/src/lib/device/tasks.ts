import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getBackend } from '@/lib/backend';
import type { Place, Trip } from '@/lib/backend/types';
import { processSample } from '@/lib/runTracker';
import { EMPTY_TRACKER, type TrackerState } from '@/lib/tracker';
import { batteryPercent } from './battery';
import { currentActivity, toSample } from './location';

/**
 * Native background work (development build required; Expo Go can't run it):
 * - GEOFENCE_TASK wakes the app when the phone crosses a saved place's edge.
 * - TRACK_TASK receives location updates while near a place or during a trip,
 *   runs the arrival tracker and sends trip check-ins to the server.
 * Places and the live trip are cached so a sample can be handled offline.
 */
export const GEOFENCE_TASK = 'reached-geofence';
export const TRACK_TASK = 'reached-track';
const STATE_KEY = 'reached-tracker';
const CACHE_KEY = 'reached-tracker-cache';
const CHECKIN_EVERY_MS = 60_000;

interface Cache {
  places: Place[];
  trip: Trip | null;
  lastCheckin: number;
  /** Until when to keep tracking after a geofence wake-up. */
  trackUntil: number;
}

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const save = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => undefined);

export async function updateTrackingCache(places: Place[], trip: Trip | null) {
  const c = await load<Cache>(CACHE_KEY, { places: [], trip: null, lastCheckin: 0, trackUntil: 0 });
  await save(CACHE_KEY, { ...c, places, trip });
  await syncBackgroundTracking(places, trip);
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const c = await load<Cache>(CACHE_KEY, { places: [], trip: null, lastCheckin: 0, trackUntil: 0 });
    if (data.eventType === Location.GeofencingEventType.Enter) {
      // Watch closely for a few minutes to apply the minimum stop time.
      await save(CACHE_KEY, { ...c, trackUntil: Date.now() + 10 * 60_000 });
      await startTracking();
    } else if (data.eventType === Location.GeofencingEventType.Exit && data.region.identifier) {
      const state = await load<TrackerState>(STATE_KEY, EMPTY_TRACKER);
      const key = `place:${data.region.identifier}`;
      if (state.zones[key]?.phase === 'arrived') {
        await getBackend()
          .reportPlaceEvent(data.region.identifier, 'leave', null)
          .catch(() => undefined);
        await save(STATE_KEY, { zones: { ...state.zones, [key]: { phase: 'outside' } } });
      }
    }
  });

  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACK_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    let state = await load<TrackerState>(STATE_KEY, EMPTY_TRACKER);
    const c = await load<Cache>(CACHE_KEY, { places: [], trip: null, lastCheckin: 0, trackUntil: 0 });
    const activity = await currentActivity();
    for (const loc of data.locations) {
      const r = await processSample(state, toSample(loc, loc.timestamp, activity), c.places, c.trip);
      state = r.state;
      if (r.actions.some((a) => a.type === 'trip_arrive')) c.trip = null;
    }
    await save(STATE_KEY, state);
    const last = data.locations[data.locations.length - 1]!;
    if (c.trip && Date.now() - c.lastCheckin >= CHECKIN_EVERY_MS) {
      try {
        const status = await getBackend().checkin(c.trip.id, { lat: last.coords.latitude, lng: last.coords.longitude }, last.coords.accuracy, await batteryPercent());
        if (status === 'arrived' || status === 'cancelled') c.trip = null;
        c.lastCheckin = Date.now();
      } catch {
        // offline: the server's overdue check still runs
      }
    }
    await save(CACHE_KEY, c);
    if (!c.trip && Date.now() > c.trackUntil) await stopTracking();
  });
}

async function startTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false)) return;
  await Location.startLocationUpdatesAsync(TRACK_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 40,
    timeInterval: 30_000,
    deferredUpdatesInterval: 30_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'Reached is watching for your arrival',
      notificationBody: "We'll tell your people when you get there.",
      notificationColor: '#0A7550',
    },
  }).catch(() => undefined);
}

async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(TRACK_TASK).catch(() => undefined);
  }
}

/** Keep OS geofences in line with saved places, and track continuously during a trip. */
export async function syncBackgroundTracking(places: Place[], trip: Trip | null) {
  if (Platform.OS === 'web') return;
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (!bg?.granted) return;
  if (places.length) {
    await Location.startGeofencingAsync(
      GEOFENCE_TASK,
      places.map((p) => ({ identifier: p.id, latitude: p.lat, longitude: p.lng, radius: p.radius, notifyOnEnter: true, notifyOnExit: true })),
    ).catch(() => undefined);
  } else if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => undefined);
  }
  if (trip) await startTracking();
}

export async function backgroundTrackingActive(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
}
