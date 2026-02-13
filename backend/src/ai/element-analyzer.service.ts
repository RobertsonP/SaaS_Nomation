import { Injectable } from '@nestjs/common';
import { Page, ElementHandle } from 'playwright';
import { AiService } from './ai.service';
import { DetectedElement, PageAnalysisResult, SelectorValidationResult, QualityMetrics, LoginFlow } from './interfaces/element.interface';
import { BrowserManagerService } from './browser-manager.service';
import { SelectorQualityService } from './selector-quality.service';
import { ElementDetectionService } from './element-detection.service';
import { MetadataExtractionService } from './metadata-extraction.service';
import { InteractiveElementDiscoveryService } from './interactive-element-discovery.service';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import { TestStep, MultiUrlAnalysisResult, UrlAnalysisResult, ElementHuntResult } from '../common/types/execution.types';

@Injectable()
export class ElementAnalyzerService {
  constructor(
    private aiService: AiService,
    private browserManager: BrowserManagerService,
    private selectorQuality: SelectorQualityService,
    private elementDetection: ElementDetectionService,
    private metadataExtraction: MetadataExtractionService,
    private interactiveDiscovery: InteractiveElementDiscoveryService,
    private unifiedAuthService: UnifiedAuthService,
  ) {}

  async analyzePage(url: string, options?: { fastMode?: boolean; storageState?: any; onProgress?: (stage: string, percent: number, detail?: string) => void }): Promise<PageAnalysisResult> {
    const fastMode = options?.fastMode ?? false;
    const onProgress = options?.onProgress;

    onProgress?.('Opening page...', 5);

    const browser = await this.browserManager.setupBrowser();
    // Use createPageForUrl to handle localhost SSL errors and optional storageState
    const page = await this.browserManager.createPageForUrl(browser, url, {
      storageState: options?.storageState,
    });

    try {
      console.log(`Analyzing page: ${url}${fastMode ? ' (FAST MODE)' : ''}`);

      // Navigate to the page and wait for content to load
      await this.browserManager.navigateToPage(page, url, { fastMode });
      onProgress?.('Page loaded, scanning elements...', 20);

      // Enhanced element extraction with CSS information (screenshots always skipped — CSS preview is sufficient)
      const elements = await this.elementDetection.extractAllPageElements(page, { skipScreenshots: true });
      // Interactive discovery (modals, dropdowns, tabs) runs separately via Phase 5 trigger — not during initial scan
      onProgress?.(`Found ${elements.length} elements total`, 90);

      console.log(`Found ${elements.length} elements with enhanced data`);
      onProgress?.('Complete', 100, `${elements.length} elements extracted`);

      await this.browserManager.closeBrowser(browser);

      return {
        url,
        elements,
        analysisDate: new Date(),
        success: true
      };
    } catch (error) {
      await this.browserManager.closeBrowser(browser);
      console.error('❌ Page analysis failed:', error);

      // Enhanced error categorization and feedback
      const errorCategory = this.categorizeAnalysisError(error, url);
      console.error(`🔍 Error category: ${errorCategory.category}`);
      console.error(`📝 Error details:`, errorCategory.details);

      return {
        url,
        elements: [],
        analysisDate: new Date(),
        success: false,
        errorMessage: errorCategory.message,
        errorCategory: errorCategory.category,
        errorDetails: errorCategory.details
      };
    }
  }

