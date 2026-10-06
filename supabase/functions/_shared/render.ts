import { type Language, LANGUAGES, type MessageParams, renderCustom, renderSms, type TemplateKey } from '@reached/core';

const TEMPLATES: ReadonlySet<string> = new Set<TemplateKey>([
  'intro',
  'arrived',
  'left',
  'on_the_way',
  'running_late',
  'plans_changed',
  'overdue_alert',
  'sos',
  'all_clear',
  'request_accept',
  'request_decline',
  'request_unknown',
  'request_pending',
  'test',
  'otp',
]);

export function asLanguage(value: unknown): Language {
  return LANGUAGES.some((l) => l.code === value) ? value as Language : 'en';
}

export type RenderResult = { ok: true; body: string } | { ok: false; reason: string };

/**
 * Render an outbox row (template + params + language) to a single-SMS body.
 * Template `custom` carries the user's own wording in params.custom.
 * Core already transliterates to GSM-7 and keeps every body ≤160 septets.
 */
export function renderMessage(template: string, params: unknown, language?: unknown): RenderResult {
  const p = (params && typeof params === 'object' ? params : {}) as MessageParams & { custom?: unknown };
  if (template === 'custom') {
    if (typeof p.custom !== 'string' || !p.custom.trim()) return { ok: false, reason: 'Custom message is empty' };
    return { ok: true, body: renderCustom(p.custom, p) };
  }
  if (!TEMPLATES.has(template)) return { ok: false, reason: `Unknown template ${template}` };
  return { ok: true, body: renderSms(template as TemplateKey, p, asLanguage(language)) };
}
