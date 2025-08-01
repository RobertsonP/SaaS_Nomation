import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { chromium } from 'playwright';
import { ElementAnalyzerService } from './element-analyzer.service';
import { PageAnalysisResult } from './interfaces/element.interface';
import { AnalysisProgressGateway } from '../analysis/analysis-progress.gateway';
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
    private progressGateway: AnalysisProgressGateway
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
   * Check if current page is the intended page (not redirected to login)
   */
  private isOnIntendedPage(currentUrl: string, intendedUrl: string): boolean {
    try {
      // Remove query parameters and fragments for comparison
      const cleanCurrentUrl = new URL(currentUrl).origin + new URL(currentUrl).pathname;
      const cleanIntendedUrl = new URL(intendedUrl).origin + new URL(intendedUrl).pathname;
      
      // Direct match
      if (cleanCurrentUrl === cleanIntendedUrl) {
        return true;
      }
      
      // Check if we were redirected to a login/auth page (common patterns)
      const loginIndicators = ['/login', '/signin', '/auth', '/authentication', '/sso', '/oauth'];
      const currentPath = new URL(currentUrl).pathname.toLowerCase();
      
      for (const indicator of loginIndicators) {
        if (currentPath.includes(indicator)) {
          console.log(`🔄 Detected login redirect: ${currentPath} contains ${indicator}`);
          return false;
        }
      }
      
      // If we end up on a completely different domain, assume redirect
      if (new URL(currentUrl).origin !== new URL(intendedUrl).origin) {
        console.log(`🔄 Detected domain redirect: ${new URL(currentUrl).origin} !== ${new URL(intendedUrl).origin}`);
        return false;
      }
      
      // If URL is significantly different, assume redirect (but allow minor variations)
      if (Math.abs(cleanCurrentUrl.length - cleanIntendedUrl.length) > 20) {
        console.log(`🔄 Detected significant URL change: ${cleanCurrentUrl} vs ${cleanIntendedUrl}`);
        return false;
      }
      
      // Default to assuming we're on the intended page
      return true;
    } catch (error) {
      console.error('Error checking intended page:', error);
      // If we can't parse URLs, assume we're not on intended page to be safe
      return false;
    }
  }

  /**
   * Analyze multiple URLs with authentication
   * 
   * Performs authentication once and then analyzes all provided URLs
   * using the authenticated session.
   */
  async analyzeAllUrlsWithAuth(
    urls: string[], 
    authFlow: any, 
    progressCallback?: (step: string, message: string, current?: number, total?: number) => void
  ): Promise<any> {
    const browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    try {
      console.log(`🔐 Starting URL-by-URL analysis with auth flow: ${authFlow.name}`);
      console.log(`📈 Analysis details:`);
      console.log(`  URLs to analyze: ${urls.length}`);
      console.log(`  Auth flow: ${authFlow.name}`);
      console.log(`  Login URL: ${authFlow.loginUrl}`);
      console.log(`  Auth steps: ${authFlow.steps.length}`);
      
      if (progressCallback) {
        progressCallback('starting', `Starting analysis of ${urls.length} URLs with authentication`, 0, urls.length);
      }
      
      // Analyze each PROJECT URL with fresh session
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
        
        // STEP 1: Clear session for each PROJECT URL (create fresh page)
        let page = await browser.newPage();
        
        try {
          console.log(`📄 Processing PROJECT URL: ${projectUrl}`);
          
          // STEP 2: Try to open INTENDED PROJECT URL directly
          console.log(`🎯 Attempting to access intended page: ${projectUrl}`);
          if (progressCallback) {
            console.log(`📊 CALLING PROGRESS CALLBACK: loading - Loading ${projectUrl}...`);
            progressCallback('loading', `Loading ${projectUrl}...`, i + 1, urls.length);
          }
          await page.goto(projectUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);
          
          // DEBUG: Take screenshot and log page state BEFORE auth check
          const beforeAuthScreenshot = await page.screenshot({ type: 'png', fullPage: true });
          await this.saveScreenshot(beforeAuthScreenshot, `step1_before_auth_check_${i}_${Date.now()}`);
          console.log(`📸 SCREENSHOT BEFORE AUTH CHECK - Base64 length: ${beforeAuthScreenshot.toString('base64').length}`);
          console.log(`📄 PAGE STATE BEFORE AUTH:`);
          console.log(`  URL: ${page.url()}`);
          console.log(`  Title: ${await page.title()}`);
          
          // Count elements on current page
          const elementCountBefore = await page.evaluate(() => {
            const elements = document.querySelectorAll('button, input, a, form, [role="button"]');
            return elements.length;
          });
          console.log(`  Element count: ${elementCountBefore}`);
          
          const currentUrl = page.url();
          
          // STEP 3: Check if we're on the INTENDED page or redirected
          console.log(`🔍 CHECKING IF ON INTENDED PAGE:`);
          console.log(`  Current URL: ${currentUrl}`);
          console.log(`  Intended URL: ${projectUrl}`);
          
          const isOnIntendedPage = this.isOnIntendedPage(currentUrl, projectUrl);
          console.log(`  Is on intended page: ${isOnIntendedPage}`);
          
          if (!isOnIntendedPage) {
            console.log(`🔄 Redirected from ${projectUrl} to ${currentUrl}. Authentication needed.`);
            
            // STEP 4: Authenticate and return to intended page
            console.log(`🔐 Performing authentication with flow: ${authFlow.name}`);
            if (progressCallback) {
              console.log(`📊 CALLING PROGRESS CALLBACK: authenticating - Starting authentication for ${projectUrl}...`);
              progressCallback('authenticating', `Starting authentication for ${projectUrl}...`, i + 1, urls.length);
            }
            await page.goto(authFlow.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(2000);
            
            // DEBUG: Take screenshot on login page
            const loginPageScreenshot = await page.screenshot({ type: 'png', fullPage: true });
            await this.saveScreenshot(loginPageScreenshot, `step2_login_page_${i}_${Date.now()}`);
            console.log(`📸 LOGIN PAGE SCREENSHOT - Base64 length: ${loginPageScreenshot.toString('base64').length}`);
            console.log(`📄 LOGIN PAGE STATE:`);
            console.log(`  URL: ${page.url()}`);
            console.log(`  Title: ${await page.title()}`);
            
            const loginElementCount = await page.evaluate(() => {
              const elements = document.querySelectorAll('button, input, a, form, [role="button"]');
              return elements.length;
            });
            console.log(`  Login page element count: ${loginElementCount}`);
            
            // Execute authentication steps
            for (let stepIndex = 0; stepIndex < authFlow.steps.length; stepIndex++) {
              const step = authFlow.steps[stepIndex];
              
              if (progressCallback) {
                console.log(`📊 CALLING PROGRESS CALLBACK: authenticating - Auth step ${stepIndex + 1}/${authFlow.steps.length}: ${step.description}`);
                progressCallback('authenticating', `Auth step ${stepIndex + 1}/${authFlow.steps.length}: ${step.description}`, i + 1, urls.length);
              }
              
              try {
                if (step.type === 'type') {
                  let value = step.value;
                  if (value === '{username}') value = authFlow.credentials.username;
                  if (value === '{password}') value = authFlow.credentials.password;
                  
                  console.log(`🔤 TYPING into ${step.selector} (value length: ${value.length})`);
                  
                  // Enhanced: Check if element exists before typing
                  const element = page.locator(step.selector);
                  const elementCount = await element.count();
                  console.log(`🔍 Found ${elementCount} elements matching selector: ${step.selector}`);
                  
                  if (elementCount === 0) {
                    console.error(`❌ CRITICAL: No elements found for selector ${step.selector}!`);
                    throw new Error(`Authentication step failed: No elements found for selector ${step.selector}`);
                  }
                  
                  // Use first element if multiple found
                  const targetElement = element.first();
                  await targetElement.fill(value);
                  
                  // Verify the input was filled
                  const inputValue = await targetElement.inputValue();
                  console.log(`✅ Typed into ${step.selector}, verified value length: ${inputValue.length}`);
                  
                  if (inputValue.length !== value.length) {
                    console.warn(`⚠️ Input value mismatch! Expected length: ${value.length}, Actual: ${inputValue.length}`);
                  }
                  
                } else if (step.type === 'click') {
                  console.log(`🖱️ CLICKING ${step.selector}`);
                  
                  // Enhanced: Check if element exists before clicking
                  const element = page.locator(step.selector);
                  const elementCount = await element.count();
                  console.log(`🔍 Found ${elementCount} elements matching selector: ${step.selector}`);
                  
                  if (elementCount === 0) {
                    console.error(`❌ CRITICAL: No elements found for selector ${step.selector}!`);
                    throw new Error(`Authentication step failed: No elements found for selector ${step.selector}`);
                  }
                  
                  // Take screenshot before click
                  const beforeClickScreenshot = await page.screenshot({ type: 'png', fullPage: true });
                  await this.saveScreenshot(beforeClickScreenshot, `step3_before_click_${stepIndex}_${i}_${Date.now()}`);
                  console.log(`📸 BEFORE CLICK ${step.selector} - Screenshot length: ${beforeClickScreenshot.toString('base64').length}`);
                  
                  const targetElement = element.first();
                  await targetElement.click();
                  console.log(`✅ Clicked ${step.selector}`);
                  
                  // Enhanced: Wait for navigation if this is likely a submit button
                  if (step.selector.includes('submit') || step.description?.toLowerCase().includes('login') || step.description?.toLowerCase().includes('submit')) {
                    console.log(`🔄 Waiting for potential navigation after login button click...`);
                    try {
                      // Wait for navigation or timeout after 5 seconds
                      await page.waitForURL('**', { timeout: 5000 });
                      console.log(`📍 Navigation detected! New URL: ${page.url()}`);
                    } catch (navigationTimeout) {
                      console.log(`⏰ No navigation detected within 5 seconds - continuing with regular wait`);
                    }
                  }
                  
                  // Wait and take screenshot after click
                  await page.waitForTimeout(2000);
                  const afterClickScreenshot = await page.screenshot({ type: 'png', fullPage: true });
                  await this.saveScreenshot(afterClickScreenshot, `step4_after_click_${stepIndex}_${i}_${Date.now()}`);
                  console.log(`📸 AFTER CLICK ${step.selector} - Screenshot length: ${afterClickScreenshot.toString('base64').length}`);
                  console.log(`📄 AFTER CLICK STATE:`);
                  console.log(`  URL: ${page.url()}`);
                  console.log(`  Title: ${await page.title()}`);
                  
                } else if (step.type === 'wait') {
                  console.log(`⏰ WAITING ${step.value}ms`);
                  await page.waitForTimeout(parseInt(step.value) || 2000);
                  console.log(`✅ Waited ${step.value}ms`);
                }
                
                await page.waitForTimeout(1000);
              } catch (stepError) {
                console.error(`❌ Auth step failed: ${step.description}`, stepError);
                if (progressCallback) {
                  progressCallback('error', `Auth step failed: ${step.description}`, i + 1, urls.length);
                }
              }
            }
            
            // Enhanced: Check authentication success before returning to project URL
            console.log(`🔍 === AUTHENTICATION STEPS COMPLETED - VERIFYING SUCCESS ===`);
            const postAuthUrl = page.url();
            const postAuthTitle = await page.title();
            
            console.log(`📄 POST-AUTH STATE:`);
            console.log(`  Current URL: ${postAuthUrl}`);
            console.log(`  Page Title: ${postAuthTitle}`);
            console.log(`  Login URL: ${authFlow.loginUrl}`);
            
            // Check if we're still on login page
            const stillOnLoginPage = this.isOnIntendedPage(postAuthUrl, authFlow.loginUrl);
            if (stillOnLoginPage) {
              console.error(`❌ STILL ON LOGIN PAGE AFTER AUTH STEPS!`);
              console.error(`  This suggests authentication failed or login form submission didn't work`);
              
              // Take debug screenshot
              const authFailureScreenshot = await page.screenshot({ type: 'png', fullPage: true });
              await this.saveScreenshot(authFailureScreenshot, `auth_failure_still_on_login_${i}_${Date.now()}`);
              
              // Check for error messages on page
              const errorElements = await page.locator('.error, .alert, .warning, [class*="error"], [class*="alert"]').count();
              console.log(`  Found ${errorElements} potential error message elements`);
              
              if (errorElements > 0) {
                const errorTexts = await page.locator('.error, .alert, .warning, [class*="error"], [class*="alert"]').allTextContents();
                console.log(`  Error messages: ${errorTexts.join(', ')}`);
              }
            } else {
              console.log(`✅ Successfully navigated away from login page after auth steps`);
            }
            
            // STEP 5: Return to INTENDED PROJECT URL after authentication
            console.log(`🎯 Returning to intended page after auth: ${projectUrl}`);
            if (progressCallback) {
              progressCallback('loading', `Returning to ${projectUrl} after authentication...`, i + 1, urls.length);
            }
            await page.goto(projectUrl, { waitUntil: 'networkidle', timeout: 30000 });
            
            // DEBUG: Take screenshot immediately after returning to project URL
            const afterAuthNavigateScreenshot = await page.screenshot({ type: 'png', fullPage: true });
            await this.saveScreenshot(afterAuthNavigateScreenshot, `step5_after_auth_navigate_${i}_${Date.now()}`);
            console.log(`📸 AFTER AUTH NAVIGATE SCREENSHOT - Base64 length: ${afterAuthNavigateScreenshot.toString('base64').length}`);
            console.log(`📄 IMMEDIATELY AFTER AUTH NAVIGATE:`);
            console.log(`  URL: ${page.url()}`);
            console.log(`  Title: ${await page.title()}`);
            
            // Increased wait time for authenticated pages to fully load
            console.log('⏳ Waiting for authenticated page to fully load...');
            if (progressCallback) {
              progressCallback('loading', `Waiting for authenticated page to load...`, i + 1, urls.length);
            }
            await page.waitForTimeout(5000); // Increased from 2000 to 5000ms
            
            // DEBUG: Take screenshot after first wait
            const afterFirstWaitScreenshot = await page.screenshot({ type: 'png', fullPage: true });
            console.log(`📸 AFTER FIRST WAIT SCREENSHOT - Base64 length: ${afterFirstWaitScreenshot.toString('base64').length}`);
            console.log(`📄 AFTER FIRST WAIT (5s):`);
            console.log(`  URL: ${page.url()}`);
            console.log(`  Title: ${await page.title()}`);
            
            // Wait for page content to stabilize after authentication
            console.log('⏳ Allowing page content to stabilize after authentication...');
            if (progressCallback) {
              progressCallback('loading', `Page stabilizing after authentication...`, i + 1, urls.length);
            }
            await page.waitForTimeout(3000); // Additional 3 seconds
            
            // DEBUG: Take screenshot after second wait
            const afterSecondWaitScreenshot = await page.screenshot({ type: 'png', fullPage: true });
            console.log(`📸 AFTER SECOND WAIT SCREENSHOT - Base64 length: ${afterSecondWaitScreenshot.toString('base64').length}`);
            console.log(`📄 AFTER SECOND WAIT (3s):`);
            console.log(`  URL: ${page.url()}`);
            console.log(`  Title: ${await page.title()}`);
            
            // Verify we're now on the intended page with enhanced verification
            const finalUrl = page.url();
            console.log(`🔍 Final URL after auth: ${finalUrl}`);
            console.log(`🎯 Expected URL: ${projectUrl}`);
            
            // Enhanced success verification
            const authSuccess = this.isOnIntendedPage(finalUrl, projectUrl);
            if (!authSuccess) {
              console.error(`❌ Authentication verification failed:`);
              console.error(`  Expected: ${projectUrl}`);
              console.error(`  Got: ${finalUrl}`);
              throw new Error(`Authentication failed: still not on intended page ${projectUrl}, got ${finalUrl}`);
            }
            
            // Additional verification - check page title and content
            const pageTitle = await page.title();
            console.log(`📜 Page title after auth: ${pageTitle}`);
            
            // Wait for any authentication-specific elements to appear
            console.log('⏳ Waiting for authenticated page elements to stabilize...');
            await page.waitForTimeout(2000); // Additional stabilization time
            
            console.log(`✅ Successfully authenticated and accessed: ${projectUrl}`);
            
            if (progressCallback) {
              progressCallback('authenticated', `Successfully authenticated to ${projectUrl}`, i + 1, urls.length);
            }
          } else {
            console.log(`✅ Already on intended page: ${projectUrl}`);
            if (progressCallback) {
              progressCallback('ready', `Already authenticated to ${projectUrl}`, i + 1, urls.length);
            }
            
            // DEBUG: Take screenshot for non-auth case too
            const noAuthNeededScreenshot = await page.screenshot({ type: 'png', fullPage: true });
            console.log(`📸 NO AUTH NEEDED SCREENSHOT - Base64 length: ${noAuthNeededScreenshot.toString('base64').length}`);
            console.log(`📄 NO AUTH NEEDED STATE:`);
            console.log(`  URL: ${page.url()}`);
            console.log(`  Title: ${await page.title()}`);
          }
          
          // STEP 6: Extract elements from authenticated page (reuse existing session)
          console.log(`🔍 Extracting elements from intended page: ${projectUrl}`);
          if (progressCallback) {
            progressCallback('extracting', `Extracting elements from ${projectUrl}...`, i + 1, urls.length);
          }
          
          // DEBUG: Take final screenshot before element extraction
          const beforeExtractionScreenshot = await page.screenshot({ type: 'png', fullPage: true });
          await this.saveScreenshot(beforeExtractionScreenshot, `step6_before_extraction_${i}_${Date.now()}`);
          console.log(`📸 BEFORE EXTRACTION SCREENSHOT - Base64 length: ${beforeExtractionScreenshot.toString('base64').length}`);
          
          // DEBUG: Comprehensive page state analysis before extraction
          console.log(`🔍 === PAGE STATE ANALYSIS BEFORE EXTRACTION ===`);
          console.log(`📄 Current URL: ${page.url()}`);
          console.log(`📜 Page Title: ${await page.title()}`);
          
          const pageAnalysis = await page.evaluate(() => {
            // Count different types of elements
            const allElements = document.querySelectorAll('*');
            const buttons = document.querySelectorAll('button');
            const inputs = document.querySelectorAll('input');
            const links = document.querySelectorAll('a');
            const forms = document.querySelectorAll('form');
            const interactiveElements = document.querySelectorAll('button, input, a, form, [role="button"], select, textarea');
            
            // Check for common authentication indicators
            // Note: :contains() is jQuery syntax, not CSS - use JavaScript-based text matching
            const hrefLogoutElements = document.querySelectorAll('[href*="logout"]');
            const onclickLogoutElements = document.querySelectorAll('[onclick*="logout"]');
            
            // Find buttons and links containing "logout" text using JavaScript
            const buttonLogoutElements = Array.from(document.querySelectorAll('button')).filter(el => 
              el.textContent && el.textContent.toLowerCase().includes('logout')
            );
            const linkLogoutElements = Array.from(document.querySelectorAll('a')).filter(el => 
              el.textContent && el.textContent.toLowerCase().includes('logout')
            );
            
            const logoutElementsCount = hrefLogoutElements.length + onclickLogoutElements.length + 
                                       buttonLogoutElements.length + linkLogoutElements.length;
            
            const userElements = document.querySelectorAll('[class*="user"], [id*="user"], [class*="profile"], [id*="profile"]');
            
            // Check page readiness
            const bodyHTML = document.body ? document.body.innerHTML.length : 0;
            const hasScripts = document.querySelectorAll('script').length;
            
            // Log to browser console for debugging
            console.log('=== BROWSER CONSOLE DEBUG ===');
            console.log('Total elements:', allElements.length);
            console.log('Interactive elements:', interactiveElements.length);
            console.log('Body HTML length:', bodyHTML);
            console.log('Page ready state:', document.readyState);
            
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
          
          console.log(`🔍 CALLING extractElementsFromAuthenticatedPage...`);
          const elements = await this.elementAnalyzer.extractElementsFromAuthenticatedPage(page);
          console.log(`📊 EXTRACTED ELEMENTS COUNT: ${elements.length}`);
          
          // If extraction failed but page has elements, investigate further
          if (elements.length === 0 && pageAnalysis.interactiveElements > 0) {
            console.error(`❌ EXTRACTION MISMATCH: Page has ${pageAnalysis.interactiveElements} interactive elements but extraction returned 0!`);
            console.error(`❌ This suggests an issue with the extraction method, not the page content.`);
          }
          
          // DEBUG: Log first few elements for verification
          if (elements.length > 0) {
            console.log(`📋 FIRST 3 EXTRACTED ELEMENTS:`);
            elements.slice(0, 3).forEach((el, idx) => {
              console.log(`  ${idx + 1}. ${el.elementType}: ${el.description} (${el.selector})`);
            });
          } else {
            console.error(`❌ NO ELEMENTS EXTRACTED! This is the problem!`);
          }
          
          urlResults.push({
            url: projectUrl,
            elements: elements,
            success: true,
            debugInfo: {
              finalUrl: page.url(),
              pageTitle: await page.title(),
              elementCountOnPage: pageAnalysis.interactiveElements,
              extractedElementCount: elements.length
            }
          });
          console.log(`✅ Successfully extracted ${elements.length} elements from ${projectUrl}`);
          
          if (progressCallback) {
            progressCallback('completed', `Found ${elements.length} elements from ${projectUrl}`, i + 1, urls.length);
          }
          
        } catch (urlError) {
          console.error(`❌ Failed to analyze PROJECT URL ${projectUrl}:`, urlError);
          
          // Enhanced error logging
          console.error(`🔍 Error details:`);
          console.error(`  URL: ${projectUrl}`);
          console.error(`  Error type: ${urlError.constructor.name}`);
          console.error(`  Error message: ${urlError.message}`);
          
          // Try to get current page info for debugging
          try {
            const currentUrl = page.url();
            const pageTitle = await page.title();
            console.error(`  Current URL: ${currentUrl}`);
            console.error(`  Current page title: ${pageTitle}`);
          } catch (debugError) {
            console.error(`  Could not get current page info: ${debugError.message}`);
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
          // STEP 7: Clear session after each PROJECT URL (close page)
          await page.close();
          console.log(`🧹 Session cleared for PROJECT URL: ${projectUrl}`);
        }
      }
      
      await browser.close();
      
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
      
    } catch (error) {
      await browser.close();
      console.error('❌ Authentication flow failed:', error);
      
      // Use categorized error handling for authentication failures
      const errorDetails = this.elementAnalyzer.categorizeAnalysisError(error, authFlow.loginUrl);
      
      return {
        success: false,
        errorMessage: errorDetails.message,
        errorCategory: errorDetails.category as any,
        errorDetails: errorDetails.details,
        authenticationUsed: false,
        urlResults: []
      };
    }
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