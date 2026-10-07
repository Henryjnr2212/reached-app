import {
  alreadyAtDestination,
  DEFAULT_GRACE_MIN,
  estimateTravelMinutes,
  formatClock,
  formatDuration,
  GRACE_OPTIONS,
  MINUTE,
  NO_DESTINATION_CHECK_OPTIONS,
  renderCustom,
  renderSms,
  ZONE_DEFAULT_M,
  type LatLng,
} from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LocationPicker, type PickedLocation } from '@/features/LocationPicker';
import { MessageEditor } from '@/features/MessageEditor';
import { TripDetailsForm } from '@/features/TripDetailsForm';
import { backendNow, useBackend } from '@/lib/backend';
import type { TripDetails } from '@/lib/backend/types';
import { haptic } from '@/lib/device/haptics';
import { currentPosition } from '@/lib/device/location';
import { errorMessage, TRIP_KEYS, useContacts, useLiveTrip, usePlaces, useProfile } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import {
  BottomSheet,
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmSheet,
  Icon,
  IconButton,
  IconTile,
  Map,
  PLACE_ICONS,
  Screen,
  SectionTitle,
  Segmented,
  SwitchRow,
  Text,
  TextField,
  useTheme,
} from '@/ui';

interface Dest {
  placeId: string | null;
  name: string;
  point: LatLng | null;
  radius: number;
}

