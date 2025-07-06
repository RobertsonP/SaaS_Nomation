import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chromium, Browser, Page } from 'playwright';

interface TestStep {
  id: string;
  type: 'click' | 'type' | 'wait' | 'assert';
  selector: string;
  value?: string;
  description: string;
}

@Injectable()
export class ExecutionService {
  constructor(private prisma: PrismaService) {}

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

        // Navigate to test starting URL
        await page.goto(test.startingUrl);
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

    switch (step.type) {
      case 'click':
        await page.click(step.selector, { timeout });
        break;

      case 'type':
        await page.fill(step.selector, step.value || '', { timeout });
        break;

      case 'wait':
        const waitTime = parseInt(step.value || '1000', 10);
        await page.waitForTimeout(waitTime);
        break;

      case 'assert':
        const element = await page.locator(step.selector).first();
        const textContent = await element.textContent();
        if (!textContent || !textContent.includes(step.value || '')) {
          throw new Error(
            `Assertion failed: Expected "${step.value}" but found "${textContent}"`
          );
        }
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    // Wait a bit between steps for stability
    await page.waitForTimeout(500);
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