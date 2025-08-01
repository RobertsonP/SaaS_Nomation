import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import { AuthFlowTemplatesService, AuthTemplate } from './auth-flow-templates.service';
import { UnifiedAuthService } from '../auth/unified-auth.service';

export interface AuthTestResult {
  success: boolean;
  message: string;
  details: {
    stepsCompleted: number;
    totalSteps: number;
    failedStep?: {
      stepIndex: number;
      stepDescription: string;
      error: string;
    };
    finalUrl?: string;
    screenshots?: string[];
  };
  suggestions: string[];
}

@Injectable()
export class SimplifiedAuthService {
  constructor(
    private templatesService: AuthFlowTemplatesService,
    private unifiedAuthService: UnifiedAuthService
  ) {}

  async testAuthFlow(loginUrl: string, credentials: { username: string; password: string }, customSteps?: any[]): Promise<AuthTestResult> {
    console.log(`🔐 Testing authentication flow for: ${loginUrl}`);
    
    try {
      // Get template or use custom steps
      const template = customSteps ? null : this.templatesService.detectTemplate(loginUrl);
      const steps = customSteps || template?.steps || [];
      
      if (steps.length === 0) {
        return {
          success: false,
          message: 'No authentication steps configured',
          details: { stepsCompleted: 0, totalSteps: 0 },
          suggestions: ['Configure authentication steps or use a template']
        };
      }

      // Create auth flow object for UnifiedAuthService
      const authFlow = {
        id: 'test-flow',
        name: 'Test Authentication Flow',
        loginUrl,
        credentials,
        steps: steps.map(step => ({
          ...step,
          // Fix variable substitution format for UnifiedAuthService
          value: step.value === '{username}' ? '${username}' : 
                 step.value === '{password}' ? '${password}' : step.value
        }))
      };

      console.log(`📋 Using ${steps.length} authentication steps`);
      
      // Use UnifiedAuthService with our TTS manual navigation fix
      const authResult = await this.unifiedAuthService.authenticateForUrl(
        loginUrl, // Target URL (will try to navigate here after auth)
        authFlow  // Auth flow with steps
      );

      const success = authResult.result.success;
      const finalUrl = authResult.result.finalUrl;
      
      // Take screenshot of final page
      let screenshots: string[] = [];
      try {
        const screenshot = await authResult.page.screenshot({ type: 'png' });
        screenshots.push(screenshot.toString('base64'));
      } catch (screenshotError) {
        console.log('Could not capture final screenshot');
      }

      // Clean up browser
      await this.unifiedAuthService.cleanupSession(authResult.browser);
      
      return {
        success,
        message: success 
          ? `Authentication completed successfully! All ${steps.length} steps executed and reached authenticated page.`
          : `Authentication failed: ${authResult.result.errorMessage}`,
        details: {
          stepsCompleted: success ? steps.length : 0,
          totalSteps: steps.length,
          finalUrl,
          screenshots
        },
        suggestions: success ? [
          'Authentication flow is working correctly',
          'Successfully reached authenticated page',
          'You can now analyze protected pages'
        ] : [
          'Check if credentials are correct',
          'Verify the login URL is accessible', 
          'Check for CAPTCHA or additional security measures',
          'Try testing manually on the website first',
          ...this.generateFailureSuggestions(authResult.result.errorMessage || '')
        ]
      };
      
    } catch (error) {
      console.error('🚨 Critical authentication error:', error);
      return {
        success: false,
        message: `Critical authentication error: ${error.message}`,
        details: { stepsCompleted: 0, totalSteps: customSteps?.length || 0 },
        suggestions: [
          'Check browser compatibility',
          'Verify system resources', 
          'Try running the test again',
          'Check server logs for more details'
        ]
      };
    }
  }

  private generateFailureSuggestions(errorMessage: string): string[] {
    const suggestions: string[] = [];
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      suggestions.push('The page took too long to load or respond');
      suggestions.push('Check your internet connection');
      suggestions.push('The website might be experiencing issues');
    }
    
    if (errorMessage.includes('login') || errorMessage.includes('Login')) {
      suggestions.push('Authentication may have failed - check credentials');
      suggestions.push('Look for error messages on the login page');
      suggestions.push('Verify the login URL is correct');
    }
    
    if (errorMessage.includes('selector') || errorMessage.includes('element')) {
      suggestions.push('The login form elements may have changed');
      suggestions.push('Use browser developer tools to check selectors');
      suggestions.push('The website may have updated its interface');
    }
    
    if (errorMessage.includes('navigation') || errorMessage.includes('redirect')) {
      suggestions.push('The website may be blocking automated access');
      suggestions.push('Try testing the authentication manually first');
      suggestions.push('Check if additional verification steps are required');
    }
    
    return suggestions;
  }
}