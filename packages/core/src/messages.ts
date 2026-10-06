import { fitsOneSms, gsm7Length, SMS_MAX_SEPTETS, toGsm7 } from './gsm7.ts';

/**
 * Every message Reached sends to a contact. Wording follows SPEC §11 exactly,
 * except that the en dash in "– Reached" is written as "-" because the en dash
 * is not in the GSM-7 alphabet and would turn each SMS into a 70-char UCS-2 one.
 */
export type TemplateKey =
  | 'intro'
  | 'arrived'
  | 'left'
  | 'on_the_way'
  | 'running_late'
  | 'plans_changed'
  | 'overdue_alert'
  | 'sos'
  | 'all_clear'
  | 'request_accept'
  | 'request_decline'
  | 'request_unknown'
  | 'test'
  | 'otp';

export type Language = 'en' | 'tw' | 'ga' | 'ee';

export const LANGUAGES: { code: Language; label: string; status: 'ready' | 'draft' }[] = [
  { code: 'en', label: 'English', status: 'ready' },
  { code: 'tw', label: 'Twi', status: 'draft' },
  { code: 'ga', label: 'Ga', status: 'draft' },
  { code: 'ee', label: 'Ewe', status: 'draft' },
];

export interface MessageParams {
  /** User's first name, e.g. "Ama". */
  name?: string;
  /** Place or destination name, e.g. "Work". */
  place?: string;
  /** Clock time of the event, e.g. "8:42am". */
  time?: string;
  /** Expected / due time, e.g. "6:30pm". */
  due?: string;
  /** Last check-in time for overdue alerts. */
  lastSeen?: string;
  /** Live location link. */
  link?: string;
  /** Add "Ama's phone may be off." to overdue alerts when check-ins stopped. */
  phoneMayBeOff?: boolean;
  /** One-time code. */
  code?: string;
  /** Android SMS Retriever app hash (11 chars), appended to OTP messages. */
  appHash?: string;
  /** Emergency number shown in SOS messages. */
  emergencyNumber?: string;
}

type Renderer = (p: Required<Pick<MessageParams, 'name' | 'place' | 'time' | 'due' | 'lastSeen' | 'link' | 'code' | 'emergencyNumber'>> & MessageParams) => string;

const EN: Record<TemplateKey, Renderer> = {
  intro: (p) =>
    `Hi, ${p.name} added you as a safety contact on Reached. You'll get a text when ${p.name} arrives safely. Reply STOP to opt out.`,
  arrived: (p) => `${p.name} has arrived safely at ${p.place} (${p.time}). - Reached`,
  left: (p) => `${p.name} has left ${p.place} (${p.time}). - Reached`,
  on_the_way: (p) => `${p.name} is on the way to ${p.place}, expected around ${p.due}. - Reached`,
  running_late: (p) => `${p.name} is running late. New expected arrival: ${p.due}. - Reached`,
  plans_changed: (p) => `${p.name}'s trip to ${p.place} was cancelled. All is fine. - Reached`,
  overdue_alert: (p) =>
    `ALERT: ${p.name} hasn't arrived at ${p.place} (due ${p.due}) and isn't responding. Last seen ${p.lastSeen}: ${p.link}. Please call ${p.name}.` +
    (p.phoneMayBeOff ? ` ${p.name}'s phone may be off.` : ''),
  sos: (p) =>
    `EMERGENCY: ${p.name} sent an SOS at ${p.time}. Live location: ${p.link}. Call ${p.name} now. If you can't reach ${p.name}, call ${p.emergencyNumber}.`,
  all_clear: (p) => `${p.name} is safe and confirmed at ${p.time}. - Reached`,
  request_accept: (p) => `${p.name} will let you know when ${p.name} reaches.`,
  request_decline: (p) => `${p.name} can't share right now.`,
  request_unknown: () => `Reached: we couldn't find who you're asking about. Ask them to add you as a contact first.`,
  test: (p) => `This is a test from Reached on ${p.name}'s phone. No action needed.`,
  otp: (p) =>
    `<#> Your Reached code is ${p.code}. Don't share it with anyone.` + (p.appHash ? `\n${p.appHash}` : ''),
};

/*
 * Draft translations for Phase 2 local languages. They are written without the
 * special letters (ɛ, ɔ, ŋ, ɖ…) because those fall outside GSM-7, which is how
 * most Ghanaians already type these languages by SMS. Status is "draft" until a
 * native speaker signs them off (MANUAL_TESTS.md).
 */
const TW: Partial<Record<TemplateKey, Renderer>> = {
  arrived: (p) => `${p.name} adu ${p.place} dwoodwoo (${p.time}). - Reached`,
  left: (p) => `${p.name} afi ${p.place} (${p.time}). - Reached`,
  on_the_way: (p) => `${p.name} wo kwan so rekɔ ${p.place}, obedu bɛyɛ ${p.due}. - Reached`,
  running_late: (p) => `${p.name} aka akyi kakra. Obedu bɛyɛ ${p.due}. - Reached`,
  plans_changed: (p) => `${p.name} ne kwan a orekɔ ${p.place} no, wagyae. Biribiara ye. - Reached`,
  all_clear: (p) => `${p.name} ho ye, ne ho atɔ no ${p.time}. - Reached`,
  test: (p) => `Yei ye nsɔhwe fi Reached wɔ ${p.name} fon so. Nni hwee yɛ.`,
};

