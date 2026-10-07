import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useProfile, useSession } from '@/lib/hooks/queries';
import { Logo } from '@/features/Logo';
import { useTheme } from '@/ui';

/** Splash: logged in → Home (or the next onboarding step); else → Welcome. */
export default function Index() {
  const t = useTheme();
  const session = useSession();
  const profile = useProfile(!!session.data);
  if (session.isLoading || (session.data && profile.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.background }}>
        <Logo size={72} />
      </View>
    );
  }
  if (!session.data) return <Redirect href="/onboarding/welcome" />;
  if (!profile.data?.firstName) return <Redirect href="/onboarding/name" />;
  if (!profile.data.onboardedAt) return <Redirect href="/onboarding/contact" />;
  return <Redirect href="/(tabs)" />;
}
