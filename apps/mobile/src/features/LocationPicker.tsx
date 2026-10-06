import { ACCRA, clampRadius, normalizeGhanaPostGps, ZONE_MAX_M, ZONE_MIN_M, type LatLng } from '@reached/core';
import { useState } from 'react';
import { View } from 'react-native';
import { useBackend } from '@/lib/backend';
import { currentPosition, searchAddress } from '@/lib/device/location';
import { errorMessage } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { Chip, ChipRow, Map, Slider, Text, TextField, useTheme } from '@/ui';

export interface PickedLocation extends LatLng {
  address: string | null;
  ghanaPostGps: string | null;
}

type Mode = 'current' | 'search' | 'gps' | 'map';

/**
 * Choose a point four ways: current location, address search, GhanaPost GPS
 * address, or tapping the map. Optionally shows the arrival-zone slider.
 */
export function LocationPicker({
  value,
  onChange,
  radius,
  onRadius,
  showZone = true,
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation) => void;
  radius?: number;
  onRadius?: (r: number) => void;
  showZone?: boolean;
}) {
  const t = useTheme();
  const b = useBackend();
  const here = useApp((s) => s.here);
  const [mode, setMode] = useState<Mode | null>(null);
  const [q, setQ] = useState('');
  const [gps, setGps] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCurrent = async () => {
    setMode('current');
    setBusy(true);
    setError(null);
    const p = here ?? (await currentPosition());
    setBusy(false);
    if (!p) return setError("We couldn't get your location. Turn on location or pick on the map.");
    onChange({ lat: p.lat, lng: p.lng, address: null, ghanaPostGps: null });
  };

  const search = async () => {
    setBusy(true);
    setError(null);
    const p = await searchAddress(q);
    setBusy(false);
    if (!p) return setError("We couldn't find that place. Try the map instead.");
    onChange({ ...p, address: q.trim(), ghanaPostGps: null });
  };

  const lookupGps = async () => {
    const code = normalizeGhanaPostGps(gps);
    if (!code) return setError('Enter a GhanaPost GPS address like GA-123-4567.');
    setBusy(true);
    setError(null);
    try {
      const r = await b.lookupGhanaPost(code);
      if (!r) setError(`We couldn't find ${code}. Check the address and try again.`);
      else onChange({ lat: r.lat, lng: r.lng, address: r.address, ghanaPostGps: code });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const center = value ?? here ?? ACCRA;
  return (
    <View style={{ gap: 14 }}>
      <ChipRow>
        <Chip label="Current location" icon="locate" selected={mode === 'current'} onPress={useCurrent} testID="loc-current" />
        <Chip label="Search" icon="search" selected={mode === 'search'} onPress={() => setMode('search')} testID="loc-search" />
        <Chip label="GhanaPost GPS" icon="grid" selected={mode === 'gps'} onPress={() => setMode('gps')} testID="loc-gps" />
        <Chip label="Pick on map" icon="map" selected={mode === 'map'} onPress={() => setMode('map')} testID="loc-map" />
      </ChipRow>
      {mode === 'search' ? (
        <TextField label="Address or landmark" value={q} onChangeText={setQ} placeholder="e.g. Accra Mall" returnKeyType="search" onSubmitEditing={search} testID="loc-search-input" />
      ) : null}
      {mode === 'gps' ? (
        <TextField
          label="GhanaPost GPS address"
          value={gps}
          onChangeText={setGps}
          autoCapitalize="characters"
          placeholder="GA-123-4567"
          returnKeyType="search"
          onSubmitEditing={lookupGps}
          testID="loc-gps-input"
          hint="Press enter to look it up"
        />
      ) : null}
      {error ? (
        <Text tone="danger" variant="caption" testID="loc-error">
          {error}
        </Text>
      ) : null}
      <Map
        center={center}
        zone={value && showZone ? { ...value, radius: radius ?? 150 } : null}
        markers={value ? [{ id: 'pick', label: 'Chosen place', kind: 'place', ...value }] : []}
        me={here}
        onPressMap={(p) => {
          setMode('map');
          onChange({ ...p, address: null, ghanaPostGps: null });
        }}
        style={{ height: 220, borderRadius: t.radius.lg }}
        testID="picker-map"
        accessibilityLabel={value ? 'Map with the chosen place. Tap to move the pin.' : 'Map. Tap to choose the place.'}
      />
      {busy ? (
        <Text variant="caption" tone="muted">
          Finding the place…
        </Text>
      ) : value ? (
        <Text variant="caption" tone="muted" testID="loc-chosen">
          {value.address ?? value.ghanaPostGps ?? 'Pinned on the map'}
        </Text>
      ) : null}
      {onRadius && radius !== undefined ? (
        <Slider
          label="Arrival zone"
          value={radius}
          min={ZONE_MIN_M}
          max={ZONE_MAX_M}
          step={25}
          onChange={(r) => onRadius(clampRadius(r))}
          format={(r) => `${r} m`}
          testID="zone-slider"
        />
      ) : null}
    </View>
  );
}
