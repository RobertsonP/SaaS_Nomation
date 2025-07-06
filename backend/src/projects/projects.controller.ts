import { Controller, Get, Post, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';

export class CreateProjectDto {
  name: string;
  description?: string;
  urls: Array<{url: string; title?: string; description?: string}>;
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

  @Delete(':id')
  async deleteProject(@Request() req, @Param('id') id: string) {
    return this.projectsService.delete(req.user.id, id);
  }
}