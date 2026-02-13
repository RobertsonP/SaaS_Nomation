import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as playwright from 'playwright';
import { LoginFlow } from '../ai/interfaces/element.interface';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import { normalizeUrlForDocker } from '../utils/docker-url.utils';
import { LinkDiscoveryService, DiscoveredLink } from './link-discovery.service';
import { MenuInteractionService } from './menu-interaction.service';
import { UrlNormalizationService } from './url-normalization.service';

interface CrawlResult {
  url: string;
  title: string;
  links: DiscoveredLink[];
  requiresAuth: boolean;
  pageType: string;
  screenshot?: string;      // Base64 JPEG thumbnail
  isAccessible: boolean;    // HTTP 200-299 response
}

@Injectable()
export class PageCrawlerService implements OnModuleInit {
  private readonly logger = new Logger(PageCrawlerService.name);
  private browser: playwright.Browser | null = null;
  private authenticatedContext: playwright.BrowserContext | null = null;
  private authStorageState: { cookies: playwright.Cookie[]; origins: { origin: string; localStorage: { name: string; value: string }[] }[] } | null = null;
  private authPage: playwright.Page | null = null;
  private authLoginUrl: string | null = null;

  constructor(
    private readonly unifiedAuthService: UnifiedAuthService,
    private readonly linkDiscoveryService: LinkDiscoveryService,
    private readonly menuInteractionService: MenuInteractionService,
    private readonly urlNormalizationService: UrlNormalizationService,
  ) {}

  /**
   * Wire up the circular dependency between LinkDiscoveryService and MenuInteractionService.
   * MenuInteractionService needs LinkDiscoveryService for getVisibleLinkUrls / extractNewlyRevealedLinks,
   * but LinkDiscoveryService injects MenuInteractionService. We break the cycle with a manual setter.
   */
  onModuleInit(): void {
    this.menuInteractionService.setLinkDiscoveryService(this.linkDiscoveryService);
  }

  /**
   * Translate localhost URLs to Docker-accessible addresses when running in Docker
   */
  private translateLocalhostForDocker(url: string): string {
    const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
    if (!isDocker) return url;
    return normalizeUrlForDocker(url);
  }

