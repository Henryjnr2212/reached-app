import { expect, test } from '@playwright/test';
import { byId, demo } from './helpers';

test('new user signs up, adds a contact and home, and lands on Home', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Welcome slides
  await expect(page.getByText("Never forget to say you've reached")).toBeVisible();
  await byId(page, 'welcome-next').click();
  await expect(page.getByText('Your people get a text, no app needed')).toBeVisible();
  await byId(page, 'welcome-next').click();
  await expect(page.getByText("If something's wrong, we raise the alarm")).toBeVisible();
  await page.getByRole('button', { name: 'Get started' }).click();

  // Phone number: Send code disabled until valid
  const send = byId(page, 'send-code');
  await expect(send).toBeDisabled();
  await byId(page, 'phone-input').fill('0241');
  await expect(send).toBeDisabled();
  await byId(page, 'phone-input').fill('024 123 4567');
  await expect(send).toBeEnabled();
  await send.click();

  // Verify: wrong code, then right code
  await expect(page.getByText('Sent by SMS to')).toBeVisible();
  await expect(page.getByText(/Resend code in \d+s/)).toBeVisible();
  await byId(page, 'otp-input').fill('111111');
  await expect(byId(page, 'otp-error')).toHaveText("That code isn't right.");
  await byId(page, 'otp-input').fill('123456');

  // Your name
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible();
  await byId(page, 'name-continue').click();
  await expect(page.getByText('Enter your first name. We use it in your messages.')).toBeVisible();
  await byId(page, 'name-input').fill('Ama');
  await expect(page.getByText('Ama has arrived safely at Work (8:42am). - Reached')).toBeVisible();
  await byId(page, 'name-continue').click();

  // First contact by number
  await expect(page.getByRole('heading', { name: "Who should know you're safe?" })).toBeVisible();
  await byId(page, 'enter-number').click();
  await byId(page, 'contact-name').fill('Mom');
  await byId(page, 'contact-phone').fill('0201112222');
  await byId(page, 'contact-save').click();

  // Intro SMS went to Mom
  const messages = await demo<{ body: string; toPhone: string }[]>(page, 'debugMessages');
  expect(messages.some((m) => m.toPhone === '+233201112222' && m.body.includes('Ama added you as a safety contact'))).toBe(true);

  // Location and notifications explainers
  await expect(page.getByRole('heading', { name: 'Know when you arrive' })).toBeVisible();
  await byId(page, 'allow-location').click();
  await expect(page.getByRole('heading', { name: "We'll check on you" })).toBeVisible();
  await byId(page, 'notifications-on').click();

  // Where's home? Use current location, keep "Tell Mom" on
  await expect(page.getByRole('heading', { name: "Where's home?" })).toBeVisible();
  await byId(page, 'loc-current').click();
  await expect(byId(page, 'home-tell')).toBeVisible();
  await byId(page, 'home-done').click();

  // Home
  await expect(byId(page, 'home')).toBeVisible();
  await expect(byId(page, 'greeting')).toContainText('Ama');
  await expect(byId(page, 'covered-card')).toContainText('1 place · 1 contact');
  await expect(byId(page, 'quick-Home')).toBeVisible();
});

test('skipping optional steps still reaches Home with an add-contact card', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Skip' }).click();
  await byId(page, 'phone-input').fill('0551234567');
  await byId(page, 'send-code').click();
  await byId(page, 'otp-input').fill('123456');
  await byId(page, 'name-input').fill('Kofi');
  await byId(page, 'name-continue').click();
  await byId(page, 'contact-skip').click();
  await byId(page, 'location-not-now').click();
  await byId(page, 'notifications-not-now').click();
  await byId(page, 'home-skip').click();
  await expect(byId(page, 'add-someone-card')).toBeVisible();
  await expect(byId(page, 'reached-now')).toBeDisabled();
});

test('a returning user goes straight to Home after the code', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __reachedDemo?: unknown }).__reachedDemo);
  await demo(page, 'verifyOtp', '0241234567', '123456');
  await demo(page, 'updateProfile', { firstName: 'Ama', onboardedAt: new Date().toISOString() });
  await demo(page, 'signOut');
  await page.reload();
  await page.getByRole('button', { name: 'Skip' }).click();
  await byId(page, 'phone-input').fill('0241234567');
  await byId(page, 'send-code').click();
  await byId(page, 'otp-input').fill('123456');
  await expect(byId(page, 'home')).toBeVisible();
});