const GA: Partial<Record<TemplateKey, Renderer>> = {
  arrived: (p) => `${p.name} eshɛ ${p.place} jogbaŋŋ (${p.time}). - Reached`,
  left: (p) => `${p.name} eje ${p.place} (${p.time}). - Reached`,
  all_clear: (p) => `${p.name} hiɛ ka jogbaŋŋ (${p.time}). - Reached`,
  test: (p) => `Enɛ ji kaa ni jɛ Reached yɛ ${p.name} fon lɛ nɔ. Ohe bɛ nɔ ko.`,
};

const EE: Partial<Record<TemplateKey, Renderer>> = {
  arrived: (p) => `${p.name} va ɖo ${p.place} nyuie (${p.time}). - Reached`,
  left: (p) => `${p.name} dzo le ${p.place} (${p.time}). - Reached`,
  all_clear: (p) => `${p.name} le dedie (${p.time}). - Reached`,
  test: (p) => `Esia nye dodokpɔ tso Reached dzi le ${p.name} ƒe fon dzi. Mehiã be nawɔ naneke o.`,
};

const BY_LANGUAGE: Record<Language, Partial<Record<TemplateKey, Renderer>>> = {
  en: EN,
  tw: TW,
  ga: GA,
  ee: EE,
};

/** Templates contacts can't opt out of receiving because safety depends on them. */
export const SAFETY_TEMPLATES: TemplateKey[] = ['overdue_alert', 'sos', 'all_clear'];

const DEFAULTS = {
  name: 'Your contact',
  place: 'their destination',
  time: '',
  due: '',
  lastSeen: 'unknown',
  link: '',
  code: '',
  emergencyNumber: '112',
};

function clean(p: MessageParams): MessageParams {
  const out: MessageParams = { ...p };
  if (p.name !== undefined) out.name = toGsm7(p.name).trim() || DEFAULTS.name;
  if (p.place !== undefined) out.place = toGsm7(p.place).trim() || DEFAULTS.place;
  return out;
}

function shorten(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(1, max - 2)).trimEnd() + '..';
}

/**
 * Render a template for SMS. Names and places are transliterated to GSM-7 and,
 * if the message would exceed 160 septets, the place and then the name are
 * shortened ("Kotoka International Airport T3" → "Kotoka Internatio..") so the
 * message always goes out as a single SMS.
 */
export function renderSms(key: TemplateKey, params: MessageParams, language: Language = 'en'): string {
  const renderer = BY_LANGUAGE[language][key] ?? EN[key];
  const base = clean(params);
  const run = (p: MessageParams) => toGsm7(renderer({ ...DEFAULTS, ...p } as Parameters<Renderer>[0]));

  let text = run(base);
  if (fitsOneSms(text)) return text;

  // Shorten the place, then the name, a few characters at a time.
  let place = base.place ?? '';
  let name = base.name ?? '';
  for (let guard = 0; guard < 200 && !fitsOneSms(text); guard++) {
    if (place.length > 8) place = shorten(place, place.length - 3);
    else if (name.length > 6) name = shorten(name, name.length - 3);
    else break;
    text = run({ ...base, place, name });
  }
  if (!fitsOneSms(text)) {
    // Last resort: hard truncate. Only reachable with absurd input such as a
    // 120-character custom link.
    text = text.slice(0, SMS_MAX_SEPTETS);
    while (gsm7Length(text) > SMS_MAX_SEPTETS) text = text.slice(0, -1);
  }
  return text;
}

/** Placeholders users can insert into their own default or per-trip message. */
export const MESSAGE_TOKENS = ['{name}', '{place}', '{time}'] as const;

export const DEFAULT_CUSTOM_MESSAGE = '{name} has arrived safely at {place} ({time}). - Reached';

/** Render a user's own wording ("{name} is home!") with the same SMS limits. */
export function renderCustom(template: string, params: Pick<MessageParams, 'name' | 'place' | 'time'>): string {
  const p = clean(params);
  const fill = (name: string, place: string) =>
    toGsm7(
      template
        .replaceAll('{name}', name)
        .replaceAll('{place}', place)
        .replaceAll('{time}', p.time ?? ''),
    ).trim();
  let name = p.name ?? DEFAULTS.name;
  let place = p.place ?? DEFAULTS.place;
  let text = fill(name, place);
  for (let guard = 0; guard < 200 && !fitsOneSms(text); guard++) {
    if (place.length > 8) place = shorten(place, place.length - 3);
    else if (name.length > 6) name = shorten(name, name.length - 3);
    else break;
    text = fill(name, place);
  }
  while (gsm7Length(text) > SMS_MAX_SEPTETS) text = text.slice(0, -1);
  return text;
}

/** Characters left for the live counter under the message editor. */
export function customMessageBudget(template: string, params: Pick<MessageParams, 'name' | 'place' | 'time'>): number {
  const filled = toGsm7(
    template
      .replaceAll('{name}', params.name ?? '')
      .replaceAll('{place}', params.place ?? '')
      .replaceAll('{time}', params.time ?? ''),
  );
  return SMS_MAX_SEPTETS - gsm7Length(filled);
}

/** Keywords contacts can text back to the two-way number. */
export type InboundKeyword = 'STOP' | 'START' | 'REACHED' | 'HELP' | null;

export function parseInboundKeyword(body: string): InboundKeyword {
  const word = body.trim().toUpperCase().split(/\s+/)[0] ?? '';
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(word)) return 'STOP';
  if (['START', 'UNSTOP', 'YES'].includes(word)) return 'START';
  if (word === 'REACHED') return 'REACHED';
  if (word === 'HELP') return 'HELP';
  return null;
}
