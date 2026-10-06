import { expect, test } from '@playwright/test';
import { expectBasicA11y, expectNoHorizontalOverflow } from './helpers';

test.describe('delete account (demo backend)', () => {
  test('explains what is deleted and how to do it in the app', async ({ page }) => {
    await page.goto('/delete-account');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Delete your Reached account');
    await expect(page.getByRole('heading', { name: 'What gets deleted' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('Within 30 days');
    await expect(page.getByRole('main')).toContainText('Settings → Privacy and data → Delete account');
    await expectBasicA11y(page);
  });

  test('validates the phone, checks the code, confirms and deletes', async ({ page }) => {
    await page.goto('/delete-account');
    const phone = page.getByLabel('Phone number');
    await phone.fill('12345');
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('Enter a Ghana mobile number, like 024 123 4567.');
    await expect(phone).toHaveAttribute('aria-invalid', 'true');

    await phone.fill('024 123 4567');
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await expect(page.getByText('We sent a 6-digit code to')).toContainText('+233 24 123 4567');

    const code = page.getByLabel('6-digit code');
    await expect(code).toBeFocused();
    await code.fill('000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("That code didn't work");

    await code.fill('123456');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Delete your Reached account?' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('Signed in as +233 24 123 4567');
    await expectBasicA11y(page);
    await expectNoHorizontalOverflow(page, page.viewportSize()?.width);

    await page.getByRole('button', { name: 'Delete my account' }).click();
    await expect(page.getByTestId('delete-done')).toContainText('Your account has been deleted');
  });

  test('cancel at the confirm step goes back without deleting', async ({ page }) => {
    await page.goto('/delete-account');
    await page.getByLabel('Phone number').fill('0201112233');
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Verify' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByLabel('Phone number')).toBeVisible();
    await expect(page.getByTestId('delete-done')).toHaveCount(0);
  });

  test('short codes are rejected before sending', async ({ page }) => {
    await page.goto('/delete-account');
    await page.getByLabel('Phone number').fill('+233 54 000 1111');
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await page.getByLabel('6-digit code').fill('123');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('Enter the 6-digit code from the text message.');
  });
});
