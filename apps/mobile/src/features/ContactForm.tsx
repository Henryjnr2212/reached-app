import { zodResolver } from '@hookform/resolvers/zod';
import { CHANNELS, guessRelationship, normalizeGhanaPhone, RELATIONSHIPS, type Channel, type Relationship } from '@reached/core';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import type { ContactInput } from '@/lib/backend/types';
import { Chip, ChipRow, Segmented, SwitchRow, Text, TextField } from '@/ui';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter their name.').max(40, 'Keep it under 40 letters.'),
  phone: z.string().refine((v) => !!normalizeGhanaPhone(v), 'Enter a Ghana mobile number, like 024 123 4567.'),
  relationship: z.enum(RELATIONSHIPS),
  channel: z.enum(['sms', 'whatsapp', 'both']),
  isDefault: z.boolean(),
  isEmergency: z.boolean(),
});

export type ContactFormValues = z.infer<typeof schema>;

export function useContactForm(initial?: Partial<ContactFormValues>) {
  return useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      relationship: 'Mom',
      channel: 'sms',
      isDefault: true,
      isEmergency: true,
      ...initial,
    },
  });
}

export function toContactInput(v: ContactFormValues): ContactInput {
  return { ...v, name: v.name.trim(), phone: normalizeGhanaPhone(v.phone)! };
}

/** Name, number, relationship and "reach by" fields, shared by onboarding and Add contact. */
export function ContactFields({ form, serverError, showSwitches = true }: { form: ReturnType<typeof useContactForm>; serverError?: string | null; showSwitches?: boolean }) {
  const { control, setValue, getValues } = form;
  return (
    <View style={{ gap: 16 }}>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            label="Name"
            value={field.value}
            onChangeText={(v) => {
              field.onChange(v);
              if (!form.formState.dirtyFields.relationship) setValue('relationship', guessRelationship(v) === 'Other' ? getValues('relationship') : guessRelationship(v));
            }}
            onBlur={field.onBlur}
            autoCapitalize="words"
            placeholder="Mom"
            error={fieldState.error?.message}
            testID="contact-name"
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <TextField
            label="Phone number"
            prefix="+233"
            value={field.value.replace(/^\+233/, '0')}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="phone-pad"
            placeholder="24 123 4567"
            error={fieldState.error?.message ?? serverError ?? null}
            testID="contact-phone"
          />
        )}
      />
      <Controller
        control={control}
        name="relationship"
        render={({ field }) => (
          <View style={{ gap: 8 }}>
            <Text variant="label">Relationship</Text>
            <ChipRow scroll={false}>
              {RELATIONSHIPS.map((r) => (
                <Chip key={r} label={r} selected={field.value === r} onPress={() => setValue('relationship', r as Relationship, { shouldDirty: true })} testID={`rel-${r}`} />
              ))}
            </ChipRow>
          </View>
        )}
      />
      <Controller
        control={control}
        name="channel"
        render={({ field }) => (
          <Segmented<Channel> label="Reach them by" options={CHANNELS.map((c) => ({ value: c.key, label: c.label }))} value={field.value} onChange={field.onChange} />
        )}
      />
      {showSwitches ? (
        <View>
          <Controller
            control={control}
            name="isDefault"
            render={({ field }) => (
              <SwitchRow title="Tell them about my arrivals" subtitle="Ticked by default when you start a trip" value={field.value} onChange={field.onChange} icon="star" />
            )}
          />
          <Controller
            control={control}
            name="isEmergency"
            render={({ field }) => (
              <SwitchRow title="Emergency contact" subtitle="Alerted if you're overdue or send an SOS" value={field.value} onChange={field.onChange} icon="shield" tint="danger" />
            )}
          />
        </View>
      ) : null}
    </View>
  );
}
