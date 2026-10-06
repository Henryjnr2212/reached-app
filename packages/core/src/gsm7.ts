/**
 * GSM 03.38 7-bit default alphabet. A single SMS holds 160 septets; characters
 * from the extension table cost two. Anything outside both tables forces the
 * whole message into UCS-2 (70 characters), which we never want.
 */
const BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const EXTENDED = '^{}\\[~]|€\f';

const basicSet = new Set(Array.from(BASIC));
const extendedSet = new Set(Array.from(EXTENDED));

export const SMS_MAX_SEPTETS = 160;

export function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!basicSet.has(ch) && !extendedSet.has(ch)) return false;
  }
  return true;
}

/** Septet length, or Infinity when the text is not GSM-7 encodable. */
export function gsm7Length(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (basicSet.has(ch)) n += 1;
    else if (extendedSet.has(ch)) n += 2;
    else return Number.POSITIVE_INFINITY;
  }
  return n;
}

export function fitsOneSms(text: string): boolean {
  return gsm7Length(text) <= SMS_MAX_SEPTETS;
}

const REPLACEMENTS: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'",
  '“': '"', '”': '"', '„': '"',
  '–': '-', '—': '-', '−': '-',
  '…': '...', ' ': ' ', '•': '-',
  // Akan / Ga / Ewe letters that are outside GSM-7. SMS convention in Ghana is
  // to write them with the nearest Latin letter.
  'ɛ': 'e', 'Ɛ': 'E', 'ɔ': 'o', 'Ɔ': 'O', 'ŋ': 'ng', 'Ŋ': 'Ng',
  'ɖ': 'd', 'Ɖ': 'D', 'ƒ': 'f', 'Ƒ': 'F', 'ʋ': 'v', 'Ʋ': 'V', 'ɣ': 'g', 'Ɣ': 'G',
  'á': 'a', 'í': 'i', 'ó': 'o', 'ú': 'u', 'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
  'ã': 'a', 'õ': 'o', 'ẽ': 'e', 'ĩ': 'i', 'ũ': 'u', 'ç': 'c',
};

/**
 * Make user-supplied text (names, place names, custom wording) GSM-7 safe by
 * transliterating common characters and dropping anything else (e.g. emoji).
 */
export function toGsm7(text: string): string {
  let out = '';
  for (const ch of text) {
    if (basicSet.has(ch) || extendedSet.has(ch)) out += ch;
    else if (REPLACEMENTS[ch] !== undefined) out += REPLACEMENTS[ch];
    else {
      const stripped = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (stripped && isGsm7(stripped)) out += stripped;
    }
  }
  return out.replace(/ {2,}/g, ' ');
}
