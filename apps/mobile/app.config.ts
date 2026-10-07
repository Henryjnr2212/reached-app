import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Reached',
  slug: 'reached',
  scheme: 'reached',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  owner: undefined,
  ios: {
    bundleIdentifier: 'com.osnwtech.reached',
    supportsTablet: false,
    infoPlist: {
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
      NSContactsUsageDescription: 'Pick the people Reached should text when you arrive. Reached only reads the contacts you choose.',
    },
  },
  android: {
    package: 'com.osnwtech.reached',
    adaptiveIcon: {
      backgroundColor: '#0A7550',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
      'READ_CONTACTS',
      'RECEIVE_BOOT_COMPLETED',
      'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'USE_BIOMETRIC',
      'USE_FULL_SCREEN_INTENT',
      'VIBRATE',
      'ACTIVITY_RECOGNITION',
    ],
    config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '' } },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', output: 'single', bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sharing',
    'expo-web-browser',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#F6F8F7',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#0B100E' },
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Reached uses your location to notice when you arrive at your places and to check on you during trips. We never sell it, and trip locations are deleted after 30 days.',
        locationWhenInUsePermission: 'Reached uses your location to know when you arrive.',
        motionUsagePermission: 'Reached checks whether you are in a vehicle so traffic near your destination is not counted as arriving.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isAndroidMotionActivityEnabled: true,
      },
    ],
    ['expo-notifications', { color: '#0A7550' }],
    ['expo-contacts', { contactsPermission: 'Pick the people Reached should text when you arrive.' }],
    ['expo-local-authentication', { faceIDPermission: 'Confirm it is you before telling your contacts you are safe.' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Add a profile photo or a photo of the car plate for your trip.',
        cameraPermission: 'Take a photo of the car plate for your trip.',
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: {
    backend: process.env.EXPO_PUBLIC_BACKEND ?? 'supabase',
  },
};

export default config;
