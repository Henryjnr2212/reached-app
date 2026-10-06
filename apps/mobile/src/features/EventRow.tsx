import { eventTitle, formatClock, overallStatus, statusLabel, toldWho, type DeliveryStatus } from '@reached/core';
import { router } from 'expo-router';
import type { ActivityEvent } from '@/lib/backend/types';
import { IconTile, ListRow, StatusPill, type IconName } from '@/ui';

const KIND_ICON: Record<ActivityEvent['kind'], [IconName, 'primary' | 'danger' | 'warning' | 'info' | 'neutral']> = {
  arrival: ['checkmark-circle', 'primary'],
  departure: ['exit', 'neutral'],
  on_the_way: ['navigate', 'info'],
  running_late: ['time', 'warning'],
  plans_changed: ['close-circle', 'neutral'],
  overdue_alert: ['alert-circle', 'danger'],
  sos: ['warning', 'danger'],
  all_clear: ['shield-checkmark', 'primary'],
  test: ['flask', 'info'],
  intro: ['person-add', 'info'],
  contact_request: ['hand-left', 'warning'],
};

export function eventStatus(e: ActivityEvent): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' } | null {
  if (e.status === 'pending_confirmation') return { label: 'Waiting for you', tone: 'warning' };
  if (e.status === 'cancelled') return { label: 'Not sent', tone: 'neutral' };
  const s = overallStatus(e.messages.filter((m) => m.status !== 'held' && m.status !== 'cancelled').map((m) => m.status as DeliveryStatus));
  if (!s) return null;
  const tone = s === 'delivered' ? 'success' : s === 'failed' || s === 'opted_out' ? 'danger' : s === 'sent' ? 'info' : 'neutral';
  return { label: statusLabel(s), tone };
}

export function eventSubtitle(e: ActivityEvent): string {
  const names = [...new Set(e.messages.map((m) => m.contactName))];
  const who = names.length ? `${toldWho(names)} told` : null;
  return [who, formatClock(new Date(e.createdAt))].filter(Boolean).join(' · ');
}

export function EventRow({ event }: { event: ActivityEvent }) {
  const [icon, tint] = KIND_ICON[event.kind];
  const status = eventStatus(event);
  const title = eventTitle(event.kind, event.placeName);
  return (
    <ListRow
      testID={`event-${event.id}`}
      title={title}
      subtitle={eventSubtitle(event)}
      left={<IconTile icon={icon} tint={tint} size={42} />}
      right={status ? <StatusPill label={status.label} tone={status.tone} /> : undefined}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      accessibilityLabel={`${title}, ${eventSubtitle(event)}${status ? `, ${status.label}` : ''}`}
    />
  );
}
