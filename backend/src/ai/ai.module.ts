import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ElementAnalyzerService } from './element-analyzer.service';
import { SmartElementAnalyzerService } from './smart-element-analyzer.service';
import { AuthenticationAnalyzerService } from './authentication-analyzer.service';
import { OllamaService } from './ollama.service';
import { AuthModule } from '../auth/auth.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { BrowserModule } from '../browser/browser.module';

@Module({
  imports: [AuthModule, AnalysisModule, BrowserModule], // Import BrowserModule for SmartElementAnalyzerService
  controllers: [AiController],
  providers: [AiService, ElementAnalyzerService, SmartElementAnalyzerService, AuthenticationAnalyzerService, OllamaService],
  exports: [AiService, ElementAnalyzerService, SmartElementAnalyzerService, AuthenticationAnalyzerService, OllamaService],
})
export class AiModule {}