import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param, HttpException, HttpStatus } from '@nestjs/common';
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

  @Post(':id/elements')
  async createProjectElements(
    @Request() req, 
    @Param('id') id: string,
    @Body() body: { elements: any[] }
  ) {
    return this.projectsService.createProjectElements(req.user.id, id, body.elements);
  }

  @Delete(':id/elements')
  async clearProjectElements(@Request() req, @Param('id') id: string) {
    return this.projectsService.clearProjectElements(req.user.id, id);
  }

  @Post(':id/hunt-elements')
  async huntNewElements(
    @Request() req, 
    @Param('id') id: string,
    @Body() body: { steps: any[], testId: string }
  ) {
    return this.projectsService.huntNewElements(req.user.id, id, body);
  }

  @Post(':id/live-execute-step')
  async liveExecuteStep(
    @Request() req, 
    @Param('id') id: string,
    @Body() body: { step: any, startingUrl: string, tempExecutionId: string, streamingSessionId?: string }
  ) {
    return this.projectsService.liveExecuteStep(req.user.id, id, body);
  }

  @Post('analyze-folder')
  async analyzeProjectFolder(
    @Request() req,
    @Body() body: { 
      files: Array<{
        name: string;
        path: string;
        size: number;
        type: string;
        content: string;
      }> 
    }
  ) {
    const startTime = Date.now();
    const totalSize = body.files.reduce((sum, file) => sum + file.size, 0);
    const sizeMB = Math.round(totalSize / (1024 * 1024));
    const fileCount = body.files.length;
    
    console.log(`🔍 Enterprise project analysis started: ${sizeMB}MB, ${fileCount} files`);
    
    // ENTERPRISE SIZE VALIDATION - Support all project types
    if (totalSize > 1024 * 1024 * 1024) { // 1GB limit
      throw new HttpException(
        `Enterprise project size (${sizeMB}MB, ${fileCount} files) exceeds 1GB processing limit. 
         
         This could be a:
         • Large Django project with media files
         • Enterprise C#/.NET solution  
         • Java Spring monolith application
         • PHP Laravel with extensive assets
         • React/Angular with large node_modules
         • Any enterprise-scale application
         
         Contact support for custom enterprise solutions.`,
        HttpStatus.PAYLOAD_TOO_LARGE
      );
    }
    
    // Log enterprise uploads for monitoring and analytics
    if (totalSize > 100 * 1024 * 1024) { // 100MB+
      console.log(`🏢 ENTERPRISE UPLOAD PROCESSING:`, {
        size: `${sizeMB}MB`,
        files: fileCount,
        user: req.user.id,
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      const result = await this.projectsService.analyzeProjectFolder(req.user.id, body.files);
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ Enterprise analysis completed: ${sizeMB}MB processed in ${processingTime}s`);
      
      return result;
    } catch (error) {
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.error(`❌ Enterprise analysis failed: ${sizeMB}MB after ${processingTime}s:`, error.message);
      
      // Enhanced error handling for different failure types
      if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
        throw new HttpException(
          `Analysis timeout for enterprise project (${sizeMB}MB, ${fileCount} files). 
           Large projects may take up to 15 minutes to process. Please try again.`,
          HttpStatus.REQUEST_TIMEOUT
        );
      }
      
      if (error.message?.includes('memory') || error.code === 'ERR_MEMORY') {
        throw new HttpException(
          `Enterprise project (${sizeMB}MB) exceeded memory limits during analysis. 
           Contact support for high-memory processing solutions.`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      
      // Generic enterprise error
      throw new HttpException(
        `Failed to analyze enterprise project (${sizeMB}MB, ${fileCount} files). 
         ${error.message || 'Please try again or contact support.'}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async deleteProject(@Request() req, @Param('id') id: string) {
    return this.projectsService.delete(req.user.id, id);
  }
}