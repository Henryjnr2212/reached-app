import { router } from 'expo-router';

/** Back to Home, popping any screens above it rather than stacking a second Home. */
export function goHome() {
  router.dismissTo('/(tabs)');
}

/** After sign-in or onboarding: Home becomes the only screen. */
export function startAtHome() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/(tabs)');
}
