/**
 * Playwright tests for apps/web. This config does not build the site. Build it
 * in demo mode first, from the repo root:
 *
 *   NEXT_PUBLIC_DEMO=1 pnpm --filter @reached/web build
 *   pnpm exec playwright test -c e2e/web/playwright.config.ts
 *
 * The web server is `next start` on port 3100 serving that build.
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {};
const PORT = 3100;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: '../../test-results/web',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'mobile-360',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        launchOptions,
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 }, launchOptions },
    },
  ],
  webServer: {
    command: 'pnpm --filter @reached/web start',
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}/`,
    env: { NEXT_PUBLIC_DEMO: '1', NEXT_TELEMETRY_DISABLED: '1' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
