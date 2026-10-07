import { formatGhanaPhone } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { DEMO_OTP, useBackend } from '@/lib/backend';
import { errorMessage, useProfile } from '@/lib/hooks/queries';
import { Banner, Button, Card, OtpInput, Screen, Text } from '@/ui';

export default function DeleteAccount() {
  const b = useBackend();
  const qc = useQueryClient();
  const profile = useProfile();
  const [step, setStep] = useState<'explain' | 'code'>('explain');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = profile.data?.phone;

  return (
    <Screen title="Delete account" testID="delete-account-screen">
      {step === 'explain' ? (
        <>
          <Text tone="muted">This deletes your account, contacts, places, rules and history. Your contacts get no more texts from Reached. It can't be undone.</Text>
          <Card tone="dangerSoft">
            <Text variant="bodyStrong">What happens</Text>
            <Text style={{ marginTop: 6 }}>{'• Deleted from Reached straight away\n• Removed from backups within 30 days\n• Your number can sign up again later'}</Text>
          </Card>
          <Button
            label="Text me a code"
            variant="danger"
            loading={busy}
            testID="delete-send-code"
            onPress={async () => {
              if (!phone) return;
              setBusy(true);
              setError(null);
              try {
                await b.sendOtp(phone);
                setStep('code');
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      ) : (
        <View style={{ gap: 16 }}>
          <Text tone="muted">Enter the code we sent to {phone ? formatGhanaPhone(phone) : 'your phone'} to confirm.</Text>
          {b.kind === 'demo' ? <Banner tone="info" icon="flask" title={`Demo mode: the code is ${DEMO_OTP}`} /> : null}
          <OtpInput value={code} onChange={setCode} error={!!error} />
          <Button
            label="Delete my account"
            variant="danger"
            disabled={code.length !== 6}
            loading={busy}
            testID="delete-confirm"
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await b.deleteAccount(code);
                qc.clear();
                router.replace('/onboarding/welcome');
              } catch (e) {
                setError(errorMessage(e));
                setCode('');
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      )}
      {error ? <Text tone="danger">{error}</Text> : null}
    </Screen>
  );
}
