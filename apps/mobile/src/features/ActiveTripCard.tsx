import { formatClock, toldWho } from '@reached/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import type { Contact, Trip } from '@/lib/backend/types';
import { Card, Icon, StatusPill, Text, useTheme } from '@/ui';

export function tripStatusLine(trip: Trip): string {
  if (trip.status === 'overdue') return 'Overdue · we asked if you are okay';
  if (trip.status === 'alerted') return 'Alert sent to your emergency contacts';
  return trip.expectedAt ? `On the way · arriving around ${formatClock(new Date(trip.expectedAt))}` : 'On the way';
}

/** Home status card during a trip. */
export function ActiveTripCard({ trip, contacts }: { trip: Trip; contacts: Contact[] }) {
  const t = useTheme();
  const names = contacts.filter((c) => trip.contactIds.includes(c.id)).map((c) => c.name);
  const urgent = trip.status !== 'active';
  return (
    <Card tone={urgent ? 'dangerSoft' : 'accent'} onPress={() => router.push(urgent ? '/overdue' : '/trip/active')} testID="active-trip-card" accessibilityLabel="Active trip. Open trip.">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: urgent ? t.colors.danger : t.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={urgent ? 'alert' : 'navigate'} size={22} color={urgent ? t.colors.onDanger : t.colors.onPrimary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" tone={urgent ? 'default' : 'onAccent'} numberOfLines={1} style={urgent ? { color: t.colors.onDangerSoft } : undefined}>
            {trip.destName ?? 'Trip in progress'}
          </Text>
          <Text variant="caption" tone={urgent ? 'default' : 'onAccent'} style={[{ opacity: urgent ? 1 : 0.8 }, urgent && { color: t.colors.onDangerSoft }]}>
            {tripStatusLine(trip)}
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color={urgent ? t.colors.onDangerSoft : t.colors.onAccent} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <StatusPill label={urgent ? 'Needs you' : 'Live'} tone={urgent ? 'danger' : 'success'} />
        {names.length ? <StatusPill label={`Will tell ${toldWho(names)}`} tone="neutral" /> : null}
      </View>
    </Card>
  );
}
