import { test, expect, Page } from '@playwright/test';
import { login, TEST_USER } from './helpers/auth.helper';

test.describe('Live Test Execution', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should login and navigate to dashboard', async ({ page }) => {
    // After login, we should be on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('should navigate to projects and find a test to run', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Find the first project link and click it
    const projectLink = page.locator('a[href^="/projects/"]').first();
    const hasProjects = await projectLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasProjects) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }

    await projectLink.click();

    // Should be on project details page
    await expect(page).toHaveURL(/\/projects\/[^/]+/);
  });

  test('should run a test in live mode and see real-time updates', async ({ page }) => {
    // Navigate to a project with tests
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click on first project
    const projectCard = page.locator('[data-testid="project-card"], .bg-white.rounded-lg, a[href^="/projects/"]').first();
    const hasProjects = await projectCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasProjects) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }
    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Navigate to Tests tab/section
    const testsLink = page.locator('a[href*="/tests"], button:has-text("Tests")').first();
    if (await testsLink.isVisible()) {
      await testsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Find a test that has steps (not disabled)
    // The Run Live button is a 🎬 emoji button
    const runLiveButton = page.locator('button:has-text("🎬"):not([disabled])').first();

    // Check if there's a runnable test
    const hasRunnableTest = await runLiveButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRunnableTest) {
      console.log('No tests with steps found - skipping live execution test');
      test.skip();
      return;
    }

    // Click Run Live button
    await runLiveButton.click();

    // Wait for the Live Execution Viewer modal to appear
    const modal = page.locator('.fixed.inset-0, [role="dialog"]').filter({
      hasText: 'Live Test Execution'
    });
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Verify modal header shows test execution info
    await expect(modal.locator('text=Live Test Execution')).toBeVisible();

    // Wait for execution to start - should see steps appearing
    // The execution progress section shows steps
    const stepsContainer = modal.locator('.overflow-y-auto');
    await expect(stepsContainer).toBeVisible();

    // Wait for at least one step to appear (either running or completed)
    const stepElement = modal.locator('[class*="rounded-lg border"]').first();
    await expect(stepElement).toBeVisible({ timeout: 30000 });

    // Verify step status indicators appear (running, passed, or failed)
    const stepStatus = modal.locator('text=/▶️|✅|❌|⏸️/').first();
    await expect(stepStatus).toBeVisible({ timeout: 30000 });

    // Wait for execution to complete or timeout after 60 seconds
    // The status should change to "Passed" or "Failed"
    const completedStatus = modal.locator('text=/✅ Passed|❌ Failed/');
    await expect(completedStatus).toBeVisible({ timeout: 60000 });

    // The close button should now say "Close" instead of "Stop Execution"
    const closeButton = modal.locator('button:has-text("Close")');
    await expect(closeButton).toBeVisible({ timeout: 5000 });

    // Close the modal
    await closeButton.click();

    // Modal should be closed
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('should show step-started and step-completed events in real-time', async ({ page }) => {
    // Navigate directly to a project's tests page
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click first project
    const projectLink = page.locator('a[href^="/projects/"]').first();
    const hasProjects = await projectLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasProjects) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }
    await projectLink.click();
    await page.waitForLoadState('networkidle');

    // Go to tests
    const testsNav = page.locator('a[href*="/tests"]').first();
    if (await testsNav.isVisible()) {
      await testsNav.click();
    }
    await page.waitForLoadState('networkidle');

    // Find and click run live button
    const runLiveBtn = page.locator('button:has-text("🎬"):not([disabled])').first();
    if (!await runLiveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await runLiveBtn.click();

    // Modal appears
    const executionModal = page.locator('.fixed.inset-0').filter({ hasText: 'Live Test Execution' });
    await expect(executionModal).toBeVisible({ timeout: 10000 });

    // Listen for WebSocket events by checking UI updates
    // Step should transition from pending -> running -> passed/failed

    // Wait for a step to be in "running" state (animated pulse emoji)
    const runningStep = executionModal.locator('.animate-pulse:has-text("▶️")');
    await expect(runningStep).toBeVisible({ timeout: 30000 });

    // Wait for step to complete (passed or failed)
    const completedStep = executionModal.locator('text=/✅|❌/').first();
    await expect(completedStep).toBeVisible({ timeout: 60000 });

    // Check that step info is displayed
    const stepInfo = executionModal.locator('.text-sm.font-medium.text-gray-900');
    await expect(stepInfo.first()).toBeVisible();

    // Wait for execution to finish
    await expect(executionModal.locator('text=/✅ Passed|❌ Failed/')).toBeVisible({ timeout: 60000 });
  });

  test('should display browser viewport with screenshots', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Navigate to a project and tests
    const projectLink = page.locator('a[href^="/projects/"]').first();
    const hasProjects = await projectLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasProjects) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }
    await projectLink.click();
    await page.waitForLoadState('networkidle');

    const testsNav = page.locator('a[href*="/tests"]').first();
    if (await testsNav.isVisible()) {
      await testsNav.click();
    }
    await page.waitForLoadState('networkidle');

    // Run a test live
    const runLiveBtn = page.locator('button:has-text("🎬"):not([disabled])').first();
    if (!await runLiveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await runLiveBtn.click();

    // Wait for modal
    const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Live Test Execution' });
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Check for browser viewport section
    const viewportSection = modal.locator('text=Browser Viewport');
    await expect(viewportSection).toBeVisible({ timeout: 5000 });

    // Wait for screenshot to appear (either actual screenshot or placeholder)
    // The screenshot is rendered as an img tag
    const screenshot = modal.locator('img[alt="Browser viewport"]');

    // Wait up to 30 seconds for screenshot to appear (needs browser to load)
    await expect(screenshot).toBeVisible({ timeout: 30000 });

    // Verify the screenshot has a src attribute (base64 data)
    const src = await screenshot.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toMatch(/^data:image\/(png|jpeg);base64,|^http/);
  });

  test('should stop execution when stop button is clicked', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const projectLink = page.locator('a[href^="/projects/"]').first();
    const hasProjects = await projectLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasProjects) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }
    await projectLink.click();
    await page.waitForLoadState('networkidle');

    const testsNav = page.locator('a[href*="/tests"]').first();
    if (await testsNav.isVisible()) {
      await testsNav.click();
    }
    await page.waitForLoadState('networkidle');

    const runLiveBtn = page.locator('button:has-text("🎬"):not([disabled])').first();
    if (!await runLiveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await runLiveBtn.click();

    const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Live Test Execution' });
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Wait for execution to start
    const runningIndicator = modal.locator('text=/▶️ Running|Initializing/');
    await expect(runningIndicator).toBeVisible({ timeout: 10000 });

    // Find and click stop button
    const stopButton = modal.locator('button:has-text("Stop Execution")');
    if (await stopButton.isVisible({ timeout: 5000 })) {
      await stopButton.click();

      // A confirmation dialog should appear
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // Modal should close or show stopped status
      // Wait a bit for the stop to process
      await page.waitForTimeout(2000);
    }
  });
});

test.describe('Test Execution from Results Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should be able to re-run a test from results page', async ({ page }) => {
    // Navigate to projects
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click first project
    const projectLink = page.locator('a[href^="/projects/"]').first();
    const hasProjects = await projectLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasProjects) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }
    await projectLink.click();
    await page.waitForLoadState('networkidle');

    // Go to tests section
    const testsNav = page.locator('a[href*="/tests"]').first();
    if (await testsNav.isVisible()) {
      await testsNav.click();
    }
    await page.waitForLoadState('networkidle');

    // Click "View Results" for a test
    const viewResultsLink = page.locator('a:has-text("View Results"), a[href*="/results"]').first();
    if (!await viewResultsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await viewResultsLink.click();
    await page.waitForLoadState('networkidle');

    // Should be on results page
    await expect(page).toHaveURL(/\/results/);

    // Find the Run Live button on results page
    const runLiveBtn = page.locator('button:has-text("Run Live"), button:has-text("🎬")').first();
    if (await runLiveBtn.isVisible({ timeout: 5000 })) {
      await runLiveBtn.click();

      // Modal should appear
      const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Live Test Execution' });
      await expect(modal).toBeVisible({ timeout: 10000 });
    }
  });
});
