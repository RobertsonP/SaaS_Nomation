import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chromium, Browser, Page } from 'playwright';
import { AuthFlowsService } from '../auth-flows/auth-flows.service';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import { LoginFlow } from '../ai/interfaces/element.interface';
import { ExecutionProgressGateway } from './execution.gateway';
import { SmartWaitService } from './smart-wait.service';
import { StepExecutorService } from './step-executor.service';
import { normalizeUrlForDocker } from '../utils/docker-url.utils';

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
    private progressGateway: ExecutionProgressGateway,
    private smartWaitService: SmartWaitService,
    private stepExecutor: StepExecutorService,
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

            // Close the original page before replacing with auth result page
            await page.close().catch(() => {});
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
          const dockerUrl = normalizeUrlForDocker(test.startingUrl);
          console.log(`🔍 Executing test without authentication for URL: ${test.startingUrl} → ${dockerUrl}`);
          await page.goto(dockerUrl);
          await this.smartWaitService.waitForNetworkIdle(page, 2000).catch(() => {});
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

  private async executeStep(page: Page, step: TestStep) {
    return this.stepExecutor.executeStep(page, step);
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