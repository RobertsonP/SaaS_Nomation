import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElementAnalyzerService } from '../ai/element-analyzer.service';
import { SelectorQualityService } from '../ai/selector-quality.service';
import { DetectedElement } from '../ai/interfaces/element.interface';
import { TestStep } from '../common/types/execution.types';

@Injectable()
export class ProjectElementsService {
  constructor(
    private prisma: PrismaService,
    private elementAnalyzer: ElementAnalyzerService,
    private selectorQualityService: SelectorQualityService,
  ) {}

  async getProjectElements(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

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

  async createProjectElements(organizationId: string, projectId: string, elements: Array<{
    selector: string;
    elementType: string;
    description: string;
    confidence?: number;
    attributes?: Record<string, unknown>;
    category?: string;
    source?: string;
    screenshot?: string;
  }>) {
    console.log(`🔧 Creating ${elements.length} project elements from source code analysis`);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    if (!elements || elements.length === 0) {
      throw new Error('No elements provided for creation');
    }

    // Filter out low-quality selectors
    const filteredElements = elements.filter(element => {
      const { reject, reason } = this.selectorQualityService.shouldRejectSelector(element.selector);
      if (reject) {
        console.log(`🚫 Rejecting low-quality selector: "${element.selector}" - ${reason}`);
        return false;
      }
      return true;
    });

    console.log(`📊 Filtered ${elements.length - filteredElements.length} low-quality selectors, keeping ${filteredElements.length}`);

    if (filteredElements.length === 0) {
      console.warn('⚠️ All elements were filtered out due to low quality');
      return {
        success: true,
        message: 'All selectors were filtered due to low quality. Try adding data-testid attributes to your elements.',
        elementsCreated: 0,
        totalProvided: elements.length,
        skippedDuplicates: 0,
        filteredLowQuality: elements.length
      };
    }

    try {
      const elementsToCreate = filteredElements.map(element => ({
        projectId,
        selector: element.selector,
        elementType: element.elementType,
        description: element.description,
        confidence: element.confidence || 0.95,
        attributes: (element.attributes || {}) as object,
        category: element.category || 'project-analysis',
        sourcePageTitle: `Source Code Analysis`,
        sourceUrlPath: (element.attributes as Record<string, string>)?.filePath || 'unknown',
        discoveryState: 'confirmed',
        discoveryTrigger: element.source || 'project-upload',
        screenshot: element.screenshot || null
      }));

      const createdElements = await this.prisma.projectElement.createMany({
        data: elementsToCreate as any,
        skipDuplicates: true
      });

      console.log(`✅ Successfully created ${createdElements.count} project elements`);

      return {
        success: true,
        message: `Created ${createdElements.count} elements from project analysis`,
        elementsCreated: createdElements.count,
        totalProvided: elements.length,
        skippedDuplicates: filteredElements.length - createdElements.count,
        filteredLowQuality: elements.length - filteredElements.length
      };

    } catch (error) {
      console.error('Failed to create project elements:', error);
      throw new Error(`Failed to create project elements: ${error.message}`);
    }
  }

  async clearProjectElements(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const deleteResult = await this.prisma.projectElement.deleteMany({
      where: { projectId }
    });

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

  async storeProjectElements(projectId: string, elements: DetectedElement[], sourceUrlId?: string, authFlowId?: string) {
    try {
      console.log(`💾 Attempting to store ${elements.length} elements for project ${projectId}`);

      const elementsToStore = elements.map(element => {
        const screenshot = element.attributes?.screenshot || null;

        const cleanAttributes = element.attributes ? { ...element.attributes } : {};
        delete cleanAttributes.screenshot;

        return {
          projectId,
          sourceUrlId: sourceUrlId || null,
          authFlowId: authFlowId || null,
          selector: element.selector,
          elementType: element.elementType,
          description: element.description,
          confidence: element.confidence,
          attributes: cleanAttributes,
          screenshot: screenshot,
          discoveryState: element.discoveryState || null,
          discoveryTrigger: element.discoveryTrigger || null,
          sourcePageTitle: element.sourcePageTitle || null,
          sourceUrlPath: element.sourceUrlPath || null,
          requiresAuth: element.requiresAuth || false,
          isModal: element.isModal || false
        };
      });

      console.log(`📊 Element discoveryState breakdown:`,
        elementsToStore.reduce((acc, el) => {
          const state = el.discoveryState || 'null';
          acc[state] = (acc[state] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );

      // Use upsert logic to update existing elements instead of creating duplicates
      // This prevents element count from exploding on re-analysis
      let created = 0;
      let updated = 0;

      for (const element of elementsToStore) {
        try {
          await this.prisma.projectElement.upsert({
            where: {
              projectId_selector_sourceUrlId: {
                projectId: element.projectId,
                selector: element.selector,
                sourceUrlId: element.sourceUrlId || ''
              }
            },
            create: element,
            update: {
              // Update fields that might change between analyses
              elementType: element.elementType,
              description: element.description,
              confidence: element.confidence,
              attributes: element.attributes,
              screenshot: element.screenshot,
              discoveryState: element.discoveryState,
              discoveryTrigger: element.discoveryTrigger,
              sourcePageTitle: element.sourcePageTitle,
              sourceUrlPath: element.sourceUrlPath,
              requiresAuth: element.requiresAuth,
              isModal: element.isModal,
              updatedAt: new Date()
            }
          });
          created++; // Count as created for logging (upsert is atomic)
        } catch (upsertError) {
          // Handle case where sourceUrlId might be null (use different unique key)
          if (element.sourceUrlId === null) {
            try {
              // For null sourceUrlId, try to find and update by projectId + selector
              const existing = await this.prisma.projectElement.findFirst({
                where: {
                  projectId: element.projectId,
                  selector: element.selector,
                  sourceUrlId: null
                }
              });

              if (existing) {
                await this.prisma.projectElement.update({
                  where: { id: existing.id },
                  data: {
                    elementType: element.elementType,
                    description: element.description,
                    confidence: element.confidence,
                    attributes: element.attributes,
                    screenshot: element.screenshot,
                    discoveryState: element.discoveryState,
                    updatedAt: new Date()
                  }
                });
                updated++;
              } else {
                await this.prisma.projectElement.create({ data: element });
                created++;
              }
            } catch (fallbackError) {
              console.warn(`⚠️ Failed to store element ${element.selector}:`, fallbackError.message);
            }
          } else {
            console.warn(`⚠️ Failed to upsert element ${element.selector}:`, upsertError.message);
          }
        }
      }

      console.log(`✅ Successfully stored elements for project ${projectId}: ${created} created/updated`);
    } catch (error) {
      console.error('Failed to store project elements:', error);
      throw error;
    }
  }

  async captureElementScreenshot(
    organizationId: string,
    projectId: string,
    elementId: string,
    selector: string,
    url: string
  ): Promise<{ screenshot: string; success: boolean; error?: string }> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      console.log(`📸 Capturing screenshot for element: ${selector} on ${url}`);

      const screenshot = await this.elementAnalyzer.captureElementScreenshot(url, selector);

      if (screenshot) {
        const existingElement = await this.prisma.projectElement.findUnique({ where: { id: elementId } });
        const existingAttributes = existingElement?.attributes as Record<string, unknown> || {};

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

  async huntNewElements(organizationId: string, projectId: string, data: {
    steps: TestStep[];
    testId: string;
  }) {
    console.log(`🔍 Starting element hunting for project ${projectId} with ${data.steps.length} steps`);

    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId },
        include: { urls: true, elements: true }
      });

      if (!project) {
        throw new Error('Project not found or access denied');
      }

      if (data.steps.length === 0) {
        throw new Error('No test steps provided for element hunting');
      }

      const startingUrl = project.urls[0]?.url;
      if (!startingUrl) {
        throw new Error('No starting URL found in project');
      }

      console.log(`🌐 Starting browser automation from: ${startingUrl}`);
      console.log(`⚡ Executing ${data.steps.length} test steps to discover new elements`);

      const huntingResult = await this.elementAnalyzer.huntElementsAfterSteps({
        startingUrl,
        steps: data.steps,
        projectId,
        testId: data.testId
      });

      if (!huntingResult.success) {
        console.error(`❌ Element hunting failed: ${huntingResult.error}`);
        return {
          success: false,
          error: huntingResult.error,
          message: 'Element hunting failed - see error for details',
          newElements: [],
          totalDiscovered: 0,
          duplicatesFiltered: 0,
          testId: data.testId
        };
      }

      const newElements = huntingResult.elements || [];
      console.log(`🎯 Discovered ${newElements.length} potential new elements`);

      const existingSelectors = new Set(project.elements.map(el => el.selector));
      const uniqueNewElements = newElements.filter(element =>
        !existingSelectors.has(element.selector)
      );

      console.log(`✨ Found ${uniqueNewElements.length} truly new elements (${newElements.length - uniqueNewElements.length} were duplicates)`);

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
      return {
        success: false,
        error: error.message || 'Unknown error during element hunting',
        message: 'Element hunting failed due to unexpected error',
        newElements: [],
        totalDiscovered: 0,
        duplicatesFiltered: 0,
        testId: data.testId
      };
    }
  }
}
