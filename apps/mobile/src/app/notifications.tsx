import { relativeAgo } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { backendNow, useBackend } from '@/lib/backend';
import { keys, useNotifications } from '@/lib/hooks/queries';
import { Card, EmptyState, ListRow, Screen, SkeletonList, type IconName } from '@/ui';

const ICON: Record<string, IconName> = {
  arrival_sent: 'checkmark-circle',
  ask_first: 'help-circle',
  heading_out: 'walk',
  are_you_okay: 'alert-circle',
  alert_sent: 'warning',
  contact_request: 'hand-left',
  message_failed: 'close-circle',
  permissions: 'settings',
  trip_in_progress: 'navigate',
  opted_out: 'hand-left',
  tip: 'bulb',
};

/** In-app inbox of the same notifications that arrive as pushes. */
export default function Notifications() {
  const b = useBackend();
  const qc = useQueryClient();
  const list = useNotifications();
  const open = async (n: NonNullable<typeof list.data>[number]) => {
    if (!n.readAt) {
      await b.markNotificationRead(n.id);
      void qc.invalidateQueries({ queryKey: keys.notifications });
    }
    if (n.kind === 'are_you_okay' || n.kind === 'alert_sent') router.push('/overdue');
    else if (n.kind === 'permissions') router.push('/settings/permissions');
    else if (n.kind === 'contact_request' || n.kind === 'heading_out') router.push('/(tabs)');
    else if (n.kind === 'trip_in_progress') router.push('/trip/active');
    else if (n.data.event_id) router.push({ pathname: '/event/[id]', params: { id: n.data.event_id } });
  };
  return (
    <Screen title="Notifications" testID="notifications-screen">
      {list.isLoading ? (
        <SkeletonList />
      ) : list.data?.length ? (
        <Card padded={false}>
          {list.data.map((n) => (
            <ListRow
              key={n.id}
              title={n.title}
              subtitle={`${n.body} · ${relativeAgo(new Date(n.createdAt), new Date(backendNow()))}`}
              icon={ICON[n.kind] ?? 'notifications'}
              tint={n.kind === 'are_you_okay' || n.kind === 'alert_sent' || n.kind === 'message_failed' ? 'danger' : n.readAt ? 'neutral' : 'primary'}
              onPress={() => void open(n)}
              testID={`notification-${n.kind}`}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon="notifications" title="All caught up" body="We'll let you know when your people have been told." />
      )}
    </Screen>
  );
}
