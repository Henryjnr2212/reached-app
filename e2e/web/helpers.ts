import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** 1x1 transparent PNG used to stand in for OpenStreetMap tiles. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** Serve map tiles locally (ok) or make them fail (offline) so tests never hit the network. */
export async function stubTiles(page: Page, mode: 'ok' | 'fail' = 'ok') {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    mode === 'ok' ? route.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : route.abort('failed'),
  );
}

/** Every link/button has an accessible name and every image has alt text. */
export async function expectBasicA11y(page: Page) {
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.checkVisibility({ visibilityProperty: true, opacityProperty: false });
    };
    const nameOf = (el: Element): string => {
      const label = el.getAttribute('aria-label');
      if (label?.trim()) return label.trim();
      const by = el.getAttribute('aria-labelledby');
      if (by) {
        const t = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (t) return t;
      }
      const text = ((el as HTMLElement).innerText || el.textContent || '').trim();
      if (text) return text;
      const imgAlt = Array.from(el.querySelectorAll('img[alt]'))
        .map((i) => i.getAttribute('alt') ?? '')
        .join(' ')
        .trim();
      if (imgAlt) return imgAlt;
      return el.getAttribute('title')?.trim() ?? '';
    };
    for (const el of Array.from(document.querySelectorAll('a[href], button, [role="button"], input[type="submit"]'))) {
      if (!visible(el)) continue;
      if (!nameOf(el)) out.push(`no accessible name: ${el.outerHTML.slice(0, 120)}`);
    }
    for (const img of Array.from(document.querySelectorAll('img'))) {
      if (!img.hasAttribute('alt')) out.push(`img without alt: ${img.outerHTML.slice(0, 120)}`);
    }
    for (const input of Array.from(document.querySelectorAll('input, select, textarea'))) {
      const id = input.id;
      const labelled =
        input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || (id && document.querySelector(`label[for="${id}"]`));
      if (!labelled) out.push(`unlabelled field: ${input.outerHTML.slice(0, 120)}`);
    }
    if (!document.documentElement.lang) out.push('html has no lang');
    if (document.querySelectorAll('h1').length < 1) out.push('page has no h1');
    return out;
  });
  expect(problems, problems.join('\n')).toEqual([]);
}

/** No horizontal scrolling at the given width. */
export async function expectNoHorizontalOverflow(page: Page, width = 360) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
}

export async function signIn(page: Page, phone: string, code = '123456') {
  await page.getByLabel('Phone number').fill(phone);
  await page.getByRole('button', { name: 'Text me a code' }).click();
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Verify' }).click();
}
