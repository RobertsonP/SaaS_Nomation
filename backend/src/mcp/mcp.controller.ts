import { Controller, Get, Post, Param, Body, HttpStatus, HttpException } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpAnalysisBridgeService, McpEnhancedAnalysisResult } from './mcp-analysis-bridge.service';
import { LoginFlow } from '../ai/interfaces/element.interface';

@Controller('api/mcp')
export class McpController {
  constructor(
    private mcpService: McpService,
    private mcpBridge: McpAnalysisBridgeService
  ) {}

  @Get('health')
  async getHealth() {
    try {
      const healthStatus = await this.mcpService.healthCheck();
      return {
        success: true,
        ...healthStatus
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('servers')
  async getServers() {
    try {
      const availableServers = this.mcpService.getAvailableServers();
      const status = this.mcpService.getServerStatus();
      
      return {
        success: true,
        servers: availableServers.map(serverName => ({
          name: serverName,
          config: this.mcpService.getServerConfig(serverName),
          ...status[serverName]
        }))
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('servers/:serverName/status')
  async getServerStatus(@Param('serverName') serverName: string) {
    try {
      const status = this.mcpService.getServerStatus(serverName);
      
      if (!status[serverName]) {
        throw new HttpException(
          {
            success: false,
            error: `Server ${serverName} not found`
          },
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        server: serverName,
        ...status[serverName]
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('servers/:serverName/restart')
  async restartServer(@Param('serverName') serverName: string) {
    try {
      if (!this.mcpService.getAvailableServers().includes(serverName)) {
        throw new HttpException(
          {
            success: false,
            error: `Server ${serverName} not found`
          },
          HttpStatus.NOT_FOUND
        );
      }

      await this.mcpService.restartServer(serverName);
      
      return {
        success: true,
        message: `Server ${serverName} restarted successfully`
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('servers/:serverName/tools/:toolName')
  async executeTool(
    @Param('serverName') serverName: string,
    @Param('toolName') toolName: string,
    @Body() args: Record<string, any>
  ) {
    try {
      if (!this.mcpService.isServerRunning(serverName)) {
        throw new HttpException(
          {
            success: false,
            error: `Server ${serverName} is not running`
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.mcpService.executeTool(serverName, toolName, args);
      
      return {
        success: true,
        result
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status')
  async getOverallStatus() {
    try {
      const isInitialized = this.mcpService.getInitializationStatus();
      const serverStatus = this.mcpService.getServerStatus();
      const availableServers = this.mcpService.getAvailableServers();
      
      const runningServers = Object.values(serverStatus).filter(
        (server: any) => server.status === 'running'
      ).length;

      return {
        success: true,
        initialized: isInitialized,
        totalServers: availableServers.length,
        runningServers,
        servers: serverStatus
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // MCP-Enhanced Analysis Endpoints

  @Post('analyze')
  async analyzePage(@Body() body: {
    url: string;
    authFlow?: LoginFlow;
    options?: {
      useMemoryCache?: boolean;
      storeResults?: boolean;
      createGitHubIssues?: boolean;
    };
  }) {
    try {
      const { url, authFlow, options } = body;
      
      if (!url) {
        throw new HttpException(
          { success: false, error: 'URL is required' },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.mcpBridge.analyzePageWithMcp(url, authFlow, options);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('analyze/batch')
  async analyzeBatch(@Body() body: {
    urls: string[];
    authFlow?: LoginFlow;
    options?: {
      useMemoryCache?: boolean;
      storeResults?: boolean;
      parallelProcessing?: boolean;
    };
  }) {
    try {
      const { urls, authFlow, options } = body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        throw new HttpException(
          { success: false, error: 'URLs array is required' },
          HttpStatus.BAD_REQUEST
        );
      }

      const results = await this.mcpBridge.analyzeBatchWithMcp(urls, authFlow, options);
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('integration-status')
  async getIntegrationStatus() {
    try {
      const status = await this.mcpBridge.getMcpIntegrationStatus();
      
      return {
        success: true,
        data: status
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}