import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { Icon, useTheme, type IconName } from '@/ui';

/**
 * Soft pastel illustration block used on onboarding and explainer screens:
 * a gradient panel with a large icon in a white circle and two floating
 * pills, after the SHIELD/InSafe samples.
 */
export function Hero({ icon, tone = 'primary', height = 260, badges = [] }: { icon: IconName; tone?: 'primary' | 'danger' | 'info' | 'warning'; height?: number; badges?: IconName[] }) {
  const t = useTheme();
  const dark = t.scheme === 'dark';
  const grads: Record<string, [string, string]> = {
    primary: dark ? ['#123526', '#0B100E'] : ['#D3F0E1', '#F1EEFD'],
    danger: dark ? ['#3A1513', '#0B100E'] : ['#FEECEB', '#FEF6E7'],
    info: dark ? ['#122340', '#0B100E'] : ['#EAF2FF', '#ECF8F2'],
    warning: dark ? ['#33240A', '#0B100E'] : ['#FEF6E7', '#ECF8F2'],
  };
  const fg = { primary: t.colors.primary, danger: t.colors.danger, info: t.colors.onInfoSoft, warning: t.colors.onWarningSoft }[tone];
  return (
    <LinearGradient colors={grads[tone]!} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height, borderRadius: t.radius.xl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: height * 0.9, height: height * 0.9, borderRadius: height, borderWidth: 1, borderColor: t.colors.border, opacity: 0.7 }} />
      <View style={{ position: 'absolute', width: height * 0.6, height: height * 0.6, borderRadius: height, borderWidth: 1, borderColor: t.colors.border }} />
      <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center', ...t.shadow }}>
        <Icon name={icon} size={48} color={fg} />
      </View>
      {badges.map((b, i) => (
        <View
          key={b}
          style={{
            position: 'absolute',
            top: i === 0 ? 36 : undefined,
            bottom: i === 1 ? 40 : undefined,
            left: i === 0 ? 36 : undefined,
            right: i === 1 ? 36 : undefined,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: t.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            ...t.shadow,
          }}
        >
          <Icon name={b} size={22} color={t.colors.text} />
        </View>
      ))}
    </LinearGradient>
  );
}
