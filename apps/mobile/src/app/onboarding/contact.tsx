import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ContactFields, toContactInput, useContactForm } from '@/features/ContactForm';
import { Hero } from '@/features/Hero';
import { PhoneContactPicker } from '@/features/PhoneContactPicker';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, keys, useContacts } from '@/lib/hooks/queries';
import { Button, Screen, Text, useToast } from '@/ui';

/** "Who should know you're safe?" */
export default function FirstContact() {
  const b = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const contacts = useContacts();
  const [mode, setMode] = useState<'choose' | 'enter'>('choose');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useContactForm();

  const next = () => router.replace('/onboarding/location');

  const save = form.handleSubmit(async (v) => {
    setBusy(true);
    setError(null);
    try {
      const c = await b.addContact(toContactInput(v));
      haptic.success();
      await qc.invalidateQueries({ queryKey: keys.contacts });
      toast(`We've texted ${c.name} to say they're your safety contact.`);
      next();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  if (mode === 'enter') {
    return (
      <Screen
        title="Add someone"
        onBack={() => setMode('choose')}
        testID="first-contact-form"
        footer={<Button label="Save" onPress={save} loading={busy} testID="contact-save" />}
      >
        <ContactFields form={form} serverError={error} />
        <Text variant="caption" tone="muted">
          We'll text them once to say you added them. They can reply STOP to opt out.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen
      title=""
      back={false}
      testID="first-contact"
      footer={
        <View style={{ gap: 10 }}>
          <Button label="Choose from contacts" icon="people" onPress={() => setPicker(true)} />
          <Button label="Enter number" variant="secondary" icon="keypad" onPress={() => setMode('enter')} testID="enter-number" />
          <Button label={contacts.data?.length ? 'Continue' : 'Skip for now'} variant="ghost" onPress={next} testID="contact-skip" />
        </View>
      }
    >
      <Hero icon="people" badges={['heart', 'chatbubble']} height={220} />
      <View style={{ gap: 8 }}>
        <Text variant="display" accessibilityRole="header">
          Who should know you're safe?
        </Text>
        <Text tone="muted">Pick one person to start. They don't need the app; they'll get a text.</Text>
      </View>
      <PhoneContactPicker
        visible={picker}
        onClose={() => {
          setPicker(false);
        }}
        onPick={(c) => {
          setPicker(false);
          form.reset({ ...form.getValues(), name: c.name, phone: c.phone });
          setMode('enter');
        }}
      />
    </Screen>
  );
}
