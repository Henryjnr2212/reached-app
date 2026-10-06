/**
 * End-to-end tests for the mobile app, run against its web build with the
 * in-memory demo backend (EXPO_PUBLIC_BACKEND=demo). Build first:
 *
 *   EXPO_PUBLIC_BACKEND=demo pnpm --filter @reached/mobile export:web
 *   pnpm exec playwright test -c e2e/mobile/playwright.config.ts
 *
 * Location is mocked with Playwright geolocation; the demo clock is moved
 * forward with window.__reachedDemo.advance(minutes) for overdue flows.
 * Device-only behaviour (background location, real SMS) is in MANUAL_TESTS.md
 * and the Maestro flows in .maestro/.
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {};
const PORT = 3200;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: '../../test-results/mobile',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    launchOptions,
    geolocation: { latitude: 5.5600, longitude: -0.2050 },
    permissions: ['geolocation'],
    timezoneId: 'Africa/Accra',
  },
  projects: [
    { name: 'light', use: { colorScheme: 'light' } },
    { name: 'dark', use: { colorScheme: 'dark' }, testMatch: ['smoke.spec.ts', 'a11y.spec.ts'] },
  ],
  webServer: {
    command: `node scripts/serve-spa.mjs apps/mobile/dist ${PORT}`,
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
