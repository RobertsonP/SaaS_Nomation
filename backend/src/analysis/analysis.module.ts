import { Module } from '@nestjs/common';
import { AnalysisProgressGateway } from './analysis-progress.gateway';
import { AnalysisRetryService } from './analysis-retry.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AnalysisProgressGateway, AnalysisRetryService],
  exports: [AnalysisProgressGateway, AnalysisRetryService],
})
export class AnalysisModule {}