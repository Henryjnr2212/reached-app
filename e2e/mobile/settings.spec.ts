import { expect, test } from '@playwright/test';
import { byId, demo, signedIn } from './helpers';

test('appearance switches to dark mode and back', async ({ page }) => {
  await signedIn(page);
  await byId(page, 'tab-settings').click();
  const bg = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="settings-tab"]')!).backgroundColor);
  const light = await bg();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect.poll(bg).not.toBe(light);
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect.poll(bg).toBe(light);
});

test('delete my activity empties the Activity tab', async ({ page }) => {
  await signedIn(page);
  await byId(page, 'tab-settings').click();
  await byId(page, 'settings-privacy').click();
  await byId(page, 'delete-activity').click();
  await byId(page, 'confirm-yes').click();
  await expect.poll(async () => (await demo<unknown[]>(page, 'listEvents')).length).toBe(0);
});

test('log out returns to the welcome screen', async ({ page }) => {
  await signedIn(page);
  await byId(page, 'tab-settings').click();
  await byId(page, 'logout').click();
  await byId(page, 'confirm-yes').click();
  await expect(byId(page, 'welcome')).toBeVisible();
});

test('plans page lists Free and Premium', async ({ page }) => {
  await signedIn(page);
  await byId(page, 'tab-settings').click();
  await byId(page, 'settings-plan').click();
  const plans = byId(page, 'plan-screen');
  await expect(plans.getByText('Free', { exact: true }).first()).toBeVisible();
  await expect(plans.getByText(/Premium/).first()).toBeVisible();
});
