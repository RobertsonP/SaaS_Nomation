import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';

export interface CreateTestSuiteDto {
  name: string;
  description?: string;
  projectId: string;
}

export interface UpdateTestSuiteDto {
  name: string;
  description?: string;
  status?: string;
}

export interface AddTestsToSuiteDto {
  testIds: string[];
}

@Injectable()
export class TestSuitesService {
  constructor(
    private prisma: PrismaService,
    private executionService: ExecutionService
  ) {}

  // Core CRUD operations
  async create(data: CreateTestSuiteDto) {
    return this.prisma.testSuite.create({
      data: {
        name: data.name,
        description: data.description,
        projectId: data.projectId,
        status: 'draft',
      },
      include: {
        tests: {
          include: {
            test: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        _count: {
          select: {
            tests: true,
            executions: true
          }
        }
      }
    });
  }

  async findByProject(projectId: string) {
    return this.prisma.testSuite.findMany({
      where: { projectId },
      include: {
        tests: {
          include: {
            test: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            tests: true,
            executions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(suiteId: string) {
    return this.prisma.testSuite.findUnique({
      where: { id: suiteId },
      include: {
        project: true,
        tests: {
          include: {
            test: {
              include: {
                _count: { select: { executions: true } },
                executions: {
                  orderBy: { startedAt: 'desc' },
                  take: 1
                }
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        },
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            tests: true,
            executions: true
          }
        }
      }
    });
  }

  async update(suiteId: string, data: UpdateTestSuiteDto) {
    return this.prisma.testSuite.update({
      where: { id: suiteId },
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
      },
      include: {
        tests: {
          include: {
            test: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        _count: {
          select: {
            tests: true,
            executions: true
          }
        }
      }
    });
  }

  async delete(suiteId: string) {
    return this.prisma.testSuite.delete({
      where: { id: suiteId },
    });
  }

  // Test management within suites
  async addTests(suiteId: string, testIds: string[]) {
    // Get current max order for this suite
    const maxOrderResult = await this.prisma.testSuiteTest.findFirst({
      where: { suiteId },
      orderBy: { order: 'desc' }
    });
    
    let nextOrder = (maxOrderResult?.order ?? -1) + 1;

    // Create suite test relations
    const suiteTests = testIds.map(testId => ({
      suiteId,
      testId,
      order: nextOrder++
    }));

    await this.prisma.testSuiteTest.createMany({
      data: suiteTests,
      skipDuplicates: true // In case test is already in suite
    });

    // Return updated suite
    return this.findById(suiteId);
  }

  async removeTest(suiteId: string, testId: string) {
    await this.prisma.testSuiteTest.delete({
      where: {
        suiteId_testId: {
          suiteId,
          testId
        }
      }
    });

    // Return updated suite
    return this.findById(suiteId);
  }

  async reorderTests(suiteId: string, testOrder: Array<{testId: string, order: number}>) {
    // Update order for each test in the suite
    for (const item of testOrder) {
      await this.prisma.testSuiteTest.update({
        where: {
          suiteId_testId: {
            suiteId,
            testId: item.testId
          }
        },
        data: {
          order: item.order
        }
      });
    }

    // Return updated suite
    return this.findById(suiteId);
  }

  // Execution coordination
  async executeSuite(suiteId: string) {
    const suite = await this.findById(suiteId);
    if (!suite) {
      throw new Error('Test suite not found');
    }

    // Create execution record
    const execution = await this.prisma.testSuiteExecution.create({
      data: {
        suiteId,
        status: 'running',
        totalTests: suite.tests.length,
        passedTests: 0,
        failedTests: 0,
      },
    });

    console.log(`🚀 Starting execution of test suite "${suite.name}" with ${suite.tests.length} tests`);

    const results = [];
    let passedCount = 0;
    let failedCount = 0;
    let errorMsg: string | null = null;

    try {
      // Execute each test in the suite in order
      for (const suiteTest of suite.tests) {
        try {
          console.log(`▶️  Executing test: ${suiteTest.test.name}`);
          const testExecution = await this.executionService.executeTest(suiteTest.test.id);
          
          if (testExecution.status === 'passed') {
            passedCount++;
          } else {
            failedCount++;
          }

          results.push({
            testId: suiteTest.test.id,
            testName: suiteTest.test.name,
            executionId: testExecution.id,
            status: testExecution.status,
            duration: testExecution.duration,
            errorMsg: testExecution.errorMsg,
          });

          console.log(`${testExecution.status === 'passed' ? '✅' : '❌'} Test "${suiteTest.test.name}" ${testExecution.status}`);
        } catch (error) {
          failedCount++;
          console.error(`❌ Test "${suiteTest.test.name}" failed:`, error.message);
          
          results.push({
            testId: suiteTest.test.id,
            testName: suiteTest.test.name,
            status: 'failed',
            errorMsg: error.message,
          });
        }
      }
    } catch (error) {
      errorMsg = `Suite execution failed: ${error.message}`;
      console.error('Suite execution error:', error);
    }

    // Update execution record with final results
    const finalExecution = await this.prisma.testSuiteExecution.update({
      where: { id: execution.id },
      data: {
        status: failedCount === 0 ? 'passed' : 'failed',
        completedAt: new Date(),
        duration: Date.now() - execution.startedAt.getTime(),
        passedTests: passedCount,
        failedTests: failedCount,
        results,
        errorMsg,
      },
    });

    console.log(`🏁 Suite "${suite.name}" completed: ${passedCount} passed, ${failedCount} failed`);

    return finalExecution;
  }

  async getExecutionHistory(suiteId: string) {
    return this.prisma.testSuiteExecution.findMany({
      where: { suiteId },
      include: {
        suite: {
          select: {
            name: true
          }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  async getExecutionById(executionId: string) {
    return this.prisma.testSuiteExecution.findUnique({
      where: { id: executionId },
      include: {
        suite: {
          include: {
            project: true,
            tests: {
              include: {
                test: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        }
      },
    });
  }
}