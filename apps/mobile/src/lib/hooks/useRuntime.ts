import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { backendNow, getBackend } from '@/lib/backend';
import { batteryPercent, batteryRestricted } from '@/lib/device/battery';
import { getLocationAccess, toSample } from '@/lib/device/location';
import { getNotificationAccess, pushToken } from '@/lib/device/notifications';
import { updateTrackingCache } from '@/lib/device/tasks';
import { processSample } from '@/lib/runTracker';
import { useApp } from '@/lib/store';
import { EMPTY_SMART, stepSmart, type SmartState } from '@/lib/smart';
import { EMPTY_TRACKER, type TrackerState } from '@/lib/tracker';
import { areaAt } from '@/lib/device/location';
import { showLocal } from '@/lib/device/notifications';
import { keys, TRIP_KEYS, useLiveTrip, usePlaces, useProfile } from './queries';

/** Re-read permissions and battery state on launch and whenever the app returns to the foreground. */
export function useDeviceStatus() {
  const set = useApp((s) => s.set);
  useEffect(() => {
    const refresh = async () => {
      const [location, notifications, restricted] = await Promise.all([getLocationAccess(), getNotificationAccess(), batteryRestricted()]);
      set({ location, notifications, battery: Platform.OS === 'android' ? (restricted ? 'restricted' : 'ok') : 'ok' });
    };
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    const online = () => set({ online: true });
    const offline = () => set({ online: false });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', online);
      window.addEventListener('offline', offline);
    }
    return () => {
      sub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', online);
        window.removeEventListener('offline', offline);
      }
    };
  }, [set]);
}

/**
 * Foreground arrival tracking (web, and phones without "Allow all the time").
 * Also sends trip check-ins every minute and keeps the background task's
 * cache of places and the live trip fresh.
 */
export function useForegroundTracker(enabled: boolean) {
  const places = usePlaces();
  const trip = useLiveTrip(enabled);
  const profile = useProfile(enabled);
  const smart = useRef<SmartState>(EMPTY_SMART);
  const location = useApp((s) => s.location);
  const setApp = useApp((s) => s.set);
  const qc = useQueryClient();
  const state = useRef<TrackerState>(EMPTY_TRACKER);
  const last = useRef<Location.LocationObject | null>(null);
  const lastCheckin = useRef(0);
  const data = useRef({ places: places.data ?? [], trip: trip.data ?? null, profile: profile.data ?? null });
  data.current = { places: places.data ?? [], trip: trip.data ?? null, profile: profile.data ?? null };

  useEffect(() => {
    if (enabled && places.data) void updateTrackingCache(places.data, trip.data ?? null);
  }, [enabled, places.data, trip.data]);

  const foreground = Platform.OS === 'web' || location !== 'always';
  const active = enabled && location !== 'denied' && location !== 'undetermined';

  useEffect(() => {
    if (!active) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    let busy = false;

    const handle = async (loc: Location.LocationObject) => {
      last.current = loc;
      setApp({ here: { lat: loc.coords.latitude, lng: loc.coords.longitude } });
      if (busy) return;
      busy = true;
      try {
        if (foreground) {
          const sample = toSample(loc, backendNow());
          const r = await processSample(state.current, sample, data.current.places, data.current.trip);
          state.current = r.state;
          const sm = stepSmart(smart.current, sample, r.actions, data.current.places, data.current.profile, data.current.trip);
          smart.current = sm.state;
          for (const e of sm.effects) {
            if (e.type === 'heading_out') {
              setApp({ headingOut: { from: e.place.name, at: sample.at } });
              void showLocal('Heading out?', `Want us to tell your people when you arrive?`, { kind: 'heading_out' }, 'heading_out');
            } else {
              const area = await areaAt(e.at);
              await getBackend().reportAutoArrival(area, e.at).catch(() => undefined);
              await qc.invalidateQueries({ queryKey: keys.events });
            }
          }
          if (r.actions.length) {
            // Show the arrival before the trip query empties, so the trip screen doesn't send us Home first.
            const arrived = r.actions.find((a) => a.type === 'trip_arrive');
            if (arrived) router.push({ pathname: '/trip/arrived', params: { tripId: arrived.tripId } });
            await Promise.all(TRIP_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
          }
        }
        const t = data.current.trip;
        if (t && backendNow() - lastCheckin.current >= 60_000) {
          lastCheckin.current = backendNow();
          await getBackend()
            .checkin(t.id, { lat: loc.coords.latitude, lng: loc.coords.longitude }, loc.coords.accuracy, await batteryPercent())
            .catch(() => undefined);
        }
      } finally {
        busy = false;
      }
    };

    void Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5_000 }, (loc) => void handle(loc))
      .then((s) => {
        if (cancelled) s.remove();
        else sub = s;
      })
      .catch(() => undefined);
    // Staying still produces no new positions; re-feed the last one so the
    // minimum stop time can complete.
    const timer = setInterval(() => {
      if (Platform.OS === 'web') {
        // Browsers only report changes; ask for the current fix instead.
        void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((loc) => handle(loc))
          .catch(() => (last.current ? handle(last.current) : undefined));
      } else if (last.current) void handle(last.current);
    }, 5_000);
    return () => {
      cancelled = true;
      sub?.remove();
      clearInterval(timer);
    };
  }, [active, foreground, qc, setApp]);
}

