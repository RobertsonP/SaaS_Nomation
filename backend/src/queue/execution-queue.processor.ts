import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { chromium, Browser, Page } from 'playwright';
import { AuthFlowsService } from '../auth-flows/auth-flows.service';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import { LoginFlow } from '../ai/interfaces/element.interface';
import { ExecutionProgressGateway } from '../execution/execution.gateway';
import { TestExecutionJobData } from './execution-queue.service';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { SmartWaitService } from '../execution/smart-wait.service';

interface TestStep {
  id: string;
  type: 'click' | 'type' | 'wait' | 'assert'
      | 'hover' | 'select' | 'check' | 'uncheck' | 'navigate' | 'scroll'
      | 'press' | 'screenshot' | 'doubleclick' | 'rightclick' | 'clear' | 'upload';
  selector?: string;
  fallbackSelectors?: string[];
  value?: string;
  description: string;
  timeout?: number;
}

/**
 * Normalize URL for Docker execution
 * Converts localhost URLs to host.docker.internal so browser inside Docker can reach host machine
 */
function normalizeUrlForDocker(url: string): string {
  if (!url) return url;

  try {
    // Add protocol if missing
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'http://' + normalizedUrl;
    }

    const urlObj = new URL(normalizedUrl);

    // Convert localhost/127.0.0.1 to host.docker.internal for Docker compatibility
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      urlObj.hostname = 'host.docker.internal';
      return urlObj.toString();
    }

    return normalizedUrl;
  } catch {
    // If URL parsing fails, try simple string replacement
    return url
      .replace(/^localhost:/, 'http://host.docker.internal:')
      .replace(/^127\.0\.0\.1:/, 'http://host.docker.internal:')
      .replace('://localhost:', '://host.docker.internal:')
      .replace('://127.0.0.1:', '://host.docker.internal:');
  }
}

@Processor('test-execution')
export class ExecutionQueueProcessor {
  constructor(
    private prisma: PrismaService,
    private authFlowsService: AuthFlowsService,
    private unifiedAuthService: UnifiedAuthService,
    private progressGateway: ExecutionProgressGateway,
    private smartWaitService: SmartWaitService,
  ) {}

  @Process('execute-test')
  async handleTestExecution(job: Job<TestExecutionJobData>) {
    const { testId } = job.data;
    let browser: Browser | null = null;
    let page: Page | null = null;

    console.log(`🚀 [Job ${job.id}] Starting test execution for test ${testId}`);

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

      // Send WebSocket event: Test started (generic event)
      this.progressGateway.sendTestStarted(execution.id, testId, test.name);

      // Update job progress
      await job.progress(10);

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

        // Create browser context with video recording
        const context = await browser.newContext({
          recordVideo: {
            dir: join(process.cwd(), 'uploads', 'videos'),
            size: { width: 1920, height: 1080 }, // Desktop resolution
          },
          viewport: { width: 1920, height: 1080 },
        });

        page = await context.newPage();

        await job.progress(20);

        // Check if test requires authentication
        if (test.authFlowId) {
          try {
            console.log(`🔐 [Job ${job.id}] Executing with authentication for URL: ${test.startingUrl}`);

            const authFlowData = await this.authFlowsService.getById(test.authFlowId);
            if (!authFlowData) {
              throw new Error('Authentication flow not found');
            }

            const authFlow: LoginFlow = {
              id: authFlowData.id,
              name: authFlowData.name,
              loginUrl: normalizeUrlForDocker(authFlowData.loginUrl),
              steps: Array.isArray(authFlowData.steps) ? authFlowData.steps as unknown as LoginFlow['steps'] : [],
              credentials: typeof authFlowData.credentials === 'object' ? authFlowData.credentials as unknown as LoginFlow['credentials'] : { username: '', password: '' }
            };

            const authResult = await this.unifiedAuthService.authenticateForUrl(
              normalizeUrlForDocker(test.startingUrl),
              authFlow,
              browser
            );

            if (!authResult.result.success) {
              throw new Error(`Authentication failed: ${authResult.result.errorMessage}`);
            }

            browser = authResult.browser;
            page = authResult.page;

            results.push({
              step: 'authentication',
              description: 'Perform authentication flow and navigate to starting URL',
              status: 'passed',
              timestamp: new Date(),
            });

            console.log(`✅ [Job ${job.id}] Authentication successful`);
          } catch (authError) {
            console.error(`❌ [Job ${job.id}] Authentication failed:`, authError);
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
          const dockerUrl = normalizeUrlForDocker(test.startingUrl);
          console.log(`🔍 [Job ${job.id}] Executing without authentication for URL: ${test.startingUrl} → ${dockerUrl}`);
          await page.goto(dockerUrl);
        }

        await job.progress(30);

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

        // Send LiveExecutionViewer-compatible execution started event
        this.progressGateway.sendExecutionStartedEvent(execution.id, steps.length, test.name);

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];

          // Update progress (30% for setup, 60% for steps, 10% for teardown)
          const stepProgress = 30 + Math.floor((i / steps.length) * 60);
          await job.progress(stepProgress);

          try {
            // Generic event
            this.progressGateway.sendStepStarted(execution.id, i, steps.length, step.description);
            // LiveExecutionViewer event
            this.progressGateway.sendStepStartedEvent(execution.id, i, step);

            const result = await this.executeStepWithRetry(page, step, execution.id, i, steps.length);

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
              attempts: result.attempts,
              result,
              timestamp: new Date(),
            });

