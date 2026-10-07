import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import { Logo } from '@/features/Logo';
import { legalUrl } from '@/features/links';
import { backendKind } from '@/lib/backend';
import { Card, ListRow, Screen, Text } from '@/ui';

const LICENCES = ['Expo and React Native (MIT)', 'TanStack Query (MIT)', 'Zustand (MIT)', 'Supabase JS (MIT)', 'Ionicons (MIT)', 'Plus Jakarta Sans (OFL 1.1)', 'OpenStreetMap data (ODbL), web live page'];

export default function About() {
  return (
    <Screen title="About">
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <Logo size={72} />
        <Text variant="title">Reached</Text>
        <Text tone="muted">
          Version {Application.nativeApplicationVersion ?? '1.0.0'} ({Application.nativeBuildVersion ?? 'dev'}){backendKind() === 'demo' ? ' · demo' : ''}
        </Text>
        <Text tone="muted" center>
          Published by Osnw Tech Studio, Accra.
        </Text>
      </View>
      <Card padded={false}>
        <ListRow title="Privacy Policy" icon="document-text" tint="info" chevron onPress={() => void WebBrowser.openBrowserAsync(legalUrl('privacy'))} />
        <ListRow title="Terms of Use" icon="document" tint="info" chevron onPress={() => void WebBrowser.openBrowserAsync(legalUrl('terms'))} />
      </Card>
      <Card>
        <Text variant="headline">Open-source licences</Text>
        {LICENCES.map((l) => (
          <Text key={l} tone="muted" style={{ marginTop: 4 }}>
            {l}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}
