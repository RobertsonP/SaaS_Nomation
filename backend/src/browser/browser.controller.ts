import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LiveBrowserService } from './live-browser.service';
import { LoginFlow } from '../ai/interfaces/element.interface';

@Controller('api/browser')
@UseGuards(AuthGuard('jwt'))
export class BrowserController {
  constructor(private liveBrowserService: LiveBrowserService) {}

  @Post('sessions')
  async createSession(
    @Body() body: { projectId: string; authFlow?: LoginFlow },
    @Req() req: any
  ) {
    return this.liveBrowserService.createSession(body.projectId, body.authFlow);
  }

  @Post('sessions/:sessionToken/navigate')
  async navigateToPage(
    @Param('sessionToken') sessionToken: string,
    @Body() body: { url: string }
  ) {
    await this.liveBrowserService.navigateToPage(sessionToken, body.url);
    return { success: true };
  }

  @Get('sessions/:sessionToken/elements')
  async captureElements(@Param('sessionToken') sessionToken: string) {
    const elements = await this.liveBrowserService.captureCurrentElements(sessionToken);
    return { elements };
  }

  @Post('sessions/:sessionToken/actions')
  async executeAction(
    @Param('sessionToken') sessionToken: string,
    @Body() action: { type: string; selector: string; value?: string }
  ) {
    const elements = await this.liveBrowserService.executeAction(sessionToken, action);
    return { elements };
  }

  @Get('sessions/:sessionToken')
  async getSessionInfo(@Param('sessionToken') sessionToken: string) {
    const session = await this.liveBrowserService.getSessionInfo(sessionToken);
    return { session };
  }

  @Post('sessions/:sessionToken/extend')
  async extendSession(@Param('sessionToken') sessionToken: string) {
    await this.liveBrowserService.extendSession(sessionToken);
    return { success: true };
  }

  @Delete('sessions/:sessionToken')
  async closeSession(@Param('sessionToken') sessionToken: string) {
    await this.liveBrowserService.closeSession(sessionToken);
    return { success: true };
  }

  @Get('sessions/:sessionToken/view')
  async getSessionView(@Param('sessionToken') sessionToken: string) {
    return this.liveBrowserService.getSessionView(sessionToken);
  }

  @Get('sessions/:sessionToken/screenshot')
  async getSessionScreenshot(@Param('sessionToken') sessionToken: string) {
    const screenshot = await this.liveBrowserService.getSessionScreenshot(sessionToken);
    return { screenshot };
  }

  @Post('cross-origin-element-detection')
  async crossOriginElementDetection(
    @Body() body: { 
      url: string; 
      clickX: number; 
      clickY: number; 
      viewport: { width: number; height: number } 
    }
  ) {
    return this.liveBrowserService.crossOriginElementDetection(
      body.url, 
      body.clickX, 
      body.clickY, 
      body.viewport
    );
  }

}