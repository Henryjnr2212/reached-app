import { maskPhone } from '@reached/core';

/**
 * Structured logging that never prints a full phone number or a precise
 * location. Any field named like a phone is masked; lat/lng fields are dropped.
 */
const PHONE_KEYS = /phone|^to$|^from$|msisdn/i;
const LOCATION_KEYS = /^(lat|lng|latitude|longitude|coords?|location)$/i;

export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (LOCATION_KEYS.test(k)) continue;
    if (PHONE_KEYS.test(k) && typeof v === 'string') out[k] = v.includes('•') ? v : maskPhone(v);
    else out[k] = v;
  }
  return out;
}

export type Logger = (event: string, fields?: Record<string, unknown>) => void;

export const log: Logger = (event, fields = {}) => {
  console.log(JSON.stringify({ event, ...redact(fields) }));
};

export const silent: Logger = () => {};
