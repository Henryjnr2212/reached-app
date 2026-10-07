import { normalizeGhanaPhone } from '@reached/core';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { useBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/hooks/queries';
import { useApp } from '@/lib/store';
import { legalUrl } from '@/features/links';
import { Banner, Button, Screen, Text, TextField } from '@/ui';

export default function Phone() {
  const b = useBackend();
  const online = useApp((s) => s.online);
  const set = useApp((s) => s.set);
  const [phone, setPhone] = useState(useApp.getState().pendingPhone?.replace('+233', '0') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e164 = normalizeGhanaPhone(phone);

  const send = async () => {
    if (!e164) return;
    setBusy(true);
    setError(null);
    try {
      await b.sendOtp(e164);
      set({ pendingPhone: e164 });
      router.push('/onboarding/verify');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title=""
      testID="phone-screen"
      footer={<Button label="Send code" onPress={send} disabled={!e164 || !online} loading={busy} testID="send-code" />}
    >
      <View style={{ gap: 8 }}>
        <Text variant="display" accessibilityRole="header">
          What's your number?
        </Text>
        <Text tone="muted">We'll text you a 6-digit code to confirm it's you.</Text>
      </View>
      {!online ? <Banner tone="warning" icon="cloud-offline" title="Connect to the internet to sign up" actionLabel="Try again" onAction={() => set({ online: true })} /> : null}
      <TextField
        label="Phone number"
        prefix="+233"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="24 123 4567"
        maxLength={13}
        error={error ?? (phone.length >= 9 && !e164 ? 'Enter a Ghana mobile number, like 024 123 4567.' : null)}
        testID="phone-input"
        onSubmitEditing={send}
      />
      <Text variant="caption" tone="muted">
        By continuing you agree to the{' '}
        <Text variant="caption" tone="primary" onPress={() => void WebBrowser.openBrowserAsync(legalUrl('terms'))} accessibilityRole="link">
          Terms
        </Text>{' '}
        and{' '}
        <Text variant="caption" tone="primary" onPress={() => void WebBrowser.openBrowserAsync(legalUrl('privacy'))} accessibilityRole="link">
          Privacy Policy
        </Text>
        . You must be 16 or older.
      </Text>
    </Screen>
  );
}
