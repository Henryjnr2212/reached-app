import { expect, test } from '@playwright/test';
import { expectBasicA11y, expectNoHorizontalOverflow, signIn, stubTiles } from './helpers';

test.describe('police dashboard (demo backend)', () => {
  test.beforeEach(async ({ page }) => {
    await stubTiles(page, 'ok');
  });

  test('is not indexed and asks for sign-in', async ({ page }) => {
    await page.goto('/police');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('heading', { level: 1, name: 'Police alert dashboard' })).toBeVisible();
    await expect(page.getByLabel('Phone number')).toBeVisible();
    await expectBasicA11y(page);
  });

  test('approved officer sees live SOS and cancellations clearly marked', async ({ page }) => {
    await page.goto('/police');
    await signIn(page, '020 000 0001');
    await expect(page.getByRole('heading', { level: 1, name: 'Live SOS alerts' })).toBeVisible();
    await expect(page.getByTestId('live-count')).toHaveText('1 live SOS');
    const alerts = page.getByTestId('police-alert');
    await expect(alerts).toHaveCount(2);

    const live = alerts.and(page.locator('[data-status="sent"]'));
    await expect(live).toContainText('Ama');
    await expect(live).toContainText('LIVE SOS');
    await expect(live.getByTestId('plate')).toHaveText('GR 2214-23');
    await expect(live).toContainText('Kwame');
    await expect(live).toContainText('5.59130, -0.22130');
    await expect(live.getByRole('link', { name: '+233 24 123 4567' })).toHaveAttribute('href', 'tel:+233241234567');

    const cancelled = alerts.and(page.locator('[data-status="cleared"]'));
    await expect(cancelled).toContainText('Kofi');
    await expect(cancelled.getByTestId('cancelled-badge')).toContainText('CANCELLED');
    await expect(cancelled).toContainText('Kofi cancelled this alert');

    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('.reached-pin')).toHaveCount(2);
    await expect(page.getByText('refreshes every 15 s')).toBeVisible();
    await expectBasicA11y(page);
    await expectNoHorizontalOverflow(page, page.viewportSize()?.width);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByLabel('Phone number')).toBeVisible();
  });

  test('a signed-in user who is not an approved officer is blocked', async ({ page }) => {
    await page.goto('/police');
    await signIn(page, '024 123 4567');
    await expect(page.getByTestId('not-approved')).toContainText("Your account isn't approved yet");
    await expect(page.getByTestId('police-alert')).toHaveCount(0);
  });

  test('wrong code keeps the dashboard locked', async ({ page }) => {
    await page.goto('/police');
    await signIn(page, '020 000 0001', '999999');
    await expect(page.locator('p[role="alert"]')).toContainText("That code didn't work");
    await expect(page.getByTestId('police-alert')).toHaveCount(0);
  });
});

test.describe('admin dashboard (demo backend)', () => {
  test('admin sees stats cards', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await signIn(page, '020 000 0002');
    await expect(page.getByTestId('admin-stats')).toBeVisible();
    await expect(page.getByTestId('stat-users')).toContainText('1,284');
    await expect(page.getByTestId('stat-open-sos')).toContainText('1');
    const main = page.getByRole('main');
    for (const text of ['Onboarded', 'Live trips now', 'Arrivals (7 days)', 'Problem reports (7 days)', 'Premium plan', 'Family plan', 'Free plan']) {
      await expect(main).toContainText(text);
    }
    const messages = page.getByRole('region', { name: 'Messages by status (7 days)' });
    await expect(messages).toContainText('delivered');
    await expect(messages).toContainText('5,210');
    await expect(messages).toContainText('failed');
    const feedback = page.getByRole('region', { name: 'Arrival feedback (7 days)' });
    await expect(feedback).toContainText("I hadn't arrived yet");
    await expectBasicA11y(page);
    await expectNoHorizontalOverflow(page, page.viewportSize()?.width);
  });

  test('non-admins are blocked', async ({ page }) => {
    await page.goto('/admin');
    await signIn(page, '020 000 0001');
    await expect(page.getByTestId('not-admin')).toContainText('Admins only');
    await expect(page.getByTestId('admin-stats')).toHaveCount(0);
  });
});
