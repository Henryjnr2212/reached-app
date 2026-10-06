import { View } from 'react-native';
import { Card, IconTile, Screen, Text } from '@/ui';

const POINTS = [
  { icon: 'checkmark-circle' as const, title: 'When you arrive', body: 'Your people get the place name and time. Not a map.' },
  { icon: 'link' as const, title: 'A live link, if you share it', body: 'Anyone with the link sees your position during that trip only. It stops working when the trip ends.' },
  { icon: 'warning' as const, title: 'In an emergency', body: "If you're overdue or send an SOS, your emergency contacts see your last location and trip details. The link stops 2 hours after you say you're safe." },
  { icon: 'trash' as const, title: 'Deleted after 30 days', body: 'Trip location points are deleted automatically. We never sell your location.' },
];

export default function WhoSees() {
  return (
    <Screen title="Who can see my location">
      {POINTS.map((p) => (
        <Card key={p.title}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <IconTile icon={p.icon} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="headline">{p.title}</Text>
              <Text tone="muted">{p.body}</Text>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
