import { Page } from '@playwright/test';

// Test account credentials
// Note: This user is created by prisma/seed.ts with password 'test'
export const TEST_USER = {
  email: 'test@test.com',
  password: 'test',
};

/**
 * Login via API, set localStorage, then reload so AuthProvider picks up the token.
 *
 * How it works:
 * 1. Navigate to /login (establishes origin for localStorage)
 * 2. Call backend /auth/login directly via fetch (no UI interaction)
 * 3. Set localStorage with token, organizationId, user
 * 4. Reload the page — AuthProvider's useEffect finds token, calls /auth/profile
 * 5. Wait for the app to redirect to /dashboard (ProtectedRoute allows access)
 */
async function loginViaAPI(page: Page): Promise<boolean> {
  try {
    // Must be on the correct origin to set localStorage
    if (!page.url().startsWith('http://localhost:3001')) {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
    }

    const result = await page.evaluate(
      async ({ email, password }) => {
        const res = await fetch('http://localhost:3002/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('organizationId', data.organizationId);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
      },
      { email: TEST_USER.email, password: TEST_USER.password },
    );

    if (!result) return false;

    // Navigate directly to /dashboard — the full page load triggers AuthProvider's useEffect
    // which reads auth_token from localStorage and calls /auth/profile to validate it.
    await page.goto('/dashboard');

    // Wait for one of: dashboard loaded, or redirect back to login (meaning token failed)
    try {
      await page.waitForURL(/\/(dashboard|projects)/, { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      return true;
    } catch {
      // Check final URL — might have already navigated
      const finalUrl = page.url();
      if (finalUrl.includes('/dashboard') || finalUrl.includes('/projects')) {
        return true;
      }
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Attempt a single login via UI: fill form, submit, wait for dashboard redirect.
 * Returns true on success, false on failure.
 */
async function attemptLoginUI(page: Page, timeoutMs: number): Promise<boolean> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Wait for the login form to be ready
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 5000 });

  await emailInput.fill(TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.waitForTimeout(200);

  // Click sign in — the button says "Sign in" per the actual page snapshot
  const signInBtn = page.locator('button:has-text("Sign in"), button[type="submit"]').first();
  await signInBtn.click();

  try {
    await page.waitForURL(/\/(dashboard|projects)/, { timeout: timeoutMs });
    return true;
  } catch {
    if (page.url().includes('/dashboard') || page.url().includes('/projects')) {
      return true;
    }
    return false;
  }
}

/**
 * Login with test account and wait for dashboard.
 * Strategy: Try API login first (fast, reliable), fallback to UI login with retries.
 */
export async function login(page: Page): Promise<void> {
  // Check if already authenticated (on a protected page with token in localStorage)
  const currentUrl = page.url();
  if (currentUrl.includes('/dashboard') || currentUrl.includes('/projects')) {
    const hasToken = await page.evaluate(() => !!localStorage.getItem('auth_token'));
    if (hasToken) return;
  }

  // Strategy 1: API login (fast, no UI interaction)
  if (await loginViaAPI(page)) {
    await postLoginSetup(page);
    return;
  }

  // Strategy 2: UI login with retries
  for (const [attempt, timeout] of [[1, 15000], [2, 20000], [3, 30000]] as const) {
    if (attempt > 1) await page.waitForTimeout(2000);
    if (await attemptLoginUI(page, timeout)) {
      await postLoginSetup(page);
      return;
    }
  }

  throw new Error('Login failed after API + 3 UI attempts — backend may be down');
}

/**
 * Post-login setup: dismiss onboarding modal if present.
 */
async function postLoginSetup(page: Page): Promise<void> {
  // Dismiss onboarding modal if it appears (blocks other interactions)
  const skipOnboarding = page.locator('button:has-text("Skip onboarding")');
  if (await skipOnboarding.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipOnboarding.click();
    await page.waitForTimeout(300);
  }
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
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL(/\/login/);
  }
}
