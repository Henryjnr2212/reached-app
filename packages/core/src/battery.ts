/**
 * "Keep Reached running" guides. Many phones sold in Ghana (Tecno, Infinix,
 * itel run HiOS/XOS) kill background apps aggressively; each brand hides the
 * setting in a different place.
 */
export type PhoneBrand = 'tecno' | 'infinix' | 'itel' | 'samsung' | 'xiaomi' | 'oppo' | 'huawei' | 'other';

export interface BatteryGuide {
  brand: PhoneBrand;
  label: string;
  steps: string[];
}

const COMMON_FIRST = 'Tap "Fix it" and allow Reached to run without battery restrictions.';

export const BATTERY_GUIDES: Record<PhoneBrand, BatteryGuide> = {
  tecno: {
    brand: 'tecno',
    label: 'Tecno',
    steps: [
      COMMON_FIRST,
      'Open Phone Master → Speed Up → Auto-start management, and turn Reached on.',
      'Settings → Battery → App battery saver → Reached → No restrictions.',
      'Open recent apps, pull Reached down slightly and tap the lock icon.',
    ],
  },
  infinix: {
    brand: 'infinix',
    label: 'Infinix',
    steps: [
      COMMON_FIRST,
      'Open Phone Master → App management → Auto-start, and turn Reached on.',
      'Settings → Battery → Power Marathon: add Reached to the allowed list.',
      'In recent apps, lock Reached so cleaning doesn’t close it.',
    ],
  },
  itel: {
    brand: 'itel',
    label: 'itel',
    steps: [
      COMMON_FIRST,
      'Open Phone Master → Auto-start management, and turn Reached on.',
      'Settings → Battery → Reached → Allow background activity.',
    ],
  },
  samsung: {
    brand: 'samsung',
    label: 'Samsung',
    steps: [
      COMMON_FIRST,
      'Settings → Battery → Background usage limits → Never sleeping apps → add Reached.',
      'Settings → Apps → Reached → Battery → Unrestricted.',
    ],
  },
  xiaomi: {
    brand: 'xiaomi',
    label: 'Xiaomi / Redmi',
    steps: [
      COMMON_FIRST,
      'Settings → Apps → Manage apps → Reached → Autostart on.',
      'Battery saver → No restrictions.',
    ],
  },
  oppo: {
    brand: 'oppo',
    label: 'Oppo / Realme',
    steps: [COMMON_FIRST, 'Settings → Battery → More settings → Optimise battery use → Reached → Don’t optimise.', 'Allow Auto launch for Reached.'],
  },
  huawei: {
    brand: 'huawei',
    label: 'Huawei',
    steps: [COMMON_FIRST, 'Settings → Battery → App launch → Reached → Manage manually, and turn all three switches on.'],
  },
  other: {
    brand: 'other',
    label: 'Other Android',
    steps: [COMMON_FIRST, 'Settings → Apps → Reached → Battery → Unrestricted.'],
  },
};

export function detectBrand(manufacturer: string | null | undefined): PhoneBrand {
  const m = (manufacturer ?? '').toLowerCase();
  if (m.includes('tecno')) return 'tecno';
  if (m.includes('infinix')) return 'infinix';
  if (m.includes('itel')) return 'itel';
  if (m.includes('samsung')) return 'samsung';
  if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco')) return 'xiaomi';
  if (m.includes('oppo') || m.includes('realme') || m.includes('oneplus')) return 'oppo';
  if (m.includes('huawei') || m.includes('honor')) return 'huawei';
  return 'other';
}
