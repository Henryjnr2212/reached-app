import { BATTERY_GUIDES } from '@reached/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Hero } from '@/features/Hero';
import { batteryRestricted, openBatterySettings, phoneBrand } from '@/lib/device/battery';
import { useApp } from '@/lib/store';
import { Button, Card, Screen, Text, useTheme } from '@/ui';

/** Android only: keep Reached running (battery restrictions + brand steps). */
export default function BatteryExplainer() {
  const t = useTheme();
  const set = useApp((s) => s.set);
  const [fixing, setFixing] = useState(false);
  const guide = BATTERY_GUIDES[phoneBrand()];
  const next = () => router.replace('/onboarding/home');
  return (
    <Screen
      title=""
      back={false}
      testID="battery-explainer"
      footer={
        <View style={{ gap: 10 }}>
          {fixing ? (
            <Button label="Done" onPress={next} />
          ) : (
            <Button
              label="Fix it"
              icon="battery-charging"
              onPress={async () => {
                await openBatterySettings();
                set({ battery: (await batteryRestricted()) ? 'restricted' : 'ok' });
                setFixing(true);
              }}
            />
          )}
          <Button label="Skip" variant="ghost" onPress={next} />
        </View>
      }
    >
      <Hero icon="battery-charging" tone="warning" badges={['flash', 'checkmark-circle']} height={220} />
      <View style={{ gap: 8 }}>
        <Text variant="display" accessibilityRole="header">
          Keep Reached running
        </Text>
        <Text tone="muted">Some phones stop apps in the background to save battery. That can stop your arrival texts.</Text>
      </View>
      {fixing ? (
        <Card>
          <Text variant="headline">On your {guide.label}</Text>
          {guide.steps.map((s, i) => (
            <View key={s} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="small" style={{ color: t.colors.onPrimarySoft }}>
                  {i + 1}
                </Text>
              </View>
              <Text style={{ flex: 1 }}>{s}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
