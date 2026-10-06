import { ACTIVITY_FILTERS, dayLabel, matchesFilter, type ActivityFilter } from '@reached/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventRow } from '@/features/EventRow';
import { TAB_BAR_SPACE } from '@/features/FloatingTabBar';
import { backendNow } from '@/lib/backend';
import type { ActivityEvent } from '@/lib/backend/types';
import { useEvents, useProfile } from '@/lib/hooks/queries';
import { Button, Chip, ChipRow, EmptyState, SkeletonList, Text, useTheme } from '@/ui';

export default function Activity() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const events = useEvents();
  const profile = useProfile();
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const sections = useMemo(() => {
    const now = new Date(backendNow());
    const groups: { title: string; data: ActivityEvent[] }[] = [];
    for (const e of (events.data ?? []).filter((x) => matchesFilter(x.kind, filter))) {
      const title = dayLabel(new Date(e.createdAt), now);
      const last = groups[groups.length - 1];
      if (last?.title === title) last.data.push(e);
      else groups.push({ title, data: [e] });
    }
    return groups;
  }, [events.data, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }} testID="activity-tab">
      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 12 }}>
        <Text variant="display" accessibilityRole="header">
          Activity
        </Text>
        <ChipRow>
          {ACTIVITY_FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} testID={`filter-${f.key}`} />
          ))}
        </ChipRow>
      </View>
      {events.isLoading ? (
        <View style={{ padding: 20 }}>
          <SkeletonList rows={5} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => e.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_SPACE + insets.bottom }}
          renderSectionHeader={({ section }) => (
            <Text variant="label" tone="muted" style={{ marginTop: 18, marginBottom: 6 }}>
              {section.title}
            </Text>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={{
                backgroundColor: t.colors.surface,
                borderTopLeftRadius: index === 0 ? 20 : 0,
                borderTopRightRadius: index === 0 ? 20 : 0,
                borderBottomLeftRadius: index === section.data.length - 1 ? 20 : 0,
                borderBottomRightRadius: index === section.data.length - 1 ? 20 : 0,
                overflow: 'hidden',
              }}
            >
              <EventRow event={item} />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="pulse"
              title={filter === 'all' ? 'No activity yet' : 'Nothing here'}
              body="Start a trip or add a place rule, and every text we send shows up here."
              action={<Button label="Start a trip" icon="navigate" full={false} onPress={() => router.push('/trip/start')} />}
            />
          }
          ListFooterComponent={
            <Text variant="caption" tone="muted" center style={{ marginTop: 20 }}>
              Activity is deleted automatically after {profile.data?.retentionDays ?? 30} days.
            </Text>
          }
        />
      )}
    </View>
  );
}
