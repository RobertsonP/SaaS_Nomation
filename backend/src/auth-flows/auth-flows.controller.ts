import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards, Req, SetMetadata } from '@nestjs/common';
import { AuthFlowsService } from './auth-flows.service';
import { AuthFlowTemplatesService } from './auth-flow-templates.service';
import { SimplifiedAuthService } from './simplified-auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Decorator to skip JWT auth for specific endpoints
export const SkipAuth = () => SetMetadata('skipAuth', true);

@Controller('api/auth-flows')
@UseGuards(JwtAuthGuard)
export class AuthFlowsController {
  constructor(
    private authFlowsService: AuthFlowsService,
    private templatesService: AuthFlowTemplatesService,
    private simplifiedAuthService: SimplifiedAuthService
  ) {}

  @Post()
  async createAuthFlow(
    @Body() body: { projectId: string; name: string; loginUrl: string; username: string; password: string; steps: any[]; useAutoDetection?: boolean; manualSelectors?: any },
    @Req() req: any
  ) {
    return this.authFlowsService.create(body.projectId, {
      name: body.name,
      loginUrl: body.loginUrl,
      steps: body.steps,
      credentials: { username: body.username, password: body.password },
      useAutoDetection: body.useAutoDetection !== undefined ? body.useAutoDetection : true,
      manualSelectors: body.manualSelectors || null
    });
  }

  @Put(':id')
  async updateAuthFlow(
    @Param('id') id: string,
    @Body() body: { name: string; loginUrl: string; username: string; password: string; steps: any[]; useAutoDetection?: boolean; manualSelectors?: any },
    @Req() req: any
  ) {
    return this.authFlowsService.update(id, {
      name: body.name,
      loginUrl: body.loginUrl,
      steps: body.steps,
      credentials: { username: body.username, password: body.password },
      useAutoDetection: body.useAutoDetection !== undefined ? body.useAutoDetection : true,
      manualSelectors: body.manualSelectors || null
    });
  }

  @Get('project/:projectId')
  async getAuthFlows(@Param('projectId') projectId: string) {
    return this.authFlowsService.getByProject(projectId);
  }

  @Get('templates')
  @SkipAuth()
  async getAuthTemplates() {
    return this.templatesService.getCommonTemplates();
  }

  @Get(':id')
  async getAuthFlowById(@Param('id') id: string) {
    return this.authFlowsService.getById(id);
  }

  @Post('test')
  async testAuthFlow(@Body() body: {
    loginUrl: string;
    username: string;
    password: string;
    steps?: any[];
  }) {
    return this.simplifiedAuthService.testAuthFlow(
      body.loginUrl,
      { username: body.username, password: body.password },
      body.steps
    );
  }

  @Post('detect-template')
  async detectAuthTemplate(@Body() body: { loginUrl: string }) {
    const template = this.templatesService.detectTemplate(body.loginUrl);
    return { template };
  }

  @Delete(':id')
  async deleteAuthFlow(@Param('id') id: string) {
    return this.authFlowsService.delete(id);
  }
}