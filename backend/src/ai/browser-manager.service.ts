import { Injectable } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';

@Injectable()
export class BrowserManagerService {
  /**
   * Check if a URL is a local address (localhost, 127.0.0.1, etc.)
   */
  isLocalAddress(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.localhost') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.2') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')
      );
    } catch {
      return false;
    }
  }

  /** Common stealth launch args to avoid WAF/bot detection */
  private get stealthArgs(): string[] {
    return [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-images',
      '--disable-javascript-harmony-shipping',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-blink-features=AutomationControlled',
    ];
  }

  /** Apply stealth overrides to a browser context (webdriver flag, etc.) */
  private async applyStealthToContext(context: import('playwright').BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
  }

  async setupBrowser(): Promise<Browser> {
    console.log('🚀 Setting up browser with stealth configuration...');

    const browser = await chromium.launch({
      headless: true,
      args: this.stealthArgs,
    });

    console.log('✅ Browser setup complete');
    return browser;
  }

  async navigateToPage(page: Page, url: string, options?: { fastMode?: boolean }): Promise<{ statusCode?: number }> {
    const fastMode = options?.fastMode ?? false;
    console.log(`🌐 Navigating to ${url} with ${fastMode ? 'FAST' : 'enhanced'} loading strategy...`);
    let response: import('playwright').Response | null = null;

    try {
      // Strategy 1: Try networkidle first (fast sites)
      console.log(`📡 Attempting fast load strategy (networkidle, ${fastMode ? '5s' : '15s'} timeout)...`);
      response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: fastMode ? 5000 : 15000
      });
      console.log(`✅ Fast load successful for ${url}`);

    } catch (error) {
      console.log(`⚠️ Fast load failed: ${error.message}`);
      console.log(`🔄 Trying progressive load strategy (domcontentloaded + load + manual waits)...`);

      try {
        // Strategy 2: Progressive loading for slow sites
        response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });
        console.log(`📄 DOM loaded for ${url}`);

        // Wait for basic page load event
        try {
          await page.waitForLoadState('load', { timeout: 15000 });
          console.log(`🔗 Load event completed for ${url}`);
        } catch (loadError) {
          console.log(`⚠️ Load event timeout - proceeding anyway: ${loadError.message}`);
        }

        // Wait for document ready state
        await page.evaluate(() => {
          return new Promise((resolve) => {
            if (document.readyState === 'complete') {
              resolve(true);
            } else {
              const checkReady = () => {
                if (document.readyState === 'complete') {
                  resolve(true);
                } else {
                  setTimeout(checkReady, 100);
                }
              };
              checkReady();
            }
          });
        });
        console.log(`📋 Document ready state complete for ${url}`);

        console.log(`✅ Progressive load successful for ${url}`);

      } catch (progressiveError) {
        console.log(`⚠️ Progressive load also failed: ${progressiveError.message}`);
        console.log(`🚀 Trying minimal load strategy (domcontentloaded only)...`);

        // Strategy 3: Minimal loading for problematic sites
        response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        console.log(`⚡ Minimal load completed for ${url}`);
      }
    }

    // Progressive waits for dynamic content (skip in fast mode)
    if (!fastMode) {
      await this.waitForDynamicContent(page, url);
    } else {
      console.log(`⚡ Fast mode - skipping dynamic content waits`);
    }

    // Check HTTP status — reject 4xx/5xx error pages
    const statusCode = response?.status();
    if (statusCode && statusCode >= 400) {
      const statusText = statusCode === 403 ? 'Forbidden' : statusCode === 404 ? 'Not Found' : `Error ${statusCode}`;
      throw new Error(`HTTP_ERROR: Site returned ${statusCode} ${statusText} — may be blocking automated browsers`);
    }

    return { statusCode };
  }

  private async waitForDynamicContent(page: Page, url: string): Promise<void> {
    console.log(`⏳ Waiting for dynamic content to load...`);

    // Stage 1: Basic content stabilization
    await page.waitForTimeout(2000);

    // Stage 2: Check for common loading indicators
    try {
      await page.waitForFunction(() => {
        const loadingSelectors = [
          '.loading', '.loader', '.spinner', '.preloader',
          '[data-loading]', '[data-testid="loading"]',
          '.fa-spinner', '.fa-circle-o-notch'
        ];

        for (const selector of loadingSelectors) {
          const element = document.querySelector(selector);
          if (element && window.getComputedStyle(element).display !== 'none') {
            return false;
          }
        }
        return true;
      }, {}, { timeout: 5000 });
      console.log(`🎯 Loading indicators cleared for ${url}`);
    } catch (indicatorError) {
      console.log(`⏰ Loading indicator wait timeout - proceeding: ${indicatorError.message}`);
    }

    // Stage 3: Wait for images to load
    try {
      await page.waitForFunction(() => {
        const images = document.querySelectorAll('img');
        return Array.from(images).every(img => img.complete || img.naturalWidth > 0);
      }, {}, { timeout: 3000 });
      console.log(`🖼️ Images loaded for ${url}`);
    } catch (imageError) {
      console.log(`📷 Image load timeout - proceeding: ${imageError.message}`);
    }

    // Stage 4: Final stabilization wait
    await page.waitForTimeout(1000);

    console.log(`🏁 Navigation and content loading complete for ${url}`);
  }

  async closeBrowser(browser: Browser): Promise<void> {
    await browser.close();
  }

  async createPage(browser: Browser): Promise<Page> {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });
    await this.applyStealthToContext(context);
    return context.newPage();
  }

  /**
   * Create a page with SSL error handling for localhost URLs.
   * Optionally accepts storageState to create an authenticated context
   * (preserving cookies/localStorage from a prior auth session).
   */
  async createPageForUrl(browser: Browser, url: string, options?: { storageState?: any }): Promise<Page> {
    const isLocal = this.isLocalAddress(url);

    const contextOptions: any = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    };

    if (isLocal) {
      console.log(`🏠 Localhost detected for ${url} - enabling SSL bypass`);
      contextOptions.ignoreHTTPSErrors = true;
    }
    if (options?.storageState) {
      console.log(`🔐 Creating authenticated browser context with storageState`);
      contextOptions.storageState = options.storageState;
    }

    const context = await browser.newContext(contextOptions);
    await this.applyStealthToContext(context);
    return context.newPage();
  }
}
