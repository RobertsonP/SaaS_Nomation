import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { TestsModule } from './tests/tests.module';
import { ExecutionModule } from './execution/execution.module';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { BrowserModule } from './browser/browser.module';
import { AuthFlowsModule } from './auth-flows/auth-flows.module';
import { McpModule } from './mcp/mcp.module';
import { AnalysisModule } from './analysis/analysis.module';
import { TestSuitesModule } from './test-suites/test-suites.module';
import { QueueModule } from './queue/queue.module';
import { AppController } from './app.controller';
import { StandaloneTemplatesController } from './auth-flows/standalone-templates.controller';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { BillingModule } from './billing/billing.module';
import { ReportingModule } from './reporting/reporting.module';
import { DiscoveryModule } from './discovery/discovery.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Global rate limiting configuration
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000,      // 60 seconds
      limit: 100,      // 100 requests per 60 seconds per IP
    }, {
      name: 'strict',   // For sensitive endpoints
      ttl: 60000,
      limit: 10,        // 10 requests per minute
    }]),
    // Register Bull globally for job queue system
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    PrismaModule,
    AuthModule,
    ProjectsModule, // Restored - dependency issue fixed
    TestsModule,
    TestSuitesModule, // Added for test suite functionality
    ExecutionModule,
    AiModule,
    BrowserModule,
    AuthFlowsModule, // Restored - circular dependency fixed
    McpModule,
    AnalysisModule,
    QueueModule, // Job queue for test execution
    HealthModule,
    OrganizationsModule,
    BillingModule,
    ReportingModule,
    DiscoveryModule,
  ],
  controllers: [AppController, StandaloneTemplatesController],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}