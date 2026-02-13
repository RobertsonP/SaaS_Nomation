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
   * Normalize domain for comparison — treats localhost variants as equivalent.
   * localhost, 127.0.0.1, and host.docker.internal are all the same host.
   */
  private normalizeDomain(domain: string): string {
    const d = domain.toLowerCase();
    if (d === '127.0.0.1' || d === 'host.docker.internal') return 'localhost';
    return d;
  }

  /**
   * Extract all links from a page, including those hidden in menus
   */
  async extractLinks(page: playwright.Page, baseDomain: string): Promise<DiscoveredLink[]> {
    // First, extract all statically visible links
    // Normalize the base domain before passing to browser context
    const normalizedBaseDomain = this.normalizeDomain(baseDomain);

    const staticLinks = await page.evaluate(({ domain, normalizedDomain }: { domain: string; normalizedDomain: string }) => {
      const results: { url: string; text: string; location: string; isExternal: boolean }[] = [];

      // Domain normalizer for localhost variants (runs in browser context)
      const normDomain = (d: string): string => {
        const dl = d.toLowerCase();
        if (dl === '127.0.0.1' || dl === 'host.docker.internal') return 'localhost';
        return dl;
      };

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

        // Check if external — normalize localhost variants for comparison
        let isExternal = false;
        try {
          const linkDomain = normDomain(new URL(href).hostname);
          isExternal = linkDomain !== normalizedDomain && !linkDomain.endsWith(`.${normalizedDomain}`);
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
    }, { domain: baseDomain, normalizedDomain: normalizedBaseDomain });

    // Diagnostic logging: show external links that were filtered
    const externalLinks = staticLinks.filter(l => l.isExternal);
    if (externalLinks.length > 0) {
      this.logger.debug(`Filtered ${externalLinks.length} external links (base domain: ${baseDomain} → normalized: ${normalizedBaseDomain}): ${externalLinks.slice(0, 5).map(l => l.url).join(', ')}${externalLinks.length > 5 ? '...' : ''}`);
    }
    this.logger.debug(`Found ${staticLinks.length} static links (${staticLinks.filter(l => !l.isExternal).length} internal, ${externalLinks.length} external)`);

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
    const normalizedBaseDomain = this.normalizeDomain(baseDomain);

    const links = await page.evaluate(({ normalizedDomain }: { normalizedDomain: string }) => {
      const results: { url: string; text: string; location: string; isExternal: boolean }[] = [];

      const normDomain = (d: string): string => {
        const dl = d.toLowerCase();
        if (dl === '127.0.0.1' || dl === 'host.docker.internal') return 'localhost';
        return dl;
      };

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

        // Check if external — normalize localhost variants for comparison
        let isExternal = false;
        try {
          const linkDomain = normDomain(new URL(href).hostname);
          isExternal = linkDomain !== normalizedDomain && !linkDomain.endsWith(`.${normalizedDomain}`);
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
    }, { normalizedDomain: normalizedBaseDomain });

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
