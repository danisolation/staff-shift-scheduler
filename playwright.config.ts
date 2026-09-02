import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Staff Shift Scheduler.
 *
 * The E2E tests run against the local dev servers:
 * - Web: Vite dev server on port 5173
 * - API: NestJS on port 3000
 * - Optimizer: HiGHS.js on port 3002
 *
 * Before running the tests, start the services:
 *   docker compose up -d db
 *   pnpm --filter api start:dev &
 *   pnpm --filter optimizer dev &
 *   pnpm --filter web dev &
 *
 * Or use the webServer config below to auto-start them.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Auto-start the Vite dev server before tests run.
  // The API and optimizer must be running separately (docker compose or pnpm dev).
  webServer: {
    command: 'pnpm --filter web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
