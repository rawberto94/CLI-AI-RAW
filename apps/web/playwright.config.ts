import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests serially to avoid race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to ensure stable execution
  reporter: process.env.CI ? 'list' : 'html',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3005',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev:stable',
    port: 3005,
    timeout: 120 * 1000,
    reuseExistingServer: true, // Always reuse for development
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
