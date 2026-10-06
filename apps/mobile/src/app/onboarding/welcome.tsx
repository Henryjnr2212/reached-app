import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Hero } from '@/features/Hero';
import { Logo } from '@/features/Logo';
import { Button, Text, useTheme, type IconName } from '@/ui';

const SLIDES: { title: string; body: string; icon: IconName; tone: 'primary' | 'info' | 'danger'; badges: IconName[] }[] = [
  {
    title: "Never forget to say you've reached",
    body: 'Set it up once. When you get to work, school or home, Reached tells your people for you.',
    icon: 'location',
    tone: 'primary',
    badges: ['home', 'briefcase'],
  },
  {
    title: 'Your people get a text, no app needed',
    body: 'Mom gets an SMS like "Ama has arrived safely at Work (8:42am)." That\'s it.',
    icon: 'chatbubble-ellipses',
    tone: 'info',
    badges: ['checkmark-done', 'heart'],
  },
  {
    title: "If something's wrong, we raise the alarm",
    body: "If you don't arrive and don't answer, your emergency contacts get your last location.",
    icon: 'shield-checkmark',
    tone: 'danger',
    badges: ['alert-circle', 'call'],
  },
];

export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const slide = SLIDES[i]!;
  const last = i === SLIDES.length - 1;
  const next = () => (last ? router.push('/onboarding/phone') : setI(i + 1));
  return (
    <View testID="welcome" style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo size={36} />
          <Text variant="headline">Reached</Text>
        </View>
        {!last ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding/phone')} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' }}>
            <Text variant="label" tone="muted">
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <Hero icon={slide.icon} tone={slide.tone} badges={slide.badges} height={300} />
        <View style={{ gap: 10 }}>
          <Text variant="display" accessibilityRole="header">
            {slide.title}
          </Text>
          <Text tone="muted">{slide.body}</Text>
        </View>
      </View>
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }} accessibilityLabel={`Slide ${i + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, j) => (
            <View key={s.title} style={{ height: 8, width: j === i ? 24 : 8, borderRadius: 4, backgroundColor: j === i ? t.colors.primary : t.colors.border }} />
          ))}
        </View>
        <Button label={last ? 'Get started' : 'Next'} onPress={next} variant={last ? 'primary' : 'accent'} testID="welcome-next" />
      </View>
    </View>
  );
}
