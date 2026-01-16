import { Injectable, Logger } from '@nestjs/common';
import * as playwright from 'playwright';

interface DiscoveredLink {
  url: string;
  text: string;
  linkType: 'navigation' | 'button' | 'footer' | 'sidebar' | 'form' | 'content' | 'external';
  requiresAuth: boolean;
}

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
export class PageCrawlerService {
  private readonly logger = new Logger(PageCrawlerService.name);
  private browser: playwright.Browser | null = null;

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
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')
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
   * Clean up browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Crawl a single page and extract links
   */
  async crawlPage(url: string, baseDomain: string): Promise<CrawlResult> {
    await this.initBrowser();

    // Check if this is a local address - ignore SSL errors for local development
    const isLocal = this.isLocalAddress(url);

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: isLocal,  // Allow self-signed certs for localhost
    });

    const page = await context.newPage();
    let isAccessible = false;
    let screenshot: string | undefined;

    try {
      this.logger.log(`Crawling page: ${url}${isLocal ? ' (local)' : ''}`);

      // Navigate and track response status for verification
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Track if page is accessible (HTTP 200-299)
      isAccessible = response?.ok() ?? false;

      // Wait a bit for JS to execute
      await page.waitForTimeout(2000);

      // Capture screenshot thumbnail (viewport only, compressed JPEG)
      try {
        const screenshotBuffer = await page.screenshot({
          type: 'jpeg',
          quality: 50,  // Lower quality for smaller size
          clip: { x: 0, y: 0, width: 1280, height: 720 },  // Above-the-fold viewport
        });
        screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
        this.logger.debug(`Screenshot captured for ${url} (${Math.round(screenshotBuffer.length / 1024)}KB)`);
      } catch (screenshotError) {
        this.logger.warn(`Failed to capture screenshot for ${url}: ${screenshotError.message}`);
        // Continue without screenshot - not critical
      }

      // Get page title with fallback to h1 or URL-based title
      let title = await page.title();
      if (!title || title.trim() === '') {
        // Try to get h1 content as title
        const h1Text = await page.$eval('h1', el => el.textContent?.trim()).catch(() => null);
        if (h1Text) {
          title = h1Text;
        } else {
          // Use URL path as fallback
          title = this.generateTitleFromUrl(url);
        }
      }

      // Check if page requires authentication (look for login forms or redirects)
      const requiresAuth = await this.detectAuthRequirement(page);

      // Determine page type
      const pageType = await this.detectPageType(page);

      // Extract all links
      const links = await this.extractLinks(page, baseDomain);

      await context.close();

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
      await context.close();
      throw error;
    }
  }

  /**
   * Extract all links from a page
   */
  private async extractLinks(page: playwright.Page, baseDomain: string): Promise<DiscoveredLink[]> {
    const links = await page.evaluate((domain: string) => {
      const results: { url: string; text: string; location: string; isExternal: boolean }[] = [];

      // Get all anchor tags
      document.querySelectorAll('a[href]').forEach((anchor: HTMLAnchorElement) => {
        const href = anchor.href;
        if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#') {
          return;
        }

        // Determine link location
        let location = 'content';
        const parent = anchor.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]');
        if (parent) {
          const tagName = parent.tagName.toLowerCase();
          const role = parent.getAttribute('role');
          if (tagName === 'nav' || role === 'navigation') location = 'navigation';
          else if (tagName === 'header' || role === 'banner') location = 'navigation';
          else if (tagName === 'footer' || role === 'contentinfo') location = 'footer';
          else if (tagName === 'aside') location = 'sidebar';
        }

        // Check if external
        let isExternal = false;
        try {
          const linkDomain = new URL(href).hostname;
          isExternal = linkDomain !== domain && !linkDomain.endsWith(`.${domain}`);
        } catch {
          isExternal = false;
        }

        results.push({
          url: href,
          text: anchor.textContent?.trim() || anchor.getAttribute('aria-label') || '',
          location,
          isExternal,
        });
      });

      // Get buttons that navigate (onclick with location changes)
      document.querySelectorAll('button[onclick], [role="button"][onclick]').forEach((btn: HTMLElement) => {
        const onclick = btn.getAttribute('onclick') || '';
        const urlMatch = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (urlMatch) {
          results.push({
            url: urlMatch[1],
            text: btn.textContent?.trim() || '',
            location: 'button',
            isExternal: false,
          });
        }
      });

      return results;
    }, baseDomain);

    // Convert to DiscoveredLink format
    return links.map(link => ({
      url: link.url,
      text: link.text.substring(0, 200), // Limit text length
      linkType: link.isExternal ? 'external' : (link.location as DiscoveredLink['linkType']),
      requiresAuth: false, // Will be determined when crawling the target
    }));
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
  ): Promise<Map<string, CrawlResult>> {
    const results = new Map<string, CrawlResult>();
    const visited = new Set<string>();
    const failedPages: Array<{ url: string; error: string }> = [];
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

    const baseDomain = new URL(startUrl).hostname;

    this.logger.log(`Starting crawl of ${startUrl} (max depth: ${maxDepth}, max pages: ${maxPages})`);

    await this.initBrowser();

    try {
      while (queue.length > 0 && results.size < maxPages) {
        const { url, depth } = queue.shift()!;

        // Normalize URL
        const normalizedUrl = this.normalizeUrl(url);
        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        try {
          const result = await this.crawlPage(normalizedUrl, baseDomain);
          results.set(normalizedUrl, result);

          this.logger.log(`Crawled ${results.size}/${maxPages}: ${normalizedUrl} (${result.links.length} links found)`);

          // Add discovered links to queue if within depth limit
          if (depth < maxDepth) {
            for (const link of result.links) {
              if (link.linkType !== 'external') {
                const linkNormalized = this.normalizeUrl(link.url);
                if (!visited.has(linkNormalized)) {
                  queue.push({ url: link.url, depth: depth + 1 });
                }
              }
            }
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

  /**
   * Normalize URL for smart deduplication
   * Removes tracking params, hash fragments, normalizes localhost, etc.
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // 1. Remove hash/anchor fragments (#section)
      parsed.hash = '';

      // 2. Normalize localhost variations (localhost = 127.0.0.1)
      let host = parsed.host;
      if (parsed.hostname === '127.0.0.1') {
        // Replace 127.0.0.1 with localhost but keep the port
        const port = parsed.port || '';
        host = `localhost${port ? ':' + port : ''}`;
      }

      // 3. Remove www prefix for comparison
      host = host.replace(/^www\./, '');

      // 4. Normalize path - remove trailing slashes, lowercase
      let path = parsed.pathname.replace(/\/+$/, '') || '/';
      path = path.toLowerCase();

      // 5. Remove ALL tracking/marketing parameters
      const trackingParams = [
        // UTM parameters
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        // Facebook
        'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source',
        // Google
        'gclid', 'gclsrc', 'dclid',
        // Other common tracking
        'ref', 'source', 'campaign', 'via', 'affiliate',
        'mc_cid', 'mc_eid',  // Mailchimp
        'msclkid',  // Microsoft/Bing
        '_ga', '_gl',  // Google Analytics
        'trk', 'trkid', 'tracking',
        'click_id', 'clickid',
        // Session/state params often not content-affecting
        'sessionid', 'session', 'sid',
      ];

      trackingParams.forEach(param => {
        parsed.searchParams.delete(param);
      });

      // 6. Sort remaining params for consistent comparison
      const sortedParams = new URLSearchParams(
        [...parsed.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      );

      // 7. Build normalized URL (WITH protocol for navigation)
      const queryString = sortedParams.toString();
      return `${parsed.protocol}//${host}${path}${queryString ? '?' + queryString : ''}`.toLowerCase();

    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Generate a readable title from URL path
   */
  private generateTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/').filter(part => part.length > 0);

      if (pathParts.length === 0) {
        // Homepage
        const hostname = parsed.hostname.replace(/^www\./, '');
        const siteName = hostname.split('.')[0];
        return `${siteName.charAt(0).toUpperCase()}${siteName.slice(1)} Homepage`;
      }

      // Get the last meaningful part of the path
      const lastPart = pathParts[pathParts.length - 1];

      // Remove file extensions
      const nameWithoutExt = lastPart.replace(/\.(html?|php|aspx?|jsp)$/i, '');

      // Convert dashes/underscores to spaces and capitalize
      return nameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ') || 'Page';
    } catch {
      return 'Page';
    }
  }
}
