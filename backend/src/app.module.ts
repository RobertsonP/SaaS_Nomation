import { Module } from '@nestjs/common';
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
import { AppController } from './app.controller';
import { StandaloneTemplatesController } from './auth-flows/standalone-templates.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule, // Restored - dependency issue fixed
    TestsModule,
    ExecutionModule,
    AiModule,
    BrowserModule,
    AuthFlowsModule, // Restored - circular dependency fixed
    McpModule,
    AnalysisModule,
  ],
  controllers: [AppController, StandaloneTemplatesController],
})
export class AppModule {}