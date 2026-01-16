import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SimplifiedAuthService } from '../auth-flows/simplified-auth.service';
import { AuthFlowsService } from '../auth-flows/auth-flows.service';

interface TestStep {
  type: string;
  selector: string;
  value?: string;
  description?: string;
}

export interface LiveExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
  step: TestStep;
  beforeScreenshot?: string;
  screenshot: string | null;
  tempExecutionId: string;
  executedAt: string;
}

@Injectable()
export class LiveExecutionService {
  constructor(
    private prisma: PrismaService,
    private simplifiedAuthService: SimplifiedAuthService,
    private authFlowsService: AuthFlowsService,
  ) {}

  async verifyUrl(organizationId: string, urlId: string) {
    const projectUrl = await this.prisma.projectUrl.findUnique({
      where: { id: urlId },
      include: { project: true }
    });

    if (!projectUrl) {
      throw new Error('URL not found');
    }

    if (projectUrl.project.organizationId !== organizationId) {
      throw new Error('Not authorized to verify this URL');
    }

    try {
      const { chromium } = await import('playwright');

      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      const response = await page.goto(projectUrl.url, {
        timeout: 10000,
        waitUntil: 'domcontentloaded'
      });

      const statusCode = response?.status();
      await browser.close();

      if (statusCode && statusCode >= 200 && statusCode < 400) {
        await this.prisma.projectUrl.update({
          where: { id: urlId },
          data: {
            verified: true,
            lastVerified: new Date()
          }
        });

        return {
          accessible: true,
          url: projectUrl.url,
          message: 'URL is accessible and ready for testing',
          statusCode
        };
      } else {
        return {
          accessible: false,
          url: projectUrl.url,
          message: `URL returned status ${statusCode}`,
          statusCode
        };
      }
    } catch (error) {
      return {
        accessible: false,
        url: projectUrl.url,
        message: error.message || 'Could not connect to URL'
      };
    }
  }

  async testProjectAuthFlow(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const authFlows = await this.authFlowsService.getByProject(projectId);
    if (authFlows.length === 0) {
      throw new Error('No authentication flows configured for this project');
    }

    const authFlow = authFlows[0];

    return this.simplifiedAuthService.testAuthFlow(
      authFlow.loginUrl,
      authFlow.credentials as { username: string; password: string },
      authFlow.steps as unknown as TestStep[]
    );
  }

  async liveExecuteStep(
    organizationId: string,
    projectId: string,
    data: { step: TestStep; startingUrl: string; tempExecutionId: string }
  ): Promise<LiveExecutionResult> {
    const { chromium } = await import('playwright');

    console.log(`🔴 Live executing step: ${data.step.description} on ${data.startingUrl}`);

    let browser = null;
    let page = null;

    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      page = await browser.newPage();

      await page.setViewportSize({ width: 1920, height: 1080 });

      console.log(`🚀 Browser session launched successfully with Docker-compatible settings`);

      const isFirstStep = data.tempExecutionId.endsWith('-0');
      if (isFirstStep) {
        console.log(`🌍 Navigating to starting URL: ${data.startingUrl}`);
        await page.goto(data.startingUrl, { waitUntil: 'networkidle' });
        console.log(`🔗 Navigated to: ${data.startingUrl}`);
        await page.waitForTimeout(1000);
      } else {
        console.log(`↪️ Continuing from current page (step ${data.tempExecutionId})`);
      }

      const beforeScreenshot = await page.screenshot({
        type: 'png',
        fullPage: false
      });

      const step = data.step;
      const timeout = 10000;

      console.log(`⚡ Executing step: ${step.type} on ${step.selector}`);

      switch (step.type) {
        case 'click':
        case 'doubleclick':
        case 'rightclick':
          if (step.type === 'doubleclick') {
            await page.dblclick(step.selector, { timeout });
          } else if (step.type === 'rightclick') {
            await page.click(step.selector, { button: 'right', timeout });
          } else {
            await page.click(step.selector, { timeout });
          }
          break;

        case 'hover':
          await page.hover(step.selector, { timeout });
          break;

        case 'type':
          await page.fill(step.selector, step.value || '', { timeout });
          break;

        case 'clear':
          await page.fill(step.selector, '', { timeout });
          break;

        case 'select':
          await page.selectOption(step.selector, step.value || '', { timeout });
          break;

        case 'check':
          await page.check(step.selector, { timeout });
          break;

        case 'uncheck':
          await page.uncheck(step.selector, { timeout });
          break;

        case 'upload':
          console.log(`⚠️ Upload simulation - would upload file: ${step.value}`);
          break;

        case 'scroll':
          if (step.value) {
            const scrollAmount = parseInt(step.value, 10);
            await page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
          } else {
            await page.evaluate((selector) => {
              const element = document.querySelector(selector);
              if (element) element.scrollIntoView();
            }, step.selector);
          }
          break;

        case 'press':
          await page.keyboard.press(step.value || 'Enter');
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

      await page.waitForTimeout(500);

      console.log(`✅ Step completed: ${step.type} on ${step.selector}`);

      const afterScreenshot = await page.screenshot({
        type: 'png',
        fullPage: false
      });

      console.log(`✅ Live step execution completed successfully`);

      return {
        success: true,
        result: `Step "${step.description}" executed successfully`,
        step: step,
        beforeScreenshot: beforeScreenshot.toString('base64'),
        screenshot: afterScreenshot.toString('base64'),
        tempExecutionId: data.tempExecutionId,
        executedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Live step execution failed:`, error);
      console.error(`❌ Step failed: ${data.step.type} on ${data.step.selector} - ${error.message}`);

      let errorScreenshot = null;
      try {
        if (page) {
          errorScreenshot = await page.screenshot({ type: 'png', fullPage: false });
        }
      } catch (screenshotError) {
        console.warn('Could not capture error screenshot:', screenshotError);
      }

      return {
        success: false,
        error: error.message,
        step: data.step,
        screenshot: errorScreenshot ? errorScreenshot.toString('base64') : null,
        tempExecutionId: data.tempExecutionId,
        executedAt: new Date().toISOString()
      };

    } finally {
      console.log(`🧹 Browser session cleanup complete`);

      if (page) await page.close();
      if (browser) await browser.close();
    }
  }
}
