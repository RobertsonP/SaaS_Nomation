import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chromium, Browser, Page } from 'playwright';
import { AuthFlowsService } from '../auth-flows/auth-flows.service';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import { LoginFlow } from '../ai/interfaces/element.interface';

interface TestStep {
  id: string;
  type: 'click' | 'type' | 'wait' | 'assert';
  selector: string;
  value?: string;
  description: string;
}

@Injectable()
export class ExecutionService {
  constructor(
    private prisma: PrismaService,
    private authFlowsService: AuthFlowsService,
    private unifiedAuthService: UnifiedAuthService
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
        for (const step of steps) {
          try {
            await this.executeStep(page, step);
            
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
              timestamp: new Date(),
            });
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
      await this.prisma.testExecution.update({
        where: { id: execution.id },
        data: {
          status: success ? 'passed' : 'failed',
          completedAt: new Date(),
          duration: Date.now() - execution.startedAt.getTime(),
          errorMsg,
          results,
          screenshots,
        },
      });

      return execution;
    } catch (error) {
      console.error('Test execution failed:', error);
      throw error;
    }
  }

  private async executeStep(page: Page, step: TestStep) {
    const timeout = 10000; // 10 seconds timeout

    try {
      // Modern Playwright API: Use page.locator() for all selector types
      // This properly handles:
      // - CSS selectors: #id, .class, [attribute]
      // - Playwright CSS extensions: :has-text(), :visible, :enabled
      // - Deep combinators: >> for shadow DOM piercing
      // - XPath selectors: //button[@type="submit"]
      const locator = page.locator(step.selector).first();

      switch (step.type) {
        case 'click':
          // MODERNIZED: Use locator.click() instead of deprecated page.click()
          await locator.click({ timeout });
          console.log(`✓ Clicked element: ${step.selector}`);
          break;

        case 'type':
          // MODERNIZED: Use locator.fill() instead of deprecated page.fill()
          await locator.fill(step.value || '', { timeout });
          console.log(`✓ Filled element: ${step.selector} with "${step.value}"`);
          break;

        case 'wait':
          const waitTime = parseInt(step.value || '1000', 10);
          await page.waitForTimeout(waitTime);
          console.log(`✓ Waited for ${waitTime}ms`);
          break;

        case 'assert':
          const textContent = await locator.textContent({ timeout });
          if (!textContent || !textContent.includes(step.value || '')) {
            throw new Error(
              `Assertion failed: Expected "${step.value}" but found "${textContent}"`
            );
          }
          console.log(`✓ Assertion passed: "${step.value}" found in "${textContent}"`);
          break;

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
        type: 'png',
        fullPage: true
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