import { eventTitle, FEEDBACK_OPTIONS, formatClock } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { eventStatus } from '@/features/EventRow';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, keys, TRIP_KEYS, useEvent } from '@/lib/hooks/queries';
import { Avatar, BottomSheet, Button, Card, EmptyState, ListRow, Map, Screen, SectionTitle, SkeletonList, StatusPill, Text, useTheme, useToast } from '@/ui';

const TONE = { pending: 'neutral', sending: 'neutral', held: 'warning', sent: 'info', delivered: 'success', failed: 'danger', opted_out: 'danger', cancelled: 'neutral' } as const;
const LABEL = { pending: 'Sending', sending: 'Sending', held: 'Waiting', sent: 'Sent', delivered: 'Delivered', failed: 'Failed', opted_out: 'Opted out', cancelled: 'Not sent' } as const;

export default function EventDetail() {
  const t = useTheme();
  const b = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ev = useEvent(id);
  const [feedback, setFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = ev.data;

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keys.event(id) }), ...TRIP_KEYS.map((k) => qc.invalidateQueries({ queryKey: k }))]);

  if (!e) {
    return <Screen title="Details">{ev.isLoading ? <SkeletonList /> : <EmptyState icon="pulse" title="Not found" body="This activity may have been deleted." />}</Screen>;
  }
  const status = eventStatus(e);

  return (
    <Screen title="Details" testID="event-detail">
      {e.point ? (
        <Map center={e.point} markers={[{ id: 'pt', label: 'Detected here', kind: 'alert', ...e.point }]} interactive={false} style={{ height: 180, borderRadius: t.radius.lg }} />
      ) : null}
      <View style={{ gap: 6 }}>
        {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
        <Text variant="title">{eventTitle(e.kind, e.placeName)}</Text>
        <Text tone="muted">{`${new Date(e.createdAt).toDateString()} · ${formatClock(new Date(e.createdAt))}`}</Text>
      </View>
      {e.status === 'pending_confirmation' ? (
        <Card tone="warningSoft">
          <Text variant="bodyStrong">Send this now?</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button
              label="Send"
              size="md"
              full={false}
              style={{ flex: 1 }}
              testID="confirm-send"
              onPress={async () => {
                await b.confirmEvent(e.id, true);
                haptic.success();
                await refresh();
              }}
            />
            <Button
              label="Not now"
              size="md"
              variant="secondary"
              full={false}
              style={{ flex: 1 }}
              onPress={async () => {
                await b.confirmEvent(e.id, false);
                await refresh();
              }}
            />
          </View>
        </Card>
      ) : null}
      {e.previewBody ? (
        <Card tone="muted">
          <Text variant="small" tone="muted">
            EXACT MESSAGE
          </Text>
          <Text style={{ marginTop: 4 }} testID="event-body" selectable>
            {e.previewBody}
          </Text>
        </Card>
      ) : null}
      <SectionTitle>Who was told</SectionTitle>
      <Card padded={false}>
        {e.messages.length ? (
          e.messages.map((m) => (
            <View key={m.id} style={{ padding: 14, gap: 8 }} testID={`message-${m.contactName}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
              {m.status === 'failed' ? (
                <Button
                  label="Resend"
                  icon="refresh"
                  size="md"
                  variant="secondary"
                  testID={`resend-${m.contactName}`}
                  onPress={async () => {
                    setError(null);
                    try {
                      await b.resendMessage(m.id);
                      toast('Sending again');
                      await refresh();
                    } catch (err) {
                      setError(errorMessage(err));
                    }
                  }}
                />
              ) : null}
            </View>
          ))
        ) : (
          <ListRow title="Nobody was told" icon="information-circle" tint="neutral" />
        )}
      </Card>
      {error ? <Text tone="danger">{error}</Text> : null}
      {e.kind === 'arrival' || e.kind === 'departure' ? (
        e.feedback ? (
          <Text tone="muted" variant="caption">
            Thanks. We use this to improve arrival detection.
          </Text>
        ) : (
          <Button label="This wasn't right" variant="ghost" icon="flag-outline" onPress={() => setFeedback(true)} testID="wasnt-right" />
        )
      ) : null}
      <BottomSheet visible={feedback} onClose={() => setFeedback(false)} title="What went wrong?">
        <View style={{ gap: 10 }}>
          {FEEDBACK_OPTIONS.map((f) => (
            <Button
              key={f.key}
              label={f.label}
              variant="secondary"
              onPress={async () => {
                await b.eventFeedback(e.id, f.key);
                setFeedback(false);
                toast('Thanks for telling us');
                await refresh();
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}