  // Phase 2: Enhanced selector validation with comprehensive metrics
  async validateSelector(url: string, selector: string): Promise<SelectorValidationResult> {
    const browser = await this.browserManager.setupBrowser();
    // Use createPageForUrl to handle localhost SSL errors
    const page = await this.browserManager.createPageForUrl(browser, url);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

      // Test the selector
      const elements = await page.locator(selector).all();
      const elementCount = elements.length;

      // Get element handle for additional analysis
      let elementHandle = null;
      if (elementCount > 0) {
        try {
          elementHandle = await page.locator(selector).first().elementHandle();
        } catch (e) {
          // Element handle not available
        }
      }

      // Calculate comprehensive quality metrics
      const qualityBreakdown = this.selectorQuality.calculateEnhancedSelectorQuality(selector, elementCount, elementHandle);

      // Generate enhanced suggestions
      const suggestions = this.generateEnhancedSelectorSuggestions(selector, elementCount, qualityBreakdown);

      // Generate alternative selectors if not unique
      const alternativeSelectors = elementCount !== 1 ?
        await this.generateAlternativeSelectors(page, selector, elementHandle) : [];

      await this.browserManager.closeBrowser(browser);

      return {
        selector,
        isValid: elementCount > 0,
        elementCount,
        qualityScore: qualityBreakdown.overall,
        suggestions,
        // Enhanced Phase 2 properties
        isUnique: elementCount === 1,
        stabilityScore: qualityBreakdown.stability,
        accessibilityScore: qualityBreakdown.accessibility,
        specificityScore: qualityBreakdown.specificity,
        alternativeSelectors,
        qualityBreakdown
      };
    } catch (error) {
      await this.browserManager.closeBrowser(browser);

      return {
        selector,
        isValid: false,
        elementCount: 0,
        qualityScore: 0,
        suggestions: ['Selector syntax error or element not found'],
        error: error.message,
        isUnique: false,
        stabilityScore: 0,
        accessibilityScore: 0,
        specificityScore: 0,
        alternativeSelectors: [],
        qualityBreakdown: {
          uniqueness: 0,
          stability: 0,
          specificity: 0,
          accessibility: 0,
          overall: 0
        }
      };
    }
  }

  // Phase 2: Cross-page selector validation for project-wide consistency
  async validateSelectorAcrossPages(urls: string[], selector: string): Promise<SelectorValidationResult> {
    try {
      // Validate input URLs
      if (!urls || urls.length === 0) {
        throw new Error('No URLs provided for validation');
      }
      const validationResults = [];
      const browser = await this.browserManager.setupBrowser();

      for (const url of urls) {
        try {
          // Use createPageForUrl to handle localhost SSL errors
          const page = await this.browserManager.createPageForUrl(browser, url);
          await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

          const elements = await page.locator(selector).all();
          const elementCount = elements.length;

          validationResults.push({
            url,
            elementCount,
            isValid: elementCount > 0,
            isUnique: elementCount === 1,
            error: null
          });

          await page.close();
        } catch (error) {
          validationResults.push({
            url,
            elementCount: 0,
            isValid: false,
            isUnique: false,
            error: error.message
          });
        }
      }

      await this.browserManager.closeBrowser(browser);

      // Analyze cross-page results
      const validUrls = validationResults.filter(r => r.isValid).length;
      const uniqueOnAllPages = validationResults.every(r => r.isUnique || !r.isValid);
      const averageMatchCount = validationResults
        .filter(r => r.isValid)
        .reduce((sum, r) => sum + r.elementCount, 0) / Math.max(validUrls, 1);

      const inconsistentPages = validationResults
        .filter(r => r.isValid && !r.isUnique)
        .map(r => r.url);

      const validationErrors = validationResults
        .filter(r => r.error)
        .map(r => `${r.url}: ${r.error}`);

      // Calculate overall quality based on cross-page consistency
      const qualityBreakdown = this.selectorQuality.calculateEnhancedSelectorQuality(
        selector,
        averageMatchCount,
        null
      );

      // Adjust quality based on cross-page consistency
      if (!uniqueOnAllPages) {
        qualityBreakdown.uniqueness *= 0.5; // Penalize for inconsistency
        qualityBreakdown.overall = (
          qualityBreakdown.uniqueness * 0.4 +
          qualityBreakdown.stability * 0.3 +
          qualityBreakdown.specificity * 0.2 +
          qualityBreakdown.accessibility * 0.1
        );
      }

      const crossPageValidation = {
        totalUrls: urls.length,
        validUrls,
        uniqueOnAllPages,
        averageMatchCount,
        inconsistentPages,
        validationErrors
      };

      const suggestions = this.generateCrossPageSuggestions(crossPageValidation, selector);

      return {
        selector,
        isValid: validUrls > 0,
        elementCount: Math.round(averageMatchCount),
        qualityScore: qualityBreakdown.overall,
        suggestions,
        isUnique: uniqueOnAllPages && averageMatchCount === 1,
        stabilityScore: qualityBreakdown.stability,
        accessibilityScore: qualityBreakdown.accessibility,
        specificityScore: qualityBreakdown.specificity,
        crossPageValidation,
        qualityBreakdown
      };

    } catch (error) {
      return {
        selector,
        isValid: false,
        elementCount: 0,
        qualityScore: 0,
        suggestions: [`Cross-page validation failed: ${error.message}`],
        error: error.message,
        isUnique: false,
        stabilityScore: 0,
        accessibilityScore: 0,
        specificityScore: 0,
        qualityBreakdown: {
          uniqueness: 0,
          stability: 0,
          specificity: 0,
          accessibility: 0,
          overall: 0
        }
      };
    }
  }


  // Phase 2: Generate alternative selectors for non-unique ones
  private async generateAlternativeSelectors(page: Page, originalSelector: string, elementHandle: ElementHandle | null): Promise<string[]> {
    // Delegate to SelectorQualityService
    return this.selectorQuality.generateAlternativeSelectors(page, originalSelector, elementHandle);
  }

  // Backward compatibility wrappers - delegate to services
  private generateSelectorSuggestions(selector: string, elementCount: number): string[] {
    return this.selectorQuality.generateSelectorSuggestions(selector, elementCount);
  }

  private generateEnhancedSelectorSuggestions(selector: string, elementCount: number, qualityMetrics: QualityMetrics): string[] {
    return this.selectorQuality.generateEnhancedSelectorSuggestions(selector, elementCount, qualityMetrics);
  }

  // Phase 2: Generate cross-page validation suggestions - delegate to SelectorQualityService
  private generateCrossPageSuggestions(validation: {
    validUrls: number;
    totalUrls: number;
    uniqueOnAllPages: boolean;
    inconsistentPages: string[];
    averageMatchCount: number;
    validationErrors: string[];
  }, selector: string): string[] {
    return this.selectorQuality.generateCrossPageSuggestions(validation, selector);
  }

  async getPageMetadata(url: string): Promise<{ title: string; description?: string }> {
    const browser = await this.browserManager.setupBrowser();
    // Use createPageForUrl to handle localhost SSL errors
    const page = await this.browserManager.createPageForUrl(browser, url);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Enhanced page title detection with multiple fallback strategies
      const pageTitle = await this.metadataExtraction.extractIntelligentPageTitle(page, url);
      const description = await page.locator('meta[name="description"]').getAttribute('content');

      await this.browserManager.closeBrowser(browser);

      return { title: pageTitle, description };
    } catch (error) {
      await this.browserManager.closeBrowser(browser);

      // Generate user-friendly fallback title from URL
      const fallbackTitle = this.metadataExtraction.generateFallbackTitle(url);
      return { title: fallbackTitle };
    }
  }

  // Method for extracting elements from authenticated pages (used by authentication service)
  // NOW USES FULL COMPREHENSIVE SELECTOR SYSTEM (same as main analysis)
  async extractElementsFromAuthenticatedPage(page: Page): Promise<DetectedElement[]> {
    console.log('🔍 Extracting elements from authenticated page with comprehensive selectors...');

    try {
      // Use the SAME comprehensive system as main analysis to avoid 0 elements issue
      console.log('🔄 Calling extractAllPageElements for authenticated page...');
      const result = await this.elementDetection.extractAllPageElements(page);
      console.log(`✅ extractAllPageElements completed - found ${result.length} elements`);
      return result;

    } catch (error) {
      console.error('❌ Error extracting elements from authenticated page:', error);
      console.error('❌ Error stack:', error.stack);
      return [];
    }
  }

  // Enhanced error categorization for better debugging and user feedback
  categorizeAnalysisError(error: Error | unknown, url: string): {
    category: 'NETWORK_ERROR' | 'TIMEOUT_ERROR' | 'AUTHENTICATION_ERROR' | 'JAVASCRIPT_ERROR' | 'BROWSER_ERROR' | 'ELEMENT_ANALYSIS_ERROR' | 'SSL_ERROR' | 'UNKNOWN_ERROR' | 'SLOW_SITE_TIMEOUT' | 'LOADING_TIMEOUT' | 'BOT_DETECTION';
    message: string;
    details: { originalError: string; url: string; suggestions: string[] }
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    // Timeout errors (most common for slow sites)
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      if (lowerMessage.includes('networkidle') || lowerMessage.includes('waiting until')) {
        return {
          category: 'SLOW_SITE_TIMEOUT',
          message: `Site loads too slowly (>30s): ${new URL(url).hostname} may have heavy content, ads, or slow CDN. Try again or contact site administrator.`,
          details: {
            url,
            originalError: errorMessage,
            suggestions: [
              'Site has heavy JavaScript, analytics, or ads causing slow loading',
              'CDN or external resources may be slow',
              'Try analyzing a different page from this site',
              'Site may require authentication or have bot protection'
            ]
          }
        };
      } else {
        return {
          category: 'LOADING_TIMEOUT',
          message: `Page loading timeout: ${errorMessage}`,
          details: { originalError: errorMessage, url, suggestions: ['Increase timeout', 'Check network speed'] }
        };
      }
    }

    // Network connection errors
    if (lowerMessage.includes('net::err_') || lowerMessage.includes('connection') ||
        lowerMessage.includes('econnrefused') || lowerMessage.includes('enotfound')) {
      return {
        category: 'NETWORK_ERROR',
        message: `Network connection failed: Cannot reach ${new URL(url).hostname}. Check URL or internet connection.`,
        details: {
          url,
          originalError: errorMessage,
          suggestions: [
            'Verify the URL is correct and accessible',
            'Check if the site is down or blocking automated access',
            'Try accessing the site manually in a browser'
          ]
        }
      };
    }

    // SSL/Certificate errors
    if (lowerMessage.includes('ssl') || lowerMessage.includes('certificate') ||
        lowerMessage.includes('tls') || lowerMessage.includes('cert')) {
      return {
        category: 'SSL_ERROR',
        message: `SSL certificate error: ${new URL(url).hostname} has certificate issues.`,
        details: { originalError: errorMessage, url, suggestions: ['Check SSL certificate', 'Try HTTP instead of HTTPS'] }
      };
    }

    // Authentication/Access errors
    if (lowerMessage.includes('auth') || lowerMessage.includes('login') ||
        lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
      return {
        category: 'AUTHENTICATION_ERROR',
        message: `Authentication required: ${new URL(url).hostname} requires login to access this page.`,
        details: {
          url,
          originalError: errorMessage,
          suggestions: [
            'Page may require user login',
            'Set up authentication flow in project settings',
            'Try analyzing a public page first'
          ]
        }
      };
    }

    // Bot detection/blocking errors
    if (lowerMessage.includes('blocked') || lowerMessage.includes('captcha') ||
        lowerMessage.includes('cloudflare') || lowerMessage.includes('bot')) {
      return {
        category: 'BOT_DETECTION',
        message: `Site blocking automated access: ${new URL(url).hostname} has anti-bot protection.`,
        details: {
          url,
          originalError: errorMessage,
          suggestions: [
            'Site uses Cloudflare, CAPTCHA, or bot detection',
            'Try again after a few minutes',
            'Contact site administrator about automated testing access'
          ]
        }
      };
    }

    // JavaScript/Content errors
    if (lowerMessage.includes('javascript') || lowerMessage.includes('evaluation failed')) {
      return {
        category: 'JAVASCRIPT_ERROR',
        message: `JavaScript execution failed: ${errorMessage}`,
        details: { originalError: errorMessage, url, suggestions: ['Check page JavaScript', 'Disable JS blocking extensions'] }
      };
    }

    // Generic fallback
    return {
      category: 'UNKNOWN_ERROR',
      message: `Analysis failed for ${new URL(url).hostname}: ${errorMessage}`,
      details: {
        originalError: errorMessage,
        url,
        suggestions: [
          'Try analyzing the page again',
          'Check browser console for detailed errors',
          'Contact support if the issue persists'
        ]
      }
    };
  }

  // Authentication-aware page analysis
  async analyzePageWithAuth(url: string, authFlow: LoginFlow): Promise<PageAnalysisResult> {
    console.log(`🔐 Analyzing page with auth: ${url}`);

    // Authenticate using UnifiedAuthService and capture storageState
    let storageState: any = null;
    try {
      const authResult = await this.unifiedAuthService.authenticateForUrl(
        url,
        authFlow,
        undefined,
        { forceAuthenticate: true },
      );

      if (authResult.result.authenticated) {
        // Capture storageState from the authenticated context
        storageState = await authResult.page.context().storageState();
        console.log(`🔐 Captured auth storageState (${storageState?.cookies?.length || 0} cookies)`);
      } else {
        console.warn(`⚠️ Authentication did not complete, analyzing without auth`);
      }

      // Clean up the auth browser (analyzePage creates its own)
      await authResult.page.close();
      if (!authResult.result.authenticated) {
        await this.unifiedAuthService.cleanupSession(authResult.browser);
      } else {
        await this.unifiedAuthService.cleanupSession(authResult.browser);
      }
    } catch (authError) {
      console.error(`❌ Auth failed for analysis, falling back to unauthenticated: ${authError.message}`);
    }

    return await this.analyzePage(url, { storageState });
  }

  // Multiple URL analysis with authentication
  async analyzeAllUrlsWithAuth(
    urls: string[],
    authFlow: LoginFlow,
    progressCallback?: (step: string, message: string, current?: number, total?: number) => void
  ): Promise<MultiUrlAnalysisResult> {
    console.log(`🔐 Analyzing ${urls.length} URLs with auth flow`);

    // Authenticate once and capture storageState for reuse across all URLs
    let storageState: any = null;
    try {
      const authResult = await this.unifiedAuthService.authenticateForUrl(
        urls[0],
        authFlow,
        undefined,
        { forceAuthenticate: true },
      );

      if (authResult.result.authenticated) {
        storageState = await authResult.page.context().storageState();
        console.log(`🔐 Captured auth storageState for multi-URL analysis (${storageState?.cookies?.length || 0} cookies)`);
      }

      await authResult.page.close();
      await this.unifiedAuthService.cleanupSession(authResult.browser);
    } catch (authError) {
      console.error(`❌ Auth failed for multi-URL analysis: ${authError.message}`);
    }

    const urlResults: UrlAnalysisResult[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        if (progressCallback) {
          progressCallback('analyzing', `Analyzing ${url}`, i + 1, urls.length);
        }

        const result = await this.analyzePage(url, { storageState });
        urlResults.push({
          url,
          elements: result.elements,
          success: result.success,
          errorMessage: result.errorMessage
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        urlResults.push({
          url,
          elements: [],
          success: false,
          errorMessage
        });
      }
    }

    return {
      success: true,
      urlResults,
      authenticationUsed: true
    };
  }

  // Element screenshot capture - delegate to ElementDetectionService
  async captureElementScreenshot(url: string, selector: string): Promise<string | null> {
    return this.elementDetection.captureElementScreenshot(url, selector);
  }

  async huntElementsAfterSteps(config: {
    startingUrl: string;
    steps: TestStep[];
    projectId: string;
    testId: string;
  }): Promise<{ success: boolean; elements?: DetectedElement[]; error?: string }> {
    console.log(`🔍 Starting element hunting after executing ${config.steps.length} test steps`);

    let browser = null;
    try {
      browser = await this.browserManager.setupBrowser();
      // Use createPageForUrl to handle localhost SSL errors
      const page = await this.browserManager.createPageForUrl(browser, config.startingUrl);

      // Set desktop viewport and navigate to starting URL (matches live-browser.service.ts)
      await page.setViewportSize({ width: 1920, height: 1080 });
      console.log(`🌐 Navigating to: ${config.startingUrl}`);

      // Progressive navigation with multiple fallbacks
      let navigationSucceeded = false;
      try {
        await page.goto(config.startingUrl, { waitUntil: 'networkidle', timeout: 15000 });
        console.log(`✅ Navigation succeeded with networkidle`);
        navigationSucceeded = true;
      } catch (navError) {
        console.warn(`⚠️ Networkidle wait timed out, trying domcontentloaded...`);
        // If networkidle fails (common on complex sites), ensure we at least loaded DOM
        if (page.url() === 'about:blank') {
          try {
            await page.goto(config.startingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            console.log(`✅ Navigation succeeded with domcontentloaded`);
            navigationSucceeded = true;
          } catch (domError) {
            console.warn(`⚠️ Domcontentloaded wait timed out, trying basic load...`);
            try {
              await page.goto(config.startingUrl, { waitUntil: 'load', timeout: 45000 });
              console.log(`✅ Navigation succeeded with load`);
              navigationSucceeded = true;
            } catch (loadError) {
              console.error(`❌ All navigation strategies failed`);
            }
          }
        } else {
          // Page already loaded, consider it successful
          console.log(`✅ Page already loaded (networkidle timeout but page navigated)`);
          navigationSucceeded = true;
        }
      }

      if (!navigationSucceeded) {
        return {
          success: false,
          error: 'Navigation timeout: Unable to load starting URL after 45 seconds with all strategies'
        };
      }

      // Execute each test step to reach the final state
      console.log(`⚡ Executing ${config.steps.length} test steps...`);
      let successfulSteps = 0;
      for (let i = 0; i < config.steps.length; i++) {
        const step = config.steps[i];
        console.log(`  Step ${i + 1}/${config.steps.length}: ${step.type} on ${step.selector}`);

        try {
          await this.executeTestStep(page, step);
          successfulSteps++;
          // Small delay between steps for stability
          await page.waitForTimeout(500);
        } catch (stepError) {
          console.warn(`⚠️ Step ${i + 1} failed: ${stepError.message}`);
          // Continue with remaining steps even if one fails
        }
      }

      console.log(`✅ Completed ${successfulSteps}/${config.steps.length} test steps successfully`);

      // Wait for page to stabilize after all interactions
      await page.waitForTimeout(1000);

      // Discover elements in the final state using existing method
      console.log(`🔍 Discovering elements in post-interaction state...`);
      const elements = await this.elementDetection.extractAllPageElements(page);

      console.log(`🎯 Discovered ${elements.length} elements in post-interaction state`);

      return {
        success: true,
        elements: elements
      };

    } catch (error) {
      console.error(`❌ Element hunting failed: ${error.message}`);
      console.error(`❌ Error stack:`, error.stack);

      return {
        success: false,
        error: `Element hunting failed: ${error.message}`
      };

    } finally {
      // Always cleanup browser, even on error
      if (browser) {
        try {
          await this.browserManager.closeBrowser(browser);
          console.log(`🧹 Browser cleanup completed`);
        } catch (cleanupError) {
          console.error(`⚠️ Browser cleanup failed: ${cleanupError.message}`);
          // Don't throw - cleanup errors shouldn't fail the operation
        }
      }
    }
  }

  private async executeTestStep(page: Page, step: TestStep): Promise<void> {
    const { type, selector, value } = step;

    // Use modern Playwright Locator API for better reliability
    const locator = page.locator(selector).first();

    // Wait for element to be available (visible and stable)
    try {
      await locator.waitFor({ state: 'visible', timeout: 10000 });
    } catch (e) {
      console.warn(`⚠️ Element ${selector} not visible within timeout, trying anyway...`);
    }

    switch (type) {
      case 'click':
        await locator.click({ timeout: 5000 });
        break;

      case 'doubleclick':
        await locator.dblclick({ timeout: 5000 });
        break;

      case 'type':
        await locator.fill(value || '', { timeout: 5000 });
        break;

      case 'clear':
        await locator.fill('', { timeout: 5000 });
        break;

      case 'hover':
        await locator.hover({ timeout: 5000 });
        break;

      case 'select':
        await locator.selectOption(value || '', { timeout: 5000 });
        break;

      case 'check':
        await locator.check({ timeout: 5000 });
        break;

      case 'uncheck':
        await locator.uncheck({ timeout: 5000 });
        break;

      case 'press':
        await page.keyboard.press(value || 'Enter');
        break;

      case 'wait':
        const waitTime = parseInt(value) || 1000;
        await page.waitForTimeout(waitTime);
        break;

      case 'scroll':
        await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (element) element.scrollIntoView();
        }, selector);
        break;

      default:
        console.warn(`⚠️ Unknown step type: ${type}, skipping`);
    }

    // Wait for any potential page changes after the action
    await page.waitForTimeout(200);
  }
}
