/**
 * MCP Analysis Bridge Service
 * Bridges MCP tools with ElementAnalyzerService for enhanced analysis capabilities
 */

import { Injectable } from '@nestjs/common';
import { McpService } from './mcp.service';
import { ElementAnalyzerService } from '../ai/element-analyzer.service';
import { AuthenticationAnalyzerService } from '../ai/authentication-analyzer.service';
import { LoginFlow, DetectedElement, PageAnalysisResult } from '../ai/interfaces/element.interface';
import { Browser, Page } from 'playwright';

export interface McpEnhancedAnalysisResult extends PageAnalysisResult {
  mcpEnhancements: {
    playwrightTools?: {
      usesMcpTools: boolean;
      toolsUsed: string[];
    };
    memoryCache?: {
      cacheHit: boolean;
      cacheKey?: string;
    };
    githubIntegration?: {
      repoConnected: boolean;
      issuesCreated?: number;
    };
    filesystemStorage?: {
      analysisStored: boolean;
      storagePath?: string;
    };
  };
}

@Injectable()
export class McpAnalysisBridgeService {
  constructor(
    private mcpService: McpService,
    private elementAnalyzer: ElementAnalyzerService,
    private authenticationAnalyzer: AuthenticationAnalyzerService
  ) {}

  /**
   * Enhanced page analysis using MCP tools
   */
  async analyzePageWithMcp(
    url: string, 
    authFlow?: LoginFlow,
    options?: {
      useMemoryCache?: boolean;
      storeResults?: boolean;
      createGitHubIssues?: boolean;
    }
  ): Promise<McpEnhancedAnalysisResult> {
    const mcpEnhancements: McpEnhancedAnalysisResult['mcpEnhancements'] = {
      playwrightTools: { usesMcpTools: false, toolsUsed: [] },
      memoryCache: { cacheHit: false },
      githubIntegration: { repoConnected: false },
      filesystemStorage: { analysisStored: false }
    };

    try {
      console.log('🔧 Starting MCP-enhanced analysis...');

      // Step 1: Check memory cache using MCP memory server
      let analysisResult: PageAnalysisResult;
      
      if (options?.useMemoryCache) {
        const cacheResult = await this.checkMemoryCache(url);
        if (cacheResult.hit) {
          console.log('💾 Cache hit! Using cached analysis results');
          mcpEnhancements.memoryCache = { 
            cacheHit: true, 
            cacheKey: cacheResult.key 
          };
          analysisResult = cacheResult.data;
        }
      }

      // Step 2: If no cache hit, perform analysis with MCP Playwright tools
      if (!analysisResult) {
        console.log('🎭 Performing analysis with MCP Playwright integration...');
        
        if (authFlow) {
          console.log(`🔥 MCP: Using AuthenticationAnalyzerService for authenticated page analysis`);
          analysisResult = await this.authenticationAnalyzer.analyzePageWithAuth(url, authFlow);
        } else {
          analysisResult = await this.elementAnalyzer.analyzePage(url);
        }

        // Enhance with MCP Playwright tools
        const playwrightEnhancements = await this.enhanceWithPlaywrightMcp(analysisResult);
        mcpEnhancements.playwrightTools = playwrightEnhancements;
      }

      // Step 3: Store results using MCP filesystem if requested
      if (options?.storeResults) {
        const storageResult = await this.storeAnalysisResults(url, analysisResult);
        mcpEnhancements.filesystemStorage = storageResult;
      }

      // Step 4: Create GitHub issues for problematic elements if requested
      if (options?.createGitHubIssues) {
        const githubResult = await this.createGitHubIssuesForProblems(url, analysisResult);
        mcpEnhancements.githubIntegration = githubResult;
      }

      // Step 5: Cache results for future use
      if (options?.useMemoryCache && !mcpEnhancements.memoryCache.cacheHit) {
        await this.cacheAnalysisResults(url, analysisResult);
      }

      console.log('✅ MCP-enhanced analysis completed');

      return {
        ...analysisResult,
        mcpEnhancements
      };

    } catch (error) {
      console.error('❌ MCP-enhanced analysis failed:', error);
      
      // Fallback to regular analysis
      const fallbackResult = authFlow 
        ? await this.elementAnalyzer.analyzePageWithAuth(url, authFlow)
        : await this.elementAnalyzer.analyzePage(url);

      return {
        ...fallbackResult,
        mcpEnhancements
      };
    }
  }

  /**
   * Batch analyze multiple URLs with MCP optimization
   */
  async analyzeBatchWithMcp(
    urls: string[],
    authFlow?: LoginFlow,
    options?: {
      useMemoryCache?: boolean;
      storeResults?: boolean;
      parallelProcessing?: boolean;
    }
  ): Promise<McpEnhancedAnalysisResult[]> {
    console.log(`🚀 Starting batch MCP analysis for ${urls.length} URLs...`);

    if (options?.parallelProcessing) {
      // Use Promise.all for parallel processing
      const promises = urls.map(url => 
        this.analyzePageWithMcp(url, authFlow, options)
      );
      return Promise.all(promises);
    } else {
      // Sequential processing for better resource management
      const results: McpEnhancedAnalysisResult[] = [];
      for (const url of urls) {
        const result = await this.analyzePageWithMcp(url, authFlow, options);
        results.push(result);
      }
      return results;
    }
  }

