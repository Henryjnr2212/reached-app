import { MINUTE } from './time.ts';

/**
 * Trip timing rules shared by the app (for display) and the server (which is
 * the source of truth and runs the actual overdue check every minute).
 */
export const GRACE_OPTIONS = [10, 15, 30, 60] as const;
export const DEFAULT_GRACE_MIN = 15;
/** "Check on me" options when the trip has no destination. */
export const NO_DESTINATION_CHECK_OPTIONS = [30, 60, 120] as const;
export const RUNNING_LATE_OPTIONS = [15, 30, 60] as const;
export const MORE_TIME_OPTIONS = [15, 30, 60] as const;
/** Minutes the user has to answer "Are you okay?" before contacts are alerted. */
export const OVERDUE_RESPONSE_MIN = 5;
/** If the server has had no check-in for this long, alerts add "phone may be off". */
export const CHECKIN_STALE_MIN = 10;
/** Ask-me-first default: send anyway after 5 minutes. */
export const ASK_FIRST_TIMEOUT_OPTIONS = [5, 10, null] as const;
/** SOS location sharing interval. */
export const SOS_SHARE_INTERVAL_S = 30;
export const SOS_HOLD_SECONDS = 3;
export const SOS_COUNTDOWN_OPTIONS = [5, 10] as const;
/** Offline at arrival: after this long, open the SMS app with the message ready. */
export const OFFLINE_SMS_FALLBACK_MIN = 5;

export type TripStatus = 'active' | 'overdue' | 'alerted' | 'arrived' | 'cancelled';

export interface TripTiming {
  status: TripStatus;
  checkOnMe: boolean;
  expectedAt: number | null;
  graceMinutes: number;
  overduePromptedAt: number | null;
  lastCheckinAt: number | null;
}

export function dueAt(t: Pick<TripTiming, 'expectedAt' | 'graceMinutes'>): number | null {
  return t.expectedAt == null ? null : t.expectedAt + t.graceMinutes * MINUTE;
}

export type OverdueAction = 'none' | 'prompt' | 'alert';

/**
 * What the overdue job should do for this trip right now. Mirrors
 * public.check_overdue_trips() in the database; both are tested against the
 * same cases.
 */
export function overdueAction(t: TripTiming, now: number): OverdueAction {
  if (!t.checkOnMe) return 'none';
  if (t.status === 'active') {
    const due = dueAt(t);
    return due != null && now >= due ? 'prompt' : 'none';
  }
  if (t.status === 'overdue' && t.overduePromptedAt != null) {
    return now >= t.overduePromptedAt + OVERDUE_RESPONSE_MIN * MINUTE ? 'alert' : 'none';
  }
  return 'none';
}

export function phoneMayBeOff(lastCheckinAt: number | null, now: number): boolean {
  return lastCheckinAt == null || now - lastCheckinAt >= CHECKIN_STALE_MIN * MINUTE;
}

/** Seconds left on the "Are you okay?" countdown. */
export function overdueSecondsLeft(overduePromptedAt: number, now: number): number {
  return Math.max(0, Math.ceil((overduePromptedAt + OVERDUE_RESPONSE_MIN * MINUTE - now) / 1000));
}

/** "Running late" / "Need more time": push the expected time out from whichever is later. */
export function extendExpected(expectedAt: number | null, minutes: number, now: number): number {
  const base = Math.max(expectedAt ?? now, now);
  return base + minutes * MINUTE;
}

/** Without a destination the user picks "check on me in 30 min / 1 hr / 2 hrs / custom". */
export function expectedFromDuration(now: number, minutes: number): number {
  return now + minutes * MINUTE;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = `${h} hr${h === 1 ? '' : 's'}`;
  return m ? `${hours} ${m} min` : hours;
}

export function isTripLive(status: TripStatus): boolean {
  return status === 'active' || status === 'overdue' || status === 'alerted';
}

export const TRANSPORT_TYPES = [
  { key: 'trotro', label: 'Trotro' },
  { key: 'taxi', label: 'Taxi' },
  { key: 'ride_hailing', label: 'Ride-hailing' },
  { key: 'own_car', label: 'Own car' },
  { key: 'walking', label: 'Walking' },
  { key: 'motorbike', label: 'Motorbike' },
] as const;

export type TransportType = (typeof TRANSPORT_TYPES)[number]['key'];
