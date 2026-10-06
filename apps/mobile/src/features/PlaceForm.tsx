import { canAdd, ZONE_DEFAULT_M } from '@reached/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Place } from '@/lib/backend/types';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, keys, useAction, usePlaces, useProfile } from '@/lib/hooks/queries';
import { Banner, Button, Chip, ChipRow, Icon, PLACE_ICONS, Screen, SectionTitle, Text, TextField, useTheme } from '@/ui';
import { LocationPicker, type PickedLocation } from './LocationPicker';

const QUICK = [
  { name: 'Home', icon: 'home' },
  { name: 'Work', icon: 'work' },
  { name: 'School', icon: 'school' },
  { name: 'Church', icon: 'church' },
  { name: 'Gym', icon: 'gym' },
  { name: "Mom's house", icon: 'family' },
];

/** Add / edit place: quick-pick names, icon, location and the arrival zone. */
export function PlaceForm({ place, initial }: { place?: Place; initial?: { name: string; lat: number; lng: number } }) {
  const t = useTheme();
  const places = usePlaces();
  const profile = useProfile();
  const [name, setName] = useState(place?.name ?? initial?.name ?? '');
  const [icon, setIcon] = useState(place?.icon ?? 'pin');
  const [loc, setLoc] = useState<PickedLocation | null>(
    place
      ? { lat: place.lat, lng: place.lng, address: place.address, ghanaPostGps: place.ghanaPostGps }
      : initial
        ? { lat: initial.lat, lng: initial.lng, address: initial.name, ghanaPostGps: null }
        : null,
  );
  const [radius, setRadius] = useState(place?.radius ?? ZONE_DEFAULT_M);
  const [nameError, setNameError] = useState<string | null>(null);
  const save = useAction(
    async (b, _: void) => {
      const input = { name: name.trim(), icon, lat: loc!.lat, lng: loc!.lng, radius, address: loc!.address, ghanaPostGps: loc!.ghanaPostGps };
      return place ? b.updatePlace(place.id, input) : b.addPlace(input);
    },
    [keys.places, keys.rules],
  );
  const full = !place && !canAdd('place', places.data?.length ?? 0, profile.data?.plan ?? 'free');

  const submit = async () => {
    if (!name.trim()) return setNameError('Give this place a name.');
    const saved = await save.mutateAsync().catch(() => null);
    if (!saved) return;
    haptic.success();
    if (place) router.back();
    else router.replace({ pathname: '/place/[id]', params: { id: saved.id, created: '1' } });
  };

  return (
    <Screen
      title={place ? 'Edit place' : 'Add place'}
      testID="place-form"
      footer={<Button label="Save" onPress={submit} disabled={!loc || full} loading={save.isPending} testID="place-save" />}
    >
      {full ? <Banner tone="warning" icon="lock-closed" title="You've reached the place limit" body="Upgrade to Premium for up to 15 places." actionLabel="See plans" onAction={() => router.push('/settings/plan')} /> : null}
      <ChipRow>
        {QUICK.map((q) => (
          <Chip
            key={q.name}
            label={q.name}
            icon={PLACE_ICONS[q.icon]}
            selected={name === q.name}
            onPress={() => {
              setName(q.name);
              setIcon(q.icon);
              setNameError(null);
            }}
            testID={`quick-name-${q.name}`}
          />
        ))}
      </ChipRow>
      <TextField
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setNameError(null);
        }}
        placeholder="e.g. Auntie's shop"
        maxLength={40}
        error={nameError}
        testID="place-name"
      />
      <SectionTitle>Icon</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {Object.entries(PLACE_ICONS).map(([key, ic]) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ selected: icon === key }}
            accessibilityLabel={key}
            onPress={() => setIcon(key)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: icon === key ? t.colors.primary : t.colors.surface,
              borderWidth: 1,
              borderColor: icon === key ? t.colors.primary : t.colors.border,
            }}
          >
            <Icon name={ic} size={22} color={icon === key ? t.colors.onPrimary : t.colors.text} />
          </Pressable>
        ))}
      </View>
      <SectionTitle>Location</SectionTitle>
      <LocationPicker value={loc} onChange={setLoc} radius={radius} onRadius={setRadius} />
      <Text variant="caption" tone="muted">
        Arrival counts once you've stayed inside the zone for a minute and a half, so passing by in traffic doesn't.
      </Text>
      {save.error ? <Text tone="danger">{errorMessage(save.error)}</Text> : null}
    </Screen>
  );
}
