import { Module } from '@nestjs/common';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { ExecutionService } from '../execution/execution.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthFlowsModule } from '../auth-flows/auth-flows.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthFlowsModule, AuthModule],
  controllers: [TestsController],
  providers: [TestsService, ExecutionService],
})
export class TestsModule {}