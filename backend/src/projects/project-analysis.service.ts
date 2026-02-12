import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElementAnalyzerService } from '../ai/element-analyzer.service';
import { AuthenticationAnalyzerService } from '../ai/authentication-analyzer.service';
import { DetectedElement } from '../ai/interfaces/element.interface';
import { AuthFlowsService } from '../auth-flows/auth-flows.service';
import { AnalysisProgressGateway } from '../analysis/analysis-progress.gateway';
import { AnalysisRetryService } from '../analysis/analysis-retry.service';
import { ProjectAnalyzerService } from '../analysis/project-analyzer.service';
import { GitHubService } from './github.service';
import { ProjectElementsService } from './project-elements.service';

export interface AnalysisResult {
  url: string;
  elements: Array<{
    selector: string;
    elementType: string;
    description: string;
    confidence: number;
    attributes?: Record<string, unknown>;
    discoveryState?: string;
    discoveryTrigger?: string;
    sourcePageTitle?: string;
    sourceUrlPath?: string;
    requiresAuth?: boolean;
    isModal?: boolean;
  }>;
  analysisDate: Date;
  success: boolean;
  errorMessage?: string;
  errorCategory?: string;
  totalUrls?: number;
  successfulUrls?: number;
  authenticationUsed?: boolean;
  totalElementsStored?: number;
}

@Injectable()
export class ProjectAnalysisService {
  constructor(
    private prisma: PrismaService,
    private elementAnalyzer: ElementAnalyzerService,
    private authenticationAnalyzer: AuthenticationAnalyzerService,
    private authFlowsService: AuthFlowsService,
    private progressGateway: AnalysisProgressGateway,
    private retryService: AnalysisRetryService,
    private projectAnalyzer: ProjectAnalyzerService,
    private githubService: GitHubService,
    private projectElementsService: ProjectElementsService,
  ) {}

