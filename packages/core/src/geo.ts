export interface LatLng {
  lat: number;
  lng: number;
}

export interface Zone extends LatLng {
  /** Radius in metres. */
  radius: number;
}

export const ZONE_MIN_M = 100;
export const ZONE_MAX_M = 500;
export const ZONE_DEFAULT_M = 150;
/** iOS can monitor at most 20 regions per app; we keep headroom for the active trip. */
export const MAX_PLACES = 15;

/** Accra city centre, used as the map's starting point before we have a fix. */
export const ACCRA: LatLng = { lat: 5.6037, lng: -0.187 };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInsideZone(zone: Zone, point: LatLng, accuracyM = 0): boolean {
  // Give the benefit of the doubt for up to half the radius of GPS error so a
  // noisy fix just inside the edge still counts.
  const slack = Math.min(accuracyM, zone.radius / 2);
  return distanceMeters(zone, point) <= zone.radius + slack;
}

export function clampRadius(radius: number): number {
  if (!Number.isFinite(radius)) return ZONE_DEFAULT_M;
  return Math.round(Math.min(ZONE_MAX_M, Math.max(ZONE_MIN_M, radius)) / 10) * 10;
}

export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

/** Rough travel speeds for the expected-arrival estimate, in metres per second. */
const SPEED_MPS = {
  walking: 1.3,
  motorbike: 7,
  trotro: 5,
  taxi: 6,
  ride_hailing: 6,
  own_car: 6.5,
  default: 5.5,
} as const;

export type TravelMode = keyof typeof SPEED_MPS;

/**
 * Expected arrival estimate. Accra traffic makes straight-line distance a poor
 * guide, so we use a 1.4 road factor and urban speeds, rounded up to 5 min.
 */
export function estimateTravelMinutes(from: LatLng, to: LatLng, mode: TravelMode = 'default'): number {
  const road = distanceMeters(from, to) * 1.4;
  const minutes = road / SPEED_MPS[mode] / 60;
  return Math.max(5, Math.ceil(minutes / 5) * 5);
}

/** Short "lat,lng" string with 5 dp (~1 m), for maps links. */
export function formatLatLng(p: LatLng): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

export function mapsLink(p: LatLng): string {
  return `https://maps.google.com/?q=${formatLatLng(p)}`;
}
