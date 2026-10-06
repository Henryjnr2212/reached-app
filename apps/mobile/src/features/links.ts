/** Public web pages (apps/web). Opened in the in-app browser. */
export const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://reached.app';

export function legalUrl(page: 'privacy' | 'terms' | 'delete-account' | 'help'): string {
  return `${WEB_BASE}/${page}`;
}

export function liveUrl(token: string): string {
  return `${WEB_BASE}/l/${token}`;
}

export const SUPPORT_WHATSAPP = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '233200000000';
export const APP_STORE_URL = 'https://play.google.com/store/apps/details?id=com.osnwtech.reached';
