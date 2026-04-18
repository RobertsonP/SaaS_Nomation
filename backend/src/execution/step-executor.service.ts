import { Injectable } from '@nestjs/common';
import { Page, Locator } from 'playwright';
import { SmartWaitService } from './smart-wait.service';
import { normalizeUrlForDocker } from '../utils/docker-url.utils';

export interface StepConfig {
  id?: string;
  type: string;
  selector?: string;
  value?: string;
  description?: string;
  fallbackSelectors?: string[];
  timeout?: number;
}

@Injectable()
export class StepExecutorService {
  constructor(private smartWaitService: SmartWaitService) {}

  /**
   * Check whether a step type requires a DOM locator.
   */
  needsLocator(stepType: string): boolean {
    return [
      'click', 'type', 'assert', 'hover', 'select', 'check', 'uncheck',
      'scroll', 'doubleclick', 'rightclick', 'clear', 'upload',
    ].includes(stepType);
  }

  /**
   * Resolve a selector string into a Playwright Locator.
   * Supports CSS/XPath selectors and Playwright-native locator strings:
   *   getByRole('button', { name: 'Submit' }), getByText('Hello'), etc.
   */
  resolveLocator(page: Page, selector: string): Locator {
    const nativeMatch = selector.match(
      /^(getByRole|getByText|getByLabel|getByTestId|getByPlaceholder|getByTitle)\(/,
    );
    if (!nativeMatch) {
      return page.locator(selector);
    }

    const method = nativeMatch[1];
    const firstArgMatch = selector.match(/\(\s*['"]([^'"]*)['"]/);
    if (!firstArgMatch) {
      return page.locator(selector);
    }
    const firstArg = firstArgMatch[1];

    const optionsMatch = selector.match(/,\s*\{([^}]+)\}/);
    const options: Record<string, unknown> = {};
    if (optionsMatch) {
      const optStr = optionsMatch[1];
      const nameMatch = optStr.match(/name:\s*['"]([^'"]*)['"]/);
      if (nameMatch) options.name = nameMatch[1];
      const exactMatch = optStr.match(/exact:\s*(true|false)/);
      if (exactMatch) options.exact = exactMatch[1] === 'true';
    }

    switch (method) {
      case 'getByRole':
        return page.getByRole(firstArg as any, options as any);
      case 'getByText':
        return page.getByText(firstArg, options as any);
      case 'getByLabel':
        return page.getByLabel(firstArg, options as any);
      case 'getByTestId':
        return page.getByTestId(firstArg);
      case 'getByPlaceholder':
        return page.getByPlaceholder(firstArg, options as any);
      case 'getByTitle':
        return page.getByTitle(firstArg, options as any);
      default:
        return page.locator(selector);
    }
  }

  /**
   * Get reliable locator with fallback selector support.
   * Uses SmartWait priority: visible → stable → element (best from queue processor),
   * combined with fallback selector loop (best from direct executor).
   */
  async getReliableLocator(page: Page, step: StepConfig): Promise<Locator> {
    const selectors = [
      step.selector,
      ...(step.fallbackSelectors || []),
    ].filter(Boolean);

    const timeout = step.timeout || 10000;
    const isInteractiveAction = ['click', 'hover', 'doubleclick', 'rightclick'].includes(step.type);

    console.log(`🎯 Attempting ${selectors.length} selector(s) for "${step.description || step.type}"`);

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i]!;
      try {
        const locator = this.resolveLocator(page, selector);

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
        } catch {
          // Fallback: PRIORITY 3 — Element exists but not visible, try anyway
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
      selectors.map((s, i) => `  ${i + 1}. ${s}`).join('\n') +
      `\n\nHint: Element may have changed or not be visible on this page.`,
    );
  }

