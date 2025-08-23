import { Module } from '@nestjs/common';
import { AnalysisProgressGateway } from './analysis-progress.gateway';
import { AnalysisRetryService } from './analysis-retry.service';
import { ProjectAnalyzerService } from './project-analyzer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AnalysisProgressGateway, AnalysisRetryService, ProjectAnalyzerService],
  exports: [AnalysisProgressGateway, AnalysisRetryService, ProjectAnalyzerService],
})
export class AnalysisModule {}