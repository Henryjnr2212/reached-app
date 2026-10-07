import { goHome } from '@/lib/nav';
import { ACCRA, formatDuration, RUNNING_LATE_OPTIONS, toldWho } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tripStatusLine } from '@/features/ActiveTripCard';
import { liveUrl } from '@/features/links';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, TRIP_KEYS, useContacts, useLiveTrip, useProfile } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { BottomSheet, Button, Chip, ChipRow, IconButton, Map, SkeletonList, SosShield, StatusPill, SwitchRow, Text, useTheme } from '@/ui';

export default function ActiveTrip() {
  const t = useTheme();
  const b = useBackend();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const trip = useLiveTrip();
  const contacts = useContacts();
  const profile = useProfile();
  const here = useApp((s) => s.here);
  const [late, setLate] = useState(false);
  const [lateMin, setLateMin] = useState<number>(15);
  const [tellLate, setTellLate] = useState(true);
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tr = trip.data;
  // Only when this screen is on top: an arrival or SOS pushed above it handles navigation itself.
  const focused = useIsFocused();
  useEffect(() => {
    if (focused && !trip.isLoading && !tr) goHome();
  }, [focused, trip.isLoading, tr]);

  if (!tr) {
    return (
      <View style={{ flex: 1, padding: 20, paddingTop: insets.top + 20, backgroundColor: t.colors.background }}>
        <SkeletonList rows={3} />
      </View>
    );
  }

  const names = (contacts.data ?? []).filter((c) => tr.contactIds.includes(c.id)).map((c) => c.name);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await Promise.all(TRIP_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const arrived = async () => {
    haptic.success();
    if (await run('arrive', () => b.arriveTrip(tr.id, here, 'manual'))) router.replace({ pathname: '/trip/arrived', params: { tripId: tr.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }} testID="active-trip">
      <Map
        center={tr.dest ?? here ?? ACCRA}
        span={2500}
        zone={tr.dest ? { ...tr.dest, radius: tr.radius } : null}
        markers={tr.dest ? [{ id: 'dest', label: tr.destName ?? 'Destination', kind: 'destination', ...tr.dest }] : []}
        me={here ?? tr.last}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityLabel="Map with your position and destination"
      />
      <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : goHome())} testID="back" />
        <SosShield onTrigger={() => router.push('/sos')} holdSeconds={profile.data?.sosHoldSeconds} />
      </View>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: t.colors.surface,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          padding: 20,
          paddingBottom: insets.bottom + 20,
          gap: 14,
          ...t.shadow,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.colors.border }} />
        <View style={{ gap: 4 }}>
          <StatusPill label={tr.status === 'active' ? 'Trip in progress' : 'Needs you'} tone={tr.status === 'active' ? 'success' : 'danger'} />
          <Text variant="title" testID="trip-dest">
            {tr.destName ?? 'Trip in progress'}
          </Text>
          <Text tone="muted" testID="trip-status">
            {tripStatusLine(tr)}
          </Text>
          <Text variant="caption" tone="muted">
            {names.length ? `${toldWho(names)} will be told when you arrive` : 'Nobody will be told'}
          </Text>
        </View>
        {error ? (
          <Text tone="danger" variant="label">
            {error}
          </Text>
        ) : null}
        <Button label="I've arrived" icon="checkmark-circle" onPress={arrived} loading={busy === 'arrive'} testID="arrived-button" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Running late" icon="time" variant="secondary" size="md" full={false} style={{ flex: 1 }} onPress={() => setLate(true)} testID="running-late" />
          <Button
            label="Share live"
            icon="share-social"
            variant="secondary"
            size="md"
            full={false}
            style={{ flex: 1 }}
            onPress={() => void Share.share({ message: `Follow my trip on Reached: ${liveUrl(tr.liveToken)}` })}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Edit trip" variant="ghost" size="md" full={false} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/trip/start', params: { edit: '1' } })} />
          <Button label="Cancel trip" variant="ghost" size="md" full={false} style={{ flex: 1 }} onPress={() => setCancel(true)} testID="cancel-trip" />
        </View>
      </View>

      <BottomSheet visible={late} onClose={() => setLate(false)} title="Running late" testID="late-sheet">
        <View style={{ gap: 14 }}>
          <ChipRow scroll={false}>
            {RUNNING_LATE_OPTIONS.map((m) => (
              <Chip key={m} label={`+${formatDuration(m)}`} selected={lateMin === m} onPress={() => setLateMin(m)} testID={`late-${m}`} />
            ))}
            <Chip label="+2 hr" selected={lateMin === 120} onPress={() => setLateMin(120)} />
          </ChipRow>
          <SwitchRow title="Tell them I'm running late" value={tellLate} onChange={setTellLate} icon="chatbubble" />
          <Button
            label="Update time"
            loading={busy === 'late'}
            testID="late-confirm"
            onPress={async () => {
              if (await run('late', () => b.extendTrip(tr.id, lateMin, tellLate))) setLate(false);
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={cancel} onClose={() => setCancel(false)} title="Cancel this trip?" testID="cancel-sheet">
        <View style={{ gap: 10 }}>
          <Button
            label="Cancel quietly"
            variant="secondary"
            loading={busy === 'quiet'}
            testID="cancel-quietly"
            onPress={async () => {
              if (await run('quiet', () => b.cancelTrip(tr.id, false))) goHome();
            }}
          />
          <Button
            label="Cancel and tell them plans changed"
            variant="dangerSoft"
            loading={busy === 'tell'}
            testID="cancel-tell"
            onPress={async () => {
              if (await run('tell', () => b.cancelTrip(tr.id, true))) goHome();
            }}
          />
          <Button label="Keep trip" variant="ghost" onPress={() => setCancel(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}
