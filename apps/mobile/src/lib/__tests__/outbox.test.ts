import AsyncStorage from '@react-native-async-storage/async-storage';
import { setBackend } from '../backend';
import { BackendError, type Contact, type Place, type Rule, type Trip } from '../backend/types';
import { dueForSms, fallbackSms, flushOutbox, outboxItems, report, smsUrl, SMS_FALLBACK_AFTER_MS } from '../outbox';

const AT = { lat: 5.6037, lng: -0.187 };
const T0 = Date.UTC(2026, 9, 6, 8, 42);

function fakeBackend(fail: () => unknown) {
  const calls: string[] = [];
  const b = {
    arriveTrip: jest.fn(async (id: string) => {
      const e = fail();
      if (e) throw e;
      calls.push(`trip:${id}`);
      return 'ev';
    }),
    reportPlaceEvent: jest.fn(async (id: string, event: string) => {
      const e = fail();
      if (e) throw e;
      calls.push(`${event}:${id}`);
      return 'ev';
    }),
  };
  setBackend(b as never);
  return calls;
}

const mom: Contact = { id: 'c1', name: 'Mom', phone: '+233201112222', relationship: 'Mom', channel: 'sms', language: 'en', isDefault: true, isEmergency: true, canRequestLocation: false, optedOut: false, lastFailedAt: null, createdAt: '' };
const kofi: Contact = { ...mom, id: 'c2', name: 'Kofi', phone: '+233240000001', optedOut: true };
const work: Place = { id: 'p1', name: 'Work', icon: 'work', ...AT, radius: 150, address: null, ghanaPostGps: null };
const rule: Rule = { id: 'r1', placeId: 'p1', event: 'arrive', contactIds: ['c1', 'c2'], days: [0, 1, 2, 3, 4, 5, 6], windowStart: null, windowEnd: null, message: null, enabled: true };

describe('outbox', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('sends straight away when online', async () => {
    const calls = fakeBackend(() => null);
    expect(await report({ type: 'place_arrive', placeId: 'p1' }, AT, T0)).toBe('sent');
    expect(calls).toEqual(['arrive:p1']);
    expect(await outboxItems()).toEqual([]);
  });

  it('keeps arrivals made offline and sends them when back online', async () => {
    let offline = true;
    const calls = fakeBackend(() => (offline ? new BackendError('network', 'offline') : null));
    expect(await report({ type: 'trip_arrive', tripId: 't1' }, AT, T0)).toBe('queued');
    expect(await report({ type: 'place_leave', placeId: 'p1' }, AT, T0)).toBe('queued');
    expect(await flushOutbox()).toBe(2);
    offline = false;
    expect(await flushOutbox()).toBe(0);
    expect(calls).toEqual(['trip:t1', 'leave:p1']);
    expect(await outboxItems()).toEqual([]);
  });

  it('drops reports the server refuses (trip already ended)', async () => {
    fakeBackend(() => new BackendError('trip_not_live', 'This trip has already ended.'));
    expect(await report({ type: 'trip_arrive', tripId: 't1' }, AT, T0)).toBe('dropped');
    expect(await outboxItems()).toEqual([]);
  });

  it('offers the SMS app for arrivals stuck for 5 minutes, not departures', async () => {
    fakeBackend(() => new TypeError('Network request failed'));
    await report({ type: 'place_arrive', placeId: 'p1' }, AT, T0);
    await report({ type: 'place_leave', placeId: 'p1' }, AT, T0);
    const items = await outboxItems();
    expect(dueForSms(items, T0 + SMS_FALLBACK_AFTER_MS - 1)).toEqual([]);
    const due = dueForSms(items, T0 + SMS_FALLBACK_AFTER_MS);
    expect(due.map((i) => i.action.type)).toEqual(['place_arrive']);

    const sms = fallbackSms(due[0]!, { firstName: 'Ama', contacts: [mom, kofi], places: [work], rules: [rule], trip: null });
    expect(sms?.phones).toEqual(['+233201112222']); // Kofi opted out
    expect(sms?.body).toMatch(/^Ama has arrived safely at Work \(\d{1,2}:42[ap]m\)\. - Reached$/);
  });

  it('uses the trip contacts and destination for a trip arrival', () => {
    const trip = { id: 't1', destName: 'Mom\'s house', contactIds: ['c1'] } as Trip;
    const sms = fallbackSms({ id: 'x', action: { type: 'trip_arrive', tripId: 't1' }, at: AT, createdAt: T0, smsOffered: false }, { firstName: 'Ama', contacts: [mom], places: [], rules: [], trip });
    expect(sms?.body).toMatch(/^Ama has arrived safely at Mom's house/);
  });

  it('builds sms: links for Android and iPhone', () => {
    expect(smsUrl(['+233201112222', '+233245556666'], 'Hi & bye', 'android')).toBe('sms:+233201112222;+233245556666?body=Hi%20%26%20bye');
    expect(smsUrl(['+233201112222'], 'Hi', 'ios')).toBe('sms:+233201112222&body=Hi');
  });
});
