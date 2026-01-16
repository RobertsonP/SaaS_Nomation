import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { DiscoveryService } from './discovery.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  /**
   * Start URL discovery for a project
   * POST /api/projects/:id/discover
   */
  @Post(':id/discover')
  @UseGuards(OrganizationGuard)
  async startDiscovery(
    @Request() req,
    @Param('id') projectId: string,
    @Body() body: {
      rootUrl: string;
      maxDepth?: number;
      maxPages?: number;
      useSitemap?: boolean;
    },
  ) {
    return this.discoveryService.startDiscovery(
      projectId,
      req.organization.id,
      body.rootUrl,
      {
        maxDepth: body.maxDepth,
        maxPages: body.maxPages,
        useSitemap: body.useSitemap,
      },
    );
  }

  /**
   * Get discovery progress for a project
   * GET /api/projects/:id/discover/progress
   */
  @Get(':id/discover/progress')
  @UseGuards(OrganizationGuard)
  async getDiscoveryProgress(@Param('id') projectId: string) {
    const progress = this.discoveryService.getProgress(projectId);
    return progress || {
      status: 'idle',
      phase: 'none',
      discoveredUrls: 0,
      totalUrls: 0,
      message: 'No discovery in progress',
    };
  }

  /**
   * Get site map structure for a project
   * GET /api/projects/:id/sitemap
   */
  @Get(':id/sitemap')
  @UseGuards(OrganizationGuard)
  async getSiteMap(@Request() req, @Param('id') projectId: string) {
    return this.discoveryService.getSiteMap(projectId, req.organization.id);
  }

  /**
   * Select pages for analysis
   * POST /api/projects/:id/select-pages
   */
  @Post(':id/select-pages')
  @UseGuards(OrganizationGuard)
  async selectPages(
    @Request() req,
    @Param('id') projectId: string,
    @Body() body: { urlIds: string[] },
  ) {
    return this.discoveryService.selectPagesForAnalysis(
      projectId,
      req.organization.id,
      body.urlIds,
    );
  }
}
