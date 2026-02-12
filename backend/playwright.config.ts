import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,  // Run tests serially to avoid login conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,  // Retry once on failure
  workers: 1,  // Single worker to prevent session conflicts
  reporter: 'html',
  timeout: 60000, // 60 seconds per test (execution tests may take longer)
  expect: {
    timeout: 10000, // 10 seconds for expect assertions
  },
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000, // 15 seconds for actions like clicks
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/real-sites/**'], // Exclude real-sites from default run
    },
    {
      name: 'real-sites',
      use: {
        ...devices['Desktop Chrome'],
        // Longer timeouts for real external sites
        actionTimeout: 30000,
        navigationTimeout: 60000,
      },
      testMatch: '**/real-sites/**/*.spec.ts',
      timeout: 300000, // 5 minutes per test for real sites
      retries: 1, // Single retry for real sites (network dependent)
    },
    {
      name: 'real-sites-headed',
      use: {
        ...devices['Desktop Chrome'],
        headless: false, // Watch tests run
        actionTimeout: 30000,
        navigationTimeout: 60000,
      },
      testMatch: '**/real-sites/**/*.spec.ts',
      timeout: 300000,
      retries: 0, // No retries in headed mode (for debugging)
    },
  ],
});
