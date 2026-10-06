import { distanceMeters } from '@reached/core';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useState } from 'react';
import { Icon } from './Icon';
import { DEFAULT_SPAN, type MapProps } from './mapTypes';
import { useTheme } from './theme';

export type { MapMarker, MapProps } from './mapTypes';

/**
 * Web preview map: a calm, stylised street grid (no tiles, no API key) used
 * for the web build and e2e tests. Positions are projected from lat/lng so
 * pins and zone circles are in the right places relative to each other.
 */
export function Map({ center, span = DEFAULT_SPAN, zone, markers = [], me, onPressMap, style, testID, accessibilityLabel }: MapProps) {
  const t = useTheme();
  const [size, setSize] = useState({ w: 360, h: 300 });
  const mPerPx = span / Math.max(1, Math.min(size.w, size.h));
  const project = (lat: number, lng: number) => {
    const dy = (lat - center.lat) * 111_320;
    const dx = (lng - center.lng) * 111_320 * Math.cos((center.lat * Math.PI) / 180);
    return { x: size.w / 2 + dx / mPerPx, y: size.h / 2 - dy / mPerPx };
  };
  const unproject = (x: number, y: number) => ({
    lat: center.lat - ((y - size.h / 2) * mPerPx) / 111_320,
    lng: center.lng + ((x - size.w / 2) * mPerPx) / (111_320 * Math.cos((center.lat * Math.PI) / 180)),
  });
  const z = zone ? project(zone.lat, zone.lng) : null;
  const meP = me ? project(me.lat, me.lng) : null;
  const inside = zone && me ? distanceMeters(zone, me) <= zone.radius : false;
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? 'Map'}
      accessibilityRole={onPressMap ? 'button' : undefined}
      disabled={!onPressMap}
      onPress={(e: GestureResponderEvent) => onPressMap?.(unproject(e.nativeEvent.locationX, e.nativeEvent.locationY))}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[{ overflow: 'hidden', backgroundColor: t.colors.mapLand }, style]}
    >
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Rect x={size.w * 0.62} y={size.h * 0.18} width={size.w * 0.22} height={size.h * 0.16} rx={30} fill={t.colors.mapWater} />
        <Path d={`M0 ${size.h * 0.7} C ${size.w * 0.3} ${size.h * 0.6}, ${size.w * 0.6} ${size.h * 0.95}, ${size.w} ${size.h * 0.8}`} stroke={t.colors.mapRoad} strokeWidth={14} fill="none" />
        <Path d={`M${size.w * 0.25} 0 L ${size.w * 0.35} ${size.h}`} stroke={t.colors.mapRoad} strokeWidth={10} fill="none" />
        <Path d={`M0 ${size.h * 0.32} L ${size.w} ${size.h * 0.22}`} stroke={t.colors.mapRoad} strokeWidth={8} fill="none" />
        <Path d={`M${size.w * 0.7} 0 L ${size.w * 0.55} ${size.h}`} stroke={t.colors.mapRoad} strokeWidth={6} fill="none" />
        {z && zone ? (
          <Circle cx={z.x} cy={z.y} r={zone.radius / mPerPx} fill={t.scheme === 'dark' ? 'rgba(61,220,151,0.15)' : 'rgba(10,117,80,0.12)'} stroke={t.colors.primary} strokeWidth={2} />
        ) : null}
      </Svg>
      {markers.map((m) => {
        const p = project(m.lat, m.lng);
        return (
          <View
            key={m.id}
            accessibilityLabel={m.label}
            style={{ position: 'absolute', left: p.x - 16, top: p.y - 16, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: m.kind === 'alert' ? t.colors.danger : t.colors.accent, ...t.shadow }}
          >
            <Icon name={m.kind === 'police' ? 'shield' : m.kind === 'place' ? 'location' : 'flag'} size={16} color={t.colors.onAccent} />
          </View>
        );
      })}
      {meP ? (
        <View
          testID="map-me"
          accessibilityLabel={inside ? 'You, inside the arrival zone' : 'You'}
          style={{ position: 'absolute', left: meP.x - 11, top: meP.y - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#2563EB', borderWidth: 4, borderColor: '#FFFFFF', ...t.shadow }}
        />
      ) : null}
    </Pressable>
  );
}
