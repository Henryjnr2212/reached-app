import type { ProfilePatch } from '@/lib/backend/types';
import { keys, useAction, useProfile } from '@/lib/hooks/queries';
import { Card, Screen, SkeletonList, SwitchRow } from '@/ui';

export default function NotificationSettings() {
  const profile = useProfile();
  const update = useAction((b, patch: ProfilePatch) => b.updateProfile(patch), [keys.profile]);
  const p = profile.data;
  return (
    <Screen title="Notifications">
      {!p ? (
        <SkeletonList />
      ) : (
        <Card padded={false}>
          <SwitchRow title="Arrival confirmations" subtitle={'"Told Mom you reached Work"'} value={p.notifyArrivals} onChange={(v) => update.mutate({ notifyArrivals: v })} icon="checkmark-circle" />
          <SwitchRow title="Late check-ins" subtitle="Needed to keep you safe" value disabled onChange={() => undefined} icon="time" tint="warning" />
          <SwitchRow title="Contact requests" value={p.notifyRequests} onChange={(v) => update.mutate({ notifyRequests: v })} icon="hand-left" tint="info" />
          <SwitchRow title="Tips and updates" value={p.notifyTips} onChange={(v) => update.mutate({ notifyTips: v })} icon="bulb" tint="neutral" />
        </Card>
      )}
    </Screen>
  );
}
