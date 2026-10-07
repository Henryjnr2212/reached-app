import { TOUCH_TARGET } from '@reached/core';
import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  prefix?: string;
}

export const TextField = forwardRef<TextInput, FieldProps>(function TextField({ label, error, hint, prefix, style, ...rest }, ref) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: TOUCH_TARGET + 8,
          borderRadius: t.radius.md,
          borderWidth: 1.5,
          borderColor: error ? t.colors.danger : t.colors.border,
          backgroundColor: t.colors.surface,
          paddingHorizontal: 16,
          gap: 8,
        }}
      >
        {prefix ? (
          <Text variant="bodyStrong" tone="muted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={t.colors.textSubtle}
          style={[t.type.body, { flex: 1, color: t.colors.text, paddingVertical: 12, fontSize: 16 }, style]}
          {...rest}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