            // Generic event
            this.progressGateway.sendStepCompleted(execution.id, i, steps.length, step.description);
            // LiveExecutionViewer event with screenshot
            this.progressGateway.sendStepCompletedEvent(
              execution.id,
              i,
              'passed',
              stepScreenshot ? `data:image/png;base64,${stepScreenshot}` : undefined,
              undefined,
              result.duration
            );
            // Viewport update with screenshot
            if (stepScreenshot) {
              this.progressGateway.sendViewportUpdate(
                execution.id,
                `data:image/png;base64,${stepScreenshot}`,
                { width: 1920, height: 1080, url: test.startingUrl }
              );
            }

          } catch (error) {
            success = false;
            errorMsg = `Step "${step.description}" failed: ${error.message}`;

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

            // Generic event
            this.progressGateway.sendStepFailed(execution.id, i, steps.length, step.description, error.message);
            // LiveExecutionViewer event
            this.progressGateway.sendStepCompletedEvent(
              execution.id,
              i,
              'failed',
              errorScreenshot ? `data:image/png;base64,${errorScreenshot}` : undefined,
              error.message
            );
            // Viewport update with error screenshot
            if (errorScreenshot) {
              this.progressGateway.sendViewportUpdate(
                execution.id,
                `data:image/png;base64,${errorScreenshot}`,
                { width: 1920, height: 1080, url: test.startingUrl }
              );
            }

            break;
          }
        }
      } catch (error) {
        success = false;
        errorMsg = error.message;
      } finally {
        //  CRITICAL: Video recording must NOT cause test failure
        let videoPath: string | null = null;
        let videoThumbnail: string | null = null;

        try {
          // Get video path before closing page
          const videoFilePath = page ? await page.video()?.path() : null;

          // Close page and browser to finalize video
          if (page) await page.close();
          if (browser) await browser.close();

          // Check if video file was created
          if (videoFilePath && existsSync(videoFilePath)) {
            videoPath = videoFilePath.replace(process.cwd() + '/', '');
            console.log(`📹 [Job ${job.id}] Video saved successfully: ${videoPath}`);

            // UX Enhancement: Generate thumbnail from final screenshot
            if (screenshots.length > 0) {
              try {
                const lastScreenshot = screenshots[screenshots.length - 1];
                const thumbnailFileName = `${testId}-${Date.now()}-thumb.png`;
                const thumbnailFilePath = join(process.cwd(), 'uploads', 'videos', thumbnailFileName);

                // Save base64 screenshot as thumbnail
                const base64Data = lastScreenshot.replace(/^data:image\/png;base64,/, '');
                await writeFile(thumbnailFilePath, base64Data, 'base64');
                videoThumbnail = thumbnailFilePath.replace(process.cwd() + '/', '');
                console.log(`🖼️  [Job ${job.id}] Thumbnail saved: ${videoThumbnail}`);
              } catch (thumbError) {
                console.warn(`⚠️  [Job ${job.id}] Thumbnail generation failed:`, thumbError.message);
                // Continue - thumbnail is optional
              }
            }
          } else {
            console.warn(`⚠️  [Job ${job.id}] Video file not found after browser close`);
          }
        } catch (videoError) {
          console.error(`❌ [Job ${job.id}] Video recording failed (non-blocking):`, videoError.message);
          // Test continues - video failure does NOT fail the test
        }

        await job.progress(90);

        // Update execution record with video paths
        const duration = Date.now() - execution.startedAt.getTime();
        const updatedExecution = await this.prisma.testExecution.update({
          where: { id: execution.id },
          data: {
            status: success ? 'passed' : 'failed',
            completedAt: new Date(),
            duration,
            errorMsg,
            results,
            screenshots,
            videoPath,
            videoThumbnail,
          },
        });

        // Send WebSocket event: Test completed or failed (generic events)
        if (success) {
          this.progressGateway.sendTestCompleted(execution.id, testId, test.name, duration);
          // LiveExecutionViewer event
          this.progressGateway.sendExecutionCompletedEvent(execution.id, 'passed', duration, results);
        } else {
          this.progressGateway.sendTestFailed(execution.id, testId, test.name, errorMsg || 'Unknown error');
          // LiveExecutionViewer event
          this.progressGateway.sendExecutionFailedEvent(execution.id, errorMsg || 'Unknown error', duration);
        }

        await job.progress(100);

        console.log(`✅ [Job ${job.id}] Test execution completed: ${success ? 'PASSED' : 'FAILED'}`);

        // Return execution ID for job result
        return {
          success,
          executionId: execution.id,
          testId,
          duration,
          status: updatedExecution.status,
        };
      }
    } catch (error) {
      console.error(`❌ [Job ${job.id}] Test execution failed:`, error);

      // Cleanup browser if still open
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});

      throw error; // Bull will retry the job
    }
  }

  /**
   * Wrapper method that retries failed steps
   */
  private async executeStepWithRetry(
    page: Page,
    step: TestStep,
    executionId: string,
    stepIndex: number,
    totalSteps: number,
    maxAttempts: number = 3
  ): Promise<any> {
    let lastError: Error | null = null;
    let lastErrorCategory: string = 'unknown';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔄 [Execution ${executionId}] Step "${step.description}" attempt ${attempt}/${maxAttempts}`);

        if (attempt > 1) {
          // If retrying, wait for network to stabilize
          await this.smartWaitService.waitForNetworkIdle(page, 2000);
        }

        const result = await this.executeStep(page, step);
        console.log(`✅ [Execution ${executionId}] Step succeeded on attempt ${attempt}`);
        return { ...result, attempts: attempt };
      } catch (error) {
        lastError = error;
        const { category, retryable } = this.categorizeStepError(error);
        lastErrorCategory = category;

        console.warn(`⚠️ [Execution ${executionId}] Step attempt ${attempt} failed (${category}): ${error.message}`);

        if (attempt < maxAttempts && retryable) {
          // Fixed backoff: 1s → 2s → 4s (base 1000ms)
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.log(`⏳ Waiting ${delay}ms before retry...`);

          // Send WebSocket retry event with error details
          this.progressGateway.sendStepRetry(
            executionId,
            stepIndex,
            totalSteps,
            step.description,
            attempt + 1,  // Next attempt number
            maxAttempts,
            error.message,
            category
          );

          await this.sleep(delay);
        } else {
          // No more retries or not retryable
          throw error;
        }
      }
    }

    throw lastError || new Error(`Step failed after ${maxAttempts} attempts (${lastErrorCategory})`);
  }

  /**
   * Categorize errors to determine retry strategy
   */
  private categorizeStepError(error: Error) {
    const message = error.message.toLowerCase();

    if (message.includes('not found') || message.includes('selector') || message.includes('locator')) {
      return {
        category: 'selector',
        retryable: true,
        suggestedDelay: 1000
      };
    }

    if (message.includes('timeout')) {
      return {
        category: 'timeout',
        retryable: true,
        suggestedDelay: 2000
      };
    }

    if (message.includes('network') || message.includes('connection') || message.includes('navigation')) {
      return {
        category: 'network',
        retryable: true,
        suggestedDelay: 3000
      };
    }

    // Elements obscured or intercepted
    if (message.includes('click intercepted') || message.includes('obscured')) {
      return {
        category: 'interaction',
        retryable: true,
        suggestedDelay: 1500
      };
    }

    // Unknown errors → don't retry by default unless we think they might be transient
    return {
      category: 'unknown',
      retryable: false,
      suggestedDelay: 0
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get reliable locator with fallback selector support
   * Uses smart wait priority: visible > stable > element (GEMINI requirement)
   */
  private async getReliableLocator(page: Page, step: TestStep) {
    const selectors = [
      step.selector,
      ...(step.fallbackSelectors || [])
    ].filter(Boolean);

    const timeout = step.timeout || 10000;
    const isInteractiveAction = ['click', 'hover', 'doubleclick', 'rightclick'].includes(step.type);

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      try {
        const locator = page.locator(selector);

        // PRIORITY 1: Wait for element to be visible (most reliable for interactions)
        try {
          await this.smartWaitService.waitForVisible(locator, i === 0 ? timeout / 2 : 3000);

          // PRIORITY 2: For interactive actions, wait for stability (prevent click intercepted errors)
          if (isInteractiveAction) {
            await this.smartWaitService.waitForStable(locator, 5000);
          }

          if (i === 0) {
            console.log(`✅ Primary selector works: ${selector}`);
          } else {
            console.log(`⚠️ Primary failed, using fallback #${i}: ${selector}`);
          }
          return locator.first();
        } catch (visibleError) {
          // Fallback: PRIORITY 3 - Element exists but not visible, try anyway
          await this.smartWaitService.waitForElement(locator, i === 0 ? timeout / 2 : 2000);
          const count = await locator.count();

          if (count > 0) {
            console.warn(`⚠️ Element found but not visible: ${selector}`);
            return locator.first();
          }
        }
      } catch (error) {
        console.warn(`❌ Selector ${i + 1}/${selectors.length} failed: ${selector} - ${error.message}`);
      }
    }

    throw new Error(
      `Element not found. Tried ${selectors.length} selector(s):\n` +
      selectors.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
    );
  }

  /**
   * Execute a single test step
   */
  private async executeStep(page: Page, step: TestStep) {
    const timeout = step.timeout || 10000;

    // For actions that require a locator
    const needsLocator = ['click', 'type', 'assert', 'hover', 'select', 'check', 'uncheck', 'scroll', 'doubleclick', 'rightclick', 'clear'].includes(step.type);
    let locator = null;
    if (needsLocator) {
      // getReliableLocator now handles smart wait priority (visible > stable > element)
      locator = await this.getReliableLocator(page, step);
    }

    switch (step.type) {
      case 'click':
        await locator.click({ timeout });
        return { success: true, action: 'click', selector: step.selector };

      case 'type':
        await locator.fill(step.value || '', { timeout });
        return { success: true, action: 'type', selector: step.selector, value: step.value };

      case 'wait':
        const waitTime = parseInt(step.value || '1000', 10);
        await page.waitForTimeout(waitTime);
        return { success: true, action: 'wait', value: waitTime };

      case 'assert':
        const textContent = await locator.textContent({ timeout });
        if (!textContent || !textContent.includes(step.value || '')) {
          throw new Error(`Assertion failed: Expected "${step.value}" but found "${textContent}"`);
        }
        return { success: true, action: 'assert', value: step.value, actual: textContent };

      case 'hover':
        await locator.hover({ timeout });
        return { success: true, action: 'hover', selector: step.selector };

      case 'select':
        await locator.selectOption(step.value || '', { timeout });
        return { success: true, action: 'select', selector: step.selector, value: step.value };

      case 'check':
        await locator.check({ timeout });
        return { success: true, action: 'check', selector: step.selector };

      case 'uncheck':
        await locator.uncheck({ timeout });
        return { success: true, action: 'uncheck', selector: step.selector };

      case 'navigate':
        const navigateUrl = normalizeUrlForDocker(step.value || '');
        await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout });
        await this.smartWaitService.waitForNetworkIdle(page, 2000).catch(() => {});
        return { success: true, action: 'navigate', url: navigateUrl };

      case 'scroll':
        await locator.scrollIntoViewIfNeeded({ timeout });
        return { success: true, action: 'scroll', selector: step.selector };

      case 'press':
        await page.keyboard.press(step.value || 'Enter');
        return { success: true, action: 'press', key: step.value };

      case 'screenshot':
        const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });
        const screenshotBase64 = screenshotBuffer.toString('base64');
        return { success: true, action: 'screenshot', screenshot: `data:image/png;base64,${screenshotBase64}` };

      case 'doubleclick':
        await locator.dblclick({ timeout });
        return { success: true, action: 'doubleclick', selector: step.selector };

      case 'rightclick':
        await locator.click({ button: 'right', timeout });
        return { success: true, action: 'rightclick', selector: step.selector };

      case 'clear':
        await locator.clear({ timeout });
        return { success: true, action: 'clear', selector: step.selector };

      case 'upload':
        await locator.setInputFiles(step.value || '', { timeout });
        return { success: true, action: 'upload', selector: step.selector, filePath: step.value };

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Capture page screenshot
   */
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
}