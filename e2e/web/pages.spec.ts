import { expect, test } from '@playwright/test';
import { expectBasicA11y, expectNoHorizontalOverflow, stubTiles } from './helpers';

const DPC = process.env.NEXT_PUBLIC_DPC_REGISTRATION_NUMBER || 'PENDING';

test.describe('landing page', () => {
  test('explains Reached in three points with store links and footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Let your people know you got there');
    const how = page.getByRole('region', { name: 'How it works' });
    await expect(how.getByRole('heading', { level: 3 })).toHaveCount(3);
    await expect(page.getByRole('heading', { name: 'Your people get a text, no app needed' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Google Play/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /App Store/ })).toBeVisible();
    const footer = page.getByRole('contentinfo');
    for (const name of ['Privacy Policy', 'Terms of Use', 'Delete account', 'Help and FAQ']) {
      await expect(footer.getByRole('link', { name })).toBeVisible();
    }
    await expectBasicA11y(page);
  });

  test('skip link moves focus to the main content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });
});

test.describe('privacy policy', () => {
  test('has every required section, the DPC number and a last-updated date', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByTestId('last-updated')).toContainText(/Last updated: \d{1,2} \w+ 20\d\d/);
    const main = page.getByRole('main');
    for (const heading of [
      'What we collect',
      'Why we use it',
      'Who we share it with',
      'How long we keep it',
      'Your contacts never need the app',
      'Your rights under Act 843',
      'Data Protection Commission registration',
      'Minimum age',
      'Contact us about your data',
    ]) {
      await expect(main.getByRole('heading', { level: 2, name: heading })).toBeVisible();
    }
    // Data collected
    for (const text of ['Your phone number', 'Your name', 'Contacts you add', 'near the places you save', 'during a trip', 'Device information']) {
      await expect(main).toContainText(text);
    }
    // Sharing
    for (const text of ["Africa's Talking", 'Meta', 'WhatsApp', 'Supabase', 'Vercel', 'Google']) {
      await expect(main.locator('#sharing ~ ul').first()).toContainText(text);
    }
    // Retention
    const retention = main.getByRole('region', { name: 'How long we keep it' });
    await expect(retention).toContainText('30 days');
    await expect(retention).toContainText('7 or 30 days');
    await expect(retention).toContainText('stop working when the trip ends');
    // Rights
    await expect(main).toContainText('Data Protection Act, 2012 (Act 843)');
    await expect(page.getByTestId('dpc-number')).toHaveText(DPC);
    // Age
    const age = main.getByRole('region', { name: 'Minimum age' });
    await expect(age).toContainText('16 or older');
    await expect(age).toContainText('13 to 15');
    // Contact
    await expect(page.getByTestId('privacy-email')).toHaveAttribute('href', /^mailto:.+@.+/);
    await expectBasicA11y(page);
  });

  test('embed mode hides the site header and footer', async ({ page }) => {
    await page.goto('/privacy?embed=1');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.site-footer')).toBeHidden();
    await expect(page.getByTestId('last-updated')).toBeVisible();
    await page.goto('/privacy');
    await expect(page.locator('.site-header')).toBeVisible();
  });
});

test.describe('terms of use', () => {
  test('covers the key terms', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
    await expect(page.getByTestId('last-updated')).toBeVisible();
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Reached is not an emergency service' })).toBeVisible();
    await expect(main).toContainText('cannot call or message the police automatically');
    await expect(main.getByRole('heading', { name: 'Message delivery' })).toBeVisible();
    await expect(main).toContainText('mobile networks');
    await expect(main.getByRole('heading', { name: 'Acceptable use' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Ghana law' })).toBeVisible();
    await expect(main).toContainText('Republic of Ghana');
    await expect(main).toContainText('Osnw Tech Studio');
    await expectBasicA11y(page);
  });

  test('embed mode hides the header', async ({ page }) => {
    await page.goto('/terms?embed=1');
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.site-footer')).toBeHidden();
  });
});

test.describe('help', () => {
  test('answers why an arrival did not send and links to WhatsApp support', async ({ page }) => {
    await page.goto('/help');
    await expect(page.getByRole('heading', { level: 1, name: 'Help and FAQ' })).toBeVisible();
    const faq = page.locator('#arrival-didnt-send');
    await expect(faq.locator('summary')).toHaveText("Why didn't my arrival send?");
    await expect(faq).toHaveAttribute('open', '');
    for (const text of ['All the time', 'Tecno', 'Infinix', 'itel', 'Samsung', 'zone is too small', 'in a vehicle', 'STOP', 'No mobile data', 'SMS app']) {
      await expect(faq).toContainText(text);
    }
    const wa = page.getByRole('link', { name: /Chat with support \(WhatsApp\)/ });
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+/);

    // Other questions open and close.
    const q = page.locator('#no-app');
    await expect(q.getByText('Your people get a normal text message')).toBeHidden();
    await q.locator('summary').click();
    await expect(q.getByText('Your people get a normal text message')).toBeVisible();
    await expectBasicA11y(page);
  });
});

test.describe('theme', () => {
  test('dark mode toggle switches and is remembered', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe('rgb(246, 248, 247)');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg()).toBe('rgb(11, 16, 14)');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg()).toBe('rgb(11, 16, 14)');
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    expect(await bg()).toBe('rgb(246, 248, 247)');
  });

  test('follows the phone setting by default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/privacy');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(11, 16, 14)');
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  });
});

test.describe('layout at 360px', () => {
  const paths = ['/', '/privacy', '/terms', '/help', '/delete-account', '/l/demoLive1', '/l/demoSos01', '/l/demoEnd01', '/l/nope1234', '/police', '/admin'];
  for (const path of paths) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await stubTiles(page, 'fail');
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectNoHorizontalOverflow(page, 360);
    });
  }

  test('header controls are at least 48px tall', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    for (const loc of [
      page.getByRole('link', { name: 'Reached home' }),
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Help' }),
      page.getByRole('button', { name: /Switch to/ }),
    ]) {
      const box = await loc.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    }
  });
});
