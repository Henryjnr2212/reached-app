import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatClock, renderSms, toldWho, type LatLng } from '@reached/core';
import { getBackend } from '@/lib/backend';
import { BackendError, type Contact, type Place, type Rule, type Trip } from '@/lib/backend/types';
import type { TrackerAction } from './tracker';

/**
 * Arrivals and departures detected while offline (spec §13 "No data at
 * arrival"): kept on the phone and sent when the connection is back. If an
 * arrival is still stuck after 5 minutes, the app offers the phone's own SMS
 * app with the message ready (Play doesn't let apps send SMS themselves).
 */
export interface OutboxItem {
  id: string;
  action: TrackerAction;
  at: LatLng;
  /** epoch ms when the arrival happened */
  createdAt: number;
  smsOffered: boolean;
  /** A "No internet, tap to text them yourself" notification was shown while in the background. */
  notified?: boolean;
}

const KEY = 'reached-outbox';
export const SMS_FALLBACK_AFTER_MS = 5 * 60_000;

/** A failure worth retrying: no connection, a timeout, a server hiccup. Rule errors are final. */
export function isRetryable(e: unknown): boolean {
  if (!(e instanceof BackendError)) return true;
  return e.code === 'network' || e.code === 'error' || e.code === 'function_error';
}

async function load(): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

const save = (items: OutboxItem[]) => AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);

export const outboxItems = load;

async function send(action: TrackerAction, at: LatLng) {
  const b = getBackend();
  if (action.type === 'trip_arrive') await b.arriveTrip(action.tripId, at, 'auto');
  else if (action.type === 'place_arrive') await b.reportPlaceEvent(action.placeId, 'arrive', at);
  else await b.reportPlaceEvent(action.placeId, 'leave', at);
}

/** Tell the server now, or keep it for later if we're offline. */
export async function report(action: TrackerAction, at: LatLng, now = Date.now()): Promise<'sent' | 'queued' | 'dropped'> {
  try {
    await send(action, at);
    return 'sent';
  } catch (e) {
    if (!isRetryable(e)) return 'dropped';
    const items = await load();
    items.push({ id: `${now}-${Math.random().toString(36).slice(2, 8)}`, action, at, createdAt: now, smsOffered: false });
    await save(items);
    return 'queued';
  }
}

/** Retry everything waiting. Returns how many are still waiting. */
export async function flushOutbox(): Promise<number> {
  const items = await load();
  if (!items.length) return 0;
  const left: OutboxItem[] = [];
  for (const item of items) {
    try {
      await send(item.action, item.at);
    } catch (e) {
      if (isRetryable(e)) left.push(item);
    }
  }
  // Re-read so items queued meanwhile (background task) aren't lost.
  const latest = await load();
  const handled = new Set(items.filter((i) => !left.some((l) => l.id === i.id)).map((i) => i.id));
  await save(latest.filter((i) => !handled.has(i.id)));
  return left.length;
}

export async function markItem(id: string, patch: Pick<Partial<OutboxItem>, 'smsOffered' | 'notified'>) {
  const items = await load();
  await save(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

/** Arrivals stuck long enough to offer the phone's SMS app. */
export function dueForSms(items: OutboxItem[], now: number): OutboxItem[] {
  return items.filter((i) => i.action.type !== 'place_leave' && !i.smsOffered && now - i.createdAt >= SMS_FALLBACK_AFTER_MS);
}

/** Who to text and what to say for a stuck arrival, from the data the app already has. */
export function fallbackSms(
  item: OutboxItem,
  data: { firstName: string; contacts: Contact[]; places: Place[]; rules: Rule[]; trip: Trip | null },
): { phones: string[]; names: string[]; body: string } | null {
  let contactIds: string[] = [];
  let place = 'their destination';
  if (item.action.type === 'trip_arrive') {
    const tripId = item.action.tripId;
    if (data.trip?.id !== tripId) return null;
    contactIds = data.trip.contactIds;
    place = data.trip.destName ?? place;
  } else if (item.action.type === 'place_arrive') {
    const placeId = item.action.placeId;
    const p = data.places.find((x) => x.id === placeId);
    if (!p) return null;
    place = p.name;
    contactIds = [...new Set(data.rules.filter((r) => r.placeId === placeId && r.event === 'arrive' && r.enabled).flatMap((r) => r.contactIds))];
  }
  const people = data.contacts.filter((c) => contactIds.includes(c.id) && !c.optedOut);
  if (!people.length) return null;
  const body = renderSms('arrived', { name: data.firstName, place, time: formatClock(new Date(item.createdAt)) });
  return { phones: people.map((c) => c.phone), names: people.map((c) => c.name), body };
}

/** sms: link that opens the SMS app with recipients and text filled in. */
export function smsUrl(phones: string[], body: string, os: 'ios' | 'android'): string {
  const to = phones.join(os === 'ios' ? ',' : ';');
  return `sms:${to}${os === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

export const describeFallback = (names: string[]) => `No internet. Tap to text ${toldWho(names)} yourself.`;
