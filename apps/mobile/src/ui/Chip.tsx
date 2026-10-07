import { TOUCH_TARGET } from '@reached/core';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '@/lib/device/haptics';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

/** Pill chip used for filters, contacts and quick places. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  trailingIcon,
  testID,
  style,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  trailingIcon?: IconName;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const fg = selected ? t.colors.onAccent : t.colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={
        onPress
          ? () => {
              haptic.tap();
              onPress();
            }
          : undefined
      }
      style={({ pressed }) => [
        {
          minHeight: TOUCH_TARGET,
          paddingHorizontal: 16,
          borderRadius: t.radius.pill,
          backgroundColor: selected ? t.colors.accent : t.colors.surface,
          borderWidth: 1,
          borderColor: selected ? t.colors.accent : t.colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="label" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
      {trailingIcon ? <Icon name={trailingIcon} size={16} color={fg} /> : null}
    </Pressable>
  );
}

export function ChipRow({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!scroll) return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: 8, paddingRight: 16 }, style]}>
      {children}
    </ScrollView>
  );
}
