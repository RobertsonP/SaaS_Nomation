import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElementAnalyzerService } from '../ai/element-analyzer.service';
import { DetectedElement } from '../ai/interfaces/element.interface';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private elementAnalyzer: ElementAnalyzerService,
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
        elements: true,
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
        try {
          // Get actual page title
          const metadata = await this.elementAnalyzer.getPageMetadata(urlData.url);
          urlsWithTitles.push({
            url: urlData.url,
            title: metadata.title || urlData.title || 'Page',
            description: metadata.description || urlData.description || 'Project URL',
            projectId: project.id,
          });
        } catch (error) {
          console.error(`Failed to get metadata for ${urlData.url}:`, error);
          // Fallback to provided data
          urlsWithTitles.push({
            url: urlData.url,
            title: urlData.title || 'Page',
            description: urlData.description || 'Project URL',
            projectId: project.id,
          });
        }
      }

      await this.prisma.projectUrl.createMany({
        data: urlsWithTitles,
      });
    }

    return project;
  }

  async analyzeProjectPages(userId: string, projectId: string) {
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

    const allResults = [];

    try {
      // Analyze each URL in the project
      for (const projectUrl of project.urls) {
        console.log(`Analyzing URL: ${projectUrl.url}`);
        
        try {
          const analysisResult = await this.elementAnalyzer.analyzePage(projectUrl.url);
          
          if (analysisResult.success && analysisResult.elements.length > 0) {
            await this.storeProjectElements(projectId, analysisResult.elements, projectUrl.id);
            console.log(`Stored ${analysisResult.elements.length} elements for URL ${projectUrl.url}`);
            
            // Mark URL as analyzed
            await this.prisma.projectUrl.update({
              where: { id: projectUrl.id },
              data: { 
                analyzed: true, 
                analysisDate: new Date() 
              },
            });
          } else {
            console.log(`No elements found for URL: ${projectUrl.url}`);
            // Still mark as analyzed even if no elements found
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
          console.error(`Failed to analyze URL ${projectUrl.url}:`, urlError);
          // Mark as analyzed with error
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

      // Return combined results
      const totalElements = allResults.reduce((sum, result) => sum + result.elements.length, 0);
      
      return {
        url: `${project.urls.length} URLs analyzed`,
        elements: allResults.flatMap(result => result.elements),
        analysisDate: new Date(),
        success: allResults.some(result => result.success),
        totalUrls: project.urls.length,
        successfulUrls: allResults.filter(result => result.success).length,
      };
      
    } catch (error) {
      console.error('Analysis failed:', error);
      return {
        url: project.urls[0]?.url || 'Unknown',
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

  private async storeProjectElements(projectId: string, elements: DetectedElement[], sourceUrlId?: string) {
    try {
      // Store new elements with sourceUrlId
      const elementsToStore = elements.map(element => ({
        projectId,
        sourceUrlId: sourceUrlId || null,
        selector: element.selector,
        elementType: element.elementType,
        description: element.description,
        confidence: element.confidence,
        attributes: element.attributes || {}
      }));

      await this.prisma.projectElement.createMany({
        data: elementsToStore,
        skipDuplicates: true // In case there are duplicate selectors
      });

      console.log(`Successfully stored ${elements.length} elements for project ${projectId}`);
    } catch (error) {
      console.error('Failed to store project elements:', error);
      throw error;
    }
  }
}