import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ExecutionQueueProcessor } from './execution-queue.processor';
import { ExecutionQueueService } from './execution-queue.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthFlowsModule } from '../auth-flows/auth-flows.module';
import { AuthModule } from '../auth/auth.module';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [
    // Configure Bull queue with Redis
    BullModule.registerQueue({
      name: 'test-execution',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 second delay, then 4s, 8s
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200, // Keep last 200 failed jobs for debugging
      },
    }),
    PrismaModule,
    AuthFlowsModule,
    AuthModule,
    forwardRef(() => ExecutionModule),
  ],
  providers: [
    ExecutionQueueProcessor,
    ExecutionQueueService,
  ],
  exports: [ExecutionQueueService],
})
export class QueueModule {}
