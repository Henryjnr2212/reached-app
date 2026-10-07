import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

export function Header({ title, onBack, right, back = true }: { title?: string; onBack?: () => void; right?: ReactNode; back?: boolean }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
      {back ? (
        <IconButton
          icon="arrow-back"
          label="Back"
          testID="back"
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        {title ? (
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/**
 * Standard screen: safe area, optional header, scrollable body and an
 * optional sticky footer for the one primary action.
 */
export function Screen({
  title,
  children,
  footer,
  scroll = true,
  back = true,
  headerRight,
  onBack,
  contentStyle,
  testID,
  bare,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  back?: boolean;
  headerRight?: ReactNode;
  onBack?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  bare?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = t.spacing.xl;
  const body = (
    <View style={[{ gap: t.spacing.lg, paddingHorizontal: pad, paddingBottom: footer ? 16 : insets.bottom + 24 }, contentStyle]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}
    >
      {!bare && (title !== undefined || back) ? (
        <View style={{ paddingHorizontal: pad, paddingBottom: 8 }}>
          <Header title={title} back={back} right={headerRight} onBack={onBack} />
        </View>
      ) : null}
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{body}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: pad,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            gap: 10,
            backgroundColor: t.colors.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
