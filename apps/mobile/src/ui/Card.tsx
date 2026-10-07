import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '@/lib/device/haptics';
import { useTheme } from './theme';

export function Card({
  children,
  style,
  onPress,
  tone = 'surface',
  accessibilityLabel,
  testID,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: 'surface' | 'muted' | 'primarySoft' | 'accent' | 'dangerSoft' | 'warningSoft' | 'infoSoft';
  accessibilityLabel?: string;
  testID?: string;
  padded?: boolean;
}) {
  const t = useTheme();
  const bg = {
    surface: t.colors.surface,
    muted: t.colors.surfaceMuted,
    primarySoft: t.colors.primarySoft,
    accent: t.colors.accent,
    dangerSoft: t.colors.dangerSoft,
    warningSoft: t.colors.warningSoft,
    infoSoft: t.colors.infoSoft,
  }[tone];
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: t.radius.lg,
    padding: padded ? t.spacing.lg : 0,
    borderWidth: tone === 'surface' && t.scheme === 'dark' ? 1 : 0,
    borderColor: t.colors.border,
  };
  if (!onPress) {
    return (
      <View testID={testID} style={[base, tone === 'surface' && t.scheme === 'light' && softShadow, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [base, tone === 'surface' && t.scheme === 'light' && softShadow, { opacity: pressed ? 0.9 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

const softShadow: ViewStyle = {
  shadowColor: '#0B100E',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
