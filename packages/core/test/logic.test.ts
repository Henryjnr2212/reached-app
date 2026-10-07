import { alreadyAtDestination, detectArrival, isDuplicateTrigger, hasLeftZone, type LocationSample } from '../src/arrival.ts';
import { clampRadius, distanceMeters, estimateTravelMinutes, isInsideZone, type Zone } from '../src/geo.ts';
import {
  combineRuleDeliveries, describeRule, describeSchedule, inWindow, matchingDeliveries, presetForDays, ruleMatches, validateRule,
  type PlaceRule,
} from '../src/rules.ts';
import { accraWeekday, dayLabel, formatClock, greetingFor, relativeAgo } from '../src/time.ts';
import { extendExpected, formatDuration, overdueAction, overdueSecondsLeft, phoneMayBeOff, type TripTiming } from '../src/trips.ts';

const MIN = 60_000;
// Accra Mall area.
const work: Zone = { lat: 5.6211, lng: -0.1739, radius: 150 };
const offset = (m: number) => ({ lat: work.lat + m / 111_320, lng: work.lng });

describe('geo', () => {
  it('measures distance', () => {
    expect(Math.round(distanceMeters(work, offset(100)))).toBe(100);
  });
  it('inside / outside with accuracy slack', () => {
    expect(isInsideZone(work, offset(140))).toBe(true);
    expect(isInsideZone(work, offset(170))).toBe(false);
    expect(isInsideZone(work, offset(170), 40)).toBe(true);
    expect(isInsideZone(work, offset(300), 400)).toBe(false);
  });
  it('clamps zone size to 100–500 m', () => {
    expect(clampRadius(20)).toBe(100);
    expect(clampRadius(900)).toBe(500);
    expect(clampRadius(153)).toBe(150);
    expect(clampRadius(Number.NaN)).toBe(150);
  });
  it('estimates travel with a 5 minute floor', () => {
    expect(estimateTravelMinutes(work, offset(50))).toBe(5);
    expect(estimateTravelMinutes(work, offset(10_000))).toBeGreaterThan(30);
  });
});

describe('arrival detection (SPEC §13 traffic / station)', () => {
  const t0 = Date.UTC(2026, 9, 6, 17, 0);
  const s = (m: number, sec: number, extra: Partial<LocationSample> = {}): LocationSample => ({ ...offset(m), at: t0 + sec * 1000, ...extra });

  it('arrives after the minimum stop time', () => {
    const at = detectArrival(work, [s(400, 0), s(100, 30), s(80, 60), s(50, 130)]);
    expect(at).toBe(t0 + 130_000);
  });
  it('does not arrive while passing through in a vehicle', () => {
    const track = [s(100, 0, { speed: 9 }), s(50, 60, { speed: 8 }), s(-100, 120, { speed: 10 }), s(-400, 180, { speed: 10 })];
    expect(detectArrival(work, track)).toBeNull();
  });
  it('waits while stuck in traffic, then arrives once out of the car', () => {
    const track = [
      s(120, 0, { activity: 'in_vehicle' }),
      s(110, 120, { activity: 'in_vehicle' }),
      s(60, 240, { activity: 'walking', speed: 1 }),
      s(40, 300, { activity: 'still', speed: 0 }),
      s(40, 340, { activity: 'still', speed: 0 }),
    ];
    expect(detectArrival(work, track)).toBe(t0 + 340_000);
  });
  it('resets when the phone leaves before the stop time', () => {
    expect(detectArrival(work, [s(100, 0), s(300, 60), s(100, 120), s(100, 150)])).toBeNull();
  });
  it('flags already being at the destination', () => {
    expect(alreadyAtDestination(work, offset(20))).toBe(true);
    expect(alreadyAtDestination(work, null)).toBe(false);
  });
  it('suppresses duplicate triggers within one hour', () => {
    expect(isDuplicateTrigger(t0, t0 + 59 * MIN)).toBe(true);
    expect(isDuplicateTrigger(t0, t0 + 60 * MIN)).toBe(false);
    expect(isDuplicateTrigger(null, t0)).toBe(false);
  });
  it('departure needs a margin beyond the zone edge', () => {
    expect(hasLeftZone(work, s(180, 0))).toBe(false);
    expect(hasLeftZone(work, s(260, 0))).toBe(true);
  });
});

