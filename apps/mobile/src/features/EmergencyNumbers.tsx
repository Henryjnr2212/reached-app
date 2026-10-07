import { GHANA_EMERGENCY_NUMBERS, telLink } from '@reached/core';
import { Linking } from 'react-native';
import { Card, Icon, ListRow, useTheme } from '@/ui';

/** Tap-to-call Ghana emergency numbers. Apps can't place emergency calls themselves. */
export function EmergencyNumbers() {
  const t = useTheme();
  return (
    <Card padded={false}>
      {GHANA_EMERGENCY_NUMBERS.map((n) => (
        <ListRow
          key={n.number}
          title={`${n.label} · ${n.number}`}
          subtitle={n.description}
          icon="call"
          tint="danger"
          right={<Icon name="call-outline" size={20} color={t.colors.danger} />}
          onPress={() => void Linking.openURL(telLink(n.number))}
          accessibilityLabel={`Call ${n.label}, ${n.number}`}
          testID={`call-${n.number}`}
        />
      ))}
    </Card>
  );
}
