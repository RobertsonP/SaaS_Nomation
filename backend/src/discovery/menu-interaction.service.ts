import { Injectable, Logger } from '@nestjs/common';
import * as playwright from 'playwright';
import { DiscoveredLink, LinkDiscoveryService } from './link-discovery.service';

@Injectable()
export class MenuInteractionService {
  private readonly logger = new Logger(MenuInteractionService.name);

  // NOTE: LinkDiscoveryService is injected lazily via setLinkDiscoveryService()
  // to break the circular dependency (LinkDiscovery -> MenuInteraction -> LinkDiscovery)
  private linkDiscoveryService: LinkDiscoveryService;

  setLinkDiscoveryService(service: LinkDiscoveryService): void {
    this.linkDiscoveryService = service;
  }

  /**
   * Discover links hidden in menus by hovering and clicking on menu items
   * This handles dropdowns, flyouts, and expandable navigation menus
   * Enhanced for React, Vue, Next.js and other dynamic JS frameworks
   */
  async discoverMenuLinks(page: playwright.Page, baseDomain: string): Promise<DiscoveredLink[]> {
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

    this.logger.debug(`SPA detected: ${isSPA}, using polling-based waits (max ${isSPA ? '1500' : '800'}ms)`);

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

      // Phase B: Interact with menu items - prioritize those with submenu indicators
      // OPTIMIZED: Reduced from 30 to 15 items (Task 1.3 - discovery speed)
      const itemsToProcess = [
        ...menuItems.filter(item => item.hasSubIndicator),
        ...menuItems.filter(item => !item.hasSubIndicator).slice(0, 5) // Try fewer non-indicator items
      ].slice(0, 15); // Limit total to 15 items (was 30)

      // OPTIMIZED: Add menu discovery timeout (Task 1.3 - max 15 seconds)
      const menuDiscoveryStart = Date.now();
      const MENU_DISCOVERY_TIMEOUT = 15000; // 15 seconds max for all menu interactions

      for (const menuItem of itemsToProcess) {
        // Check timeout before processing each item
        if (Date.now() - menuDiscoveryStart > MENU_DISCOVERY_TIMEOUT) {
          this.logger.debug(`Menu discovery timeout reached after ${(Date.now() - menuDiscoveryStart) / 1000}s`);
          break;
        }
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
          const linksBefore = await this.linkDiscoveryService.getVisibleLinkUrls(page);

          // HOVER STRATEGY - Try hover with early-exit polling
          let hoverSucceeded = false;
          try {
            await element.hover({ timeout: 3000 });
            // Poll every 100ms instead of waiting fixed durations
            const maxHoverWait = isSPA ? 1500 : 800;
            const pollInterval = 100;
            let elapsed = 0;
            while (elapsed < maxHoverWait) {
              await page.waitForTimeout(pollInterval);
              elapsed += pollInterval;
              const linksAfterHover = await this.linkDiscoveryService.getVisibleLinkUrls(page);
              const newHoverLinks = [...linksAfterHover].filter(url => !linksBefore.has(url));

              if (newHoverLinks.length > 0) {
                this.logger.debug(`Hover on "${menuItem.text}" revealed ${newHoverLinks.length} new links after ${elapsed}ms`);
                const hoverLinks = await this.linkDiscoveryService.extractNewlyRevealedLinks(
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

              const linksBefClick = await this.linkDiscoveryService.getVisibleLinkUrls(page);
              const currentUrl = page.url();

              await element.click({ timeout: 3000 });
              // Poll every 100ms instead of waiting fixed durations
              const maxClickWait = isSPA ? 1500 : 800;
              const clickPollInterval = 100;
              let clickElapsed = 0;
              while (clickElapsed < maxClickWait) {
                await page.waitForTimeout(clickPollInterval);
                clickElapsed += clickPollInterval;

                // Safety check: verify we didn't navigate away
                if (page.url() !== currentUrl) {
                  this.logger.debug(`Click on "${menuItem.text}" caused navigation, going back`);
                  await page.goBack({ timeout: 5000 }).catch(() => {});
                  await page.waitForTimeout(300);
                  break;
                }

                const linksAfterClick = await this.linkDiscoveryService.getVisibleLinkUrls(page);
                const newClickLinks = [...linksAfterClick].filter(url => !linksBefClick.has(url));

                if (newClickLinks.length > 0) {
                  this.logger.debug(`Click on "${menuItem.text}" revealed ${newClickLinks.length} new links after ${clickElapsed}ms`);

                  const clickLinks = await this.linkDiscoveryService.extractNewlyRevealedLinks(
                    page,
                    baseDomain,
                    linksBefClick,
                    'click',
                    menuItem.text
                  );
                  discoveredLinks.push(...clickLinks);

                  await page.keyboard.press('Escape').catch(() => {});
                  await page.waitForTimeout(150);
                  break;
                }
              }
            } catch (clickError) {
              this.logger.debug(`Click failed for "${menuItem.text}": ${clickError.message}`);
            }
          }

          // Move mouse away to close any hover menus
          await page.mouse.move(0, 0);
          await page.waitForTimeout(150);

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
}
