import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SitemapParserService } from './sitemap-parser.service';
import { PageCrawlerService } from './page-crawler.service';
import { LoginFlow } from '../ai/interfaces/element.interface';
import { normalizeUrlForDocker } from '../utils/docker-url.utils';
import axios from 'axios';
import * as https from 'https';

export interface DiscoveryProgress {
  status: 'pending' | 'discovering' | 'complete' | 'failed';
  phase: string;
  discoveredUrls: number;
  totalUrls: number;
  message: string;
  urls?: string[];  // List of discovered URLs for live progress display
  currentUrl?: string;  // Currently being crawled
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
   * Translate localhost URLs to Docker-accessible addresses when running in Docker
   */
  private translateLocalhostForDocker(url: string): string {
    const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
    if (!isDocker) return url;

    const translated = normalizeUrlForDocker(url);
    if (translated !== url) {
      this.logger.log(`Translated localhost URL for Docker: ${url} → ${translated}`);
    }
    return translated;
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
          `Can't reach ${url}. ${isLocal ? 'Make sure your app is running on this port.' : 'The server refused the connection.'}`,
          HttpStatus.BAD_REQUEST
        );
      }
      if (error.code === 'ENOTFOUND') {
        throw new HttpException(
          `Can't find ${url}. Please check the URL is spelled correctly.`,
          HttpStatus.BAD_REQUEST
        );
      }
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        throw new HttpException(
          `Connection to ${url} timed out. ${isLocal ? 'Make sure your app is responding.' : 'The server may be slow or unavailable.'}`,
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
   * @param authFlowId - Optional auth flow ID to use for discovering protected pages
   */
  async startDiscovery(
    projectId: string,
    organizationId: string,
    rootUrl: string,
    options: {
      maxDepth?: number;
      maxPages?: number;
      useSitemap?: boolean;
      authFlowId?: string;
    } = {},
  ): Promise<DiscoveryResult> {
    const { maxDepth = 3, maxPages = 100, useSitemap = true, authFlowId } = options;
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
      // Translate localhost to Docker-accessible address if running in Docker
      const translatedRootUrl = this.translateLocalhostForDocker(rootUrl);

      // Normalize root URL
      const baseUrl = this.normalizeBaseUrl(translatedRootUrl);
      const baseDomain = new URL(baseUrl).hostname;
      const isLocal = this.isLocalAddress(baseUrl);

      this.logger.log(`Discovery starting: rootUrl=${rootUrl}, translatedUrl=${translatedRootUrl}, baseUrl=${baseUrl}, baseDomain=${baseDomain}, isLocal=${isLocal}`);

      // Pre-flight check: Verify the URL is reachable before starting discovery
      this.updateProgress(projectId, {
        status: 'discovering',
        phase: 'connectivity',
        discoveredUrls: 0,
        totalUrls: 0,
        message: isLocal ? 'Checking if your local server is reachable...' : 'Checking if the website is reachable...',
      });

      await this.checkUrlReachable(baseUrl);

      // Fetch auth flow if provided - enables discovering protected pages
      let authFlow: LoginFlow | undefined;
      if (authFlowId) {
        this.logger.log(`Using auth flow ${authFlowId} for authenticated discovery`);
        this.updateProgress(projectId, {
          status: 'discovering',
          phase: 'authentication',
          discoveredUrls: 0,
          totalUrls: 0,
          message: 'Loading authentication configuration...',
        });

        const authFlowRecord = await this.prisma.authFlow.findFirst({
          where: { id: authFlowId, projectId },
        });

        if (authFlowRecord) {
          // Transform database record to LoginFlow interface
          // Using unknown as intermediate type for JSON fields from Prisma
          authFlow = {
            id: authFlowRecord.id,
            name: authFlowRecord.name,
            loginUrl: this.translateLocalhostForDocker(authFlowRecord.loginUrl),
            steps: authFlowRecord.steps as unknown as LoginFlow['steps'],
            credentials: authFlowRecord.credentials as unknown as LoginFlow['credentials'],
            useAutoDetection: authFlowRecord.useAutoDetection,
            manualSelectors: authFlowRecord.manualSelectors as unknown as LoginFlow['manualSelectors'],
          };
          this.logger.log(`Auth flow loaded: ${authFlow.name} (login URL: ${authFlow.loginUrl})`);
        } else {
          throw new HttpException(
            `Authentication flow not found. The selected auth flow may have been deleted. Please select a different one or discover without authentication.`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const discoveredPages: DiscoveredPage[] = [];
      const relationships: DiscoveryResult['relationships'] = [];
      const urlToId = new Map<string, string>();

      // Add login page to discovered pages when auth is configured
      if (authFlow) {
        discoveredPages.push({
          url: authFlow.loginUrl,
          title: 'Login Page',
          pageType: 'login',
          requiresAuth: false,
          depth: 0,
        });
        this.logger.log(`Added login page to discovered pages: ${authFlow.loginUrl}`);
      }

      // Step 1: Try sitemap first
      if (useSitemap) {
        this.updateProgress(projectId, {
          status: 'discovering',
          phase: 'sitemap',
          discoveredUrls: 0,
          totalUrls: 0,
          message: 'Looking for a sitemap...',
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
            urls: discoveredPages.map(p => p.url),
          });
        } else {
          // No sitemap found - inform user and proceed to crawling
          this.logger.log(`No sitemap found for ${baseUrl}, will crawl pages directly`);
          this.updateProgress(projectId, {
            status: 'discovering',
            phase: 'sitemap',
            discoveredUrls: 0,
            totalUrls: 0,
            message: 'No sitemap found — will discover pages by following links',
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
        urls: discoveredPages.map(p => p.url),
        currentUrl: baseUrl,
      });

      const crawlResults = await this.pageCrawler.crawlWithDepth(
        baseUrl,
        maxDepth,
        maxPages,
        authFlow,
        // Progress callback — updates progress on every page crawled
        (crawled, total, currentUrl) => {
          const totalFound = discoveredPages.length + crawled;
          this.updateProgress(projectId, {
            status: 'discovering',
            phase: 'crawling',
            discoveredUrls: totalFound,
            totalUrls: Math.max(totalFound + (total - crawled), maxPages),
            message: `Crawling page ${crawled} — found ${totalFound} pages so far`,
            urls: [...discoveredPages.map(p => p.url)],
            currentUrl,
          });
        },
      );

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

      // Update progress with all discovered URLs after crawling
      this.updateProgress(projectId, {
        status: 'discovering',
        phase: 'processing',
        discoveredUrls: discoveredPages.length,
        totalUrls: discoveredPages.length,
        message: `Processing ${discoveredPages.length} discovered pages...`,
        urls: discoveredPages.map(p => p.url),
      });

      // Step 3: Save to database
      this.updateProgress(projectId, {
        status: 'discovering',
        phase: 'saving',
        discoveredUrls: discoveredPages.length,
        totalUrls: discoveredPages.length,
        message: 'Saving discovered pages...',
        urls: discoveredPages.map(p => p.url),
      });

      // Create or update ProjectUrls — batch lookup then parallel upserts
      const existingUrls = await this.prisma.projectUrl.findMany({
        where: { projectId, url: { in: discoveredPages.map(p => p.url) } },
      });
      const existingUrlMap = new Map(existingUrls.map(u => [u.url, u]));

      const toCreate: typeof discoveredPages = [];
      const toUpdate: Array<{ id: string; page: DiscoveredPage; existing: typeof existingUrls[0] }> = [];

      for (const page of discoveredPages) {
        const existing = existingUrlMap.get(page.url);
        if (existing) {
          toUpdate.push({ id: existing.id, page, existing });
          urlToId.set(page.url, existing.id);
        } else {
          toCreate.push(page);
        }
      }

      // Batch create new URLs
      if (toCreate.length > 0) {
        await this.prisma.projectUrl.createMany({
          data: toCreate.map(page => ({
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
          })),
          skipDuplicates: true,
        });
        // Fetch the created IDs
        const created = await this.prisma.projectUrl.findMany({
          where: { projectId, url: { in: toCreate.map(p => p.url) } },
          select: { id: true, url: true },
        });
        created.forEach(c => urlToId.set(c.url, c.id));
      }

      // Parallel update existing URLs
      if (toUpdate.length > 0) {
        await Promise.all(toUpdate.map(({ id, page, existing }) =>
          this.prisma.projectUrl.update({
            where: { id },
            data: {
              title: page.title || existing.title,
              requiresAuth: page.requiresAuth,
              pageType: page.pageType,
              screenshot: page.screenshot || existing.screenshot,
              verified: page.isAccessible ?? existing.verified,
              lastVerified: page.isAccessible !== undefined ? new Date() : existing.lastVerified,
            },
          })
        ));
      }

      // Create PageRelationships — parallel upserts
      const validRelationships = relationships
        .map(rel => {
          const normalizedSource = this.normalizeUrl(rel.sourceUrl);
          const normalizedTarget = this.normalizeUrl(rel.targetUrl);
          const sourceId = urlToId.get(normalizedSource) || urlToId.get(rel.sourceUrl);
          const targetId = urlToId.get(normalizedTarget) || urlToId.get(rel.targetUrl);
          return { ...rel, sourceId, targetId };
        })
        .filter(rel => rel.sourceId && rel.targetId && rel.sourceId !== rel.targetId);

      // Process in batches of 20 to avoid overwhelming the DB
      const BATCH_SIZE = 20;
      for (let i = 0; i < validRelationships.length; i += BATCH_SIZE) {
        const batch = validRelationships.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(rel =>
          this.prisma.pageRelationship.upsert({
            where: {
              sourceUrlId_targetUrlId: {
                sourceUrlId: rel.sourceId!,
                targetUrlId: rel.targetId!,
              },
            },
            create: {
              projectId,
              sourceUrlId: rel.sourceId!,
              targetUrlId: rel.targetId!,
              linkText: rel.linkText,
              linkType: rel.linkType,
            },
            update: {
              linkText: rel.linkText,
              linkType: rel.linkType,
            },
          }).catch(() => {
            // Ignore duplicate errors
          })
        ));
      }

      const discoveryTime = Date.now() - startTime;

      // Complete - include all discovered URLs in final state
      this.updateProgress(projectId, {
        status: 'complete',
        phase: 'complete',
        discoveredUrls: discoveredPages.length,
        totalUrls: discoveredPages.length,
        message: `Done! Found ${discoveredPages.length} pages in ${Math.round(discoveryTime / 1000)}s`,
        urls: discoveredPages.map(p => p.url),
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

      // 2. Normalize localhost variations (localhost = 127.0.0.1 = host.docker.internal)
      let host = parsed.host;
      if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'host.docker.internal') {
        const port = parsed.port || '';
        host = `localhost${port ? ':' + port : ''}`;
      }

      // 3. Remove www prefix
      host = host.replace(/^www\./, '');

      // 4. Normalize path - remove trailing slashes, index files, lowercase
      let path = parsed.pathname.replace(/\/+$/, '') || '/';
      path = path.replace(/\/(index|default)\.(html?|php|aspx?|jsp)$/i, '');
      path = path.toLowerCase() || '/';

      // 5. Remove tracking parameters (only safe-to-remove ones)
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source',
        'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
        'msclkid', 'twclid',
        'mc_cid', 'mc_eid', '_ga', '_gl',
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
