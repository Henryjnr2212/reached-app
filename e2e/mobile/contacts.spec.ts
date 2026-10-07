import { expect, test } from '@playwright/test';
import { byId, demo, signedIn } from './helpers';

test('adding a contact checks the number and sends an intro text', async ({ page }) => {
  await signedIn(page);
  await byId(page, 'tab-contacts').click();
  await byId(page, 'add-contact').first().click();
  await byId(page, 'contact-name').fill('Kwame');
  await byId(page, 'contact-phone').fill('12345');
  await byId(page, 'contact-save').click();
  await expect(page.getByText(/Ghana mobile number/)).toBeVisible();
  await byId(page, 'contact-phone').fill('024 555 6666');
  await byId(page, 'contact-save').click();
  await expect(byId(page, 'contact-Kwame')).toBeVisible();
  const sent = await demo<{ template: string; toPhone: string; body: string }[]>(page, 'debugMessages');
  const intro = sent.find((m) => m.toPhone === '+233245556666');
  expect(intro?.template).toBe('intro');
  expect(intro!.body.length).toBeLessThanOrEqual(160);
});

test('a failed text shows on the contact and can be resent from the event', async ({ page }) => {
  await signedIn(page, { contacts: [{ name: 'Mom', phone: '0201112222' }, { name: 'Kofi', phone: '0240000000', isEmergency: false }] });
  await byId(page, 'tab-contacts').click();
  await expect(page.getByText('Message failed')).toBeVisible();
  await byId(page, 'tab-activity').click();
  await byId(page, 'activity-tab').getByText(/Kofi/).first().click();
  await expect(byId(page, 'event-detail')).toBeVisible();
  await byId(page, 'resend-Kofi').click();
  await expect(byId(page, 'message-Kofi')).toContainText(/Sending|Failed/);
});

test('STOP from a contact marks them opted out', async ({ page }) => {
  await signedIn(page);
  await demo(page, 'inbound', '+233201112222', 'STOP');
  await byId(page, 'tab-contacts').click();
  await expect(page.getByText('Opted out')).toBeVisible();
});

test('send a test message from contact detail', async ({ page }) => {
  await signedIn(page);
  await byId(page, 'tab-contacts').click();
  await byId(page, 'contact-Mom').click();
  await byId(page, 'send-test').click();
  await expect.poll(async () => (await demo<{ template: string }[]>(page, 'debugMessages')).some((m) => m.template === 'test')).toBe(true);
});
