import * as Location from 'expo-location';
import { Platform } from 'react-native';
import type { LatLng, LocationSample } from '@reached/core';
import { areaName } from '@reached/core';

export type LocationAccess = 'always' | 'foreground' | 'denied' | 'undetermined';

export async function getLocationAccess(): Promise<LocationAccess> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) return fg.canAskAgain === false || fg.status === 'denied' ? 'denied' : 'undetermined';
    if (Platform.OS === 'web') return 'always';
    const bg = await Location.getBackgroundPermissionsAsync();
    return bg.granted ? 'always' : 'foreground';
  } catch {
    return 'undetermined';
  }
}

export async function requestForegroundLocation(): Promise<boolean> {
  try {
    return (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Android 11+ can't show "Allow all the time" directly; this opens the settings page. */
export async function requestBackgroundLocation(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    return (await Location.requestBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function currentPosition(): Promise<(LatLng & { accuracy: number | null }) | null> {
  try {
    const last = Platform.OS === 'web' ? null : await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
  } catch {
    return null;
  }
}

/** "East Legon" style area name for messages. Never logged. */
export async function areaAt(p: LatLng): Promise<string> {
  if (Platform.OS === 'web') return 'your area';
  try {
    const [geo] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
    return areaName(geo ?? null);
  } catch {
    return 'your area';
  }
}

export async function searchAddress(q: string): Promise<LatLng | null> {
  if (Platform.OS === 'web' || !q.trim()) return null;
  try {
    const [hit] = await Location.geocodeAsync(`${q}, Ghana`);
    return hit ? { lat: hit.latitude, lng: hit.longitude } : null;
  } catch {
    return null;
  }
}

/** Activity recognition when permitted, so traffic beside a place isn't an arrival. */
export async function currentActivity(): Promise<LocationSample['activity']> {
  if (Platform.OS === 'web') return 'unknown';
  try {
    const { activities } = await Location.getMotionActivityAsync();
    if (activities.automotive?.detected) return 'in_vehicle';
    if (activities.cycling?.detected) return 'on_bicycle';
    if (activities.running?.detected) return 'running';
    if (activities.walking?.detected) return 'walking';
    if (activities.stationary?.detected) return 'still';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function toSample(loc: Location.LocationObject, at: number, activity: LocationSample['activity'] = 'unknown'): LocationSample {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? undefined,
    speed: loc.coords.speed,
    at,
    activity,
  };
}
