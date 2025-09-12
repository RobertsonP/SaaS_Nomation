import { Controller, Post, Body } from '@nestjs/common';
import { ElementAnalyzerService } from './element-analyzer.service';
import { SmartElementAnalyzerService } from './smart-element-analyzer.service';

@Controller('api/ai')
export class AiController {
  constructor(
    private elementAnalyzerService: ElementAnalyzerService,
    private smartElementAnalyzerService: SmartElementAnalyzerService
  ) {}

  // 🎯 NEW SMART ELEMENT ANALYSIS API - Context-aware selectors + Visual recreation
  @Post('analyze-elements-smart')
  async analyzeElementsSmart(@Body() body: { url: string; authFlowId?: string }) {
    const { url, authFlowId } = body;
    
    console.log(`🎯 Smart element analysis request for: ${url}`);
    
    try {
      const result = await this.smartElementAnalyzerService.analyzePageElements(url, authFlowId ? { id: authFlowId } : null);
      
      console.log(`✅ Smart analysis complete: ${result.totalCount} elements found`);
      console.log(`📊 Categories: Interactive=${result.categories.interactive}, Verification=${result.categories.verification}, Containers=${result.categories.containers}`);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Smart element analysis failed:', error);
      return {
        success: false,
        error: error.message,
        fallbackMessage: 'Smart analysis failed - ensure the website is accessible and loading properly'
      };
    }
  }

  // 🎯 SCREENSHOT API REMOVED - Using CSS data for visual previews instead
}