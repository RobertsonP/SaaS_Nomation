import { Injectable } from '@nestjs/common';

export interface AuthTemplate {
  name: string;
  description: string;
  domains: string[];
  steps: Array<{
    type: 'type' | 'click' | 'wait';
    selector: string;
    value?: string;
    description: string;
    timeout?: number;
    optional?: boolean;
  }>;
  successIndicators: string[];
  commonIssues: string[];
}

@Injectable()
export class AuthFlowTemplatesService {
  
  getCommonTemplates(): AuthTemplate[] {
    return [
      {
        name: "Standard Login Form",
        description: "Common username/password form with submit button",
        domains: ["*"],
        steps: [
          {
            type: 'type',
            selector: 'input[type="email"], input[name="email"], input[name="username"], #email, #username',
            value: '{username}',
            description: 'Enter username or email',
            timeout: 5000
          },
          {
            type: 'type',
            selector: 'input[type="password"], input[name="password"], #password',
            value: '{password}',
            description: 'Enter password',
            timeout: 5000
          },
          {
            type: 'click',
            selector: 'button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log In")',
            description: 'Click login button',
            timeout: 5000
          },
          {
            type: 'wait',
            selector: '2000',
            description: 'Wait for redirect',
            timeout: 10000
          }
        ],
        successIndicators: [
          'url does not contain "login"',
          'url contains "dashboard" or "home" or "app"',
          'element exists: [data-testid="user-menu"], .user-profile, .logout'
        ],
        commonIssues: [
          'Check if CAPTCHA is required',
          'Verify login URL is correct',
          'Ensure credentials are valid'
        ]
      },
      {
        name: "Two-Step Login",
        description: "Username first, then password on separate page",
        domains: ["*"],
        steps: [
          {
            type: 'type',
            selector: 'input[type="email"], input[name="email"], input[name="username"]',
            value: '{username}',
            description: 'Enter username or email'
          },
          {
            type: 'click',
            selector: 'button[type="submit"], button:has-text("Next"), button:has-text("Continue")',
            description: 'Click next/continue button'
          },
          {
            type: 'wait',
            selector: '2000',
            description: 'Wait for password page'
          },
          {
            type: 'type',
            selector: 'input[type="password"], input[name="password"]',
            value: '{password}',
            description: 'Enter password'
          },
          {
            type: 'click',
            selector: 'button[type="submit"], button:has-text("Sign In"), button:has-text("Login")',
            description: 'Click login button'
          },
          {
            type: 'wait',
            selector: '3000',
            description: 'Wait for authentication'
          }
        ],
        successIndicators: [
          'url does not contain "login"',
          'element exists: .user-menu, [data-user], .logout-btn'
        ],
        commonIssues: [
          'Make sure to wait between steps',
          'Check for additional verification steps',
          'Verify both username and password pages load correctly'
        ]
      }
    ];
  }

  detectTemplate(loginUrl: string): AuthTemplate | null {
    // Simple domain-based detection - in production this could be more sophisticated
    const templates = this.getCommonTemplates();
    return templates[0]; // Return standard template as default
  }

  validateAuthStep(step: any): { valid: boolean; error?: string } {
    if (!step.type || !['type', 'click', 'wait'].includes(step.type)) {
      return { valid: false, error: 'Invalid step type' };
    }

    if (!step.selector) {
      return { valid: false, error: 'Selector is required' };
    }

    if (step.type === 'type' && !step.value) {
      return { valid: false, error: 'Value is required for type steps' };
    }

    if (step.type === 'wait') {
      const timeout = parseInt(step.selector);
      if (isNaN(timeout) || timeout < 100 || timeout > 30000) {
        return { valid: false, error: 'Wait time must be between 100ms and 30s' };
      }
    }

    return { valid: true };
  }
}