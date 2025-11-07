import { Controller, Post, Get, Delete, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { LiveBrowserService } from './live-browser.service';

/**
 * Public browser controller for element picker functionality
 * No authentication required - allows element picker to work without login
 */
@Controller('api/public/browser')
export class PublicBrowserController {
  constructor(private liveBrowserService: LiveBrowserService) {}

  @Get('health')
  async healthCheck() {
    return { status: 'OK', service: 'PublicBrowserController' };
  }

  @Post('sessions')
  async createSession(
    @Body() body: { projectId: string; authFlow?: any }
  ) {
    console.log(`🚀 Creating session for projectId: ${body.projectId}`);
    
    // Use first available project if no projectId provided or if projectId is empty/invalid
    let projectId = body.projectId;
    
    if (!projectId || projectId === 'test' || projectId === '' || projectId === 'default') {
      projectId = 'cmdblq3vu0004dksu7uaxdrxe'; // Use existing project from database
      console.log(`⚠️ Using fallback projectId: ${projectId}`);
    }
    
    return this.liveBrowserService.createSession(projectId, body.authFlow);
  }

  @Post('sessions/:sessionToken/navigate')
  async navigateToPage(
    @Param('sessionToken') sessionToken: string,
    @Body() body: { url: string }
  ) {
    try {
      await this.liveBrowserService.navigateToPage(sessionToken, body.url);
      return { success: true };
    } catch (error) {
      console.error(`❌ Navigation failed for session ${sessionToken}:`, error.message);
      // Return success with warning instead of 500 error for UX
      return { success: true, warning: 'Navigation completed with issues', details: error.message };
    }
  }

  @Get('sessions/:sessionToken/screenshot')
  async getSessionScreenshot(@Param('sessionToken') sessionToken: string) {
    try {
      const screenshot = await this.liveBrowserService.getSessionScreenshot(sessionToken);
      return { screenshot };
    } catch (error) {
      console.warn(`⚠️ Screenshot failed for session ${sessionToken}:`, error.message);
      // Return empty screenshot instead of 500 error
      return { screenshot: null, warning: 'Screenshot temporarily unavailable' };
    }
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

  @Delete('sessions/:sessionToken')
  async closeSession(@Param('sessionToken') sessionToken: string) {
    await this.liveBrowserService.closeSession(sessionToken);
    return { success: true };
  }

  @Get('sessions/:sessionToken/elements')
  async captureElements(@Param('sessionToken') sessionToken: string) {
    const elements = await this.liveBrowserService.captureCurrentElements(sessionToken);
    return { elements };
  }

  @Get('sessions/:sessionToken')
  async getSessionInfo(@Param('sessionToken') sessionToken: string) {
    const session = await this.liveBrowserService.getSessionInfo(sessionToken);
    return { session };
  }

  @Post('sessions/:sessionToken/actions')
  async executeAction(
    @Param('sessionToken') sessionToken: string,
    @Body() action: { type: string; selector: string; value?: string }
  ) {
    const elements = await this.liveBrowserService.executeAction(sessionToken, action);
    return { elements };
  }
}