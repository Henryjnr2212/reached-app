import { ACCRA, formatDistance, telLink } from '@reached/core';
import { useQuery } from '@tanstack/react-query';
import { Linking, View } from 'react-native';
import { useBackend } from '@/lib/backend';
import { currentPosition } from '@/lib/device/location';
import { useApp } from '@/lib/store';
import { Banner, Card, EmptyState, ListRow, Map, Screen, SkeletonList, StatusPill, useTheme } from '@/ui';

export default function PoliceFinder() {
  const t = useTheme();
  const b = useBackend();
  const here = useApp((s) => s.here);
  const q = useQuery({
    queryKey: ['police', here?.lat.toFixed(2), here?.lng.toFixed(2)],
    queryFn: async () => {
      const at = here ?? (await currentPosition()) ?? ACCRA;
      return { at, stations: await b.nearestPolice(at) };
    },
  });
  return (
    <Screen title="Nearest police" testID="police-screen">
      <Banner tone="info" icon="information-circle" title="Station list not yet confirmed" body="Check details with the Ghana Police Service. In an emergency call 112 or 191." />
      {q.isLoading ? (
        <SkeletonList />
      ) : q.data?.stations.length ? (
        <>
          <Map
            center={q.data.at}
            span={6000}
            me={q.data.at}
            markers={q.data.stations.map((s) => ({ id: s.id, label: s.name, kind: 'police' as const, lat: s.lat, lng: s.lng }))}
            interactive={false}
            style={{ height: 200, borderRadius: t.radius.lg }}
          />
          <Card padded={false}>
            {q.data.stations.map((s) => (
              <ListRow
                key={s.id}
                title={s.name}
                subtitle={`${formatDistance(s.distanceM)} · ${s.district ?? s.region}`}
                icon="business"
                tint="info"
                right={<View>{s.verified ? <StatusPill label="Verified" tone="success" /> : null}</View>}
                onPress={s.phone ? () => void Linking.openURL(telLink(s.phone!)) : undefined}
                testID={`station-${s.id}`}
              />
            ))}
          </Card>
        </>
      ) : (
        <EmptyState icon="business" title="No stations found nearby" body="Call 112 or 191 in an emergency." />
      )}
    </Screen>
  );
}
