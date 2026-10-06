import { describeRule, describeSchedule, MAX_PLACES, PLANS } from '@reached/core';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_SPACE } from '@/features/FloatingTabBar';
import { useContacts, usePlaces, useProfile, useRules } from '@/lib/hooks/queries';
import { Button, Card, EmptyState, IconButton, IconTile, PLACE_ICONS, SkeletonList, Text, useTheme } from '@/ui';

export default function Places() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const places = usePlaces();
  const rules = useRules();
  const contacts = useContacts();
  const profile = useProfile();
  const limit = Math.min(MAX_PLACES, PLANS[profile.data?.plan ?? 'free'].maxPlaces);
  const name = (id: string) => contacts.data?.find((c) => c.id === id)?.name ?? 'someone';
  const count = places.data?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }} testID="places-tab">
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="display" accessibilityRole="header">
            Places
          </Text>
          <Text variant="caption" tone="muted">
            {count} of {limit} places
          </Text>
        </View>
        <IconButton icon="add" label="Add place" tone="accent" onPress={() => router.push('/place/new')} testID="add-place" />
      </View>
      {places.isLoading ? (
        <View style={{ padding: 20 }}>
          <SkeletonList rows={4} />
        </View>
      ) : (
        <FlatList
          data={places.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12, paddingBottom: TAB_BAR_SPACE + insets.bottom }}
          ListEmptyComponent={
            <EmptyState
              icon="location"
              title="No places yet"
              body="Add home, work or school. Reached will tell your people when you get there."
              action={<Button label="Add place" icon="add" full={false} onPress={() => router.push('/place/new')} />}
            />
          }
          renderItem={({ item }) => {
            const own = (rules.data ?? []).filter((r) => r.placeId === item.id);
            const summary = own.length
              ? own
                  .filter((r) => r.enabled)
                  .map((r) => `${describeRule(r, name)} · ${describeSchedule(r)}`)
                  .join('\n') || 'Rules paused'
              : 'No rules yet';
            return (
              <Card onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.id } })} testID={`place-${item.name}`} accessibilityLabel={`${item.name}. ${summary}`}>
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <IconTile icon={PLACE_ICONS[item.icon] ?? 'location'} size={48} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="headline">{item.name}</Text>
                    {item.address ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {item.address}
                      </Text>
                    ) : null}
                    <Text variant="caption" tone={own.length ? 'primary' : 'subtle'} numberOfLines={2}>
                      {summary}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
