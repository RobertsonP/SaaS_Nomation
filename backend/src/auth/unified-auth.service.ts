import { Injectable } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { LoginFlow, LoginStep } from '../ai/interfaces/element.interface';

interface AuthResult {
  success: boolean;
  finalUrl: string;
  authenticated: boolean;
  errorMessage?: string;
  redirectedFromLogin?: boolean;
}

interface AuthSessionResult {
  browser: Browser;
  page: Page;
  result: AuthResult;
}

@Injectable()
export class UnifiedAuthService {
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly EXTENDED_TIMEOUT = 60000;

  /**
   * Main authentication flow - implements the required flow:
   * 1. Check provided URL
   * 2. Open URL in browser
   * 3. Check if current URL matches provided URL
   * 4. If redirected to login → execute auth → navigate back to original URL
   * 5. Validate we're on correct page
   * 6. Return authenticated session
   */
  async authenticateForUrl(
    targetUrl: string,
    authFlow?: LoginFlow,
    existingBrowser?: Browser
  ): Promise<AuthSessionResult> {
    const browser = existingBrowser || await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        // Enhanced args for slow/problematic sites
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Skip images for faster loading in authentication
        '--disable-javascript-harmony-shipping',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI'
      ]
    });

    const page = await browser.newPage();
    
    try {
      console.log(`🔐 Starting authentication flow for URL: ${targetUrl}`);
      
      // Step 1: Check and open provided URL with progressive loading
      await this.navigateWithProgressiveLoading(page, targetUrl);

      // Step 2: Add extended wait for page stabilization
      await this.waitForPageStabilization(page);

      // Step 3: Check if current URL matches provided URL
      const currentUrl = page.url();
      const urlMatches = this.urlsMatch(targetUrl, currentUrl);
      
      console.log(`🔍 URL Check: Target=${targetUrl}, Current=${currentUrl}, Match=${urlMatches}`);

      if (urlMatches) {
        // Success: We're on the correct page, no auth needed
        return {
          browser,
          page,
          result: {
            success: true,
            finalUrl: currentUrl,
            authenticated: false,
            redirectedFromLogin: false
          }
        };
      }

      // Step 4: Check if we were redirected to login page
      const redirectedToLogin = authFlow && this.isLoginPage(currentUrl, authFlow.loginUrl);
      
      if (redirectedToLogin) {
        console.log(`🔑 Redirected to login page, executing authentication...`);
        
        // Execute authentication flow
        const authResult = await this.executeAuthFlow(page, authFlow);
        
        if (!authResult.success) {
          return {
            browser,
            page,
            result: {
              success: false,
              finalUrl: currentUrl,
              authenticated: false,
              errorMessage: authResult.errorMessage
            }
          };
        }

        // Step 5: Handle post-authentication navigation
        console.log(`🔄 Authentication successful, handling post-auth navigation...`);

        let finalUrl: string;
        let navigationSuccess = false;

        // Check if we're already on the target page (auto-redirect after login)
        const currentUrlAfterAuth = page.url();
        console.log(`📍 Current URL after auth: ${currentUrlAfterAuth}`);
        console.log(`🎯 Target URL: ${targetUrl}`);

        if (this.urlsMatch(targetUrl, currentUrlAfterAuth)) {
          // Already on target page - perfect!
          console.log(`✅ Already on target page after authentication`);
          finalUrl = currentUrlAfterAuth;
          navigationSuccess = true;
        } else {
          // Not on target page - navigate explicitly
          console.log(`🔄 Navigating to target URL: ${targetUrl}`);

          try {
            await page.goto(targetUrl, {
              waitUntil: 'networkidle',
              timeout: this.EXTENDED_TIMEOUT
            });

            await this.waitForPageStabilization(page);

            finalUrl = page.url();
            console.log(`📍 Final URL after navigation: ${finalUrl}`);

            // Check if we were redirected back to login (auth failed)
            if (authFlow && this.isLoginPage(finalUrl, authFlow.loginUrl)) {
              console.error(`❌ Redirected back to login - authentication may have failed`);
              navigationSuccess = false;
            } else {
              // Verify we reached the target or an acceptable authenticated page
              navigationSuccess = this.urlsMatch(targetUrl, finalUrl);
              if (navigationSuccess) {
                console.log(`✅ Successfully navigated to target page`);
              } else {
                console.log(`⚠️ Reached different page: ${finalUrl} (expected: ${targetUrl})`);
                // Consider it successful if not back on login page
                navigationSuccess = !this.isLoginPage(finalUrl, authFlow?.loginUrl);
              }
            }

          } catch (navError) {
            console.error(`❌ Failed to navigate to target URL: ${navError.message}`);
            finalUrl = page.url();
            navigationSuccess = false;
          }
        }

        // Step 6: Validate authentication success
        const authSuccess = navigationSuccess || !finalUrl.includes('login');
        
        console.log(`✅ Final validation: Target=${targetUrl}, Final=${finalUrl}, Success=${authSuccess}`);

        return {
          browser,
          page,
          result: {
            success: authSuccess,
            finalUrl,
            authenticated: true,
            redirectedFromLogin: true,
            errorMessage: authSuccess ? undefined : `Failed to reach authenticated page after login. Final URL: ${finalUrl}`
          }
        };
      }

      // Step 4b: If no auth flow provided but we're not on the right page
      if (!authFlow) {
        return {
          browser,
          page,
          result: {
            success: false,
            finalUrl: currentUrl,
            authenticated: false,
            errorMessage: `URL mismatch and no authentication flow provided. Expected: ${targetUrl}, Got: ${currentUrl}`
          }
        };
      }

      // Step 4c: We're not on login page, but we have auth flow - try to go to login first
      console.log(`🔗 Not on login page, navigating to login URL: ${authFlow.loginUrl}`);
      await page.goto(authFlow.loginUrl, { 
        waitUntil: 'networkidle', 
        timeout: this.DEFAULT_TIMEOUT 
      });

      await this.waitForPageStabilization(page);

      // Execute authentication flow
      const authResult = await this.executeAuthFlow(page, authFlow);
      
      if (!authResult.success) {
        return {
          browser,
          page,
          result: {
            success: false,
            finalUrl: page.url(),
            authenticated: false,
            errorMessage: authResult.errorMessage
          }
        };
      }

      // Navigate to target URL after auth
      console.log(`🔄 Post-authentication navigation...`);

      let finalUrl: string;
      let navigationSuccess = false;

      // Check if we're already on the target page (auto-redirect after login)
      const postAuthUrl = page.url();
      console.log(`📍 Current URL after auth: ${postAuthUrl}`);
      console.log(`🎯 Target URL: ${targetUrl}`);

      if (this.urlsMatch(targetUrl, postAuthUrl)) {
        // Already on target page - perfect!
        console.log(`✅ Already on target page after authentication`);
        finalUrl = postAuthUrl;
        navigationSuccess = true;
      } else {
        // Not on target page - navigate explicitly
        console.log(`🔄 Navigating to target URL: ${targetUrl}`);

        try {
          await page.goto(targetUrl, {
            waitUntil: 'networkidle',
            timeout: this.EXTENDED_TIMEOUT
          });

          await this.waitForPageStabilization(page);

          finalUrl = page.url();
          console.log(`📍 Final URL after navigation: ${finalUrl}`);

          // Check if we were redirected back to login (auth failed)
          if (authFlow && this.isLoginPage(finalUrl, authFlow.loginUrl)) {
            console.error(`❌ Redirected back to login - authentication may have failed`);
            navigationSuccess = false;
          } else {
            // Verify we reached the target or an acceptable authenticated page
            navigationSuccess = this.urlsMatch(targetUrl, finalUrl);
            if (navigationSuccess) {
              console.log(`✅ Successfully navigated to target page`);
            } else {
              console.log(`⚠️ Reached different page: ${finalUrl} (expected: ${targetUrl})`);
              // Consider it successful if not back on login page
              navigationSuccess = !this.isLoginPage(finalUrl, authFlow?.loginUrl);
            }
          }

        } catch (navError) {
          console.error(`❌ Failed to navigate to target URL: ${navError.message}`);
          finalUrl = page.url();
          navigationSuccess = false;
        }
      }

      const authSuccess = navigationSuccess || !finalUrl.includes('login');

      return {
        browser,
        page,
        result: {
          success: authSuccess,
          finalUrl,
          authenticated: true,
          redirectedFromLogin: false,
          errorMessage: authSuccess ? undefined : `Failed to reach authenticated page after login. Final URL: ${finalUrl}`
        }
      };

    } catch (error) {
      console.error('🚨 Authentication flow failed:', error);
      return {
        browser,
        page,
        result: {
          success: false,
          finalUrl: page.url(),
          authenticated: false,
          errorMessage: `Authentication flow failed: ${error.message}`
        }
      };
    }
  }

  /**
   * Execute authentication steps
   */
  private async executeAuthFlow(page: Page, authFlow: LoginFlow): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      console.log(`🔐 Executing authentication flow: ${authFlow.name}`);
      
      for (let index = 0; index < authFlow.steps.length; index++) {
        const step = authFlow.steps[index];
        console.log(`📋 Step ${index + 1}: ${step.type} - ${step.description}`);

        try {
          await this.executeAuthStep(page, step, authFlow);
          
          // Wait between steps for stability
          await page.waitForTimeout(1000);
          
        } catch (stepError) {
          console.error(`❌ Step ${index + 1} failed:`, stepError);
          return {
            success: false,
            errorMessage: `Authentication step ${index + 1} failed: ${stepError.message}`
          };
        }
      }

      // Wait for authentication to complete and page to redirect
      console.log('⏳ Waiting for authentication to process...');
      await page.waitForTimeout(3000);

      // Wait for navigation/redirect (common after login)
      console.log('⏳ Waiting for potential navigation/redirect...');
      try {
        await page.waitForNavigation({
          waitUntil: 'networkidle',
          timeout: 15000
        });
        console.log('✅ Navigation detected and completed');
      } catch (navError) {
        // Navigation might not happen on SPAs, that's ok
        console.log('⏳ No navigation detected (may be SPA), continuing...');
      }

      // Additional stabilization wait
      console.log('⏳ Final stabilization wait...');
      await page.waitForTimeout(2000);

      console.log('✅ Authentication flow completed successfully');
      return { success: true };

    } catch (error) {
      console.error('🚨 Authentication flow execution failed:', error);
      return {
        success: false,
        errorMessage: `Authentication execution failed: ${error.message}`
      };
    }
  }

  /**
   * Execute individual authentication step with manual/smart field detection fallback
   */
  private async executeAuthStep(page: Page, step: LoginStep, authFlow: LoginFlow): Promise<void> {
    const timeout = this.DEFAULT_TIMEOUT;
    const credentials = authFlow.credentials;

    switch (step.type) {
      case 'type':
        let valueToType = step.value || '';

        // Replace credential placeholders (match template format with single braces)
        if (valueToType === '{username}') {
          valueToType = credentials.username;
        } else if (valueToType === '{password}') {
          valueToType = credentials.password;
        }

        // Check mode: Manual vs Auto-detection
        if (authFlow.useAutoDetection === false) {
          // MANUAL MODE: Use ONLY manual selectors, NO fallbacks
          console.log(`🎯 Manual mode enabled - using manual selectors only`);

          if (!authFlow.manualSelectors) {
            throw new Error('Manual mode requires manualSelectors configuration');
          }

          const manualSelector = (valueToType === credentials.username)
            ? authFlow.manualSelectors.usernameSelector
            : (valueToType === credentials.password)
            ? authFlow.manualSelectors.passwordSelector
            : null;

          if (!manualSelector) {
            throw new Error(`Manual selector not configured for ${step.description || 'this field'}`);
          }

          // Use manual selector ONLY - no fallback
          await page.fill(manualSelector, valueToType, { timeout: 30000 });
          console.log(`✅ Successfully used manual selector: ${manualSelector}`);

        } else {
          // AUTO-DETECTION MODE (default): Try step.selector → smart detection
          console.log(`🔍 Auto-detection mode enabled`);

          try {
            await page.fill(step.selector, valueToType, { timeout: 5000 });
            console.log(`✅ Successfully used provided selector: ${step.selector}`);
          } catch (error) {
            console.log(`⚠️ Provided selector failed: ${step.selector}, trying smart detection...`);

            // Use smart field detection as fallback
            let smartSelector: string | null = null;

            if (valueToType === credentials.username) {
              console.log(`🔍 Attempting smart username field detection...`);
              smartSelector = await this.findUsernameField(page);
              console.log(`🔍 Smart detection result for username field: ${smartSelector || 'NOT FOUND'}`);
            } else if (valueToType === credentials.password) {
              console.log(`🔍 Attempting smart password field detection...`);
              smartSelector = await this.findPasswordField(page);
              console.log(`🔍 Smart detection result for password field: ${smartSelector || 'NOT FOUND'}`);
            }

            if (smartSelector) {
              await page.fill(smartSelector, valueToType, { timeout });
              console.log(`✅ Successfully used smart-detected selector: ${smartSelector}`);
            } else {
              throw new Error(`Failed to find field for: ${step.description || 'unknown'}`);
            }
          }
        }
        break;

      case 'click':
        // Check mode: Manual vs Auto-detection
        if (authFlow.useAutoDetection === false) {
          // MANUAL MODE: Use ONLY manual selectors, NO fallbacks
          console.log(`🎯 Manual mode enabled - using manual submit selector only`);

          if (!authFlow.manualSelectors?.submitSelector) {
            throw new Error('Manual mode requires submitSelector configuration');
          }

          // Use manual selector ONLY - no fallback
          await page.click(authFlow.manualSelectors.submitSelector, { timeout: 30000 });
          console.log(`✅ Successfully clicked manual selector: ${authFlow.manualSelectors.submitSelector}`);

        } else {
          // AUTO-DETECTION MODE (default): Try step.selector → smart detection
          console.log(`🔍 Auto-detection mode enabled`);

          try {
            await page.click(step.selector, { timeout: 5000 });
            console.log(`✅ Successfully clicked provided selector: ${step.selector}`);
          } catch (error) {
            console.log(`⚠️ Provided selector failed: ${step.selector}, trying smart button detection...`);

            // Use smart submit button detection as fallback
            const smartSelector = await this.findSubmitButton(page);

            if (smartSelector) {
              await page.click(smartSelector, { timeout });
              console.log(`✅ Successfully clicked smart-detected button: ${smartSelector}`);
            } else {
              throw new Error(`Failed to find submit button: ${step.description || 'unknown'}`);
            }
          }
        }
        break;

      case 'wait':
        const waitTime = parseInt(step.value || '2000', 10);
        await page.waitForTimeout(waitTime);
        break;

      default:
        throw new Error(`Unknown authentication step type: ${step.type}`);
    }
  }

  /**
   * Smart username/email field detection with 30+ strategies
   * Ordered by confidence level (high to low)
   */
  private async findUsernameField(page: Page): Promise<string | null> {
    console.log('🔍 Starting smart username/email field detection...');

    // High confidence strategies (90-100%)
    const highConfidenceSelectors = [
      'input[type="email"]',
      'input[autocomplete="email"]',
      'input[autocomplete="username"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[id="email"]',
      'input[id="username"]',
    ];

    for (const selector of highConfidenceSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`✅ High confidence match: ${selector}`);
          return selector;
        }
      }
    }

    // Medium confidence strategies (60-90%)
    const mediumConfidenceSelectors = [
      'input[type="text"][name*="email"]',
      'input[type="text"][name*="user"]',
      'input[type="text"][id*="email"]',
      'input[type="text"][id*="user"]',
      'input[type="tel"]', // Some sites use phone for login
      'input[inputmode="email"]',
      'input[class*="email"]',
      'input[class*="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="username" i]',
      'input[placeholder*="user" i]',
      'input[aria-label*="email" i]',
      'input[aria-label*="username" i]',
      'input[data-testid*="email"]',
      'input[data-testid*="username"]',
      'input[data-test*="email"]',
      'input[data-test*="username"]',
    ];

    for (const selector of mediumConfidenceSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`✅ Medium confidence match: ${selector}`);
          return selector;
        }
      }
    }

    // Label-based detection (50-70%)
    const labelTexts = ['email', 'e-mail', 'username', 'user name', 'login', 'usuario', 'correo', 'utilisateur', 'benutzer', 'пользователь', 'ユーザー名', '用户名', '사용자'];

    for (const labelText of labelTexts) {
      try {
        const labelElement = await page.$(`label:has-text("${labelText}")`);
        if (labelElement) {
          const forAttr = await labelElement.getAttribute('for');
          if (forAttr) {
            const input = await page.$(`#${forAttr}`);
            if (input) {
              const isVisible = await input.isVisible();
              if (isVisible) {
                console.log(`✅ Label-based match: label[for="${forAttr}"]`);
                return `#${forAttr}`;
              }
            }
          }
        }
      } catch (e) {
        // Continue to next label
      }
    }

    // Framework-specific patterns (40-60%)
    const frameworkSelectors = [
      'input[formcontrolname*="email"]', // Angular
      'input[formcontrolname*="username"]',
      'input[v-model*="email"]', // Vue
      'input[v-model*="username"]',
      'input[data-v-*][type="email"]',
      'input[data-react-*][type="email"]', // React
      'input[data-reactid*="email"]',
    ];

    for (const selector of frameworkSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`✅ Framework-specific match: ${selector}`);
          return selector;
        }
      }
    }

    // Generic text input fallback (30-40%)
    try {
      // Try any visible text input on the page
      const textInput = await page.$('input[type="text"]');
      if (textInput) {
        const isVisible = await textInput.isVisible();
        if (isVisible) {
          console.log(`⚠️ Generic fallback: Using input[type="text"]`);
          return 'input[type="text"]';
        }
      }
    } catch (e) {
      // Continue
    }

    // Position-based fallback (10-30%)
    try {
      // First visible text input in a form
      const firstInput = await page.$('form input[type="text"]:visible, form input[type="email"]:visible');
      if (firstInput) {
        console.log(`⚠️ Low confidence: Using first visible input in form`);
        return 'form input[type="text"]:visible, form input[type="email"]:visible';
      }
    } catch (e) {
      // Continue
    }

    console.log('❌ Failed to detect username field with any strategy');
    return null;
  }

  /**
   * Smart password field detection with 15+ strategies
   */
  private async findPasswordField(page: Page): Promise<string | null> {
    console.log('🔍 Starting smart password field detection...');

    // High confidence strategies (95-100%)
    const highConfidenceSelectors = [
      'input[type="password"]',
      'input[autocomplete="current-password"]',
      'input[autocomplete="new-password"]',
    ];

    for (const selector of highConfidenceSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`✅ High confidence password match: ${selector}`);
          return selector;
        }
      }
    }

    // Medium confidence strategies (60-90%)
    const mediumConfidenceSelectors = [
      'input[name="password"]',
      'input[name*="pass"]',
      'input[id="password"]',
      'input[id*="pass"]',
      'input[class*="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="contraseña" i]', // Spanish
      'input[placeholder*="mot de passe" i]', // French
      'input[placeholder*="passwort" i]', // German
      'input[placeholder*="пароль" i]', // Russian
      'input[data-testid*="password"]',
      'input[data-test*="password"]',
      'input[aria-label*="password" i]',
    ];

    for (const selector of mediumConfidenceSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`✅ Medium confidence password match: ${selector}`);
          return selector;
        }
      }
    }

    // Framework-specific patterns (40-60%)
    const frameworkSelectors = [
      'input[formcontrolname*="password"]', // Angular
      'input[v-model*="password"]', // Vue
    ];

    for (const selector of frameworkSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`✅ Framework password match: ${selector}`);
          return selector;
        }
      }
    }

    console.log('❌ Failed to detect password field with any strategy');
    return null;
  }

  /**
   * Smart submit button detection with 20+ strategies
   */
  private async findSubmitButton(page: Page): Promise<string | null> {
    console.log('🔍 Starting smart submit button detection...');

    // High confidence strategies (90-100%)
    const highConfidenceSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'form button:not([type="button"]):not([type="reset"])',
    ];

    for (const selector of highConfidenceSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`✅ High confidence submit button: ${selector}`);
          return selector;
        }
      }
    }

    // Text-based detection (multi-language) - 70-90%
    const submitTexts = [
      'login', 'log in', 'sign in', 'signin', 'submit', 'enter',
      'iniciar sesión', 'entrar', // Spanish
      'se connecter', 'connexion', // French
      'anmelden', 'einloggen', // German
      'войти', 'вход', // Russian
      'ログイン', // Japanese
      '登录', '登錄', // Chinese
      '로그인', // Korean
    ];

    for (const text of submitTexts) {
      try {
        const button = await page.$(`button:has-text("${text}")`);
        if (button) {
          const isVisible = await button.isVisible();
          if (isVisible) {
            console.log(`✅ Text-based submit button match: "${text}"`);
            return `button:has-text("${text}")`;
          }
        }

        // Also try input type submit/button
        const input = await page.$(`input[type="submit"][value*="${text}" i], input[type="button"][value*="${text}" i]`);
        if (input) {
          const isVisible = await input.isVisible();
          if (isVisible) {
            console.log(`✅ Text-based input button match: "${text}"`);
            return `input[value*="${text}" i]`;
          }
        }
      } catch (e) {
        // Continue to next text
      }
    }

    // Attribute-based detection (50-70%)
    const attributeSelectors = [
      'button[name*="login"]',
      'button[id*="login"]',
      'button[class*="login"]',
      'button[class*="submit"]',
      'button[data-testid*="login"]',
      'button[data-testid*="submit"]',
      'button[aria-label*="login" i]',
      'button[aria-label*="submit" i]',
      'input[name*="login"]',
      'input[id*="login"]',
    ];

    for (const selector of attributeSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          console.log(`✅ Attribute-based submit button: ${selector}`);
          return selector;
        }
      }
    }

    // Position-based fallback (10-30%)
    try {
      // Last button in form (common pattern)
      const lastButton = await page.$('form button:last-of-type');
      if (lastButton) {
        const isVisible = await lastButton.isVisible();
        if (isVisible) {
          console.log(`⚠️ Low confidence: Using last button in form`);
          return 'form button:last-of-type';
        }
      }
    } catch (e) {
      // Continue
    }

    console.log('❌ Failed to detect submit button with any strategy');
    return null;
  }

  /**
   * Check if two URLs match (with flexible matching)
   */
  public urlsMatch(expectedUrl: string, actualUrl: string): boolean {
    try {
      const expected = new URL(expectedUrl);
      const actual = new URL(actualUrl);
      
      // Normalize pathnames by removing trailing slashes (except for root)
      const normalizePathname = (pathname: string) => {
        if (pathname === '/') return pathname;
        return pathname.replace(/\/$/, '');
      };
      
      // Match hostname and normalized pathname
      const hostnameMatch = expected.hostname.toLowerCase() === actual.hostname.toLowerCase();
      const pathnameMatch = normalizePathname(expected.pathname) === normalizePathname(actual.pathname);

      // For exact URL matching, also compare protocol
      const protocolMatch = expected.protocol === actual.protocol;

      // URL matches if hostname, pathname, and protocol match
      // NOTE: Ignore search params and hash - URLs with ?session=123 or #content should still match
      const exactMatch = hostnameMatch && pathnameMatch && protocolMatch;

      console.log(`🔍 URL Match Check: Expected=${expectedUrl}, Actual=${actualUrl}, Match=${exactMatch}`);

      return exactMatch;
    } catch (error) {
      console.error('Error comparing URLs:', error);
      return expectedUrl === actualUrl;
    }
  }

  /**
   * Check if current URL is a login page
   */
  private isLoginPage(currentUrl: string, loginUrl: string): boolean {
    try {
      const current = new URL(currentUrl);
      const login = new URL(loginUrl);
      
      // Check if we're on the login page
      const isLogin = current.hostname === login.hostname && 
                     current.pathname === login.pathname;
      
      console.log(`🔑 Login page check: Current=${currentUrl}, Login=${loginUrl}, IsLogin=${isLogin}`);
      
      return isLogin;
    } catch (error) {
      console.error('Error checking login page:', error);
      return currentUrl.includes('login') || currentUrl.includes('signin');
    }
  }

  /**
   * Wait for page stabilization with multiple checks
   */
  private async waitForPageStabilization(page: Page): Promise<void> {
    try {
      // Wait for network to be idle
      await page.waitForLoadState('networkidle', { timeout: this.DEFAULT_TIMEOUT });

      // Wait for common frameworks to initialize
      await page.waitForFunction(() => {
        return document.readyState === 'complete' &&
               (!window.performance.timing.loadEventEnd ||
                Date.now() - window.performance.timing.loadEventEnd > 1000);
      }, { timeout: 10000 });
    } catch (error) {
      console.warn('Page stabilization timeout, proceeding anyway:', error.message);
    }

    // Additional fixed wait for safety
    await page.waitForTimeout(2000);
  }

  /**
   * Navigate to target URL after authentication
   * Handles both auto-redirect and explicit navigation scenarios
   */
  private async navigateToTargetAfterAuth(
    page: Page,
    targetUrl: string,
    authFlow?: LoginFlow
  ): Promise<{ finalUrl: string; navigationSuccess: boolean }> {
    console.log(`🔄 Post-authentication navigation handler`);

    let finalUrl: string;
    let navigationSuccess = false;

    // Check if we're already on the target page (auto-redirect after login)
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`🎯 Target URL: ${targetUrl}`);

    if (this.urlsMatch(targetUrl, currentUrl)) {
      // Already on target page - perfect!
      console.log(`✅ Already on target page after authentication`);
      finalUrl = currentUrl;
      navigationSuccess = true;
    } else {
      // Not on target page - navigate explicitly
      console.log(`🔄 Navigating to target URL: ${targetUrl}`);

      try {
        await page.goto(targetUrl, {
          waitUntil: 'networkidle',
          timeout: this.EXTENDED_TIMEOUT
        });

        await this.waitForPageStabilization(page);

        finalUrl = page.url();
        console.log(`📍 Final URL after navigation: ${finalUrl}`);

        // Check if we were redirected back to login (auth failed)
        if (authFlow && this.isLoginPage(finalUrl, authFlow.loginUrl)) {
          console.error(`❌ Redirected back to login - authentication may have failed`);
          navigationSuccess = false;
        } else {
          // Verify we reached the target or an acceptable authenticated page
          navigationSuccess = this.urlsMatch(targetUrl, finalUrl);
          if (navigationSuccess) {
            console.log(`✅ Successfully navigated to target page`);
          } else {
            console.log(`⚠️ Reached different page: ${finalUrl} (expected: ${targetUrl})`);
            // Consider it successful if not back on login page
            navigationSuccess = !this.isLoginPage(finalUrl, authFlow?.loginUrl);
          }
        }

      } catch (navError) {
        console.error(`❌ Failed to navigate to target URL: ${navError.message}`);
        finalUrl = page.url();
        navigationSuccess = false;
      }
    }

    return { finalUrl, navigationSuccess };
  }

  /**
   * Categorize navigation errors for better user feedback
   */
  private categorizeNavigationError(
    finalUrl: string,
    targetUrl: string,
    authFlow?: LoginFlow
  ): { message: string; category: string } {
    // Check if back on login page
    if (authFlow && this.isLoginPage(finalUrl, authFlow.loginUrl)) {
      return {
        category: 'AUTHENTICATION_FAILED',
        message: `Authentication failed - redirected back to login page. Please verify credentials are correct.`
      };
    }

    // Check for DNS errors
    if (finalUrl.includes('about:blank') || finalUrl === 'chrome-error://') {
      return {
        category: 'DNS_ERROR',
        message: `Cannot reach ${targetUrl} - DNS resolution failed. Please verify the URL is correct and accessible.`
      };
    }

    // Check for SSL errors
    if (finalUrl.includes('ssl') || finalUrl.includes('certificate')) {
      return {
        category: 'SSL_ERROR',
        message: `SSL certificate error when accessing ${targetUrl}. The site may have an invalid certificate.`
      };
    }

    // Generic navigation failure
    return {
      category: 'NAVIGATION_FAILED',
      message: `Failed to reach target page ${targetUrl}. Final URL: ${finalUrl}. This may indicate authentication issues or URL accessibility problems.`
    };
  }

  /**
   * Clean up browser session
   */
  async cleanupSession(browser: Browser): Promise<void> {
    try {
      if (browser) {
        await browser.close();
      }
    } catch (error) {
      console.error('Error cleaning up browser session:', error);
    }
  }

  /**
   * Check if authentication is needed for a URL
   */
  async checkAuthRequired(targetUrl: string, authFlow?: LoginFlow): Promise<{ required: boolean; redirectUrl?: string }> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await this.navigateWithProgressiveLoading(page, targetUrl);
      const currentUrl = page.url();
      
      const urlMatches = this.urlsMatch(targetUrl, currentUrl);
      
      if (urlMatches) {
        return { required: false };
      }
      
      if (authFlow && this.isLoginPage(currentUrl, authFlow.loginUrl)) {
        return { required: true, redirectUrl: currentUrl };
      }
      
      return { required: true, redirectUrl: currentUrl };
    } catch (error) {
      console.error('Error checking auth requirement:', error);
      return { required: true };
    } finally {
      await browser.close();
    }
  }

  /**
   * Navigate to page with progressive loading strategies for slow/problematic sites
   */
  private async navigateWithProgressiveLoading(page: any, url: string) {
    console.log(`🌐 [AUTH] Navigating to ${url} with enhanced loading strategy...`);
    
    try {
      // Strategy 1: Try networkidle first (fast sites)
      console.log(`📡 [AUTH] Attempting fast load strategy (networkidle, 15s timeout)...`);
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 15000 
      });
      console.log(`✅ [AUTH] Fast load successful for ${url}`);
      
    } catch (error) {
      console.log(`⚠️ [AUTH] Fast load failed: ${error.message}`);
      console.log(`🔄 [AUTH] Trying progressive load strategy (domcontentloaded + load + manual waits)...`);
      
      try {
        // Strategy 2: Progressive loading for slow sites
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',  // Wait for DOM only
          timeout: 45000  // Longer timeout for slow sites
        });
        console.log(`📄 [AUTH] DOM loaded for ${url}`);
        
        // Wait for basic page load event
        try {
          await page.waitForLoadState('load', { timeout: 15000 });
          console.log(`🔗 [AUTH] Load event completed for ${url}`);
        } catch (loadError) {
          console.log(`⚠️ [AUTH] Load event timeout - proceeding anyway: ${loadError.message}`);
        }
        
        // Wait for document ready state
        await page.evaluate(() => {
          return new Promise((resolve) => {
            if (document.readyState === 'complete') {
              resolve(true);
            } else {
              document.addEventListener('readystatechange', () => {
                if (document.readyState === 'complete') {
                  resolve(true);
                }
              });
            }
          });
        });
        
        console.log(`✅ [AUTH] Progressive load successful for ${url}`);
        
      } catch (progressiveError) {
        console.log(`⚠️ [AUTH] Progressive load also failed: ${progressiveError.message}`);
        console.log(`🚀 [AUTH] Trying minimal load strategy (domcontentloaded only)...`);
        
        // Strategy 3: Minimal loading for problematic sites
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000  // Maximum timeout
        });
        console.log(`⚡ [AUTH] Minimal load completed for ${url}`);
      }
    }
    
    // Progressive waits for dynamic content with multiple stages
    console.log(`⏳ [AUTH] Waiting for dynamic content to load...`);
    
    // Stage 1: Basic content stabilization
    await page.waitForTimeout(2000);
    
    // Stage 2: Allow additional dynamic loading
    await page.waitForTimeout(1000);
  }
}