import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { UPLOAD_CONFIG } from '../config/upload.config';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class VideoCleanupService {
  private readonly logger = new Logger(VideoCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Runs daily at 2 AM to clean up old video files
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldVideos() {
    this.logger.log('🗑️  Starting video cleanup job...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - UPLOAD_CONFIG.retentionDays);

    // Find old executions with videos
    const oldExecutions = await this.prisma.testExecution.findMany({
      where: {
        completedAt: { lt: cutoffDate },
        videoPath: { not: null },
      },
      select: { id: true, videoPath: true, videoThumbnail: true, completedAt: true },
    });

    this.logger.log(`Found ${oldExecutions.length} old videos to clean up`);

    let deletedCount = 0;

    for (const execution of oldExecutions) {
      try {
        // Delete video file
        if (execution.videoPath) {
          const videoPath = join(process.cwd(), execution.videoPath);
          if (existsSync(videoPath)) {
            await unlink(videoPath);
          }
        }

        // Delete thumbnail file
        if (execution.videoThumbnail) {
          const thumbPath = join(process.cwd(), execution.videoThumbnail);
          if (existsSync(thumbPath)) {
            await unlink(thumbPath);
          }
        }

        // Clear videoPath and videoThumbnail from database
        await this.prisma.testExecution.update({
          where: { id: execution.id },
          data: { videoPath: null, videoThumbnail: null },
        });

        deletedCount++;
      } catch (error) {
        this.logger.warn(`Failed to delete video: ${execution.videoPath}`, error.message);
      }
    }

    this.logger.log(`✅ Video cleanup complete. Deleted ${deletedCount}/${oldExecutions.length} files`);
  }

  /**
   * Manual cleanup method (for testing or admin use)
   */
  async cleanupExecutionVideo(executionId: string): Promise<boolean> {
    const execution = await this.prisma.testExecution.findUnique({
      where: { id: executionId },
      select: { videoPath: true, videoThumbnail: true },
    });

    if (!execution?.videoPath && !execution?.videoThumbnail) {
      return false;
    }

    try {
      // Delete video file
      if (execution.videoPath) {
        const videoPath = join(process.cwd(), execution.videoPath);
        if (existsSync(videoPath)) {
          await unlink(videoPath);
        }
      }

      // Delete thumbnail file
      if (execution.videoThumbnail) {
        const thumbPath = join(process.cwd(), execution.videoThumbnail);
        if (existsSync(thumbPath)) {
          await unlink(thumbPath);
        }
      }

      await this.prisma.testExecution.update({
        where: { id: executionId },
        data: { videoPath: null, videoThumbnail: null },
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete video for execution ${executionId}:`, error);
      return false;
    }
  }
}