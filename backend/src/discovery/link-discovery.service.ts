import { Injectable, Logger } from '@nestjs/common';
import * as playwright from 'playwright';
import { MenuInteractionService } from './menu-interaction.service';

export interface DiscoveredLink {
  url: string;
  text: string;
  linkType: 'navigation' | 'button' | 'footer' | 'sidebar' | 'form' | 'content' | 'external';
  requiresAuth: boolean;
  menuLevel?: number;           // 0 = top-level, 1 = submenu, 2 = sub-submenu, etc.
  revealedBy?: 'hover' | 'click' | 'none';  // How the link was revealed
  parentMenuText?: string;      // Text of parent menu item that revealed this link
}

@Injectable()
export class LinkDiscoveryService {
  private readonly logger = new Logger(LinkDiscoveryService.name);

  constructor(private readonly menuInteractionService: MenuInteractionService) {}

  /**
   * Extract all links from a page, including those hidden in menus
   */
  async extractLinks(page: playwright.Page, baseDomain: string): Promise<DiscoveredLink[]> {
    // First, extract all statically visible links
    const staticLinks = await page.evaluate((domain: string) => {
      const results: { url: string; text: string; location: string; isExternal: boolean }[] = [];

      // Get all anchor tags
      document.querySelectorAll('a[href]').forEach((anchor: HTMLAnchorElement) => {
        const href = anchor.href;
        if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') ||
            href.startsWith('data:') || href.startsWith('blob:') || href.startsWith('file:') || href.startsWith('ftp:') || href === '#') {
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
      const menuLinks = await this.menuInteractionService.discoverMenuLinks(page, baseDomain);

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
   * Extract links that were newly revealed after menu interaction
   */
  async extractNewlyRevealedLinks(
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
        if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') ||
            href.startsWith('data:') || href.startsWith('blob:') || href.startsWith('file:') || href.startsWith('ftp:') || href === '#') {
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
   * Get all currently visible link URLs on the page
   * Enhanced visibility detection using getBoundingClientRect for accurate visibility checks
   */
  async getVisibleLinkUrls(page: playwright.Page): Promise<Set<string>> {
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
}
