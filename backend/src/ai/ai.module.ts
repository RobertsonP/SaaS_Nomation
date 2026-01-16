import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { OllamaService } from './ollama.service';
import { ElementAnalyzerService } from './element-analyzer.service';
import { AuthenticationAnalyzerService } from './authentication-analyzer.service';
import { BrowserManagerService } from './browser-manager.service';
import { SelectorQualityService } from './selector-quality.service';
import { ScreenshotService } from './screenshot.service';
import { AuthModule } from '../auth/auth.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { BrowserModule } from '../browser/browser.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ElementsController } from './elements.controller';

@Module({
  imports: [AuthModule, AnalysisModule, BrowserModule, PrismaModule],
  controllers: [ElementsController],
  providers: [
    AiService,
    OllamaService,
    ElementAnalyzerService,
    AuthenticationAnalyzerService,
    BrowserManagerService,
    SelectorQualityService,
    ScreenshotService,
  ],
  exports: [
    AiService,
    OllamaService,
    ElementAnalyzerService,
    AuthenticationAnalyzerService,
    BrowserManagerService,
    SelectorQualityService,
    ScreenshotService,
  ],
})
export class AiModule {}
