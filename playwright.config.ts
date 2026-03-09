import path from 'node:path';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 4321);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const authFile = path.join(process.cwd(), 'tests/e2e/.auth/admin.json');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'public',
      testMatch: /(admin-login|skin-presets)\.spec\.ts/,
      use: {
        browserName: 'chromium',
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'admin',
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /admin-login\.spec\.ts/],
      use: {
        browserName: 'chromium',
        storageState: authFile,
      },
    },
  ],
});
