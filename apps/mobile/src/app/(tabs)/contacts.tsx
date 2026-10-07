import { formatGhanaPhone, PLANS } from '@reached/core';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_SPACE } from '@/features/FloatingTabBar';
import { useContacts, useProfile } from '@/lib/hooks/queries';
import { Avatar, Button, Card, EmptyState, Icon, IconButton, SkeletonList, StatusPill, Text, useTheme } from '@/ui';

export default function Contacts() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const contacts = useContacts();
  const profile = useProfile();
  const limit = PLANS[profile.data?.plan ?? 'free'].maxContacts;
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }} testID="contacts-tab">
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="display" accessibilityRole="header">
            Contacts
          </Text>
          <Text variant="caption" tone="muted">
            {contacts.data?.length ?? 0} of {limit} people
          </Text>
        </View>
        <IconButton icon="person-add" label="Add contact" tone="accent" onPress={() => router.push('/contact/new')} testID="add-contact" />
      </View>
      {contacts.isLoading ? (
        <View style={{ padding: 20 }}>
          <SkeletonList rows={4} />
        </View>
      ) : (
        <FlatList
          data={contacts.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10, paddingBottom: TAB_BAR_SPACE + insets.bottom }}
          ListEmptyComponent={
            <EmptyState
              icon="people"
              title="No one to notify yet"
              body="Add the people who should know you're safe. They don't need the app."
              action={<Button label="Add contact" icon="person-add" full={false} onPress={() => router.push('/contact/new')} />}
            />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: '/contact/[id]', params: { id: item.id } })} testID={`contact-${item.name}`} accessibilityLabel={`${item.name}, ${item.relationship}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={item.name} size={46} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {item.name}
                    </Text>
                    {item.isDefault ? <Icon name="star" size={16} color={t.colors.onWarningSoft} /> : null}
                  </View>
                  <Text variant="caption" tone="muted">
                    {item.relationship} · {formatGhanaPhone(item.phone)}
                  </Text>
                  {item.optedOut || item.lastFailedAt ? (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      {item.optedOut ? <StatusPill label="Opted out" tone="danger" /> : null}
                      {item.lastFailedAt ? <StatusPill label="Message failed" tone="warning" /> : null}
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Reached by ${item.channel === 'both' ? 'SMS and WhatsApp' : item.channel === 'sms' ? 'SMS' : 'WhatsApp'}`}>
                  {item.channel !== 'whatsapp' ? <Icon name="chatbox-ellipses-outline" size={18} color={t.colors.textMuted} /> : null}
                  {item.channel !== 'sms' ? <Icon name="logo-whatsapp" size={18} color={t.colors.textMuted} /> : null}
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
