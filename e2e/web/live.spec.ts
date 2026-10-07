import { expect, test } from '@playwright/test';
import { expectBasicA11y, expectNoHorizontalOverflow, stubTiles } from './helpers';

test.describe('live location page', () => {
  test('live trip: status, last updated, battery, call button, no details or emergency numbers', async ({ page }) => {
    await stubTiles(page, 'ok');
    await page.goto('/l/demoLive1');
    await expect(page.getByTestId('live-status')).toHaveText('On the way to Work · expected around 6:30pm');
    await expect(page.getByTestId('last-updated')).toHaveText('Last updated 1 min ago');
    await expect(page.getByTestId('battery')).toHaveText('Battery 64%');
    const call = page.getByTestId('call-button');
    await expect(call).toHaveText('Call Ama');
    await expect(call).toHaveAttribute('href', 'tel:+233241234567');
    await expect(page.getByTestId('emergency-numbers')).toHaveCount(0);
    await expect(page.getByTestId('trip-details')).toHaveCount(0);
    await expect(page.getByRole('main').locator('a[href="tel:112"]')).toHaveCount(0);
    await expect(page.getByText('EMERGENCY', { exact: true })).toHaveCount(0);
    // Map renders with Leaflet when tiles load.
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('.reached-pin')).toHaveCount(1);
    const getReached = page.getByRole('link', { name: 'Get Reached for yourself' });
    await expect(getReached).toHaveAttribute('href', '/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expectBasicA11y(page);
  });

  test('emergency: banner, emergency numbers with tap-to-call, trip details', async ({ page }) => {
    await stubTiles(page, 'ok');
    await page.goto('/l/demoSos01');
    await expect(page.getByTestId('live-status')).toHaveText('EMERGENCY');
    await expect(page.getByRole('alert').filter({ hasText: 'EMERGENCY' })).toContainText('Ama sent an SOS');
    const call = page.getByTestId('call-button');
    await expect(call).toHaveText('Call Ama');
    await expect(call).toHaveAttribute('href', 'tel:+233241234567');
    const numbers = page.getByTestId('emergency-numbers');
    await expect(numbers).toBeVisible();
    for (const n of ['112', '191', '18555', '193', '192']) {
      await expect(numbers.locator(`a[href="tel:${n}"]`)).toBeVisible();
    }
    const details = page.getByTestId('trip-details');
    await expect(details).toBeVisible();
    for (const text of ['Ride-hailing', 'Bolt', 'Silver Toyota Vitz', 'GR 2214-23', 'Kwame', "Saved in Ama's app"]) {
      await expect(details).toContainText(text);
    }
    await expect(details.getByRole('link', { name: 'Open the ride link' })).toHaveAttribute('rel', /noopener/);
    await expect(page.getByTestId('battery')).toHaveText('Battery 23%');
    await expectBasicA11y(page);
    await expectNoHorizontalOverflow(page, page.viewportSize()?.width);
  });

  test('cleared alert: says the person is safe, no emergency numbers or details', async ({ page }) => {
    await stubTiles(page, 'ok');
    await page.goto('/l/demoClr01');
    await expect(page.getByTestId('live-status')).toHaveText('Cleared — Ama is safe');
    await expect(page.getByTestId('emergency-numbers')).toHaveCount(0);
    await expect(page.getByTestId('trip-details')).toHaveCount(0);
    await expect(page.getByTestId('call-button')).toHaveAttribute('href', 'tel:+233241234567');
  });

  test('ended trip', async ({ page }) => {
    await page.goto('/l/demoEnd01');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This trip has ended');
    await expect(page.getByRole('main')).toContainText("Ama's live location is no longer shared");
    await expect(page.getByTestId('call-button')).toHaveCount(0);
    await expect(page.getByTestId('emergency-numbers')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Get Reached for yourself' })).toHaveAttribute('href', '/');
    await expectBasicA11y(page);
  });

  test('unknown link', async ({ page }) => {
    await page.goto('/l/zzzzzzzz');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("This link isn't working");
    await expect(page.getByTestId('call-button')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expectBasicA11y(page);
  });

  test('shows a static fallback when map tiles cannot load', async ({ page }) => {
    await stubTiles(page, 'fail');
    await page.goto('/l/demoLive1');
    await expect(page.getByTestId('map-fallback')).toBeVisible();
    await expect(page.getByTestId('map-fallback')).toContainText('5.60370, -0.18700');
    await expect(page.getByRole('link', { name: 'Open location in Google Maps' })).toHaveAttribute('href', /google\.com\/maps/);
    await expect(page.getByTestId('call-button')).toBeVisible();
  });

  test('refreshes every 30 seconds', async ({ page }) => {
    await stubTiles(page, 'ok');
    await page.clock.install();
    await page.goto('/l/demoLive1');
    await expect(page.getByTestId('last-updated')).toHaveText('Last updated 1 min ago');
    // Without a refresh the reading would age to "2 min ago"; with the 30 s refresh it stays fresh.
    await page.clock.runFor(70_000);
    await expect(page.getByTestId('last-updated')).toHaveText('Last updated 1 min ago');
  });
});
