/**
 * Phase 2 ride-hailing helpers. Uber, Bolt and Yango have no public trip API,
 * so we accept what the rider can share: the ride's trip-status link, or a
 * screenshot of the driver card read by on-device text recognition.
 */
export type RideProvider = 'uber' | 'bolt' | 'yango';

export interface RideLink {
  provider: RideProvider;
  url: string;
}

const HOSTS: [RegExp, RideProvider][] = [
  [/(^|\.)uber\.com$/i, 'uber'],
  [/(^|\.)bolt\.eu$/i, 'bolt'],
  [/(^|\.)bolt\.(app|link)$/i, 'bolt'],
  [/(^|\.)yango\.(com|go\.link)$/i, 'yango'],
  [/(^|\.)yango\.yandex\.com$/i, 'yango'],
];

/** Pull the first ride-app link out of shared text ("Track my ride: https://…"). */
export function parseRideLink(shared: string): RideLink | null {
  const urls = shared.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const raw of urls) {
    let url: URL;
    try {
      url = new URL(raw.replace(/[).,]+$/, ''));
    } catch {
      continue;
    }
    if (url.protocol !== 'https:') continue;
    const hit = HOSTS.find(([re]) => re.test(url.hostname));
    if (hit) return { provider: hit[1], url: url.toString() };
  }
  return null;
}

/**
 * Ghana number plates: two-letter region code, 1–4 digits, dash, two-digit
 * year, optional suffix letter. "GR 4512-23", "GT-1234-19", "AS 77-22 X".
 */
const REGION_CODES = 'AS|BA|BT|CR|ER|GE|GN|GR|GS|GT|GW|GX|NR|UE|UW|VR|WR|GC|GM|AE|AW|AX|DP|CD|UN|WN|NE|SV|OT|BE|AH';
const PLATE_RE = new RegExp(`\\b(${REGION_CODES})[\\s-]?(\\d{1,4})[\\s-](\\d{2})(?:[\\s-]?([A-Z]))?\\b`);

export function normalizePlate(text: string): string | null {
  const m = PLATE_RE.exec(text.toUpperCase().replace(/[–—]/g, '-'));
  if (!m) return null;
  return `${m[1]} ${m[2]}-${m[3]}${m[4] ? ` ${m[4]}` : ''}`;
}

export interface DriverCard {
  plate: string | null;
  driverName: string | null;
  car: string | null;
  provider: RideProvider | null;
}

const CAR_MAKES = ['Toyota', 'Hyundai', 'Kia', 'Honda', 'Nissan', 'Suzuki', 'Chevrolet', 'Ford', 'Mazda', 'Mitsubishi', 'Peugeot', 'Renault', 'Volkswagen', 'Mercedes', 'BMW', 'Lexus', 'Daewoo', 'Opel'];

/**
 * Parse the text lines that ML Kit returns from a driver-card screenshot. The
 * user always confirms the result, so this aims for a helpful first guess.
 */
export function parseDriverCard(lines: string[]): DriverCard {
  const text = lines.join('\n');
  const plate = normalizePlate(text);
  const provider: RideProvider | null = /uber/i.test(text) ? 'uber' : /bolt/i.test(text) ? 'bolt' : /yango/i.test(text) ? 'yango' : null;
  const carLine = lines.find((l) => CAR_MAKES.some((m) => new RegExp(`\\b${m}\\b`, 'i').test(l)));
  const car = carLine ? carLine.replace(PLATE_RE, '').replace(/[•·|]/g, ' ').replace(/\s+/g, ' ').trim() || null : null;

  // Driver name: a short line of 1–3 capitalised words that isn't the car,
  // the plate or UI text like "Your driver" or a rating.
  const skip = /(driver|arriv|min|away|rating|trip|share|call|message|cancel|pickup|pick-up|uber|bolt|yango|\d)/i;
  const nameLine = lines
    .map((l) => l.trim())
    .find((l) => l !== carLine?.trim() && !skip.test(l) && /^[A-Z][a-zA-Z'’-]+(\s[A-Z][a-zA-Z'’-]+){0,2}$/.test(l));
  return { plate, driverName: nameLine ?? null, car, provider };
}
