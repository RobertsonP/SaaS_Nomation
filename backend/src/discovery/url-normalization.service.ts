import { Injectable } from '@nestjs/common';

@Injectable()
export class UrlNormalizationService {
  /**
   * Normalize URL for smart deduplication
   * Removes tracking params, hash fragments, normalizes localhost, etc.
   */
  normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // 1. Remove hash/anchor fragments (#section)
      parsed.hash = '';

      // 2. Normalize localhost variations (localhost = 127.0.0.1 = host.docker.internal)
      let host = parsed.host;
      if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'host.docker.internal') {
        // Replace 127.0.0.1/host.docker.internal with localhost but keep the port
        const port = parsed.port || '';
        host = `localhost${port ? ':' + port : ''}`;
      }

      // 3. Remove www prefix for comparison
      host = host.replace(/^www\./, '');

      // 4. Normalize path - remove trailing slashes, index files, lowercase
      let path = parsed.pathname.replace(/\/+$/, '') || '/';
      path = path.replace(/\/(index|default)\.(html?|php|aspx?|jsp)$/i, '');
      path = path.toLowerCase() || '/';

      // 5. Remove tracking/marketing parameters (only safe-to-remove ones)
      const trackingParams = [
        // UTM parameters (always tracking-only)
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        // Platform click IDs (always tracking-only)
        'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source',
        'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
        'msclkid', 'twclid',
        'mc_cid', 'mc_eid',  // Mailchimp
        '_ga', '_gl',  // Google Analytics
        'trk', 'trkid', 'tracking',
        'click_id', 'clickid',
        // Session params (not content-affecting)
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
   * Check if URL points to an HTML page (not an image, PDF, or other resource)
   * Task 1.4: Filter non-HTML URLs from discovery
   */
  isPageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();

      // List of non-page extensions to filter out
      const nonPageExtensions = [
        // Images
        '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff',
        // Documents
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods',
        // Archives
        '.zip', '.rar', '.tar', '.gz', '.7z',
        // Media
        '.mp4', '.mp3', '.avi', '.mov', '.wmv', '.flv', '.wav', '.ogg', '.webm',
        // Other resources
        '.css', '.js', '.json', '.xml', '.rss', '.atom',
        '.woff', '.woff2', '.ttf', '.eot', // Fonts
      ];

      return !nonPageExtensions.some(ext => path.endsWith(ext));
    } catch {
      return true; // If URL parsing fails, assume it's a page
    }
  }

  /**
   * Generate a readable title from URL path
   */
  generateTitleFromUrl(url: string): string {
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

  /**
   * Detect if a navigation resulted in a redirect to the login page.
   * Compares the requested URL to the final URL after navigation.
   *
   * @param requestedUrl - The URL that was originally requested
   * @param finalUrl - The URL after navigation completed
   * @param authLoginUrl - The known login URL from the auth flow (if any)
   */
  isLoginRedirect(requestedUrl: string, finalUrl: string, authLoginUrl: string | null): boolean {
    try {
      const requested = new URL(requestedUrl);
      const final_ = new URL(finalUrl);

      // If we ended up on the same URL, no redirect happened
      if (requested.pathname === final_.pathname && requested.hostname === final_.hostname) {
        return false;
      }

      // Check if the final URL matches the known login URL
      if (authLoginUrl) {
        try {
          const loginUrl = new URL(authLoginUrl);
          if (final_.pathname === loginUrl.pathname && final_.hostname === loginUrl.hostname) {
            return true;
          }
        } catch {
          // Invalid login URL, skip this check
        }
      }

      // Check if the final URL looks like a login page
      const loginPatterns = ['/login', '/signin', '/sign-in', '/auth', '/authenticate', '/sso', '/cas/login'];
      const finalPath = final_.pathname.toLowerCase();
      return loginPatterns.some(pattern => finalPath.includes(pattern));
    } catch {
      return false;
    }
  }
}
