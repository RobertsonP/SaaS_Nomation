import { Module, forwardRef } from '@nestjs/common';
import { SmartWaitService } from './smart-wait.service';
import { ExecutionProgressGateway } from './execution.gateway';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthFlowsModule } from '../auth-flows/auth-flows.module';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthFlowsModule),
    forwardRef(() => QueueModule),
    AuthModule
  ],
  controllers: [ExecutionController],
  providers: [SmartWaitService, ExecutionProgressGateway, ExecutionService],
  exports: [SmartWaitService, ExecutionProgressGateway, ExecutionService],
})
export class ExecutionModule {}