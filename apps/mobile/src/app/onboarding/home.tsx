import { startAtHome } from '@/lib/nav';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { EVERY_DAY, ZONE_DEFAULT_M } from '@reached/core';
import { LocationPicker, type PickedLocation } from '@/features/LocationPicker';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, useContacts } from '@/lib/hooks/queries';
import { Button, Card, Screen, SwitchRow, Text } from '@/ui';

/** "Where's home?" — the last onboarding step; ends on Home. */
export default function HomePlace() {
  const b = useBackend();
  const qc = useQueryClient();
  const contacts = useContacts();
  const first = contacts.data?.[0];
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (save: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (save && loc) {
        const place = await b.addPlace({ name: 'Home', icon: 'home', lat: loc.lat, lng: loc.lng, radius: ZONE_DEFAULT_M, address: loc.address, ghanaPostGps: loc.ghanaPostGps });
        if (tell && first) {
          await b.saveRule({ placeId: place.id, event: 'arrive', contactIds: [first.id], days: EVERY_DAY, windowStart: null, windowEnd: null, message: null, enabled: true });
        }
      }
      await b.updateProfile({ onboardedAt: new Date().toISOString() });
      haptic.success();
      await qc.invalidateQueries();
      startAtHome();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title=""
      back={false}
      testID="home-place"
      footer={
        <View style={{ gap: 10 }}>
          <Button label="Done" onPress={() => finish(true)} disabled={!loc} loading={busy} testID="home-done" />
          <Button label="Skip" variant="ghost" onPress={() => finish(false)} testID="home-skip" />
        </View>
      }
    >
      <View style={{ gap: 8 }}>
        <Text variant="display" accessibilityRole="header">
          Where's home?
        </Text>
        <Text tone="muted">We'll tell your people when you get home safely.</Text>
      </View>
      <LocationPicker value={loc} onChange={setLoc} radius={ZONE_DEFAULT_M} />
      {loc && first ? (
        <Card padded={false}>
          <SwitchRow title={`Tell ${first.name} when you get home?`} value={tell} onChange={setTell} icon="home" testID="home-tell" />
        </Card>
      ) : null}
      {error ? <Text tone="danger">{error}</Text> : null}
    </Screen>
  );
}
