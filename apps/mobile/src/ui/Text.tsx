import type { TypeVariant } from '@reached/core';
import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from './theme';

type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'onPrimary' | 'onAccent' | 'onDanger';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  center?: boolean;
}

export function Text({ variant = 'body', tone = 'default', center, style, ...rest }: AppTextProps) {
  const t = useTheme();
  const color = {
    default: t.colors.text,
    muted: t.colors.textMuted,
    subtle: t.colors.textSubtle,
    primary: t.colors.primary,
    danger: t.colors.danger,
    onPrimary: t.colors.onPrimary,
    onAccent: t.colors.onAccent,
    onDanger: t.colors.onDanger,
  }[tone];
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[t.type[variant], { color }, center && { textAlign: 'center' }, style]}
    />
  );
}
