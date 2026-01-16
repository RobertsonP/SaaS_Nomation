import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export interface TestExecutionJobData {
  testId: string;
  userId?: string;
  priority?: number;
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

@Injectable()
export class ExecutionQueueService {
  constructor(
    @InjectQueue('test-execution')
    private readonly testExecutionQueue: Queue,
  ) {}

  /**
   * Add a test execution job to the queue
   * Returns job ID and position in queue
   */
  async addTestExecution(testId: string, priority: number = 0): Promise<{ jobId: string; position: number }> {
    // Add job to queue with priority (higher number = higher priority)
    const job = await this.testExecutionQueue.add(
      'execute-test',
      { testId } as TestExecutionJobData,
      {
        priority: priority, // Higher priority jobs execute first
        jobId: `test-${testId}-${Date.now()}`, // Unique job ID
      },
    );

    // Get queue position (1-indexed for user display)
    const waitingJobs = await this.testExecutionQueue.getWaitingCount();
    const position = waitingJobs + 1; // Position in queue

    console.log(`📋 Test ${testId} queued as job ${job.id} at position ${position}`);

    return {
      jobId: job.id.toString(),
      position,
    };
  }

  /**
   * Get job status by job ID
   */
  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.testExecutionQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      jobId: job.id,
      testId: (job.data as TestExecutionJobData).testId,
      state, // 'waiting', 'active', 'completed', 'failed', 'delayed'
      progress,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      createdAt: new Date(job.timestamp),
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason,
      returnValue: job.returnvalue,
    };
  }

  /**
   * Get queue status (counts of jobs in different states)
   */
  async getQueueStatus(): Promise<QueueStatus> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.testExecutionQueue.getWaitingCount(),
      this.testExecutionQueue.getActiveCount(),
      this.testExecutionQueue.getCompletedCount(),
      this.testExecutionQueue.getFailedCount(),
      this.testExecutionQueue.getDelayedCount(),
      this.testExecutionQueue.getPausedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    };
  }

  /**
   * Get all jobs in queue (for admin monitoring)
   */
  async getAllJobs(limit: number = 50): Promise<Job[]> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.testExecutionQueue.getWaiting(0, limit / 4),
      this.testExecutionQueue.getActive(0, limit / 4),
      this.testExecutionQueue.getCompleted(0, limit / 4),
      this.testExecutionQueue.getFailed(0, limit / 4),
    ]);

    return [...waiting, ...active, ...completed, ...failed];
  }

  /**
   * Cancel a job (remove from queue)
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.testExecutionQueue.getJob(jobId);

    if (!job) {
      return false;
    }

    const state = await job.getState();

    // Can only cancel waiting or delayed jobs
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      console.log(`🚫 Job ${jobId} cancelled`);
      return true;
    }

    console.warn(`⚠️ Cannot cancel job ${jobId} in state: ${state}`);
    return false;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.testExecutionQueue.getJob(jobId);

    if (!job) {
      return false;
    }

    const state = await job.getState();

    if (state === 'failed') {
      await job.retry();
      console.log(`🔄 Job ${jobId} retrying`);
      return true;
    }

    console.warn(`⚠️ Cannot retry job ${jobId} in state: ${state}`);
    return false;
  }

  /**
   * Clear all completed jobs
   */
  async clearCompleted(): Promise<void> {
    await this.testExecutionQueue.clean(0, 'completed');
    console.log('🧹 Cleared all completed jobs');
  }

  /**
   * Clear all failed jobs
   */
  async clearFailed(): Promise<void> {
    await this.testExecutionQueue.clean(0, 'failed');
    console.log('🧹 Cleared all failed jobs');
  }

  /**
   * Pause the queue (stop processing new jobs)
   */
  async pauseQueue(): Promise<void> {
    await this.testExecutionQueue.pause();
    console.log('⏸️ Queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.testExecutionQueue.resume();
    console.log('▶️ Queue resumed');
  }
}
