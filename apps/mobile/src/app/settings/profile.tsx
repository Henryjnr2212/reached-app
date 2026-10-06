import { formatGhanaPhone, normalizeGhanaPhone } from '@reached/core';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useBackend } from '@/lib/backend';
import { haptic } from '@/lib/device/haptics';
import { errorMessage, keys, useAction, useProfile } from '@/lib/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, BottomSheet, Button, Card, ListRow, OtpInput, Screen, Text, TextField, useToast } from '@/ui';

export default function Profile() {
  const b = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useProfile();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [change, setChange] = useState<'off' | 'number' | 'code'>('off');
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const save = useAction((bk, _: void) => bk.updateProfile({ firstName: name.trim(), email: email.trim() || null, photoUri: photo }), [keys.profile]);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.firstName ?? '');
    setEmail(profile.data.email ?? '');
    setPhoto(profile.data.photoUri);
  }, [profile.data]);

  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <Screen
      title="Profile"
      testID="profile-screen"
      footer={
        <Button
          label="Save"
          disabled={!name.trim() || !emailOk}
          loading={save.isPending}
          testID="profile-save"
          onPress={async () => {
            await save.mutateAsync();
            haptic.success();
            toast('Saved');
          }}
        />
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change photo"
        style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }}
        onPress={async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
          if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
        }}
      >
        {photo ? <Image source={{ uri: photo }} style={{ width: 96, height: 96, borderRadius: 48 }} /> : <Avatar name={name || '?'} size={96} />}
        <Text variant="label" tone="primary">
          Change photo
        </Text>
      </Pressable>
      <TextField label="First name" value={name} onChangeText={setName} error={!name.trim() ? 'Enter your first name.' : null} testID="profile-name" />
      <TextField label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={emailOk ? null : 'Check the email address.'} />
      <Card padded={false}>
        <ListRow title="Phone number" subtitle={profile.data ? formatGhanaPhone(profile.data.phone) : ''} icon="call" right={<Text variant="label" tone="primary">Change</Text>} onPress={() => setChange('number')} />
      </Card>
      {save.error ? <Text tone="danger">{errorMessage(save.error)}</Text> : null}

      <BottomSheet visible={change !== 'off'} onClose={() => setChange('off')} title="Change number">
        {change === 'number' ? (
          <View style={{ gap: 14 }}>
            <TextField label="New number" prefix="+233" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" error={phoneError} />
            <Button
              label="Send code"
              disabled={!normalizeGhanaPhone(newPhone)}
              onPress={async () => {
                setPhoneError(null);
                try {
                  await b.startPhoneChange(newPhone);
                  setChange('code');
                } catch (e) {
                  setPhoneError(errorMessage(e));
                }
              }}
            />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Text tone="muted">Enter the code we texted to {formatGhanaPhone(normalizeGhanaPhone(newPhone) ?? '')}.</Text>
            <OtpInput
              value={code}
              error={!!phoneError}
              onChange={async (v) => {
                setCode(v);
                setPhoneError(null);
                if (v.length < 6) return;
                try {
                  await b.confirmPhoneChange(newPhone, v);
                  await qc.invalidateQueries({ queryKey: keys.profile });
                  haptic.success();
                  setChange('off');
                  toast('Number changed');
                } catch (e) {
                  setPhoneError(errorMessage(e));
                  setCode('');
                }
              }}
            />
            {phoneError ? <Text tone="danger">{phoneError}</Text> : null}
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}
