import { router } from 'expo-router';
import { Platform } from 'react-native';
import { useApp } from '@/lib/store';
import type { IconName } from '@/ui';

export interface Warning {
  id: string;
  title: string;
  body: string;
  icon: IconName;
  fix: () => void;
}

/** Home banners: only shown when something stops Reached from working. */
export function useWarnings(): Warning[] {
  const { location, notifications, battery, dismissed, online } = useApp();
  const out: Warning[] = [];
  const toPermissions = () => router.push('/settings/permissions');
  if (!online) out.push({ id: 'offline', title: "You're offline", body: "Arrivals will send when you're back online.", icon: 'cloud-offline', fix: () => undefined });
  if (location === 'denied' || location === 'undetermined')
    out.push({ id: 'location', title: "Location is off, arrivals won't be detected", body: 'Only manual trips will work.', icon: 'location', fix: toPermissions });
  else if (location === 'foreground' && Platform.OS !== 'web')
    out.push({ id: 'location-bg', title: 'Arrivals only work with the app open', body: 'Choose "Allow all the time" for location.', icon: 'location', fix: toPermissions });
  if (notifications === 'denied') out.push({ id: 'notifications', title: "Notifications are off", body: "We can't check on you if you're late.", icon: 'notifications-off', fix: toPermissions });
  if (battery === 'restricted') out.push({ id: 'battery', title: 'Your phone may stop Reached', body: 'Remove battery restrictions so arrivals keep working.', icon: 'battery-dead', fix: toPermissions });
  return out.filter((w) => !dismissed.includes(w.id));
}
