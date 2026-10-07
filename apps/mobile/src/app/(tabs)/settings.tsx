import { formatGhanaPhone, PLANS } from '@reached/core';
import * as Application from 'expo-application';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_SPACE } from '@/features/FloatingTabBar';
import { APP_STORE_URL, legalUrl, SUPPORT_WHATSAPP } from '@/features/links';
import { useBackend } from '@/lib/backend';
import { keys, useAction, useProfile } from '@/lib/hooks/queries';
import { Avatar, Card, ConfirmSheet, Icon, ListRow, Segmented, Text, useTheme, type Appearance } from '@/ui';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" tone="muted" style={{ marginLeft: 4 }}>
        {title}
      </Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

export default function Settings() {
  const t = useTheme();
  const b = useBackend();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const [logout, setLogout] = useState(false);
  const appearance = useAction((bk, a: Appearance) => bk.updateProfile({ appearance: a }), [keys.profile]);
  const p = profile.data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: TAB_BAR_SPACE + insets.bottom, gap: 20 }} testID="settings-tab">
      <Text variant="display" accessibilityRole="header">
        Settings
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/settings/profile')}>
        <Card tone="accent">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {p?.photoUri ? <Image source={{ uri: p.photoUri }} style={{ width: 56, height: 56, borderRadius: 28 }} /> : <Avatar name={p?.firstName ?? '?'} size={56} />}
            <View style={{ flex: 1 }}>
              <Text variant="headline" tone="onAccent">
                {p?.firstName ?? ''}
              </Text>
              <Text variant="caption" tone="onAccent" style={{ opacity: 0.85 }}>
                {p ? formatGhanaPhone(p.phone) : ''} · {PLANS[p?.plan ?? 'free'].name} plan
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={t.colors.onAccent} />
          </View>
        </Card>
      </Pressable>

      <Group title="Account">
        <ListRow title="Profile" icon="person" chevron onPress={() => router.push('/settings/profile')} />
        <ListRow title="Plan" subtitle={`${PLANS[p?.plan ?? 'free'].name}`} icon="diamond" tint="info" chevron onPress={() => router.push('/settings/plan')} testID="settings-plan" />
      </Group>

      <Group title="Arrivals">
        <ListRow
          title="How arrivals are sent"
          subtitle={p?.arrivalMode === 'ask' ? 'Ask me first' : 'Send automatically'}
          icon="paper-plane"
          chevron
          onPress={() => router.push('/settings/arrivals')}
          testID="settings-arrivals"
        />
      </Group>

      <Group title="Safety">
        <ListRow title="Emergency and SOS" subtitle="Emergency contacts, SOS, police" icon="shield-checkmark" tint="danger" chevron onPress={() => router.push('/settings/safety')} testID="settings-safety" />
      </Group>

      <Group title="Notifications and permissions">
        <ListRow title="Notifications" icon="notifications" tint="warning" chevron onPress={() => router.push('/settings/notifications')} />
        <ListRow title="Permissions and battery" icon="battery-charging" tint="warning" chevron onPress={() => router.push('/settings/permissions')} testID="settings-permissions" />
      </Group>

      <Group title="Privacy and data">
        <ListRow title="Privacy and data" subtitle="Who sees your location, delete or download data" icon="lock-closed" tint="info" chevron onPress={() => router.push('/settings/privacy')} testID="settings-privacy" />
      </Group>

      <Group title="App and support">
        <ListRow title="Language" icon="language" tint="neutral" chevron onPress={() => router.push('/settings/language')} />
        <View style={{ padding: 14 }}>
          <Segmented<Appearance>
            label="Appearance"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'Match phone' },
            ]}
            value={p?.appearance ?? 'system'}
            onChange={(v) => appearance.mutate(v)}
          />
        </View>
        <ListRow title="Help and FAQ" icon="help-circle" tint="neutral" chevron onPress={() => void WebBrowser.openBrowserAsync(legalUrl('help'))} />
        <ListRow title="Chat with support" subtitle="WhatsApp" icon="logo-whatsapp" tint="primary" chevron onPress={() => void Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`)} />
        <ListRow title="Report a problem" icon="bug" tint="neutral" chevron onPress={() => router.push('/settings/report')} />
        <ListRow title="Invite a friend" icon="gift" tint="primary" chevron onPress={() => void Share.share({ message: `I use Reached so my people know when I arrive safely. Get it here: ${APP_STORE_URL}` })} />
        <ListRow title="Rate Reached" icon="star" tint="warning" chevron onPress={() => void Linking.openURL(APP_STORE_URL)} />
        <ListRow title="About" subtitle={`Version ${Application.nativeApplicationVersion ?? '1.0.0'}`} icon="information-circle" tint="neutral" chevron onPress={() => router.push('/settings/about')} />
      </Group>

      <Card padded={false}>
        <ListRow title="Log out" icon="log-out" tint="danger" destructive onPress={() => setLogout(true)} testID="logout" />
      </Card>

      <ConfirmSheet
        visible={logout}
        title="Log out?"
        body="Your place rules will stop working while you're logged out."
        confirmLabel="Log out"
        destructive
        onCancel={() => setLogout(false)}
        onConfirm={async () => {
          await b.signOut();
          setLogout(false);
          qc.clear();
          router.replace('/onboarding/welcome');
        }}
      />
    </ScrollView>
  );
}
