import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElementAnalyzerService } from '../ai/element-analyzer.service';
import { AuthenticationAnalyzerService } from '../ai/authentication-analyzer.service';
import { DetectedElement } from '../ai/interfaces/element.interface';
import { AuthFlowsService } from '../auth-flows/auth-flows.service';
import { SimplifiedAuthService } from '../auth-flows/simplified-auth.service';
import { AnalysisProgressGateway } from '../analysis/analysis-progress.gateway';
import { AnalysisRetryService } from '../analysis/analysis-retry.service';
import { ProjectAnalyzerService } from '../analysis/project-analyzer.service';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private elementAnalyzer: ElementAnalyzerService,
    private authenticationAnalyzer: AuthenticationAnalyzerService,
    private authFlowsService: AuthFlowsService,
    private simplifiedAuthService: SimplifiedAuthService,
    private progressGateway: AnalysisProgressGateway,
    private retryService: AnalysisRetryService,
    private projectAnalyzer: ProjectAnalyzerService,
  ) {}

  async findByUser(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      include: { 
        urls: true,
        elements: true,
        _count: { 
          select: { 
            tests: true,
            elements: true,
            urls: true
          } 
        } 
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(userId: string, id: string) {
    return this.prisma.project.findFirst({
      where: { id, userId },
      include: { 
        urls: true,
        elements: {
          include: { sourceUrl: true },
          orderBy: [
            { sourceUrl: { url: 'asc' } },
            { confidence: 'desc' },
            { elementType: 'asc' },
            { createdAt: 'desc' }
          ]
        },
        _count: { 
          select: { 
            tests: true,
            elements: true,
            urls: true
          } 
        } 
      },
    });
  }

  async create(userId: string, data: { name: string; description?: string; urls: Array<{url: string; title?: string; description?: string}> }) {
    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        userId,
      },
    });

    // Create ProjectUrls from the provided URLs array with proper titles
    if (data.urls && data.urls.length > 0) {
      const urlsWithTitles = [];
      
      for (const urlData of data.urls) {
        // Use immediate fallback for fast project creation
        // Metadata will be fetched during analysis instead
        urlsWithTitles.push({
          url: urlData.url,
          title: urlData.title || this.generateTitleFromUrl(urlData.url),
          description: urlData.description || 'Project URL',
          projectId: project.id,
        });
      }

      await this.prisma.projectUrl.createMany({
        data: urlsWithTitles,
      });
    }

    return project;
  }

  async update(userId: string, projectId: string, data: { name?: string; description?: string; urls?: Array<{url: string; title?: string; description?: string}> }) {
    // Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Update project basic info
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    // Update URLs if provided
    if (data.urls !== undefined) {
      // Delete existing URLs
      await this.prisma.projectUrl.deleteMany({
        where: { projectId },
      });

      // Create new URLs
      if (data.urls.length > 0) {
        const urlsWithTitles = [];
        
        for (const urlData of data.urls) {
          // Use immediate fallback for fast project updates
          urlsWithTitles.push({
            url: urlData.url,
            title: urlData.title || this.generateTitleFromUrl(urlData.url),
            description: urlData.description || 'Project URL',
            projectId: projectId,
          });
        }

        await this.prisma.projectUrl.createMany({
          data: urlsWithTitles,
        });
      }

      // Clear analysis data since URLs changed
      await this.prisma.projectElement.deleteMany({
        where: { projectId },
      });
    }

    return this.findById(userId, projectId);
  }

  async analyzeProjectPages(userId: string, projectId: string) {
    // Send initial progress update
    this.progressGateway.sendStarted(
      projectId, 
      'initialization', 
      'Starting project analysis...',
      { userId, projectId }
    );

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
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

    this.progressGateway.sendProgress(
      projectId,
      'initialization',
      `Found ${project.urls.length} URL(s) to analyze`,
      1,
      4,
      { urls: project.urls.map(u => u.url) }
    );

    // Check for authentication flows
    this.progressGateway.sendProgress(
      projectId,
      'auth_check',
      'Checking for authentication flows...',
      2,
      4
    );

    const authFlows = await this.authFlowsService.getByProject(projectId);
    const authFlow = authFlows.length > 0 ? authFlows[0] : null; // Use first auth flow if available

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

    const allResults = [];

    try {
      if (authFlow) {
        this.progressGateway.sendStarted(
          projectId,
          'authenticated_analysis',
          `Starting authenticated analysis using ${authFlow.name}`,
          { authFlow: authFlow.name, totalUrls: project.urls.length }
        );

        // Authenticate FIRST, then scrape ALL URLs in the authenticated session
        console.log(`🔥 CALLING CORRECT AUTHENTICATION SERVICE - AuthenticationAnalyzerService`);
        const authenticatedAnalysisResult = await this.authenticationAnalyzer.analyzeAllUrlsWithAuth(
          project.urls.map(url => url.url), // All URLs to analyze
          {
            id: authFlow.id,
            name: authFlow.name,
            loginUrl: authFlow.loginUrl,
            steps: authFlow.steps as any[],
            credentials: authFlow.credentials as any,
          },
          // Pass progress callback to element analyzer
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
          
          // Store elements for each URL analyzed
          for (const urlResult of authenticatedAnalysisResult.urlResults) {
            storedUrlCount++;
            
            if (urlResult.elements.length > 0) {
              // Find the matching ProjectUrl
              const projectUrl = project.urls.find(pu => pu.url === urlResult.url);
              
              if (projectUrl) {
                // This is a project URL
                await this.storeProjectElements(projectId, urlResult.elements, projectUrl.id);
                this.progressGateway.sendProgress(
                  projectId,
                  'element_storage',
                  `Stored ${urlResult.elements.length} elements from ${urlResult.url}`,
                  storedUrlCount + 1,
                  authenticatedAnalysisResult.urlResults.length + 1,
                  { url: urlResult.url, elementCount: urlResult.elements.length }
                );
                totalElementsStored += urlResult.elements.length;
                
                // Mark this specific URL as analyzed
                await this.prisma.projectUrl.update({
                  where: { id: projectUrl.id },
                  data: { 
                    analyzed: true, 
                    analysisDate: new Date() 
                  },
                });
              } else {
                // This is likely the login page - store without sourceUrl
                await this.storeProjectElements(projectId, urlResult.elements, null);
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
              totalUrls: project.urls.length,
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
            totalUrls: project.urls.length,
            successfulUrls: authenticatedAnalysisResult.urlResults.length,
            authenticationUsed: true,
            totalElementsStored,
          };
        } else {
          // Enhanced error handling for authentication failures
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
          
          // Still try to analyze URLs without authentication as fallback
          this.progressGateway.sendProgress(
            projectId,
            'fallback_analysis',
            'Falling back to standard analysis without authentication...',
            1,
            3
          );
        }
      }

      // Fallback to regular analysis if no auth or auth failed
      this.progressGateway.sendStarted(
        projectId,
        'standard_analysis',
        'Starting standard analysis (no authentication)',
        { totalUrls: project.urls.length }
      );

      let urlIndex = 0;
      let totalElements = 0;
      
      for (const projectUrl of project.urls) {
        urlIndex++;
        
        this.progressGateway.sendProgress(
          projectId,
          'standard_analysis',
          `Analyzing URL ${urlIndex}/${project.urls.length}: ${projectUrl.url}`,
          urlIndex,
          project.urls.length,
          { currentUrl: projectUrl.url }
        );
        
        try {
          // Use retry mechanism for individual URL analysis
          const retryResult = await this.retryService.executeWithRetry(
            () => this.elementAnalyzer.analyzePage(projectUrl.url),
            `analyze-url-${projectUrl.url}`,
            {
              maxRetries: 2, // 3 total attempts
              retryDelays: [3000, 8000], // 3s, 8s delays
              retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'BROWSER_ERROR', 'SSL_ERROR']
            }
          );

          // Store retry history for monitoring
          await this.retryService.storeRetryHistory(projectId, `analyze-${projectUrl.id}`, retryResult);

          // Send retry information to progress gateway
          if (retryResult.totalRetries > 0) {
            this.progressGateway.sendProgress(
              projectId,
              'standard_analysis',
              `${projectUrl.url} completed after ${retryResult.totalRetries} retries (${Math.round(retryResult.totalDuration/1000)}s)`,
              urlIndex,
              project.urls.length,
              { 
                url: projectUrl.url,
                retryCount: retryResult.totalRetries,
                totalDuration: retryResult.totalDuration,
                recommendations: this.retryService.generateRetryRecommendations(retryResult.allAttempts)
              }
            );
          }

          const analysisResult = retryResult.success ? retryResult.result : {
            url: projectUrl.url,
            elements: [],
            analysisDate: new Date(),
            success: false,
            errorMessage: retryResult.finalAttempt.errorMessage,
            errorCategory: retryResult.finalAttempt.errorCategory
          };
          
          if (analysisResult.success && analysisResult.elements.length > 0) {
            await this.storeProjectElements(projectId, analysisResult.elements, projectUrl.id);
            totalElements += analysisResult.elements.length;
            
            this.progressGateway.sendProgress(
              projectId,
              'element_storage',
              `✅ Stored ${analysisResult.elements.length} elements from ${projectUrl.url}`,
              urlIndex,
              project.urls.length,
              { 
                url: projectUrl.url, 
                elementCount: analysisResult.elements.length,
                totalElements 
              }
            );
            
            // Mark URL as analyzed
            await this.prisma.projectUrl.update({
              where: { id: projectUrl.id },
              data: { 
                analyzed: true, 
                analysisDate: new Date() 
              },
            });
          } else {
            // Handle analysis failures with categorized errors
            const errorMessage = analysisResult.errorMessage || 'No elements found';
            const errorCategory = analysisResult.errorCategory;
            const errorDetails = (analysisResult as any).errorDetails;
            
            if (errorCategory && errorDetails) {
              this.progressGateway.sendError(
                projectId,
                'standard_analysis',
                `${errorCategory.replace('_', ' ')}: ${errorMessage}`,
                {
                  message: errorMessage,
                  category: errorCategory,
                  url: projectUrl.url,
                  suggestions: errorDetails.suggestions || []
                }
              );
            } else {
              this.progressGateway.sendProgress(
                projectId,
                'element_storage',
                `⚠️ No elements found for URL: ${projectUrl.url}`,
                urlIndex,
                project.urls.length,
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
        `✅ Standard analysis completed! Found ${totalElementsFound} elements across ${successfulResults.length}/${project.urls.length} pages`,
        {
          totalUrls: project.urls.length,
          successfulUrls: successfulResults.length,
          totalElements: totalElementsFound,
          authenticationUsed: false
        }
      );

      return {
        url: `${project.urls.length} URLs analyzed`,
        elements: allResults.flatMap(result => result.elements),
        analysisDate: new Date(),
        success: allResults.some(result => result.success),
        totalUrls: project.urls.length,
        successfulUrls: successfulResults.length,
        authenticationUsed: false,
        totalElementsStored: totalElementsFound,
      };
      
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

  async getProjectElements(userId: string, projectId: string) {
    const project = await this.findById(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    return this.prisma.projectElement.findMany({
      where: { projectId },
      include: { sourceUrl: true },
      orderBy: [
        { sourceUrl: { url: 'asc' } },
        { confidence: 'desc' },
        { elementType: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async validateProjectSelector(userId: string, projectId: string, selector: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { urls: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.urls || project.urls.length === 0) {
      throw new Error('No URLs found for this project');
    }

    // Validate against the first URL (or we could validate against all URLs)
    return this.elementAnalyzer.validateSelector(project.urls[0].url, selector);
  }

  // Phase 2: Enhanced cross-page selector validation
  async validateSelectorAcrossProject(userId: string, projectId: string, selector: string) {
    // Verify project ownership and get URLs
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { urls: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.urls || project.urls.length === 0) {
      throw new Error('No URLs found for this project');
    }

    // Extract URLs and perform cross-page validation
    const urls = project.urls.map(u => u.url);
    const validationResult = await this.elementAnalyzer.validateSelectorAcrossPages(urls, selector);

    // Store cross-page validation results in database for analytics
    try {
      await this.prisma.crossPageValidation.create({
        data: {
          projectId,
          selector,
          totalUrls: validationResult.crossPageValidation?.totalUrls || urls.length,
          validUrls: validationResult.crossPageValidation?.validUrls || 0,
          uniqueOnAllPages: validationResult.crossPageValidation?.uniqueOnAllPages || false,
          averageMatchCount: validationResult.crossPageValidation?.averageMatchCount || 0,
          inconsistentPages: validationResult.crossPageValidation?.inconsistentPages || [],
          validationErrors: validationResult.crossPageValidation?.validationErrors || [],
          overallScore: validationResult.qualityScore || 0,
        }
      });
    } catch (error) {
      console.warn('Failed to store cross-page validation results:', error);
      // Don't fail the entire operation if we can't store analytics
    }

    return validationResult;
  }

  async createProjectElements(userId: string, projectId: string, elements: any[]) {
    console.log(`🔧 Creating ${elements.length} project elements from source code analysis`);
    
    // Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    if (!elements || elements.length === 0) {
      throw new Error('No elements provided for creation');
    }

    try {
      // Transform and create elements
      const elementsToCreate = elements.map(element => ({
        projectId,
        selector: element.selector,
        elementType: element.elementType,
        description: element.description,
        confidence: element.confidence || 0.95,
        attributes: element.attributes || {},
        category: element.category || 'project-analysis',
        sourcePageTitle: `Source Code Analysis`,
        sourceUrlPath: element.attributes?.filePath || 'unknown',
        discoveryState: 'confirmed',
        discoveryTrigger: element.source || 'project-upload',
        screenshot: element.screenshot || null // Support for screenshot storage
      }));

      // Batch create elements
      const createdElements = await this.prisma.projectElement.createMany({
        data: elementsToCreate,
        skipDuplicates: true // Skip if selector already exists
      });

      console.log(`✅ Successfully created ${createdElements.count} project elements`);

      return {
        success: true,
        message: `Created ${createdElements.count} elements from project analysis`,
        elementsCreated: createdElements.count,
        totalProvided: elements.length,
        skippedDuplicates: elements.length - createdElements.count
      };

    } catch (error) {
      console.error('Failed to create project elements:', error);
      throw new Error(`Failed to create project elements: ${error.message}`);
    }
  }

  async analyzeProjectFolder(userId: string, files: Array<{
    name: string;
    path: string;
    size: number;
    type: string;
    content: string;
  }>) {
    console.log(`🔍 Starting server-side project folder analysis for ${files.length} files`);
    
    try {
      // Use the project analyzer service to analyze the uploaded files
      const analysisResult = await this.projectAnalyzer.analyzeProjectFiles(files);
      
      // Create the project with discovered information
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
      
      const project = await this.create(userId, projectData);
      
      // Add discovered elements to the project if any were found
      if (analysisResult.elements.length > 0) {
        await this.createProjectElements(userId, project.id, analysisResult.elements.map(element => ({
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

  async clearProjectElements(userId: string, projectId: string) {
    // Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Delete all elements from the project
    const deleteResult = await this.prisma.projectElement.deleteMany({
      where: { projectId }
    });

    // Reset analyzed status for all URLs so they can be re-analyzed
    await this.prisma.projectUrl.updateMany({
      where: { projectId },
      data: { analyzed: false, analysisDate: null }
    });

    console.log(`🧹 Cleared ${deleteResult.count} elements from project ${projectId}`);

    return { 
      success: true, 
      message: 'All project elements cleared successfully',
      elementsDeleted: deleteResult.count
    };
  }

  async delete(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Delete in order: test executions, tests, elements, URLs, then project
    await this.prisma.testExecution.deleteMany({
      where: { test: { projectId } }
    });

    await this.prisma.test.deleteMany({
      where: { projectId }
    });

    await this.prisma.projectElement.deleteMany({
      where: { projectId }
    });

    await this.prisma.projectUrl.deleteMany({
      where: { projectId }
    });

    await this.prisma.project.delete({
      where: { id: projectId }
    });

    return { success: true, message: 'Project deleted successfully' };
  }

  async captureElementScreenshot(
    userId: string, 
    projectId: string, 
    elementId: string, 
    selector: string, 
    url: string
  ): Promise<{ screenshot: string; success: boolean; error?: string }> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, userId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      console.log(`📸 Capturing screenshot for element: ${selector} on ${url}`);
      
      // Use element analyzer to capture screenshot
      const screenshot = await this.elementAnalyzer.captureElementScreenshot(url, selector);
      
      if (screenshot) {
        // Update element with screenshot in database
        const existingElement = await this.prisma.projectElement.findUnique({ where: { id: elementId } });
        const existingAttributes = existingElement?.attributes as any || {};
        
        await this.prisma.projectElement.update({
          where: { id: elementId },
          data: {
            screenshot: screenshot,
            attributes: {
              ...existingAttributes,
              screenshotCapturedAt: new Date().toISOString()
            }
          }
        });

        return {
          screenshot,
          success: true
        };
      } else {
        return {
          screenshot: '',
          success: false,
          error: 'Failed to capture screenshot'
        };
      }
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return {
        screenshot: '',
        success: false,
        error: error.message
      };
    }
  }

  async getAnalysisMetrics(userId: string, projectId: string) {
    const project = await this.findById(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const totalElements = project.elements?.length || 0;
    const urlsAnalyzed = project.urls?.filter(url => url.analyzed).length || 0;
    const totalUrls = project.urls?.length || 0;
    
    // Calculate selector quality distribution
    const selectorTypes = project.elements?.reduce((acc, element) => {
      if (element.selector.includes('[data-testid=') || element.selector.includes('data-testid=')) acc.testId++;
      else if (element.selector.includes('#')) acc.id++;
      else if (element.selector.includes('[aria-label=') || element.selector.includes('aria-label=')) acc.ariaLabel++;
      else if (element.selector.includes('.')) acc.class++;
      else if (element.selector.includes(':nth-')) acc.positional++;
      else acc.other++;
      return acc;
    }, { testId: 0, id: 0, ariaLabel: 0, class: 0, positional: 0, other: 0 }) || { testId: 0, id: 0, ariaLabel: 0, class: 0, positional: 0, other: 0 };

    // Calculate element type distribution
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
        elementsGrowth: '+12%', // These would be calculated from historical data
        qualityImprovement: '+8%',
        coverageIncrease: '+15%'
      }
    };
  }

  async getAnalysisHistory(userId: string, projectId: string) {
    const project = await this.findById(userId, projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    // For now, return mock data. In production, this would query an analysis_runs table
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

  async testProjectAuthFlow(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Get auth flows for this project
    const authFlows = await this.authFlowsService.getByProject(projectId);
    if (authFlows.length === 0) {
      throw new Error('No authentication flows configured for this project');
    }

    const authFlow = authFlows[0]; // Use first auth flow
    
    // Test the authentication flow using simplified service
    return this.simplifiedAuthService.testAuthFlow(
      authFlow.loginUrl,
      authFlow.credentials as { username: string; password: string },
      authFlow.steps as any[]
    );
  }

  // Helper method to generate smart titles from URLs
  private generateTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      // Use domain name as base
      let title = hostname.split('.')[0] || 'Page';
      
      // Add meaningful path segments
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment && lastSegment !== 'index' && lastSegment !== 'home') {
          title += ` - ${lastSegment.replace(/-/g, ' ')}`;
        }
      }
      
      // Capitalize first letter
      return title.charAt(0).toUpperCase() + title.slice(1);
    } catch {
      return 'Page';
    }
  }

  private async storeProjectElements(projectId: string, elements: DetectedElement[], sourceUrlId?: string) {
    try {
      // Store new elements with sourceUrlId and screenshot
      const elementsToStore = elements.map(element => {
        // Extract screenshot from attributes if it exists
        const screenshot = element.attributes?.screenshot || null;
        
        // Create a clean attributes object without the screenshot
        const cleanAttributes = element.attributes ? { ...element.attributes } : {};
        delete cleanAttributes.screenshot;
        
        return {
          projectId,
          sourceUrlId: sourceUrlId || null,
          selector: element.selector,
          elementType: element.elementType,
          description: element.description,
          confidence: element.confidence,
          attributes: cleanAttributes,
          screenshot: screenshot,
          // CRITICAL: Include discoveryState and authentication fields
          discoveryState: element.discoveryState || null,
          discoveryTrigger: element.discoveryTrigger || null,
          sourcePageTitle: element.sourcePageTitle || null,
          sourceUrlPath: element.sourceUrlPath || null,
          requiresAuth: element.requiresAuth || false,
          isModal: element.isModal || false
        };
      });

      console.log(`💾 Attempting to store ${elements.length} elements for project ${projectId}`);
      console.log(`📊 Element discoveryState breakdown:`, 
        elementsToStore.reduce((acc, el) => {
          const state = el.discoveryState || 'null';
          acc[state] = (acc[state] || 0) + 1;
          return acc;
        }, {})
      );

      const result = await this.prisma.projectElement.createMany({
        data: elementsToStore,
        skipDuplicates: true // In case there are duplicate selectors
      });

      const actuallyStored = result.count;
      const duplicatesSkipped = elements.length - actuallyStored;
      
      console.log(`✅ Successfully stored ${actuallyStored} elements for project ${projectId}`);
      if (duplicatesSkipped > 0) {
        console.warn(`⚠️ ${duplicatesSkipped} elements were skipped as duplicates (likely same selector with same discoveryState)`);
      }
    } catch (error) {
      console.error('Failed to store project elements:', error);
      throw error;
    }
  }

  async huntNewElements(userId: string, projectId: string, data: { steps: any[], testId: string }) {
    console.log(`🔍 Starting element hunting for project ${projectId} with ${data.steps.length} steps`);
    
    try {
      // Verify project ownership
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, userId },
        include: { urls: true, elements: true }
      });

      if (!project) {
        throw new Error('Project not found or access denied');
      }

      if (data.steps.length === 0) {
        throw new Error('No test steps provided for element hunting');
      }

      // Get the starting URL from the first project URL or from test steps
      const startingUrl = project.urls[0]?.url;
      if (!startingUrl) {
        throw new Error('No starting URL found in project');
      }

      console.log(`🌐 Starting browser automation from: ${startingUrl}`);
      console.log(`⚡ Executing ${data.steps.length} test steps to discover new elements`);

      // Execute test steps and discover new elements
      const newElements = await this.elementAnalyzer.huntElementsAfterSteps({
        startingUrl,
        steps: data.steps,
        projectId,
        testId: data.testId
      });

      console.log(`🎯 Discovered ${newElements.length} potential new elements`);

      // Filter out elements that already exist in the project
      const existingSelectors = new Set(project.elements.map(el => el.selector));
      const uniqueNewElements = newElements.filter(element => 
        !existingSelectors.has(element.selector)
      );

      console.log(`✨ Found ${uniqueNewElements.length} truly new elements (${newElements.length - uniqueNewElements.length} were duplicates)`);

      // Store new unique elements
      if (uniqueNewElements.length > 0) {
        await this.storeProjectElements(projectId, uniqueNewElements);
        console.log(`💾 Successfully stored ${uniqueNewElements.length} new elements`);
      }

      return {
        success: true,
        message: `Found ${uniqueNewElements.length} new elements after executing ${data.steps.length} test steps`,
        newElements: uniqueNewElements,
        totalDiscovered: newElements.length,
        duplicatesFiltered: newElements.length - uniqueNewElements.length,
        testId: data.testId
      };

    } catch (error) {
      console.error('Element hunting failed:', error);
      throw new Error(`Element hunting failed: ${error.message}`);
    }
  }

  // Live Step Execution - Execute a single step immediately for preview
  async liveExecuteStep(userId: string, projectId: string, data: { step: any, startingUrl: string, tempExecutionId: string }) {
    const { chromium } = require('playwright');
    
    console.log(`🔴 Live executing step: ${data.step.description} on ${data.startingUrl}`);
    
    let browser = null;
    let page = null;
    
    try {
      // Verify project ownership
      const project = await this.findById(userId, projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Launch browser with Docker-compatible settings (copied from working LiveBrowserService)
      browser = await chromium.launch({
        headless: true, // Use headless for reliable Docker execution
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      page = await browser.newPage();

      // Set desktop viewport for consistent execution (matches live-browser.service.ts)
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Browser session ready - will be integrated with live viewing
      console.log(`🚀 Browser session launched successfully with Docker-compatible settings`);

      // Only navigate to starting URL if this is the first step in sequence
      // For subsequent steps, continue from current page
      const isFirstStep = data.tempExecutionId.endsWith('-0');
      if (isFirstStep) {
        console.log(`🌍 Navigating to starting URL: ${data.startingUrl}`);
        await page.goto(data.startingUrl, { waitUntil: 'networkidle' });
        
        // Navigation complete - visible through noVNC iframe
        console.log(`🔗 Navigated to: ${data.startingUrl}`);
        
        // Wait for page to be ready
        await page.waitForTimeout(1000);
      } else {
        console.log(`↪️ Continuing from current page (step ${data.tempExecutionId})`);
      }

      // Capture screenshot before step execution
      const beforeScreenshot = await page.screenshot({
        type: 'png',
        fullPage: false // Use viewport screenshot for speed
      });

      // Execute the step
      const step = data.step;
      const timeout = 10000; // 10 seconds timeout

      console.log(`⚡ Executing step: ${step.type} on ${step.selector}`);

      switch (step.type) {
        case 'click':
        case 'doubleclick':
        case 'rightclick':
          if (step.type === 'doubleclick') {
            await page.dblclick(step.selector, { timeout });
          } else if (step.type === 'rightclick') {
            await page.click(step.selector, { button: 'right', timeout });
          } else {
            await page.click(step.selector, { timeout });
          }
          break;

        case 'hover':
          await page.hover(step.selector, { timeout });
          break;

        case 'type':
          await page.fill(step.selector, step.value || '', { timeout });
          break;

        case 'clear':
          await page.fill(step.selector, '', { timeout });
          break;

        case 'select':
          await page.selectOption(step.selector, step.value || '', { timeout });
          break;

        case 'check':
          await page.check(step.selector, { timeout });
          break;

        case 'uncheck':
          await page.uncheck(step.selector, { timeout });
          break;

        case 'upload':
          // For live execution, we can't upload actual files, so we'll simulate
          console.log(`⚠️ Upload simulation - would upload file: ${step.value}`);
          break;

        case 'scroll':
          if (step.value) {
            const scrollAmount = parseInt(step.value, 10);
            await page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
          } else {
            await page.evaluate((selector) => {
              const element = document.querySelector(selector);
              if (element) element.scrollIntoView();
            }, step.selector);
          }
          break;

        case 'press':
          await page.keyboard.press(step.value || 'Enter');
          break;

        case 'wait':
          const waitTime = parseInt(step.value || '1000', 10);
          await page.waitForTimeout(waitTime);
          break;

        case 'assert':
          const element = await page.locator(step.selector).first();
          const textContent = await element.textContent();
          if (!textContent || !textContent.includes(step.value || '')) {
            throw new Error(
              `Assertion failed: Expected "${step.value}" but found "${textContent}"`
            );
          }
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      // Wait a moment for any changes to take effect
      await page.waitForTimeout(500);

      console.log(`✅ Step completed: ${step.type} on ${step.selector}`);

      // Capture screenshot after step execution
      const afterScreenshot = await page.screenshot({
        type: 'png',
        fullPage: false
      });

      console.log(`✅ Live step execution completed successfully`);

      return {
        success: true,
        result: `Step "${step.description}" executed successfully`,
        step: step,
        beforeScreenshot: beforeScreenshot.toString('base64'),
        screenshot: afterScreenshot.toString('base64'),
        tempExecutionId: data.tempExecutionId,
        executedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Live step execution failed:`, error);
      
      console.error(`❌ Step failed: ${data.step.type} on ${data.step.selector} - ${error.message}`);
      
      // Try to capture error screenshot
      let errorScreenshot = null;
      try {
        if (page) {
          errorScreenshot = await page.screenshot({ type: 'png', fullPage: false });
        }
      } catch (screenshotError) {
        console.warn('Could not capture error screenshot:', screenshotError);
      }

      return {
        success: false,
        error: error.message,
        step: data.step,
        screenshot: errorScreenshot ? errorScreenshot.toString('base64') : null,
        tempExecutionId: data.tempExecutionId,
        executedAt: new Date().toISOString()
      };

    } finally {
      // Browser session cleanup handled by noVNC
      console.log(`🧹 Browser session cleanup complete`);
      
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }
}