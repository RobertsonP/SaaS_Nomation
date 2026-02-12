import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { OllamaService } from './ollama.service';
import { ElementAnalyzerService } from './element-analyzer.service';
import { ElementDetectionService } from './element-detection.service';
import { MetadataExtractionService } from './metadata-extraction.service';
import { AuthenticationAnalyzerService } from './authentication-analyzer.service';
import { BrowserManagerService } from './browser-manager.service';
import { SelectorQualityService } from './selector-quality.service';
import { ScreenshotService } from './screenshot.service';
import { InteractiveElementDiscoveryService } from './interactive-element-discovery.service';
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
    ElementDetectionService,
    MetadataExtractionService,
    AuthenticationAnalyzerService,
    BrowserManagerService,
    SelectorQualityService,
    ScreenshotService,
    InteractiveElementDiscoveryService,
  ],
  exports: [
    AiService,
    OllamaService,
    ElementAnalyzerService,
    ElementDetectionService,
    MetadataExtractionService,
    AuthenticationAnalyzerService,
    BrowserManagerService,
    SelectorQualityService,
    ScreenshotService,
    InteractiveElementDiscoveryService,
  ],
})
export class AiModule {}
