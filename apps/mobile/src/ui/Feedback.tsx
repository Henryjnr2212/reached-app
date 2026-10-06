import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export function Banner({
  tone = 'warning',
  icon = 'warning',
  title,
  body,
  actionLabel,
  onAction,
  testID,
}: {
  tone?: 'warning' | 'danger' | 'info' | 'success';
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  const [bg, fg] = {
    warning: [t.colors.warningSoft, t.colors.onWarningSoft],
    danger: [t.colors.dangerSoft, t.colors.onDangerSoft],
    info: [t.colors.infoSoft, t.colors.onInfoSoft],
    success: [t.colors.primarySoft, t.colors.onPrimarySoft],
  }[tone] as [string, string];
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{ backgroundColor: bg, borderRadius: t.radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <Icon name={icon} size={22} color={fg} />
      <View style={{ flex: 1 }}>
        <Text variant="label" style={{ color: fg }}>
          {title}
        </Text>
        {body ? (
          <Text variant="caption" style={{ color: fg }}>
            {body}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} size="md" variant="accent" full={false} onPress={onAction} style={{ paddingHorizontal: 16 }} />
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  testID,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View testID={testID} style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16, gap: 12 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={40} color={t.colors.onPrimarySoft} />
      </View>
      <Text variant="title" center>
        {title}
      </Text>
      <Text variant="body" tone="muted" center>
        {body}
      </Text>
      {action ? <View style={{ alignSelf: 'stretch', marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

/** Skeleton loader block (instead of spinners). Static under reduced motion. */
export function Skeleton({ height = 16, width = '100%', radius, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[{ height, width, borderRadius: radius ?? t.radius.sm, backgroundColor: t.colors.surfaceMuted, opacity: pulse }, style]}
    />
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: 16 }} testID="skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Skeleton width={44} height={44} radius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }) {
  const t = useTheme();
  const [bg, fg] = {
    success: [t.colors.primarySoft, t.colors.onPrimarySoft],
    warning: [t.colors.warningSoft, t.colors.onWarningSoft],
    danger: [t.colors.dangerSoft, t.colors.onDangerSoft],
    info: [t.colors.infoSoft, t.colors.onInfoSoft],
    neutral: [t.colors.surfaceMuted, t.colors.textMuted],
  }[tone] as [string, string];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text variant="small" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({ name, size = 44, tone = 'primary' }: { name: string; size?: number; tone?: 'primary' | 'accent' }) {
  const t = useTheme();
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone === 'primary' ? t.colors.primarySoft : t.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="label" style={{ color: tone === 'primary' ? t.colors.onPrimarySoft : t.colors.onAccent, fontSize: size * 0.36 }}>
        {initials}
      </Text>
    </View>
  );
}
