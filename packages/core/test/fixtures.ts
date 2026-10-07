import type { LocationSample } from '../src/arrival.ts';

/** A morning: 10 min at home in Osu, a drive, 10 min at Accra Mall. */
export function activityFixtures() {
  const home = { id: 'home', lat: 5.5571, lng: -0.1818, radius: 150 };
  const mall = { lat: 5.6505, lng: -0.1865 };
  const t0 = Date.UTC(2026, 9, 6, 7, 0);
  const track: LocationSample[] = [];
  for (let i = 0; i <= 10; i++) track.push({ ...home, at: t0 + i * 60_000, speed: 0, activity: 'still' });
  for (let i = 1; i <= 9; i++) {
    const f = i / 10;
    track.push({
      lat: home.lat + (mall.lat - home.lat) * f,
      lng: home.lng + (mall.lng - home.lng) * f,
      at: t0 + (10 + i * 2) * 60_000,
      speed: 8,
      activity: 'in_vehicle',
    });
  }
  for (let i = 0; i <= 10; i++) track.push({ ...mall, at: t0 + (30 + i) * 60_000, speed: 0, activity: 'still' });
  return { track, home };
}
