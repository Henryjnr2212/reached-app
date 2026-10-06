import { canAdd } from '@reached/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ContactFields, toContactInput, useContactForm } from '@/features/ContactForm';
import { PhoneContactPicker } from '@/features/PhoneContactPicker';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, keys, useContacts, useProfile } from '@/lib/hooks/queries';
import { Banner, Button, Screen, Text, useToast } from '@/ui';

export default function NewContact() {
  const b = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const contacts = useContacts();
  const profile = useProfile();
  const form = useContactForm();
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = !canAdd('contact', contacts.data?.length ?? 0, profile.data?.plan ?? 'free');

  const save = form.handleSubmit(async (v) => {
    setBusy(true);
    setError(null);
    try {
      const c = await b.addContact(toContactInput(v));
      haptic.success();
      await qc.invalidateQueries({ queryKey: keys.contacts });
      toast(`Added ${c.name}. We've texted them to let them know.`);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Screen
      title="Add contact"
      testID="new-contact"
      footer={<Button label="Save" onPress={save} loading={busy} disabled={full} testID="contact-save" />}
    >
      {full ? <Banner tone="warning" icon="lock-closed" title="You've reached the contact limit" body="Upgrade to Premium for up to 15 people." actionLabel="See plans" onAction={() => router.push('/settings/plan')} /> : null}
      <Button label="Choose from contacts" icon="people" variant="secondary" onPress={() => setPicker(true)} />
      <ContactFields form={form} serverError={error} />
      <Text variant="caption" tone="muted">
        We'll text them once to say you added them. They can reply STOP to opt out.
      </Text>
      <PhoneContactPicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(c) => {
          setPicker(false);
          form.reset({ ...form.getValues(), name: c.name, phone: c.phone });
        }}
      />
    </Screen>
  );
}
