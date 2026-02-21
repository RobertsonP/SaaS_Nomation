import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Normalize URL for comparison to prevent duplicates
 * - Removes trailing slashes
 * - Normalizes 127.0.0.1 to localhost
 * - Removes www. prefix
 * - Lowercases for comparison
 */
function normalizeUrlForComparison(url: string): string {
  try {
    const urlObj = new URL(url);
    let normalized = urlObj.origin + urlObj.pathname;

    // Remove trailing slash (except for root path)
    if (normalized.endsWith('/') && normalized !== urlObj.origin + '/') {
      normalized = normalized.slice(0, -1);
    }

    // Normalize 127.0.0.1 to localhost
    normalized = normalized.replace('://127.0.0.1', '://localhost');

    // Remove www.
    normalized = normalized.replace('://www.', '://');

    // Lowercase for case-insensitive comparison
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async findByOrganization(organizationId: string, userId?: string) {
    // Build OR condition to include:
    // 1. Projects belonging to the organization
    // 2. Projects with null organizationId but matching userId (legacy projects)
    const whereCondition = userId
      ? {
          OR: [
            { organizationId },
            { organizationId: null, userId },
          ],
        }
      : { organizationId };

    return this.prisma.project.findMany({
      where: whereCondition,
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

  async findById(organizationId: string, id: string) {
    return this.prisma.project.findFirst({
      where: { id, organizationId },
      include: {
        urls: true,
        elements: {
          include: {
            sourceUrl: true,
            authFlow: { select: { id: true, name: true } }
          },
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

  async create(userId: string, organizationId: string, data: {
    name: string;
    description?: string;
    urls: Array<{ url: string; title?: string; description?: string }>
  }) {
    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        userId,
        organizationId,
      },
    });

    if (data.urls && data.urls.length > 0) {
      const urlsWithTitles = data.urls.map(urlData => ({
        url: urlData.url,
        title: urlData.title || this.generateTitleFromUrl(urlData.url),
        description: urlData.description || 'Project URL',
        projectId: project.id,
      }));

      await this.prisma.projectUrl.createMany({
        data: urlsWithTitles,
      });
    }

    return project;
  }

  async update(organizationId: string, projectId: string, data: {
    name?: string;
    description?: string;
    urls?: Array<{ url: string; title?: string; description?: string }>
  }) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const updateData: Partial<{ name: string; description: string }> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    await this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    if (data.urls !== undefined) {
      const currentUrls = await this.prisma.projectUrl.findMany({
        where: { projectId },
        select: { id: true, url: true }
      });

      // Use normalized URL comparison to prevent duplicates with trailing slashes
      const currentUrlMap = new Map(currentUrls.map(u => [normalizeUrlForComparison(u.url), u.id]));
      const currentUrlOriginalMap = new Map(currentUrls.map(u => [normalizeUrlForComparison(u.url), u.url]));
      const newUrlSet = new Set(data.urls.map(u => normalizeUrlForComparison(u.url)));

      const urlsToDelete = currentUrls.filter(u => !newUrlSet.has(normalizeUrlForComparison(u.url)));
      const urlsToAdd = data.urls.filter(u => !currentUrlMap.has(normalizeUrlForComparison(u.url)));

      if (urlsToDelete.length > 0) {
        await this.prisma.projectUrl.deleteMany({
          where: { id: { in: urlsToDelete.map(u => u.id) } }
        });
        console.log(`🗑️ Deleted ${urlsToDelete.length} URLs and their elements`);
      }

      if (urlsToAdd.length > 0) {
        const urlsWithTitles = urlsToAdd.map(urlData => ({
          url: urlData.url,
          title: urlData.title || this.generateTitleFromUrl(urlData.url),
          description: urlData.description || 'Project URL',
          projectId: projectId,
        }));

        await this.prisma.projectUrl.createMany({
          data: urlsWithTitles,
        });
        console.log(`✅ Added ${urlsToAdd.length} new URLs`);
      }

      console.log(`🔄 URL update complete: ${urlsToDelete.length} removed, ${urlsToAdd.length} added, ${currentUrls.length - urlsToDelete.length} preserved`);
    }

    return this.findById(organizationId, projectId);
  }

  async delete(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Delete in correct order to avoid foreign key constraint violations
    // 1. Delete test executions first
    await this.prisma.testExecution.deleteMany({
      where: { test: { projectId } }
    });

    // 2. Delete tests
    await this.prisma.test.deleteMany({
      where: { projectId }
    });

    // 3. Delete elements
    await this.prisma.projectElement.deleteMany({
      where: { projectId }
    });

    // 4. Delete page relationships (before URLs to avoid FK constraint)
    await this.prisma.pageRelationship.deleteMany({
      where: { projectId }
    });

    // 5. Delete page states
    await this.prisma.pageState.deleteMany({
      where: { projectId }
    });

    // 6. Delete browser sessions via auth flows
    await this.prisma.browserSession.deleteMany({
      where: { authFlow: { projectId } }
    });

    // 7. Delete auth flows
    await this.prisma.authFlow.deleteMany({
      where: { projectId }
    });

    // 8. Delete URLs
    await this.prisma.projectUrl.deleteMany({
      where: { projectId }
    });

    // 9. Finally delete the project itself
    await this.prisma.project.delete({
      where: { id: projectId }
    });

    return { success: true, message: 'Project deleted successfully' };
  }

  /**
   * Get aggregated test execution statistics for a project
   */
  async getTestStats(organizationId: string, projectId: string) {
    // Verify project belongs to organization
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      return null;
    }

    // Get all test executions for tests in this project
    const executions = await this.prisma.testExecution.findMany({
      where: {
        test: {
          projectId: projectId,
        },
      },
      select: {
        id: true,
        status: true,
        results: true,
      },
    });

    // Calculate aggregated stats
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const execution of executions) {
      const status = execution.status?.toLowerCase() || '';

      if (status === 'passed' || status === 'success' || status === 'completed') {
        totalPassed++;
      } else if (status === 'failed' || status === 'error') {
        totalFailed++;
      } else if (status === 'skipped') {
        totalSkipped++;
      }
    }

    const totalExecutions = executions.length;
    const successRate = totalExecutions > 0
      ? Math.round((totalPassed / totalExecutions) * 100)
      : 0;

    // Calculate regressions (tests that passed before but failed recently)
    // A simple approach: count tests that have both passed and failed executions
    const testExecutionMap = new Map<string, { passed: boolean; failed: boolean }>();

    for (const execution of executions) {
      const results = execution.results as any;
      const testId = results?.testId || execution.id;

      if (!testExecutionMap.has(testId)) {
        testExecutionMap.set(testId, { passed: false, failed: false });
      }

      const status = execution.status?.toLowerCase() || '';
      if (status === 'passed' || status === 'success' || status === 'completed') {
        testExecutionMap.get(testId)!.passed = true;
      } else if (status === 'failed' || status === 'error') {
        testExecutionMap.get(testId)!.failed = true;
      }
    }

    // Regressions = tests that have both passed and failed (meaning they regressed at some point)
    let regressions = 0;
    for (const [, data] of testExecutionMap) {
      if (data.passed && data.failed) {
        regressions++;
      }
    }

    return {
      totalExecutions,
      totalPassed,
      totalFailed,
      totalSkipped,
      regressions,
      successRate,
    };
  }

  private generateTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);

      let title = hostname.split('.')[0] || 'Page';

      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment && lastSegment !== 'index' && lastSegment !== 'home') {
          title += ` - ${lastSegment.replace(/-/g, ' ')}`;
        }
      }

      return title.charAt(0).toUpperCase() + title.slice(1);
    } catch {
      return 'Page';
    }
  }
}
