import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useTheme } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.colors.text} accessibilityElementsHidden importantForAccessibility="no" />;
}

/** Icons for place quick picks; stored as the place.icon value. */
export const PLACE_ICONS: Record<string, IconName> = {
  home: 'home',
  work: 'briefcase',
  school: 'school',
  church: 'heart',
  gym: 'barbell',
  family: 'people',
  market: 'basket',
  pin: 'location',
};
