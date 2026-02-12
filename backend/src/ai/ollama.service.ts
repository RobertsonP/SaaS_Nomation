import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Ollama } from 'ollama';
import { DetectedElement } from './interfaces/element.interface';

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly logger = new Logger(OllamaService.name);
  private ollama: Ollama;
  private isAvailable = false;

  constructor() {
    // Initialize Ollama client pointing to the Docker container
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://ollama:11434'
    });
  }

  async onModuleInit() {
    await this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      this.logger.log('Checking Ollama availability...');
      await this.ollama.list();
      this.isAvailable = true;
      this.logger.log('✅ Ollama is available and ready');
    } catch (error) {
      this.isAvailable = false;
      this.logger.warn('❌ Ollama is not available:', error.message);
      this.logger.warn('Falling back to rule-based analysis');
    }
  }

  async analyzePageElements(htmlContent: string, url: string): Promise<DetectedElement[]> {
    if (!this.isAvailable) {
      this.logger.warn('Ollama not available, skipping AI analysis');
      return [];
    }

    try {
      this.logger.log(`Analyzing elements for ${url} using Ollama AI`);
      
      const prompt = this.buildElementAnalysisPrompt(htmlContent);
      
      const response = await this.ollama.generate({
        model: 'qwen2.5:7b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Lower temperature for more consistent JSON output
          top_p: 0.9,
          stop: ['\n\n', '```']
        }
      });

      const elements = this.parseAIResponse(response.response);
      this.logger.log(`Ollama found ${elements.length} elements`);
      
      return elements;
    } catch (error) {
      this.logger.error('Ollama analysis failed:', error);
      return [];
    }
  }

  private buildElementAnalysisPrompt(htmlContent: string): string {
    // Limit HTML content to prevent token overflow
    const truncatedHtml = htmlContent.length > 8000 
      ? htmlContent.substring(0, 8000) + '...[truncated]'
      : htmlContent;

    return `You are an expert web element analyzer for test automation. 

Analyze this HTML and extract the most important interactive elements suitable for automated testing.

Focus on elements that are:
- Interactive (buttons, inputs, links, forms)
- Have stable identifiers (id, data-testid, aria-label, name)
- Are visible and functional for users
- Have clear purposes in the application workflow

For each element, provide a JSON object with:
- selector: Most reliable CSS selector (prefer data-testid > id > aria-label > name > text content)
- elementType: One of: "button", "input", "link", "form", "navigation", "text", "image"
- description: Clear, concise human-readable description
- confidence: Float 0-1 (how confident you are this is useful for testing)
- attributes: Object with relevant HTML attributes

Return ONLY a JSON array, no other text:

HTML Content:
${truncatedHtml}

JSON Array:`;
  }

  private parseAIResponse(response: string): DetectedElement[] {
    try {
      // Clean up the response to extract JSON
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/, '').replace(/```\n?$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/, '').replace(/```\n?$/, '');
      }

      // Try to find JSON array in the response
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const elements = JSON.parse(jsonStr);
      
      if (!Array.isArray(elements)) {
        this.logger.warn('AI response is not an array:', jsonStr.substring(0, 200));
        return [];
      }

      // Validate and clean up elements
      return elements
        .filter(el => el && el.selector && el.elementType && el.description)
        .map(el => ({
          selector: el.selector,
          elementType: this.normalizeElementType(el.elementType),
          description: el.description,
          confidence: Math.max(0, Math.min(1, el.confidence || 0.5)),
          attributes: el.attributes || {}
        }))
        .slice(0, 50); // Limit to 50 elements max

    } catch (error) {
      this.logger.error('Failed to parse Ollama response:', error);
      this.logger.debug('Raw response:', response.substring(0, 500));
      return [];
    }
  }

  private normalizeElementType(type: string): DetectedElement['elementType'] {
    const normalized = type.toLowerCase();
    const validTypes: DetectedElement['elementType'][] = ['button', 'input', 'link', 'form', 'navigation', 'text', 'image'];
    
    if (validTypes.includes(normalized as DetectedElement['elementType'])) {
      return normalized as DetectedElement['elementType'];
    }
    
    // Map common variations
    if (normalized.includes('input') || normalized.includes('textbox')) return 'input';
    if (normalized.includes('button') || normalized.includes('btn')) return 'button';
    if (normalized.includes('link') || normalized.includes('anchor')) return 'link';
    if (normalized.includes('form')) return 'form';
    if (normalized.includes('nav')) return 'navigation';
    
    return 'button'; // Default fallback
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch (error) {
      this.logger.error('Ollama connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    if (!this.isAvailable) return [];
    
    try {
      const response = await this.ollama.list();
      return response.models?.map(model => model.name) || [];
    } catch (error) {
      this.logger.error('Failed to get Ollama models:', error);
      return [];
    }
  }

  isOllamaAvailable(): boolean {
    return this.isAvailable;
  }
}