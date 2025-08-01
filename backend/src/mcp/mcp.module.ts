import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { McpAnalysisBridgeService } from './mcp-analysis-bridge.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [McpController],
  providers: [McpService, McpAnalysisBridgeService],
  exports: [McpService, McpAnalysisBridgeService],
})
export class McpModule {}