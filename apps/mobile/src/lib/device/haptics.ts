import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Haptic feedback on key actions. Silently ignored where unsupported (web). */
export const haptic = {
  tap() {
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
  },
  success() {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning() {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  heavy() {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
};
