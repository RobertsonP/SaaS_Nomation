import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';
import * as xml2js from 'xml2js';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

interface ParsedSitemap {
  urls: SitemapUrl[];
  sitemapIndexUrls?: string[]; // For sitemap index files
}

@Injectable()
export class SitemapParserService {
  private readonly logger = new Logger(SitemapParserService.name);

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
   * Try to fetch and parse sitemap.xml from a domain
   * For localhost, skip sitemap and return null (most dev servers don't have sitemap.xml)
   */
  async fetchSitemap(baseUrl: string): Promise<ParsedSitemap | null> {
    const isLocal = this.isLocalAddress(baseUrl);

    // Skip sitemap for localhost - most local dev servers don't have one
    if (isLocal) {
      this.logger.log(`Skipping sitemap for localhost URL: ${baseUrl}`);
      return null;
    }

    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        this.logger.log(`Trying to fetch sitemap from: ${sitemapUrl}`);
        const result = await this.parseSitemapUrl(sitemapUrl);
        if (result && result.urls.length > 0) {
          this.logger.log(`Found sitemap with ${result.urls.length} URLs`);
          return result;
        }
      } catch (error) {
        this.logger.debug(`No sitemap at ${sitemapUrl}: ${error.message}`);
      }
    }

    // Try robots.txt for sitemap location
    try {
      const robotsTxt = await this.fetchRobotsTxt(baseUrl);
      const sitemapFromRobots = this.extractSitemapFromRobots(robotsTxt);
      if (sitemapFromRobots) {
        this.logger.log(`Found sitemap URL in robots.txt: ${sitemapFromRobots}`);
        return await this.parseSitemapUrl(sitemapFromRobots);
      }
    } catch (error) {
      this.logger.debug(`No robots.txt or sitemap reference: ${error.message}`);
    }

    return null;
  }

  /**
   * Parse a specific sitemap URL
   */
  async parseSitemapUrl(url: string): Promise<ParsedSitemap> {
    const isLocal = this.isLocalAddress(url);

    // Create HTTPS agent that ignores SSL errors for localhost
    const httpsAgent = isLocal
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;

    const response = await axios.get(url, {
      timeout: 15000,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/xml, text/xml, */*',
      },
    });

    const xml = response.data;
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);

    // Check if it's a sitemap index
    if (result.sitemapindex) {
      const sitemaps = Array.isArray(result.sitemapindex.sitemap)
        ? result.sitemapindex.sitemap
        : [result.sitemapindex.sitemap];

      const sitemapIndexUrls = sitemaps
        .filter(s => s && s.loc)
        .map(s => s.loc);

      // Recursively fetch all child sitemaps
      const allUrls: SitemapUrl[] = [];
      for (const childUrl of sitemapIndexUrls) {
        try {
          const childResult = await this.parseSitemapUrl(childUrl);
          allUrls.push(...childResult.urls);
        } catch (error) {
          this.logger.warn(`Failed to parse child sitemap ${childUrl}: ${error.message}`);
        }
      }

      return { urls: allUrls, sitemapIndexUrls };
    }

    // Regular sitemap
    if (result.urlset && result.urlset.url) {
      const urls = Array.isArray(result.urlset.url)
        ? result.urlset.url
        : [result.urlset.url];

      return {
        urls: urls.map(u => ({
          loc: u.loc,
          lastmod: u.lastmod,
          changefreq: u.changefreq,
          priority: u.priority,
        })),
      };
    }

    return { urls: [] };
  }

  /**
   * Fetch robots.txt
   */
  private async fetchRobotsTxt(baseUrl: string): Promise<string> {
    const response = await axios.get(`${baseUrl}/robots.txt`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    return response.data;
  }

  /**
   * Extract sitemap URL from robots.txt
   */
  private extractSitemapFromRobots(robotsTxt: string): string | null {
    const lines = robotsTxt.split('\n');
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith('sitemap:')) {
        return line.trim().substring(8).trim();
      }
    }
    return null;
  }

  /**
   * Filter URLs to only include pages from the same domain
   */
  /**
   * Normalize domain for comparison — localhost, 127.0.0.1 and host.docker.internal are equivalent
   */
  private normalizeDomain(domain: string): string {
    const d = domain.toLowerCase();
    if (d === '127.0.0.1' || d === 'host.docker.internal') return 'localhost';
    return d;
  }

  filterSameDomain(urls: SitemapUrl[], baseUrl: string): SitemapUrl[] {
    const baseDomain = this.normalizeDomain(new URL(baseUrl).hostname);
    return urls.filter(u => {
      try {
        const urlDomain = this.normalizeDomain(new URL(u.loc).hostname);
        return urlDomain === baseDomain || urlDomain.endsWith(`.${baseDomain}`);
      } catch {
        return false;
      }
    });
  }

  /**
   * Filter out non-page URLs (images, PDFs, etc.)
   */
  filterPageUrls(urls: SitemapUrl[]): SitemapUrl[] {
    const nonPageExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff',
      // Documents
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods',
      // Archives
      '.zip', '.rar', '.tar', '.gz', '.7z',
      // Media
      '.mp4', '.mp3', '.avi', '.mov', '.wmv', '.flv', '.wav', '.ogg', '.webm',
      // Resources
      '.css', '.js', '.json', '.xml', '.rss', '.atom',
      // Fonts
      '.woff', '.woff2', '.ttf', '.eot',
    ];
    return urls.filter(u => {
      const path = new URL(u.loc).pathname.toLowerCase();
      return !nonPageExtensions.some(ext => path.endsWith(ext));
    });
  }
}
