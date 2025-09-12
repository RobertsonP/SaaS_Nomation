import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnifiedAuthService } from '../auth/unified-auth.service';
import { chromium, Browser, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { LoginFlow, DetectedElement, BrowserSession } from '../ai/interfaces/element.interface';

@Injectable()
export class LiveBrowserService {
  private activeSessions = new Map<string, { browser: Browser; page: Page }>();

  constructor(
    private prisma: PrismaService,
    private unifiedAuthService: UnifiedAuthService
  ) {
    // Clean up sessions every 30 minutes
    setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000);
  }

  /**
   * Translate localhost URLs for Docker container networking
   */
  private translateUrlForDocker(url: string): string {
    // From inside Docker container, localhost refers to container's localhost
    // We need to translate to host URLs for local development
    if (url.includes('localhost:3001')) {
      return url.replace('localhost:3001', 'host.docker.internal:3001');
    }
    if (url.includes('127.0.0.1:3001')) {
      return url.replace('127.0.0.1:3001', 'host.docker.internal:3001');
    }
    return url;
  }

  async createSession(projectId: string, authFlow?: LoginFlow): Promise<BrowserSession> {
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    console.log(`🚀 Creating new browser session ${sessionToken} for project ${projectId}`);

    try {
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
      
      // Store browser and page instances FIRST (memory session)
      this.activeSessions.set(sessionToken, { browser, page });
      console.log(`✅ Memory session created: ${sessionToken}`);

      // Create session record in database with proper error handling
      let session: BrowserSession;
      try {
        session = await this.prisma.browserSession.create({
          data: {
            sessionToken,
            projectId: projectId || 'default', // Ensure projectId is never null
            authFlowId: authFlow?.id || null,
            isAuthenticated: false,
            currentState: 'initial',
            expiresAt,
          },
        });
        console.log(`✅ Database session created: ${sessionToken}`);
      } catch (dbError) {
        console.warn(`⚠️ Database session creation failed, continuing with memory session: ${dbError.message}`);
        // Create minimal session object for compatibility
        session = {
          id: sessionToken,
          sessionToken,
          projectId: projectId || 'default',
          authFlowId: authFlow?.id || null,
          isAuthenticated: false,
          currentState: 'initial',
          currentUrl: null,
          expiresAt,
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivity: new Date(),
        } as BrowserSession;
      }

      // If authFlow provided, execute authentication
      if (authFlow) {
        try {
          await this.authenticateSession(sessionToken, authFlow);
        } catch (authError) {
          console.warn(`⚠️ Authentication failed, continuing with unauthenticated session: ${authError.message}`);
        }
      }

      return session;
      
    } catch (error) {
      // Clean up memory session if browser launch failed
      if (this.activeSessions.has(sessionToken)) {
        const sessionData = this.activeSessions.get(sessionToken);
        try {
          await sessionData?.page?.close();
          await sessionData?.browser?.close();
        } catch (cleanupError) {
          console.warn(`Failed to cleanup failed session: ${cleanupError.message}`);
        }
        this.activeSessions.delete(sessionToken);
      }
      
      console.error(`❌ Session creation failed: ${error.message}`);
      throw new Error(`Failed to create browser session: ${error.message}`);
    }
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
      // Translate localhost URLs for Docker networking
      const dockerUrl = this.translateUrlForDocker(url);
      console.log(`🔍 Navigating session ${sessionToken} to URL: ${url} (Docker: ${dockerUrl})`);
      
      // Try to get the current session from database to check for auth flow
      // This is optional - if DB fails, we continue with simple navigation
      let session = null;
      let hasAuthFlow = false;
      
      try {
        session = await this.prisma.browserSession.findUnique({
          where: { sessionToken },
          include: { authFlow: true }
        });
        
        if (session) {
          console.log(`✅ Database session found: ${sessionToken}`);
          hasAuthFlow = session.authFlow && !session.isAuthenticated;
        } else {
          console.log(`⚠️ Session not found in database, continuing with memory session only`);
        }
      } catch (dbError) {
        console.warn(`⚠️ Database query failed, continuing with simple navigation: ${dbError.message}`);
        hasAuthFlow = false;
      }

      // Check if this session actually has an auth flow that needs to be executed
      if (hasAuthFlow && session?.authFlow) {
        console.log(`🔐 Session has auth flow - using unified auth service`);
        
        try {
          // Convert database authFlow to LoginFlow interface
          const authFlow = {
            id: session.authFlow.id,
            name: session.authFlow.name,
            loginUrl: session.authFlow.loginUrl,
            steps: Array.isArray(session.authFlow.steps) ? session.authFlow.steps as unknown as LoginFlow['steps'] : [],
            credentials: typeof session.authFlow.credentials === 'object' ? session.authFlow.credentials as unknown as LoginFlow['credentials'] : { username: '', password: '' }
          } as LoginFlow;
          
          const authResult = await this.unifiedAuthService.authenticateForUrl(
            dockerUrl,
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

          // Try to update session as authenticated (optional)
          try {
            await this.prisma.browserSession.update({
              where: { sessionToken },
              data: {
                currentUrl: authResult.result.finalUrl,
                isAuthenticated: authResult.result.authenticated,
                currentState: authResult.result.authenticated ? 'after_login' : 'initial',
                lastActivity: new Date(),
              },
            });
          } catch (updateError) {
            console.warn(`⚠️ Failed to update session in database: ${updateError.message}`);
          }

          console.log(`✅ Session ${sessionToken} authenticated and navigated to: ${authResult.result.finalUrl}`);
        } catch (authError) {
          console.warn(`⚠️ Authentication failed, falling back to simple navigation: ${authError.message}`);
          // Continue with simple navigation below
          hasAuthFlow = false;
        }
      }
      
      if (!hasAuthFlow) {
        // Simple navigation - use direct page navigation with progressive loading
        console.log(`🚀 Simple navigation - using direct page navigation with progressive loading`);
        
        await this.navigateToPageWithProgressiveLoading(page, dockerUrl);
        
        // Try to update session URL (optional - element picker works without DB updates)
        try {
          if (session) {
            await this.prisma.browserSession.update({
              where: { sessionToken },
              data: {
                currentUrl: url,
                currentState: 'after_navigation',
                lastActivity: new Date(),
              },
            });
          }
        } catch (updateError) {
          console.warn(`⚠️ Failed to update session URL in database: ${updateError.message}`);
        }

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

            // Generate unique selector
            let selector = selectorType;
            if (element.id) {
              selector = `#${element.id}`;
            } else if (element.getAttribute('data-testid')) {
              selector = `[data-testid="${element.getAttribute('data-testid')}"]`;
            } else if (element.className) {
              const classes = element.className.split(' ').filter(c => c.trim());
              if (classes.length > 0) {
                selector = `${element.tagName.toLowerCase()}.${classes[0]}`;
              }
            }

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
              confidence: 0.9,
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

    // Remove from database (graceful handling if record doesn't exist)
    try {
      await this.prisma.browserSession.delete({
        where: { sessionToken },
      });
      console.log(`✅ Database session deleted: ${sessionToken}`);
    } catch (error) {
      console.warn(`⚠️ Database session deletion failed (likely already deleted): ${sessionToken}`, error.message);
    }
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

  // 🎯 FULLY INTERACTIVE BROWSER CONTROL METHODS
  async scrollPage(sessionToken: string, deltaY: number, deltaX: number = 0): Promise<void> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    
    // Execute scroll in the browser
    await page.evaluate(({ deltaY, deltaX }) => {
      window.scrollBy(deltaX, deltaY);
    }, { deltaY, deltaX });

    console.log(`✅ Scrolled page: deltaY=${deltaY}, deltaX=${deltaX}`);
  }

  async clickAtPosition(sessionToken: string, x: number, y: number): Promise<any> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    
    // Get element at position and click it
    const element = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement;
      if (el) {
        // Get element details before clicking
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        
        // Collect comprehensive element data
        const elementData = {
          tagName: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className || null,
          textContent: el.textContent?.trim() || '',
          innerText: el.innerText?.trim() || '',
          attributes: {} as Record<string, string>,
          position: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          },
          cssInfo: {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            fontSize: styles.fontSize,
            fontFamily: styles.fontFamily,
            padding: styles.padding,
            border: styles.border,
            cursor: styles.cursor
          }
        };
        
        // Collect all attributes
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          elementData.attributes[attr.name] = attr.value;
        }
        
        // Perform the click
        (el as HTMLElement).click();
        
        return elementData;
      }
      return null;
    }, { x, y });

    console.log(`✅ Clicked at position (${x}, ${y})`);
    return element;
  }

  async hoverAtPosition(sessionToken: string, x: number, y: number): Promise<any> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    
    // Hover at position and get element details
    await page.mouse.move(x, y);
    
    const element = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (el) {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className || null,
          textContent: el.textContent?.trim().substring(0, 50) || '',
          position: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          },
          cssInfo: {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            cursor: styles.cursor
          }
        };
      }
      return null;
    }, { x, y });

    return element;
  }

  async sendKey(sessionToken: string, key: string): Promise<void> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    await page.keyboard.press(key);
    console.log(`✅ Sent key: ${key}`);
  }

  async refreshPage(sessionToken: string): Promise<void> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    await page.reload();
    console.log(`✅ Page refreshed`);
  }

  async goBack(sessionToken: string): Promise<void> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    await page.goBack();
    console.log(`✅ Navigated back`);
  }

  async goForward(sessionToken: string): Promise<void> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    await page.goForward();
    console.log(`✅ Navigated forward`);
  }

  // Cross-origin element detection using headless browser
  async crossOriginElementDetection(
    url: string, 
    clickX: number, 
    clickY: number, 
    viewport: { width: number; height: number }
  ) {
    const dockerUrl = this.translateUrlForDocker(url);
    console.log(`🔍 Cross-origin element detection at ${url} (Docker: ${dockerUrl}) (${clickX}, ${clickY})`);
    
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
      await page.goto(dockerUrl, { waitUntil: 'networkidle' });
      
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
            // Generate FULL DOM PATH selector for maximum reliability
            let selector = '';
            
            // PRIORITY 1: Unique ID (highest reliability)
            if (element.id && element.id.trim() !== '') {
              selector = '#' + element.id;
            } 
            // PRIORITY 2: Test attributes (automation-friendly)
            else if (element.hasAttribute('data-testid')) {
              selector = `[data-testid="${element.getAttribute('data-testid')}"]`;
            } else if (element.hasAttribute('data-test')) {
              selector = `[data-test="${element.getAttribute('data-test')}"]`;
            }
            // PRIORITY 3: Generate full DOM path (most reliable fallback)
            else {
              selector = this.generateFullDomPath(element);
            }
            
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

  /**
   * Generate full DOM path selector like #root > div > nav > div > ...
   * This provides maximum reliability for element selection
   */
  private generateFullDomPath(element: Element): string {
    const path: string[] = [];
    let currentElement = element as Element;

    while (currentElement && currentElement !== document.body) {
      let selector = currentElement.tagName.toLowerCase();
      
      // Add ID if available (makes path shorter and more reliable)
      if (currentElement.id && currentElement.id.trim() !== '') {
        selector = `#${currentElement.id}`;
        path.unshift(selector);
        break; // ID is unique, we can stop here
      }
      
      // Add classes for specificity (filter out utility classes)
      if (currentElement.className && typeof currentElement.className === 'string') {
        const classes = currentElement.className.trim().split(/\s+/)
          .filter(c => c && 
            c.length < 30 && 
            // Filter out utility classes that change frequently
            !c.match(/^(w-|h-|p-|m-|text-|bg-|border-|flex|grid|hidden|block|inline|opacity-|transform|transition)/)
          )
          .slice(0, 2); // Limit to 2 classes to avoid overly long selectors
        
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }
      
      // Add to path
      path.unshift(selector);
      
      // Move up to parent
      currentElement = currentElement.parentElement;
      
      // Prevent infinite loops and overly long paths
      if (path.length > 10) break;
    }

    return path.join(' > ');
  }
}