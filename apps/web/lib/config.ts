/**
 * Public configuration. NEXT_PUBLIC_* values are inlined at build time, so
 * each one must be read with a literal `process.env.NAME` expression.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO === '1';
export const DPC_REGISTRATION_NUMBER = process.env.NEXT_PUBLIC_DPC_REGISTRATION_NUMBER || 'PENDING';
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || 'privacy@reached.app';
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '+233000000000';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://reached.app';

export const PUBLISHER = 'Osnw Tech Studio';

/** Date the Privacy Policy and Terms were last changed. Update with every edit. */
export const POLICY_LAST_UPDATED = '6 October 2026';
export const POLICY_LAST_UPDATED_ISO = '2026-10-06';

export function whatsappLink(number: string, text?: string): string {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
