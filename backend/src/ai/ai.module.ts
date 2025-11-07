import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { OllamaService } from './ollama.service';
import { ElementAnalyzerService } from './element-analyzer.service';
import { AuthenticationAnalyzerService } from './authentication-analyzer.service';
import { AuthModule } from '../auth/auth.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { BrowserModule } from '../browser/browser.module';

@Module({
  imports: [AuthModule, AnalysisModule, BrowserModule], // Import AuthModule, AnalysisModule, and BrowserModule
  providers: [AiService, OllamaService, ElementAnalyzerService, AuthenticationAnalyzerService],
  exports: [AiService, OllamaService, ElementAnalyzerService, AuthenticationAnalyzerService],
})
export class AiModule {}