const rule = (over: Partial<PlaceRule> = {}): PlaceRule => ({
  id: 'r1', placeId: 'work', event: 'arrive', contactIds: ['mom'], days: [0, 1, 2, 3, 4, 5, 6],
  windowStart: null, windowEnd: null, message: null, enabled: true, ...over,
});

describe('rules', () => {
  // Monday 6 Oct 2026, 08:42 Accra
  const mon0842 = new Date(Date.UTC(2026, 9, 5, 8, 42));
  const sat0842 = new Date(Date.UTC(2026, 9, 10, 8, 42));
  it('date sanity', () => {
    expect(accraWeekday(mon0842)).toBe(1);
    expect(accraWeekday(sat0842)).toBe(6);
  });
  it('matches days', () => {
    expect(ruleMatches(rule({ days: [1, 2, 3, 4, 5] }), 'work', 'arrive', mon0842)).toBe(true);
    expect(ruleMatches(rule({ days: [1, 2, 3, 4, 5] }), 'work', 'arrive', sat0842)).toBe(false);
  });
  it('matches event, place and enabled', () => {
    expect(ruleMatches(rule(), 'work', 'leave', mon0842)).toBe(false);
    expect(ruleMatches(rule(), 'home', 'arrive', mon0842)).toBe(false);
    expect(ruleMatches(rule({ enabled: false }), 'work', 'arrive', mon0842)).toBe(false);
  });
  it('time windows including overnight', () => {
    expect(inWindow('07:00', '10:00', mon0842)).toBe(true);
    expect(inWindow('09:00', '10:00', mon0842)).toBe(false);
    expect(inWindow('22:00', '06:00', new Date(Date.UTC(2026, 9, 5, 23, 0)))).toBe(true);
    expect(inWindow('22:00', '06:00', new Date(Date.UTC(2026, 9, 5, 5, 59)))).toBe(true);
    expect(inWindow('22:00', '06:00', new Date(Date.UTC(2026, 9, 5, 6, 0)))).toBe(false);
  });
  it('overnight window early morning counts for the previous day', () => {
    // Friday-night rule (day 5) should match Saturday 01:00.
    const r = rule({ days: [5], windowStart: '22:00', windowEnd: '06:00' });
    expect(ruleMatches(r, 'work', 'arrive', new Date(Date.UTC(2026, 9, 10, 1, 0)))).toBe(true);
    expect(ruleMatches(r, 'work', 'arrive', new Date(Date.UTC(2026, 9, 9, 1, 0)))).toBe(false);
  });
  it('combines two rules into one message per contact (SPEC §13)', () => {
    const d = combineRuleDeliveries([
      rule({ id: 'a', contactIds: ['mom', 'dad'] }),
      rule({ id: 'b', contactIds: ['mom'], message: 'custom' }),
    ]);
    expect(d).toEqual([
      { contactId: 'mom', message: 'custom', ruleIds: ['a', 'b'] },
      { contactId: 'dad', message: null, ruleIds: ['a'] },
    ]);
    expect(matchingDeliveries([rule({ id: 'x', days: [6] })], 'work', 'arrive', mon0842)).toEqual([]);
  });
  it('describes schedules and rules', () => {
    expect(describeSchedule(rule({ days: [1, 2, 3, 4, 5], windowStart: '07:00', windowEnd: '10:30' }))).toBe('Weekdays, 7am–10:30am');
    expect(describeSchedule(rule({ days: [0, 6] }))).toBe('Weekends');
    expect(describeSchedule(rule({ days: [1, 3] }))).toBe('Mon, Wed');
    expect(presetForDays([6, 0])).toBe('weekends');
    expect(describeRule(rule({ contactIds: ['m', 'd', 's'] }), (id) => ({ m: 'Mom', d: 'Dad', s: 'Kofi' })[id] ?? '')).toBe(
      'When I arrive, tell Mom and 2 others',
    );
  });
  it('validates', () => {
    expect(validateRule(rule({ contactIds: [] }))).toMatch(/at least one person/);
    expect(validateRule(rule({ days: [] }))).toMatch(/at least one day/);
    expect(validateRule(rule({ windowStart: '07:00', windowEnd: null }))).toMatch(/both/);
    expect(validateRule(rule({ windowStart: '07:00', windowEnd: '07:00' }))).toMatch(/same/);
    expect(validateRule(rule())).toBeNull();
  });
});

