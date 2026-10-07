import { expect, test } from '@playwright/test';
import { byId, signedIn, WORK } from './helpers';

/**
 * Basic accessibility on the main screens: every control has a name, every
 * input a label, and controls are at least 48dp in their smaller dimension
 *. Runs in light and dark.
 */
const SCREENS: [string, string][] = [
  ['/', 'home'],
  ['/places', 'places-tab'],
  ['/contacts', 'contacts-tab'],
  ['/activity', 'activity-tab'],
  ['/settings', 'settings-tab'],
  ['/trip/start', 'start-trip-screen'],
  ['/place/new', 'place-form'],
  ['/contact/new', 'new-contact'],
];

for (const [path, id] of SCREENS) {
  test(`${path} has named, labelled, 48dp controls`, async ({ page }) => {
    await signedIn(page, { places: [{ name: 'Work', icon: 'work', ...WORK }] });
    await page.goto(path);
    await expect(byId(page, id)).toBeVisible();
    await page.waitForTimeout(400);
    const problems = await page.evaluate(() => {
      const out: string[] = [];
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight * 3 && el.checkVisibility({ visibilityProperty: true });
      };
      for (const el of Array.from(document.querySelectorAll('[role="button"], button, a[href], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"]'))) {
        if (!visible(el)) continue;
        const name = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || '').trim();
        if (!name) out.push(`no name: ${el.outerHTML.slice(0, 140)}`);
        const r = el.getBoundingClientRect();
        // A small control inside a larger tappable row (a switch in its row) is fine.
        const row = el.parentElement?.closest('[role="button"]');
        const rowBox = row?.getBoundingClientRect();
        const big = (b?: DOMRect) => !!b && Math.min(b.width, b.height) >= 47.5;
        if (!big(r) && !big(rowBox)) out.push(`small target ${Math.round(r.width)}x${Math.round(r.height)}: ${name || el.outerHTML.slice(0, 80)}`);
      }
      for (const input of Array.from(document.querySelectorAll('input, textarea'))) {
        if (!visible(input)) continue;
        if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) out.push(`unlabelled field: ${input.outerHTML.slice(0, 120)}`);
      }
      return out;
    });
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
