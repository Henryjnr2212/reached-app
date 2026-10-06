import { activityFixtures } from './fixtures.ts';
import { detectAutoArrival, detectHeadingOut, findStays, areaName } from '../src/autodetect.ts';
import { matchesFilter, overallStatus, toldWho, eventTitle, statusLabel } from '../src/activity.ts';
import { detectBrand, BATTERY_GUIDES } from '../src/battery.ts';
import { guessRelationship, initials, validateContact } from '../src/contacts.ts';
import { telLink, validatePin, GHANA_EMERGENCY_NUMBERS } from '../src/emergency.ts';
import { normalizeGhanaPostGps } from '../src/ghanapost.ts';
import { canAdd, chooseChannel, PLANS } from '../src/plans.ts';
import { formatDistance, nearestStations } from '../src/police.ts';
import { normalizePlate, parseDriverCard, parseRideLink } from '../src/ride.ts';

describe('auto-detect and heading-out (Phase 2)', () => {
  const { track, home } = activityFixtures();
  it('finds stays', () => {
    expect(findStays(track)).toHaveLength(2);
  });
  it('detects arriving somewhere new', () => {
    const r = detectAutoArrival(track, [home]);
    expect(r).not.toBeNull();
    expect(r!.placeId).toBeNull();
  });
  it('reports a saved place when the new stay is inside one', () => {
    const r = detectAutoArrival(track, [home, { id: 'mall', lat: 5.6505, lng: -0.1865, radius: 300 }]);
    expect(r!.placeId).toBe('mall');
  });
  it('detects heading out of a saved place', () => {
    expect(detectHeadingOut(track, [home])?.placeId).toBe('home');
    expect(detectHeadingOut(track.slice(0, 5), [home])).toBeNull();
  });
  it('names the area', () => {
    expect(areaName({ district: 'East Legon' })).toBe('East Legon');
    expect(areaName(null)).toBe('their destination');
  });
});

describe('ride-hailing (Phase 2)', () => {
  it('parses shared ride links', () => {
    expect(parseRideLink('Follow my Uber trip: https://m.uber.com/ul/?trip=abc123 thanks')).toEqual({
      provider: 'uber',
      url: 'https://m.uber.com/ul/?trip=abc123',
    });
    expect(parseRideLink('https://bolt.eu/ride/xyz.')?.provider).toBe('bolt');
    expect(parseRideLink('Track: https://yango.com/route/123')?.provider).toBe('yango');
    expect(parseRideLink('http://m.uber.com/x')).toBeNull();
    expect(parseRideLink('https://evil.com/uber.com')).toBeNull();
  });
  it('normalises Ghana plates', () => {
    expect(normalizePlate('gr 4512 - 23')).toBeNull();
    expect(normalizePlate('GR 4512-23')).toBe('GR 4512-23');
    expect(normalizePlate('plate GT-1234-19')).toBe('GT 1234-19');
    expect(normalizePlate('AS 77-22 X')).toBe('AS 77-22 X');
    expect(normalizePlate('no plate here')).toBeNull();
  });
  it('reads a driver card screenshot', () => {
    expect(parseDriverCard(['Your driver is arriving', 'Kwame Mensah', '4.9 ★', 'Toyota Corolla • GR 4512-23', 'Bolt'])).toEqual({
      plate: 'GR 4512-23',
      driverName: 'Kwame Mensah',
      car: 'Toyota Corolla',
      provider: 'bolt',
    });
  });
});

describe('places and contacts', () => {
  it('normalises GhanaPost GPS', () => {
    expect(normalizeGhanaPostGps('ga1234567')).toBe('GA-123-4567');
    expect(normalizeGhanaPostGps('GA 492 7461')).toBe('GA-492-7461');
    expect(normalizeGhanaPostGps('AK-0039-5028')).toBe('AK-0039-5028');
    expect(normalizeGhanaPostGps('12-345')).toBeNull();
  });
  it('validates contacts', () => {
    expect(validateContact({ name: ' Mom ', phone: '024 123 4567', relationship: 'Mom', channel: 'sms' })).toEqual({
      ok: true,
      value: { name: 'Mom', phone: '+233241234567', relationship: 'Mom', channel: 'sms' },
    });
    const bad = validateContact({ name: '', phone: '12', relationship: 'Mom', channel: 'sms' });
    expect(bad.ok).toBe(false);
    const dupe = validateContact({ name: 'Dad', phone: '0241234567', relationship: 'Dad', channel: 'sms' }, ['+233241234567']);
    expect(dupe).toEqual({ ok: false, errors: { phone: 'This person is already in your contacts.' } });
    const self = validateContact({ name: 'Me', phone: '0241234567', relationship: 'Other', channel: 'sms' }, [], '+233241234567');
    expect(self.ok).toBe(false);
  });
  it('initials and relationship guesses', () => {
    expect(initials('Ama Serwaa Boateng')).toBe('AB');
    expect(initials('')).toBe('?');
    expect(guessRelationship('Mummy')).toBe('Mom');
    expect(guessRelationship('Papa Kofi')).toBe('Dad');
    expect(guessRelationship('Kojo')).toBe('Friend');
  });
});

