import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';
import { detectBrand, type PhoneBrand } from '@reached/core';

export async function batteryPercent(): Promise<number | null> {
  if (Platform.OS === 'web') return null;
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level < 0 ? null : Math.round(level * 100);
  } catch {
    return null;
  }
}

/** Android: is Reached still under battery optimisation (may be killed in the background)? */
export async function batteryRestricted(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await Battery.isBatteryOptimizationEnabledAsync();
  } catch {
    return false;
  }
}

export function phoneBrand(): PhoneBrand {
  return detectBrand(Device.manufacturer);
}

/** Opens the "ignore battery optimisations" prompt, or the app's settings page. */
export async function openBatterySettings() {
  if (Platform.OS !== 'android') return Linking.openSettings();
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
      data: `package:${Application.applicationId}`,
    });
  } catch {
    await Linking.openSettings();
  }
}
