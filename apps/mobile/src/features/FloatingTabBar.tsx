import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@/lib/device/haptics';
import { Icon, Text, useTheme, type IconName } from '@/ui';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home', 'home-outline'],
  places: ['location', 'location-outline'],
  contacts: ['people', 'people-outline'],
  activity: ['pulse', 'pulse-outline'],
  settings: ['settings', 'settings-outline'],
};

/** Floating dark pill tab bar; the active tab expands into a green pill with its label. */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bar = t.scheme === 'dark' ? t.colors.surfaceRaised : t.colors.accent;
  const idle = t.scheme === 'dark' ? t.colors.textMuted : '#B7C2BD';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 16, alignItems: 'center' }}>
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', backgroundColor: bar, borderRadius: 999, padding: 6, gap: 2, alignSelf: 'stretch', justifyContent: 'space-between', maxWidth: 440, ...t.shadow }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key]?.options.title ?? route.name;
          const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              testID={`tab-${route.name}`}
              onPress={() => {
                haptic.tap();
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              style={{
                minHeight: 48,
                minWidth: 48,
                flexGrow: focused ? 1 : 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingHorizontal: focused ? 14 : 10,
                borderRadius: 999,
                backgroundColor: focused ? t.colors.primary : 'transparent',
              }}
            >
              <Icon name={focused ? on : off} size={22} color={focused ? t.colors.onPrimary : idle} />
              {focused ? (
                <Text variant="label" numberOfLines={1} style={{ color: t.colors.onPrimary }}>
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Space to leave under scroll content so the floating bar never covers it. */
export const TAB_BAR_SPACE = 104;
