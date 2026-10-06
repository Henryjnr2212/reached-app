import { ASK_FIRST_TIMEOUT_OPTIONS, formatClock, GRACE_OPTIONS, renderCustom, renderSms } from '@reached/core';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { MessageEditor } from '@/features/MessageEditor';
import { keys, useAction, useProfile } from '@/lib/hooks/queries';
import type { ProfilePatch } from '@/lib/backend/types';
import { Card, Screen, SectionTitle, Segmented, SkeletonList, SwitchRow, Text } from '@/ui';

export default function ArrivalSettings() {
  const profile = useProfile();
  const update = useAction((b, patch: ProfilePatch) => b.updateProfile(patch), [keys.profile]);
  const [editor, setEditor] = useState(false);
  const p = profile.data;
  if (!p)
    return (
      <Screen title="Arrivals">
        <SkeletonList />
      </Screen>
    );
  const sample = { name: p.firstName ?? 'You', place: 'Work', time: formatClock(new Date()) };
  const preview = p.defaultMessage ? renderCustom(p.defaultMessage, sample) : renderSms('arrived', sample);
  return (
    <Screen title="Arrivals" testID="arrival-settings">
      <SectionTitle>How arrivals are sent</SectionTitle>
      <Segmented<'auto' | 'ask'>
        label="When you arrive"
        options={[
          { value: 'auto', label: 'Send automatically' },
          { value: 'ask', label: 'Ask me first' },
        ]}
        value={p.arrivalMode}
        onChange={(v) => update.mutate({ arrivalMode: v })}
      />
      {p.arrivalMode === 'ask' ? (
        <Segmented<string>
          label="If I don't answer, send after"
          options={ASK_FIRST_TIMEOUT_OPTIONS.map((m) => ({ value: String(m), label: m === null ? 'Never' : `${m} min` }))}
          value={String(p.askTimeoutMin)}
          onChange={(v) => update.mutate({ askTimeoutMin: v === 'null' ? null : (Number(v) as 5 | 10) })}
        />
      ) : null}
      <SectionTitle>Default message</SectionTitle>
      <Card tone="muted">
        <Text testID="default-message-preview">{preview}</Text>
        <Pressable accessibilityRole="button" onPress={() => setEditor(true)} style={{ minHeight: 48, justifyContent: 'center' }} testID="edit-default-message">
          <Text variant="label" tone="primary">
            Edit message
          </Text>
        </Pressable>
      </Card>
      <SectionTitle>Late check</SectionTitle>
      <Segmented<number> label="Grace period before we check on you" options={GRACE_OPTIONS.map((g) => ({ value: g, label: `${g} min` }))} value={p.graceMinutes} onChange={(v) => update.mutate({ graceMinutes: v })} />
      <SectionTitle>Smart arrivals</SectionTitle>
      <Card padded={false}>
        <SwitchRow
          title="Auto-detect arrivals"
          subtitle={'Notices when you stop somewhere new and texts "arrived safely in East Legon"'}
          value={p.autoDetect}
          onChange={(v) => update.mutate({ autoDetect: v })}
          icon="sparkles"
          testID="auto-detect"
        />
        <SwitchRow
          title="Heading-out prompts"
          subtitle={'Offers "Notify when I arrive" when you leave a place'}
          value={p.headingOutPrompts}
          onChange={(v) => update.mutate({ headingOutPrompts: v })}
          icon="walk"
          testID="heading-out"
        />
      </Card>
      <MessageEditor
        visible={editor}
        value={p.defaultMessage}
        sample={sample}
        onClose={() => setEditor(false)}
        onSave={(v) => {
          update.mutate({ defaultMessage: v });
          setEditor(false);
        }}
      />
    </Screen>
  );
}
