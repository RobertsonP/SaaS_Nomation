import { Controller, Post, Get, Param, Query, Body, UseGuards, HttpCode, HttpStatus, Res, NotFoundException, StreamableFile, SetMetadata, Request, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join, resolve } from 'path';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { ExecutionService } from './execution.service';
import { ExecutionQueueService } from '../queue/execution-queue.service';
import { PrismaService } from '../prisma/prisma.service';

export const SkipAuth = () => SetMetadata('skipAuth', true);

// Standardized Result Object interfaces
interface ExecutionResult {
  success: boolean;
  execution?: any;
  error?: string;
  message?: string;
  jobId?: string;
  position?: number;
}

/**
 * Validates that a file path is within the expected base directory
 * Prevents path traversal attacks
 */
function validateFilePath(baseDir: string, filePath: string): string {
  const absoluteBaseDir = resolve(process.cwd(), baseDir);
  const absoluteFilePath = resolve(process.cwd(), filePath);

  if (!absoluteFilePath.startsWith(absoluteBaseDir)) {
    throw new ForbiddenException('Invalid file path');
  }

  return absoluteFilePath;
}

@Controller('api/execution')
@UseGuards(JwtAuthGuard)
export class ExecutionController {
  constructor(
    private executionService: ExecutionService,
    private queueService: ExecutionQueueService,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Resolve userId from either an Authorization Bearer header (XHR clients)
   * or a ?token= query parameter (used by <video src> which cannot set headers).
   * Throws UnauthorizedException if neither is valid.
   */
  private resolveUserIdForVideo(req: any, queryToken: string | undefined): string {
    const authHeader: string | undefined = req?.headers?.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (queryToken) {
      token = queryToken;
    } else {
      throw new UnauthorizedException('Missing auth token');
    }
    try {
      const payload: any = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      const userId = payload?.userId || payload?.sub;
      if (!userId) {
        throw new UnauthorizedException('Token has no userId');
      }
      return userId;
    } catch {
      throw new UnauthorizedException('Invalid auth token');
    }
  }

  /**
   * Verify the resolved user has access to the project that owns this execution
   * (i.e. is a member of its organization). Mirrors the organizationId checks
   * elsewhere in this controller (lines 100, 159) instead of the project-creator
   * check, which would lock other org members out of recordings.
   */
  private async assertProjectAccess(userId: string, projectOrganizationId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: projectOrganizationId, userId } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied to this execution');
    }
  }

  /**
   * Run a test using job queue.
   * Returns immediately with job ID and position in queue.
   * ALWAYS returns 200 OK.
   */
  @Post('test/:testId/run')
  @UseGuards(OrganizationGuard)
  @HttpCode(HttpStatus.OK) // Always 200 OK
  async runTest(@Request() req, @Param('testId') testId: string): Promise<ExecutionResult> {
    try {
      // Verify test ownership before execution
      const test = await this.prisma.test.findUnique({
        where: { id: testId },
        select: { id: true, project: { select: { organizationId: true } } }
      });

      if (!test) {
        return {
          success: false,
          error: 'Test not found',
          message: 'Test not found'
        };
      }

      if (test.project.organizationId !== req.organization.id) {
        return {
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to execute tests in this organization'
        };
      }

      // Add test to queue instead of executing directly
      const { jobId, position } = await this.queueService.addTestExecution(testId);

      console.log(`✅ Test ${testId} queued as job ${jobId} at position ${position}`);

      // Return immediately with job info
      return {
        success: true,
        jobId,
        position,
        message: `Test queued successfully (Position ${position} in queue)`
      };
    } catch (error) {
      console.error('❌ Failed to queue test:', error);

      return {
        success: false,
        error: error.message || 'Failed to queue test execution',
        message: 'Failed to add test to execution queue'
      };
    }
  }

  /**
   * Run a test with live WebSocket updates using job queue.
   * Returns immediately with job ID and position in queue.
   * ALWAYS returns 200 OK.
   */
  @Post('test/:testId/run-live')
  @UseGuards(OrganizationGuard)
  @HttpCode(HttpStatus.OK) // Always 200 OK
  async runTestLive(
    @Request() req,
    @Param('testId') testId: string,
    @Body() body?: { headed?: boolean },
  ): Promise<ExecutionResult> {
    try {
      // Verify test ownership before execution
      const test = await this.prisma.test.findUnique({
        where: { id: testId },
        select: { id: true, project: { select: { organizationId: true } } }
      });

      if (!test) {
        return {
          success: false,
          error: 'Test not found',
          message: 'Test not found'
        };
      }

      if (test.project.organizationId !== req.organization.id) {
        return {
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to execute tests in this organization'
        };
      }

      // Add test to queue with higher priority for live execution.
      // Pass `headed` flag through so the processor can decide whether to launch
      // a visible Chromium window (with graceful headless fallback if no DISPLAY).
      const { jobId, position } = await this.queueService.addTestExecution(testId, 10, {
        headed: body?.headed === true,
      });

      console.log(`✅ Live test ${testId} queued as job ${jobId} at position ${position}`);

      return {
        success: true,
        jobId,
        position,
        message: `Live test queued successfully (Position ${position} in queue)`
      };
    } catch (error) {
      console.error('❌ Failed to queue live test:', error);

      return {
        success: false,
        error: error.message || 'Failed to queue live test execution',
        message: 'Failed to add live test to execution queue'
      };
    }
  }

  /**
   * Get job status by job ID
   */
  @Get('job/:jobId')
  @HttpCode(HttpStatus.OK)
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
      const status = await this.queueService.getJobStatus(jobId);

      if (!status) {
        return {
          success: false,
          error: 'Job not found'
        };
      }

      return {
        success: true,
        job: status
      };
    } catch (error) {
      console.error('❌ Failed to get job status:', error);
      return {
        success: false,
        error: error.message || 'Failed to get job status'
      };
    }
  }

  /**
   * Get queue status (admin endpoint)
   */
  @Get('queue/status')
  @HttpCode(HttpStatus.OK)
  async getQueueStatus() {
    try {
      const status = await this.queueService.getQueueStatus();

      return {
        success: true,
        queue: status
      };
    } catch (error) {
      console.error('❌ Failed to get queue status:', error);
      return {
        success: false,
        error: error.message || 'Failed to get queue status'
      };
    }
  }

  /**
   * Cancel a job (admin endpoint)
   */
  @Post('job/:jobId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelJob(@Param('jobId') jobId: string) {
    try {
      const cancelled = await this.queueService.cancelJob(jobId);

      return {
        success: cancelled,
        message: cancelled ? 'Job cancelled successfully' : 'Job cannot be cancelled (already processing or completed)'
      };
    } catch (error) {
      console.error('❌ Failed to cancel job:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel job'
      };
    }
  }

  /**
   * GET /api/execution/stats
   * Returns real-time execution statistics scoped to the user's organization.
   */
  @Get('stats')
  @UseGuards(OrganizationGuard)
  @HttpCode(HttpStatus.OK)
  async getExecutionStats(@Request() req) {
    try {
      const orgProjects = await this.prisma.project.findMany({
        where: { organizationId: req.organization.id },
        select: { id: true },
      });
      const projectIds = orgProjects.map(p => p.id);
      const orgFilter = { test: { projectId: { in: projectIds } } };

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [running, totalToday, passedLast7d, totalLast7d] = await Promise.all([
        this.prisma.testExecution.count({ where: { ...orgFilter, status: 'running' } }),
        this.prisma.testExecution.count({ where: { ...orgFilter, startedAt: { gte: today } } }),
        this.prisma.testExecution.count({ where: { ...orgFilter, status: 'passed', startedAt: { gte: sevenDaysAgo } } }),
        this.prisma.testExecution.count({ where: { ...orgFilter, startedAt: { gte: sevenDaysAgo } } }),
      ]);

      return {
        success: true,
        running,
        totalToday,
        passRate7d: totalLast7d > 0 ? Math.round((passedLast7d / totalLast7d) * 100) : 0,
        totalLast7d,
      };
    } catch (error) {
      console.error('Failed to get execution stats:', error);
      return {
        success: false,
        error: error.message || 'Failed to get execution stats',
      };
    }
  }

  /**
   * GET /api/execution/trends?days=30
   * Returns daily pass/fail counts for the specified number of days, scoped to the user's organization.
   */
  @Get('trends')
  @UseGuards(OrganizationGuard)
  @HttpCode(HttpStatus.OK)
  async getExecutionTrends(@Request() req, @Query('days') days?: string) {
    try {
      const orgProjects = await this.prisma.project.findMany({
        where: { organizationId: req.organization.id },
        select: { id: true },
      });
      const projectIds = orgProjects.map(p => p.id);

      const numDays = parseInt(days || '30', 10);
      const since = new Date();
      since.setDate(since.getDate() - numDays);

      const executions = await this.prisma.testExecution.findMany({
        where: { test: { projectId: { in: projectIds } }, startedAt: { gte: since } },
        select: { status: true, startedAt: true },
        orderBy: { startedAt: 'asc' },
      });

      const byDay: Record<string, { passed: number; failed: number; total: number }> = {};
      executions.forEach(e => {
        const day = e.startedAt.toISOString().split('T')[0];
        if (!byDay[day]) byDay[day] = { passed: 0, failed: 0, total: 0 };
        byDay[day].total++;
        if (e.status === 'passed') byDay[day].passed++;
        if (e.status === 'failed') byDay[day].failed++;
      });

      return {
        success: true,
        trends: Object.entries(byDay).map(([date, data]) => ({
          date,
          ...data,
          passRate: data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0,
        })),
      };
    } catch (error) {
      console.error('Failed to get execution trends:', error);
      return {
        success: false,
        error: error.message || 'Failed to get execution trends',
        trends: [],
      };
    }
  }

  /**
   * Get test execution results.
   * Returns results array with 200 OK.
   */
  @Get('test/:testId/results')
  @HttpCode(HttpStatus.OK)
  async getTestResults(@Param('testId') testId: string) {
    try {
      const results = await this.executionService.getExecutionResults(testId);
      return {
        success: true,
        results,
        count: results.length
      };
    } catch (error) {
      console.error('❌ Failed to get test results:', error);
      return {
        success: false,
        error: error.message || 'Failed to get test results',
        results: []
      };
    }
  }

  /**
   * Get a specific execution by ID.
   * Returns execution data with 200 OK.
   */
  @Get(':executionId')
  @HttpCode(HttpStatus.OK)
  async getExecution(@Param('executionId') executionId: string) {
    try {
      const execution = await this.executionService.getExecutionById(executionId);

      if (!execution) {
        return {
          success: false,
          error: 'Execution not found'
        };
      }

      return {
        success: true,
        execution
      };
    } catch (error) {
      console.error('❌ Failed to get execution:', error);
      return {
        success: false,
        error: error.message || 'Failed to get execution'
      };
    }
  }

  /**
   * GET /api/execution/:executionId/video
   *
   * Streams video file for a test execution.
   * Auth: Bearer header OR ?token=... query param. The query path exists
   * because <video src> can't carry custom headers, so the frontend appends
   * the JWT as a query parameter.
   */
  @Get(':executionId/video')
  @SkipAuth()
  async getExecutionVideo(
    @Request() req,
    @Param('executionId') executionId: string,
    @Query('token') queryToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = this.resolveUserIdForVideo(req, queryToken);

    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      select: {
        id: true,
        videoPath: true,
        test: {
          select: {
            name: true,
            project: {
              select: { organizationId: true }
            }
          }
        }
      },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    await this.assertProjectAccess(userId, execution.test.project.organizationId);

    if (!execution.videoPath) {
      throw new NotFoundException('No video available for this execution');
    }

    // Validate path to prevent traversal attacks
    const filePath = validateFilePath('uploads', execution.videoPath);

    if (!existsSync(filePath)) {
      console.error(`Video file not found: ${filePath}`);
      throw new NotFoundException('Video file not found on disk');
    }

    res.set({
      'Content-Type': 'video/webm',
      'Content-Disposition': `inline; filename="${execution.test.name}-${execution.id}.webm"`,
      'Accept-Ranges': 'bytes',
      // Browsers block <video src> cross-origin without this when COEP isn't relaxed.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }

  /**
   * GET /api/execution/:executionId/video/download
   *
   * Force download instead of inline playback.
   * Requires authentication and ownership verification.
   */
  @Get(':executionId/video/download')
  @SkipAuth()
  async downloadExecutionVideo(
    @Request() req,
    @Param('executionId') executionId: string,
    @Query('token') queryToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = this.resolveUserIdForVideo(req, queryToken);

    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      select: {
        id: true,
        videoPath: true,
        test: {
          select: {
            name: true,
            project: {
              select: { organizationId: true }
            }
          }
        }
      },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    await this.assertProjectAccess(userId, execution.test.project.organizationId);

    if (!execution.videoPath) {
      throw new NotFoundException('Video not found');
    }

    // Validate path to prevent traversal attacks
    const filePath = validateFilePath('uploads', execution.videoPath);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Video file not found');
    }

    res.set({
      'Content-Type': 'video/webm',
      'Content-Disposition': `attachment; filename="${execution.test.name}-${execution.id}.webm"`,
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }

  /**
   * GET /api/execution/:executionId/video/thumbnail
   *
   * Serves thumbnail image for video preview.
   * Requires authentication and ownership verification.
   */
  @Get(':executionId/video/thumbnail')
  @SkipAuth()
  async getVideoThumbnail(
    @Request() req,
    @Param('executionId') executionId: string,
    @Query('token') queryToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = this.resolveUserIdForVideo(req, queryToken);

    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      select: {
        videoThumbnail: true,
        test: {
          select: {
            project: {
              select: { organizationId: true }
            }
          }
        }
      },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    await this.assertProjectAccess(userId, execution.test.project.organizationId);

    if (!execution.videoThumbnail) {
      throw new NotFoundException('Thumbnail not available');
    }

    // Validate path to prevent traversal attacks
    const filePath = validateFilePath('uploads', execution.videoThumbnail);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Thumbnail file not found');
    }

    res.set({
      'Content-Type': 'image/png',
      // Auth-gated resource — must NOT land in shared caches.
      'Cache-Control': 'private, max-age=3600',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }
}