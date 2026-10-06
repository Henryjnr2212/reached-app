import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackendProvider } from '@/lib/backend';
import '@/lib/device/tasks';
import { setupNotifications } from '@/lib/device/notifications';
import { useProfile, useSession } from '@/lib/hooks/queries';
import { useDeviceStatus, useForegroundTracker, useOverdueWatcher, usePushRouting } from '@/lib/hooks/useRuntime';
import { ThemeProvider, ToastProvider, useTheme } from '@/ui';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Runtime() {
  const session = useSession();
  const signedIn = !!session.data;
  const profile = useProfile(signedIn);
  const ready = signedIn && !!profile.data?.onboardedAt;
  useDeviceStatus();
  useForegroundTracker(ready);
  useOverdueWatcher(ready);
  usePushRouting(ready);
  return null;
}

function Themed() {
  const session = useSession();
  const profile = useProfile(!!session.data);
  return (
    <ThemeProvider appearance={profile.data?.appearance ?? 'system'}>
      <ToastProvider>
        <Navigator />
        <Runtime />
      </ToastProvider>
    </ThemeProvider>
  );
}

function Navigator() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.background }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="overdue" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="sos" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="trip/arrived" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fonts] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } }));

  useEffect(() => {
    void setupNotifications().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (fonts) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fonts]);
  if (!fonts) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <BackendProvider>
            <Themed />
          </BackendProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
