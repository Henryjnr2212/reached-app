/**
 * Ghana phone number helpers. Everything is stored as E.164 (+233XXXXXXXXX).
 *
 * Mobile prefixes (after the leading 0) as allocated by the NCA:
 * MTN 24, 25, 53, 54, 55, 59 · Telecel 20, 50 · AT 26, 27, 56, 57 · Glo 23 · 28 (legacy).
 */
export const GHANA_COUNTRY_CODE = '+233';

export const GHANA_MOBILE_PREFIXES = [
  '20', '23', '24', '25', '26', '27', '28', '50', '53', '54', '55', '56', '57', '59',
] as const;

export type GhanaNetwork = 'MTN' | 'Telecel' | 'AT' | 'Glo' | 'Other';

const NETWORK_BY_PREFIX: Record<string, GhanaNetwork> = {
  '24': 'MTN', '25': 'MTN', '53': 'MTN', '54': 'MTN', '55': 'MTN', '59': 'MTN',
  '20': 'Telecel', '50': 'Telecel',
  '26': 'AT', '27': 'AT', '56': 'AT', '57': 'AT',
  '23': 'Glo',
  '28': 'Other',
};

/** Strip spaces, dashes, dots and brackets a person might type or paste. */
function digitsAndPlus(input: string): string {
  return input.replace(/[\s\-().]/g, '');
}

/**
 * Normalise anything a user types (0241234567, 241234567, +233 24 123 4567,
 * 00233241234567, 233241234567) to E.164. Returns null when it is not a
 * valid Ghana mobile number.
 */
export function normalizeGhanaPhone(input: string): string | null {
  let s = digitsAndPlus(input.trim());
  if (!s) return null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) {
    if (!s.startsWith(GHANA_COUNTRY_CODE)) return null;
    s = s.slice(GHANA_COUNTRY_CODE.length);
  } else if (s.startsWith('233') && s.length === 12) {
    s = s.slice(3);
  }
  if (s.startsWith('0')) s = s.slice(1);
  if (!/^\d{9}$/.test(s)) return null;
  const prefix = s.slice(0, 2);
  if (!(GHANA_MOBILE_PREFIXES as readonly string[]).includes(prefix)) return null;
  return GHANA_COUNTRY_CODE + s;
}

export function isValidGhanaPhone(input: string): boolean {
  return normalizeGhanaPhone(input) !== null;
}

/** True only for strings already in canonical E.164 Ghana form. */
export function isE164Ghana(value: string): boolean {
  return /^\+233(20|23|24|25|26|27|28|50|53|54|55|56|57|59)\d{7}$/.test(value);
}

/** "+233241234567" → "+233 24 123 4567" */
export function formatGhanaPhone(e164: string): string {
  if (!isE164Ghana(e164)) return e164;
  const n = e164.slice(4);
  return `+233 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}

/** "+233241234567" → "024 123 4567", how Ghanaians usually write numbers. */
export function formatGhanaPhoneLocal(e164: string): string {
  if (!isE164Ghana(e164)) return e164;
  const n = e164.slice(4);
  return `0${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}

export function ghanaNetwork(e164: string): GhanaNetwork | null {
  if (!isE164Ghana(e164)) return null;
  return NETWORK_BY_PREFIX[e164.slice(4, 6)] ?? 'Other';
}

/** Mask for logs and support screens: +233 24 ••• 4567 */
export function maskPhone(e164: string): string {
  if (!isE164Ghana(e164)) return '•••';
  const n = e164.slice(4);
  return `+233 ${n.slice(0, 2)} ••• ${n.slice(5)}`;
}
