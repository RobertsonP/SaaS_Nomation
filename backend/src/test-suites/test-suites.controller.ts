import { Controller, Get, Post, Put, Delete, Body, UseGuards, Param, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestSuitesService, CreateTestSuiteDto, UpdateTestSuiteDto, AddTestsToSuiteDto } from './test-suites.service';

@Controller('api/test-suites')
@UseGuards(JwtAuthGuard)
export class TestSuitesController {
  constructor(private testSuitesService: TestSuitesService) {}

  /**
   * Get all test suites for a project
   * GET /api/test-suites/project/:projectId
   */
  @Get('project/:projectId')
  async getProjectTestSuites(@Param('projectId') projectId: string) {
    try {
      return await this.testSuitesService.findByProject(projectId);
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve test suites: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Create new test suite
   * POST /api/test-suites
   */
  @Post()
  async createTestSuite(@Body() createTestSuiteDto: CreateTestSuiteDto) {
    try {
      return await this.testSuitesService.create(createTestSuiteDto);
    } catch (error) {
      throw new HttpException(
        `Failed to create test suite: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get specific test suite by ID
   * GET /api/test-suites/:suiteId
   */
  @Get(':suiteId')
  async getTestSuite(@Param('suiteId') suiteId: string) {
    try {
      const suite = await this.testSuitesService.findById(suiteId);
      if (!suite) {
        throw new HttpException('Test suite not found', HttpStatus.NOT_FOUND);
      }
      return suite;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to retrieve test suite: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update test suite
   * PUT /api/test-suites/:suiteId
   */
  @Put(':suiteId')
  async updateTestSuite(
    @Param('suiteId') suiteId: string,
    @Body() updateTestSuiteDto: UpdateTestSuiteDto
  ) {
    try {
      return await this.testSuitesService.update(suiteId, updateTestSuiteDto);
    } catch (error) {
      throw new HttpException(
        `Failed to update test suite: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Delete test suite
   * DELETE /api/test-suites/:suiteId
   */
  @Delete(':suiteId')
  async deleteTestSuite(@Param('suiteId') suiteId: string) {
    try {
      await this.testSuitesService.delete(suiteId);
      return { message: 'Test suite deleted successfully' };
    } catch (error) {
      throw new HttpException(
        `Failed to delete test suite: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Add tests to suite
   * POST /api/test-suites/:suiteId/tests
   */
  @Post(':suiteId/tests')
  async addTestsToSuite(
    @Param('suiteId') suiteId: string,
    @Body() addTestsDto: AddTestsToSuiteDto
  ) {
    try {
      if (!addTestsDto.testIds || addTestsDto.testIds.length === 0) {
        throw new HttpException('testIds array is required', HttpStatus.BAD_REQUEST);
      }
      return await this.testSuitesService.addTests(suiteId, addTestsDto.testIds);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to add tests to suite: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Remove test from suite
   * DELETE /api/test-suites/:suiteId/tests/:testId
   */
  @Delete(':suiteId/tests/:testId')
  async removeTestFromSuite(
    @Param('suiteId') suiteId: string,
    @Param('testId') testId: string
  ) {
    try {
      return await this.testSuitesService.removeTest(suiteId, testId);
    } catch (error) {
      throw new HttpException(
        `Failed to remove test from suite: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Reorder tests in suite
   * PUT /api/test-suites/:suiteId/tests/reorder
   */
  @Put(':suiteId/tests/reorder')
  async reorderTests(
    @Param('suiteId') suiteId: string,
    @Body() body: { testOrder: Array<{testId: string, order: number}> }
  ) {
    try {
      if (!body.testOrder || !Array.isArray(body.testOrder)) {
        throw new HttpException('testOrder array is required', HttpStatus.BAD_REQUEST);
      }
      return await this.testSuitesService.reorderTests(suiteId, body.testOrder);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to reorder tests: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Execute entire test suite
   * POST /api/test-suites/:suiteId/execute
   */
  @Post(':suiteId/execute')
  async executeTestSuite(@Param('suiteId') suiteId: string) {
    try {
      console.log(`🚀 API: Starting execution of test suite ${suiteId}`);
      const execution = await this.testSuitesService.executeSuite(suiteId);
      console.log(`✅ API: Suite execution completed with status: ${execution.status}`);
      return execution;
    } catch (error) {
      console.error(`❌ API: Suite execution failed:`, error);
      throw new HttpException(
        `Failed to execute test suite: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get execution history for a suite
   * GET /api/test-suites/:suiteId/executions
   */
  @Get(':suiteId/executions')
  async getSuiteExecutions(@Param('suiteId') suiteId: string) {
    try {
      return await this.testSuitesService.getExecutionHistory(suiteId);
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve execution history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get specific execution details
   * GET /api/test-suites/executions/:executionId
   */
  @Get('executions/:executionId')
  async getExecution(@Param('executionId') executionId: string) {
    try {
      const execution = await this.testSuitesService.getExecutionById(executionId);
      if (!execution) {
        throw new HttpException('Execution not found', HttpStatus.NOT_FOUND);
      }
      return execution;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to retrieve execution: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}