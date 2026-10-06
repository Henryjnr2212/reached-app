import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * "I'm safe now" needs the phone unlock (biometrics or device PIN) so someone
 * holding the phone can't cancel an alert. Phones with no lock set fall back
 * to an in-app confirm.
 */
export async function confirmIdentity(reason: string): Promise<'ok' | 'failed' | 'unavailable'> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (!enrolled && level === LocalAuthentication.SecurityLevel.NONE) return 'unavailable';
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false });
    return r.success ? 'ok' : 'failed';
  } catch {
    return 'unavailable';
  }
}
