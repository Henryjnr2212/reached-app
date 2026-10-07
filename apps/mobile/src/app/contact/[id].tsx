import { describeRule, formatGhanaPhone, LANGUAGES, type Channel, type Language } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ContactFields, toContactInput, useContactForm } from '@/features/ContactForm';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, keys, useContacts, usePlaces, useRules } from '@/lib/hooks/queries';
import { Avatar, Banner, Button, Card, Chip, ChipRow, ConfirmSheet, EmptyState, ListRow, Screen, SectionTitle, SkeletonList, SwitchRow, Text, useToast } from '@/ui';

export default function ContactDetail() {
  const b = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contacts = useContacts();
  const rules = useRules();
  const places = usePlaces();
  const contact = contacts.data?.find((c) => c.id === id);
  const form = useContactForm();
  const [language, setLanguage] = useState<Language>('en');
  const [canAsk, setCanAsk] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contact) return;
    form.reset({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      channel: contact.channel as Channel,
      isDefault: contact.isDefault,
      isEmergency: contact.isEmergency,
    });
    setLanguage(contact.language);
    setCanAsk(contact.canRequestLocation);
    // Reset only when a different contact loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  if (!contact) {
    return <Screen title="Contact">{contacts.isLoading ? <SkeletonList /> : <EmptyState icon="person" title="Contact not found" body="They may have been removed." />}</Screen>;
  }

  const theirRules = (rules.data ?? []).filter((r) => r.contactIds.includes(contact.id));
  const placeName = (pid: string) => places.data?.find((p) => p.id === pid)?.name ?? 'a place';

  const save = form.handleSubmit(async (v) => {
    setBusy('save');
    setError(null);
    try {
      await b.updateContact(contact.id, { ...toContactInput(v), language, canRequestLocation: canAsk });
      haptic.success();
      await qc.invalidateQueries({ queryKey: keys.contacts });
      toast('Saved');
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  });

  return (
    <Screen title="" testID="contact-detail" footer={<Button label="Save changes" onPress={save} loading={busy === 'save'} testID="contact-update" />}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar name={contact.name} size={72} />
        <Text variant="title">{contact.name}</Text>
        <Text tone="muted">{formatGhanaPhone(contact.phone)}</Text>
      </View>
      {contact.optedOut ? <Banner tone="danger" icon="hand-left" title={`${contact.name} replied STOP`} body="We won't text them until they reply START." /> : null}
      {contact.lastFailedAt ? <Banner tone="warning" icon="alert-circle" title="A message to them failed" body="Check the number, then send a test message." /> : null}
      <Button
        label="Send test message"
        icon="paper-plane"
        variant="secondary"
        loading={busy === 'test'}
        testID="send-test"
        onPress={async () => {
          setBusy('test');
          try {
            const eventId = await b.sendTestMessage(contact.id);
            await qc.invalidateQueries({ queryKey: keys.events });
            router.push({ pathname: '/event/[id]', params: { id: eventId } });
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(null);
          }
        }}
      />
      <ContactFields form={form} serverError={error} />
      <SectionTitle>Message language</SectionTitle>
      <ChipRow>
        {LANGUAGES.map((l) => (
          <Chip key={l.code} label={l.status === 'draft' ? `${l.label} (beta)` : l.label} selected={language === l.code} onPress={() => setLanguage(l.code)} />
        ))}
      </ChipRow>
      <Card padded={false}>
        <SwitchRow title="Can ask where I am" subtitle="They can text REACHED to ask. You always choose to accept." value={canAsk} onChange={setCanAsk} icon="hand-left" tint="warning" />
      </Card>
      <SectionTitle>{`Rules with ${contact.name}`}</SectionTitle>
      {theirRules.length ? (
        <Card padded={false}>
          {theirRules.map((r) => (
            <ListRow key={r.id} title={`${placeName(r.placeId)}: ${describeRule(r, () => contact.name)}`} icon="location" chevron onPress={() => router.push({ pathname: '/rule/[id]', params: { id: r.id, placeId: r.placeId } })} />
          ))}
        </Card>
      ) : (
        <Text tone="muted">Not in any place rules yet.</Text>
      )}
      <Button label="Remove contact" icon="trash-outline" variant="dangerSoft" onPress={() => setConfirm(true)} testID="remove-contact" />
      <ConfirmSheet
        visible={confirm}
        title={`Remove ${contact.name}?`}
        body="They'll be removed from all your rules and won't get any more texts."
        confirmLabel="Remove"
        destructive
        loading={busy === 'remove'}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy('remove');
          await b.removeContact(contact.id);
          await Promise.all([qc.invalidateQueries({ queryKey: keys.contacts }), qc.invalidateQueries({ queryKey: keys.rules })]);
          setBusy(null);
          setConfirm(false);
          router.back();
        }}
      />
    </Screen>
  );
}
