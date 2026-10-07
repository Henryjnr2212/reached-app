import { TOUCH_TARGET } from '@reached/core';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '@/lib/device/haptics';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}

/** Pill button. One "primary" or "accent" per screen. */
export function Button({ label, variant = 'primary', icon, loading, size = 'lg', style, full = true, disabled, onPress, ...rest }: ButtonProps) {
  const t = useTheme();
  const c = t.colors;
  const palette = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    accent: { bg: c.accent, fg: c.onAccent, border: c.accent },
    secondary: { bg: c.surface, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    danger: { bg: c.danger, fg: c.onDanger, border: c.danger },
    dangerSoft: { bg: c.dangerSoft, fg: c.onDangerSoft, border: c.dangerSoft },
  }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        haptic.tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'lg' ? 56 : TOUCH_TARGET,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: t.radius.pill,
          opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} color={palette.fg} /> : null}
          <Text variant="label" style={{ color: palette.fg, fontSize: size === 'lg' ? 16 : 14 }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Round floating control (map buttons, header actions). */
export function IconButton({
  icon,
  label,
  onPress,
  size = 48,
  tone = 'surface',
  badge,
  style,
  testID,
  onLongPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: 'surface' | 'primary' | 'danger' | 'muted' | 'accent';
  badge?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  const bg = { surface: t.colors.surface, primary: t.colors.primary, danger: t.colors.danger, muted: t.colors.surfaceMuted, accent: t.colors.accent }[tone];
  const fg = { surface: t.colors.text, primary: t.colors.onPrimary, danger: t.colors.onDanger, muted: t.colors.text, accent: t.colors.onAccent }[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      hitSlop={Math.max(0, (TOUCH_TARGET - size) / 2)}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        },
        tone === 'surface' && t.shadow,
        style,
      ]}
    >
      <Icon name={icon} size={size * 0.45} color={fg} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: t.colors.danger }]}>
          <Text variant="small" tone="onDanger" style={{ fontSize: 10, lineHeight: 12 }}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
