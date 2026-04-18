import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.E2E_PORT ?? '3010'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Tests muterer DB — kør sekventielt for at undgå races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sekventiel kørsel
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    locale: 'da-DK',
    timezoneId: 'Europe/Copenhagen',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
      DIRECT_URL: process.env.E2E_DATABASE_URL ?? process.env.DIRECT_URL ?? '',
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'e2e-test-secret-must-be-32-chars-min',
      NODE_ENV: 'test',
    },
  },
})
