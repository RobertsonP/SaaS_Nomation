import { Injectable } from '@nestjs/common';
import { Page, Locator } from 'playwright';

@Injectable()
export class SmartWaitService {
  /**
   * Waits for an element to be attached to the DOM.
   */
  async waitForElement(locator: Locator, timeout: number): Promise<void> {
    await locator.waitFor({ state: 'attached', timeout });
  }

  /**
   * Waits for an element to appear and be visible.
   */
  async waitForVisible(locator: Locator, timeout: number): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Waits for a navigation to complete.
   */
  async waitForNavigation(
    page: Page,
    timeout: number,
  ): Promise<void> {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout });
  }

  /**
   * Waits for network activity to cease.
   */
  async waitForNetworkIdle(page: Page, timeout: number): Promise<void> {
    try {
      await page.waitForLoadState('networkidle', { timeout });
    } catch (error) {
      console.warn(`⚠️ Network idle wait timed out after ${timeout}ms, continuing anyway.`);
    }
  }

  /**
   * Waits for an element's position and size to be stable for a period.
   * Useful for animations or elements that shift on load.
   *
   * IMPORTANT: Has a hard safety limit (5s) separate from step timeout to prevent
   * consuming the entire test execution time waiting for animations.
   */
  async waitForStable(locator: Locator, timeout: number): Promise<void> {
    // Hard safety limit: max 5 seconds for stability check (separate from step timeout)
    const STABILITY_SAFETY_LIMIT = 5000;
    const effectiveTimeout = Math.min(timeout, STABILITY_SAFETY_LIMIT);

    try {
      // Wait for visibility first (max 3s)
      await locator.waitFor({ state: 'visible', timeout: Math.min(effectiveTimeout, 3000) });
    } catch (e) {
      // If it doesn't even become visible, we can't wait for it to be stable
      console.warn(`⚠️ Element not visible within timeout, skipping stability check`);
      return;
    }

    let previousBoundingBox = await locator.boundingBox();
    let stableTime = 0;
    const stableDuration = 300; // ms - element must be stable for 300ms
    const checkInterval = 100; // ms - check every 100ms
    const startTime = Date.now();

    while (Date.now() - startTime < effectiveTimeout) {
      await locator.page().waitForTimeout(checkInterval);
      const currentBoundingBox = await locator.boundingBox();

      if (
        currentBoundingBox &&
        previousBoundingBox &&
        Math.abs(currentBoundingBox.x - previousBoundingBox.x) < 1 &&
        Math.abs(currentBoundingBox.y - previousBoundingBox.y) < 1 &&
        Math.abs(currentBoundingBox.width - previousBoundingBox.width) < 1 &&
        Math.abs(currentBoundingBox.height - previousBoundingBox.height) < 1
      ) {
        stableTime += checkInterval;
        if (stableTime >= stableDuration) {
          console.log(`✅ Element stable after ${Date.now() - startTime}ms`);
          return;
        }
      } else {
        stableTime = 0;
      }

      previousBoundingBox = currentBoundingBox;

      if (!currentBoundingBox) {
        stableTime = 0;
      }
    }

    console.warn(`⚠️ Element did not stabilize within ${effectiveTimeout}ms, continuing anyway`);
  }
}