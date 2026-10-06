import { TOUCH_TARGET } from '@reached/core';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { haptic } from '@/lib/device/haptics';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

type Tint = 'primary' | 'danger' | 'warning' | 'info' | 'neutral';

function useTint(tint: Tint) {
  const t = useTheme();
  return {
    primary: [t.colors.primarySoft, t.colors.onPrimarySoft],
    danger: [t.colors.dangerSoft, t.colors.onDangerSoft],
    warning: [t.colors.warningSoft, t.colors.onWarningSoft],
    info: [t.colors.infoSoft, t.colors.onInfoSoft],
    neutral: [t.colors.surfaceMuted, t.colors.text],
  }[tint] as [string, string];
}

/** Tinted rounded-square icon, as in the settings samples. */
export function IconTile({ icon, tint = 'primary', size = 44 }: { icon: IconName; tint?: Tint; size?: number }) {
  const [bg, fg] = useTint(tint);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.48} color={fg} />
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  tint = 'primary',
  left,
  right,
  onPress,
  chevron = !!onPress,
  testID,
  destructive,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string | null;
  icon?: IconName;
  tint?: Tint;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  testID?: string;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const content = (
    <>
      {left ?? (icon ? <IconTile icon={icon} tint={destructive ? 'danger' : tint} /> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" tone={destructive ? 'danger' : 'default'} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-forward" size={18} color={t.colors.textMuted} /> : null}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, minHeight: TOUCH_TARGET + 12, paddingVertical: 8, paddingHorizontal: 14 };
  if (!onPress) return <View testID={testID} style={style}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
  tint,
  disabled,
  testID,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: IconName;
  tint?: Tint;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  // The whole row is the switch, so the tap target is the row, not the small thumb.
  const toggle = () => {
    haptic.tap();
    onChange(!value);
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={toggle}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: TOUCH_TARGET + 12, paddingVertical: 8, paddingHorizontal: 14, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
    >
      {icon ? <IconTile icon={icon} tint={tint} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {/* Drawn rather than a native Switch so the row stays the only control. */}
      <View
        style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? t.colors.primary : t.colors.textSubtle, alignItems: value ? 'flex-end' : 'flex-start' }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.surface, ...t.shadow, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }} />
      </View>
    </Pressable>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 2 }} />;
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 }}>
      <Text variant="headline" accessibilityRole="header">
        {children}
      </Text>
      {action}
    </View>
  );
}
