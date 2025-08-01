import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ElementAnalyzerService } from './element-analyzer.service';
import { AuthenticationAnalyzerService } from './authentication-analyzer.service';
import { AuthModule } from '../auth/auth.module';
import { AnalysisModule } from '../analysis/analysis.module';
// import { OllamaService } from './ollama.service';

@Module({
  imports: [AuthModule, AnalysisModule], // Import AuthModule and AnalysisModule
  providers: [AiService, ElementAnalyzerService, AuthenticationAnalyzerService],
  exports: [AiService, ElementAnalyzerService, AuthenticationAnalyzerService],
})
export class AiModule {}