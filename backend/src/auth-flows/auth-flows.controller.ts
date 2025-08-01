import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req, SetMetadata } from '@nestjs/common';
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
    @Body() body: { projectId: string; name: string; loginUrl: string; username: string; password: string; steps: any[] },
    @Req() req: any
  ) {
    return this.authFlowsService.create(body.projectId, {
      name: body.name,
      loginUrl: body.loginUrl,
      steps: body.steps,
      credentials: { username: body.username, password: body.password }
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