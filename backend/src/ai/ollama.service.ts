import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DetectedElement } from './interfaces/element.interface';

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly logger = new Logger(OllamaService.name);
  private isAvailable = false;

  async onModuleInit() {
    this.isAvailable = false;
    this.logger.log('Ollama disabled — will use Claude AI in future');
  }

  private async checkAvailability(): Promise<void> {
    this.isAvailable = false;
  }

  async analyzePageElements(htmlContent: string, url: string): Promise<DetectedElement[]> {
    return [];
  }

  async testConnection(): Promise<{ connected: boolean; message: string }> {
    return { connected: false, message: 'Ollama disabled' };
  }

  async getAvailableModels(): Promise<string[]> {
    return [];
  }

  isOllamaAvailable(): boolean {
    return false;
  }
}