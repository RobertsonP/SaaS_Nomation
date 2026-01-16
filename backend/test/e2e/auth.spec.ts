import { test, expect } from '@playwright/test';

test.describe.skip('Authentication Flow', () => {
  const BASE_URL = 'http://localhost:3001';
  const UNIQUE_EMAIL = `test_${Date.now()}@example.com`;

  test('should allow a user to register and login', async ({ page }) => {
    // 1. Go to Register Page
    console.log(`Navigating to ${BASE_URL}/register`);
    await page.goto(`${BASE_URL}/register`);
    await expect(page).toHaveTitle(/Register/i);

    // 2. Fill Registration Form
    console.log(`Registering user: ${UNIQUE_EMAIL}`);
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', UNIQUE_EMAIL);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 3. Verify Registration Success & Redirect
    console.log('Waiting for redirect to /login...');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    
    // Check if we are actually on the login page (look for Login header)
    const loginHeader = page.locator('h2, h3').filter({ hasText: /Sign in|Login/i }).first();
    await expect(loginHeader).toBeVisible();

    // 4. Fill Login Form
    console.log('Logging in...');
    await page.fill('input[type="email"]', UNIQUE_EMAIL);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 5. Expect Redirect to Dashboard
    console.log('Waiting for redirect to /dashboard...');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    console.log('✅ E2E Auth Test Passed!');
  });
});