export default function StartTrip() {
  const t = useTheme();
  const b = useBackend();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ placeId?: string; contactId?: string; source?: 'heading_out' | 'request'; edit?: string }>();
  const profile = useProfile();
  const places = usePlaces();
  const contacts = useContacts();
  const live = useLiveTrip();
  const here = useApp((s) => s.here);
  const editing = params.edit === '1' && live.data ? live.data : null;

  const [dest, setDest] = useState<Dest | null>(null);
  const [notSure, setNotSure] = useState(false);
  const [query, setQuery] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [ids, setIds] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [perContact, setPerContact] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<string | 'all' | null>(null);
  const [tellLeaving, setTellLeaving] = useState(false);
  const [checkOnMe, setCheckOnMe] = useState(true);
  const [expected, setExpected] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [grace, setGrace] = useState<number>(DEFAULT_GRACE_MIN);
  const [details, setDetails] = useState<TripDetails>({});
  const [showDetails, setShowDetails] = useState(false);
  const [already, setAlready] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defaults once data arrives.
  useEffect(() => {
    if (ids === null && contacts.data) {
      const fromEdit = editing?.contactIds;
      const fromRequest = params.contactId ? [params.contactId] : null;
      setIds(fromEdit ?? fromRequest ?? contacts.data.filter((c) => c.isDefault && !c.optedOut).map((c) => c.id));
    }
  }, [contacts.data, ids, editing, params.contactId]);

  useEffect(() => {
    if (profile.data) setGrace(profile.data.graceMinutes);
  }, [profile.data]);

  useEffect(() => {
    if (dest || !places.data) return;
    if (editing) {
      setDest({ placeId: editing.placeId, name: editing.destName ?? 'Destination', point: editing.dest, radius: editing.radius });
      setDetails(editing);
      if (editing.expectedAt) setExpected(Date.parse(editing.expectedAt));
      return;
    }
    const p = params.placeId ? places.data.find((x) => x.id === params.placeId) : null;
    if (p) setDest({ placeId: p.id, name: p.name, point: { lat: p.lat, lng: p.lng }, radius: p.radius });
  }, [places.data, params.placeId, dest, editing]);

  // Expected arrival from a map estimate whenever the destination changes.
  const hereRef = useRef(here);
  hereRef.current = here;
  useEffect(() => {
    if (!dest?.point || editing) return;
    const from = hereRef.current;
    const mins = from ? estimateTravelMinutes(from, dest.point) : 30;
    setExpected(backendNow() + mins * MINUTE);
    setCheckOnMe(true);
  }, [dest, editing]);

  const name = profile.data?.firstName ?? 'You';
  const destName = dest?.name ?? 'your destination';
  const sample = { name, place: destName, time: formatClock(new Date(backendNow())) };
  const preview = message ? renderCustom(message, sample) : renderSms('arrived', sample);

  const filtered = useMemo(
    () => (places.data ?? []).filter((p) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [places.data, query],
  );

  const chosen = (contacts.data ?? []).filter((c) => ids?.includes(c.id));
  const expectedAt = checkOnMe ? (dest ? expected : backendNow() + duration * MINUTE) : null;

  const start = async (skipAlready = false) => {
    setError(null);
    if (!ids?.length) return setError('Choose at least one person to tell.');
    if (!dest && !notSure) return setError('Choose where you are going.');
    const pos = here ?? (await currentPosition());
    if (!skipAlready && dest?.point && alreadyAtDestination({ ...dest.point, radius: dest.radius }, pos)) {
      setAlready(true);
      return;
    }
    setBusy(true);
    try {
      if (editing) await b.cancelTrip(editing.id, false);
      const trip = await b.startTrip({
        placeId: dest?.placeId ?? null,
        destName: dest?.placeId ? null : (dest?.name ?? null),
        dest: dest?.placeId ? null : (dest?.point ?? null),
        radius: dest?.radius ?? ZONE_DEFAULT_M,
        contactIds: ids,
        message,
        contactMessages: perContact,
        tellLeaving,
        checkOnMe,
        expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
        graceMinutes: grace,
        here: pos,
        source: params.source ?? 'manual',
        ...(showDetails ? details : {}),
      });
      haptic.success();
      await Promise.all(TRIP_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
      router.replace({ pathname: '/trip/active', params: { id: trip.id } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const arriveNow = async () => {
    setAlready(false);
    setBusy(true);
    try {
      const trip = await b.startTrip({
        placeId: dest?.placeId ?? null,
        destName: dest?.placeId ? null : (dest?.name ?? null),
        dest: dest?.placeId ? null : (dest?.point ?? null),
        contactIds: ids ?? [],
        message,
        contactMessages: perContact,
        tellLeaving: false,
        checkOnMe: false,
        expectedAt: null,
        graceMinutes: grace,
      });
      await b.arriveTrip(trip.id, here, 'manual');
      await Promise.all(TRIP_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
      router.replace({ pathname: '/trip/arrived', params: { tripId: trip.id } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={editing ? 'Edit trip' : 'Start a trip'}
      testID="start-trip-screen"
      footer={
        <>
          {error ? (
            <Text tone="danger" variant="label" testID="start-error" accessibilityLiveRegion="assertive">
              {error}
            </Text>
          ) : null}
          <Button label={editing ? 'Save trip' : 'Start trip'} icon="navigate" variant="accent" onPress={() => start()} loading={busy} testID="start-trip-submit" />
        </>
      }
    >
      {/* Where to? */}
      <SectionTitle>Where to?</SectionTitle>
      {dest ? (
        <Card padded={false} testID="chosen-destination">
          {dest.point ? <Map center={dest.point} zone={{ ...dest.point, radius: dest.radius }} me={here} interactive={false} style={{ height: 140, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <IconTile icon="flag" />
            <View style={{ flex: 1 }}>
              <Text variant="headline">{dest.name}</Text>
              {dest.point && here ? (
                <Text variant="caption" tone="muted">
                  About {formatDuration(estimateTravelMinutes(here, dest.point))} away
                </Text>
              ) : null}
            </View>
            <IconButton icon="close" label="Change destination" tone="muted" size={40} onPress={() => setDest(null)} />
          </View>
        </Card>
      ) : notSure ? (
        <Card tone="muted">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon="help" tint="neutral" />
            <Text style={{ flex: 1 }}>No destination. We'll check on you after the time you choose.</Text>
            <IconButton icon="close" label="Choose a destination" tone="surface" size={40} onPress={() => setNotSure(false)} />
          </View>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          <TextField label="Search your places" value={query} onChangeText={setQuery} placeholder="Work, School, Mom's house…" testID="dest-search" />
          <Card padded={false}>
            {filtered.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                testID={`dest-${p.name}`}
                onPress={() => {
                  haptic.tap();
                  setDest({ placeId: p.id, name: p.name, point: { lat: p.lat, lng: p.lng }, radius: p.radius });
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56 }}
              >
                <IconTile icon={PLACE_ICONS[p.icon] ?? 'location'} size={40} />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {p.name}
                </Text>
                <Icon name="chevron-forward" size={18} color={t.colors.textSubtle} />
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setMapOpen(true)} testID="dest-pick-map" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56 }}>
              <IconTile icon="map" tint="info" size={40} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                Pick on map or GhanaPost GPS
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setNotSure(true)} testID="dest-not-sure" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56 }}>
              <IconTile icon="help" tint="neutral" size={40} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                I'm not sure yet
              </Text>
            </Pressable>
          </Card>
        </View>
      )}

      {/* Who to tell */}
      <SectionTitle>Who to tell</SectionTitle>
      <ChipRow>
        {(contacts.data ?? []).map((c) => {
          const on = !!ids?.includes(c.id);
          return (
            <Chip
              key={c.id}
              label={c.name}
              icon={on ? 'checkmark' : 'add'}
              selected={on}
              onPress={() => setIds((s) => (on ? (s ?? []).filter((x) => x !== c.id) : [...(s ?? []), c.id]))}
              testID={`tell-${c.name}`}
              accessibilityLabel={`${c.name}, ${on ? 'will be told' : 'not told'}`}
            />
          );
        })}
        <Chip label="Add" icon="person-add" onPress={() => router.push('/contact/new')} />
      </ChipRow>

      {/* Message */}
      <Card tone="muted">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="small" tone="muted">
            MESSAGE
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setEditor('all')} style={{ minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' }} testID="edit-message">
            <Text variant="label" tone="primary">
              Edit
            </Text>
          </Pressable>
        </View>
        <Text testID="trip-message-preview">{preview}</Text>
        {chosen.length > 1 ? (
          <ChipRow style={{ marginTop: 8 }}>
            {chosen.map((c) => (
              <Chip key={c.id} label={perContact[c.id] ? `${c.name} (custom)` : `For ${c.name}`} icon="create-outline" onPress={() => setEditor(c.id)} />
            ))}
          </ChipRow>
        ) : null}
      </Card>

      <Card padded={false}>
        <SwitchRow title="Tell them I'm leaving now" subtitle="Sends an 'on the way' text" value={tellLeaving} onChange={setTellLeaving} icon="paper-plane" testID="tell-leaving" />
        <SwitchRow title="Check on me if I'm late" subtitle="We ask if you're okay, then alert your emergency contacts" value={checkOnMe} onChange={setCheckOnMe} icon="time" tint="warning" testID="check-on-me" />
      </Card>

      {checkOnMe ? (
        <Card>
          {dest ? (
            <View style={{ gap: 10 }}>
              <Text variant="label">Expected arrival</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <IconButton icon="remove" label="5 minutes earlier" tone="muted" onPress={() => setExpected((e) => Math.max(backendNow() + 5 * MINUTE, (e ?? backendNow()) - 5 * MINUTE))} testID="expected-minus" />
                <Text variant="title" testID="expected-time">
                  {expected ? formatClock(new Date(expected)) : '--'}
                </Text>
                <IconButton icon="add" label="5 minutes later" tone="muted" onPress={() => setExpected((e) => (e ?? backendNow()) + 5 * MINUTE)} testID="expected-plus" />
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text variant="label">Check on me after</Text>
              <ChipRow scroll={false}>
                {NO_DESTINATION_CHECK_OPTIONS.map((m) => (
                  <Chip key={m} label={formatDuration(m)} selected={duration === m} onPress={() => setDuration(m)} />
                ))}
                <Chip label="+15 min" icon="add" onPress={() => setDuration((d) => d + 15)} />
              </ChipRow>
            </View>
          )}
          <View style={{ marginTop: 14 }}>
            <Segmented<number> label="Grace period" options={GRACE_OPTIONS.map((g) => ({ value: g, label: `${g} min` }))} value={grace} onChange={setGrace} />
          </View>
        </Card>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => setShowDetails((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }} testID="toggle-details">
        <Icon name={showDetails ? 'chevron-down' : 'chevron-forward'} size={18} color={t.colors.primary} />
        <Text variant="label" tone="primary">
          Add trip details (car, plate, ride link)
        </Text>
      </Pressable>
      {showDetails ? <TripDetailsForm value={details} onChange={setDetails} /> : null}

      <BottomSheet visible={mapOpen} onClose={() => setMapOpen(false)} title="Pick a destination">
        <View style={{ gap: 12 }}>
          <LocationPicker value={picked} onChange={setPicked} radius={ZONE_DEFAULT_M} />
          <Button
            label="Confirm"
            disabled={!picked}
            testID="dest-confirm"
            onPress={() => {
              if (!picked) return;
              setDest({ placeId: null, name: picked.address ?? picked.ghanaPostGps ?? 'Pinned place', point: picked, radius: ZONE_DEFAULT_M });
              setMapOpen(false);
            }}
          />
        </View>
      </BottomSheet>

      <MessageEditor
        visible={editor !== null}
        title={editor && editor !== 'all' ? `Message for ${contacts.data?.find((c) => c.id === editor)?.name ?? ''}` : 'Message for this trip'}
        value={editor && editor !== 'all' ? (perContact[editor] ?? message) : message}
        sample={sample}
        onClose={() => setEditor(null)}
        onSave={(v) => {
          if (editor === 'all') setMessage(v);
          else if (editor) setPerContact((m) => {
            const next = { ...m };
            if (v) next[editor] = v;
            else delete next[editor];
            return next;
          });
          setEditor(null);
        }}
      />

      <ConfirmSheet
        visible={already}
        title={`You're already at ${destName}`}
        body="Send arrival now?"
        confirmLabel="Send"
        cancelLabel="Cancel"
        onConfirm={arriveNow}
        onCancel={() => setAlready(false)}
        loading={busy}
      />
    </Screen>
  );
}
