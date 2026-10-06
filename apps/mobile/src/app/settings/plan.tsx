import { normalizeGhanaPhone, PAYMENT_METHODS, PLANS, type PaymentMethod, type PlanId } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, keys, useProfile } from '@/lib/hooks/queries';
import { Button, Card, Chip, ChipRow, Icon, Screen, SectionTitle, StatusPill, Text, TextField, useTheme, useToast } from '@/ui';

export default function Plan() {
  const t = useTheme();
  const b = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useProfile();
  const current = profile.data?.plan ?? 'free';
  const [plan, setPlan] = useState<Exclude<PlanId, 'free'>>('premium');
  const [method, setMethod] = useState<PaymentMethod>('mtn_momo');
  const [payPhone, setPayPhone] = useState(profile.data?.phone.replace('+233', '0') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await b.startSubscription(plan, method, method === 'card' ? null : payPhone);
      if (sub.status === 'active') {
        haptic.success();
        toast(`You're on ${PLANS[plan].name}`);
        await qc.invalidateQueries({ queryKey: keys.profile });
      } else if (sub.status === 'failed') setError('The payment did not go through. Try again.');
      else setPending(sub.providerRef);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Plan"
      testID="plan-screen"
      footer={
        current === plan ? undefined : (
          <Button label={`Pay GHS ${PLANS[plan].priceGhsMonthly} a month`} onPress={pay} loading={busy} disabled={method !== 'card' && !normalizeGhanaPhone(payPhone)} testID="plan-pay" />
        )
      }
    >
      {(['free', 'premium', 'family'] as const).map((id) => {
        const p = PLANS[id];
        const selected = id !== 'free' && plan === id;
        return (
          <Card
            key={id}
            tone={selected ? 'primarySoft' : 'surface'}
            onPress={id === 'free' ? undefined : () => setPlan(id)}
            testID={`plan-${id}`}
            style={selected ? { borderWidth: 2, borderColor: t.colors.primary } : undefined}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="title">{p.name}</Text>
              {current === id ? <StatusPill label="Your plan" tone="success" /> : <Text variant="headline">{p.priceGhsMonthly ? `GHS ${p.priceGhsMonthly}/mo` : 'Free'}</Text>}
            </View>
            {p.features.map((f) => (
              <View key={f} style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <Icon name="checkmark" size={16} color={t.colors.primary} />
                <Text>{f}</Text>
              </View>
            ))}
          </Card>
        );
      })}
      {current !== plan ? (
        <>
          <SectionTitle>Pay with</SectionTitle>
          <ChipRow>
            {PAYMENT_METHODS.map((m) => (
              <Chip key={m.id} label={m.label} selected={method === m.id} onPress={() => setMethod(m.id)} testID={`pay-${m.id}`} />
            ))}
          </ChipRow>
          {method !== 'card' ? <TextField label="Mobile money number" prefix="+233" value={payPhone} onChangeText={setPayPhone} keyboardType="phone-pad" /> : null}
          <Text variant="caption" tone="muted">
            Overdue alerts and SOS are always sent, whatever your plan.
          </Text>
        </>
      ) : null}
      {pending ? (
        <Card tone="warningSoft">
          <Text variant="bodyStrong">Approve the payment on your phone</Text>
          <Text style={{ marginTop: 4 }}>You'll get a prompt from your mobile money provider. Enter your PIN to finish.</Text>
          <Button
            label="I've approved it"
            variant="secondary"
            style={{ marginTop: 10 }}
            onPress={async () => {
              const s = await b.confirmPayment(pending);
              if (s.status === 'active') {
                setPending(null);
                toast(`You're on ${PLANS[s.plan].name}`);
                await qc.invalidateQueries({ queryKey: keys.profile });
              } else setError(s.status === 'failed' ? 'The payment did not go through.' : 'Still waiting for the payment.');
            }}
          />
        </Card>
      ) : null}
      {error ? <Text tone="danger">{error}</Text> : null}
    </Screen>
  );
}
