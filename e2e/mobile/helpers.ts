import { expect, type Page } from '@playwright/test';

/** Saved places used across the specs (Accra). */
export const WORK = { lat: 5.6037, lng: -0.187 };
export const HOME = { lat: 5.6350, lng: -0.1600 };
export const FAR = { latitude: 5.5600, longitude: -0.2050 };

export const byId = (page: Page, id: string) => page.getByTestId(id);

/** Calls into the demo backend that the web build exposes on window. */
export async function demo<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ([name, a]) => {
      const d = (window as unknown as { __reachedDemo: Record<string, (...x: unknown[]) => unknown> }).__reachedDemo;
      return (await d[name as string]!(...(a as unknown[]))) as never;
    },
    [fn, args] as const,
  );
}

export interface Seed {
  contacts?: { name: string; phone: string; relationship?: string; channel?: string; isEmergency?: boolean }[];
  places?: { name: string; icon: string; lat: number; lng: number; radius?: number }[];
  rule?: { place: string; contact: string; event?: 'arrive' | 'leave' };
  profile?: Record<string, unknown>;
}

/**
 * Signs Ama in through the demo backend with the given data, then reloads so
 * the app starts on Home. Much faster than walking onboarding every time;
 * onboarding itself has its own spec.
 */
export async function signedIn(page: Page, seed: Seed = {}) {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __reachedDemo?: unknown }).__reachedDemo);
  await page.evaluate(async (s) => {
    const d = (window as unknown as { __reachedDemo: any }).__reachedDemo; // eslint-disable-line @typescript-eslint/no-explicit-any
    d.reset();
    await d.verifyOtp('0241234567', '123456');
    await d.updateProfile({ firstName: 'Ama', onboardedAt: new Date().toISOString(), ...(s.profile ?? {}) });
    const contacts: Record<string, string> = {};
    for (const c of s.contacts ?? [{ name: 'Mom', phone: '0201112222' }]) {
      const added = await d.addContact({ relationship: 'Mom', channel: 'sms', isDefault: true, isEmergency: true, ...c });
      contacts[c.name] = added.id;
    }
    const places: Record<string, string> = {};
    for (const p of s.places ?? []) {
      const added = await d.addPlace({ radius: 150, address: null, ghanaPostGps: null, ...p });
      places[p.name] = added.id;
    }
    if (s.rule) {
      await d.saveRule({
        placeId: places[s.rule.place],
        event: s.rule.event ?? 'arrive',
        contactIds: [contacts[s.rule.contact]],
        days: [0, 1, 2, 3, 4, 5, 6],
        windowStart: null,
        windowEnd: null,
        message: null,
        enabled: true,
      });
    }
  }, seed);
  await page.goto('/');
  await expect(byId(page, 'home')).toBeVisible();
}

export async function moveTo(page: Page, p: { lat: number; lng: number }) {
  await page.context().setGeolocation({ latitude: p.lat, longitude: p.lng });
}

/** Move the demo server clock forward (overdue checks, minimum stop time). */
export async function advance(page: Page, minutes: number) {
  await demo(page, 'advance', minutes);
}

/** No horizontal scroll at 360dp. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
