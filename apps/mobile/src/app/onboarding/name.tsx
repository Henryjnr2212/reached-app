import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Image, Pressable, View } from 'react-native';
import { z } from 'zod';
import { keys, useAction, useProfile } from '@/lib/hooks/queries';
import { Button, Icon, Screen, Text, TextField, useTheme } from '@/ui';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name. We use it in your messages.').max(40, 'Keep it under 40 letters.'),
  photoUri: z.string().nullable(),
});
type Form = z.infer<typeof schema>;

export default function Name() {
  const t = useTheme();
  const profile = useProfile();
  const save = useAction((b, f: Form) => b.updateProfile({ firstName: f.firstName.trim(), photoUri: f.photoUri }), [keys.profile]);
  const { control, handleSubmit, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    values: { firstName: profile.data?.firstName ?? '', photoUri: profile.data?.photoUri ?? null },
  });
  const photo = watch('photoUri');

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!r.canceled && r.assets[0]) setValue('photoUri', r.assets[0].uri);
  };

  const submit = handleSubmit(async (f) => {
    await save.mutateAsync(f);
    router.replace('/onboarding/contact');
  });

  return (
    <Screen title="" back={false} testID="name-screen" footer={<Button label="Continue" onPress={submit} loading={save.isPending} testID="name-continue" />}>
      <View style={{ gap: 8 }}>
        <Text variant="display" accessibilityRole="header">
          What should we call you?
        </Text>
        <Text tone="muted">Your first name goes in the texts your people get.</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Add a photo (optional)" onPress={pick} style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 96, height: 96 }} /> : <Icon name="camera" size={32} color={t.colors.onPrimarySoft} />}
        </View>
        <Text variant="caption" tone="muted">
          Add a photo (optional)
        </Text>
      </Pressable>
      <Controller
        control={control}
        name="firstName"
        render={({ field, fieldState }) => (
          <TextField
            label="First name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="words"
            autoComplete="given-name"
            placeholder="Ama"
            error={fieldState.error?.message ?? (save.error ? save.error.message : null)}
            testID="name-input"
            onSubmitEditing={submit}
          />
        )}
      />
      {preview()}
    </Screen>
  );

  function preview() {
    const name = watch('firstName')?.trim() || 'Ama';
    return (
      <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 6 }}>
        <Text variant="small" tone="muted">
          PREVIEW
        </Text>
        <Text>{`${name} has arrived safely at Work (8:42am). - Reached`}</Text>
      </View>
    );
  }
}
