/**
 * Ghana uses GMT (UTC+0) all year with no daylight saving, so Accra local time
 * equals UTC. All helpers here work in that zone regardless of device settings.
 */
export const GHANA_TZ = 'Africa/Accra';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** 0 = Sunday … 6 = Saturday, in Accra time. */
export function accraWeekday(d: Date): number {
  return d.getUTCDay();
}

/** Minutes since local midnight in Accra. */
export function accraMinuteOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "8:42am", "12:05pm" — the style used in every message template. */
export function formatClock(d: Date): string {
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const suffix = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** "HH:MM" (24h) → minutes since midnight. */
export function parseHHMM(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`Invalid time "${value}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Invalid time "${value}"`);
  return h * 60 + min;
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * MINUTE);
}

/** "Good morning" / "Good afternoon" / "Good evening" for the Home greeting. */
export function greetingFor(d: Date): string {
  const h = d.getUTCHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Day key used to group the Activity list: "Today", "Yesterday" or "Mon 6 Oct". */
export function dayLabel(d: Date, now: Date): string {
  const key = (x: Date) => `${x.getUTCFullYear()}-${x.getUTCMonth()}-${x.getUTCDate()}`;
  if (key(d) === key(now)) return 'Today';
  if (key(d) === key(new Date(now.getTime() - DAY))) return 'Yesterday';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

/** "Last updated 1 min ago" style relative text. */
export function relativeAgo(then: Date, now: Date): string {
  const diff = Math.max(0, now.getTime() - then.getTime());
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} hr${h === 1 ? '' : 's'} ago`;
  }
  const d = Math.floor(diff / DAY);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
