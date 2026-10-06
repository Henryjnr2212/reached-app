import { LANGUAGES, type Language } from '@reached/core';
import { keys, useAction, useProfile } from '@/lib/hooks/queries';
import { Card, Icon, ListRow, Screen, Text, useTheme } from '@/ui';

export default function LanguageSettings() {
  const t = useTheme();
  const profile = useProfile();
  const update = useAction((b, l: Language) => b.updateProfile({ language: l }), [keys.profile]);
  return (
    <Screen title="Language">
      <Text tone="muted">The language for the app and your default texts. Each contact can have their own message language too.</Text>
      <Card padded={false}>
        {LANGUAGES.map((l) => (
          <ListRow
            key={l.code}
            title={l.label}
            subtitle={l.status === 'draft' ? 'Beta: being checked by native speakers' : undefined}
            icon="language"
            tint="neutral"
            right={profile.data?.language === l.code ? <Icon name="checkmark-circle" size={22} color={t.colors.primary} /> : undefined}
            onPress={() => update.mutate(l.code)}
            accessibilityLabel={`${l.label}${profile.data?.language === l.code ? ', selected' : ''}`}
          />
        ))}
      </Card>
    </Screen>
  );
}
