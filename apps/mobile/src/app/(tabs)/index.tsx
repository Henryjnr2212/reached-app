import { ACCRA, distanceMeters, greetingFor } from '@reached/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActiveTripCard } from '@/features/ActiveTripCard';
import { EventRow } from '@/features/EventRow';
import { TAB_BAR_SPACE } from '@/features/FloatingTabBar';
import { ReachedNowSheet } from '@/features/ReachedNowSheet';
import { RequestCards } from '@/features/RequestCards';
import { useWarnings } from '@/features/useWarnings';
import { backendNow } from '@/lib/backend';
import { useContacts, useEvents, useLiveTrip, useNotifications, usePlaces, useProfile } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { Avatar, Banner, Button, Card, Chip, ChipRow, EmptyState, IconButton, IconTile, Map, PLACE_ICONS, SectionTitle, Skeleton, SosShield, Text, useTheme } from '@/ui';

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const contacts = useContacts();
  const places = usePlaces();
  const trip = useLiveTrip();
  const events = useEvents();
  const notes = useNotifications();
  const here = useApp((s) => s.here);
  const dismiss = useApp((s) => s.dismiss);
  const warnings = useWarnings();
  const [sheet, setSheet] = useState(false);

  const p = profile.data;
  const live = trip.data;
  const unread = (notes.data ?? []).filter((n) => !n.readAt).length;
  const center = live?.dest ?? here ?? places.data?.[0] ?? ACCRA;
  // Fit the nearest saved places around you, within reason.
  const near = (places.data ?? []).map((pl) => distanceMeters(center, pl)).sort((a, b) => a - b);
  const span = live?.dest ? 2500 : Math.min(8000, Math.max(1800, (near[1] ?? near[0] ?? 0) * 2.6));
  const markers = [
    ...(places.data ?? []).map((pl) => ({ id: pl.id, label: pl.name, kind: 'place' as const, lat: pl.lat, lng: pl.lng })),
    ...(live?.dest ? [{ id: 'dest', label: live.destName ?? 'Destination', kind: 'destination' as const, ...live.dest }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }} testID="home">
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 340 + insets.top }}>
          <Map
            center={center}
            span={span}
            markers={markers}
            me={here}
            zone={live?.dest ? { ...live.dest, radius: live.radius } : null}
            interactive={false}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityLabel="Map of your places"
          />
          <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile"
              onPress={() => router.push('/settings/profile')}
              style={{ borderRadius: 26, borderWidth: 3, borderColor: t.colors.surface, ...t.shadow }}
            >
              {p?.photoUri ? <Image source={{ uri: p.photoUri }} style={{ width: 46, height: 46, borderRadius: 23 }} /> : <Avatar name={p?.firstName ?? '?'} size={46} />}
            </Pressable>
            <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: 999, paddingHorizontal: 18, minHeight: 52, justifyContent: 'center', ...t.shadow }}>
              {p ? (
                <View testID="greeting" accessibilityLabel={`${greetingFor(new Date(backendNow()))}, ${p.firstName}`}>
                  <Text variant="small" tone="muted" numberOfLines={1}>
                    {greetingFor(new Date(backendNow()))}
                  </Text>
                  <Text variant="headline" numberOfLines={1}>
                    {p.firstName}
                  </Text>
                </View>
              ) : (
                <Skeleton width={140} />
              )}
            </View>
            <IconButton icon="notifications-outline" label={`Notifications${unread ? `, ${unread} new` : ''}`} badge={unread || undefined} onPress={() => router.push('/notifications')} testID="open-notifications" />
            <SosShield onTrigger={() => router.push('/sos')} holdSeconds={p?.sosHoldSeconds} />
          </View>
          <View style={{ position: 'absolute', right: 16, bottom: 44 }}>
            <IconButton icon="locate" label="Places" onPress={() => router.push('/(tabs)/places')} />
          </View>
        </View>

        <View style={{ marginTop: -28, backgroundColor: t.colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, gap: 16 }}>
          {warnings.slice(0, 1).map((w) => (
            <Banner key={w.id} tone="warning" icon={w.icon} title={w.title} body={w.body} actionLabel={w.id === 'offline' ? 'Dismiss' : 'Fix'} onAction={w.id === 'offline' ? () => dismiss(w.id) : w.fix} testID={`warning-${w.id}`} />
          ))}

          {trip.isLoading || contacts.isLoading ? (
            <Skeleton height={96} radius={24} />
          ) : live ? (
            <ActiveTripCard trip={live} contacts={contacts.data ?? []} />
          ) : !contacts.data?.length ? (
            <Card tone="primarySoft" onPress={() => router.push('/contact/new')} testID="add-someone-card">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="person-add" />
                <View style={{ flex: 1 }}>
                  <Text variant="headline">Add someone to notify</Text>
                  <Text variant="caption" tone="muted">
                    Reached texts them when you arrive.
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            <Card onPress={() => router.push('/(tabs)/places')} testID="covered-card" accessibilityLabel="You're covered. Open places.">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="shield-checkmark" />
                <View style={{ flex: 1 }}>
                  <Text variant="headline">You're covered</Text>
                  <Text variant="caption" tone="muted">
                    {places.data?.length ?? 0} {places.data?.length === 1 ? 'place' : 'places'} · {contacts.data.length} {contacts.data.length === 1 ? 'contact' : 'contacts'}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          <RequestCards />

          <View style={{ gap: 10 }}>
            {live ? (
              <Button label="Open trip" variant="accent" icon="navigate" onPress={() => router.push('/trip/active')} testID="open-trip" />
            ) : (
              <Button label="Start a trip" variant="accent" icon="navigate" onPress={() => router.push('/trip/start')} testID="start-trip" />
            )}
            <Button label={`Send "I've reached" now`} variant="secondary" icon="checkmark-done" onPress={() => setSheet(true)} disabled={!contacts.data?.length} testID="reached-now" />
          </View>

          <SectionTitle>Quick places</SectionTitle>
          <ChipRow>
            {(places.data ?? []).map((pl) => (
              <Chip key={pl.id} label={pl.name} icon={PLACE_ICONS[pl.icon] ?? 'location'} onPress={() => router.push({ pathname: '/trip/start', params: { placeId: pl.id } })} testID={`quick-${pl.name}`} />
            ))}
            <Chip label="Add" icon="add" onPress={() => router.push('/place/new')} testID="quick-add-place" />
          </ChipRow>

          <SectionTitle
            action={
              <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/activity')} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' }}>
                <Text variant="label" tone="primary">
                  See all
                </Text>
              </Pressable>
            }
          >
            Recent activity
          </SectionTitle>
          {events.isLoading ? (
            <Skeleton height={64} />
          ) : events.data?.length ? (
            <Card padded={false}>
              {events.data.slice(0, 3).map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </Card>
          ) : (
            <EmptyState icon="pulse" title="Nothing yet" body="When Reached tells someone you arrived, it shows up here." />
          )}
        </View>
      </ScrollView>
      <ReachedNowSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}
