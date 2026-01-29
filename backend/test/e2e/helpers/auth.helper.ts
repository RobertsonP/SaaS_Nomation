import { Page } from '@playwright/test';

// Test account credentials
export const TEST_USER = {
  email: 'rob1@test.com',
  password: 'test1234',
};

/**
 * Login with test account and wait for dashboard
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);

  // Small delay to ensure form is ready
  await page.waitForTimeout(300);

  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard with longer timeout
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });

  // Wait for auth state to be fully initialized
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Ensure token is saved to localStorage
}

/**
 * Login and navigate to a specific project
 */
export async function loginAndGoToProject(page: Page, projectId: string): Promise<void> {
  await login(page);
  await page.goto(`/projects/${projectId}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Logout from the application
 */
export async function logout(page: Page): Promise<void> {
  // Click user menu or logout button
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL(/\/login/);
  }
}
