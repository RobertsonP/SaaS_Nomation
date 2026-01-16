import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectElementsService } from './project-elements.service';
import { ProjectAnalysisService } from './project-analysis.service';
import { SelectorValidationService } from './selector-validation.service';
import { LiveExecutionService } from './live-execution.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AuthFlowsModule } from '../auth-flows/auth-flows.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { GitHubService } from './github.service';

@Module({
  imports: [PrismaModule, AiModule, AuthFlowsModule, AnalysisModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectElementsService,
    ProjectAnalysisService,
    SelectorValidationService,
    LiveExecutionService,
    GitHubService,
  ],
  exports: [
    ProjectsService,
    ProjectElementsService,
    ProjectAnalysisService,
    SelectorValidationService,
    LiveExecutionService,
  ],
})
export class ProjectsModule {}
