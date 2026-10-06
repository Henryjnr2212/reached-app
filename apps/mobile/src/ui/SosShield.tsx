import { SOS_HOLD_SECONDS } from '@reached/core';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { haptic } from '@/lib/device/haptics';
import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Hold the shield for N seconds to start an SOS. A short tap shows
 * "Hold to send SOS". The ring fills while holding.
 */
export function SosShield({ onTrigger, holdSeconds = SOS_HOLD_SECONDS, size = 56, large = false }: { onTrigger: () => void; holdSeconds?: number; size?: number; large?: boolean }) {
  const t = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [hint, setHint] = useState(false);
  const fired = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const s = large ? 120 : size;
  const stroke = large ? 8 : 4;
  const r = (s - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const start = () => {
    fired.current = false;
    haptic.tap();
    Animated.timing(progress, { toValue: 1, duration: holdSeconds * 1000, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (finished && !fired.current) {
        fired.current = true;
        haptic.heavy();
        progress.setValue(0);
        onTrigger();
      }
    });
  };
  const stop = () => {
    progress.stopAnimation((v) => {
      if (!fired.current && v < 0.9) {
        setHint(true);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(false), 2200);
      }
    });
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        testID="sos-shield"
        accessibilityRole="button"
        accessibilityLabel="SOS"
        accessibilityHint={`Hold for ${holdSeconds} seconds to alert your emergency contacts`}
        accessibilityActions={[{ name: 'longpress', label: 'Send SOS' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onTrigger()}
        onPressIn={start}
        onPressOut={stop}
        style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            position: 'absolute',
            width: s - stroke * 2,
            height: s - stroke * 2,
            borderRadius: s,
            backgroundColor: t.colors.danger,
            ...t.shadow,
            shadowColor: t.colors.danger,
            shadowOpacity: 0.35,
          }}
        />
        <Svg width={s} height={s} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <AnimatedCircle
            cx={s / 2}
            cy={s / 2}
            r={r}
            stroke={t.scheme === 'dark' ? '#FFFFFF' : '#0B100E'}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] })}
            strokeLinecap="round"
          />
        </Svg>
        {large ? (
          <Text variant="display" tone="onDanger" style={{ fontSize: 30 }}>
            SOS
          </Text>
        ) : (
          <Icon name="shield-half" size={s * 0.42} color={t.colors.onDanger} />
        )}
      </Pressable>
      {hint ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', top: s + 6, right: large ? undefined : 0, backgroundColor: t.colors.accent, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 150 }}
        >
          <Text variant="caption" tone="onAccent" center>
            Hold to send SOS
          </Text>
        </View>
      ) : null}
    </View>
  );
}
