import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param, HttpException, HttpStatus, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { ProjectsService } from './projects.service';
import { ProjectElementsService } from './project-elements.service';
import { ProjectAnalysisService } from './project-analysis.service';
import { SelectorValidationService } from './selector-validation.service';
import { LiveExecutionService } from './live-execution.service';
import { TestStep } from '../common/types/execution.types';

export class CreateProjectDto {
  name: string;
  description?: string;
  urls: Array<{ url: string; title?: string; description?: string }>;
  organizationId: string;
}

export class UpdateProjectDto {
  name?: string;
  description?: string;
  urls?: Array<{ url: string; title?: string; description?: string }>;
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private projectElementsService: ProjectElementsService,
    private projectAnalysisService: ProjectAnalysisService,
    private selectorValidationService: SelectorValidationService,
    private liveExecutionService: LiveExecutionService,
  ) {}

  // ==================== CORE CRUD ====================

  @Get()
  @UseGuards(OrganizationGuard)
  async getProjects(@Request() req, @Query('organizationId') organizationId: string) {
    // Pass userId as fallback for legacy projects without organizationId
    return this.projectsService.findByOrganization(req.organization.id, req.user.id);
  }

  @Get(':id')
  @UseGuards(OrganizationGuard)
  async getProject(@Request() req, @Param('id') id: string) {
    return this.projectsService.findById(req.organization.id, id);
  }

  @Post()
  @UseGuards(OrganizationGuard)
  async createProject(@Request() req, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, req.organization.id, createProjectDto);
  }

  @Put(':id')
  @UseGuards(OrganizationGuard)
  async updateProject(@Request() req, @Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(req.organization.id, id, updateProjectDto);
  }

  @Delete(':id')
  @UseGuards(OrganizationGuard)
  async deleteProject(@Request() req, @Param('id') id: string) {
    return this.projectsService.delete(req.organization.id, id);
  }

  // ==================== ANALYSIS ====================

  @Post(':id/analyze')
  @UseGuards(OrganizationGuard)
  async analyzeProject(@Request() req, @Param('id') id: string, @Body() body: { urlIds?: string[]; organizationId: string }) {
    return this.projectAnalysisService.analyzeProjectPages(req.organization.id, id, body.urlIds);
  }

  @Get(':id/analysis-metrics')
  @UseGuards(OrganizationGuard)
  async getAnalysisMetrics(@Request() req, @Param('id') id: string) {
    return this.projectAnalysisService.getAnalysisMetrics(req.organization.id, id);
  }

  @Get(':id/analysis-history')
  @UseGuards(OrganizationGuard)
  async getAnalysisHistory(@Request() req, @Param('id') id: string) {
    return this.projectAnalysisService.getAnalysisHistory(req.organization.id, id);
  }

  @Post('import-github')
  @UseGuards(OrganizationGuard)
  async importFromGitHub(@Request() req, @Body() body: { repoUrl: string; token?: string; organizationId: string }) {
    return this.projectAnalysisService.analyzeGitHubRepo(req.user.id, req.organization.id, body.repoUrl, body.token);
  }

  @Get(':id/test-stats')
  @UseGuards(OrganizationGuard)
  async getTestStats(@Request() req, @Param('id') id: string) {
    const stats = await this.projectsService.getTestStats(req.organization.id, id);
    if (!stats) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }
    return stats;
  }

  // ==================== ELEMENTS ====================

  @Get(':id/elements')
  @UseGuards(OrganizationGuard)
  async getProjectElements(@Request() req, @Param('id') id: string) {
    return this.projectElementsService.getProjectElements(req.organization.id, id);
  }

  @Post(':id/elements')
  @UseGuards(OrganizationGuard)
  async createProjectElements(
    @Request() req,
    @Param('id') id: string,
    @Body() body: {
      elements: Array<{
        selector: string;
        elementType: string;
        description: string;
        confidence?: number;
        attributes?: Record<string, unknown>;
        category?: string;
        source?: string;
        screenshot?: string;
      }>
    }
  ) {
    return this.projectElementsService.createProjectElements(req.organization.id, id, body.elements);
  }

  @Delete(':id/elements')
  @UseGuards(OrganizationGuard)
  async clearProjectElements(@Request() req, @Param('id') id: string) {
    return this.projectElementsService.clearProjectElements(req.organization.id, id);
  }

  @Post(':id/element/:elementId/screenshot')
  @UseGuards(OrganizationGuard)
  async captureElementScreenshot(
    @Request() req,
    @Param('id') id: string,
    @Param('elementId') elementId: string,
    @Body() body: { selector: string; url: string }
  ) {
    return this.projectElementsService.captureElementScreenshot(req.organization.id, id, elementId, body.selector, body.url);
  }

  @Post(':id/hunt-elements')
  @UseGuards(OrganizationGuard)
  async huntNewElements(
    @Request() req,
    @Param('id') id: string,
    @Body() body: {
      steps: TestStep[];
      testId: string
    }
  ) {
    return this.projectElementsService.huntNewElements(req.organization.id, id, body);
  }

  // ==================== SELECTOR VALIDATION ====================

  @Post(':id/validate-selector')
  @UseGuards(OrganizationGuard)
  async validateSelector(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { selector: string; organizationId: string }
  ) {
    return this.selectorValidationService.validateProjectSelector(req.organization.id, id, body.selector);
  }

  @Post(':id/validate-selector-cross-page')
  @UseGuards(OrganizationGuard)
  async validateSelectorCrossPage(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { selector: string; organizationId: string }
  ) {
    return this.selectorValidationService.validateSelectorAcrossProject(req.organization.id, id, body.selector);
  }

  @Post(':id/heal-selector')
  @UseGuards(OrganizationGuard)
  async healSelector(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { failedSelector: string; url?: string }
  ) {
    return this.selectorValidationService.healSelector(req.organization.id, id, body);
  }

  // ==================== LIVE EXECUTION ====================

  @Post(':id/test-auth')
  @UseGuards(OrganizationGuard)
  async testProjectAuthFlow(@Request() req, @Param('id') id: string) {
    return this.liveExecutionService.testProjectAuthFlow(req.organization.id, id);
  }

  @Post(':id/live-execute-step')
  @UseGuards(OrganizationGuard)
  async liveExecuteStep(
    @Request() req,
    @Param('id') id: string,
    @Body() body: {
      step: {
        type: string;
        selector: string;
        value?: string;
        description?: string;
      };
      startingUrl: string;
      tempExecutionId: string;
      streamingSessionId?: string
    }
  ) {
    return this.liveExecutionService.liveExecuteStep(req.organization.id, id, body);
  }

  @Post('urls/:urlId/verify')
  @UseGuards(OrganizationGuard)
  async verifyUrl(@Request() req, @Param('urlId') urlId: string) {
    return this.liveExecutionService.verifyUrl(req.organization.id, urlId);
  }
}
