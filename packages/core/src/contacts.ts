import { normalizeGhanaPhone } from './phone.ts';

export const RELATIONSHIPS = ['Mom', 'Dad', 'Partner', 'Sibling', 'Friend', 'Other'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export type Channel = 'sms' | 'whatsapp' | 'both';

export const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'sms', label: 'SMS' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'both', label: 'Both' },
];

export interface ContactInput {
  name: string;
  phone: string;
  relationship: Relationship;
  channel: Channel;
}

export interface ContactErrors {
  name?: string;
  phone?: string;
}

/** Validate the "Enter number" form. Returns normalised values or field errors. */
export function validateContact(
  input: ContactInput,
  existingPhones: string[] = [],
  ownPhone?: string | null,
): { ok: true; value: ContactInput } | { ok: false; errors: ContactErrors } {
  const errors: ContactErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Enter their name.';
  else if (name.length > 40) errors.name = 'Keep the name under 40 characters.';
  const phone = normalizeGhanaPhone(input.phone);
  if (!phone) errors.phone = 'Enter a Ghana mobile number, like 024 123 4567.';
  else if (ownPhone && phone === ownPhone) errors.phone = "That's your own number. Add someone else.";
  else if (existingPhones.includes(phone)) errors.phone = 'This person is already in your contacts.';
  if (errors.name || errors.phone) return { ok: false, errors };
  return { ok: true, value: { ...input, name, phone: phone! } };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase();
}

/** Pick a relationship from a phone-book label or name ("Mummy", "Dada"). */
export function guessRelationship(name: string): Relationship {
  const n = name.toLowerCase();
  if (/\b(mom|mum|mummy|mama|maa|mother|ma)\b/.test(n)) return 'Mom';
  if (/\b(dad|daddy|papa|dada|father|paa)\b/.test(n)) return 'Dad';
  if (/\b(bae|babe|hubby|wifey|husband|wife|love)\b/.test(n)) return 'Partner';
  if (/\b(bro|sis|sister|brother)\b/.test(n)) return 'Sibling';
  return 'Friend';
}