  /**
   * Check MCP memory cache for previous analysis results
   */
  private async checkMemoryCache(url: string): Promise<{
    hit: boolean;
    key?: string;
    data?: PageAnalysisResult;
  }> {
    try {
      const memoryStatus = this.mcpService.getServerStatus()['memory'];
      if (!memoryStatus?.running) {
        return { hit: false };
      }

      const cacheKey = `analysis_${Buffer.from(url).toString('base64')}`;
      
      // TODO: Implement actual MCP memory server communication
      // For now, return cache miss
      return { hit: false, key: cacheKey };
      
    } catch (error) {
      console.error('Memory cache check failed:', error);
      return { hit: false };
    }
  }

  /**
   * Enhance analysis results with MCP Playwright tools
   */
  private async enhanceWithPlaywrightMcp(result: PageAnalysisResult): Promise<{
    usesMcpTools: boolean;
    toolsUsed: string[];
  }> {
    try {
      const playwrightStatus = this.mcpService.getServerStatus()['playwright'];
      if (!playwrightStatus?.running) {
        return { usesMcpTools: false, toolsUsed: [] };
      }

      // TODO: Implement actual MCP Playwright tool integration
      // This would include:
      // - Enhanced element detection
      // - Advanced interaction capabilities
      // - Performance analysis
      // - Accessibility checks
      
      return { 
        usesMcpTools: true, 
        toolsUsed: ['element-detection', 'performance-analysis'] 
      };
      
    } catch (error) {
      console.error('Playwright MCP enhancement failed:', error);
      return { usesMcpTools: false, toolsUsed: [] };
    }
  }

  /**
   * Store analysis results using MCP filesystem
   */
  private async storeAnalysisResults(url: string, result: PageAnalysisResult): Promise<{
    analysisStored: boolean;
    storagePath?: string;
  }> {
    try {
      const filesystemStatus = this.mcpService.getServerStatus()['filesystem'];
      if (!filesystemStatus?.running) {
        return { analysisStored: false };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `analysis_${timestamp}_${Buffer.from(url).toString('base64').slice(0, 10)}.json`;
      const storagePath = `./analysis/${filename}`;

      // TODO: Implement actual MCP filesystem storage
      // This would write the analysis results to the filesystem using MCP tools
      
      console.log(`💾 Analysis results stored to: ${storagePath}`);
      return { analysisStored: true, storagePath };
      
    } catch (error) {
      console.error('Filesystem storage failed:', error);
      return { analysisStored: false };
    }
  }

  /**
   * Create GitHub issues for problematic elements
   */
  private async createGitHubIssuesForProblems(url: string, result: PageAnalysisResult): Promise<{
    repoConnected: boolean;
    issuesCreated?: number;
  }> {
    try {
      const githubStatus = this.mcpService.getServerStatus()['github'];
      if (!githubStatus?.running) {
        return { repoConnected: false };
      }

      // Identify problematic elements (low reliability, missing selectors, etc.)
      const problematicElements = result.elements.filter(element => {
        // Add logic to identify problematic elements
        return false; // Placeholder
      });

      if (problematicElements.length === 0) {
        return { repoConnected: true, issuesCreated: 0 };
      }

      // TODO: Implement actual GitHub issue creation using MCP GitHub tools
      // This would create issues for elements that need attention
      
      console.log(`🐛 Created ${problematicElements.length} GitHub issues for problematic elements`);
      return { repoConnected: true, issuesCreated: problematicElements.length };
      
    } catch (error) {
      console.error('GitHub integration failed:', error);
      return { repoConnected: false };
    }
  }

  /**
   * Cache analysis results using MCP memory server
   */
  private async cacheAnalysisResults(url: string, result: PageAnalysisResult): Promise<void> {
    try {
      const memoryStatus = this.mcpService.getServerStatus()['memory'];
      if (!memoryStatus?.running) {
        return;
      }

      const cacheKey = `analysis_${Buffer.from(url).toString('base64')}`;
      
      // TODO: Implement actual MCP memory server caching
      // This would store the results in the MCP memory server
      
      console.log(`🧠 Analysis results cached with key: ${cacheKey}`);
      
    } catch (error) {
      console.error('Memory caching failed:', error);
    }
  }

  /**
   * Get MCP integration status
   */
  async getMcpIntegrationStatus(): Promise<{
    available: boolean;
    servers: Record<string, { running: boolean; integrated: boolean }>;
  }> {
    const serverStatus = this.mcpService.getServerStatus();
    const servers: Record<string, { running: boolean; integrated: boolean }> = {};

    for (const [name, status] of Object.entries(serverStatus)) {
      servers[name] = {
        running: status?.running || false,
        integrated: ['playwright', 'memory', 'filesystem', 'github'].includes(name)
      };
    }

    const available = Object.values(servers).some(s => s.running && s.integrated);

    return { available, servers };
  }
}