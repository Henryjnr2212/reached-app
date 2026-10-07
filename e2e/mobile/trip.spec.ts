import { expect, test } from '@playwright/test';
import { advance, byId, demo, moveTo, signedIn, WORK } from './helpers';

const SEED = { places: [{ name: 'Work', icon: 'work', ...WORK }] };

test('a trip to Work is detected on arrival and Mom is told', async ({ page }) => {
  await signedIn(page, SEED);
  await byId(page, 'start-trip').click();
  await byId(page, 'dest-Work').click();
  await expect(byId(page, 'chosen-destination')).toContainText('Work');
  await expect(byId(page, 'tell-Mom')).toHaveAttribute('aria-label', 'Mom, will be told');
  await expect(byId(page, 'trip-message-preview')).toContainText('Ama has arrived safely at Work');
  await expect(byId(page, 'expected-time')).toHaveText(/\d{1,2}:\d{2}(am|pm)/);
  await byId(page, 'start-trip-submit').click();

  await expect(byId(page, 'active-trip')).toBeVisible();
  await expect(byId(page, 'trip-status')).toContainText('On the way · arriving around');

  // Drive to Work and stay past the minimum stop time.
  await moveTo(page, WORK);
  await page.waitForTimeout(1500);
  await advance(page, 2);
  await expect(byId(page, 'arrived-screen')).toBeVisible({ timeout: 15_000 });
  await expect(byId(page, 'arrived-told')).toHaveText('Mom has been told.');
  await expect(byId(page, 'delivery-Mom')).toContainText('Delivered', { timeout: 10_000 });

  const sent = await demo<{ body: string; template: string }[]>(page, 'debugMessages');
  expect(sent.some((m) => m.template === 'arrived' && /^Ama has arrived safely at Work \(\d{1,2}:\d{2}(am|pm)\)\. - Reached$/.test(m.body))).toBe(true);

  await byId(page, 'arrived-done').click();
  await expect(byId(page, 'covered-card')).toBeVisible();
  await expect(page.getByText('Reached Work')).toBeVisible();
});

test("passing through the zone in traffic doesn't count as arriving", async ({ page }) => {
  await signedIn(page, SEED);
  await byId(page, 'quick-Work').click();
  await byId(page, 'start-trip-submit').click();
  await expect(byId(page, 'active-trip')).toBeVisible();
  await moveTo(page, WORK);
  await page.waitForTimeout(1000);
  await moveTo(page, { lat: 5.59, lng: -0.2 });
  await advance(page, 3);
  await page.waitForTimeout(6000);
  await expect(byId(page, 'active-trip')).toBeVisible();
});

test("tapping I've arrived sends now; cancel and tell sends plans changed", async ({ page }) => {
  await signedIn(page, SEED);
  await byId(page, 'quick-Work').click();
  await byId(page, 'tell-leaving').click();
  await byId(page, 'start-trip-submit').click();
  await expect(byId(page, 'active-trip')).toBeVisible();
  await byId(page, 'arrived-button').click();
  await expect(byId(page, 'arrived-screen')).toBeVisible();
  await byId(page, 'arrived-done').click();

  await byId(page, 'quick-Work').click();
  await byId(page, 'start-trip-submit').click();
  await byId(page, 'cancel-trip').click();
  await byId(page, 'cancel-tell').click();
  await expect(byId(page, 'home')).toBeVisible();

  const sent = await demo<{ template: string; body: string }[]>(page, 'debugMessages');
  const templates = sent.map((m) => m.template);
  expect(templates).toEqual(expect.arrayContaining(['on_the_way', 'arrived', 'plans_changed']));
  expect(sent.find((m) => m.template === 'plans_changed')!.body).toBe("Ama's trip to Work was cancelled. All is fine. - Reached");
});

test('running late moves the expected time and tells them', async ({ page }) => {
  await signedIn(page, SEED);
  await byId(page, 'quick-Work').click();
  await byId(page, 'start-trip-submit').click();
  const before = await byId(page, 'trip-status').innerText();
  await byId(page, 'running-late').click();
  await byId(page, 'late-30').click();
  await byId(page, 'late-confirm').click();
  await expect(byId(page, 'trip-status')).not.toHaveText(before);
  const sent = await demo<{ template: string; body: string }[]>(page, 'debugMessages');
  expect(sent.find((m) => m.template === 'running_late')?.body).toMatch(/^Ama is running late\. New expected arrival: \d{1,2}:\d{2}(am|pm)\. - Reached$/);
});

test('starting a trip while already at the destination offers to send now', async ({ page }) => {
  await signedIn(page, SEED);
  await moveTo(page, WORK);
  await page.waitForTimeout(800);
  await byId(page, 'quick-Work').click();
  await byId(page, 'start-trip-submit').click();
  await expect(page.getByText("You're already at Work")).toBeVisible();
  await byId(page, 'confirm-yes').click();
  await expect(byId(page, 'arrived-screen')).toBeVisible();
});

test("Send I've reached now goes to default contacts with the area", async ({ page }) => {
  await signedIn(page, SEED);
  await byId(page, 'reached-now').click();
  await expect(byId(page, 'reached-now-preview')).toContainText('Ama has arrived safely at');
  await byId(page, 'reached-now-send').click();
  await expect(byId(page, 'toast')).toContainText('Sent');
});

test('a trip needs someone to tell', async ({ page }) => {
  await signedIn(page, SEED);
  await byId(page, 'quick-Work').click();
  await byId(page, 'tell-Mom').click();
  await byId(page, 'start-trip-submit').click();
  await expect(byId(page, 'start-error')).toHaveText('Choose at least one person to tell.');
});

test('an arrival with no internet waits and is sent when the connection is back', async ({ page, context }) => {
  await signedIn(page, SEED);
  await byId(page, 'quick-Work').click();
  await byId(page, 'start-trip-submit').click();
  await expect(byId(page, 'active-trip')).toBeVisible();

  await context.setOffline(true);
  await moveTo(page, WORK);
  await page.waitForTimeout(1500);
  await advance(page, 2);
  await expect(byId(page, 'arrived-screen')).toBeVisible({ timeout: 15_000 });
  await expect(byId(page, 'arrived-told')).toHaveText('Telling your people…');
  expect((await demo<{ template: string }[]>(page, 'debugMessages')).some((m) => m.template === 'arrived')).toBe(false);

  await context.setOffline(false);
  await expect(byId(page, 'arrived-told')).toHaveText('Mom has been told.', { timeout: 15_000 });
  expect((await demo<{ template: string }[]>(page, 'debugMessages')).filter((m) => m.template === 'arrived')).toHaveLength(1);
});
