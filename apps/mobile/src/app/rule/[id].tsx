import { daysForPreset, formatClock, presetForDays, renderCustom, renderSms, validateRule, type DaysPreset, type RuleEvent } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MessageEditor } from '@/features/MessageEditor';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, keys, useContacts, usePlaces, useProfile, useRules } from '@/lib/hooks/queries';
import { Button, Card, Chip, ChipRow, ConfirmSheet, Screen, SectionTitle, Segmented, Text, TextField } from '@/ui';

const DAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RuleScreen() {
  const b = useBackend();
  const qc = useQueryClient();
  const { id, placeId } = useLocalSearchParams<{ id: string; placeId: string }>();
  const rules = useRules();
  const places = usePlaces();
  const contacts = useContacts();
  const profile = useProfile();
  const existing = id !== 'new' ? rules.data?.find((r) => r.id === id) : undefined;
  const place = places.data?.find((p) => p.id === (existing?.placeId ?? placeId));

  const [event, setEvent] = useState<RuleEvent>('arrive');
  const [ids, setIds] = useState<string[]>([]);
  const [days, setDays] = useState<number[]>(daysForPreset('every_day'));
  const [preset, setPreset] = useState<DaysPreset>('every_day');
  const [anyTime, setAnyTime] = useState(true);
  const [start, setStart] = useState('07:00');
  const [end, setEnd] = useState('10:00');
  const [message, setMessage] = useState<string | null>(null);
  const [editor, setEditor] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    if (existing) {
      setEvent(existing.event);
      setIds(existing.contactIds);
      setDays(existing.days);
      setPreset(presetForDays(existing.days));
      setAnyTime(!existing.windowStart);
      if (existing.windowStart) setStart(existing.windowStart);
      if (existing.windowEnd) setEnd(existing.windowEnd);
      setMessage(existing.message);
      setLoaded(true);
    } else if (id === 'new' && contacts.data) {
      setIds(contacts.data.filter((c) => c.isDefault).map((c) => c.id).slice(0, 1));
      setLoaded(true);
    }
  }, [existing, id, contacts.data, loaded]);

  const sample = { name: profile.data?.firstName ?? 'You', place: place?.name ?? 'Work', time: formatClock(new Date()) };
  const preview = message ? renderCustom(message, sample) : renderSms(event === 'arrive' ? 'arrived' : 'left', sample);
  const timeOk = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

  const save = async () => {
    const windowStart = anyTime ? null : start;
    const windowEnd = anyTime ? null : end;
    if (!anyTime && (!timeOk(start) || !timeOk(end))) return setError('Use 24-hour times like 07:30.');
    const problem = validateRule({ contactIds: ids, days, windowStart, windowEnd });
    if (problem) return setError(problem);
    if (!place) return;
    setBusy(true);
    setError(null);
    try {
      await b.saveRule({ id: existing?.id, placeId: place.id, event, contactIds: ids, days, windowStart, windowEnd, message, enabled: existing?.enabled ?? true });
      haptic.success();
      await qc.invalidateQueries({ queryKey: keys.rules });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={existing ? 'Edit rule' : 'New rule'} testID="rule-screen" footer={<Button label="Save rule" onPress={save} loading={busy} testID="rule-save" />}>
      <Text variant="title">{place?.name ?? ''}</Text>
      <Segmented<RuleEvent>
        label="When I"
        options={[
          { value: 'arrive', label: 'Arrive' },
          { value: 'leave', label: 'Leave' },
        ]}
        value={event}
        onChange={setEvent}
      />
      <SectionTitle>Tell</SectionTitle>
      <ChipRow>
        {(contacts.data ?? []).map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            icon={ids.includes(c.id) ? 'checkmark' : 'add'}
            selected={ids.includes(c.id)}
            onPress={() => setIds((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}
            testID={`rule-contact-${c.name}`}
          />
        ))}
      </ChipRow>
      <SectionTitle>On</SectionTitle>
      <ChipRow scroll={false}>
        {(
          [
            ['every_day', 'Every day'],
            ['weekdays', 'Weekdays'],
            ['weekends', 'Weekends'],
            ['custom', 'Pick days'],
          ] as const
        ).map(([k, label]) => (
          <Chip
            key={k}
            label={label}
            selected={preset === k}
            onPress={() => {
              setPreset(k);
              if (k !== 'custom') setDays(daysForPreset(k));
            }}
          />
        ))}
      </ChipRow>
      {preset === 'custom' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DAY_LETTERS.map((d, i) => (
            <Chip key={d} label={d} selected={days.includes(i)} onPress={() => setDays((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort()))} />
          ))}
        </View>
      ) : null}
      <SectionTitle>At</SectionTitle>
      <Segmented<'any' | 'between'>
        label="Time"
        options={[
          { value: 'any', label: 'Any time' },
          { value: 'between', label: 'Only between' },
        ]}
        value={anyTime ? 'any' : 'between'}
        onChange={(v) => setAnyTime(v === 'any')}
      />
      {!anyTime ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TextField label="From" value={start} onChangeText={setStart} placeholder="07:00" keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="To" value={end} onChangeText={setEnd} placeholder="10:00" keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
        </View>
      ) : null}
      <Card tone="muted">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="small" tone="muted">
            MESSAGE
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setEditor(true)} style={{ minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text variant="label" tone="primary">
              Edit
            </Text>
          </Pressable>
        </View>
        <Text>{preview}</Text>
      </Card>
      {error ? (
        <Text tone="danger" variant="label" testID="rule-error">
          {error}
        </Text>
      ) : null}
      {existing ? <Button label="Delete rule" variant="dangerSoft" icon="trash-outline" onPress={() => setConfirm(true)} /> : null}
      <MessageEditor
        visible={editor}
        value={message}
        sample={sample}
        onClose={() => setEditor(false)}
        onSave={(v) => {
          setMessage(v);
          setEditor(false);
        }}
      />
      <ConfirmSheet
        visible={confirm}
        title="Delete this rule?"
        confirmLabel="Delete rule"
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (existing) await b.deleteRule(existing.id);
          await qc.invalidateQueries({ queryKey: keys.rules });
          setConfirm(false);
          router.back();
        }}
      />
      <Text variant="caption" tone="muted">
        {`Same place can't send the same message twice within an hour.`}
      </Text>
    </Screen>
  );
}
