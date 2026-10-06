import { useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

/**
 * Minimal accessible slider (zone size 100–500 m). Supports drag, tap and
 * screen-reader increment/decrement.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format = String,
  testID,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
  testID?: string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const fromX = (x: number) => clamp(min + (x / widthRef.current) * (max - min));
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChange(fromX(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => onChange(fromX(e.nativeEvent.locationX)),
    }),
  ).current;
  const pct = (value - min) / (max - min);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">{label}</Text>
        <Text variant="label" tone="primary">
          {format(value)}
        </Text>
      </View>
      <View
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
        onLayout={(e: LayoutChangeEvent) => {
          widthRef.current = e.nativeEvent.layout.width;
          setWidth(e.nativeEvent.layout.width);
        }}
        style={{ height: 48, justifyContent: 'center' }}
        {...responder.panHandlers}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceMuted }}>
          <View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: t.colors.primary }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.max(0, pct * width - 14),
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: t.colors.surface,
            borderWidth: 3,
            borderColor: t.colors.primary,
            ...t.shadow,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="small" tone="muted">
          {format(min)}
        </Text>
        <Text variant="small" tone="muted">
          {format(max)}
        </Text>
      </View>
    </View>
  );
}
