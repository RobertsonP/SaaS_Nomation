import { Controller, Get } from '@nestjs/common';
import { AuthFlowTemplatesService } from './auth-flow-templates.service';

@Controller('api/public')
export class PublicTemplatesController {
  constructor(private templatesService: AuthFlowTemplatesService) {}

  @Get('auth-templates')
  async getAuthTemplates() {
    console.log('📝 Public templates endpoint called');
    return this.templatesService.getCommonTemplates();
  }
}