import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { advance, byId, demo, signedIn, WORK } from './helpers';

const SEED = { places: [{ name: 'Work', icon: 'work', ...WORK }] };

async function startTrip(page: Page) {
  await signedIn(page, SEED);
  await byId(page, 'quick-Work').click();
  await byId(page, 'start-trip-submit').click();
  await expect(byId(page, 'active-trip')).toBeVisible();
}

test('overdue: Are you okay? → Need more time keeps the trip going without alerting anyone', async ({ page }) => {
  await startTrip(page);
  await advance(page, 120);
  await expect(byId(page, 'overdue-screen')).toBeVisible();
  await expect(byId(page, 'overdue-title')).toHaveText('Are you okay?');
  await expect(byId(page, 'overdue-countdown')).toContainText("We'll alert your contacts in 4:");
  await byId(page, 'more-time').click();
  await byId(page, 'more-30').click();
  await expect(byId(page, 'active-trip')).toBeVisible();
  const sent = await demo<{ template: string }[]>(page, 'debugMessages');
  expect(sent.some((m) => m.template === 'overdue_alert')).toBe(false);
});

test("overdue: I'm okay → Yes, I've arrived sends a normal arrival", async ({ page }) => {
  await startTrip(page);
  await advance(page, 120);
  await byId(page, 'im-okay').click();
  await byId(page, 'overdue-arrived').click();
  await expect(byId(page, 'arrived-screen')).toBeVisible();
});

test("no answer in 5 minutes alerts emergency contacts; I'm safe now sends all clear", async ({ page }) => {
  await startTrip(page);
  await advance(page, 120);
  await expect(byId(page, 'overdue-title')).toHaveText('Are you okay?');
  await advance(page, 6);
  await expect(byId(page, 'overdue-title')).toHaveText('Alert sent to your contacts');
  const sent = await demo<{ template: string; body: string }[]>(page, 'debugMessages');
  const alert = sent.find((m) => m.template === 'overdue_alert');
  expect(alert?.body).toMatch(/^ALERT: Ama hasn't arrived at Work \(due .+\) and isn't responding\./);
  expect(alert!.body.length).toBeLessThanOrEqual(160);

  await byId(page, 'im-safe').click();
  await byId(page, 'confirm-yes').click();
  await expect(byId(page, 'home')).toBeVisible();
  const after = await demo<{ template: string; body: string }[]>(page, 'debugMessages');
  expect(after.find((m) => m.template === 'all_clear')?.body).toMatch(/^Ama is safe and confirmed at .+\. - Reached$/);
});

test('Get help alerts emergency contacts straight away', async ({ page }) => {
  await startTrip(page);
  await advance(page, 120);
  await byId(page, 'get-help').click();
  await expect(byId(page, 'sos-sent')).toBeVisible();
  const sent = await demo<{ template: string }[]>(page, 'debugMessages');
  expect(sent.some((m) => m.template === 'sos')).toBe(true);
});
