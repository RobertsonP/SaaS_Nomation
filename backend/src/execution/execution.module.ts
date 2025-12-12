import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { ExecutionProgressGateway } from './execution.gateway';
import { AuthFlowsModule } from '../auth-flows/auth-flows.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthFlowsModule, AuthModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionProgressGateway],
  exports: [ExecutionService, ExecutionProgressGateway],
})
export class ExecutionModule {}