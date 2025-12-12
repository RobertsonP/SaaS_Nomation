import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestsService } from './tests.service';
import { ExecutionService } from '../execution/execution.service';

export class CreateTestDto {
  name: string;
  description?: string;
  projectId: string;
  startingUrl: string;
  steps: any[];
}

export class UpdateTestDto {
  name: string;
  description?: string;
  startingUrl: string;
  steps: any[];
}

@Controller('api/tests')
@UseGuards(JwtAuthGuard)
export class TestsController {
  constructor(
    private testsService: TestsService,
    private executionService: ExecutionService
  ) {}

  @Get('project/:projectId')
  async getProjectTests(@Param('projectId') projectId: string) {
    return this.testsService.findByProject(projectId);
  }

  @Get(':testId')
  async getTest(@Param('testId') testId: string) {
    return this.testsService.findById(testId);
  }

  @Post()
  async createTest(@Body() createTestDto: CreateTestDto) {
    return this.testsService.create(createTestDto);
  }

  @Put(':testId')
  async updateTest(@Param('testId') testId: string, @Body() updateTestDto: UpdateTestDto) {
    return this.testsService.update(testId, updateTestDto);
  }

  @Put(':testId/steps')
  async updateTestSteps(@Param('testId') testId: string, @Body() body: { steps: any[] }) {
    return this.testsService.updateSteps(testId, body.steps);
  }

  @Delete(':testId')
  async deleteTest(@Param('testId') testId: string) {
    return this.testsService.delete(testId);
  }

  @Post(':testId/execute')
  async executeTest(@Param('testId') testId: string) {
    // Use real Playwright execution instead of simulation
    return this.executionService.executeTest(testId);
  }
}