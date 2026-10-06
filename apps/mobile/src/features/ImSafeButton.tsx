import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { confirmIdentity } from '@/lib/device/localAuth';
import { errorMessage, TRIP_KEYS } from '@/lib/hooks/queries';
import { Button, ConfirmSheet, Text } from '@/ui';

/** "I'm safe now" — needs the phone unlock (or an in-app confirm on phones without a lock). */
export function ImSafeButton() {
  const b = useBackend();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await b.imSafe();
      haptic.success();
      await Promise.all(TRIP_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
      router.replace('/(tabs)');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <>
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button
        label="I'm safe now"
        icon="shield-checkmark"
        loading={busy}
        testID="im-safe"
        onPress={async () => {
          const r = await confirmIdentity('Confirm it is you to send "all clear"');
          if (r === 'ok') await send();
          else if (r === 'unavailable') setConfirm(true);
          else setError("We couldn't confirm it's you. Try again.");
        }}
      />
      <ConfirmSheet
        visible={confirm}
        title="Send all clear?"
        body="Your emergency contacts will get a text that you are safe."
        confirmLabel="Yes, I'm safe"
        onConfirm={send}
        onCancel={() => setConfirm(false)}
        loading={busy}
      />
    </>
  );
}
