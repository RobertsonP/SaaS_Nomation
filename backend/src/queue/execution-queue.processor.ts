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
import { StepExecutorService } from '../execution/step-executor.service';
import { normalizeUrlForDocker } from '../utils/docker-url.utils';

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

@Processor('test-execution')
export class ExecutionQueueProcessor {
  constructor(
    private prisma: PrismaService,
    private authFlowsService: AuthFlowsService,
    private unifiedAuthService: UnifiedAuthService,
    private progressGateway: ExecutionProgressGateway,
    private smartWaitService: SmartWaitService,
    private stepExecutor: StepExecutorService,
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
          await this.smartWaitService.waitForNetworkIdle(page, 2000).catch(() => {});
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
   * Execute a single test step — delegates to shared StepExecutorService.
   */
  private async executeStep(page: Page, step: TestStep) {
    return this.stepExecutor.executeStep(page, step);
  }

  /**
   * Capture page screenshot
   */
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
}