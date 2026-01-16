/**
 * Playwright-related type definitions
 * These types wrap Playwright's native types for use across the application
 */
import { Page, Browser, BrowserContext, ElementHandle, Locator } from 'playwright';

// Re-export Playwright types for convenience
export { Page, Browser, BrowserContext, ElementHandle, Locator };

/**
 * Browser launch options
 */
export interface BrowserLaunchOptions {
  headless?: boolean;
  args?: string[];
  timeout?: number;
  slowMo?: number;
}

/**
 * Navigation options for page.goto()
 */
export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  type?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
  path?: string;
}

/**
 * Element click options
 */
export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
  timeout?: number;
  force?: boolean;
}

/**
 * Element fill options
 */
export interface FillOptions {
  timeout?: number;
  force?: boolean;
}

/**
 * Wait for selector options
 */
export interface WaitForSelectorOptions {
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  timeout?: number;
}

/**
 * Page viewport size
 */
export interface ViewportSize {
  width: number;
  height: number;
}
