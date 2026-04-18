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

  async createSession(projectId: string, authFlow?: LoginFlow, startUrl?: string): Promise<BrowserSession> {
    // Close existing sessions for this project to prevent accumulation
    await this.closeAllProjectSessions(projectId);

    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Launch browser with Docker-compatible settings
    const browser = await chromium.launch({
      headless: false,
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

    // Set viewport for live sessions — 1280x720 matches common laptop screens
    await page.setViewportSize({
      width: 1280,
      height: 720
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

    // Navigate to start URL if provided
    if (startUrl) {
      await this.navigateToPage(sessionToken, startUrl);
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

            // Inline selector generation (browser context — no Node.js service access)
            const escapeCSSSelector = (str: string): string => {
              return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
            };

            const testUniqueness = (sel: string): boolean => {
              try {
                const matches = document.querySelectorAll(sel);
                return matches.length === 1 && matches[0] === element;
              } catch (e) {
                return false;
              }
            };

            const el = element;
            const tagName = el.tagName.toLowerCase();
            const elId = el.id || '';
            const elTestId = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy') || '';
            const elName = el.getAttribute('name') || '';
            const elAriaLabel = el.getAttribute('aria-label') || '';
            const elRole = el.getAttribute('role') || '';
            const elType = el.getAttribute('type') || '';
            const elPlaceholder = el.getAttribute('placeholder') || '';
            const elTitle = el.getAttribute('title') || '';
            const elText = (el.textContent || '').trim().substring(0, 50);

            // CSS selector generation — priority chain matching element-detection.service.ts
            let selector = '';
            let selectorConfidence = 0.5;
            let isUnique = false;

            if (elId && elId.trim() !== '') {
              const idSel = `#${escapeCSSSelector(elId)}`;
              if (testUniqueness(idSel)) {
                selector = idSel;
                selectorConfidence = 0.85;
                isUnique = true;
              }
            }
            if (!selector && elTestId && elTestId.trim() !== '') {
              const testIdSel = `[data-testid="${escapeCSSSelector(elTestId)}"]`;
              if (testUniqueness(testIdSel)) {
                selector = testIdSel;
                selectorConfidence = 0.9;
                isUnique = true;
              }
            }
            if (!selector && elName && elName.trim() !== '') {
              const nameSel = `${tagName}[name="${escapeCSSSelector(elName)}"]`;
              if (testUniqueness(nameSel)) {
                selector = nameSel;
                selectorConfidence = 0.75;
                isUnique = true;
              }
            }
            if (!selector && elAriaLabel && elAriaLabel.trim() !== '') {
              const ariaSel = `[aria-label="${escapeCSSSelector(elAriaLabel)}"]`;
              if (testUniqueness(ariaSel)) {
                selector = ariaSel;
                selectorConfidence = 0.8;
                isUnique = true;
              }
            }
            if (!selector && elType) {
              const typeSel = `${tagName}[type="${elType}"]`;
              if (testUniqueness(typeSel)) {
                selector = typeSel;
                selectorConfidence = 0.7;
                isUnique = true;
              }
            }
            if (!selector && el.className && typeof el.className === 'string' && el.className.trim() !== '') {
              const classes = el.className.split(' ')
                .filter(c => c.trim() !== '')
                .filter(c => !c.match(/^(active|hover|focus|selected|disabled|loading)$/))
                .filter(c => c.length > 2 && !c.match(/^(ng-|_|css-)/))
                .slice(0, 3);
              if (classes.length > 0) {
                const classSel = `${tagName}.${classes.map(c => escapeCSSSelector(c)).join('.')}`;
                if (testUniqueness(classSel)) {
                  selector = classSel;
                  selectorConfidence = 0.6;
                  isUnique = true;
                }
              }
            }
            if (!selector) {
              // Parent-child fallback
              const parent = el.parentElement;
              if (parent) {
                if (parent.id) {
                  const parentSel = `#${escapeCSSSelector(parent.id)} ${tagName}`;
                  if (testUniqueness(parentSel)) {
                    selector = parentSel;
                    selectorConfidence = 0.6;
                    isUnique = true;
                  }
                }
                if (!selector && parent.className && typeof parent.className === 'string') {
                  const parentClasses = parent.className.split(' ')
                    .filter(c => c.trim() !== '' && c.length > 2)
                    .slice(0, 2);
                  for (const pc of parentClasses) {
                    const pcSel = `.${escapeCSSSelector(pc)} > ${tagName}`;
                    if (testUniqueness(pcSel)) {
                      selector = pcSel;
                      selectorConfidence = 0.55;
                      isUnique = true;
                      break;
                    }
                  }
                }
              }
            }
            // Ultimate fallback
            if (!selector) {
              selector = selectorType;
              selectorConfidence = 0.3;
            }

            // Playwright locator generation (string representation for display/fallback)
            let playwrightLocator = '';
            const esc = (s: string) => s.replace(/'/g, "\\'");

            let implicitRole = elRole;
            if (!implicitRole) {
              if (tagName === 'button' || (tagName === 'input' && (elType === 'submit' || elType === 'button'))) implicitRole = 'button';
              else if (tagName === 'a' && el.getAttribute('href')) implicitRole = 'link';
              else if (tagName === 'input' && elType === 'checkbox') implicitRole = 'checkbox';
              else if (tagName === 'input' && elType === 'radio') implicitRole = 'radio';
              else if (tagName === 'select') implicitRole = 'combobox';
              else if (tagName === 'textarea' || (tagName === 'input' && !['submit', 'button', 'checkbox', 'radio', 'hidden', 'file'].includes(elType))) implicitRole = 'textbox';
            }

            if (elTestId) {
              playwrightLocator = `getByTestId('${esc(elTestId)}')`;
            } else if (implicitRole && elAriaLabel) {
              playwrightLocator = `getByRole('${implicitRole}', { name: '${esc(elAriaLabel)}' })`;
            } else if (implicitRole && elText && elText.length > 0 && elText.length < 40) {
              playwrightLocator = `getByRole('${implicitRole}', { name: '${esc(elText)}' })`;
            } else if (elAriaLabel) {
              playwrightLocator = `getByLabel('${esc(elAriaLabel)}')`;
            } else if (elPlaceholder) {
              playwrightLocator = `getByPlaceholder('${esc(elPlaceholder)}')`;
            } else if (elText && elText.length > 0 && elText.length < 40) {
              playwrightLocator = `getByText('${esc(elText)}')`;
            } else if (elTitle) {
              playwrightLocator = `getByTitle('${esc(elTitle)}')`;
            }

            // Use Playwright locator as primary when available, CSS as fallback
            const primarySelector = playwrightLocator || selector;
            const fallbackSelectors = playwrightLocator ? [selector] : [];

            // Determine element type
            let elementType = 'text';
            const inputType = el.getAttribute('type');

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
              selector: primarySelector,
              elementType,
              description,
              confidence: selectorConfidence,

              // Enhanced selector data
              fallbackSelectors: fallbackSelectors,
              selectorType: playwrightLocator ? 'playwright' : 'css',
              isUniqueSelector: isUnique,
              isPlaywrightOptimized: !!playwrightLocator,
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

    try {
      // Resolve selector — supports both CSS and Playwright-native locators (getByRole, getByText, etc.)
      // Some actions (wait, navigate, press, screenshot) don't need a locator
      const noLocatorActions = ['wait', 'navigate', 'press', 'screenshot'];
      const locator = noLocatorActions.includes(action.type) ? null : this.resolveLocator(page, action.selector).first();
      const timeout = 10000; // 10 seconds

      // Execute the action
      switch (action.type) {
        case 'click':
          await locator!.click({ timeout });
          break;
        case 'doubleclick':
          await locator!.dblclick({ timeout });
          break;
        case 'rightclick':
          await locator!.click({ button: 'right', timeout });
          break;
        case 'hover':
          await locator!.hover({ timeout });
          break;
        case 'type':
          await locator!.fill(action.value || '', { timeout });
          break;
        case 'clear':
          await locator!.clear({ timeout });
          break;
        case 'select':
          await locator!.selectOption(action.value || '', { timeout });
          break;
        case 'check':
          await locator!.check({ timeout });
          break;
        case 'uncheck':
          await locator!.uncheck({ timeout });
          break;
        case 'scroll':
          await locator!.scrollIntoViewIfNeeded({ timeout });
          break;
        case 'press':
          await page.keyboard.press(action.value || 'Enter');
          break;
        case 'wait': {
          const waitMs = parseInt(action.value || '1000', 10);
          await page.waitForTimeout(Math.min(waitMs, 60000));
          break;
        }
        case 'assert': {
          const text = await locator!.textContent({ timeout });
          if (!text || !text.includes(action.value || '')) {
            throw new Error(`Assertion failed: Expected "${action.value}" but found "${text}"`);
          }
          break;
        }
        case 'navigate':
          await page.goto(action.value || '', { waitUntil: 'domcontentloaded', timeout });
          break;
        case 'upload':
          await locator!.setInputFiles(action.value || '', { timeout });
          break;
        case 'screenshot':
          // No-op for live browser — screenshot is captured after every action anyway
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      console.log(`✓ ${action.type} executed on: ${action.selector || 'page'}`);

      // Wait for dynamic content
      await page.waitForTimeout(1000);

      // Update session state
      try {
        await this.prisma.browserSession.update({
          where: { sessionToken },
          data: {
            currentState: 'after_interaction',
            lastActivity: new Date(),
          },
        });
      } catch (dbError) {
        console.error('Warning: Failed to update session state in database:', dbError);
        // Continue execution - database update failure shouldn't fail the action
      }

      // Capture elements after action - but don't fail if this errors
      try {
        const elements = await this.captureCurrentElements(sessionToken);

        // Mark elements as discovered after interaction
        return elements.map(element => ({
          ...element,
          discoveryState: action.type === 'hover' ? 'hover' : 'after_interaction',
          discoveryTrigger: `${action.type} ${action.selector}`,
        }));
      } catch (captureError) {
        console.error('Warning: Failed to capture elements after action:', captureError);
        // Return empty array - action succeeded even if element capture failed
        return [];
      }

    } catch (actionError) {
      console.error(`✗ Action execution failed:`, {
        type: action.type,
        selector: action.selector,
        value: action.value,
        error: actionError.message
      });
      throw actionError; // Re-throw action failures
    }
  }

  async getSessionScreenshot(sessionToken: string): Promise<string> {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    const { page } = sessionData;
    
    // Capture viewport screenshot as base64
    const screenshot = await page.screenshot({
      fullPage: false,
      type: 'jpeg',
      quality: 70,
      timeout: 5000,
      animations: 'disabled',  // Prevents CSS animation flicker during polling
    });

    // Return as data URL for easy frontend display
    return `data:image/jpeg;base64,${screenshot.toString('base64')}`;
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

  async closeAllProjectSessions(projectId: string): Promise<void> {
    const sessions = await this.prisma.browserSession.findMany({
      where: { projectId },
    });
    for (const session of sessions) {
      try {
        await this.closeSession(session.sessionToken);
      } catch (e) {
        // Session may already be closed
      }
    }
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

  /**
   * Resolve a selector string into a Playwright Locator.
   * Supports CSS/XPath selectors and Playwright-native locator strings:
   *   getByRole('button', { name: 'Submit' }), getByText('Hello'), etc.
   */
  private resolveLocator(page: Page, selector: string) {
    const nativeMatch = selector.match(/^(getByRole|getByText|getByLabel|getByTestId|getByPlaceholder|getByTitle)\(/);
    if (!nativeMatch) {
      return page.locator(selector);
    }

    const method = nativeMatch[1];
    const firstArgMatch = selector.match(/\(\s*['"]([^'"]*)['"]/);
    if (!firstArgMatch) {
      return page.locator(selector);
    }
    const firstArg = firstArgMatch[1];

    const optionsMatch = selector.match(/,\s*\{([^}]+)\}/);
    const options: Record<string, unknown> = {};
    if (optionsMatch) {
      const optStr = optionsMatch[1];
      const nameMatch = optStr.match(/name:\s*['"]([^'"]*)['"]/);
      if (nameMatch) options.name = nameMatch[1];
      const exactMatch = optStr.match(/exact:\s*(true|false)/);
      if (exactMatch) options.exact = exactMatch[1] === 'true';
    }

    switch (method) {
      case 'getByRole':
        return page.getByRole(firstArg as any, options as any);
      case 'getByText':
        return page.getByText(firstArg, options as any);
      case 'getByLabel':
        return page.getByLabel(firstArg, options as any);
      case 'getByTestId':
        return page.getByTestId(firstArg);
      case 'getByPlaceholder':
        return page.getByPlaceholder(firstArg, options as any);
      case 'getByTitle':
        return page.getByTitle(firstArg, options as any);
      default:
        return page.locator(selector);
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
    const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // Extend by 15 minutes
    
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
      
      // Task 1.11: Find element at EXACT click coordinates using elementFromPoint
      const elements = await page.evaluate(({ clickX, clickY }) => {
        const foundElements: any[] = [];
        const FALLBACK_RADIUS = 20; // Small radius for fallback suggestions only

        // Interactive element detection helpers
        const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
        const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab', 'option'];

        const isInteractive = (el: Element): boolean => {
          if (interactiveTags.includes(el.tagName)) return true;
          const role = el.getAttribute('role');
          if (role && interactiveRoles.includes(role)) return true;
          if (el.getAttribute('onclick')) return true;
          if (el.getAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;
          if (el.getAttribute('data-testid')) return true;
          return false;
        };

        // Walk up DOM tree to find interactive parent
        const findInteractiveParent = (el: Element | null): Element | null => {
          let current = el;
          while (current && current !== document.body) {
            if (isInteractive(current)) return current;
            current = current.parentElement;
          }
          return el; // Return original if no interactive parent found
        };

        // Generate selector for an element
        const generateSelector = (el: Element): string => {
          // Priority 1: data-testid
          const testId = el.getAttribute('data-testid');
          if (testId) return `[data-testid="${testId}"]`;

          // Priority 2: ID
          if (el.id) return `#${el.id}`;

          // Priority 3: aria-label
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

          // Priority 4: Button/link text
          const text = el.textContent?.trim();
          if (text && text.length < 50) {
            if (el.tagName === 'BUTTON') return `button:has-text("${text.substring(0, 30)}")`;
            if (el.tagName === 'A') return `a:has-text("${text.substring(0, 30)}")`;
          }

          // Priority 5: Name attribute
          const name = el.getAttribute('name');
          if (name) return `[name="${name}"]`;

          // Priority 6: Class-based selector
          if (el.className) {
            const classes = el.className.split(' ').filter(c => c && !c.includes(':'));
            if (classes.length > 0) {
              return `${el.tagName.toLowerCase()}.${classes[0]}`;
            }
          }

          // Fallback: tag name
          return el.tagName.toLowerCase();
        };

        // Get element info for results
        const getElementInfo = (el: Element, distance: number = 0) => {
          const rect = el.getBoundingClientRect();
          return {
            tagName: el.tagName.toLowerCase(),
            selector: generateSelector(el),
            textContent: el.textContent?.trim().substring(0, 100) || '',
            attributes: Array.from(el.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {} as Record<string, string>),
            boundingRect: {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            },
            distance: distance,
            href: (el as HTMLAnchorElement).href || null,
            value: (el as HTMLInputElement).value || null,
            placeholder: (el as HTMLInputElement).placeholder || null,
            type: (el as HTMLInputElement).type || null,
            role: el.getAttribute('role') || null,
            ariaLabel: el.getAttribute('aria-label') || null,
            confidence: distance === 0 ? 1.0 : Math.max(0.5, 1 - (distance / 50))
          };
        };

        // ===== STEP 1: Get EXACT element at click coordinates =====
        const exactElement = document.elementFromPoint(clickX, clickY);

        if (exactElement) {
          // Check if the exact element is interactive
          if (isInteractive(exactElement)) {
            foundElements.push(getElementInfo(exactElement, 0));
          } else {
            // Walk up to find interactive parent
            const interactiveParent = findInteractiveParent(exactElement);
            if (interactiveParent && isInteractive(interactiveParent)) {
              foundElements.push(getElementInfo(interactiveParent, 0));
            } else {
              // No interactive element found, but still return what was clicked
              foundElements.push(getElementInfo(exactElement, 0));
            }
          }
        }

        // ===== STEP 2: Get nearby fallback elements (small radius) =====
        const interactiveSelectors = [
          'button', 'input', 'select', 'textarea', 'a[href]',
          '[role="button"]', '[role="link"]', '[data-testid]'
        ];

        const allInteractive = document.querySelectorAll(interactiveSelectors.join(','));

        Array.from(allInteractive).forEach((element) => {
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          const distance = Math.sqrt(
            Math.pow(centerX - clickX, 2) + Math.pow(centerY - clickY, 2)
          );

          // Only include very close elements as fallbacks
          if (distance <= FALLBACK_RADIUS && distance > 0) {
            // Don't add duplicates
            const selector = generateSelector(element);
            if (!foundElements.some(e => e.selector === selector)) {
              foundElements.push(getElementInfo(element, Math.round(distance)));
            }
          }
        });

        // Sort: exact element first (distance=0), then by distance
        return foundElements
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5);

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