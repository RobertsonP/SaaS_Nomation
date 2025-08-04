import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';

export class CreateProjectDto {
  name: string;
  description?: string;
  urls: Array<{url: string; title?: string; description?: string}>;
}

export class UpdateProjectDto {
  name?: string;
  description?: string;
  urls?: Array<{url: string; title?: string; description?: string}>;
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  async getProjects(@Request() req) {
    return this.projectsService.findByUser(req.user.id);
  }

  @Get(':id')
  async getProject(@Request() req, @Param('id') id: string) {
    return this.projectsService.findById(req.user.id, id);
  }

  @Post()
  async createProject(@Request() req, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, createProjectDto);
  }

  @Put(':id')
  async updateProject(@Request() req, @Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(req.user.id, id, updateProjectDto);
  }

  @Post(':id/analyze')
  async analyzeProject(@Request() req, @Param('id') id: string) {
    return this.projectsService.analyzeProjectPages(req.user.id, id);
  }

  @Get(':id/elements')
  async getProjectElements(@Request() req, @Param('id') id: string) {
    return this.projectsService.getProjectElements(req.user.id, id);
  }

  @Post(':id/validate-selector')
  async validateSelector(
    @Request() req, 
    @Param('id') id: string,
    @Body() body: { selector: string }
  ) {
    return this.projectsService.validateProjectSelector(req.user.id, id, body.selector);
  }

  @Post(':id/validate-selector-cross-page')
  async validateSelectorCrossPage(
    @Request() req, 
    @Param('id') id: string,
    @Body() body: { selector: string }
  ) {
    return this.projectsService.validateSelectorAcrossProject(req.user.id, id, body.selector);
  }

  @Post(':id/element/:elementId/screenshot')
  async captureElementScreenshot(
    @Request() req, 
    @Param('id') id: string,
    @Param('elementId') elementId: string,
    @Body() body: { selector: string; url: string }
  ) {
    return this.projectsService.captureElementScreenshot(req.user.id, id, elementId, body.selector, body.url);
  }

  @Get(':id/analysis-metrics')
  async getAnalysisMetrics(@Request() req, @Param('id') id: string) {
    return this.projectsService.getAnalysisMetrics(req.user.id, id);
  }

  @Get(':id/analysis-history')
  async getAnalysisHistory(@Request() req, @Param('id') id: string) {
    return this.projectsService.getAnalysisHistory(req.user.id, id);
  }

  @Post(':id/test-auth')
  async testProjectAuthFlow(@Request() req, @Param('id') id: string) {
    return this.projectsService.testProjectAuthFlow(req.user.id, id);
  }

  @Delete(':id/elements')
  async clearProjectElements(@Request() req, @Param('id') id: string) {
    return this.projectsService.clearProjectElements(req.user.id, id);
  }

  @Delete(':id')
  async deleteProject(@Request() req, @Param('id') id: string) {
    return this.projectsService.delete(req.user.id, id);
  }
}