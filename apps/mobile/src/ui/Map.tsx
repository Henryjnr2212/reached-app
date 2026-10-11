import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, type MapPressEvent } from 'react-native-maps';
import { Icon } from './Icon';
import { SketchMap } from './SketchMap';
import { DEFAULT_SPAN, type MapProps } from './mapTypes';
import { useTheme } from './theme';

export type { MapMarker, MapProps } from './mapTypes';

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#151c19' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e9c96' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b100e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#25302b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a2a36' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

// Google Maps on Android crashes at startup without an API key, so test builds
// made without one show the sketch map instead.
const hasAndroidMapsKey = Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);

/** Native map (Google Maps on Android, Apple/Google on iOS). */
export function MapView_(props: MapProps) {
  if (Platform.OS === 'android' && !hasAndroidMapsKey) return <SketchMap {...props} />;
  return <GoogleMap {...props} />;
}

function GoogleMap({ center, span = DEFAULT_SPAN, zone, markers = [], me, onPressMap, interactive = true, style, testID, accessibilityLabel }: MapProps) {
  const t = useTheme();
  const region = useMemo(
    () => ({
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: span / 111_320,
      longitudeDelta: span / (111_320 * Math.cos((center.lat * Math.PI) / 180)),
    }),
    [center.lat, center.lng, span],
  );
  return (
    <View style={[{ overflow: 'hidden' }, style]} testID={testID} accessibilityLabel={accessibilityLabel ?? 'Map'}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        region={region}
        customMapStyle={t.scheme === 'dark' ? DARK_STYLE : []}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onPress={onPressMap ? (e: MapPressEvent) => onPressMap({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude }) : undefined}
      >
        {zone ? (
          <Circle
            center={{ latitude: zone.lat, longitude: zone.lng }}
            radius={zone.radius}
            strokeColor={t.colors.primary}
            strokeWidth={2}
            fillColor={t.scheme === 'dark' ? 'rgba(61,220,151,0.15)' : 'rgba(10,117,80,0.12)'}
          />
        ) : null}
        {markers.map((m) => (
          <Marker key={m.id} coordinate={{ latitude: m.lat, longitude: m.lng }} title={m.label}>
            <View style={{ backgroundColor: m.kind === 'alert' ? t.colors.danger : t.colors.accent, padding: 8, borderRadius: 20 }}>
              <Icon name={m.kind === 'police' ? 'shield' : m.kind === 'place' ? 'location' : 'flag'} size={16} color={t.colors.onAccent} />
            </View>
          </Marker>
        ))}
        {me ? (
          <Marker coordinate={{ latitude: me.lat, longitude: me.lng }} title="You" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#2563EB', borderWidth: 4, borderColor: '#FFFFFF' }} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

export { MapView_ as Map };
