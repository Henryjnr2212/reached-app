import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { byId, demo, signedIn, WORK } from './helpers';

const SEED = {
  places: [{ name: 'Work', icon: 'work', ...WORK }],
  rule: { place: 'Work', contact: 'Mom' },
};

async function placeId(page: Page, name: string) {
  const places = await demo<{ id: string; name: string }[]>(page, 'listPlaces');
  return places.find((p) => p.name === name)!.id;
}

test('Ask me first holds the arrival until I tap Send', async ({ page }) => {
  await signedIn(page, { ...SEED, profile: { arrivalMode: 'ask' } });
  await demo(page, 'reportPlaceEvent', await placeId(page, 'Work'), 'arrive', WORK);
  expect((await demo<{ template: string }[]>(page, 'debugMessages')).some((m) => m.template === 'arrived')).toBe(false);
  await byId(page, 'tab-activity').click();
  await byId(page, 'activity-tab').getByText(/Work/).first().click();
  await byId(page, 'confirm-send').click();
  await expect.poll(async () => (await demo<{ template: string }[]>(page, 'debugMessages')).filter((m) => m.template === 'arrived').length).toBe(1);
});

test("This wasn't right records feedback on an arrival", async ({ page }) => {
  await signedIn(page, SEED);
  await demo(page, 'reportPlaceEvent', await placeId(page, 'Work'), 'arrive', WORK);
  await byId(page, 'tab-activity').click();
  await byId(page, 'filter-arrivals').click();
  await byId(page, 'activity-tab').getByText(/Work/).first().click();
  await expect(byId(page, 'event-body')).toContainText('Ama has arrived safely at Work');
  await byId(page, 'wasnt-right').click();
  await page.getByRole('button', { name: "I hadn't arrived yet" }).click();
  await expect.poll(async () => (await demo<{ feedback: string | null }[]>(page, 'listEvents')).some((e) => e.feedback === 'not_arrived')).toBe(true);
});

test('Run a test sends the arrival text to me only', async ({ page }) => {
  await signedIn(page);
  await page.goto('/settings/permissions');
  await byId(page, 'run-test').click();
  await expect.poll(async () => (await demo<{ contactName: string }[]>(page, 'debugMessages')).filter((m) => m.contactName !== 'Mom').map((m) => m.contactName)).toEqual(['You']);
});

test('a contact asking "REACHED" shows a request I can accept', async ({ page }) => {
  await signedIn(page);
  const mom = (await demo<{ id: string }[]>(page, 'listContacts'))[0]!;
  await demo(page, 'updateContact', mom.id, { canRequestLocation: true });
  await demo(page, 'inbound', '+233201112222', 'REACHED');
  await expect(byId(page, 'request-accept')).toBeVisible();
  await byId(page, 'request-accept').click();
  await expect.poll(async () => (await demo<{ status: string }[]>(page, 'listRequests')).every((r) => r.status !== 'pending')).toBe(true);
});

test('upgrading to Premium with MTN MoMo', async ({ page }) => {
  await signedIn(page);
  await page.goto('/settings/plan');
  await byId(page, 'plan-premium').click();
  await byId(page, 'pay-mtn_momo').click();
  await page.getByLabel('Mobile money number').fill('024 123 4567');
  await byId(page, 'plan-pay').click();
  await page.getByRole('button', { name: "I've approved it" }).click();
  await expect(byId(page, 'plan-premium')).toContainText('Your plan');
});

test('deleting the account needs a code and ends on Welcome', async ({ page }) => {
  await signedIn(page);
  await page.goto('/settings/delete-account');
  await byId(page, 'delete-send-code').click();
  await byId(page, 'otp-input').fill('123456');
  await byId(page, 'delete-confirm').click();
  await expect(byId(page, 'welcome')).toBeVisible();
  expect(await demo<unknown>(page, 'getSessionUserId')).toBeNull();
});