/** Opens "Are you okay?" when the server marks the live trip overdue. */
export function useOverdueWatcher(enabled: boolean) {
  const trip = useLiveTrip(enabled);
  const path = usePathname();
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const t = trip.data;
    if (!t || (t.status !== 'overdue' && t.status !== 'alerted')) return;
    const key = `${t.id}:${t.status}:${t.overduePromptedAt}`;
    if (shown.current === key || path === '/overdue' || path === '/sos') return;
    shown.current = key;
    router.push('/overdue');
  }, [trip.data, path]);
}

/** Registers the push token and routes notification taps and buttons. */
export function usePushRouting(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    void pushToken().then((t) => (t ? getBackend().registerPushToken(t, Platform.OS === 'ios' ? 'ios' : 'android').catch(() => undefined) : undefined));
    const sub = Notifications.addNotificationResponseReceivedListener(async (res) => {
      const data = res.notification.request.content.data as Record<string, string>;
      const kind = data.kind ?? res.notification.request.content.categoryIdentifier ?? '';
      const action = res.actionIdentifier;
      const b = getBackend();
      try {
        if (kind === 'ask_first' && data.event_id && (action === 'send' || action === 'not_now')) {
          await b.confirmEvent(data.event_id, action === 'send');
        } else if (kind === 'message_failed' && action === 'retry' && data.message_id) {
          await b.resendMessage(data.message_id);
        } else if (kind === 'contact_request' && data.request_id && (action === 'accept' || action === 'decline')) {
          await b.respondRequest(data.request_id, action === 'accept', null);
        } else if (kind === 'are_you_okay' && action === 'get_help' && data.trip_id) {
          await b.respondOverdue(data.trip_id, 'get_help');
          router.push('/sos');
        } else if (kind === 'trip_in_progress' && action === 'arrived' && data.trip_id) {
          await b.arriveTrip(data.trip_id, null, 'manual');
          router.push({ pathname: '/trip/arrived', params: { tripId: data.trip_id } });
        } else if (kind === 'are_you_okay' || kind === 'alert_sent') router.push('/overdue');
        else if (kind === 'heading_out') router.push('/trip/start');
        else if (kind === 'permissions') router.push('/settings/permissions');
        else if (data.event_id) router.push({ pathname: '/event/[id]', params: { id: data.event_id } });
        else router.push('/');
      } catch {
        router.push('/');
      }
      await Promise.all([...TRIP_KEYS, keys.events].map((k) => qc.invalidateQueries({ queryKey: k })));
    });
    return () => sub.remove();
  }, [enabled, qc]);
}
