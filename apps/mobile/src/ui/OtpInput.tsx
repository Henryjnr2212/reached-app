import { useEffect, useRef } from 'react';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

/** Six digit boxes backed by one hidden input (Android autofill reads the SMS). Shakes on error. */
export function OtpInput({ value, onChange, error, length = 6 }: { value: string; onChange: (v: string) => void; error?: boolean; length?: number }) {
  const t = useTheme();
  const input = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!error) return;
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 50, useNativeDriver: true })),
    ).start();
  }, [error, shake]);
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Verification code" accessibilityHint="Enter the 6-digit code">
      <Animated.View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between', transform: [{ translateX: shake }] }}>
        {Array.from({ length }, (_, i) => {
          const ch = value[i] ?? '';
          const active = i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 52,
                height: 60,
                borderRadius: t.radius.md,
                borderWidth: 2,
                borderColor: error ? t.colors.danger : active ? t.colors.primary : t.colors.border,
                backgroundColor: t.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="title">{ch}</Text>
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={input}
        testID="otp-input"
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={length}
        accessibilityLabel="Verification code"
        style={{ position: 'absolute', opacity: 0.01, width: '100%', height: '100%' }}
      />
    </Pressable>
  );
}