  async analyzeProjectPages(organizationId: string, projectId: string, selectedUrlIds?: string[]): Promise<AnalysisResult> {
    this.progressGateway.sendStarted(
      projectId,
      'initialization',
      'Starting project analysis...',
      { organizationId, projectId }
    );

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: { urls: true },
    });

    if (!project) {
      this.progressGateway.sendError(projectId, 'initialization', 'Project not found', new Error('Project not found'));
      throw new Error('Project not found');
    }

    if (!project.urls || project.urls.length === 0) {
      this.progressGateway.sendError(projectId, 'initialization', 'No URLs found for this project', new Error('No URLs configured'));
      throw new Error('No URLs found for this project');
    }

    const urlsToAnalyze = selectedUrlIds && selectedUrlIds.length > 0
      ? project.urls.filter(url => selectedUrlIds.includes(url.id))
      : project.urls;

    console.log(`🎯 Analyzing ${urlsToAnalyze.length} of ${project.urls.length} URLs`);

    if (urlsToAnalyze.length === 0) {
      this.progressGateway.sendError(projectId, 'initialization', 'No URLs selected for analysis', new Error('No URLs selected'));
      throw new Error('No URLs selected for analysis');
    }

    this.progressGateway.sendProgress(
      projectId,
      'initialization',
      `Found ${urlsToAnalyze.length} of ${project.urls.length} URL(s) to analyze`,
      1,
      4,
      { urls: urlsToAnalyze.map(u => u.url) }
    );

    this.progressGateway.sendProgress(
      projectId,
      'auth_check',
      'Checking for authentication flows...',
      2,
      4
    );

    const authFlows = await this.authFlowsService.getByProject(projectId);
    const authFlow = authFlows.length > 0 ? authFlows[0] : null;

    if (authFlow) {
      this.progressGateway.sendProgress(
        projectId,
        'auth_check',
        `Found authentication flow: ${authFlow.name}`,
        3,
        4,
        { authFlow: authFlow.name, loginUrl: authFlow.loginUrl }
      );
    } else {
      this.progressGateway.sendProgress(
        projectId,
        'auth_check',
        'No authentication flow found - using standard analysis',
        3,
        4
      );
    }

    const allResults: AnalysisResult[] = [];

    try {
      if (authFlow) {
        const authResult = await this.performAuthenticatedAnalysis(
          projectId,
          project,
          urlsToAnalyze,
          authFlow
        );
        if (authResult) return authResult;
      }

      return await this.performStandardAnalysis(projectId, urlsToAnalyze, allResults);

    } catch (error) {
      this.progressGateway.sendError(
        projectId,
        'analysis_error',
        `Critical analysis error: ${error.message}`,
        error
      );

      console.error('Analysis failed:', error);
      return {
        url: project?.urls?.[0]?.url || 'Unknown',
        elements: [],
        analysisDate: new Date(),
        success: false,
        errorMessage: error.message
      };
    }
  }

  private async performAuthenticatedAnalysis(
    projectId: string,
    project: { urls: Array<{ id: string; url: string }> },
    urlsToAnalyze: Array<{ id: string; url: string }>,
    authFlow: { id: string; name: string; loginUrl: string; steps: unknown; credentials: unknown }
  ): Promise<AnalysisResult | null> {
    this.progressGateway.sendStarted(
      projectId,
      'authenticated_analysis',
      `Starting authenticated analysis using ${authFlow.name}`,
      { authFlow: authFlow.name, totalUrls: urlsToAnalyze.length }
    );

    console.log(`🔥 CALLING CORRECT AUTHENTICATION SERVICE - AuthenticationAnalyzerService`);
    const authenticatedAnalysisResult = await this.authenticationAnalyzer.analyzeAllUrlsWithAuth(
      urlsToAnalyze.map(url => url.url),
      {
        id: authFlow.id,
        name: authFlow.name,
        loginUrl: authFlow.loginUrl,
        steps: authFlow.steps as Array<{ type: string; selector: string; value?: string }>,
        credentials: authFlow.credentials as { username: string; password: string },
      },
      (step: string, message: string, current?: number, total?: number) => {
        if (current !== undefined && total !== undefined) {
          this.progressGateway.sendProgress(projectId, 'authenticated_analysis', message, current, total);
        } else {
          this.progressGateway.sendProgress(projectId, 'authenticated_analysis', message, 0, 1);
        }
      }
    );

    if (authenticatedAnalysisResult.success) {
      this.progressGateway.sendProgress(
        projectId,
        'element_storage',
        'Authentication successful! Storing discovered elements...',
        1,
        authenticatedAnalysisResult.urlResults.length + 1
      );

      let totalElementsStored = 0;
      let storedUrlCount = 0;

      for (const urlResult of authenticatedAnalysisResult.urlResults) {
        storedUrlCount++;

        if (urlResult.elements.length > 0) {
          const projectUrl = project.urls.find(pu => pu.url === urlResult.url);

          if (projectUrl) {
            await this.projectElementsService.storeProjectElements(projectId, urlResult.elements, projectUrl.id);
            this.progressGateway.sendProgress(
              projectId,
              'element_storage',
              `Stored ${urlResult.elements.length} elements from ${urlResult.url}`,
              storedUrlCount + 1,
              authenticatedAnalysisResult.urlResults.length + 1,
              { url: urlResult.url, elementCount: urlResult.elements.length }
            );
            totalElementsStored += urlResult.elements.length;

            await this.prisma.projectUrl.update({
              where: { id: projectUrl.id },
              data: {
                analyzed: true,
                analysisDate: new Date()
              },
            });
          } else {
            await this.projectElementsService.storeProjectElements(projectId, urlResult.elements, null);
            this.progressGateway.sendProgress(
              projectId,
              'element_storage',
              `Stored ${urlResult.elements.length} login page elements`,
              storedUrlCount + 1,
              authenticatedAnalysisResult.urlResults.length + 1,
              { url: urlResult.url, elementCount: urlResult.elements.length, type: 'login_page' }
            );
            totalElementsStored += urlResult.elements.length;
          }
        } else {
          this.progressGateway.sendProgress(
            projectId,
            'element_storage',
            `No elements found for ${urlResult.url}`,
            storedUrlCount + 1,
            authenticatedAnalysisResult.urlResults.length + 1,
            { url: urlResult.url, elementCount: 0 }
          );
        }
      }

      this.progressGateway.sendCompleted(
        projectId,
        'authenticated_analysis',
        `✅ Analysis completed! Found ${totalElementsStored} elements across ${authenticatedAnalysisResult.urlResults.length} pages`,
        {
          totalUrls: urlsToAnalyze.length,
          successfulUrls: authenticatedAnalysisResult.urlResults.length,
          totalElementsStored,
          authenticationUsed: true
        }
      );

      return {
        url: `${authenticatedAnalysisResult.urlResults.length} URLs analyzed with authentication`,
        elements: authenticatedAnalysisResult.urlResults.flatMap(result => result.elements),
        analysisDate: new Date(),
        success: true,
        totalUrls: urlsToAnalyze.length,
        successfulUrls: authenticatedAnalysisResult.urlResults.length,
        authenticationUsed: true,
        totalElementsStored,
      };
    } else {
      const errorCategory = authenticatedAnalysisResult.errorCategory || 'AUTHENTICATION_ERROR';
      const errorDetails = authenticatedAnalysisResult.errorDetails || {
        originalError: authenticatedAnalysisResult.errorMessage,
        suggestions: ['Check authentication credentials', 'Verify login URL accessibility', 'Review authentication steps']
      };

      this.progressGateway.sendError(
        projectId,
        'authenticated_analysis',
        `${errorCategory.replace('_', ' ')}: ${authenticatedAnalysisResult.errorMessage}`,
        {
          message: authenticatedAnalysisResult.errorMessage,
          category: errorCategory,
          suggestions: errorDetails.suggestions || []
        }
      );

      this.progressGateway.sendProgress(
        projectId,
        'fallback_analysis',
        'Falling back to standard analysis without authentication...',
        1,
        3
      );
    }

    return null;
  }

  private async performStandardAnalysis(
    projectId: string,
    urlsToAnalyze: Array<{ id: string; url: string }>,
    allResults: AnalysisResult[]
  ): Promise<AnalysisResult> {
    this.progressGateway.sendStarted(
      projectId,
      'standard_analysis',
      'Starting standard analysis (no authentication)',
      { totalUrls: urlsToAnalyze.length }
    );

    let urlIndex = 0;
    let totalElements = 0;

    for (const projectUrl of urlsToAnalyze) {
      urlIndex++;

      this.progressGateway.sendProgress(
        projectId,
        'standard_analysis',
        `Analyzing URL ${urlIndex}/${urlsToAnalyze.length}: ${projectUrl.url}`,
        urlIndex,
        urlsToAnalyze.length,
        { currentUrl: projectUrl.url }
      );

      try {
        const retryResult = await this.retryService.executeWithRetry(
          () => this.elementAnalyzer.analyzePage(projectUrl.url, {
            onProgress: (stage, percent, detail) => {
              this.progressGateway.sendProgress(
                projectId,
                'element_extraction',
                `${projectUrl.url}: ${stage}`,
                percent,
                100,
                { url: projectUrl.url, stage, detail }
              );
            },
          }),
          `analyze-url-${projectUrl.url}`,
          {
            maxRetries: 2,
            retryDelays: [3000, 8000],
            retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'BROWSER_ERROR', 'SSL_ERROR']
          }
        );

        await this.retryService.storeRetryHistory(projectId, `analyze-${projectUrl.id}`, retryResult);

        if (retryResult.totalRetries > 0) {
          this.progressGateway.sendProgress(
            projectId,
            'standard_analysis',
            `${projectUrl.url} completed after ${retryResult.totalRetries} retries (${Math.round(retryResult.totalDuration / 1000)}s)`,
            urlIndex,
            urlsToAnalyze.length,
            {
              url: projectUrl.url,
              retryCount: retryResult.totalRetries,
              totalDuration: retryResult.totalDuration,
              recommendations: this.retryService.generateRetryRecommendations(retryResult.allAttempts)
            }
          );
        }

        const analysisResult: AnalysisResult = retryResult.success ? retryResult.result : {
          url: projectUrl.url,
          elements: [],
          analysisDate: new Date(),
          success: false,
          errorMessage: retryResult.finalAttempt.errorMessage,
          errorCategory: retryResult.finalAttempt.errorCategory
        };

        if (analysisResult.success && analysisResult.elements.length > 0) {
          await this.projectElementsService.storeProjectElements(projectId, analysisResult.elements as DetectedElement[], projectUrl.id);
          totalElements += analysisResult.elements.length;

          this.progressGateway.sendProgress(
            projectId,
            'element_storage',
            `✅ Stored ${analysisResult.elements.length} elements from ${projectUrl.url}`,
            urlIndex,
            urlsToAnalyze.length,
            {
              url: projectUrl.url,
              elementCount: analysisResult.elements.length,
              totalElements
            }
          );

          await this.prisma.projectUrl.update({
            where: { id: projectUrl.id },
            data: {
              analyzed: true,
              analysisDate: new Date()
            },
          });
        } else {
          const errorMessage = analysisResult.errorMessage || 'No elements found';
          const errorCategory = analysisResult.errorCategory;

          if (errorCategory) {
            this.progressGateway.sendError(
              projectId,
              'standard_analysis',
              `${errorCategory.replace('_', ' ')}: ${errorMessage}`,
              {
                message: errorMessage,
                category: errorCategory,
                url: projectUrl.url,
                suggestions: []
              }
            );
          } else {
            this.progressGateway.sendProgress(
              projectId,
              'element_storage',
              `⚠️ No elements found for URL: ${projectUrl.url}`,
              urlIndex,
              urlsToAnalyze.length,
              { url: projectUrl.url, elementCount: 0 }
            );
          }

          await this.prisma.projectUrl.update({
            where: { id: projectUrl.id },
            data: {
              analyzed: true,
              analysisDate: new Date()
            },
          });
        }

        allResults.push(analysisResult);
      } catch (urlError) {
        this.progressGateway.sendError(
          projectId,
          'standard_analysis',
          `Failed to analyze URL ${projectUrl.url}: ${urlError.message}`,
          {
            message: urlError.message,
            url: projectUrl.url,
            suggestions: [
              'Check if the URL is accessible',
              'Verify network connectivity',
              'Consider if authentication is required'
            ]
          }
        );

        await this.prisma.projectUrl.update({
          where: { id: projectUrl.id },
          data: {
            analyzed: true,
            analysisDate: new Date()
          },
        });

        allResults.push({
          url: projectUrl.url,
          elements: [],
          analysisDate: new Date(),
          success: false,
          errorMessage: urlError.message
        });
      }
    }

    const successfulResults = allResults.filter(result => result.success);
    const totalElementsFound = allResults.flatMap(result => result.elements).length;

    this.progressGateway.sendCompleted(
      projectId,
      'standard_analysis',
      `✅ Standard analysis completed! Found ${totalElementsFound} elements across ${successfulResults.length}/${urlsToAnalyze.length} pages`,
      {
        totalUrls: urlsToAnalyze.length,
        successfulUrls: successfulResults.length,
        totalElements: totalElementsFound,
        authenticationUsed: false
      }
    );

    return {
      url: `${urlsToAnalyze.length} URLs analyzed`,
      elements: allResults.flatMap(result => result.elements),
      analysisDate: new Date(),
      success: allResults.some(result => result.success),
      totalUrls: urlsToAnalyze.length,
      successfulUrls: successfulResults.length,
      authenticationUsed: false,
      totalElementsStored: totalElementsFound,
    };
  }

  async analyzeGitHubRepo(userId: string, organizationId: string, repoUrl: string, token?: string) {
    console.log(`🐙 analyzing GitHub repo: ${repoUrl}`);

    const files = await this.githubService.importRepository(repoUrl, token);

    return this.analyzeProjectFolder(userId, organizationId, files);
  }

  async analyzeProjectFolder(userId: string, organizationId: string, files: Array<{
    name: string;
    path: string;
    size: number;
    type: string;
    content: string;
  }>) {
    console.log(`🔍 Starting server-side project folder analysis for ${files.length} files`);

    try {
      const analysisResult = await this.projectAnalyzer.analyzeProjectFiles(files);

      const projectData = {
        name: `${analysisResult.framework} Project (${new Date().toLocaleDateString()})`,
        description: analysisResult.statistics.elementsFound > 0
          ? `Auto-generated from folder upload: ${analysisResult.statistics.elementsFound} elements found across ${analysisResult.statistics.totalFiles} files`
          : `Project uploaded with ${analysisResult.statistics.totalFiles} files. Framework: ${analysisResult.framework}. No UI elements detected - may need manual configuration.`,
        urls: analysisResult.urls.length > 0
          ? analysisResult.urls.map(url => ({
            url: url.url,
            title: url.title,
            description: url.description
          }))
          : [{
            url: 'http://localhost:3000',
            title: 'Local Development Server',
            description: 'Default development URL - update as needed'
          }]
      };

      // Import ProjectsService dynamically to avoid circular dependency
      const { ProjectsService } = await import('./projects.service');
      // Note: This will be refactored to use a proper create method passed in
      // For now, we'll create project directly via Prisma
      const project = await this.prisma.project.create({
        data: {
          name: projectData.name,
          description: projectData.description,
          userId,
          organizationId,
        },
      });

      // Create ProjectUrls
      if (projectData.urls && projectData.urls.length > 0) {
        await this.prisma.projectUrl.createMany({
          data: projectData.urls.map(urlData => ({
            url: urlData.url,
            title: urlData.title,
            description: urlData.description,
            projectId: project.id,
          })),
        });
      }

      if (analysisResult.elements.length > 0) {
        await this.projectElementsService.createProjectElements(organizationId, project.id, analysisResult.elements.map(element => ({
          selector: element.selector,
          elementType: element.elementType,
          description: element.description,
          attributes: element.attributes,
          confidence: element.confidence,
          source: element.source
        })));
      }

      console.log(`✅ Successfully created project ${project.id} with ${analysisResult.elements.length} elements from folder analysis`);

      const successMessage = analysisResult.elements.length > 0
        ? `Successfully created project with ${analysisResult.elements.length} UI elements discovered from your ${analysisResult.framework} code`
        : `Project created successfully! Framework: ${analysisResult.framework}. No UI elements were auto-detected, but you can add URLs and analyze pages manually.`;

      return {
        success: true,
        project,
        analysis: analysisResult,
        message: successMessage
      };

    } catch (error) {
      console.error('❌ Failed to analyze project folder:', error);
      throw new Error(`Project folder analysis failed: ${error.message}`);
    }
  }

  async getAnalysisMetrics(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: {
        urls: true,
        elements: true,
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const totalElements = project.elements?.length || 0;
    const urlsAnalyzed = project.urls?.filter(url => url.analyzed).length || 0;
    const totalUrls = project.urls?.length || 0;

    const selectorTypes = project.elements?.reduce((acc, element) => {
      if (element.selector.includes('[data-testid=') || element.selector.includes('data-testid=')) acc.testId++;
      else if (element.selector.includes('#')) acc.id++;
      else if (element.selector.includes('[aria-label=') || element.selector.includes('aria-label=')) acc.ariaLabel++;
      else if (element.selector.includes('.')) acc.class++;
      else if (element.selector.includes(':nth-')) acc.positional++;
      else acc.other++;
      return acc;
    }, { testId: 0, id: 0, ariaLabel: 0, class: 0, positional: 0, other: 0 }) || { testId: 0, id: 0, ariaLabel: 0, class: 0, positional: 0, other: 0 };

    const elementTypes = project.elements?.reduce((acc, element) => {
      acc[element.elementType] = (acc[element.elementType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return {
      overview: {
        totalElements,
        urlsAnalyzed,
        totalUrls,
        analysisCompleteness: totalUrls > 0 ? Math.round((urlsAnalyzed / totalUrls) * 100) : 0,
        averageElementsPerUrl: urlsAnalyzed > 0 ? Math.round(totalElements / urlsAnalyzed) : 0
      },
      selectorQuality: {
        distribution: selectorTypes,
        stabilityScore: totalElements > 0 ? Math.round(((selectorTypes.testId + selectorTypes.id + selectorTypes.ariaLabel) / totalElements) * 100) : 0
      },
      elementTypes: elementTypes,
      recentTrends: {
        elementsGrowth: '+12%',
        qualityImprovement: '+8%',
        coverageIncrease: '+15%'
      }
    };
  }

  async getAnalysisHistory(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: { urls: true, elements: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const mockHistory = [
      {
        id: '1',
        date: new Date(),
        status: 'success',
        duration: '45s',
        elementsFound: project.elements?.length || 0,
        urlsAnalyzed: project.urls?.filter(url => url.analyzed).length || 0,
        errorCategory: null,
        quality: { average: 0.85, selectors: { stable: 89, fragile: 11 } }
      }
    ];

    return mockHistory;
  }
}
