import { Controller, Post, Get, Param, UseGuards, HttpCode, HttpStatus, Res, NotFoundException, StreamableFile, SetMetadata, Request, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join, resolve } from 'path';
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
  ) {}

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
  async runTestLive(@Request() req, @Param('testId') testId: string): Promise<ExecutionResult> {
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

      // Add test to queue with higher priority for live execution
      const { jobId, position } = await this.queueService.addTestExecution(testId, 10); // Higher priority

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
   * Returns 404 if execution not found or video doesn't exist.
   * Requires authentication and ownership verification.
   */
  @Get(':executionId/video')
  async getExecutionVideo(
    @Request() req,
    @Param('executionId') executionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      select: {
        id: true,
        videoPath: true,
        test: {
          select: {
            name: true,
            project: {
              select: {
                userId: true
              }
            }
          }
        }
      },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    // Verify ownership - user must own the project
    if (execution.test.project.userId !== req.user.id) {
      throw new ForbiddenException('Access denied to this execution');
    }

    if (!execution.videoPath) {
      throw new NotFoundException('No video available for this execution');
    }

    // Validate path to prevent traversal attacks
    const filePath = validateFilePath('test-videos', execution.videoPath);

    if (!existsSync(filePath)) {
      console.error(`Video file not found: ${filePath}`);
      throw new NotFoundException('Video file not found on disk');
    }

    res.set({
      'Content-Type': 'video/webm',
      'Content-Disposition': `inline; filename="${execution.test.name}-${execution.id}.webm"`,
      'Accept-Ranges': 'bytes',
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
  async downloadExecutionVideo(
    @Request() req,
    @Param('executionId') executionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      select: {
        id: true,
        videoPath: true,
        test: {
          select: {
            name: true,
            project: {
              select: {
                userId: true
              }
            }
          }
        }
      },
    });

    if (!execution || !execution.videoPath) {
      throw new NotFoundException('Video not found');
    }

    // Verify ownership - user must own the project
    if (execution.test.project.userId !== req.user.id) {
      throw new ForbiddenException('Access denied to this execution');
    }

    // Validate path to prevent traversal attacks
    const filePath = validateFilePath('test-videos', execution.videoPath);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Video file not found');
    }

    res.set({
      'Content-Type': 'video/webm',
      'Content-Disposition': `attachment; filename="${execution.test.name}-${execution.id}.webm"`,
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
  async getVideoThumbnail(
    @Request() req,
    @Param('executionId') executionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      select: {
        videoThumbnail: true,
        test: {
          select: {
            project: {
              select: {
                userId: true
              }
            }
          }
        }
      },
    });

    if (!execution?.videoThumbnail) {
      throw new NotFoundException('Thumbnail not available');
    }

    // Verify ownership - user must own the project
    if (execution.test.project.userId !== req.user.id) {
      throw new ForbiddenException('Access denied to this execution');
    }

    // Validate path to prevent traversal attacks
    const filePath = validateFilePath('test-videos', execution.videoThumbnail);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Thumbnail file not found');
    }

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    });

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }
}