import { Module } from '@nestjs/common';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { ExecutionService } from '../execution/execution.service';

@Module({
  controllers: [TestsController],
  providers: [TestsService, ExecutionService],
})
export class TestsModule {}