describe('activity helpers', () => {
  it('filters', () => {
    expect(matchesFilter('arrival', 'arrivals')).toBe(true);
    expect(matchesFilter('sos', 'arrivals')).toBe(false);
    expect(matchesFilter('sos', 'alerts')).toBe(true);
    expect(matchesFilter('contact_request', 'requests')).toBe(true);
    expect(matchesFilter('test', 'all')).toBe(true);
  });
  it('rolls up delivery status, worst first', () => {
    expect(overallStatus(['delivered', 'sent'])).toBe('sent');
    expect(overallStatus(['delivered', 'failed'])).toBe('failed');
    expect(overallStatus([])).toBeNull();
    expect(statusLabel('delivered')).toBe('Delivered');
  });
  it('words who was told', () => {
    expect(toldWho(['Mom'])).toBe('Mom');
    expect(toldWho(['Mom', 'Dad'])).toBe('Mom and Dad');
    expect(toldWho(['Mom', 'Dad', 'Kofi'])).toBe('Mom and 2 others');
    expect(eventTitle('arrival', 'Work')).toBe('Reached Work');
  });
});

describe('safety and plans (Phase 3)', () => {
  it('emergency numbers', () => {
    expect(GHANA_EMERGENCY_NUMBERS[0]!.number).toBe('112');
    expect(telLink('112')).toBe('tel:112');
  });
  it('PIN rules', () => {
    expect(validatePin('12')).toMatch(/4 to 6/);
    expect(validatePin('1111')).toMatch(/repeating/);
    expect(validatePin('1234')).toMatch(/sequences/);
    expect(validatePin('4826')).toBeNull();
  });
  it('switches arrivals to WhatsApp when SMS allowance is used, never safety messages', () => {
    const used = PLANS.free.smsPerMonth;
    expect(chooseChannel({ kind: 'arrival', contactChannel: 'both', smsUsedThisMonth: used, plan: 'free' })).toBe('whatsapp');
    expect(chooseChannel({ kind: 'arrival', contactChannel: 'sms', smsUsedThisMonth: used, plan: 'free' })).toBe('none');
    expect(chooseChannel({ kind: 'safety', contactChannel: 'sms', smsUsedThisMonth: 9999, plan: 'free' })).toBe('sms');
    expect(chooseChannel({ kind: 'arrival', contactChannel: 'sms', smsUsedThisMonth: 1, plan: 'free' })).toBe('sms');
  });
  it('plan limits', () => {
    expect(canAdd('contact', 4, 'free')).toBe(true);
    expect(canAdd('contact', 5, 'free')).toBe(false);
    expect(canAdd('place', 14, 'premium')).toBe(true);
  });
  it('nearest police stations', () => {
    const here = { lat: 5.6037, lng: -0.187 };
    const r = nearestStations(here, [
      { id: 'a', name: 'Far', region: 'Ashanti', phone: null, lat: 6.69, lng: -1.62 },
      { id: 'b', name: 'Near', region: 'Greater Accra', phone: null, lat: 5.605, lng: -0.188 },
    ]);
    expect(r[0]!.name).toBe('Near');
    expect(formatDistance(180)).toBe('180 m');
    expect(formatDistance(2350)).toBe('2.4 km');
    expect(formatDistance(23500)).toBe('24 km');
  });
  it('battery guides by brand', () => {
    expect(detectBrand('TECNO MOBILE LIMITED')).toBe('tecno');
    expect(detectBrand('INFINIX')).toBe('infinix');
    expect(detectBrand('itel')).toBe('itel');
    expect(detectBrand('samsung')).toBe('samsung');
    expect(detectBrand(undefined)).toBe('other');
    expect(BATTERY_GUIDES.tecno.steps.length).toBeGreaterThan(1);
  });
});
