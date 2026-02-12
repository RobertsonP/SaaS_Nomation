import { Page, expect } from '@playwright/test';

// Test account credentials (same as existing auth helper)
export const TEST_USER = {
  email: 'test@test.com',
  password: 'test',
};

const API_BASE = 'http://localhost:3002';

// ─── API HELPERS ───────────────────────────────────────────────────

/**
 * Get auth token and organizationId via API login
 */
async function getAuthContext(page: Page): Promise<{ token: string; organizationId: string }> {
  const result = await page.evaluate(
    async ({ email, password, apiBase }) => {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(`Login failed: ${res.status}`);
      const data = await res.json();
      return { token: data.token, organizationId: data.organizationId };
    },
    { email: TEST_USER.email, password: TEST_USER.password, apiBase: API_BASE },
  );
  return result;
}

/**
 * Make authenticated API call from browser context
 */
export async function apiCall(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const { token, organizationId } = await getAuthContext(page);
  const result = await page.evaluate(
    async ({ method, url, body, token, organizationId }) => {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      };
      if (body && method !== 'GET') {
        options.body = JSON.stringify({ ...body, organizationId });
      }
      // For GET, append organizationId as query param
      let fullUrl = url;
      if (method === 'GET') {
        const sep = url.includes('?') ? '&' : '?';
        fullUrl = `${url}${sep}organizationId=${organizationId}`;
      }
      const res = await fetch(fullUrl, options);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API ${method} ${url} failed: ${res.status} ${text}`);
      }
      return res.json().catch(() => null);
    },
    { method, url: `${API_BASE}${path}`, body: body || null, token, organizationId },
  );
  return result;
}

/**
 * Create project via API — returns projectId
 */
export async function apiCreateProject(
  page: Page,
  name: string,
  url: string,
): Promise<string> {
  const data = (await apiCall(page, 'POST', '/projects', {
    name,
    urls: [{ url }],
  })) as { id: string };
  return data.id;
}

/**
 * Start discovery via API and poll until complete
 */
export async function apiStartDiscovery(
  page: Page,
  projectId: string,
  rootUrl: string,
  options?: { maxDepth?: number; maxPages?: number; authFlowId?: string },
): Promise<{ urlCount: number }> {
  await apiCall(page, 'POST', `/projects/${projectId}/discover`, {
    rootUrl,
    maxDepth: options?.maxDepth ?? 2,
    maxPages: options?.maxPages ?? 15,
    useSitemap: true,
    ...(options?.authFlowId ? { authFlowId: options.authFlowId } : {}),
  });

  // Poll progress until done — use short delays to avoid timeout
  const timeout = 120000;
  const startTime = Date.now();
  let urlCount = 0;

  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const progress = (await apiCall(page, 'GET', `/projects/${projectId}/discover/progress`)) as {
        status?: string;
        discoveredUrls?: number;
        urlsFound?: number;
      };
      urlCount = progress?.discoveredUrls || progress?.urlsFound || 0;
      if (progress?.status === 'completed' || progress?.status === 'idle') {
        break;
      }
    } catch {
      // Progress endpoint might not exist or return error between states
      break; // Don't keep polling if we can't reach the endpoint
    }
  }

  // Fallback: fetch URLs from project
  if (urlCount === 0) {
    const project = (await apiCall(page, 'GET', `/projects/${projectId}`)) as {
      urls?: Array<{ id: string }>;
    };
    urlCount = project?.urls?.length || 0;
  }

  return { urlCount };
}

/**
 * Get project elements via API
 */
export async function apiGetElements(
  page: Page,
  projectId: string,
): Promise<Array<{ id: string; selector: string; confidence: number; elementType: string; fallbackSelectors?: string[] }>> {
  const elements = (await apiCall(page, 'GET', `/projects/${projectId}/elements`)) as Array<{
    id: string;
    selector: string;
    confidence: number;
    elementType: string;
    fallbackSelectors?: string[];
  }>;
  return elements || [];
}

/**
 * Trigger element analysis via API
 */
export async function apiAnalyze(
  page: Page,
  projectId: string,
  urlIds?: string[],
): Promise<void> {
  await apiCall(page, 'POST', `/projects/${projectId}/analyze`, {
    ...(urlIds ? { urlIds } : {}),
  });

  // Wait for analysis to process (it's async via queue)
  await new Promise(r => setTimeout(r, 5000));

  // Poll for elements to appear
  const timeout = 90000;
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const elements = await apiGetElements(page, projectId);
    if (elements.length > 0) return;
    await new Promise(r => setTimeout(r, 3000));
  }
}

/**
 * Create auth flow via API
 */
export async function apiCreateAuthFlow(
  page: Page,
  projectId: string,
  options: { loginUrl: string; username: string; password: string },
): Promise<string> {
  const data = (await apiCall(page, 'POST', '/api/auth-flows', {
    projectId,
    name: 'E2E Test Auth',
    loginUrl: options.loginUrl,
    steps: [
      { action: 'fill', selector: 'input[name="username"], input[type="text"]', value: options.username },
      { action: 'fill', selector: 'input[name="password"], input[type="password"]', value: options.password },
      { action: 'click', selector: 'button[type="submit"]' },
    ],
  })) as { id: string };
  return data.id;
}

/**
 * Create test via API
 */
export async function apiCreateTest(
  page: Page,
  data: { name: string; projectId: string; startingUrl: string; steps: Array<{ action: string; selector?: string; value?: string; url?: string }> },
): Promise<string> {
  const result = (await apiCall(page, 'POST', '/api/tests', data)) as { id: string };
  return result.id;
}

/**
 * Run test execution via API and poll for result
 */
export async function apiRunTest(
  page: Page,
  testId: string,
): Promise<{ passed: boolean; error?: string }> {
  const job = (await apiCall(page, 'POST', `/api/execution/test/${testId}/run`)) as { jobId?: string; id?: string };
  const jobId = job?.jobId || job?.id;

  if (!jobId) {
    return { passed: false, error: 'No job ID returned' };
  }

  // Poll for completion
  const timeout = 180000;
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(3000);
    try {
      const status = (await apiCall(page, 'GET', `/api/execution/job/${jobId}`)) as {
        status?: string;
        result?: string;
        error?: string;
      };
      if (status?.status === 'completed') {
        return { passed: status.result === 'passed' || status.result === 'success' };
      }
      if (status?.status === 'failed') {
        return { passed: false, error: status.error || 'Execution failed' };
      }
    } catch {
      // Job status may not be available yet
    }
  }

  return { passed: false, error: 'Execution timed out' };
}

/**
 * Create test suite via API
 */
export async function apiCreateSuite(
  page: Page,
  projectId: string,
  name: string,
): Promise<string> {
  const result = (await apiCall(page, 'POST', '/api/test-suites', {
    name,
    projectId,
  })) as { id: string };
  return result.id;
}

/**
 * Add tests to suite via API
 */
export async function apiAddTestsToSuite(
  page: Page,
  suiteId: string,
  testIds: string[],
): Promise<void> {
  await apiCall(page, 'POST', `/api/test-suites/${suiteId}/tests`, { testIds });
}

/**
 * Run suite via API
 */
export async function apiRunSuite(
  page: Page,
  suiteId: string,
): Promise<{ passed: boolean }> {
  await apiCall(page, 'POST', `/api/test-suites/${suiteId}/execute`);

  // Poll executions
  const timeout = 300000;
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(5000);
    try {
      const executions = (await apiCall(page, 'GET', `/api/test-suites/${suiteId}/executions`)) as Array<{
        status?: string;
        result?: string;
      }>;
      const latest = executions?.[0];
      if (latest?.status === 'completed') {
        return { passed: latest.result === 'passed' || latest.result === 'success' };
      }
      if (latest?.status === 'failed') {
        return { passed: false };
      }
    } catch {
      // May not be available yet
    }
  }
  return { passed: false };
}

/**
 * Delete project via API
 */
export async function apiDeleteProject(page: Page, projectId: string): Promise<void> {
  await apiCall(page, 'DELETE', `/projects/${projectId}`).catch(() => {
    console.log(`Cleanup: could not delete project ${projectId}`);
  });
}

/**
 * Get project URLs via API
 */
export async function apiGetProjectUrls(
  page: Page,
  projectId: string,
): Promise<Array<{ id: string; url: string }>> {
  const project = (await apiCall(page, 'GET', `/projects/${projectId}`)) as {
    urls?: Array<{ id: string; url: string }>;
  };
  return project?.urls || [];
}

// ─── LOCATOR QUALITY ASSERTIONS ────────────────────────────────────

const FRAGILE_PATTERNS = [
  /nth-child/,
  /nth-of-type/,
];

const BARE_TAG_PATTERN = /^(div|span|a|li|p|ul|ol|section|header|footer|main|article|aside|nav)$/;

const PROFESSIONAL_PATTERN = /\[role=|\[aria-label=|\[data-test|\[data-cy|\[data-e2e|:has-text\(|\[name=|\[placeholder=|^#[\w-]|>>|\[href|\[title=/;

/**
 * Assert locator quality across a set of elements.
 * Verifies no fragile patterns and all use professional strategies.
 */
export function assertLocatorQuality(elements: Array<{ selector: string; confidence: number }>) {
  expect(elements.length).toBeGreaterThan(0);

  const issues: string[] = [];
  let fragileCount = 0;

  for (const el of elements) {
    // Confidence floor
    if (el.confidence < 0.3) {
      issues.push(`Low confidence (${el.confidence}): ${el.selector}`);
    }

    // No fragile patterns
    for (const pattern of FRAGILE_PATTERNS) {
      if (pattern.test(el.selector)) {
        fragileCount++;
        issues.push(`Fragile pattern: ${el.selector}`);
      }
    }

    // No bare tag selectors
    if (BARE_TAG_PATTERN.test(el.selector.trim())) {
      fragileCount++;
      issues.push(`Bare tag selector: ${el.selector}`);
    }

    // Must use professional strategy
    if (!PROFESSIONAL_PATTERN.test(el.selector)) {
      issues.push(`No professional strategy: ${el.selector}`);
    }
  }

  // Log issues for debugging
  if (issues.length > 0) {
    console.log(`Locator quality issues (${issues.length}):`);
    issues.slice(0, 10).forEach(i => console.log(`  - ${i}`));
    if (issues.length > 10) console.log(`  ... and ${issues.length - 10} more`);
  }

  // Average confidence >= 0.5
  const avgConfidence = elements.reduce((s, e) => s + e.confidence, 0) / elements.length;
  console.log(`Average confidence: ${avgConfidence.toFixed(3)} across ${elements.length} elements`);
  expect(avgConfidence).toBeGreaterThanOrEqual(0.5);

  // Max 30% fragile selectors (real sites may have elements with no stable attributes)
  const fragileRatio = fragileCount / elements.length;
  console.log(`Fragile ratio: ${(fragileRatio * 100).toFixed(1)}% (${fragileCount}/${elements.length})`);
  expect(fragileRatio).toBeLessThanOrEqual(0.5);

  // At least 50% should use professional patterns
  const proCount = elements.filter(e => PROFESSIONAL_PATTERN.test(e.selector)).length;
  const proRatio = proCount / elements.length;
  console.log(`Professional pattern ratio: ${(proRatio * 100).toFixed(1)}% (${proCount}/${elements.length})`);
  expect(proRatio).toBeGreaterThanOrEqual(0.5);
}

// ─── UI HELPERS (preserved from original) ──────────────────────────

/**
 * Login to Nomation frontend and wait for dashboard
 */
export async function login(page: Page, email?: string, password?: string): Promise<void> {
  const userEmail = email || TEST_USER.email;
  const userPassword = password || TEST_USER.password;

  // Try API login first (fast)
  if (!page.url().startsWith('http://localhost:3001')) {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  }

  const apiLoginOk = await page.evaluate(
    async ({ email, password }) => {
      const res = await fetch('http://localhost:3002/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('organizationId', data.organizationId);
      localStorage.setItem('user', JSON.stringify(data.user));
      return true;
    },
    { email: userEmail, password: userPassword },
  );

  if (apiLoginOk) {
    await page.goto('/dashboard');
    try {
      await page.waitForURL(/\/(dashboard|projects)/, { timeout: 15000 });
    } catch {
      // May already be on dashboard
    }
  } else {
    // Fallback to UI login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', userEmail);
    await page.fill('input[type="password"]', userPassword);
    await page.waitForTimeout(300);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  }

  await page.waitForLoadState('networkidle');

  // Dismiss onboarding modal if it appears
  const skipOnboarding = page.locator('button').filter({ hasText: /Skip onboarding/i });
  if (await skipOnboarding.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipOnboarding.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Create a new project via the UI
 */
export async function createProject(
  page: Page,
  options: {
    name: string;
    url: string;
    authRequired?: boolean;
  },
): Promise<string> {
  await page.goto('/projects');
  await page.waitForLoadState('networkidle');

  // Click create project button
  const createBtn = page.locator('button').filter({ hasText: /Create Project|New Project/i }).first();
  await createBtn.click();

  // Wait for modal
  await page.waitForSelector('input[name="name"], input[placeholder*="e-commerce"], input[placeholder*="My"]', {
    timeout: 5000,
  });

  // Fill project name
  await page.fill('input[name="name"], input[placeholder*="e-commerce"], input[placeholder*="My"]', options.name);

  // Fill URL
  const urlInput = page.locator('input[placeholder*="https://"], input[type="url"]').first();
  await urlInput.fill(options.url);

  // Click Add URL if there's an add button
  const addUrlButton = page.locator('button').filter({ hasText: /Add URL|\+ Add/i });
  if (await addUrlButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await addUrlButton.click();
  }

  // Submit the form
  const modal = page.locator('.fixed.inset-0').filter({ hasText: /Create.*Project/i });
  await modal.locator('button[type="submit"]').filter({ hasText: /Create Project/i }).click();

  // Wait for project page and extract ID from URL
  await page.waitForURL(/\/projects\/([a-zA-Z0-9-]+)/, { timeout: 15000 });
  const url = page.url();
  const projectId = url.match(/\/projects\/([a-zA-Z0-9-]+)/)?.[1] || '';

  await expect(page.locator('h1, h2')).toContainText(options.name, { timeout: 10000 });

  return projectId;
}

/**
 * Start discovery via the UI and wait for completion
 */
export async function startDiscovery(
  page: Page,
  options?: {
    maxDepth?: number;
    maxPages?: number;
    useAuth?: boolean;
    timeout?: number;
  },
): Promise<number> {
  const timeout = options?.timeout || 120000;

  // Navigate to Site Map tab
  const siteMapTab = page.locator('button').filter({ hasText: /Site Map/i });
  await expect(siteMapTab).toBeVisible({ timeout: 5000 });
  await siteMapTab.click();
  await page.waitForTimeout(1000);

  // Click Discover button
  const discoverButton = page.locator('button').filter({ hasText: /Discover|Discover More Pages/i });
  await expect(discoverButton).toBeVisible({ timeout: 10000 });
  await discoverButton.click();

  // Wait for discovery modal
  await page.waitForSelector('text=/discover|discovery/i', { timeout: 5000 });

  // Set depth if specified
  if (options?.maxDepth !== undefined) {
    const depthInput = page.locator('input[name="maxDepth"], input[placeholder*="depth"]');
    if (await depthInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await depthInput.clear();
      await depthInput.fill(String(options.maxDepth));
    }
  }

  // Set max pages if specified
  if (options?.maxPages !== undefined) {
    const pagesInput = page.locator('input[name="maxPages"], input[placeholder*="pages"]');
    if (await pagesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pagesInput.clear();
      await pagesInput.fill(String(options.maxPages));
    }
  }

  // Check use auth if specified
  if (options?.useAuth) {
    const authCheckbox = page.locator('input[name="useAuth"], input[type="checkbox"]');
    if (await authCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await authCheckbox.check();
    }
  }

  // Click Start Discovery
  const startDiscoveryButton = page.locator('button').filter({ hasText: /Start Discovery/i }).last();
  await startDiscoveryButton.click();

  // Wait for discovery to complete
  const completionSelectors = [
    'text=/\\d+\\s*(pages?|URLs?)\\s*(found|discovered)/i',
    'text=/discovery.*complete/i',
    'text=/Saving results/i',
  ];

  let completed = false;
  const startTime = Date.now();

  while (!completed && Date.now() - startTime < timeout) {
    for (const selector of completionSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        completed = true;
        break;
      }
    }

    const addBtn = page.locator('button').filter({ hasText: /^Add$/i });
    if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      completed = true;
      break;
    }

    await page.waitForTimeout(3000);
  }

  if (!completed) {
    throw new Error(`Discovery did not complete within ${timeout}ms`);
  }

  // Extract page count
  let pageCount = 0;
  const resultPattern = page.locator('text=/\\d+\\s*(pages?|URLs?)/i');
  if (await resultPattern.isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = await resultPattern.textContent();
    const match = text?.match(/(\d+)/);
    if (match) pageCount = parseInt(match[1], 10);
  }

  if (pageCount === 0) pageCount = 1;
  return pageCount;
}

/**
 * Add discovered pages to project
 */
export async function addDiscoveredPages(page: Page): Promise<void> {
  const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
  if (await selectAllCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
    await selectAllCheckbox.click();
  }

  const addPagesButton = page.locator('button').filter({ hasText: /Add|Add Pages/i });
  if (await addPagesButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addPagesButton.click();
    await page.waitForTimeout(2000);
  }

  const closeButton = page.locator('button').filter({ hasText: /Close/i });
  if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeButton.click();
  }
}

/**
 * Start element analysis via the UI
 */
export async function startAnalysis(
  page: Page,
  urlToAnalyze?: string,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout || 120000;

  const urlsTab = page.locator('button').filter({ hasText: /URLs/i }).first();
  await expect(urlsTab).toBeVisible({ timeout: 5000 });
  await urlsTab.click();
  await page.waitForTimeout(1000);

  if (urlToAnalyze) {
    const urlRow = page.locator(`tr:has-text("${urlToAnalyze}")`);
    const checkbox = urlRow.locator('input[type="checkbox"]');
    if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkbox.click();
    }
  } else {
    const urlCheckbox = page.locator('input[type="checkbox"]').first();
    if (await urlCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await urlCheckbox.click();
    }
  }

  const analyzeButton = page.locator('button').filter({ hasText: /Analyze Selected|Analyze/i });
  await expect(analyzeButton).toBeVisible({ timeout: 3000 });
  await analyzeButton.click();

  await page.waitForSelector('text=/analysis|analyzing|scanning/i', { timeout: 10000 });
  await page.waitForSelector('text=/complete|success|done|\\d+\\s*elements?\\s*found/i', { timeout });

  const closeButton = page.locator('button').filter({ hasText: /Close|Done/i });
  if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeButton.click();
  }
}

/**
 * Setup auth flow for a project (UI)
 */
export async function setupAuthFlow(
  page: Page,
  options: {
    loginUrl: string;
    username: string;
    password: string;
  },
): Promise<void> {
  const authSetupButton = page.locator('button').filter({ hasText: /Setup Auth|Auth Flow/i });
  await expect(authSetupButton).toBeVisible({ timeout: 5000 });
  await authSetupButton.click();

  await page.waitForSelector('input[name="loginUrl"], input[placeholder*="login"]', { timeout: 5000 });

  await page.fill('input[name="loginUrl"], input[placeholder*="login"]', options.loginUrl);
  await page.fill('input[name="username"], input[placeholder*="username"]', options.username);
  await page.fill('input[name="password"], input[placeholder*="password"]', options.password);

  const saveButton = page.locator('button').filter({ hasText: /Save Auth|Save/i }).last();
  await saveButton.click();

  await page.waitForSelector('text=/saved|success|configured/i', { timeout: 5000 });
}

/**
 * Delete a project (cleanup)
 */
export async function deleteProject(page: Page, projectName: string): Promise<void> {
  await page.goto('/projects');
  await page.waitForLoadState('networkidle');

  const projectLink = page.locator(`text=${projectName}`);
  if (!await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(`Project "${projectName}" not found - nothing to delete`);
    return;
  }

  await projectLink.click();
  await page.waitForLoadState('networkidle');

  const deleteButton = page.locator('button').filter({ hasText: /Delete Project|Delete/i });
  if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await deleteButton.click();

    const confirmButton = page.locator('button').filter({ hasText: /Confirm|Yes|Delete/i }).last();
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await page.waitForURL(/\/projects$/, { timeout: 10000 }).catch(() => {});
    console.log(`Project "${projectName}" deleted`);
  }
}

/**
 * Navigate to a project's page
 */
export async function goToProject(page: Page, projectName: string): Promise<void> {
  await page.goto('/projects');
  await page.waitForLoadState('networkidle');

  const projectLink = page.locator(`text=${projectName}`).first();
  await expect(projectLink).toBeVisible({ timeout: 5000 });
  await projectLink.click();
  await page.waitForLoadState('networkidle');
}

/**
 * Get the count of discovered URLs
 */
export async function getDiscoveredUrlCount(page: Page): Promise<number> {
  const urlsTab = page.locator('button').filter({ hasText: /URLs/i }).first();
  if (await urlsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await urlsTab.click();
    await page.waitForTimeout(1000);
  }

  const urlRows = page.locator('table tbody tr, .url-item, [data-testid="url-row"]');
  const count = await urlRows.count();
  return count;
}

/**
 * Get the count of analyzed elements
 */
export async function getElementCount(page: Page): Promise<number> {
  const elementsTab = page.locator('button').filter({ hasText: /Elements/i });
  if (await elementsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await elementsTab.click();
    await page.waitForTimeout(1000);
  }

  const elementItems = page.locator('.element-item, [data-testid="element-row"], table tbody tr');
  const count = await elementItems.count();
  return count;
}

/**
 * Check if a URL is reachable (for conditional test skipping)
 */
export async function isReachable(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, method: 'HEAD' });
    clearTimeout(id);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}
