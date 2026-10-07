import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from './theme';

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          testID="toast"
          style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 100, alignItems: 'center' }}
        >
          <View style={{ backgroundColor: t.colors.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, ...t.shadow }}>
            <Text variant="label" tone="onAccent" center>
              {message}
            </Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
