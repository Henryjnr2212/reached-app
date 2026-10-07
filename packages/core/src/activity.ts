/**
 * Activity events: what the Activity tab and Home "Recent activity" list show.
 */
export type EventKind =
  | 'arrival'
  | 'departure'
  | 'on_the_way'
  | 'running_late'
  | 'plans_changed'
  | 'overdue_alert'
  | 'sos'
  | 'all_clear'
  | 'test'
  | 'intro'
  | 'contact_request';

export type ActivityFilter = 'all' | 'arrivals' | 'alerts' | 'requests';

export const ACTIVITY_FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'arrivals', label: 'Arrivals' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'requests', label: 'Requests' },
];

export function matchesFilter(kind: EventKind, filter: ActivityFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'arrivals':
      return kind === 'arrival' || kind === 'departure' || kind === 'on_the_way' || kind === 'running_late' || kind === 'plans_changed';
    case 'alerts':
      return kind === 'overdue_alert' || kind === 'sos' || kind === 'all_clear';
    case 'requests':
      return kind === 'contact_request';
  }
}

export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'opted_out';

/** Order used to roll per-contact statuses into one row status. Worst wins. */
const SEVERITY: DeliveryStatus[] = ['delivered', 'sent', 'sending', 'pending', 'opted_out', 'failed'];

export function overallStatus(statuses: DeliveryStatus[]): DeliveryStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((worst, s) => (SEVERITY.indexOf(s) > SEVERITY.indexOf(worst) ? s : worst), statuses[0]!);
}

export function statusLabel(s: DeliveryStatus): string {
  return {
    pending: 'Queued',
    sending: 'Sending',
    sent: 'Sent',
    delivered: 'Delivered',
    failed: 'Failed',
    opted_out: 'Opted out',
  }[s];
}

/** "Told Mom you reached Work" / "Told Mom and Dad…" / "Told Mom and 2 others…" */
export function toldWho(names: string[]): string {
  if (names.length === 0) return 'Nobody';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
}

export function eventTitle(kind: EventKind, place: string | null): string {
  const where = place ?? 'your destination';
  switch (kind) {
    case 'arrival':
      return `Reached ${where}`;
    case 'departure':
      return `Left ${where}`;
    case 'on_the_way':
      return `On the way to ${where}`;
    case 'running_late':
      return 'Running late';
    case 'plans_changed':
      return 'Trip cancelled';
    case 'overdue_alert':
      return 'Overdue alert sent';
    case 'sos':
      return 'SOS sent';
    case 'all_clear':
      return 'All clear sent';
    case 'test':
      return 'Test message';
    case 'intro':
      return 'Contact added';
    case 'contact_request':
      return 'Location request';
  }
}

export const FEEDBACK_OPTIONS = [
  { key: 'not_arrived', label: "I hadn't arrived yet" },
  { key: 'wrong_place', label: 'Wrong place' },
  { key: 'should_not_send', label: "Shouldn't have sent" },
] as const;

export type FeedbackKey = (typeof FEEDBACK_OPTIONS)[number]['key'];

export const RETENTION_OPTIONS = [7, 30] as const;
export const DEFAULT_RETENTION_DAYS = 30;
