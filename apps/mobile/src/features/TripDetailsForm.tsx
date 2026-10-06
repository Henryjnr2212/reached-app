import { normalizePlate, parseRideLink, TRANSPORT_TYPES, type TransportType } from '@reached/core';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, View } from 'react-native';
import type { TripDetails } from '@/lib/backend/types';
import { recognizeDriverCard } from '@/lib/device/ocr';
import { Button, Chip, ChipRow, Text, TextField, useTheme } from '@/ui';

/**
 * Phase 2 trip details. Only shared with emergency contacts if something
 * goes wrong. Ride apps have no public API, so details come from a shared
 * trip link, a screenshot of the driver card (read on the phone), or typing.
 */
export function TripDetailsForm({ value, onChange }: { value: TripDetails; onChange: (v: TripDetails) => void }) {
  const t = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const set = (patch: Partial<TripDetails>) => onChange({ ...value, ...patch });

  const pasteLink = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    const link = parseRideLink(text);
    if (!link) return setNote('Copy the trip link from Uber, Bolt or Yango first ("Share trip status").');
    set({ transportType: 'ride_hailing', rideProvider: link.provider, rideLink: link.url });
    setNote(`Added your ${link.provider[0]!.toUpperCase()}${link.provider.slice(1)} trip link.`);
  };

  const fromScreenshot = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled || !r.assets[0]) return;
    const card = await recognizeDriverCard(r.assets[0].uri);
    if (!card) return setNote("We couldn't read that screenshot. Type the details instead.");
    set({ transportType: 'ride_hailing', plate: card.plate ?? value.plate, driverName: card.driverName ?? value.driverName, car: card.car ?? value.car });
    setNote('Check the details we read from your screenshot.');
  };

  const platePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync().catch(() => ({ granted: false }));
    const r = perm.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!r.canceled && r.assets[0]) set({ platePhotoUri: r.assets[0].uri });
  };

  return (
    <View style={{ gap: 14 }} testID="trip-details">
      <Text variant="caption" tone="muted">
        Only shared if something goes wrong.
      </Text>
      <ChipRow>
        {TRANSPORT_TYPES.map((tt) => (
          <Chip key={tt.key} label={tt.label} selected={value.transportType === tt.key} onPress={() => set({ transportType: tt.key as TransportType })} testID={`transport-${tt.key}`} />
        ))}
      </ChipRow>
      {value.transportType === 'ride_hailing' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Paste trip link" icon="link" size="md" variant="secondary" full={false} style={{ flex: 1 }} onPress={pasteLink} testID="paste-ride-link" />
          <Button label="From screenshot" icon="image" size="md" variant="secondary" full={false} style={{ flex: 1 }} onPress={fromScreenshot} />
        </View>
      ) : null}
      {note ? (
        <Text variant="caption" tone="primary" testID="trip-details-note">
          {note}
        </Text>
      ) : null}
      <TextField
        label="Number plate"
        value={value.plate ?? ''}
        onChangeText={(v) => set({ plate: v })}
        onBlur={() => set({ plate: value.plate ? (normalizePlate(value.plate) ?? value.plate) : null })}
        autoCapitalize="characters"
        placeholder="GR 1234-23"
        testID="trip-plate"
      />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {value.platePhotoUri ? <Image source={{ uri: value.platePhotoUri }} style={{ width: 64, height: 48, borderRadius: 10, backgroundColor: t.colors.surfaceMuted }} /> : null}
        <Button label={value.platePhotoUri ? 'Retake plate photo' : 'Photo of the plate'} icon="camera" size="md" variant="secondary" full={false} onPress={platePhoto} />
      </View>
      <TextField label="Driver's name" value={value.driverName ?? ''} onChangeText={(v) => set({ driverName: v })} autoCapitalize="words" />
      <TextField label="Car" value={value.car ?? ''} onChangeText={(v) => set({ car: v })} placeholder="Silver Toyota Corolla" />
    </View>
  );
}
