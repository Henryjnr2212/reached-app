import { accraMinuteOfDay, accraWeekday, minutesToHHMM, parseHHMM } from './time.ts';

export type RuleEvent = 'arrive' | 'leave';
export type DaysPreset = 'every_day' | 'weekdays' | 'weekends' | 'custom';

export interface PlaceRule {
  id: string;
  placeId: string;
  event: RuleEvent;
  contactIds: string[];
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** "HH:MM" 24h, both null = any time */
  windowStart: string | null;
  windowEnd: string | null;
  /** Custom wording with {name} {place} {time}, or null for the default. */
  message: string | null;
  enabled: boolean;
}

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKENDS = [0, 6];

export function daysForPreset(preset: Exclude<DaysPreset, 'custom'>): number[] {
  return preset === 'every_day' ? [...EVERY_DAY] : preset === 'weekdays' ? [...WEEKDAYS] : [...WEEKENDS];
}

export function presetForDays(days: number[]): DaysPreset {
  const key = [...new Set(days)].sort().join(',');
  if (key === EVERY_DAY.join(',')) return 'every_day';
  if (key === WEEKDAYS.join(',')) return 'weekdays';
  if (key === WEEKENDS.join(',')) return 'weekends';
  return 'custom';
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function clock12(hhmm: string): string {
  const mins = parseHHMM(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** "Weekdays, 7am–10am" style summary for lists. */
export function describeSchedule(rule: Pick<PlaceRule, 'days' | 'windowStart' | 'windowEnd'>): string {
  const preset = presetForDays(rule.days);
  const days =
    preset === 'every_day'
      ? 'Every day'
      : preset === 'weekdays'
        ? 'Weekdays'
        : preset === 'weekends'
          ? 'Weekends'
          : [...rule.days].sort().map((d) => DAY_SHORT[d]).join(', ');
  if (rule.windowStart && rule.windowEnd) {
    return `${days}, ${clock12(rule.windowStart)}–${clock12(rule.windowEnd)}`;
  }
  return days;
}

/** "Arrive → tell Mom, Dad" */
export function describeRule(rule: Pick<PlaceRule, 'event' | 'contactIds'>, contactName: (id: string) => string): string {
  const names = rule.contactIds.map(contactName).filter(Boolean);
  const who = names.length === 0 ? 'nobody yet' : names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} others`;
  return `${rule.event === 'arrive' ? 'When I arrive' : 'When I leave'}, tell ${who}`;
}

/**
 * Whether the time window contains this moment. Windows that wrap midnight
 * ("22:00"–"06:00") are supported. Start is inclusive, end exclusive.
 */
export function inWindow(start: string | null, end: string | null, at: Date): boolean {
  if (!start || !end) return true;
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  const m = accraMinuteOfDay(at);
  if (s === e) return true;
  return s < e ? m >= s && m < e : m >= s || m < e;
}

export function ruleMatches(rule: PlaceRule, placeId: string, event: RuleEvent, at: Date): boolean {
  if (!rule.enabled || rule.placeId !== placeId || rule.event !== event) return false;
  let day = accraWeekday(at);
  // For an overnight window, the early-morning part belongs to the previous day's schedule.
  if (rule.windowStart && rule.windowEnd) {
    const s = parseHHMM(rule.windowStart);
    const e = parseHHMM(rule.windowEnd);
    if (s > e && accraMinuteOfDay(at) < e) day = (day + 6) % 7;
  }
  return rule.days.includes(day) && inWindow(rule.windowStart, rule.windowEnd, at);
}

export interface Delivery {
  contactId: string;
  /** Custom wording if any matching rule set one (first one wins). */
  message: string | null;
  ruleIds: string[];
}

/**
 * SPEC §13 "Two rules fire at once → one combined message per contact".
 * Given every matching rule for one place event, return one delivery per
 * contact, remembering which rules caused it.
 */
export function combineRuleDeliveries(rules: PlaceRule[]): Delivery[] {
  const byContact = new Map<string, Delivery>();
  for (const rule of rules) {
    for (const contactId of rule.contactIds) {
      const existing = byContact.get(contactId);
      if (existing) {
        existing.ruleIds.push(rule.id);
        existing.message ??= rule.message;
      } else {
        byContact.set(contactId, { contactId, message: rule.message, ruleIds: [rule.id] });
      }
    }
  }
  return [...byContact.values()];
}

export function matchingDeliveries(rules: PlaceRule[], placeId: string, event: RuleEvent, at: Date): Delivery[] {
  return combineRuleDeliveries(rules.filter((r) => ruleMatches(r, placeId, event, at)));
}

export function validateRule(rule: Pick<PlaceRule, 'contactIds' | 'days' | 'windowStart' | 'windowEnd'>): string | null {
  if (rule.contactIds.length === 0) return 'Choose at least one person to tell.';
  if (rule.days.length === 0) return 'Choose at least one day.';
  if (rule.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'Pick valid days.';
  if (!!rule.windowStart !== !!rule.windowEnd) return 'Set both a start and an end time.';
  if (rule.windowStart && rule.windowEnd) {
    try {
      if (parseHHMM(rule.windowStart) === parseHHMM(rule.windowEnd)) return 'Start and end time can’t be the same.';
    } catch {
      return 'Enter a valid time.';
    }
  }
  return null;
}

export { minutesToHHMM };
