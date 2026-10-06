import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Notification categories and their buttons (SPEC §12). Identifiers match
 * the kinds the server writes to public.notifications; the dispatch function
 * sets categoryId to the kind.
 */
export const CATEGORIES: Record<string, { id: string; title: string; opensApp?: boolean; destructive?: boolean }[]> = {
  are_you_okay: [
    { id: 'im_okay', title: "I'm okay", opensApp: true },
    { id: 'more_time', title: 'Need more time', opensApp: true },
    { id: 'get_help', title: 'Get help', destructive: true },
  ],
  ask_first: [
    { id: 'send', title: 'Send' },
    { id: 'not_now', title: 'Not now' },
  ],
  message_failed: [{ id: 'retry', title: 'Retry' }],
  alert_sent: [{ id: 'im_safe', title: "I'm safe now", opensApp: true }],
  heading_out: [
    { id: 'notify', title: 'Notify when I arrive', opensApp: true },
    { id: 'not_now', title: 'Not now' },
  ],
  contact_request: [
    { id: 'accept', title: 'Accept' },
    { id: 'decline', title: 'Decline' },
  ],
  permissions: [{ id: 'fix', title: 'Fix', opensApp: true }],
  trip_in_progress: [{ id: 'arrived', title: "I've arrived" }],
};

export async function setupNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Arrivals', importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Safety checks',
      importance: Notifications.AndroidImportance.MAX,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Promise.all(
    Object.entries(CATEGORIES).map(([id, actions]) =>
      Notifications.setNotificationCategoryAsync(
        id,
        actions.map((a) => ({ identifier: a.id, buttonTitle: a.title, options: { opensAppToForeground: !!a.opensApp, isDestructive: !!a.destructive } })),
      ),
    ),
  );
}

export async function getNotificationAccess(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'granted' : 'undetermined';
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

export async function pushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    return (await Notifications.getExpoPushTokenAsync()).data;
  } catch {
    return null;
  }
}

/** Local notification, used for the ongoing trip notification and offline fallbacks. */
export async function showLocal(title: string, body: string, data: Record<string, string> = {}, categoryIdentifier?: string) {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({ content: { title, body, data, categoryIdentifier }, trigger: null });
}
