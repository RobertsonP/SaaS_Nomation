import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';

@Injectable()
export class MetadataExtractionService {
  /**
   * Enhanced intelligent page title extraction
   */
  async extractIntelligentPageTitle(page: Page, url: string): Promise<string> {
    try {
      // Strategy 1: Get document title
      const documentTitle = await page.title();
      console.log(`📄 Document title: "${documentTitle}"`);

      // Strategy 2: Try multiple title sources in order of preference
      const titleSources = [
        'meta[property="og:title"]',           // Open Graph title
        'meta[name="twitter:title"]',         // Twitter Card title
        'h1',                                 // Main heading
        '.page-title, .title, .heading',     // Common title classes
        'header h1, header h2',              // Header titles
        'meta[name="title"]'                 // Meta title tag
      ];

      let bestTitle = documentTitle;

      for (const selector of titleSources) {
        try {
          const element = await page.locator(selector).first();
          const text = await element.textContent({ timeout: 1000 });

          if (text && text.trim() && text.trim().length > 0) {
            const cleanText = text.trim();
            console.log(`📋 Found title from ${selector}: "${cleanText}"`);

            // Prefer more specific titles over generic ones
            if (this.isBetterTitle(cleanText, bestTitle)) {
              bestTitle = cleanText;
            }
          }
        } catch (e) {
          // Continue to next strategy
        }
      }

      // Clean and improve the final title
      const cleanedTitle = this.cleanPageTitle(bestTitle, url);
      console.log(`✨ Final cleaned title: "${cleanedTitle}"`);

      return cleanedTitle;

    } catch (error) {
      console.error('Error extracting intelligent page title:', error);
      return this.generateFallbackTitle(url);
    }
  }

  /**
   * Determine if a new title is better than the current best title
   */
  isBetterTitle(newTitle: string, currentTitle: string): boolean {
    if (!currentTitle || currentTitle.trim().length === 0) return true;
    if (!newTitle || newTitle.trim().length === 0) return false;

    const current = currentTitle.toLowerCase();
    const candidate = newTitle.toLowerCase();

    // Prefer titles that are not too generic
    const genericWords = ['page', 'home', 'welcome', 'untitled', 'document', 'index'];
    const currentIsGeneric = genericWords.some(word => current.includes(word));
    const candidateIsGeneric = genericWords.some(word => candidate.includes(word));

    if (currentIsGeneric && !candidateIsGeneric) return true;
    if (!currentIsGeneric && candidateIsGeneric) return false;

    // Prefer shorter, more concise titles (but not too short)
    if (candidate.length >= 5 && candidate.length < current.length && current.length > 50) {
      return true;
    }

    return false;
  }

  /**
   * Clean and improve page title for better user experience
   */
  cleanPageTitle(title: string, url: string): string {
    if (!title || title.trim().length === 0) {
      return this.generateFallbackTitle(url);
    }

    let cleaned = title.trim();

    // Remove common site name patterns (e.g., "Page Title - Site Name" -> "Page Title")
    const patterns = [
      /\s*[-|–—]\s*[^-|–—]*$/,           // Remove " - Site Name" suffix
      /\s*\|\s*[^|]*$/,                  // Remove " | Site Name" suffix
      /\s*::\s*[^:]*$/,                  // Remove " :: Site Name" suffix
      /\s*•\s*[^•]*$/,                   // Remove " • Site Name" suffix
    ];

    for (const pattern of patterns) {
      const shortened = cleaned.replace(pattern, '');
      if (shortened.length >= 3 && shortened.length < cleaned.length) {
        cleaned = shortened.trim();
        break; // Only apply one pattern
      }
    }

    // Capitalize first letter if needed
    if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
      cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
    }

    // Limit length for UI purposes
    if (cleaned.length > 60) {
      cleaned = cleaned.substring(0, 57) + '...';
    }

    return cleaned;
  }

  /**
   * Generate user-friendly fallback title from URL
   */
  generateFallbackTitle(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;

      // Extract page name from path
      if (pathname && pathname !== '/') {
        const pathParts = pathname.split('/').filter(part => part.length > 0);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];

          // Convert URL-friendly names to readable titles
          const readable = lastPart
            .replace(/[-_]/g, ' ')           // Replace hyphens/underscores with spaces
            .replace(/\.(html?|php|jsp|asp)$/i, '') // Remove file extensions
            .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize words
            .trim();

          if (readable.length > 2) {
            return `${readable} - ${this.getReadableHostname(hostname)}`;
          }
        }
      }

      // Default fallback based on hostname
      return this.getReadableHostname(hostname);

    } catch (error) {
      return 'Web Page';
    }
  }

  /**
   * Convert hostname to readable format
   */
  getReadableHostname(hostname: string): string {
    // Remove www prefix
    const cleaned = hostname.replace(/^www\./, '');

    // Capitalize the domain name (before TLD)
    const parts = cleaned.split('.');
    if (parts.length >= 2) {
      const domain = parts[0];
      const tld = parts.slice(1).join('.');

      // Convert domain to readable format
      const readable = domain
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      return `${readable} (${tld})`;
    }

    return cleaned;
  }
}
