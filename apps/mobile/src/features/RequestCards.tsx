import { router } from 'expo-router';
import { View } from 'react-native';
import { haptic } from '@/lib/device/haptics';
import { keys, TRIP_KEYS, useAction, useRequests } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { Button, Card, IconTile, Text } from '@/ui';

/** Phase 2: "Mom wants to know when you reach" and "Looks like you're heading out". */
export function RequestCards() {
  const requests = useRequests();
  const headingOut = useApp((s) => s.headingOut);
  const set = useApp((s) => s.set);
  const respond = useAction((b, a: { id: string; accept: boolean }) => b.respondRequest(a.id, a.accept, null), [...TRIP_KEYS, keys.requests]);
  const pending = (requests.data ?? []).filter((r) => r.status === 'pending');
  return (
    <>
      {pending.map((r) => (
        <Card key={r.id} tone="warningSoft" testID={`request-${r.id}`}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconTile icon="hand-left" tint="warning" />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {r.contactName} wants to know when you reach
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button
              label="Accept"
              size="md"
              full={false}
              style={{ flex: 1 }}
              testID="request-accept"
              onPress={async () => {
                await respond.mutateAsync({ id: r.id, accept: true });
                haptic.success();
                router.push({ pathname: '/trip/start', params: { contactId: r.contactId, source: 'request' } });
              }}
            />
            <Button label="Decline" size="md" variant="secondary" full={false} style={{ flex: 1 }} onPress={() => respond.mutate({ id: r.id, accept: false })} testID="request-decline" />
          </View>
        </Card>
      ))}
      {headingOut ? (
        <Card tone="infoSoft" testID="heading-out-card">
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconTile icon="walk" tint="info" />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Looks like you're heading out</Text>
              <Text variant="caption" tone="muted">
                Left {headingOut.from}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button
              label="Notify when I arrive"
              size="md"
              full={false}
              style={{ flex: 1.4 }}
              onPress={() => {
                set({ headingOut: null });
                router.push({ pathname: '/trip/start', params: { source: 'heading_out' } });
              }}
            />
            <Button label="Not now" size="md" variant="secondary" full={false} style={{ flex: 1 }} onPress={() => set({ headingOut: null })} />
          </View>
        </Card>
      ) : null}
    </>
  );
}
