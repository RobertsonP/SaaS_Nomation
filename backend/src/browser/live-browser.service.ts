import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import { AdvancedSelectorGeneratorService } from './advanced-selector-generator.service';
import { chromium, Browser, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { LoginFlow, DetectedElement, BrowserSession } from '../ai/interfaces/element.interface';

@Injectable()
export class LiveBrowserService {
  private activeSessions = new Map<string, { browser: Browser; page: Page }>();

  constructor(
    private prisma: PrismaService,
    private unifiedAuthService: UnifiedAuthService,
    private advancedSelectorGenerator: AdvancedSelectorGeneratorService
  ) {
    // Clean up sessions every 30 minutes
    setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000);
  }

  async createSession(projectId: string, authFlow?: LoginFlow): Promise<BrowserSession> {
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // Launch browser with Docker-compatible settings
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

    const page = await browser.newPage();
    
    // Set desktop viewport for proper desktop view
    await page.setViewportSize({
      width: 1920,
      height: 1080
    });
    
    // Store browser and page instances
    this.activeSessions.set(sessionToken, { browser, page });

    // Create session record in database
    const session = await this.prisma.browserSession.create({
      data: {
        sessionToken,
        projectId,
        authFlowId: authFlow?.id,
        isAuthenticated: false,
        currentState: 'initial',
        expiresAt,
      },
    });

    // If authFlow provided, execute authentication
    if (authFlow) {
      await this.authenticateSession(sessionToken, authFlow);
    }

    return session;
  }

  async authenticateSession(sessionToken: string, authFlow: LoginFlow): Promise<void> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { browser } = sessionData;

    try {
      console.log(`🔐 Authenticating session ${sessionToken} with unified auth service`);
      
      // Use unified auth service to authenticate for the login URL
      const authResult = await this.unifiedAuthService.authenticateForUrl(
        authFlow.loginUrl,
        authFlow,
        browser
      );

      if (!authResult.result.success) {
        throw new Error(`Authentication failed: ${authResult.result.errorMessage}`);
      }

      // Update the session's page reference to the authenticated page
      this.activeSessions.set(sessionToken, {
        browser: authResult.browser,
        page: authResult.page
      });

      // Update session as authenticated
      await this.prisma.browserSession.update({
        where: { sessionToken },
        data: {
          isAuthenticated: true,
          currentState: 'after_login',
          currentUrl: authResult.result.finalUrl,
          lastActivity: new Date(),
        },
      });

      console.log(`✅ Session ${sessionToken} authenticated successfully`);
    } catch (error) {
      console.error(`❌ Session ${sessionToken} authentication failed:`, error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async navigateToPage(sessionToken: string, url: string): Promise<void> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;

    try {
      console.log(`🔍 Navigating session ${sessionToken} to URL: ${url}`);
      
      // Get the current session from database to check for auth flow
      const session = await this.prisma.browserSession.findUnique({
        where: { sessionToken },
        include: { authFlow: true }
      });

      if (!session) {
        throw new Error('Session not found in database');
      }

      // Check if this session actually has an auth flow that needs to be executed
      if (session.authFlow && !session.isAuthenticated) {
        console.log(`🔐 Session has auth flow - using unified auth service`);
        
        // Convert database authFlow to LoginFlow interface
        const authFlow = {
          id: session.authFlow.id,
          name: session.authFlow.name,
          loginUrl: session.authFlow.loginUrl,
          steps: Array.isArray(session.authFlow.steps) ? session.authFlow.steps as unknown as LoginFlow['steps'] : [],
          credentials: typeof session.authFlow.credentials === 'object' ? session.authFlow.credentials as unknown as LoginFlow['credentials'] : { username: '', password: '' }
        } as LoginFlow;
        
        const authResult = await this.unifiedAuthService.authenticateForUrl(
          url,
          authFlow,
          sessionData.browser
        );

        if (!authResult.result.success) {
          throw new Error(`Authentication failed: ${authResult.result.errorMessage}`);
        }

        // Update the session's page reference
        this.activeSessions.set(sessionToken, {
          browser: authResult.browser,
          page: authResult.page
        });

        // Update session as authenticated
        await this.prisma.browserSession.update({
          where: { sessionToken },
          data: {
            currentUrl: authResult.result.finalUrl,
            isAuthenticated: authResult.result.authenticated,
            currentState: authResult.result.authenticated ? 'after_login' : 'initial',
            lastActivity: new Date(),
          },
        });

        console.log(`✅ Session ${sessionToken} authenticated and navigated to: ${authResult.result.finalUrl}`);
      } else {
        // Simple test execution navigation - use direct page navigation with progressive loading
        console.log(`🚀 Simple navigation - using direct page navigation with progressive loading`);
        
        await this.navigateToPageWithProgressiveLoading(page, url);
        
        // Update session URL without authentication
        await this.prisma.browserSession.update({
          where: { sessionToken },
          data: {
            currentUrl: url,
            currentState: 'after_navigation',
            lastActivity: new Date(),
          },
        });

        console.log(`✅ Session ${sessionToken} navigated successfully to: ${url}`);
      }
    } catch (error) {
      console.error(`❌ Session ${sessionToken} navigation failed:`, error);
      throw new Error(`Navigation failed: ${error.message}`);
    }
  }

  /**
   * Navigate to page with progressive loading strategies for slow/problematic sites
   */
  private async navigateToPageWithProgressiveLoading(page: any, url: string) {
    console.log(`🌐 Navigating to ${url} with enhanced loading strategy...`);
    
    try {
      // Strategy 1: Try networkidle first (fast sites)
      console.log(`📡 Attempting fast load strategy (networkidle, 15s timeout)...`);
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 15000 
      });
      console.log(`✅ Fast load successful for ${url}`);
      
    } catch (error) {
      console.log(`⚠️ Fast load failed: ${error.message}`);
      console.log(`🔄 Trying progressive load strategy (domcontentloaded + load + manual waits)...`);
      
      try {
        // Strategy 2: Progressive loading for slow sites
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',  // Wait for DOM only
          timeout: 45000  // Longer timeout for slow sites
        });
        console.log(`📄 DOM loaded for ${url}`);
        
        // Wait for basic page load event
        try {
          await page.waitForLoadState('load', { timeout: 15000 });
          console.log(`🔗 Load event completed for ${url}`);
        } catch (loadError) {
          console.log(`⚠️ Load event timeout - proceeding anyway: ${loadError.message}`);
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
        
        console.log(`✅ Progressive load successful for ${url}`);
        
      } catch (progressiveError) {
        console.log(`⚠️ Progressive load also failed: ${progressiveError.message}`);
        console.log(`🚀 Trying minimal load strategy (domcontentloaded only)...`);
        
        // Strategy 3: Minimal loading for problematic sites
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000  // Maximum timeout
        });
        console.log(`⚡ Minimal load completed for ${url}`);
      }
    }
    
    // Progressive waits for dynamic content with multiple stages
    console.log(`⏳ Waiting for dynamic content to load...`);
    
    // Stage 1: Basic content stabilization
    await page.waitForTimeout(2000);
    
    // Stage 2: Allow additional dynamic loading
    await page.waitForTimeout(1000);
  }

  async captureCurrentElements(sessionToken: string): Promise<DetectedElement[]> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    const session = await this.prisma.browserSession.findUnique({
      where: { sessionToken },
    });

    // Extract elements with comprehensive CSS information
    const elements = await page.evaluate(() => {
      const extractedElements: any[] = [];
      
      // Comprehensive element selectors
      const selectors = [
        'button', 'input', 'textarea', 'select', 'a', 'form',
        '[role="button"]', '[role="link"]', '[role="textbox"]',
        '[data-testid]', '[aria-label]', '.btn', '.button',
        'input[type="text"]', 'input[type="email"]', 'input[type="password"]',
        'input[type="submit"]', 'input[type="button"]', 'input[type="checkbox"]',
        'input[type="radio"]', 'input[type="search"]'
      ];

      for (const selectorType of selectors) {
        const elements = document.querySelectorAll(selectorType);
        
        elements.forEach((element: Element, index: number) => {
          if (element instanceof HTMLElement) {
            const rect = element.getBoundingClientRect();
            const styles = window.getComputedStyle(element);
            
            // Skip hidden elements
            if (rect.width === 0 || rect.height === 0 || styles.display === 'none') {
              return;
            }

            // Generate advanced W3Schools CSS + Playwright selectors
            const selectorOptions = {
              element,
              document,
              prioritizeUniqueness: true,
              includePlaywrightSpecific: true,
              testableElementsOnly: true
            };
            
            const generatedSelectors = this.advancedSelectorGenerator.generateSelectors(selectorOptions);
            
            // Use the best selector (highest confidence + uniqueness)
            const bestSelector = generatedSelectors.find(s => s.isUnique) || generatedSelectors[0];
            let selector = bestSelector?.selector || selectorType;
            
            // Store additional selectors as fallbacks
            const fallbackSelectors = generatedSelectors.slice(1, 6).map(s => s.selector);

            // Determine element type
            let elementType = 'text';
            const tagName = element.tagName.toLowerCase();
            const inputType = element.getAttribute('type');
            
            if (tagName === 'button' || inputType === 'button' || inputType === 'submit') {
              elementType = 'button';
            } else if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
              elementType = 'input';
            } else if (tagName === 'a') {
              elementType = 'link';
            } else if (tagName === 'form') {
              elementType = 'form';
            } else if (element.getAttribute('role') === 'navigation' || 
                       element.closest('nav') !== null) {
              elementType = 'navigation';
            }

            // Generate description
            const text = element.textContent?.trim() || '';
            const ariaLabel = element.getAttribute('aria-label') || '';
            const placeholder = element.getAttribute('placeholder') || '';
            const title = element.getAttribute('title') || '';
            
            let description = text || ariaLabel || placeholder || title || `${elementType} element`;
            if (description.length > 100) {
              description = description.substring(0, 97) + '...';
            }

            extractedElements.push({
              selector,
              elementType,
              description,
              confidence: bestSelector?.confidence || 0.9,
              
              // Enhanced selector data
              fallbackSelectors: fallbackSelectors,
              selectorType: bestSelector?.type || 'css',
              isUniqueSelector: bestSelector?.isUnique || false,
              isPlaywrightOptimized: bestSelector?.isPlaywrightOptimized || false,
              attributes: {
                tag: tagName,
                id: element.id || undefined,
                class: element.className || undefined,
                type: inputType || undefined,
                text: text || undefined,
                'aria-label': ariaLabel || undefined,
                'data-testid': element.getAttribute('data-testid') || undefined,
                href: element.getAttribute('href') || undefined,
                name: element.getAttribute('name') || undefined,
                value: (element as HTMLInputElement).value || undefined,
                placeholder: placeholder || undefined,
                title: title || undefined,
                
                // Comprehensive CSS data for visual preview
                cssInfo: {
                  backgroundColor: styles.backgroundColor,
                  color: styles.color,
                  fontSize: styles.fontSize,
                  fontFamily: styles.fontFamily,
                  fontWeight: styles.fontWeight,
                  padding: styles.padding,
                  margin: styles.margin,
                  border: styles.border,
                  borderRadius: styles.borderRadius,
                  width: styles.width,
                  height: styles.height,
                  display: styles.display,
                  position: styles.position,
                  boxShadow: styles.boxShadow,
                  opacity: styles.opacity,
                  transform: styles.transform,
                  cursor: styles.cursor,
                  textAlign: styles.textAlign,
                  backgroundImage: styles.backgroundImage,
                },
                
                // Element position and size
                boundingRect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                },
              },
              
              // Discovery context
              discoveryState: 'static', // Will be updated based on session state
              sourcePageTitle: document.title,
              sourceUrlPath: window.location.pathname,
              requiresAuth: false, // Will be updated based on session
              isModal: element.closest('[role="dialog"]') !== null || 
                      element.closest('.modal') !== null ||
                      element.closest('[aria-modal="true"]') !== null,
            });
          }
        });
      }

      return extractedElements;
    });

    // Update discovery context based on session state
    return elements.map(element => ({
      ...element,
      discoveryState: session?.currentState as any || 'static',
      requiresAuth: session?.isAuthenticated || false,
      discoveryTrigger: session?.currentState === 'after_login' ? 'logged in' : undefined,
    }));
  }

  async executeAction(sessionToken: string, action: { type: string; selector: string; value?: string }): Promise<DetectedElement[]> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;

    // Execute the action
    switch (action.type) {
      case 'click':
        await page.click(action.selector);
        break;
      case 'hover':
        await page.hover(action.selector);
        break;
      case 'type':
        await page.fill(action.selector, action.value || '');
        break;
    }

    // Wait for dynamic content
    await page.waitForTimeout(1000);

    // Update session state
    await this.prisma.browserSession.update({
      where: { sessionToken },
      data: {
        currentState: 'after_interaction',
        lastActivity: new Date(),
      },
    });

    // Capture elements after action
    const elements = await this.captureCurrentElements(sessionToken);
    
    // Mark elements as discovered after interaction
    return elements.map(element => ({
      ...element,
      discoveryState: action.type === 'hover' ? 'hover' : 'after_interaction',
      discoveryTrigger: `${action.type} ${action.selector}`,
    }));
  }

  async getSessionScreenshot(sessionToken: string): Promise<string> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    
    // Capture full page screenshot as base64
    const screenshot = await page.screenshot({ 
      fullPage: false, // Only visible viewport 
      type: 'png' 
    });
    
    // Return as data URL for easy frontend display
    return `data:image/png;base64,${screenshot.toString('base64')}`;
  }

  async getSessionInfo(sessionToken: string): Promise<BrowserSession | null> {
    return this.prisma.browserSession.findUnique({
      where: { sessionToken },
      include: {
        project: true,
        authFlow: true,
      },
    });
  }

  async getSessionView(sessionToken: string): Promise<{ viewUrl: string; currentUrl: string }> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    const currentUrl = page.url();
    
    // Return the current URL that the browser session is viewing
    // This will be used by the frontend iframe to show the same page
    return {
      viewUrl: currentUrl,
      currentUrl: currentUrl
    };
  }

  async closeSession(sessionToken: string): Promise<void> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (sessionData) {
      await sessionData.page.close();
      await sessionData.browser.close();
      this.activeSessions.delete(sessionToken);
    }

    // Remove from database
    await this.prisma.browserSession.delete({
      where: { sessionToken },
    });
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const expiredSessions = await this.prisma.browserSession.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    for (const session of expiredSessions) {
      try {
        await this.closeSession(session.sessionToken);
      } catch (error) {
        console.error(`Failed to cleanup session ${session.sessionToken}:`, error);
      }
    }
  }

  async extendSession(sessionToken: string): Promise<void> {
    const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // Extend by 2 hours
    
    await this.prisma.browserSession.update({
      where: { sessionToken },
      data: {
        expiresAt: newExpiresAt,
        lastActivity: new Date(),
      },
    });
  }

  // Cross-origin element detection using headless browser
  async crossOriginElementDetection(
    url: string, 
    clickX: number, 
    clickY: number, 
    viewport: { width: number; height: number }
  ) {
    console.log(`🔍 Cross-origin element detection at ${url} (${clickX}, ${clickY})`);
    
    let browser: Browser | null = null;
    let page: Page | null = null;
    
    try {
      // Launch dedicated browser for cross-origin analysis
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security', // Allow cross-origin access
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      page = await browser.newPage();
      
      // Set viewport to match the iframe
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });
      
      // Navigate to the target URL
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Wait for page to be fully loaded
      await page.waitForTimeout(2000);
      
      // Find elements near the clicked coordinates
      const elements = await page.evaluate(({ clickX, clickY }) => {
        const DETECTION_RADIUS = 100; // pixels around click
        const foundElements: any[] = [];
        
        // Get all interactive elements
        const interactiveSelectors = [
          'button', 'input', 'select', 'textarea', 'a[href]',
          '[onclick]', '[role="button"]', '[role="link"]',
          '[data-testid]', '[data-test]', '[id]', '.btn',
          '.button', '.link', '.clickable', '[tabindex]'
        ];
        
        const allElements = document.querySelectorAll(interactiveSelectors.join(','));
        
        Array.from(allElements).forEach((element, index) => {
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Calculate distance from click point
          const distance = Math.sqrt(
            Math.pow(centerX - clickX, 2) + Math.pow(centerY - clickY, 2)
          );
          
          // Include elements within detection radius
          if (distance <= DETECTION_RADIUS) {
            // Generate advanced W3Schools CSS + Playwright selectors
            const selectorOptions = {
              element,
              document,
              prioritizeUniqueness: true,
              includePlaywrightSpecific: true,
              testableElementsOnly: true
            };
            
            const generatedSelectors = this.advancedSelectorGenerator.generateSelectors(selectorOptions);
            
            // Skip non-testable elements
            if (generatedSelectors.length === 0) {
              return;
            }
            
            // Use the best selector (highest confidence + uniqueness)
            const bestSelector = generatedSelectors.find(s => s.isUnique) || generatedSelectors[0];
            const selector = bestSelector?.selector || element.tagName.toLowerCase();
            
            foundElements.push({
              tagName: element.tagName.toLowerCase(),
              selector: selector,
              textContent: element.textContent?.trim().substring(0, 100) || '',
              attributes: Array.from(element.attributes).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {} as Record<string, string>),
              boundingRect: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              },
              distance: Math.round(distance),
              href: (element as HTMLAnchorElement).href || null,
              value: (element as HTMLInputElement).value || null,
              placeholder: (element as HTMLInputElement).placeholder || null,
              type: (element as HTMLInputElement).type || null,
              role: element.getAttribute('role') || null,
              ariaLabel: element.getAttribute('aria-label') || null
            });
          }
        });
        
        // Sort by distance (closest first) and return top 10
        return foundElements
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);
          
      }, { clickX, clickY });
      
      console.log(`✅ Found ${elements.length} elements near click coordinates`);
      
      return {
        success: true,
        elements: elements.map(el => ({
          ...el,
          // Add element picker specific data
          selectors: [el.selector],
          innerText: el.textContent,
          confidence: Math.max(0.7, 1 - (el.distance / 100)) // Higher confidence for closer elements
        })),
        analysisUrl: url,
        clickCoordinates: { x: clickX, y: clickY },
        detectionRadius: 100,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Cross-origin element detection failed:', error);
      return {
        success: false,
        error: error.message,
        elements: [],
        analysisUrl: url,
        clickCoordinates: { x: clickX, y: clickY }
      };
      
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }
}