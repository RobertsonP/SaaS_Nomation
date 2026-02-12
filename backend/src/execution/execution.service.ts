import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chromium, Browser, Page } from 'playwright';
import { AuthFlowsService } from '../auth-flows/auth-flows.service';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import { LoginFlow } from '../ai/interfaces/element.interface';
import { ExecutionProgressGateway } from './execution.gateway';

interface TestStep {
  id: string;
  type: 'click' | 'type' | 'wait' | 'assert' // Existing types
      | 'hover' | 'select' | 'check' | 'uncheck' | 'navigate' | 'scroll' // New actions
      | 'press' | 'screenshot' | 'doubleclick' | 'rightclick' | 'clear' | 'upload'; // More new actions
  selector?: string;
  fallbackSelectors?: string[]; // NEW: Fallback selectors for robustness
  value?: string;
  description: string;
}

@Injectable()
export class ExecutionService {
  constructor(
    private prisma: PrismaService,
    private authFlowsService: AuthFlowsService,
    private unifiedAuthService: UnifiedAuthService,
    private progressGateway: ExecutionProgressGateway
  ) {}

  async executeTest(testId: string) {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      // Get test details
      const test = await this.prisma.test.findUnique({
        where: { id: testId },
        include: { project: true },
      });

      if (!test) {
        throw new Error('Test not found');
      }

      // Create execution record
      const execution = await this.prisma.testExecution.create({
        data: {
          testId,
          status: 'running',
          startedAt: new Date(),
        },
      });

      // Send WebSocket event: Test started
      this.progressGateway.sendTestStarted(execution.id, testId, test.name);

      const results: any[] = [];
      const screenshots: string[] = [];
      let success = true;
      let errorMsg: string | null = null;

      try {
        // Launch browser with Docker-compatible settings
        browser = await chromium.launch({ 
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        });
        page = await browser.newPage();

        // Check if test requires authentication and navigate to starting URL
        if (test.authFlowId) {
          try {
            console.log(`🔐 Executing test with authentication for URL: ${test.startingUrl}`);
            
            // Get auth flow details
            const authFlowData = await this.authFlowsService.getById(test.authFlowId);
            if (!authFlowData) {
              throw new Error('Authentication flow not found');
            }

            // Convert database authFlow to LoginFlow interface
            const authFlow: LoginFlow = {
              id: authFlowData.id,
              name: authFlowData.name,
              loginUrl: authFlowData.loginUrl,
              steps: Array.isArray(authFlowData.steps) ? authFlowData.steps as unknown as LoginFlow['steps'] : [],
              credentials: typeof authFlowData.credentials === 'object' ? authFlowData.credentials as unknown as LoginFlow['credentials'] : { username: '', password: '' }
            };

            // Use unified auth service for proper authentication flow
            const authResult = await this.unifiedAuthService.authenticateForUrl(
              test.startingUrl,
              authFlow,
              browser
            );

            if (!authResult.result.success) {
              throw new Error(`Authentication failed: ${authResult.result.errorMessage}`);
            }

            // Update browser and page references
            browser = authResult.browser;
            page = authResult.page;

            results.push({
              step: 'authentication',
              description: 'Perform authentication flow and navigate to starting URL',
              status: 'passed',
              timestamp: new Date(),
            });

            console.log(`✅ Authentication successful, on URL: ${authResult.result.finalUrl}`);
          } catch (authError) {
            console.error(`❌ Authentication failed:`, authError);
            results.push({
              step: 'authentication',
              description: 'Perform authentication flow and navigate to starting URL',
              status: 'failed',
              error: authError.message,
              timestamp: new Date(),
            });
            throw authError;
          }
        } else {
          // No authentication required, navigate directly
          console.log(`🔍 Executing test without authentication for URL: ${test.startingUrl}`);
          await page.goto(test.startingUrl);
        }
        
        // Capture initial screenshot
        const initialScreenshot = await this.capturePageScreenshot(page);
        if (initialScreenshot) {
          screenshots.push(initialScreenshot);
        }
        
        results.push({
          step: 'navigation',
          description: `Navigate to ${test.startingUrl}`,
          status: 'passed',
          timestamp: new Date(),
        });

        // Execute test steps
        const steps = test.steps as unknown as TestStep[];
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];

          try {
            // Send WebSocket event: Step started
            this.progressGateway.sendStepStarted(execution.id, i, steps.length, step.description);

            const result = await this.executeStep(page, step);

            // Capture screenshot after each step
            const stepScreenshot = await this.capturePageScreenshot(page);
            if (stepScreenshot) {
              screenshots.push(stepScreenshot);
            }

            results.push({
              step: step.type,
              description: step.description,
              selector: step.selector,
              value: step.value,
              status: 'passed',
              result,
              timestamp: new Date(),
            });

            // Send WebSocket event: Step completed
            this.progressGateway.sendStepCompleted(execution.id, i, steps.length, step.description);

          } catch (error) {
            success = false;
            errorMsg = `Step "${step.description}" failed: ${error.message}`;

            // Capture screenshot of error state
            const errorScreenshot = await this.capturePageScreenshot(page);
            if (errorScreenshot) {
              screenshots.push(errorScreenshot);
            }

            results.push({
              step: step.type,
              description: step.description,
              selector: step.selector,
              value: step.value,
              status: 'failed',
              error: error.message,
              timestamp: new Date(),
            });

            // Send WebSocket event: Step failed
            this.progressGateway.sendStepFailed(execution.id, i, steps.length, step.description, error.message);

            break;
          }
        }
      } catch (error) {
        success = false;
        errorMsg = error.message;
      } finally {
        if (page) await page.close();
        if (browser) await browser.close();
      }

      // Update execution record
      const duration = Date.now() - execution.startedAt.getTime();
      await this.prisma.testExecution.update({
        where: { id: execution.id },
        data: {
          status: success ? 'passed' : 'failed',
          completedAt: new Date(),
          duration,
          errorMsg,
          results,
          screenshots,
        },
      });

      // Send WebSocket event: Test completed or failed
      if (success) {
        this.progressGateway.sendTestCompleted(execution.id, testId, test.name, duration);
      } else {
        this.progressGateway.sendTestFailed(execution.id, testId, test.name, errorMsg || 'Unknown error');
      }

      // Return fresh execution object with updated results from database
      return this.prisma.testExecution.findUnique({
        where: { id: execution.id },
        include: { test: true },
      });
    } catch (error) {
      console.error('Test execution failed:', error);
      throw error;
    }
  }

  /**
   * NEW: Get reliable locator with fallback selector support
   * Tries primary selector first, then fallback selectors until one works
   */
  private async getReliableLocator(page: Page, step: TestStep) {
    const selectors = [
      step.selector,
      ...(step.fallbackSelectors || [])
    ];

    console.log(`🎯 Attempting ${selectors.length} selector(s) for "${step.description || step.type}"`);

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      try {
        const locator = page.locator(selector);

        // Check if locator actually finds element(s)
        const count = await locator.count();

        if (count > 0) {
          if (i === 0) {
            console.log(`✅ Primary selector works: ${selector}`);
          } else {
            console.log(`⚠️ Primary failed, using fallback #${i}: ${selector}`);
          }
          return locator.first();
        } else {
          console.log(`❌ Selector ${i + 1}/${selectors.length} found 0 elements: ${selector}`);
        }
      } catch (error) {
        console.warn(`❌ Selector ${i + 1}/${selectors.length} failed: ${selector} - ${error.message}`);
      }
    }

    // All selectors failed
    throw new Error(
      `Element not found. Tried ${selectors.length} selector(s):\n` +
      selectors.map((s, i) => `  ${i + 1}. ${s}`).join('\n') +
      `\n\nHint: Element may have changed or not be visible on this page.`
    );
  }

  private async executeStep(page: Page, step: TestStep) {
    const timeout = 10000; // 10 seconds timeout

    console.log(`[DEBUG] Executing step: ${step.type} - ${step.description}`);

    try {
      // Use reliable locator with fallback support
      const locator = await this.getReliableLocator(page, step);

      switch (step.type) {
        case 'click':
          // MODERNIZED: Use locator.click() instead of deprecated page.click()
          await locator.click({ timeout });
          console.log(`✓ Clicked element: ${step.selector}`);
          return { success: true, action: 'click', selector: step.selector };

        case 'type':
          // MODERNIZED: Use locator.fill() instead of deprecated page.fill()
          await locator.fill(step.value || '', { timeout });
          console.log(`✓ Filled element: ${step.selector} with "${step.value}"`);
          return { success: true, action: 'type', selector: step.selector, value: step.value };

        case 'wait':
          const rawWaitTime = parseInt(step.value || '1000', 10);

          // Validate timeout: must be positive and capped at 60 seconds
          if (isNaN(rawWaitTime) || rawWaitTime < 0) {
            throw new Error(`Invalid wait time: ${step.value}. Must be a positive number.`);
          }

          const waitTime = Math.min(rawWaitTime, 60000); // Cap at 60 seconds

          if (rawWaitTime > 60000) {
            console.warn(`⚠️ Wait time ${rawWaitTime}ms exceeded max, capped to 60000ms`);
          }

          await page.waitForTimeout(waitTime);
          console.log(`✓ Waited for ${waitTime}ms`);
          return { success: true, action: 'wait', value: waitTime };

        case 'assert':
          const textContent = await locator.textContent({ timeout });
          if (!textContent || !textContent.includes(step.value || '')) {
            throw new Error(
              `Assertion failed: Expected "${step.value}" but found "${textContent}"`
            );
          }
          console.log(`✓ Assertion passed: "${step.value}" found in "${textContent}"`);
          return { success: true, action: 'assert', value: step.value, actual: textContent };

        // NEW ACTIONS - Gemini Implements These
        case 'hover':
          await locator.hover({ timeout });
          console.log(`✓ Hovered over: ${step.selector}`);
          return { success: true, action: 'hover', selector: step.selector };

        case 'select':
          await locator.selectOption(step.value || '', { timeout });
          console.log(`✓ Selected option "${step.value}" in: ${step.selector}`);
          return { success: true, action: 'select', selector: step.selector, value: step.value };

        case 'check':
          await locator.check({ timeout });
          console.log(`✓ Checked: ${step.selector}`);
          return { success: true, action: 'check', selector: step.selector };

        case 'uncheck':
          await locator.uncheck({ timeout });
          console.log(`✓ Unchecked: ${step.selector}`);
          return { success: true, action: 'uncheck', selector: step.selector };

        case 'navigate':
          // For navigation, the locator is not relevant, use page.goto
          await page.goto(step.value || '', {
            waitUntil: 'domcontentloaded', // Wait for basic page content
            timeout
          });
          console.log(`✓ Navigated to: ${step.value}`);
          return { success: true, action: 'navigate', url: step.value };

        case 'scroll':
          await locator.scrollIntoViewIfNeeded({ timeout });
          console.log(`✓ Scrolled to: ${step.selector}`);
          return { success: true, action: 'scroll', selector: step.selector };

        case 'press':
          await page.keyboard.press(step.value || 'Enter'); // Default to Enter key
          console.log(`✓ Pressed key: ${step.value}`);
          return { success: true, action: 'press', key: step.value };

        case 'screenshot':
          const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false, timeout: 5000 });
          const screenshotBase64 = screenshotBuffer.toString('base64');
          console.log(`✓ Captured screenshot`);
          return { success: true, action: 'screenshot', screenshot: `data:image/jpeg;base64,${screenshotBase64}` };

        case 'doubleclick':
          await locator.dblclick({ timeout });
          console.log(`✓ Double-clicked: ${step.selector}`);
          return { success: true, action: 'doubleclick', selector: step.selector };

        case 'rightclick':
          await locator.click({ button: 'right', timeout });
          console.log(`✓ Right-clicked: ${step.selector}`);
          return { success: true, action: 'rightclick', selector: step.selector };

        case 'clear':
          await locator.clear({ timeout });
          console.log(`✓ Cleared: ${step.selector}`);
          return { success: true, action: 'clear', selector: step.selector };

        case 'upload':
          // step.value should be the path to the file to upload
          await locator.setInputFiles(step.value || '', { timeout });
          console.log(`✓ Uploaded file to: ${step.selector}`);
          return { success: true, action: 'upload', selector: step.selector, filePath: step.value };

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      // Wait a bit between steps for stability
      await page.waitForTimeout(500);

    } catch (error) {
      // Enhanced error handling with selector information
      console.error(`✗ Step execution failed:`, {
        type: step.type,
        selector: step.selector,
        value: step.value,
        error: error.message
      });

      // Check if it's a selector error
      if (error.message.includes('selector') || error.message.includes('locator')) {
        throw new Error(
          `Invalid selector "${step.selector}": ${error.message}\n` +
          `Hint: Ensure the selector is valid CSS or Playwright syntax.`
        );
      }

      throw error;
    }
  }

  // NOTE: performAuthentication method removed - now using UnifiedAuthService

  private async capturePageScreenshot(page: Page): Promise<string | null> {
    try {
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 70,
        fullPage: false,
        timeout: 5000,
      });
      return screenshot.toString('base64');
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      return null;
    }
  }

  async getExecutionResults(testId: string) {
    return this.prisma.testExecution.findMany({
      where: { testId },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });
  }

  async getExecutionById(executionId: string) {
    return this.prisma.testExecution.findUnique({
      where: { id: executionId },
      include: { test: { include: { project: true } } },
    });
  }
}