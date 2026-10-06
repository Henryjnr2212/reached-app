import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Hero } from '@/features/Hero';
import { getLocationAccess, requestBackgroundLocation, requestForegroundLocation } from '@/lib/device/location';
import { useApp } from '@/lib/store';
import { Button, Screen, Text } from '@/ui';

export default function LocationExplainer() {
  const set = useApp((s) => s.set);
  const [step, setStep] = useState<'foreground' | 'background'>('foreground');
  const next = () => router.replace('/onboarding/notifications');

  const allow = async () => {
    if (step === 'foreground') {
      const ok = await requestForegroundLocation();
      set({ location: await getLocationAccess() });
      if (!ok) return next();
      if (Platform.OS === 'web') return next();
      setStep('background');
      return;
    }
    const ok = await requestBackgroundLocation();
    set({ location: await getLocationAccess() });
    if (!ok) await Linking.openSettings();
    next();
  };

  return (
    <Screen
      title=""
      back={false}
      testID="location-explainer"
      footer={
        <View style={{ gap: 10 }}>
          <Button label={step === 'foreground' ? 'Allow location' : 'Open settings'} icon="location" onPress={allow} testID="allow-location" />
          <Button label="Not now" variant="ghost" onPress={next} testID="location-not-now" />
        </View>
      }
    >
      <Hero icon={step === 'foreground' ? 'navigate' : 'time'} badges={['home', 'checkmark-circle']} height={240} />
      {step === 'foreground' ? (
        <View style={{ gap: 8 }}>
          <Text variant="display" accessibilityRole="header">
            Know when you arrive
          </Text>
          <Text tone="muted">Reached needs your location to know when you arrive. We never sell it, and trip locations are deleted after 30 days.</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text variant="display" accessibilityRole="header">
            Choose "Allow all the time"
          </Text>
          <Text tone="muted">
            So arrivals work when your phone is in your bag. On the next screen tap Permissions, then Location, then "Allow all the time".
          </Text>
        </View>
      )}
    </Screen>
  );
}
