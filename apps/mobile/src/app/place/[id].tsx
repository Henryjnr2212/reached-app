import { describeRule, describeSchedule } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useBackend } from '@/lib/backend';
import { keys, useContacts, usePlaces, useRules } from '@/lib/hooks/queries';
import { Banner, Button, Card, ConfirmSheet, EmptyState, IconTile, ListRow, Map, PLACE_ICONS, Screen, SectionTitle, SkeletonList, SwitchRow, Text, useTheme } from '@/ui';

export default function PlaceDetail() {
  const t = useTheme();
  const b = useBackend();
  const qc = useQueryClient();
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const places = usePlaces();
  const rules = useRules();
  const contacts = useContacts();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const place = places.data?.find((p) => p.id === id);
  const own = (rules.data ?? []).filter((r) => r.placeId === id);
  const name = (cid: string) => contacts.data?.find((c) => c.id === cid)?.name ?? 'someone';

  if (!place) {
    return (
      <Screen title="Place">
        {places.isLoading ? <SkeletonList /> : <EmptyState icon="location" title="Place not found" body="It may have been deleted." />}
      </Screen>
    );
  }

  return (
    <Screen
      title={place.name}
      testID="place-detail"
      footer={<Button label="Add rule" icon="add" onPress={() => router.push({ pathname: '/rule/[id]', params: { id: 'new', placeId: place.id } })} testID="add-rule" />}
    >
      <Map center={place} zone={{ ...place, radius: place.radius }} markers={[{ id: place.id, label: place.name, kind: 'place', lat: place.lat, lng: place.lng }]} interactive={false} style={{ height: 200, borderRadius: t.radius.lg }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon={PLACE_ICONS[place.icon] ?? 'location'} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="headline">{place.name}</Text>
          <Text variant="caption" tone="muted">
            {[place.address, place.ghanaPostGps, `${place.radius} m arrival zone`].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      {created && !own.length ? <Banner tone="info" icon="sparkles" title="Add a rule for this place?" body={`For example: whenever I arrive at ${place.name}, tell Mom.`} /> : null}
      <SectionTitle>Rules</SectionTitle>
      {own.length ? (
        <Card padded={false}>
          {own.map((r) => (
            <SwitchRow
              key={r.id}
              title={describeRule(r, name)}
              subtitle={describeSchedule(r)}
              value={r.enabled}
              icon={r.event === 'arrive' ? 'enter' : 'exit'}
              testID={`rule-${r.id}`}
              onChange={async (enabled) => {
                await b.saveRule({ ...r, enabled });
                await qc.invalidateQueries({ queryKey: keys.rules });
              }}
            />
          ))}
        </Card>
      ) : (
        <Text tone="muted">No rules yet. Rules work on their own, every day, without starting a trip.</Text>
      )}
      {own.length ? (
        <Card padded={false}>
          {own.map((r) => (
            <ListRow key={r.id} title={`Edit: ${describeRule(r, name)}`} icon="create-outline" tint="neutral" chevron onPress={() => router.push({ pathname: '/rule/[id]', params: { id: r.id, placeId: place.id } })} />
          ))}
        </Card>
      ) : null}
      <Card padded={false}>
        <ListRow title="Edit place" icon="create-outline" tint="neutral" chevron onPress={() => router.push({ pathname: '/place/edit/[id]', params: { id: place.id } })} testID="edit-place" />
        <ListRow title="Delete place" icon="trash-outline" tint="danger" destructive onPress={() => setConfirm(true)} testID="delete-place" />
      </Card>
      <ConfirmSheet
        visible={confirm}
        title={`Delete ${place.name}${own.length ? ` and its ${own.length} ${own.length === 1 ? 'rule' : 'rules'}` : ''}?`}
        confirmLabel="Delete"
        destructive
        loading={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          await b.removePlace(place.id);
          await Promise.all([qc.invalidateQueries({ queryKey: keys.places }), qc.invalidateQueries({ queryKey: keys.rules })]);
          setBusy(false);
          setConfirm(false);
          router.back();
        }}
      />
    </Screen>
  );
}
