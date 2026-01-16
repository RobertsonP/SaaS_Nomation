import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElementAnalyzerService } from '../ai/element-analyzer.service';

@Injectable()
export class SelectorValidationService {
  constructor(
    private prisma: PrismaService,
    private elementAnalyzer: ElementAnalyzerService,
  ) {}

  async validateProjectSelector(organizationId: string, projectId: string, selector: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: { urls: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.urls || project.urls.length === 0) {
      throw new Error('No URLs found for this project');
    }

    return this.elementAnalyzer.validateSelector(project.urls[0].url, selector);
  }

  async validateSelectorAcrossProject(organizationId: string, projectId: string, selector: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: { urls: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.urls || project.urls.length === 0) {
      throw new Error('No URLs found for this project');
    }

    const urls = project.urls.map(u => u.url);
    const validationResult = await this.elementAnalyzer.validateSelectorAcrossPages(urls, selector);

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
    }

    return validationResult;
  }

  async healSelector(organizationId: string, projectId: string, data: { failedSelector: string; url?: string }) {
    const element = await this.prisma.projectElement.findFirst({
      where: {
        projectId,
        selector: data.failedSelector
      }
    });

    const suggestions: Array<{ selector: string; confidence: number; strategy: string }> = [];

    if (element && element.fallbackSelectors && element.fallbackSelectors.length > 0) {
      suggestions.push(...element.fallbackSelectors.map(s => ({
        selector: s,
        confidence: 0.8,
        strategy: 'stored_fallback'
      })));
    }

    if (suggestions.length === 0) {
      if (data.failedSelector.includes('submit')) {
        suggestions.push({ selector: 'button[type="submit"]', confidence: 0.5, strategy: 'heuristic' });
      }
    }

    return {
      originalSelector: data.failedSelector,
      suggestions: suggestions
    };
  }
}
