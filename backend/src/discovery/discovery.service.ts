import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SitemapParserService } from './sitemap-parser.service';
import { PageCrawlerService } from './page-crawler.service';
import axios from 'axios';
import * as https from 'https';

export interface DiscoveryProgress {
  status: 'pending' | 'discovering' | 'complete' | 'failed';
  phase: string;
  discoveredUrls: number;
  totalUrls: number;
  message: string;
}

export interface DiscoveredPage {
  url: string;
  title: string;
  pageType: string;
  requiresAuth: boolean;
  depth: number;
  screenshot?: string;      // Base64 thumbnail
  isAccessible?: boolean;   // HTTP 200-299 verification
}

export interface DiscoveryResult {
  projectId: string;
  pages: DiscoveredPage[];
  relationships: Array<{
    sourceUrl: string;
    targetUrl: string;
    linkText: string;
    linkType: string;
  }>;
  stats: {
    totalPages: number;
    pagesRequiringAuth: number;
    externalLinks: number;
    discoveryTime: number;
  };
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private discoveryProgress = new Map<string, DiscoveryProgress>();

  constructor(
    private prisma: PrismaService,
    private sitemapParser: SitemapParserService,
    private pageCrawler: PageCrawlerService,
  ) {}

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
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) !== null
      );
    } catch {
      return false;
    }
  }

  /**
   * Pre-flight check to verify URL is reachable
   * Returns true if reachable, throws descriptive error if not
   */
  private async checkUrlReachable(url: string): Promise<boolean> {
    const isLocal = this.isLocalAddress(url);

    try {
      const httpsAgent = isLocal
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined;

      await axios.head(url, {
        timeout: 10000,
        httpsAgent,
        validateStatus: (status) => status < 500, // Accept redirects and client errors
      });
      return true;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          `Cannot connect to ${url}. ${isLocal ? 'Make sure your local development server is running on the specified port.' : 'The server refused the connection.'}`,
          HttpStatus.BAD_REQUEST
        );
      }
      if (error.code === 'ENOTFOUND') {
        throw new HttpException(
          `Cannot resolve hostname for ${url}. Please check the URL is correct.`,
          HttpStatus.BAD_REQUEST
        );
      }
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        throw new HttpException(
          `Connection to ${url} timed out. ${isLocal ? 'Make sure your local server is responding.' : 'The server may be slow or unavailable.'}`,
          HttpStatus.REQUEST_TIMEOUT
        );
      }
      // Let other errors pass through - they might work with Playwright
      this.logger.warn(`Pre-flight check warning for ${url}: ${error.message}`);
      return true;
    }
  }

  /**
   * Start discovery for a project from a root URL
   */
  async startDiscovery(
    projectId: string,
    organizationId: string,
    rootUrl: string,
    options: {
      maxDepth?: number;
      maxPages?: number;
      useSitemap?: boolean;
    } = {},
  ): Promise<DiscoveryResult> {
    const { maxDepth = 3, maxPages = 100, useSitemap = true } = options;
    const startTime = Date.now();

    // Verify project belongs to organization
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    // Initialize progress
    this.updateProgress(projectId, {
      status: 'discovering',
      phase: 'initialization',
      discoveredUrls: 0,
      totalUrls: 0,
      message: 'Starting discovery...',
    });

    try {
      // Normalize root URL
      const baseUrl = this.normalizeBaseUrl(rootUrl);
      const baseDomain = new URL(baseUrl).hostname;
      const isLocal = this.isLocalAddress(baseUrl);

      // Pre-flight check: Verify the URL is reachable before starting discovery
      this.updateProgress(projectId, {
        status: 'discovering',
        phase: 'connectivity',
        discoveredUrls: 0,
        totalUrls: 0,
        message: isLocal ? 'Checking local server connectivity...' : 'Checking website connectivity...',
      });

      await this.checkUrlReachable(baseUrl);

      const discoveredPages: DiscoveredPage[] = [];
      const relationships: DiscoveryResult['relationships'] = [];
      const urlToId = new Map<string, string>();

      // Step 1: Try sitemap first
      if (useSitemap) {
        this.updateProgress(projectId, {
          status: 'discovering',
          phase: 'sitemap',
          discoveredUrls: 0,
          totalUrls: 0,
          message: 'Checking for sitemap...',
        });

        const sitemap = await this.sitemapParser.fetchSitemap(baseUrl);
        if (sitemap && sitemap.urls.length > 0) {
          this.logger.log(`Found sitemap with ${sitemap.urls.length} URLs`);

          // Filter to same domain and page URLs only
          let filteredUrls = this.sitemapParser.filterSameDomain(sitemap.urls, baseUrl);
          filteredUrls = this.sitemapParser.filterPageUrls(filteredUrls);

          // Limit to maxPages
          const limitedUrls = filteredUrls.slice(0, maxPages);

          for (const sitemapUrl of limitedUrls) {
            discoveredPages.push({
              url: sitemapUrl.loc,
              title: '', // Will be populated when crawling
              pageType: 'content',
              requiresAuth: false,
              depth: 1,
            });
          }

          this.updateProgress(projectId, {
            status: 'discovering',
            phase: 'sitemap',
            discoveredUrls: discoveredPages.length,
            totalUrls: filteredUrls.length,
            message: `Found ${discoveredPages.length} pages in sitemap`,
          });
        } else {
          // No sitemap found - inform user and proceed to crawling
          this.logger.log(`No sitemap found for ${baseUrl}, will crawl pages directly`);
          this.updateProgress(projectId, {
            status: 'discovering',
            phase: 'sitemap',
            discoveredUrls: 0,
            totalUrls: 0,
            message: 'No sitemap found, will discover pages by crawling links...',
          });
        }
      }

      // Step 2: Crawl pages to discover more URLs and relationships
      this.updateProgress(projectId, {
        status: 'discovering',
        phase: 'crawling',
        discoveredUrls: discoveredPages.length,
        totalUrls: maxPages,
        message: discoveredPages.length > 0
          ? `Crawling to find more pages (found ${discoveredPages.length} from sitemap)...`
          : 'Crawling website to discover pages...',
      });

      const crawlResults = await this.pageCrawler.crawlWithDepth(baseUrl, maxDepth, maxPages);

      // Process crawl results
      for (const [url, result] of crawlResults) {
        // Check if already in discovered pages
        const existing = discoveredPages.find(p => this.normalizeUrl(p.url) === this.normalizeUrl(url));
        if (existing) {
          existing.title = result.title;
          existing.pageType = result.pageType;
          existing.requiresAuth = result.requiresAuth;
          existing.screenshot = result.screenshot;
          existing.isAccessible = result.isAccessible;
        } else {
          discoveredPages.push({
            url,
            title: result.title,
            pageType: result.pageType,
            requiresAuth: result.requiresAuth,
            depth: 0, // Will be calculated
            screenshot: result.screenshot,
            isAccessible: result.isAccessible,
          });
        }

        // Process links for relationships
        for (const link of result.links) {
          if (link.linkType !== 'external') {
            relationships.push({
              sourceUrl: url,
              targetUrl: link.url,
              linkText: link.text,
              linkType: link.linkType,
            });
          }
        }
      }

      // Step 3: Save to database
      this.updateProgress(projectId, {
        status: 'discovering',
        phase: 'saving',
        discoveredUrls: discoveredPages.length,
        totalUrls: discoveredPages.length,
        message: 'Saving discovered pages...',
      });

      // Create or update ProjectUrls
      for (const page of discoveredPages) {
        const existingUrl = await this.prisma.projectUrl.findFirst({
          where: {
            projectId,
            url: page.url,
          },
        });

        if (existingUrl) {
          // Update existing URL with new data (screenshot, verification, etc.)
          await this.prisma.projectUrl.update({
            where: { id: existingUrl.id },
            data: {
              title: page.title || existingUrl.title,
              requiresAuth: page.requiresAuth,
              pageType: page.pageType,
              screenshot: page.screenshot || existingUrl.screenshot,
              verified: page.isAccessible ?? existingUrl.verified,
              lastVerified: page.isAccessible !== undefined ? new Date() : existingUrl.lastVerified,
            },
          });
          urlToId.set(page.url, existingUrl.id);
        } else {
          const newUrl = await this.prisma.projectUrl.create({
            data: {
              projectId,
              url: page.url,
              title: page.title || this.generateTitleFromUrl(page.url),
              discovered: true,
              discoveryDepth: page.depth,
              requiresAuth: page.requiresAuth,
              pageType: page.pageType,
              screenshot: page.screenshot,
              verified: page.isAccessible ?? false,
              lastVerified: page.isAccessible ? new Date() : null,
            },
          });
          urlToId.set(page.url, newUrl.id);
        }
      }

      // Create PageRelationships
      for (const rel of relationships) {
        const sourceId = urlToId.get(rel.sourceUrl);
        const targetId = urlToId.get(rel.targetUrl);

        if (sourceId && targetId && sourceId !== targetId) {
          try {
            await this.prisma.pageRelationship.upsert({
              where: {
                sourceUrlId_targetUrlId: {
                  sourceUrlId: sourceId,
                  targetUrlId: targetId,
                },
              },
              create: {
                projectId,
                sourceUrlId: sourceId,
                targetUrlId: targetId,
                linkText: rel.linkText,
                linkType: rel.linkType,
              },
              update: {
                linkText: rel.linkText,
                linkType: rel.linkType,
              },
            });
          } catch (error) {
            // Ignore duplicate errors
            this.logger.debug(`Relationship already exists: ${rel.sourceUrl} -> ${rel.targetUrl}`);
          }
        }
      }

      const discoveryTime = Date.now() - startTime;

      // Complete
      this.updateProgress(projectId, {
        status: 'complete',
        phase: 'complete',
        discoveredUrls: discoveredPages.length,
        totalUrls: discoveredPages.length,
        message: `Discovery complete! Found ${discoveredPages.length} pages in ${Math.round(discoveryTime / 1000)}s`,
      });

      return {
        projectId,
        pages: discoveredPages,
        relationships,
        stats: {
          totalPages: discoveredPages.length,
          pagesRequiringAuth: discoveredPages.filter(p => p.requiresAuth).length,
          externalLinks: relationships.filter(r => r.linkType === 'external').length,
          discoveryTime,
        },
      };
    } catch (error) {
      this.logger.error(`Discovery failed for project ${projectId}: ${error.message}`);
      this.updateProgress(projectId, {
        status: 'failed',
        phase: 'error',
        discoveredUrls: 0,
        totalUrls: 0,
        message: `Discovery failed: ${error.message}`,
      });

      // Preserve the original HTTP status if it's already an HttpException (e.g., 400 Bad Request)
      if (error instanceof HttpException) {
        throw error;
      }

      // Only wrap unknown errors as 500
      throw new HttpException(`Discovery failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get discovery progress for a project
   */
  getProgress(projectId: string): DiscoveryProgress | null {
    return this.discoveryProgress.get(projectId) || null;
  }

  /**
   * Get site map data for a project
   */
  async getSiteMap(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: {
        urls: {
          orderBy: { createdAt: 'asc' },
        },
        pageRelationships: true,
      },
    });

    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    // Transform to site map format
    const nodes = project.urls.map(url => ({
      id: url.id,
      url: url.url,
      title: url.title || 'Untitled',
      analyzed: url.analyzed,
      verified: url.verified,
      requiresAuth: url.requiresAuth,
      pageType: url.pageType,
      discovered: url.discovered,
      depth: url.discoveryDepth,
      screenshot: url.screenshot,  // Include thumbnail for sitemap display
    }));

    const edges = project.pageRelationships.map(rel => ({
      id: rel.id,
      source: rel.sourceUrlId,
      target: rel.targetUrlId,
      linkText: rel.linkText,
      linkType: rel.linkType,
    }));

    return { nodes, edges };
  }

  /**
   * Select specific pages for analysis
   */
  async selectPagesForAnalysis(
    projectId: string,
    organizationId: string,
    urlIds: string[],
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    // Mark selected URLs for analysis
    await this.prisma.projectUrl.updateMany({
      where: {
        id: { in: urlIds },
        projectId,
      },
      data: {
        // This could set a flag or trigger analysis
        // For now, just return the selected URLs
      },
    });

    return this.prisma.projectUrl.findMany({
      where: {
        id: { in: urlIds },
        projectId,
      },
    });
  }

  /**
   * Update discovery progress
   */
  private updateProgress(projectId: string, progress: DiscoveryProgress) {
    this.discoveryProgress.set(projectId, progress);
    this.logger.log(`Discovery progress [${projectId}]: ${progress.phase} - ${progress.message}`);
  }

  /**
   * Normalize base URL
   */
  private normalizeBaseUrl(url: string): string {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  }

  /**
   * Generate a readable title from URL path
   */
  private generateTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/').filter(part => part.length > 0);

      if (pathParts.length === 0) {
        // Homepage - use domain name
        return this.formatDomainAsTitle(parsed.hostname);
      }

      // Get the last meaningful part of the path
      const lastPart = pathParts[pathParts.length - 1];

      // Remove file extensions
      const nameWithoutExt = lastPart.replace(/\.(html?|php|aspx?|jsp)$/i, '');

      // Convert dashes/underscores to spaces and capitalize
      const readable = nameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase to spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      return readable || 'Page';
    } catch {
      return 'Page';
    }
  }

  /**
   * Format domain name as readable title
   */
  private formatDomainAsTitle(hostname: string): string {
    const withoutWww = hostname.replace(/^www\./, '');
    const parts = withoutWww.split('.');
    const name = parts[0] || 'Home';
    return name.charAt(0).toUpperCase() + name.slice(1) + ' Homepage';
  }

  /**
   * Normalize URL for smart deduplication
   * Must match the logic in PageCrawlerService for consistency
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // 1. Remove hash/anchor fragments
      parsed.hash = '';

      // 2. Normalize localhost variations
      let host = parsed.host;
      if (parsed.hostname === '127.0.0.1') {
        const port = parsed.port || '';
        host = `localhost${port ? ':' + port : ''}`;
      }

      // 3. Remove www prefix
      host = host.replace(/^www\./, '');

      // 4. Normalize path
      let path = parsed.pathname.replace(/\/+$/, '') || '/';
      path = path.toLowerCase();

      // 5. Remove tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source',
        'gclid', 'gclsrc', 'dclid',
        'ref', 'source', 'campaign', 'via', 'affiliate',
        'mc_cid', 'mc_eid', 'msclkid', '_ga', '_gl',
        'trk', 'trkid', 'tracking', 'click_id', 'clickid',
        'sessionid', 'session', 'sid',
      ];

      trackingParams.forEach(param => parsed.searchParams.delete(param));

      // 6. Sort remaining params
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
}
