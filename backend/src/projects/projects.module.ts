import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AiModule } from '../ai/ai.module';
import { AuthFlowsModule } from '../auth-flows/auth-flows.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { BrowserModule } from '../browser/browser.module';

@Module({
  imports: [AiModule, AuthFlowsModule, AnalysisModule, BrowserModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}