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

        // Step 5: Handle TTS-specific authentication navigation
        console.log(`🔄 Authentication successful, handling post-auth navigation...`);
        
        // For TTS, we need manual navigation as headless browsers don't follow JS redirects
        const isTTS = authFlow.loginUrl.includes('tts.am');
        let finalUrl: string;
        let navigationSuccess = false;
        
        if (isTTS) {
          console.log(`🔧 TTS detected - using manual dashboard navigation for headless browser`);
          
          // Try TTS dashboard URLs in order of preference
          const ttsUrls = [
            'https://tts.am/dashboard',
            'https://tts.am/invoices'
          ];
          
          for (const ttsUrl of ttsUrls) {
            try {
              console.log(`🌐 Trying TTS URL: ${ttsUrl}`);
              await page.goto(ttsUrl, { 
                waitUntil: 'networkidle', 
                timeout: this.EXTENDED_TIMEOUT 
              });
              
              await this.waitForPageStabilization(page);
              
              const currentUrl = page.url();
              console.log(`📍 Current URL after TTS navigation: ${currentUrl}`);
              
              // Check if we were redirected back to login (auth failed)
              if (currentUrl.includes('login')) {
                console.log(`❌ Redirected back to login - trying next URL`);
                continue;
              }
              
              // Check if we successfully reached an authenticated page
              if (currentUrl.includes('dashboard') || currentUrl.includes('invoices')) {
                console.log(`✅ Successfully reached TTS authenticated page: ${currentUrl}`);
                finalUrl = currentUrl;
                navigationSuccess = true;
                break;
              }
              
            } catch (error) {
              console.log(`❌ Failed to navigate to ${ttsUrl}: ${error.message}`);
            }
          }
          
          if (!navigationSuccess) {
            finalUrl = page.url();
            console.log(`❌ Could not access TTS authenticated pages`);
          }
          
        } else {
          // For non-TTS sites, use original navigation logic
          console.log(`🔄 Non-TTS site - navigating back to: ${targetUrl}`);
          await page.goto(targetUrl, { 
            waitUntil: 'networkidle', 
            timeout: this.EXTENDED_TIMEOUT 
          });

          await this.waitForPageStabilization(page);
          finalUrl = page.url();
          navigationSuccess = this.urlsMatch(targetUrl, finalUrl);
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

      // Navigate to target URL after auth - using same TTS logic
      console.log(`🔄 Post-authentication navigation...`);
      
      const isTTS = authFlow.loginUrl.includes('tts.am');
      let finalUrl: string;
      let navigationSuccess = false;
      
      if (isTTS) {
        console.log(`🔧 TTS detected - using manual dashboard navigation`);
        
        const ttsUrls = [
          'https://tts.am/dashboard',
          'https://tts.am/invoices'
        ];
        
        for (const ttsUrl of ttsUrls) {
          try {
            console.log(`🌐 Trying TTS URL: ${ttsUrl}`);
            await page.goto(ttsUrl, { 
              waitUntil: 'networkidle', 
              timeout: this.EXTENDED_TIMEOUT 
            });
            
            await this.waitForPageStabilization(page);
            
            const currentUrl = page.url();
            
            if (!currentUrl.includes('login') && 
                (currentUrl.includes('dashboard') || currentUrl.includes('invoices'))) {
              finalUrl = currentUrl;
              navigationSuccess = true;
              break;
            }
            
          } catch (error) {
            console.log(`❌ Failed to navigate to ${ttsUrl}: ${error.message}`);
          }
        }
        
        if (!navigationSuccess) {
          finalUrl = page.url();
        }
        
      } else {
        // For non-TTS sites, use original logic
        await page.goto(targetUrl, { 
          waitUntil: 'networkidle', 
          timeout: this.EXTENDED_TIMEOUT 
        });

        await this.waitForPageStabilization(page);
        finalUrl = page.url();
        navigationSuccess = this.urlsMatch(targetUrl, finalUrl);
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
          await this.executeAuthStep(page, step, authFlow.credentials);
          
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

      // Wait for authentication to complete
      await page.waitForTimeout(3000);
      
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
   * Execute individual authentication step
   */
  private async executeAuthStep(page: Page, step: LoginStep, credentials: { username: string; password: string }): Promise<void> {
    const timeout = this.DEFAULT_TIMEOUT;

    switch (step.type) {
      case 'type':
        let valueToType = step.value || '';
        
        // Replace credential placeholders
        if (valueToType === '${username}') {
          valueToType = credentials.username;
        } else if (valueToType === '${password}') {
          valueToType = credentials.password;
        }
        
        await page.fill(step.selector, valueToType, { timeout });
        break;

      case 'click':
        await page.click(step.selector, { timeout });
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
      
      // For exact URL matching, also compare search params and protocol
      const protocolMatch = expected.protocol === actual.protocol;
      const searchMatch = expected.search === actual.search;
      
      // URL matches if hostname, pathname, protocol, and search params all match
      const exactMatch = hostnameMatch && pathnameMatch && protocolMatch && searchMatch;
      
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