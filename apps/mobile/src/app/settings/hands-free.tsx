import { Platform, View } from 'react-native';
import { Card, IconTile, Screen, Text } from '@/ui';

const GUIDES = [
  {
    icon: 'notifications' as const,
    title: 'From the lock screen',
    body:
      Platform.OS === 'ios'
        ? 'During a trip, Reached shows a notification with an SOS button. Press and hold it from the lock screen.'
        : 'During a trip, the ongoing Reached notification has an SOS button you can tap from the lock screen.',
  },
  {
    icon: 'mic' as const,
    title: 'With your voice',
    body: Platform.OS === 'ios' ? 'Say "Hey Siri, Reached SOS". Add the shortcut from the Shortcuts app first.' : 'Say "Hey Google, open Reached SOS". Support depends on your phone.',
  },
  {
    icon: 'power' as const,
    title: Platform.OS === 'ios' ? 'Action button or Back Tap' : 'Power button, 3 times',
    body:
      Platform.OS === 'ios'
        ? 'Settings > Accessibility > Touch > Back Tap > Double Tap > Reached SOS.'
        : "Press the power button quickly 3 times. Android's own Emergency SOS uses 5 presses, so they don't clash.",
  },
];

/** Hands-free SOS setup guides. Discreet: one vibration, no sound, nothing on screen. */
export default function HandsFree() {
  return (
    <Screen title="Hands-free SOS">
      <Text tone="muted">A hands-free SOS is silent: one vibration, no sound, nothing on screen.</Text>
      {GUIDES.map((g) => (
        <Card key={g.title}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <IconTile icon={g.icon} tint="danger" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="headline">{g.title}</Text>
              <Text tone="muted">{g.body}</Text>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
