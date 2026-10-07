import { router } from 'expo-router';
import { Platform, View } from 'react-native';
import { Hero } from '@/features/Hero';
import { getNotificationAccess, requestNotifications } from '@/lib/device/notifications';
import { useApp } from '@/lib/store';
import { Button, Screen, Text } from '@/ui';

export default function NotificationsExplainer() {
  const set = useApp((s) => s.set);
  const next = () => router.replace(Platform.OS === 'android' ? '/onboarding/battery' : '/onboarding/home');
  return (
    <Screen
      title=""
      back={false}
      testID="notifications-explainer"
      footer={
        <View style={{ gap: 10 }}>
          <Button
            label="Turn on"
            icon="notifications"
            testID="notifications-on"
            onPress={async () => {
              await requestNotifications();
              set({ notifications: await getNotificationAccess() });
              next();
            }}
          />
          <Button label="Not now" variant="ghost" onPress={next} testID="notifications-not-now" />
        </View>
      }
    >
      <Hero icon="notifications" tone="info" badges={['alarm', 'checkmark-done']} height={240} />
      <View style={{ gap: 8 }}>
        <Text variant="display" accessibilityRole="header">
          We'll check on you
        </Text>
        <Text tone="muted">We'll check on you if you're running late, and tell you when your people have been told.</Text>
      </View>
    </Screen>
  );
}
