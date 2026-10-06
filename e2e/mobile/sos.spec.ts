import { expect, test } from '@playwright/test';
import { byId, demo, signedIn } from './helpers';

test('a short tap on the shield only shows a hint', async ({ page }) => {
  await signedIn(page);
  await byId(page, 'sos-shield').click();
  await expect(page.getByText('Hold to send SOS')).toBeVisible();
  await expect(byId(page, 'home')).toBeVisible();
});

test('holding the shield starts a countdown that can be cancelled', async ({ page }) => {
  await signedIn(page);
  const box = (await byId(page, 'sos-shield').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await expect(byId(page, 'sos-countdown')).toBeVisible();
  await byId(page, 'sos-cancel').click();
  await expect(byId(page, 'home')).toBeVisible();
  const sent = await demo<{ template: string }[]>(page, 'debugMessages');
  expect(sent.some((m) => m.template === 'sos')).toBe(false);
});

test("SOS sends after the countdown, shows who was alerted and emergency numbers; I'm safe now ends it", async ({ page }) => {
  await signedIn(page);
  await page.goto('/sos');
  await expect(byId(page, 'sos-countdown')).toBeVisible();
  await expect(byId(page, 'sos-sent')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Mom has your location/)).toBeVisible();
  await expect(byId(page, 'call-112')).toBeVisible();
  await expect(byId(page, 'call-191')).toBeVisible();
  const sent = await demo<{ template: string; body: string }[]>(page, 'debugMessages');
  const sos = sent.find((m) => m.template === 'sos')!;
  expect(sos.body).toMatch(/^EMERGENCY: Ama sent an SOS at .+\. Live location: https:\/\/\S+\. Call Ama now\. If you can't reach Ama, call 112\.$/);
  expect(sos.body.length).toBeLessThanOrEqual(160);
  await byId(page, 'im-safe').click();
  await byId(page, 'confirm-yes').click();
  await expect(byId(page, 'home')).toBeVisible();
});
