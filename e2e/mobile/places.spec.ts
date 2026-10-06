import { expect, test } from '@playwright/test';
import { advance, byId, demo, moveTo, signedIn, WORK } from './helpers';

test('add a place at my current location with a rule, then arriving there tells Mom', async ({ page }) => {
  await moveTo(page, WORK);
  await signedIn(page);
  await byId(page, 'tab-places').click();
  await byId(page, 'add-place').first().click();
  await byId(page, 'quick-name-Work').click();
  await byId(page, 'loc-current').click();
  await expect(byId(page, 'loc-chosen')).toBeVisible();
  await byId(page, 'place-save').click();

  await expect(byId(page, 'place-detail')).toBeVisible();
  await byId(page, 'add-rule').click();
  await expect(byId(page, 'rule-screen')).toBeVisible();
  await expect(page.getByText(/Ama has arrived safely at Work/)).toBeVisible();
  await byId(page, 'rule-save').click();
  await expect(byId(page, 'place-detail')).toBeVisible();
  await expect(page.getByTestId(/^rule-/)).toHaveCount(1);

  // Opening the app while already at Work doesn't count. Leave, come back and stay.
  await moveTo(page, { lat: 5.56, lng: -0.205 });
  await page.waitForTimeout(6_000);
  await moveTo(page, WORK);
  await page.waitForTimeout(6_000);
  await advance(page, 2);
  await expect
    .poll(async () => (await demo<{ template: string; contactName: string }[]>(page, 'debugMessages')).filter((m) => m.template === 'arrived').map((m) => m.contactName), {
      timeout: 20_000,
    })
    .toEqual(['Mom']);
});

test('a rule needs at least one person', async ({ page }) => {
  await signedIn(page, { places: [{ name: 'Gym', icon: 'gym', lat: 5.61, lng: -0.18 }] });
  await byId(page, 'tab-places').click();
  await byId(page, 'place-Gym').click();
  await byId(page, 'add-rule').click();
  await byId(page, 'rule-contact-Mom').click();
  await byId(page, 'rule-save').click();
  await expect(byId(page, 'rule-error')).toBeVisible();
});

test('deleting a place removes it from the list', async ({ page }) => {
  await signedIn(page, { places: [{ name: 'Gym', icon: 'gym', lat: 5.61, lng: -0.18 }] });
  await byId(page, 'tab-places').click();
  await byId(page, 'place-Gym').click();
  await byId(page, 'delete-place').click();
  await byId(page, 'confirm-yes').click();
  await expect(byId(page, 'places-tab')).toBeVisible();
  await expect(byId(page, 'place-Gym')).toHaveCount(0);
});

test('a spot I keep stopping at is suggested and can be saved', async ({ page }) => {
  await signedIn(page, { profile: { autoDetect: true } });
  const legon = { lat: 5.635, lng: -0.1615 };
  await demo(page, 'reportAutoArrival', 'East Legon', legon);
  await advance(page, 120);
  await demo(page, 'reportAutoArrival', 'East Legon', { lat: legon.lat + 0.0002, lng: legon.lng });
  await byId(page, 'tab-places').click();
  await expect(byId(page, 'suggested-places')).toBeVisible();
  await byId(page, 'suggest-East Legon').click();
  await expect(byId(page, 'place-name')).toHaveValue('East Legon');
  await expect(byId(page, 'loc-chosen')).toBeVisible();
  await byId(page, 'place-save').click();
  await expect(byId(page, 'place-detail')).toBeVisible();
});
