import { SOS_COUNTDOWN_OPTIONS } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useBackend } from '@/lib/backend';
import type { ProfilePatch } from '@/lib/backend/types';
import { keys, useAction, useContacts, useProfile } from '@/lib/hooks/queries';
import { EmergencyNumbers } from '@/features/EmergencyNumbers';
import { Card, ListRow, Screen, SectionTitle, Segmented, SkeletonList, Slider, SwitchRow, Text } from '@/ui';

export default function SafetySettings() {
  const b = useBackend();
  const qc = useQueryClient();
  const profile = useProfile();
  const contacts = useContacts();
  const update = useAction((bk, patch: ProfilePatch) => bk.updateProfile(patch), [keys.profile]);
  const p = profile.data;
  if (!p)
    return (
      <Screen title="Emergency and SOS">
        <SkeletonList />
      </Screen>
    );
  return (
    <Screen title="Emergency and SOS" testID="safety-settings">
      <SectionTitle>Emergency contacts</SectionTitle>
      <Text variant="caption" tone="muted">
        Alerted if you're overdue or send an SOS. They can be different from the people told about arrivals.
      </Text>
      <Card padded={false}>
        {(contacts.data ?? []).map((c) => (
          <SwitchRow
            key={c.id}
            title={c.name}
            subtitle={c.relationship}
            value={c.isEmergency}
            icon="shield"
            tint="danger"
            testID={`emergency-${c.name}`}
            onChange={async (v) => {
              await b.updateContact(c.id, { isEmergency: v });
              await qc.invalidateQueries({ queryKey: keys.contacts });
            }}
          />
        ))}
      </Card>
      <SectionTitle>SOS</SectionTitle>
      <Card>
        <Slider label="Hold the shield for" value={p.sosHoldSeconds} min={2} max={5} step={1} onChange={(v) => update.mutate({ sosHoldSeconds: v })} format={(v) => `${v} seconds`} />
        <Segmented<number>
          label="Countdown before sending"
          options={SOS_COUNTDOWN_OPTIONS.map((s) => ({ value: s, label: `${s} seconds` }))}
          value={p.sosCountdownSeconds}
          onChange={(v) => update.mutate({ sosCountdownSeconds: v as 5 | 10 })}
        />
      </Card>
      <Card padded={false}>
        <ListRow title="Hands-free SOS" subtitle="Lock screen, voice, power button" icon="hand-right" tint="danger" chevron onPress={() => router.push('/settings/hands-free')} />
        <ListRow title="Nearest police stations" icon="business" tint="info" chevron onPress={() => router.push('/settings/police')} testID="police-finder" />
        <SwitchRow
          title="Also alert the police"
          subtitle="Available once our police partnership is live. Until then, your contacts are told to call the police."
          value={p.alsoAlertPolice}
          onChange={(v) => update.mutate({ alsoAlertPolice: v })}
          icon="megaphone"
          tint="warning"
        />
      </Card>
      <SectionTitle>Emergency numbers</SectionTitle>
      <EmergencyNumbers />
    </Screen>
  );
}
