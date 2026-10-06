import { SOS_SHARE_INTERVAL_S, toldWho } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmergencyNumbers } from '@/features/EmergencyNumbers';
import { ImSafeButton } from '@/features/ImSafeButton';
import { liveUrl } from '@/features/links';
import { useBackend } from '@/lib/backend';
import { batteryPercent } from '@/lib/device/battery';
import { haptic } from '@/lib/device/haptics';
import { currentPosition } from '@/lib/device/location';
import { errorMessage, TRIP_KEYS, useEvents, useOpenSos, useProfile } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { Avatar, Button, Card, Icon, SectionTitle, StatusPill, Text, useTheme } from '@/ui';

const LABEL = { pending: 'Sending', sending: 'Sending', held: 'Waiting', sent: 'Sent', delivered: 'Delivered', failed: 'Failed', opted_out: 'Opted out', cancelled: 'Not sent' } as const;
const TONE = { pending: 'neutral', sending: 'neutral', held: 'warning', sent: 'info', delivered: 'success', failed: 'danger', opted_out: 'danger', cancelled: 'neutral' } as const;

/** Countdown with a big Cancel, then who was alerted, emergency numbers and "I'm safe now". */
export default function Sos() {
  const t = useTheme();
  const b = useBackend();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const sos = useOpenSos();
  const events = useEvents();
  const here = useApp((s) => s.here);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  // Start the countdown once we know there's no open alert.
  useEffect(() => {
    if (sos.isLoading || count !== null || sos.data) return;
    setCount(profile.data?.sosCountdownSeconds ?? 5);
  }, [sos.isLoading, sos.data, count, profile.data]);

  useEffect(() => {
    if (count === null || sos.data) return;
    if (count <= 0) {
      if (sending.current) return;
      sending.current = true;
      haptic.heavy();
      void (async () => {
        try {
          const at = here ?? (await currentPosition());
          await b.triggerSos(at, await batteryPercent(), 'shield');
          await Promise.all(TRIP_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
        } catch (e) {
          setError(errorMessage(e));
          sending.current = false;
        }
      })();
      return;
    }
    haptic.tap();
    const id = setTimeout(() => setCount((c) => (c === null ? c : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [count, sos.data, b, here, qc]);

  // Share location every 30 s until "I'm safe now".
  const alert = sos.data;
  useEffect(() => {
    if (!alert) return;
    const ping = async () => {
      const p = useApp.getState().here ?? (await currentPosition());
      if (p) await b.sosPing(alert.id, p, await batteryPercent()).catch(() => undefined);
    };
    const id = setInterval(() => void ping(), SOS_SHARE_INTERVAL_S * 1000);
    return () => clearInterval(id);
  }, [alert, b]);

  if (!alert) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.danger, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, justifyContent: 'space-between' }} testID="sos-countdown">
        <View style={{ alignItems: 'center', gap: 16 }}>
          <Text variant="title" tone="onDanger" center>
            Sending SOS to your emergency contacts
          </Text>
          <View style={{ width: 180, height: 180, borderRadius: 90, borderWidth: 6, borderColor: t.colors.onDanger, alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="assertive">
            <Text tone="onDanger" style={{ fontSize: 72, lineHeight: 80, fontFamily: t.type.display.fontFamily }} testID="sos-count">
              {count ?? ''}
            </Text>
          </View>
          <Text tone="onDanger" center>
            They'll get your location and a link to follow you.
          </Text>
          {error ? (
            <Text tone="onDanger" center>
              {error}
            </Text>
          ) : null}
        </View>
        <Button
          label="Cancel"
          variant="secondary"
          testID="sos-cancel"
          onPress={() => {
            setCount(null);
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          style={{ minHeight: 72 }}
        />
      </View>
    );
  }

  const ev = (events.data ?? []).find((e) => e.kind === 'sos' || e.kind === 'overdue_alert');
  const names = [...new Set((ev?.messages ?? []).map((m) => m.contactName))];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 16 }} testID="sos-sent">
      <View style={{ alignItems: 'center', gap: 12 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="warning" size={44} color={t.colors.onDanger} />
        </View>
        <Text variant="display" center accessibilityRole="header">
          SOS sent
        </Text>
        <Text tone="muted" center>
          {names.length ? `${toldWho(names)} ${names.length === 1 ? 'has' : 'have'} your location.` : 'Alerting your emergency contacts.'} We share your location every 30 seconds until you say you're safe.
        </Text>
      </View>
      {ev ? (
        <Card padded={false}>
          {ev.messages.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Avatar name={m.contactName} size={40} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {m.contactName}
              </Text>
              <StatusPill label={LABEL[m.status]} tone={TONE[m.status]} />
            </View>
          ))}
        </Card>
      ) : null}
      <ImSafeButton />
      <Button label="Share live location" icon="share-social" variant="secondary" onPress={() => void Share.share({ message: `I need help. Follow my location: ${liveUrl(alert.liveToken)}` })} />
      <SectionTitle>Call for help</SectionTitle>
      <EmergencyNumbers />
    </ScrollView>
  );
}