describe('time', () => {
  it('formats like the templates', () => {
    expect(formatClock(new Date(Date.UTC(2026, 0, 1, 8, 42)))).toBe('8:42am');
    expect(formatClock(new Date(Date.UTC(2026, 0, 1, 18, 30)))).toBe('6:30pm');
    expect(formatClock(new Date(Date.UTC(2026, 0, 1, 0, 5)))).toBe('12:05am');
    expect(formatClock(new Date(Date.UTC(2026, 0, 1, 12, 0)))).toBe('12:00pm');
  });
  it('greets by time of day', () => {
    expect(greetingFor(new Date(Date.UTC(2026, 0, 1, 7)))).toBe('Good morning');
    expect(greetingFor(new Date(Date.UTC(2026, 0, 1, 13)))).toBe('Good afternoon');
    expect(greetingFor(new Date(Date.UTC(2026, 0, 1, 19)))).toBe('Good evening');
  });
  it('labels days and relative times', () => {
    const now = new Date(Date.UTC(2026, 9, 6, 12));
    expect(dayLabel(new Date(Date.UTC(2026, 9, 6, 1)), now)).toBe('Today');
    expect(dayLabel(new Date(Date.UTC(2026, 9, 5, 23)), now)).toBe('Yesterday');
    expect(dayLabel(new Date(Date.UTC(2026, 9, 1, 9)), now)).toBe('Thu 1 Oct');
    expect(relativeAgo(new Date(now.getTime() - 61_000), now)).toBe('1 min ago');
  });
});

describe('overdue timing (mirrors check_overdue_trips)', () => {
  const t0 = Date.UTC(2026, 9, 6, 18, 30);
  const base: TripTiming = { status: 'active', checkOnMe: true, expectedAt: t0, graceMinutes: 15, overduePromptedAt: null, lastCheckinAt: t0 };
  it('prompts after expected + grace', () => {
    expect(overdueAction(base, t0 + 14 * MIN)).toBe('none');
    expect(overdueAction(base, t0 + 15 * MIN)).toBe('prompt');
  });
  it('alerts 5 minutes after the prompt without an answer', () => {
    const prompted = { ...base, status: 'overdue' as const, overduePromptedAt: t0 + 15 * MIN };
    expect(overdueAction(prompted, t0 + 19 * MIN)).toBe('none');
    expect(overdueAction(prompted, t0 + 20 * MIN)).toBe('alert');
    expect(overdueSecondsLeft(t0 + 15 * MIN, t0 + 16 * MIN)).toBe(240);
  });
  it('does nothing when check-on-me is off or trip ended', () => {
    expect(overdueAction({ ...base, checkOnMe: false }, t0 + 99 * MIN)).toBe('none');
    expect(overdueAction({ ...base, status: 'arrived' }, t0 + 99 * MIN)).toBe('none');
    expect(overdueAction({ ...base, status: 'alerted', overduePromptedAt: t0 }, t0 + 99 * MIN)).toBe('none');
  });
  it('detects a phone that may be off', () => {
    expect(phoneMayBeOff(t0, t0 + 9 * MIN)).toBe(false);
    expect(phoneMayBeOff(t0, t0 + 10 * MIN)).toBe(true);
    expect(phoneMayBeOff(null, t0)).toBe(true);
  });
  it('extends from the later of expected and now', () => {
    expect(extendExpected(t0, 15, t0 - 60 * MIN)).toBe(t0 + 15 * MIN);
    expect(extendExpected(t0, 15, t0 + 30 * MIN)).toBe(t0 + 45 * MIN);
    expect(extendExpected(null, 30, t0)).toBe(t0 + 30 * MIN);
  });
  it('formats durations', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(150)).toBe('2 hrs 30 min');
  });
});
