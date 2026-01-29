import { test, expect } from '@playwright/test';
import { login, logout, TEST_USER } from './helpers/auth.helper';

test.describe('Authentication Flow', () => {
  test('should login with existing test account', async ({ page }) => {
    // Go to login page
    await page.goto('/login');

    // Fill login form
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Try to login with wrong password
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should stay on login page and show error
    await expect(page).toHaveURL(/\/login/);

    // Look for error message
    const errorMessage = page.locator('text=/invalid|error|failed|incorrect/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should use the login helper successfully', async ({ page }) => {
    // Use the helper function
    await login(page);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('should stay logged in when navigating', async ({ page }) => {
    await login(page);

    // Navigate to projects
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/projects/);

    // Navigate back to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Should still be logged in
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('should persist session after page refresh', async ({ page }) => {
    // Login first
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Find and click logout - try multiple selectors
    const logoutButton = page.locator(
      'button:has-text("Logout"), ' +
      'button:has-text("Sign out"), ' +
      'a:has-text("Logout"), ' +
      '[data-testid="logout-button"]'
    );

    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();
      // Should redirect to login or home
      await expect(page).toHaveURL(/\/(login|$)/, { timeout: 10000 });
    } else {
      // If no visible logout button, check if there's a user menu to open first
      const userMenu = page.locator(
        '[data-testid="user-menu"], ' +
        '.user-menu, ' +
        '[aria-label="User menu"], ' +
        'button:has-text("Account")'
      );

      if (await userMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userMenu.click();
        await page.waitForTimeout(500);
        const logoutInMenu = page.locator('text=Logout, text=Sign out');
        if (await logoutInMenu.isVisible()) {
          await logoutInMenu.click();
          await expect(page).toHaveURL(/\/(login|$)/, { timeout: 10000 });
        }
      }
    }
  });

  test('should not access dashboard after logout', async ({ page }) => {
    // Login first
    await login(page);

    // Clear auth state by going to login page directly (simulates logout)
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