  /**
   * Execute a single test step.
   * Unified switch statement covering all 16 action types with 500ms inter-step wait.
   */
  async executeStep(page: Page, step: StepConfig): Promise<any> {
    const timeout = step.timeout || 10000;

    console.log(`[DEBUG] Executing step: ${step.type} - ${step.description}`);

    try {
      // Only resolve locator for step types that need an element
      const locator = this.needsLocator(step.type)
        ? await this.getReliableLocator(page, step)
        : null;

      let result: any;

      switch (step.type) {
        case 'click':
          await locator!.click({ timeout });
          console.log(`✓ Clicked element: ${step.selector}`);
          result = { success: true, action: 'click', selector: step.selector };
          break;

        case 'type':
          await locator!.fill(step.value || '', { timeout });
          console.log(`✓ Filled element: ${step.selector} with "${step.value}"`);
          result = { success: true, action: 'type', selector: step.selector, value: step.value };
          break;

        case 'wait': {
          const rawWaitTime = parseInt(step.value || '1000', 10);
          if (isNaN(rawWaitTime) || rawWaitTime < 0) {
            throw new Error(`Invalid wait time: ${step.value}. Must be a positive number.`);
          }
          const waitTime = Math.min(rawWaitTime, 60000);
          if (rawWaitTime > 60000) {
            console.warn(`⚠️ Wait time ${rawWaitTime}ms exceeded max, capped to 60000ms`);
          }
          await page.waitForTimeout(waitTime);
          console.log(`✓ Waited for ${waitTime}ms`);
          result = { success: true, action: 'wait', value: waitTime };
          break;
        }

        case 'assert': {
          const textContent = await locator!.textContent({ timeout });
          if (!textContent || !textContent.includes(step.value || '')) {
            throw new Error(
              `Assertion failed: Expected "${step.value}" but found "${textContent}"`,
            );
          }
          console.log(`✓ Assertion passed: "${step.value}" found in "${textContent}"`);
          result = { success: true, action: 'assert', value: step.value, actual: textContent };
          break;
        }

        case 'hover':
          await locator!.hover({ timeout });
          console.log(`✓ Hovered over: ${step.selector}`);
          result = { success: true, action: 'hover', selector: step.selector };
          break;

        case 'select':
          await locator!.selectOption(step.value || '', { timeout });
          console.log(`✓ Selected option "${step.value}" in: ${step.selector}`);
          result = { success: true, action: 'select', selector: step.selector, value: step.value };
          break;

        case 'check':
          await locator!.check({ timeout });
          console.log(`✓ Checked: ${step.selector}`);
          result = { success: true, action: 'check', selector: step.selector };
          break;

        case 'uncheck':
          await locator!.uncheck({ timeout });
          console.log(`✓ Unchecked: ${step.selector}`);
          result = { success: true, action: 'uncheck', selector: step.selector };
          break;

        case 'navigate': {
          const navigateUrl = normalizeUrlForDocker(step.value || '');
          await page.goto(navigateUrl, {
            waitUntil: 'domcontentloaded',
            timeout,
          });
          await this.smartWaitService.waitForNetworkIdle(page, 2000).catch(() => {});
          console.log(`✓ Navigated to: ${navigateUrl}`);
          result = { success: true, action: 'navigate', url: navigateUrl };
          break;
        }

        case 'scroll':
          await locator!.scrollIntoViewIfNeeded({ timeout });
          console.log(`✓ Scrolled to: ${step.selector}`);
          result = { success: true, action: 'scroll', selector: step.selector };
          break;

        case 'press':
          await page.keyboard.press(step.value || 'Enter');
          console.log(`✓ Pressed key: ${step.value}`);
          result = { success: true, action: 'press', key: step.value };
          break;

        case 'screenshot': {
          const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 70,
            fullPage: false,
            timeout: 5000,
          });
          const screenshotBase64 = screenshotBuffer.toString('base64');
          console.log(`✓ Captured screenshot`);
          result = { success: true, action: 'screenshot', screenshot: `data:image/jpeg;base64,${screenshotBase64}` };
          break;
        }

        case 'doubleclick':
          await locator!.dblclick({ timeout });
          console.log(`✓ Double-clicked: ${step.selector}`);
          result = { success: true, action: 'doubleclick', selector: step.selector };
          break;

        case 'rightclick':
          await locator!.click({ button: 'right', timeout });
          console.log(`✓ Right-clicked: ${step.selector}`);
          result = { success: true, action: 'rightclick', selector: step.selector };
          break;

        case 'clear':
          await locator!.clear({ timeout });
          console.log(`✓ Cleared: ${step.selector}`);
          result = { success: true, action: 'clear', selector: step.selector };
          break;

        case 'upload':
          await locator!.setInputFiles(step.value || '', { timeout });
          console.log(`✓ Uploaded file to: ${step.selector}`);
          result = { success: true, action: 'upload', selector: step.selector, filePath: step.value };
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      // Wait between steps for stability
      await page.waitForTimeout(500);

      return result;
    } catch (error) {
      console.error(`✗ Step execution failed:`, {
        type: step.type,
        selector: step.selector,
        value: step.value,
        error: error.message,
      });

      if (error.message.includes('selector') || error.message.includes('locator')) {
        throw new Error(
          `Invalid selector "${step.selector}": ${error.message}\n` +
          `Hint: Ensure the selector is valid CSS or Playwright syntax.`,
        );
      }

      throw error;
    }
  }
}
