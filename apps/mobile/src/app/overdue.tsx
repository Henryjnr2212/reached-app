import { goHome } from '@/lib/nav';
import { formatClock, formatDuration, MORE_TIME_OPTIONS, overdueSecondsLeft, toldWho } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmergencyNumbers } from '@/features/EmergencyNumbers';
import { ImSafeButton } from '@/features/ImSafeButton';
import { backendNow, useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, TRIP_KEYS, useContacts, useLiveTrip, useOpenSos } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { Button, Icon, Text, useTheme } from '@/ui';

type Step = 'ask' | 'arrived?' | 'time';

export default function Overdue() {
  const t = useTheme();
  const b = useBackend();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const trip = useLiveTrip();
  const sos = useOpenSos();
  const contacts = useContacts();
  const here = useApp((s) => s.here);
  const [step, setStep] = useState<Step>('ask');
  const [now, setNow] = useState(backendNow());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(backendNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const tr = trip.data;
  useEffect(() => {
    if (trip.isLoading || sos.isLoading || leaving.current) return;
    if (!tr && sos.data) router.replace('/sos');
    else if (!tr || (tr.status !== 'overdue' && tr.status !== 'alerted')) {
      if (router.canGoBack()) router.back();
      else goHome();
    }
  }, [tr, sos.data, trip.isLoading, sos.isLoading]);

  if (!tr) return <View style={{ flex: 1, backgroundColor: t.colors.background }} />;

  const run = async (key: string, fn: () => Promise<{ eventId?: string; sosId?: string } | unknown>, after: () => void) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      leaving.current = true;
      after();
      await Promise.all(TRIP_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const alerted = tr.status === 'alerted';
  const left = tr.overduePromptedAt ? overdueSecondsLeft(Date.parse(tr.overduePromptedAt), now) : 300;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const emergency = (contacts.data ?? []).filter((c) => c.isEmergency).map((c) => c.name);
  const bg = t.colors.dangerSoft;

  return (
    <View style={{ flex: 1, backgroundColor: bg }} testID="overdue-screen">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={alerted ? 'warning' : 'help'} size={48} color={t.colors.onDanger} />
          </View>
          <Text variant="display" center accessibilityRole="header" style={{ color: t.colors.onDangerSoft }} testID="overdue-title">
            {alerted ? 'Alert sent to your contacts' : 'Are you okay?'}
          </Text>
          <Text center style={{ color: t.colors.onDangerSoft }}>
            {alerted
              ? `${toldWho(emergency)} ${emergency.length === 1 ? 'has' : 'have'} your last location. Let them know you're safe.`
              : `You haven't reached ${tr.destName ?? 'your destination'}${tr.expectedAt ? ` (due ${formatClock(new Date(tr.expectedAt))})` : ''}.`}
          </Text>
          {!alerted ? (
            <View style={{ backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }} accessibilityLiveRegion="polite">
              <Text variant="headline" testID="overdue-countdown">
                {`We'll alert your contacts in ${mm}:${ss}`}
              </Text>
            </View>
          ) : null}
        </View>

        {error ? <Text tone="danger">{error}</Text> : null}

        {alerted ? (
          <>
            <ImSafeButton />
            <EmergencyNumbers />
          </>
        ) : step === 'ask' ? (
          <View style={{ gap: 10 }}>
            <Button label="I'm okay" icon="happy" onPress={() => setStep('arrived?')} testID="im-okay" />
            <Button label="Need more time" icon="time" variant="secondary" onPress={() => setStep('time')} testID="more-time" />
            <Button
              label="Get help"
              icon="warning"
              variant="danger"
              loading={busy === 'help'}
              testID="get-help"
              onPress={() => {
                haptic.heavy();
                void run('help', () => b.respondOverdue(tr.id, 'get_help'), () => router.replace('/sos'));
              }}
            />
          </View>
        ) : step === 'arrived?' ? (
          <View style={{ gap: 10 }}>
            <Text variant="title" center style={{ color: t.colors.onDangerSoft }}>
              Have you arrived?
            </Text>
            <Button
              label="Yes, I've arrived"
              icon="checkmark-circle"
              loading={busy === 'arrived'}
              testID="overdue-arrived"
              onPress={() =>
                void run(
                  'arrived',
                  async () => {
                    if (here) await b.checkin(tr.id, here).catch(() => undefined);
                    return b.respondOverdue(tr.id, 'arrived');
                  },
                  () => router.replace({ pathname: '/trip/arrived', params: { tripId: tr.id } }),
                )
              }
            />
            <Button
              label="Still on the way"
              variant="secondary"
              loading={busy === 'going'}
              testID="still-going"
              onPress={() => void run('going', () => b.respondOverdue(tr.id, 'still_going'), () => router.dismissTo('/trip/active'))}
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {MORE_TIME_OPTIONS.map((m) => (
              <Button
                key={m}
                label={`+${formatDuration(m)}`}
                variant="secondary"
                loading={busy === `t${m}`}
                testID={`more-${m}`}
                onPress={() => void run(`t${m}`, () => b.respondOverdue(tr.id, 'more_time', m), () => router.dismissTo('/trip/active'))}
              />
            ))}
            <Button label="Back" variant="ghost" onPress={() => setStep('ask')} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