  /**
   * Check if URL is a local development address
   */
  private isLocalAddress(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === 'host.docker.internal' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) !== null
      );
    } catch {
      return false;
    }
  }

  /**
   * Initialize browser instance
   */
  async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await playwright.chromium.launch({
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });
      this.logger.log('Browser initialized for page crawling');
    }
  }

  /**
   * Clean up browser and authenticated context
   */
  async closeBrowser(): Promise<void> {
    // Close auth page first (session anchor)
    if (this.authPage) {
      try {
        await this.authPage.close();
      } catch (e) {
        // Page may already be closed
      }
      this.authPage = null;
    }

    // Close authenticated context
    if (this.authenticatedContext) {
      try {
        await this.authenticatedContext.close();
      } catch (e) {
        // Context may already be closed
      }
      this.authenticatedContext = null;
    }

    // Clear auth state
    this.authStorageState = null;
    this.authLoginUrl = null;

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Crawl a single page and extract links
   * Uses authenticated context if available from crawlWithDepth
   */
  async crawlPage(url: string, baseDomain: string, options?: { skipScreenshot?: boolean }): Promise<CrawlResult> {
    await this.initBrowser();

    // Translate localhost URLs for Docker environment
    url = this.translateLocalhostForDocker(url);

    // Check if this is a local address - ignore SSL errors for local development
    const isLocal = this.isLocalAddress(url);

    // Use authenticated context if available, otherwise create new context
    let context: playwright.BrowserContext;
    let shouldCloseContext = true;

    if (this.authenticatedContext) {
      // Reuse the authenticated context - cookies and session will be preserved
      context = this.authenticatedContext;
      shouldCloseContext = false; // Don't close shared authenticated context

      // Verify auth cookies are still present — restore from saved state if lost
      const cookies = await context.cookies();
      if (cookies.length === 0 && this.authStorageState) {
        this.logger.warn(`Auth cookies lost — restoring from saved storage state`);
        await context.addCookies(this.authStorageState.cookies);
      }

      this.logger.debug(`Using authenticated context for ${url} (${cookies.length} cookies)`);
    } else {
      // Create new unauthenticated context
      context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: isLocal,  // Allow self-signed certs for localhost
      });
    }

    const page = await context.newPage();
    let isAccessible = false;
    let screenshot: string | undefined;

    try {
      this.logger.log(`Crawling page: ${url}${isLocal ? ' (local)' : ''}`);

      // Navigate and track response status for verification
      // Local dev servers need more time to render (use networkidle with fallback)
      const response = await page.goto(url, {
        waitUntil: isLocal ? 'networkidle' : 'domcontentloaded',
        timeout: isLocal ? 20000 : 15000,
      }).catch(async (err) => {
        if (err.name === 'TimeoutError') {
          this.logger.warn(`Page load timeout for ${url}, retrying with 'domcontentloaded'`);
          return page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
        }
        throw err;
      });

      // Track if page is accessible (HTTP 200-299)
      isAccessible = response?.ok() ?? false;

      // Detect if we were redirected to the login page (auth didn't carry over)
      if (this.authenticatedContext) {
        const finalUrl = page.url();
        if (this.urlNormalizationService.isLoginRedirect(url, finalUrl, this.authLoginUrl)) {
          this.logger.warn(`Auth session lost — redirected to login: ${finalUrl} (requested: ${url})`);
          // Try re-applying cookies from saved state and retrying
          if (this.authStorageState) {
            await context.addCookies(this.authStorageState.cookies);
            const retryResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
            const retryFinalUrl = page.url();
            if (this.urlNormalizationService.isLoginRedirect(url, retryFinalUrl, this.authLoginUrl)) {
              this.logger.warn(`Auth retry also redirected to login — page requires re-authentication: ${retryFinalUrl}`);
            } else {
              this.logger.log(`Auth retry succeeded — loaded protected page: ${retryFinalUrl}`);
              isAccessible = retryResponse?.ok() ?? false;
            }
          }
        }
      }

      // Detect SPA framework and wait longer for hydration
      const isSPA = await page.evaluate(() => {
        return !!(
          (window as any).__NEXT_DATA__ ||
          document.querySelector('#__next') ||
          (window as any).__NUXT__ ||
          (window as any).__VUE__ ||
          document.querySelector('[data-reactroot]') ||
          document.querySelector('[ng-version]')
        );
      });

      // Conditional wait: only wait if page doesn't appear ready yet
      const isPageReady = await page.evaluate(() => {
        return document.readyState === 'complete' && document.querySelectorAll('a').length > 0;
      }).catch(() => false);

      if (!isPageReady) {
        // Local dev servers and SPAs need more time to hydrate
        await page.waitForTimeout(isLocal ? 3000 : (isSPA ? 2000 : 1000));
        if (isSPA) {
          try {
            await page.waitForLoadState('networkidle', { timeout: 3000 });
          } catch {
            // Network idle timeout is not critical, continue
          }
        }
      }

      // Capture screenshot thumbnail (viewport only, compressed JPEG)
      // Skip screenshots when caller indicates (e.g., after first 10 pages for speed)
      if (!options?.skipScreenshot) {
        try {
          const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 50,
            clip: { x: 0, y: 0, width: 1280, height: 720 },
            timeout: 5000,
          });
          screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
          this.logger.debug(`Screenshot captured for ${url} (${Math.round(screenshotBuffer.length / 1024)}KB)`);
        } catch (screenshotError) {
          this.logger.warn(`Failed to capture screenshot for ${url}: ${screenshotError.message}`);
        }
      }

      // Get page title with comprehensive fallback chain for dynamic sites
      let title = await page.title();

      // Check if title is usable (not empty, not "undefined", not just "Loading...")
      const isTitleValid = title &&
                           title.trim() !== '' &&
                           title !== 'undefined' &&
                           !title.toLowerCase().includes('loading');

      if (!isTitleValid) {
        // Fallback chain - try multiple sources
        title = await page.evaluate(() => {
          // 1. Try og:title (common on all sites)
          const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
          if (ogTitle && ogTitle.trim() && ogTitle !== 'undefined') return ogTitle.trim();

          // 2. Try twitter:title
          const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
          if (twitterTitle && twitterTitle.trim() && twitterTitle !== 'undefined') return twitterTitle.trim();

          // 3. Try document.title via JS (sometimes different from page.title())
          if (document.title && document.title.trim() && document.title !== 'undefined') {
            return document.title.trim();
          }

          // 4. Try first h1
          const h1 = document.querySelector('h1');
          if (h1 && h1.textContent?.trim() && h1.textContent !== 'undefined') {
            return h1.textContent.trim();
          }

          // 5. Try first h2 as fallback
          const h2 = document.querySelector('h2');
          if (h2 && h2.textContent?.trim() && h2.textContent !== 'undefined') {
            return h2.textContent.trim();
          }

          // 6. Try main content area heading
          const mainHeading = document.querySelector('main h1, article h1, [role="main"] h1');
          if (mainHeading && mainHeading.textContent?.trim()) {
            return mainHeading.textContent.trim();
          }

          return null;
        });

        // Final fallback: generate from URL
        if (!title || title === 'undefined' || title.trim() === '') {
          title = this.urlNormalizationService.generateTitleFromUrl(url);
        }
      }

      // Clean up the title - remove "undefined" parts and trim
      title = title.replace(/undefined/gi, '').trim();
      if (!title || title === '|' || title === '-') {
        title = this.urlNormalizationService.generateTitleFromUrl(url);
      }

      // Check if page requires authentication (look for login forms or redirects)
      const requiresAuth = await this.detectAuthRequirement(page);

      // Determine page type
      const pageType = await this.detectPageType(page);

      // Extract all links (delegates to LinkDiscoveryService)
      const links = await this.linkDiscoveryService.extractLinks(page, baseDomain);

      // Diagnostic: log link extraction results
      const internalLinks = links.filter(l => l.linkType !== 'external');
      const externalLinks = links.filter(l => l.linkType === 'external');
      this.logger.debug(`Links from ${url}: ${links.length} total (${internalLinks.length} internal, ${externalLinks.length} external)`);

      // Close the page (not the context if it's shared)
      await page.close();
      if (shouldCloseContext) {
        await context.close();
      }

      return {
        url,
        title,
        links,
        requiresAuth,
        pageType,
        screenshot,
        isAccessible,
      };
    } catch (error) {
      this.logger.error(`Failed to crawl ${url}: ${error.message}`);
      await page.close();
      if (shouldCloseContext) {
        await context.close();
      }
      throw error;
    }
  }

  /**
   * Detect if page requires authentication
   */
  private async detectAuthRequirement(page: playwright.Page): Promise<boolean> {
    // Check for common login form indicators
    const hasLoginForm = await page.evaluate(() => {
      // Standard CSS selectors only (no Playwright-specific selectors)
      const cssSelectors = [
        'input[type="password"]',
        'form[action*="login"]',
        'form[action*="signin"]',
        '[class*="login"]',
        '[id*="login"]',
        '[class*="signin"]',
        '[id*="signin"]',
      ];

      for (const selector of cssSelectors) {
        if (document.querySelector(selector)) return true;
      }

      // Check button text content manually (CSS can't select by text)
      const buttons = document.querySelectorAll('button, input[type="submit"], a[role="button"]');
      const loginKeywords = ['log in', 'login', 'sign in', 'signin', 'authenticate'];
      for (const button of buttons) {
        const text = (button.textContent || '').toLowerCase().trim();
        if (loginKeywords.some(keyword => text.includes(keyword))) return true;
      }

      // Check page title/URL for auth indicators
      const title = document.title.toLowerCase();
      const url = window.location.href.toLowerCase();
      const authKeywords = ['login', 'signin', 'sign-in', 'authenticate', 'auth'];
      for (const keyword of authKeywords) {
        if (title.includes(keyword) || url.includes(keyword)) return true;
      }

      return false;
    });

    return hasLoginForm;
  }

  /**
   * Detect the type of page
   */
  private async detectPageType(page: playwright.Page): Promise<string> {
    return await page.evaluate(() => {
      const url = window.location.pathname.toLowerCase();
      const title = document.title.toLowerCase();

      // Check URL patterns
      if (url === '/' || url === '/home' || url === '/index') return 'home';
      if (url.includes('/product') || url.includes('/item')) return 'product';
      if (url.includes('/categor') || url.includes('/collection')) return 'category';
      if (url.includes('/cart') || url.includes('/basket')) return 'cart';
      if (url.includes('/checkout')) return 'checkout';
      if (url.includes('/account') || url.includes('/profile') || url.includes('/dashboard')) return 'account';
      if (url.includes('/contact')) return 'contact';
      if (url.includes('/about')) return 'about';
      if (url.includes('/blog') || url.includes('/article') || url.includes('/post')) return 'content';
      if (url.includes('/faq') || url.includes('/help')) return 'help';
      if (url.includes('/search')) return 'search';

      // Check for forms
      const forms = document.querySelectorAll('form');
      if (forms.length > 0) return 'form';

      return 'content';
    });
  }

  /**
   * Crawl multiple pages with depth limit
   */
  async crawlWithDepth(
    startUrl: string,
    maxDepth: number = 3,
    maxPages: number = 100,
    authFlow?: LoginFlow,
    onProgress?: (crawled: number, total: number, currentUrl: string) => void,
  ): Promise<Map<string, CrawlResult>> {
    const results = new Map<string, CrawlResult>();
    const visited = new Set<string>();
    const failedPages: Array<{ url: string; error: string }> = [];
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

    const baseDomain = new URL(startUrl).hostname;
    const isAuthenticated = !!authFlow;

    this.logger.log(`Starting crawl of ${startUrl} (max depth: ${maxDepth}, max pages: ${maxPages}, authenticated: ${isAuthenticated}, baseDomain: ${baseDomain})`);

    await this.initBrowser();

    // If auth flow provided, authenticate once and reuse the context
    if (authFlow && this.browser) {
      this.logger.log(`Authenticating before crawling using auth flow: ${authFlow.name}`);
      try {
        const authResult = await this.unifiedAuthService.authenticateForUrl(
          startUrl,
          authFlow,
          this.browser,
          { forceAuthenticate: true },
        );

        if (authResult.result.authenticated) {
          this.logger.log(`Authentication successful, will use authenticated context for crawling`);
          // Store the authenticated context for reuse
          this.authenticatedContext = authResult.page.context();

          // Capture full storage state (cookies + localStorage) for recovery
          try {
            this.authStorageState = await this.authenticatedContext.storageState();
            this.logger.log(`Saved auth storage state: ${this.authStorageState.cookies.length} cookies`);
          } catch (stateErr) {
            this.logger.warn(`Could not capture auth storage state: ${stateErr.message}`);
          }

          // Keep the original auth page alive as a session anchor
          this.authPage = authResult.page;
          // Store the login URL to detect redirects back to login
          this.authLoginUrl = authFlow.loginUrl;

          // If post-login URL differs from startUrl, add it to crawl queue
          const postLoginUrl = authResult.result.finalUrl;
          if (postLoginUrl && postLoginUrl !== startUrl) {
            const normalizedPostLogin = this.urlNormalizationService.normalizeUrl(postLoginUrl);
            const normalizedStart = this.urlNormalizationService.normalizeUrl(startUrl);
            if (normalizedPostLogin !== normalizedStart) {
              this.logger.log(`Adding post-login URL to crawl queue: ${postLoginUrl}`);
              queue.push({ url: postLoginUrl, depth: 0 });
            }
          }
        } else {
          this.logger.error(`Authentication failed: ${authResult.result.errorMessage}`);
          await authResult.page.close();
          throw new Error(`Authentication failed: ${authResult.result.errorMessage || 'Could not log in with the configured auth flow'}. Please check your auth flow credentials and selectors.`);
        }
      } catch (authError) {
        // Re-throw auth errors — don't silently continue without auth
        if (authError.message?.startsWith('Authentication failed:')) {
          throw authError;
        }
        this.logger.error(`Authentication error: ${authError.message}`);
        throw new Error(`Authentication error: ${authError.message}. Please check your auth flow configuration.`);
      }
    }

    try {
      while (queue.length > 0 && results.size < maxPages) {
        const { url, depth } = queue.shift()!;

        // Normalize URL
        const normalizedUrl = this.urlNormalizationService.normalizeUrl(url);
        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        try {
          const result = await this.crawlPage(normalizedUrl, baseDomain, {
            skipScreenshot: results.size >= 10,
          });
          results.set(normalizedUrl, result);

          this.logger.log(`Crawled ${results.size}/${maxPages}: ${normalizedUrl} (${result.links.length} links found)`);

          // Emit progress callback so caller can update UI in real time
          if (onProgress) {
            onProgress(results.size, Math.max(maxPages, queue.length + results.size), normalizedUrl);
          }

          // Add discovered links to queue if within depth limit
          if (depth < maxDepth) {
            let queued = 0;
            let skippedExternal = 0;
            let skippedNonPage = 0;
            let skippedVisited = 0;
            let skippedDepth = 0;

            for (const link of result.links) {
              // Task 1.4: Filter non-HTML URLs and external links
              if (link.linkType === 'external') {
                skippedExternal++;
                continue;
              }
              if (!this.urlNormalizationService.isPageUrl(link.url)) {
                skippedNonPage++;
                continue;
              }
              const linkNormalized = this.urlNormalizationService.normalizeUrl(link.url);
              if (visited.has(linkNormalized)) {
                skippedVisited++;
                continue;
              }
              // Track menu level properly - submenu items add extra depth
              const linkDepth = depth + 1 + (link.menuLevel || 0);
              if (linkDepth > maxDepth) {
                skippedDepth++;
                continue;
              }
              queue.push({ url: link.url, depth: linkDepth });
              queued++;
            }

            this.logger.debug(`Queue update from ${normalizedUrl}: +${queued} queued, skipped: ${skippedExternal} external, ${skippedNonPage} non-page, ${skippedVisited} visited, ${skippedDepth} too deep`);
          }
        } catch (error) {
          const errorMsg = error.message || 'Unknown error';
          this.logger.warn(`Failed to crawl ${normalizedUrl}: ${errorMsg}`);
          failedPages.push({ url: normalizedUrl, error: errorMsg });
        }
      }
    } finally {
      await this.closeBrowser();
    }

    // Log summary
    this.logger.log(`Crawl complete: ${results.size} pages crawled, ${failedPages.length} failed`);

    // If no pages were successfully crawled, throw helpful error
    if (results.size === 0 && failedPages.length > 0) {
      const firstError = failedPages[0];
      throw new Error(
        `Could not crawl any pages from ${startUrl}. ` +
        `First error: ${firstError.error}. ` +
        `This may be caused by: bot protection, slow loading, or network issues.`
      );
    }

    return results;
  }
}
