import { formatGhanaPhone } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { DEMO_OTP, useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { useApp } from '@/lib/store';
import { Banner, OtpInput, Screen, Text } from '@/ui';

const RESEND_SECONDS = 60;

export default function Verify() {
  const b = useBackend();
  const qc = useQueryClient();
  const phone = useApp((s) => s.pendingPhone);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  useEffect(() => {
    if (!phone) router.replace('/onboarding/phone');
  }, [phone]);

  const submit = async (value: string) => {
    if (!phone || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { isNew } = await b.verifyOtp(phone, value);
      haptic.success();
      await qc.resetQueries();
      if (isNew) router.replace('/onboarding/name');
      else router.replace('/(tabs)');
    } catch {
      haptic.warning();
      setError("That code isn't right.");
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="" testID="verify-screen">
      <View style={{ gap: 8 }}>
        <Text variant="display" accessibilityRole="header">
          Enter the code
        </Text>
        <Text tone="muted">Sent by SMS to {phone ? formatGhanaPhone(phone) : 'your phone'}.</Text>
      </View>
      {b.kind === 'demo' ? <Banner tone="info" icon="flask" title={`Demo mode: the code is ${DEMO_OTP}`} /> : null}
      <OtpInput
        value={code}
        error={!!error}
        onChange={(v) => {
          setCode(v);
          setError(null);
          if (v.length === 6) void submit(v);
        }}
      />
      {error ? (
        <Text tone="danger" variant="label" accessibilityLiveRegion="assertive" testID="otp-error">
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text variant="label" tone="primary">
            Change number
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={left > 0}
          onPress={async () => {
            if (!phone) return;
            setLeft(RESEND_SECONDS);
            await b.sendOtp(phone).catch(() => setError("We couldn't send the code. Try again."));
          }}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text variant="label" tone={left > 0 ? 'muted' : 'primary'}>
            {left > 0 ? `Resend code in ${left}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
