import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExecutionService } from './execution.service';

@Controller('execution')
@UseGuards(JwtAuthGuard)
export class ExecutionController {
  constructor(private executionService: ExecutionService) {}

  @Post('test/:testId/run')
  async runTest(@Param('testId') testId: string) {
    return this.executionService.executeTest(testId);
  }

  @Get('test/:testId/results')
  async getTestResults(@Param('testId') testId: string) {
    return this.executionService.getExecutionResults(testId);
  }

  @Get(':executionId')
  async getExecution(@Param('executionId') executionId: string) {
    return this.executionService.getExecutionById(executionId);
  }
}