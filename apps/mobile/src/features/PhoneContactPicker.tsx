import * as Contacts from 'expo-contacts';
import { normalizeGhanaPhone } from '@reached/core';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { Avatar, BottomSheet, Button, EmptyState, ListRow, SkeletonList, Text, TextField } from '@/ui';

export interface PickedContact {
  name: string;
  phone: string;
}

/**
 * "Choose from contacts": explainer first, then the system permission, then
 * a searchable list of the phone's contacts with Ghana numbers. Reached reads
 * only the person chosen.
 */
export function PhoneContactPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (c: PickedContact) => void }) {
  const [step, setStep] = useState<'explain' | 'loading' | 'list' | 'denied'>('explain');
  const [all, setAll] = useState<PickedContact[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) setStep('explain');
  }, [visible]);

  const load = async () => {
    if (Platform.OS === 'web') return setStep('denied');
    setStep('loading');
    const { granted } = await Contacts.requestPermissionsAsync();
    if (!granted) return setStep('denied');
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name], sort: Contacts.SortTypes.FirstName });
    const out: PickedContact[] = [];
    for (const c of data) {
      for (const n of c.phoneNumbers ?? []) {
        const e164 = normalizeGhanaPhone(n.number ?? '');
        if (e164 && c.name) {
          out.push({ name: c.name, phone: e164 });
          break;
        }
      }
    }
    setAll(out);
    setStep('list');
  };

  const shown = useMemo(() => all.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())), [all, q]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Choose from contacts">
      {step === 'explain' ? (
        <View style={{ gap: 16 }}>
          <Text tone="muted">Reached only reads the person you pick. We never upload your address book.</Text>
          <Button label="Continue" onPress={load} testID="contacts-continue" />
        </View>
      ) : step === 'loading' ? (
        <SkeletonList rows={4} />
      ) : step === 'denied' ? (
        <EmptyState icon="people" title="Contacts access is off" body="You can type their number instead." action={<Button label="Enter number" onPress={onClose} />} />
      ) : (
        <View style={{ gap: 12, maxHeight: 460 }}>
          <TextField label="Search" value={q} onChangeText={setQ} placeholder="Search by name" />
          <FlatList
            data={shown}
            keyExtractor={(c) => c.phone}
            initialNumToRender={12}
            renderItem={({ item }) => (
              <ListRow title={item.name} subtitle={item.phone} left={<Avatar name={item.name} size={40} />} onPress={() => onPick(item)} />
            )}
            ListEmptyComponent={<Text tone="muted">No Ghana numbers found.</Text>}
          />
        </View>
      )}
    </BottomSheet>
  );
}
