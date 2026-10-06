import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { byId, expectNoHorizontalScroll, HOME, signedIn, WORK } from './helpers';

/**
 * Visits every main screen in light and dark mode at 360dp, checks nothing
 * overflows sideways and saves a screenshot to test-results/mobile/screens
 * for design review.
 */
const SCREENS: [string, string, string][] = [
  ['home', '/', 'home'],
  ['places', '/places', 'places-tab'],
  ['contacts', '/contacts', 'contacts-tab'],
  ['activity', '/activity', 'activity-tab'],
  ['settings', '/settings', 'settings-tab'],
  ['start-trip', '/trip/start', 'start-trip-screen'],
  ['new-place', '/place/new', 'place-form'],
  ['new-contact', '/contact/new', 'new-contact'],
  ['arrival-settings', '/settings/arrivals', 'arrival-settings'],
  ['safety-settings', '/settings/safety', 'safety-settings'],
  ['permissions', '/settings/permissions', 'permissions-screen'],
  ['privacy', '/settings/privacy', 'privacy-settings'],
  ['plan', '/settings/plan', 'plan-screen'],
];

test('every main screen renders at 360dp without sideways scroll', async ({ page }, info) => {
  await signedIn(page, {
    contacts: [
      { name: 'Mom', phone: '0201112222' },
      { name: 'Kwame', phone: '0551234567', relationship: 'Partner', channel: 'both' },
    ],
    places: [
      { name: 'Work', icon: 'work', ...WORK },
      { name: 'Home', icon: 'home', ...HOME },
    ],
    rule: { place: 'Work', contact: 'Mom' },
  });
  await page.evaluate(async () => {
    const d = (window as unknown as { __reachedDemo: { sendReachedNow: (ids: string[], a: string) => Promise<string>; listContacts: () => Promise<{ id: string }[]> } }).__reachedDemo;
    const cs = await d.listContacts();
    await d.sendReachedNow([cs[0]!.id], 'Osu');
  });
  for (const [name, path, id] of SCREENS) {
    await page.goto(path);
    await expect(byId(page, id)).toBeVisible();
    await page.waitForTimeout(300);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: join(info.project.outputDir, 'screens', `${info.project.name}-${name}.png`) });
  }
});
