import { toldWho } from '@reached/core';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents } from '@/lib/hooks/queries';
import { Avatar, Button, Card, Icon, SkeletonList, StatusPill, Text, useTheme } from '@/ui';

const TONE = { pending: 'neutral', sending: 'neutral', held: 'warning', sent: 'info', delivered: 'success', failed: 'danger', opted_out: 'danger', cancelled: 'neutral' } as const;
const LABEL = { pending: 'Sending', sending: 'Sending', held: 'Waiting for you', sent: 'Sent', delivered: 'Delivered', failed: 'Failed', opted_out: 'Opted out', cancelled: 'Not sent' } as const;

/** Tick, "Mom has been told", per-contact Sending → Sent → Delivered. */
export default function Arrived() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { tripId, eventId } = useLocalSearchParams<{ tripId?: string; eventId?: string }>();
  const events = useEvents();
  const event = (events.data ?? []).find((e) => (eventId ? e.id === eventId : e.kind === 'arrival' && e.tripId === tripId));
  const names = [...new Set((event?.messages ?? []).map((m) => m.contactName))];
  const held = event?.status === 'pending_confirmation';
  return (
    <View testID="arrived-screen" style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 20, paddingHorizontal: 20, gap: 24 }}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="checkmark" size={48} color={t.colors.onPrimary} />
          </View>
        </View>
        <Text variant="display" center accessibilityRole="header">
          You've reached{event?.placeName ? ` ${event.placeName}` : ''}
        </Text>
        <Text tone="muted" center testID="arrived-told">
          {!event ? 'Telling your people…' : held ? 'Waiting for you to send.' : names.length ? `${toldWho(names)} ${names.length === 1 ? 'has' : 'have'} been told.` : 'Nobody was told.'}
        </Text>
      </View>
      {!event ? (
        <SkeletonList rows={2} />
      ) : (
        <Card padded={false}>
          {event.messages.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56 }} testID={`delivery-${m.contactName}`}>
              <Avatar name={m.contactName} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{m.contactName}</Text>
                <Text variant="caption" tone="muted">
                  {m.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                  {m.failureReason ? ` · ${m.failureReason}` : ''}
                </Text>
              </View>
              <StatusPill label={LABEL[m.status]} tone={TONE[m.status]} />
            </View>
          ))}
        </Card>
      )}
      <View style={{ flex: 1 }} />
      {event ? <Button label="See details" variant="ghost" onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })} /> : null}
      <Button label="Done" variant="accent" onPress={() => router.replace('/(tabs)')} testID="arrived-done" />
    </View>
  );
}
