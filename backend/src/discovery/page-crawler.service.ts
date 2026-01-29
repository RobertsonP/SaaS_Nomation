import { Injectable, Logger } from '@nestjs/common';
import * as playwright from 'playwright';

interface DiscoveredLink {
  url: string;
  text: string;
  linkType: 'navigation' | 'button' | 'footer' | 'sidebar' | 'form' | 'content' | 'external';
  requiresAuth: boolean;
  menuLevel?: number;           // 0 = top-level, 1 = submenu, 2 = sub-submenu, etc.
  revealedBy?: 'hover' | 'click' | 'none';  // How the link was revealed
  parentMenuText?: string;      // Text of parent menu item that revealed this link
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

      // Wait for JS to execute - longer for SPAs
      await page.waitForTimeout(isSPA ? 3000 : 2000);

      // Also wait for network to be idle for SPAs
      if (isSPA) {
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch {
          // Network idle timeout is not critical, continue
        }
      }

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
          title = this.generateTitleFromUrl(url);
        }
      }

      // Clean up the title - remove "undefined" parts and trim
      title = title.replace(/undefined/gi, '').trim();
      if (!title || title === '|' || title === '-') {
        title = this.generateTitleFromUrl(url);
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
   * Extract all links from a page, including those hidden in menus
   */
  private async extractLinks(page: playwright.Page, baseDomain: string): Promise<DiscoveredLink[]> {
    // First, extract all statically visible links
    const staticLinks = await page.evaluate((domain: string) => {
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

    // Convert static links to DiscoveredLink format
    const allLinks: DiscoveredLink[] = staticLinks.map(link => ({
      url: link.url,
      text: link.text.substring(0, 200),
      linkType: link.isExternal ? 'external' : (link.location as DiscoveredLink['linkType']),
      requiresAuth: false,
      menuLevel: 0,
      revealedBy: 'none' as const,
    }));

    // Now discover links hidden in menus (hover/click to reveal)
    try {
      const menuLinks = await this.discoverMenuLinks(page, baseDomain);

      // Deduplicate - only add menu links that aren't already in static links
      const existingUrls = new Set(allLinks.map(l => l.url));
      for (const menuLink of menuLinks) {
        if (!existingUrls.has(menuLink.url)) {
          allLinks.push(menuLink);
          existingUrls.add(menuLink.url);
        }
      }

      this.logger.debug(`Total links: ${allLinks.length} (${staticLinks.length} static + ${menuLinks.length} from menus)`);
    } catch (error) {
      this.logger.warn(`Menu discovery failed, using static links only: ${error.message}`);
    }

    return allLinks;
  }

  /**
   * Discover links hidden in menus by hovering and clicking on menu items
   * This handles dropdowns, flyouts, and expandable navigation menus
   * Enhanced for React, Vue, Next.js and other dynamic JS frameworks
   */
  private async discoverMenuLinks(page: playwright.Page, baseDomain: string): Promise<DiscoveredLink[]> {
    const discoveredLinks: DiscoveredLink[] = [];

    this.logger.debug('Starting enhanced menu interaction discovery...');

    // Detect SPA framework for adaptive wait times
    const isSPA = await page.evaluate(() => {
      return !!(
        // Next.js
        (window as any).__NEXT_DATA__ ||
        document.querySelector('#__next') ||
        // Nuxt.js
        (window as any).__NUXT__ ||
        document.querySelector('#__nuxt') ||
        // Vue.js
        (window as any).__VUE__ ||
        document.querySelector('[data-v-]') ||
        // React
        document.querySelector('[data-reactroot]') ||
        document.querySelector('#root[data-reactroot]') ||
        // Angular
        document.querySelector('[ng-version]') ||
        document.querySelector('app-root') ||
        // Svelte
        document.querySelector('[class*="svelte-"]') ||
        // General SPA indicators
        document.querySelector('[data-react-helmet]') ||
        document.querySelector('meta[name="generator"][content*="Next"]') ||
        document.querySelector('meta[name="generator"][content*="Gatsby"]')
      );
    });

    // Adaptive wait times: longer for SPAs, shorter for static sites
    const waitTimes = isSPA ? [1000, 2000, 3000] : [500, 1000, 1500];
    this.logger.debug(`SPA detected: ${isSPA}, using wait times: ${waitTimes.join('/')}ms`);

    try {
      // Phase A: Find potential menu containers and menu items with improved detection
      const menuItems = await page.evaluate(() => {
        const items: Array<{
          selector: string;
          text: string;
          hasSubIndicator: boolean;
          index: number;
          tagName: string;
          xpath: string;
        }> = [];

        // Build XPath for an element
        const getXPath = (element: Element): string => {
          const parts: string[] = [];
          let current: Element | null = element;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling: Element | null = current.previousElementSibling;
            while (sibling) {
              if (sibling.tagName === current.tagName) index++;
              sibling = sibling.previousElementSibling;
            }
            const tagName = current.tagName.toLowerCase();
            parts.unshift(`${tagName}[${index}]`);
            current = current.parentElement;
          }
          return '/' + parts.join('/');
        };

        // Find all navigation containers - expanded selectors for modern frameworks
        const navContainers = document.querySelectorAll(
          'nav, [role="navigation"], [role="menubar"], header, ' +
          '.nav, .menu, .navbar, .navigation, .main-nav, .primary-nav, .site-nav, ' +
          '[class*="navigation"], [class*="menu"], [class*="nav-"], [class*="navbar"], ' +
          '[data-testid*="nav"], [data-testid*="menu"], ' +
          // React/Vue/Next.js common patterns
          '[class*="Header"], [class*="TopBar"], [class*="MainMenu"], ' +
          'header[class], div[class*="header"]'
        );

        let itemIndex = 0;
        const processedTexts = new Set<string>(); // Avoid duplicates

        navContainers.forEach((container) => {
          // Find menu items that might have submenus - expanded selectors
          const menuElements = container.querySelectorAll(
            'a, button, [role="menuitem"], [role="button"], [role="link"], ' +
            '[aria-haspopup], [aria-expanded], [aria-controls], ' +
            '[class*="dropdown"], [class*="submenu"], [class*="menu-item"], ' +
            '[class*="nav-item"], [class*="nav-link"], [class*="MenuLink"], ' +
            'li > a, li > button, li > span, .menu-item > a, .menu-item > span, ' +
            // Common React/Vue patterns
            '[class*="Link"], [class*="Item"], ' +
            // Elements with nested icons (dropdown indicators)
            ':has(> svg), :has(> [class*="icon"]), :has(> [class*="arrow"]), :has(> [class*="caret"])'
          );

          menuElements.forEach((el: HTMLElement) => {
            // Skip if no text content or too long
            const text = el.textContent?.trim()?.replace(/\s+/g, ' ');
            if (!text || text.length > 50 || text.length < 2) return;

            // Skip if we've already processed this exact text (duplicate prevention)
            if (processedTexts.has(text)) return;
            processedTexts.add(text);

            // Check for submenu indicators - comprehensive check
            const classString = el.classList?.toString() || '';
            const parentClassString = el.parentElement?.classList?.toString() || '';
            const grandparentClassString = el.parentElement?.parentElement?.classList?.toString() || '';

            const hasSubIndicator = !!(
              // ARIA attributes
              el.getAttribute('aria-haspopup') === 'true' ||
              el.getAttribute('aria-haspopup') === 'menu' ||
              el.getAttribute('aria-expanded') !== null ||
              el.getAttribute('aria-controls') ||
              // Visual indicators (icons)
              el.querySelector('svg, .arrow, .caret, .chevron, .icon, [class*="arrow"], [class*="caret"], [class*="chevron"], [class*="dropdown-icon"]') ||
              // Class patterns on element
              classString.match(/dropdown|submenu|has-children|has-submenu|expandable|collapsible|toggle|trigger/i) ||
              // Class patterns on parent
              parentClassString.match(/dropdown|submenu|has-children|has-submenu|menu-parent/i) ||
              grandparentClassString.match(/dropdown|submenu|has-children/i) ||
              // Common text patterns
              text.match(/menu|products|services|solutions|resources|more|categories/i) ||
              // Has a sibling that looks like a submenu
              el.parentElement?.querySelector('ul, .submenu, .dropdown-menu, [class*="dropdown"], [class*="submenu"]')
            );

            // Generate multiple selector strategies
            let selector = '';
            const tagName = el.tagName.toLowerCase();

            // Strategy 1: ID
            if (el.id) {
              selector = `#${CSS.escape(el.id)}`;
            }
            // Strategy 2: data-testid
            else if (el.getAttribute('data-testid')) {
              selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
            }
            // Strategy 3: data-cy (Cypress)
            else if (el.getAttribute('data-cy')) {
              selector = `[data-cy="${el.getAttribute('data-cy')}"]`;
            }
            // Strategy 4: Unique class combination
            else if (el.className && typeof el.className === 'string') {
              const classes = el.className.split(/\s+/).filter(c => c.length > 0 && !c.match(/^(active|hover|focus|selected)/));
              if (classes.length > 0) {
                selector = `${tagName}.${classes.slice(0, 3).join('.')}`;
              }
            }

            // Fallback to XPath-based selector
            const xpath = getXPath(el);

            items.push({
              selector,
              text,
              hasSubIndicator,
              index: itemIndex++,
              tagName,
              xpath
            });
          });
        });

        return items;
      });

      this.logger.debug(`Found ${menuItems.length} potential menu items to interact with`);
      if (menuItems.length > 0) {
        this.logger.debug(`Items with sub-indicators: ${menuItems.filter(i => i.hasSubIndicator).length}`);
        this.logger.debug(`Sample items: ${menuItems.slice(0, 5).map(i => `"${i.text}"`).join(', ')}`);
      }

      // Phase B: Interact with menu items - prioritize those with submenu indicators, but also try others
      const itemsToProcess = [
        ...menuItems.filter(item => item.hasSubIndicator),
        ...menuItems.filter(item => !item.hasSubIndicator).slice(0, 10) // Also try some without indicators
      ].slice(0, 30); // Limit total to 30 items

      for (const menuItem of itemsToProcess) {
        try {
          // Try multiple selector strategies to find the element
          let element: playwright.Locator | null = null;

          // Strategy 1: Use CSS selector if we have one
          if (menuItem.selector) {
            const locator = page.locator(menuItem.selector);
            const count = await locator.count();
            if (count > 0) {
              element = locator.first();
            }
          }

          // Strategy 2: Use text matching with exact text
          if (!element) {
            const textLocator = page.getByRole('link', { name: menuItem.text, exact: true });
            const count = await textLocator.count();
            if (count > 0) {
              element = textLocator.first();
            }
          }

          // Strategy 3: Use text matching with button role
          if (!element) {
            const buttonLocator = page.getByRole('button', { name: menuItem.text, exact: true });
            const count = await buttonLocator.count();
            if (count > 0) {
              element = buttonLocator.first();
            }
          }

          // Strategy 4: Text content locator (less precise but more flexible)
          if (!element) {
            const textLocator = page.locator(`text="${menuItem.text}"`);
            const count = await textLocator.count();
            if (count > 0) {
              element = textLocator.first();
            }
          }

          // Strategy 5: XPath as last resort
          if (!element && menuItem.xpath) {
            const xpathLocator = page.locator(`xpath=${menuItem.xpath}`);
            const count = await xpathLocator.count();
            if (count > 0) {
              element = xpathLocator.first();
            }
          }

          if (!element) {
            this.logger.debug(`Could not locate element for "${menuItem.text}"`);
            continue;
          }

          // Get links before interaction
          const linksBefore = await this.getVisibleLinkUrls(page);

          // HOVER STRATEGY - Try hover with adaptive wait times for dynamic frameworks
          let hoverSucceeded = false;
          try {
            await element.hover({ timeout: 3000 });
            // Use adaptive wait times based on SPA detection
            for (const waitTime of waitTimes) {
              await page.waitForTimeout(waitTime);
              const linksAfterHover = await this.getVisibleLinkUrls(page);
              const newHoverLinks = [...linksAfterHover].filter(url => !linksBefore.has(url));

              if (newHoverLinks.length > 0) {
                this.logger.debug(`Hover on "${menuItem.text}" revealed ${newHoverLinks.length} new links after ${waitTime}ms`);

                // Extract the newly revealed links
                const hoverLinks = await this.extractNewlyRevealedLinks(
                  page,
                  baseDomain,
                  linksBefore,
                  'hover',
                  menuItem.text
                );
                discoveredLinks.push(...hoverLinks);
                hoverSucceeded = true;
                break;
              }
            }
          } catch (hoverError) {
            this.logger.debug(`Hover failed for "${menuItem.text}": ${hoverError.message}`);
          }

          // CLICK STRATEGY - If hover didn't work, try clicking (for click-to-expand menus)
          // Only click on elements that are likely to expand menus, not navigate
          if (!hoverSucceeded && menuItem.hasSubIndicator) {
            try {
              // Pre-click safety check: verify element is clickable and won't navigate
              const shouldClick = await element.evaluate((el: HTMLElement) => {
                const tagName = el.tagName.toLowerCase();
                const href = el.getAttribute('href');

                // Skip if it's a link with a real URL (would navigate away)
                if (tagName === 'a' && href && href !== '#' && !href.startsWith('javascript:')) {
                  // Only click if it has clear submenu indicators
                  const hasSubmenuIndicator = !!(
                    el.getAttribute('aria-haspopup') ||
                    el.getAttribute('aria-expanded') !== null ||
                    el.classList.toString().match(/dropdown|toggle|expand/i)
                  );
                  return hasSubmenuIndicator;
                }

                // Buttons are usually safe to click
                if (tagName === 'button' || el.getAttribute('role') === 'button') {
                  return true;
                }

                // Elements with specific toggle/dropdown classes
                const classString = el.classList?.toString() || '';
                if (classString.match(/toggle|dropdown|expand|trigger|opener/i)) {
                  return true;
                }

                // Skip plain text elements, spans without handlers
                if (tagName === 'span' || tagName === 'div') {
                  // Only click if it has clear interaction indicators
                  return !!(
                    el.getAttribute('onclick') ||
                    el.getAttribute('role') === 'button' ||
                    el.getAttribute('tabindex')
                  );
                }

                return false;
              }).catch(() => false);

              if (!shouldClick) {
                this.logger.debug(`Skipping click on "${menuItem.text}" - not a safe clickable element`);
                continue;
              }

              const linksBefClick = await this.getVisibleLinkUrls(page);
              const currentUrl = page.url();

              await element.click({ timeout: 3000 });
              // Use adaptive wait times for JS framework animations
              for (const waitTime of waitTimes) {
                await page.waitForTimeout(waitTime);

                // Safety check: verify we didn't navigate away
                if (page.url() !== currentUrl) {
                  this.logger.debug(`Click on "${menuItem.text}" caused navigation, going back`);
                  await page.goBack({ timeout: 5000 }).catch(() => {});
                  await page.waitForTimeout(500);
                  break;
                }

                const linksAfterClick = await this.getVisibleLinkUrls(page);
                const newClickLinks = [...linksAfterClick].filter(url => !linksBefClick.has(url));

                if (newClickLinks.length > 0) {
                  this.logger.debug(`Click on "${menuItem.text}" revealed ${newClickLinks.length} new links after ${waitTime}ms`);

                  const clickLinks = await this.extractNewlyRevealedLinks(
                    page,
                    baseDomain,
                    linksBefClick,
                    'click',
                    menuItem.text
                  );
                  discoveredLinks.push(...clickLinks);

                  // Try to close the menu - press Escape or click elsewhere
                  await page.keyboard.press('Escape').catch(() => {});
                  await page.waitForTimeout(200);
                  break;
                }
              }
            } catch (clickError) {
              this.logger.debug(`Click failed for "${menuItem.text}": ${clickError.message}`);
            }
          }

          // Move mouse away to close any hover menus
          await page.mouse.move(0, 0);
          await page.waitForTimeout(300);

        } catch (error) {
          this.logger.debug(`Failed to interact with menu item "${menuItem.text}": ${error.message}`);
        }
      }

    } catch (error) {
      this.logger.warn(`Menu discovery error: ${error.message}`);
    }

    this.logger.log(`Menu discovery completed: found ${discoveredLinks.length} additional links from menus`);
    return discoveredLinks;
  }

  /**
   * Get all currently visible link URLs on the page
   * Enhanced visibility detection using getBoundingClientRect for accurate visibility checks
   */
  private async getVisibleLinkUrls(page: playwright.Page): Promise<Set<string>> {
    const urls = await page.evaluate(() => {
      const links: string[] = [];
      document.querySelectorAll('a[href]').forEach((anchor: HTMLAnchorElement) => {
        // Enhanced visibility check using multiple methods
        const style = window.getComputedStyle(anchor);
        const rect = anchor.getBoundingClientRect();

        // Check all visibility conditions
        const isVisible = (
          // CSS visibility checks
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity || '1') > 0 &&
          style.pointerEvents !== 'none' &&
          // Dimension checks using getBoundingClientRect
          rect.width > 0 &&
          rect.height > 0 &&
          // Check if element has layout (offsetParent)
          anchor.offsetParent !== null
        );

        if (isVisible && anchor.href && !anchor.href.startsWith('javascript:')) {
          links.push(anchor.href);
        }
      });
      return links;
    });
    return new Set(urls);
  }

  /**
   * Extract links that were newly revealed after menu interaction
   */
  private async extractNewlyRevealedLinks(
    page: playwright.Page,
    baseDomain: string,
    previousLinks: Set<string>,
    revealMethod: 'hover' | 'click',
    parentMenuText: string
  ): Promise<DiscoveredLink[]> {
    const links = await page.evaluate((domain: string) => {
      const results: { url: string; text: string; location: string; isExternal: boolean }[] = [];

      document.querySelectorAll('a[href]').forEach((anchor: HTMLAnchorElement) => {
        // Enhanced visibility check using getBoundingClientRect
        const style = window.getComputedStyle(anchor);
        const rect = anchor.getBoundingClientRect();

        const isVisible = (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity || '1') > 0 &&
          style.pointerEvents !== 'none' &&
          rect.width > 0 &&
          rect.height > 0 &&
          anchor.offsetParent !== null
        );

        if (!isVisible) return;

        const href = anchor.href;
        if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#') {
          return;
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
          location: 'navigation',
          isExternal,
        });
      });

      return results;
    }, baseDomain);

    // Filter to only newly revealed links
    return links
      .filter(link => !previousLinks.has(link.url))
      .map(link => ({
        url: link.url,
        text: link.text.substring(0, 200),
        linkType: link.isExternal ? 'external' : 'navigation' as DiscoveredLink['linkType'],
        requiresAuth: false,
        menuLevel: 1,
        revealedBy: revealMethod,
        parentMenuText,
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
                  // Track menu level properly - submenu items add extra depth
                  const linkDepth = depth + 1 + (link.menuLevel || 0);
                  // Only add if calculated depth is still within limit
                  if (linkDepth <= maxDepth) {
                    queue.push({ url: link.url, depth: linkDepth });
                  }
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
