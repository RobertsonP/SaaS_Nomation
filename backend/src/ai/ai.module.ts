import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ElementAnalyzerService } from './element-analyzer.service';
// import { OllamaService } from './ollama.service';

@Module({
  providers: [AiService, ElementAnalyzerService],
  exports: [AiService, ElementAnalyzerService],
})
export class AiModule {}