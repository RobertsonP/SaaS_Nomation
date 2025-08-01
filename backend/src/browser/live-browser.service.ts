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

    const { browser } = sessionData;

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

      // Use unified auth service to navigate with authentication check
      // Convert database authFlow to LoginFlow interface
      const authFlow = session.authFlow ? {
        id: session.authFlow.id,
        name: session.authFlow.name,
        loginUrl: session.authFlow.loginUrl,
        steps: Array.isArray(session.authFlow.steps) ? session.authFlow.steps as unknown as LoginFlow['steps'] : [],
        credentials: typeof session.authFlow.credentials === 'object' ? session.authFlow.credentials as unknown as LoginFlow['credentials'] : { username: '', password: '' }
      } as LoginFlow : undefined;
      
      const authResult = await this.unifiedAuthService.authenticateForUrl(
        url,
        authFlow,
        browser
      );

      if (!authResult.result.success) {
        throw new Error(`Navigation failed: ${authResult.result.errorMessage}`);
      }

      // Update the session's page reference
      this.activeSessions.set(sessionToken, {
        browser: authResult.browser,
        page: authResult.page
      });

      // Update session URL and authentication status
      await this.prisma.browserSession.update({
        where: { sessionToken },
        data: {
          currentUrl: authResult.result.finalUrl,
          isAuthenticated: authResult.result.authenticated,
          currentState: authResult.result.authenticated ? 'after_login' : 'initial',
          lastActivity: new Date(),
        },
      });

      console.log(`✅ Session ${sessionToken} navigated successfully to: ${authResult.result.finalUrl}`);
    } catch (error) {
      console.error(`❌ Session ${sessionToken} navigation failed:`, error);
      throw new Error(`Navigation failed: ${error.message}`);
    }
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

  async getSessionInfo(sessionToken: string): Promise<BrowserSession | null> {
    return this.prisma.browserSession.findUnique({
      where: { sessionToken },
      include: {
        project: true,
        authFlow: true,
      },
    });
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
}