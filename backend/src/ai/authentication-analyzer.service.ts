import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { chromium } from 'playwright';
import { ElementAnalyzerService } from './element-analyzer.service';
import { PageAnalysisResult } from './interfaces/element.interface';
import { AnalysisProgressGateway } from '../analysis/analysis-progress.gateway';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Authentication-specific element analysis service
 * 
 * Handles all authentication flows and authenticated page element extraction.
 * This service depends on the main ElementAnalyzerService for core functionality.
 */
@Injectable()
export class AuthenticationAnalyzerService {
  constructor(
    @Inject(forwardRef(() => ElementAnalyzerService))
    private elementAnalyzer: ElementAnalyzerService,
    private progressGateway: AnalysisProgressGateway,
    private unifiedAuthService: UnifiedAuthService
  ) {}
  
  private async saveScreenshot(screenshot: Buffer, filename: string): Promise<void> {
    try {
      const screenshotDir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      
      const filepath = path.join(screenshotDir, `${filename}.png`);
      fs.writeFileSync(filepath, screenshot);
      console.log(`📸 Screenshot saved: ${filepath}`);
    } catch (error) {
      console.error(`❌ Failed to save screenshot ${filename}:`, error.message);
    }
  }


  /**
   * Analyze multiple URLs with authentication using UnifiedAuthService
   * 
   * Implements the exact 2-logic authentication flow:
   * Logic 1: Open URL → Wait 10-15s → Check URL match → Start scraping
   * Logic 2: Open URL → Wait → Check URL → If auth required → Execute auth steps → Wait → Reopen URL → Verify → Start scraping
   */
  async analyzeAllUrlsWithAuth(
    urls: string[], 
    authFlow: any, 
    progressCallback?: (step: string, message: string, current?: number, total?: number) => void
  ): Promise<any> {
    console.log(`🔐 Starting URL-by-URL analysis with auth flow: ${authFlow.name}`);
    console.log(`📈 Analysis details:`);
    console.log(`  URLs to analyze: ${urls.length}`);
    console.log(`  Auth flow: ${authFlow.name}`);
    console.log(`  Login URL: ${authFlow.loginUrl}`);
    console.log(`  Auth steps: ${authFlow.steps.length}`);
    
    if (progressCallback) {
      progressCallback('starting', `Starting analysis of ${urls.length} URLs with authentication`, 0, urls.length);
    }
    
    // Analyze each PROJECT URL using UnifiedAuthService
    const urlResults = [];
    for (let i = 0; i < urls.length; i++) {
      const projectUrl = urls[i];
      
      // Report progress
      if (progressCallback) {
        console.log(`📊 CALLING PROGRESS CALLBACK: analyzing - Processing ${projectUrl} (${i + 1}/${urls.length})`);
        progressCallback('analyzing', `Processing ${projectUrl} (${i + 1}/${urls.length})`, i + 1, urls.length);
      } else {
        console.log(`⚠️ NO PROGRESS CALLBACK PROVIDED - progress bar will not work`);
      }
      
      let authSession = null;
      
      try {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📄 PROCESSING URL ${i + 1} OF ${urls.length}`);
        console.log(`🎯 Target: ${projectUrl}`);
        console.log(`${'='.repeat(80)}\n`);

        // IMPLEMENTATION OF YOUR 2-LOGIC FLOW:

        // STEP 1: Open the URL provided in project
        console.log(`🌐 STEP 1: Opening URL: ${projectUrl}`);
        if (progressCallback) {
          progressCallback('loading', `Opening ${projectUrl} (${i + 1}/${urls.length})`, i + 1, urls.length);
        }
        
        // Use UnifiedAuthService to handle authentication logic
        authSession = await this.unifiedAuthService.authenticateForUrl(projectUrl, authFlow);
        const { browser, page, result } = authSession;

        // STEP 2: Wait for some amount of time (10-15 seconds) - handled by UnifiedAuthService
        console.log(`⏳ LOGIC STEP 2: Waiting for page stabilization (handled by UnifiedAuthService)`);

        // STEP 3: Additional wait after auth for page redirects/loading
        console.log(`⏳ Waiting additional 3 seconds for page redirect/loading...`);
        await page.waitForTimeout(3000);

        // Wait for page to be ready
        try {
          await page.waitForLoadState('networkidle', { timeout: 10000 });
          console.log(`✅ Page reached networkidle state`);
        } catch (waitError) {
          console.log(`⚠️ Page did not reach networkidle, proceeding anyway`);
        }

        // STEP 4: Check if current URL matches with provided URL - handled by UnifiedAuthService
        const currentUrl = page.url();
        console.log(`🔍 LOGIC STEP 4: URL Check - Target: ${projectUrl}, Current: ${currentUrl}, Success: ${result.success}`);

        // Take screenshot after authentication/navigation
        const afterAuthScreenshot = await page.screenshot({ type: 'png', fullPage: true });
        await this.saveScreenshot(afterAuthScreenshot, `auth_complete_${i}_${Date.now()}`);
        console.log(`📸 SCREENSHOT AFTER AUTH - Base64 length: ${afterAuthScreenshot.toString('base64').length}`);

        if (!result.success) {
          console.error(`❌ Authentication/navigation failed: ${result.errorMessage}`);
          throw new Error(result.errorMessage || 'Authentication failed');
        }

        // STEP 5: Navigate to target URL (explicit navigation for reliability)
        console.log(`\n🎯 === NAVIGATION TO TARGET PAGE ===`);
        console.log(`   Target URL: ${projectUrl}`);
        console.log(`   Current URL: ${currentUrl}`);
        console.log(`   Auth was needed: ${result.authenticated ? 'YES' : 'NO'}`);

        // Check if we're already on target page
        const onTargetPage = this.unifiedAuthService.urlsMatch(projectUrl, currentUrl);

        if (onTargetPage) {
          console.log(`✅ Already on target page - ready to analyze`);
        } else {
          console.log(`🔄 Not on target page - navigating now...`);

          // Navigate to target URL (whether it's login page or protected page)
          try {
            console.log(`📍 Navigating to: ${projectUrl}`);
            await page.goto(projectUrl, {
              waitUntil: 'networkidle',
              timeout: 30000
            });

            // Wait for page to stabilize
            await page.waitForTimeout(2000);

            // Verify we reached the target
            const finalUrl = page.url();
            console.log(`📍 Final URL after navigation: ${finalUrl}`);

            if (!this.unifiedAuthService.urlsMatch(projectUrl, finalUrl)) {
              console.error(`❌ Navigation did not reach target. Expected: ${projectUrl}, Got: ${finalUrl}`);
              throw new Error(`Failed to navigate to target page ${projectUrl}. Final URL: ${finalUrl}`);
            }

            console.log(`✅ Successfully navigated to target page`);

          } catch (navError) {
            console.error(`❌ Navigation error: ${navError.message}`);
            throw new Error(`Failed to navigate to ${projectUrl}: ${navError.message}`);
          }
        }
        
        if (result.authenticated) {
          console.log(`✅ LOGIC STEP 4-9 COMPLETED: Authentication successful, now on target page`);
          if (progressCallback) {
            progressCallback('authenticated', `Successfully authenticated to ${projectUrl}`, i + 1, urls.length);
          }
        } else {
          console.log(`✅ LOGIC STEP 1-4 COMPLETED: No authentication needed, already on target page`);
          if (progressCallback) {
            progressCallback('ready', `Already accessible: ${projectUrl}`, i + 1, urls.length);
          }
        }
        
        // STEP 6: Start element extraction
        console.log(`\n🔍 === ELEMENT EXTRACTION ===`);
        console.log(`   Analyzing page: ${projectUrl}`);
        if (progressCallback) {
          progressCallback('extracting', `Analyzing ${projectUrl} (${i + 1}/${urls.length})`, i + 1, urls.length);
        }
        
        // Take screenshot before element extraction
        const beforeExtractionScreenshot = await page.screenshot({ type: 'png', fullPage: true });
        await this.saveScreenshot(beforeExtractionScreenshot, `before_extraction_${i}_${Date.now()}`);
        console.log(`📸 BEFORE EXTRACTION SCREENSHOT - Base64 length: ${beforeExtractionScreenshot.toString('base64').length}`);
        
        // Enhanced page state analysis before extraction
        console.log(`🔍 === PAGE STATE ANALYSIS BEFORE EXTRACTION ===`);
        console.log(`📄 Current URL: ${page.url()}`);
        console.log(`📜 Page Title: ${await page.title()}`);
        
        const pageAnalysis = await page.evaluate(() => {
          const allElements = document.querySelectorAll('*');
          const buttons = document.querySelectorAll('button');
          const inputs = document.querySelectorAll('input');
          const links = document.querySelectorAll('a');
          const forms = document.querySelectorAll('form');
          const interactiveElements = document.querySelectorAll('button, input, a, form, [role="button"], select, textarea');
          
          // Authentication indicators
          const hrefLogoutElements = document.querySelectorAll('[href*="logout"]');
          const onclickLogoutElements = document.querySelectorAll('[onclick*="logout"]');
          const buttonLogoutElements = Array.from(document.querySelectorAll('button')).filter(el => 
            el.textContent && el.textContent.toLowerCase().includes('logout')
          );
          const linkLogoutElements = Array.from(document.querySelectorAll('a')).filter(el => 
            el.textContent && el.textContent.toLowerCase().includes('logout')
          );
          
          const logoutElementsCount = hrefLogoutElements.length + onclickLogoutElements.length + 
                                     buttonLogoutElements.length + linkLogoutElements.length;
          
          const userElements = document.querySelectorAll('[class*="user"], [id*="user"], [class*="profile"], [id*="profile"]');
          const bodyHTML = document.body ? document.body.innerHTML.length : 0;
          const hasScripts = document.querySelectorAll('script').length;
          
          return {
            totalElements: allElements.length,
            buttons: buttons.length,
            inputs: inputs.length,
            links: links.length,
            forms: forms.length,
            interactiveElements: interactiveElements.length,
            logoutElements: logoutElementsCount,
            userElements: userElements.length,
            bodyHTMLLength: bodyHTML,
            scriptsCount: hasScripts,
            readyState: document.readyState,
            url: window.location.href,
            title: document.title
          };
        });
        
        console.log(`📊 PAGE ANALYSIS RESULTS:`);
        console.log(`  Total DOM elements: ${pageAnalysis.totalElements}`);
        console.log(`  Interactive elements: ${pageAnalysis.interactiveElements}`);
        console.log(`  Buttons: ${pageAnalysis.buttons}, Inputs: ${pageAnalysis.inputs}, Links: ${pageAnalysis.links}`);
        console.log(`  Forms: ${pageAnalysis.forms}`);
        console.log(`  Body HTML length: ${pageAnalysis.bodyHTMLLength}`);
        console.log(`  Scripts: ${pageAnalysis.scriptsCount}, Ready state: ${pageAnalysis.readyState}`);
        console.log(`  Auth indicators - Logout elements: ${pageAnalysis.logoutElements}, User elements: ${pageAnalysis.userElements}`);
        
        if (pageAnalysis.interactiveElements === 0) {
          console.error(`❌ CRITICAL: No interactive elements found on page! This suggests page is empty or not loaded.`);
        }
        
        // Extract elements using existing method
        console.log(`🔍 CALLING extractElementsFromAuthenticatedPage...`);
        const elements = await this.elementAnalyzer.extractElementsFromAuthenticatedPage(page);
        console.log(`📊 EXTRACTED ELEMENTS COUNT: ${elements.length}`);
        
        // Enhanced element extraction logging
        if (elements.length === 0 && pageAnalysis.interactiveElements > 0) {
          console.error(`❌ EXTRACTION MISMATCH: Page has ${pageAnalysis.interactiveElements} interactive elements but extraction returned 0!`);
          console.error(`❌ This suggests an issue with the extraction method, not the page content.`);
        }
        
        if (elements.length > 0) {
          console.log(`📋 FIRST 3 EXTRACTED ELEMENTS:`);
          elements.slice(0, 3).forEach((el, idx) => {
            console.log(`  ${idx + 1}. ${el.elementType}: ${el.description} (${el.selector})`);
          });
        } else {
          console.error(`❌ NO ELEMENTS EXTRACTED! This is the core issue!`);
          
          // Take additional debug screenshot
          const noElementsScreenshot = await page.screenshot({ type: 'png', fullPage: true });
          await this.saveScreenshot(noElementsScreenshot, `no_elements_debug_${i}_${Date.now()}`);
        }
        
        urlResults.push({
          url: projectUrl,
          elements: elements,
          success: true,
          debugInfo: {
            finalUrl: page.url(),
            pageTitle: await page.title(),
            elementCountOnPage: pageAnalysis.interactiveElements,
            extractedElementCount: elements.length,
            authenticationUsed: result.authenticated,
            redirectedFromLogin: result.redirectedFromLogin
          }
        });
        
        console.log(`\n✅ === ANALYSIS COMPLETE ===`);
        console.log(`   URL: ${projectUrl}`);
        console.log(`   Elements found: ${elements.length}`);
        console.log(`   Status: SUCCESS`);
        console.log(`${'='.repeat(80)}\n`);

        if (progressCallback) {
          progressCallback('completed', `✓ ${projectUrl}: ${elements.length} elements (${i + 1}/${urls.length})`, i + 1, urls.length);
        }
        
      } catch (urlError) {
        console.error(`❌ Failed to analyze PROJECT URL ${projectUrl}:`, urlError);
        
        // Enhanced error logging
        console.error(`🔍 Error details:`);
        console.error(`  URL: ${projectUrl}`);
        console.error(`  Error type: ${urlError.constructor.name}`);
        console.error(`  Error message: ${urlError.message}`);
        
        // Try to get current page info for debugging
        if (authSession?.page) {
          try {
            const currentUrl = authSession.page.url();
            const pageTitle = await authSession.page.title();
            console.error(`  Current URL: ${currentUrl}`);
            console.error(`  Current page title: ${pageTitle}`);
            
            // Take error screenshot
            const errorScreenshot = await authSession.page.screenshot({ type: 'png', fullPage: true });
            await this.saveScreenshot(errorScreenshot, `error_${i}_${Date.now()}`);
          } catch (debugError) {
            console.error(`  Could not get current page info: ${debugError.message}`);
          }
        }
        
        if (progressCallback) {
          progressCallback('error', `Failed to analyze ${projectUrl}: ${urlError.message}`, i + 1, urls.length);
        }
        
        urlResults.push({
          url: projectUrl,
          elements: [],
          success: false,
          errorMessage: urlError.message,
          errorType: urlError.constructor.name,
          debugInfo: {
            timestamp: new Date().toISOString(),
            authFlowUsed: authFlow.name,
            errorDetails: urlError.toString()
          }
        });
      } finally {
        // Clean up the browser session
        if (authSession?.browser) {
          await this.unifiedAuthService.cleanupSession(authSession.browser);
          console.log(`🧹 Browser session cleaned up for PROJECT URL: ${projectUrl}`);
        }
      }
    }
    
    // Final result summary
    const successfulUrls = urlResults.filter(result => result.success).length;
    const totalElements = urlResults.reduce((sum, result) => sum + (result.elements?.length || 0), 0);
    
    console.log(`🎆 Analysis complete:`);
    console.log(`  Successful URLs: ${successfulUrls}/${urls.length}`);
    console.log(`  Total elements found: ${totalElements}`);
    
    if (progressCallback) {
      progressCallback('finished', `Analysis complete: ${successfulUrls}/${urls.length} URLs successful, ${totalElements} elements found`, urls.length, urls.length);
    }
    
    return {
      success: true,
      urlResults,
      authenticationUsed: true,
      summary: {
        totalUrls: urls.length,
        successfulUrls,
        totalElements,
        authFlowUsed: authFlow.name
      }
    };
  }

  /**
   * Analyze a single page with authentication
   */
  async analyzePageWithAuth(url: string, authFlow: any): Promise<PageAnalysisResult> {
    // Single page analysis with authentication
    const result = await this.analyzeAllUrlsWithAuth([url], authFlow);
    
    if (result.success && result.urlResults.length > 0) {
      const urlResult = result.urlResults[0];
      return {
        url: urlResult.url,
        elements: urlResult.elements,
        analysisDate: new Date(),
        success: urlResult.success,
        errorMessage: urlResult.errorMessage
      };
    } else {
      return {
        url,
        elements: [],
        analysisDate: new Date(),
        success: false,
        errorMessage: result.errorMessage || 'Authentication failed'
      };
    }
  }
}