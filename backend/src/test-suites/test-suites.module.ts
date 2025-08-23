import { Module } from '@nestjs/common';
import { TestSuitesController } from './test-suites.controller';
import { TestSuitesService } from './test-suites.service';
import { ExecutionService } from '../execution/execution.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthFlowsModule } from '../auth-flows/auth-flows.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthFlowsModule, AuthModule],
  controllers: [TestSuitesController],
  providers: [TestSuitesService, ExecutionService],
  exports: [TestSuitesService],
})
export class TestSuitesModule {}