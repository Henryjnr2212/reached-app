/**
 * Ghana emergency numbers shown with tap-to-call on the SOS and overdue
 * screens. SPEC §10: confirm the current numbers with the Ghana Police Service
 * before launch (MANUAL_TESTS.md).
 */
export interface EmergencyNumber {
  label: string;
  number: string;
  description: string;
}

export const GHANA_EMERGENCY_NUMBERS: EmergencyNumber[] = [
  { label: 'Emergency', number: '112', description: 'National emergency line' },
  { label: 'Police', number: '191', description: 'Ghana Police Service' },
  { label: 'Police (toll free)', number: '18555', description: 'Police patrol line' },
  { label: 'Ambulance', number: '193', description: 'National Ambulance Service' },
  { label: 'Fire', number: '192', description: 'Ghana National Fire Service' },
];

export const PRIMARY_EMERGENCY_NUMBER = '112';

export function telLink(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

/** Validate a 4–6 digit app PIN. Rejects trivially guessable ones. */
export function validatePin(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return 'Use 4 to 6 digits.';
  if (/^(\d)\1+$/.test(pin)) return 'Avoid repeating the same digit.';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'Avoid simple sequences like 1234.';
  return null;
}
