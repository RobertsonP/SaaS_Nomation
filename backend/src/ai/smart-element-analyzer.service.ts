import { Injectable } from '@nestjs/common';
import { LiveBrowserService } from '../browser/live-browser.service';

@Injectable()
export class SmartElementAnalyzerService {
  constructor(private liveBrowserService: LiveBrowserService) {}

  /**
   * 🎯 SMART ELEMENT ANALYSIS - CONTEXT-AWARE SELECTORS + VISUAL RECREATION
   * This replaces the old generic element collection with intelligent filtering
   */
  async analyzePageElements(url: string, authFlow?: any): Promise<{
    elements: any[];
    totalCount: number;
    categories: { interactive: number; verification: number; containers: number };
    metadata: any;
  }> {
    console.log(`🎯 Starting SMART element analysis for: ${url}`);
    
    // Create a session for analysis  
    const session = await this.liveBrowserService.createSession('smart-analysis', authFlow);
    
    try {
      // Navigate to the page
      await this.liveBrowserService.navigateToPage(session.id, url);
      
      // Execute smart element collection in the browser using crossOriginElementDetection
      // Note: We'll use the existing page evaluation capabilities
      const analysisResult = await this.executeSmartAnalysis(session.id);
      
      console.log(`✅ Smart analysis complete: ${analysisResult.elements.length} useful elements found`);
      
      return {
        elements: analysisResult.elements,
        totalCount: analysisResult.elements.length,
        categories: analysisResult.categories,
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          analysisType: 'smart-contextual',
          userAgent: analysisResult.userAgent || 'unknown'
        }
      };
      
    } finally {
      // Clean up the session
      await this.liveBrowserService.closeSession(session.id);
    }
  }

  /**
   * 🚀 EXECUTE SMART ANALYSIS IN BROWSER SESSION
   * Uses the existing session to run our smart analysis script
   */
  private async executeSmartAnalysis(sessionToken: string): Promise<{
    elements: any[];
    categories: { interactive: number; verification: number; containers: number };
    userAgent: string;
  }> {
    // Get the active session to access the page
    const sessionData = (this.liveBrowserService as any).activeSessions.get(sessionToken);
    if (!sessionData?.page) {
      throw new Error('Session not found or page not available');
    }
    
    const { page } = sessionData;
    
    // Execute our smart analysis script in the browser
    const scriptToExecute = this.getSmartAnalysisScript();
    const analysisResult = await page.evaluate((script) => {
      return eval(script);
    }, scriptToExecute);
    
    return analysisResult;
  }

  /**
   * 🚀 SMART ELEMENT ANALYSIS SCRIPT - RUNS IN BROWSER
   * This is where the magic happens - context-aware selectors and CSS extraction
   */
  private getSmartAnalysisScript(): string {
    return `
      (function() {
        console.log('🎯 SMART ELEMENT ANALYSIS STARTING...');
        
        // 🎯 SMART ELEMENT SELECTORS - ONLY USEFUL ELEMENTS
        const getSmartElementSelectors = () => {
          return {
            // 🔥 PRIORITY 1: INTERACTIVE ELEMENTS (what users actually test)
            interactive: [
              'button:not([style*="display: none"]):not([style*="visibility: hidden"])',
              'input:not([type="hidden"]):not([style*="display: none"])', // Skip hidden inputs
              'select:not([style*="display: none"])',
              'textarea:not([style*="display: none"])',
              'a[href]:not([href="#"]):not([href=""]):not([style*="display: none"])', // Only real links
              '[role="button"]:not([style*="display: none"])',
              '[role="link"]:not([style*="display: none"])',
              '[role="menuitem"]:not([style*="display: none"])',
              '[role="tab"]:not([style*="display: none"])',
              '[role="option"]:not([style*="display: none"])',
              '[onclick]:not([style*="display: none"])',
              '[data-testid]:not([style*="display: none"])',
              '[data-test]:not([style*="display: none"])',
              '[data-cy]:not([style*="display: none"])',
              '[data-e2e]:not([style*="display: none"])',
              'form:not([style*="display: none"])' // Forms themselves
            ],
            
            // 🔥 PRIORITY 2: VERIFICATION ELEMENTS (standalone text for assertions)
            verification: [
              'h1:not(button h1):not(a h1)', // Headings not inside interactive elements
              'h2:not(button h2):not(a h2)',
              'h3:not(button h3):not(a h3)',
              'h4:not(button h4):not(a h4)',
              'h5:not(button h5):not(a h5)',
              'h6:not(button h6):not(a h6)',
              '[role="alert"]', // Status messages
              '[role="status"]', // Status indicators
              '.error-message',
              '.success-message',
              '.warning-message',
              '.status',
              '.message',
              'label:not([for])', // Labels not tied to inputs (standalone text)
              'p:not(button p):not(a p):not(.btn p)', // Paragraphs not inside buttons/links
              'span.error:not(button span):not(a span)', // Error spans not inside interactive
              'span.success:not(button span):not(a span)', // Success spans
              'span.warning:not(button span):not(a span)', // Warning spans
              'div.notification:not(button div):not(a div)', // Notification divs
              'div.alert:not(button div):not(a div)' // Alert divs
            ],
            
            // 🔥 PRIORITY 3: CONTAINER ELEMENTS (for context in selectors)
            containers: [
              'nav',
              '[role="navigation"]',
              'header',
              'footer',
              'main',
              '[role="main"]',
              'aside',
              'section[aria-label]', // Only labeled sections
              'table',
              '[role="table"]'
            ]
          };
        };
        
        // 🎯 SMART ELEMENT COLLECTION WITH PRIORITY SYSTEM
        const collectSmartElements = () => {
          const allElements = new Set();
          const selectors = getSmartElementSelectors();
          const categories = { interactive: 0, verification: 0, containers: 0 };
          
          // Collect by priority: Interactive > Verification > Containers
          const priorityGroups = [
            { name: 'interactive', selectors: selectors.interactive },
            { name: 'verification', selectors: selectors.verification },
            { name: 'containers', selectors: selectors.containers }
          ];
          
          priorityGroups.forEach((group) => {
            console.log('🔍 Collecting ' + group.name + ' elements: ' + group.selectors.length + ' selectors');
            
            group.selectors.forEach(selector => {
              try {
                const matches = document.querySelectorAll(selector);
                console.log('   Selector \'' + selector + '\' found ' + matches.length + ' elements');
                matches.forEach(el => {
                  if (isElementUseful(el)) {
                    allElements.add(el);
                    categories[group.name]++;
                  }
                });
              } catch (e) {
                console.warn('Invalid selector:', selector, e);
              }
            });
          });
          
          console.log('🎯 Total useful elements collected: ' + allElements.size);
          return { elements: Array.from(allElements), categories };
        };
        
        // 🧠 SMART ELEMENT FILTERING - DETERMINE IF ELEMENT IS USEFUL
        const isElementUseful = (element) => {
          const tagName = element.tagName.toLowerCase();
          const computedStyle = window.getComputedStyle(element);
          const text = element.textContent?.trim() || '';
          const hasText = text.length > 0;
          const rect = element.getBoundingClientRect();
          
          // Skip truly hidden elements
          if (computedStyle.display === 'none' || 
              computedStyle.visibility === 'hidden' ||
              computedStyle.opacity === '0') {
            return false;
          }
          
          // Skip tiny elements (likely decorative)
          if (rect.width < 10 && rect.height < 10) {
            return false;
          }
          
          // Interactive elements are always useful if visible
          const interactiveElements = ['button', 'input', 'select', 'textarea', 'a'];
          if (interactiveElements.includes(tagName)) {
            return true;
          }
          
          // Elements with roles are useful
          if (element.hasAttribute('role')) {
            return true;
          }
          
          // Elements with test attributes are useful
          const testAttrs = ['data-testid', 'data-test', 'data-cy', 'data-e2e'];
          if (testAttrs.some(attr => element.hasAttribute(attr))) {
            return true;
          }
          
          // Text elements: only if they have meaningful text
          const textElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'];
          if (textElements.includes(tagName)) {
            // Skip text elements inside buttons/links
            const parentButton = element.closest('button, a, [role="button"], [role="link"]');
            if (parentButton) {
              return false; // Skip text inside interactive elements
            }
            
            // Only include text elements with meaningful content
            return hasText && text.length > 3 && text.length < 200;
          }
          
          return false;
        };
        
        // 🎨 COMPLETE CSS EXTRACTION FOR VISUAL RECREATION
        const extractCompleteCSS = (element) => {
          try {
            const computedStyle = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            
            // Helper to get CSS property with fallback
            const getCSSProperty = (property, fallback) => {
              try {
                const value = computedStyle.getPropertyValue(property) || computedStyle[property] || fallback;
                return value === 'none' || value === 'auto' || value === 'normal' ? fallback : value;
              } catch (e) {
                return fallback;
              }
            };
            
            return {
              // 🎨 Visual properties for recreation
              backgroundColor: getCSSProperty('background-color', 'transparent'),
              color: getCSSProperty('color', '#000000'),
              fontSize: getCSSProperty('font-size', '16px'),
              fontFamily: getCSSProperty('font-family', 'inherit'),
              fontWeight: getCSSProperty('font-weight', 'normal'),
              textDecoration: getCSSProperty('text-decoration', 'none'),
              textAlign: getCSSProperty('text-align', 'start'),
              lineHeight: getCSSProperty('line-height', 'normal'),
              
              // 📐 Border and spacing
              padding: getCSSProperty('padding', '0px'),
              margin: getCSSProperty('margin', '0px'),
              border: getCSSProperty('border', 'none'),
              borderRadius: getCSSProperty('border-radius', '0px'),
              boxShadow: getCSSProperty('box-shadow', 'none'),
              
              // 📏 Layout properties
              width: Math.round(rect.width) + 'px',
              height: Math.round(rect.height) + 'px',
              display: getCSSProperty('display', 'block'),
              position: getCSSProperty('position', 'static'),
              
              // 🎭 Visual effects
              opacity: getCSSProperty('opacity', '1'),
              visibility: getCSSProperty('visibility', 'visible'),
              cursor: getCSSProperty('cursor', 'auto'),
              
              // 🖼️ Background
              backgroundImage: getCSSProperty('background-image', 'none'),
              backgroundSize: getCSSProperty('background-size', 'auto'),
              backgroundPosition: getCSSProperty('background-position', '0% 0%'),
              
              // 📊 Quality indicators for recreation
              isVisible: computedStyle.visibility !== 'hidden' && 
                        computedStyle.display !== 'none' && 
                        parseFloat(computedStyle.opacity || '1') > 0,
              hasBackground: computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                           computedStyle.backgroundColor !== 'transparent',
              hasText: (element.textContent?.trim() || '').length > 0,
              hasInteractiveState: element.matches(':hover, :focus, :active') || false
            };
          } catch (error) {
            console.warn('CSS extraction failed for element:', error);
            return {
              backgroundColor: 'transparent',
              color: '#000000',
              fontSize: '16px',
              display: 'block',
              isVisible: true,
              hasBackground: false,
              hasText: (element.textContent?.trim() || '').length > 0
            };
          }
        };
        
        // 🎯 CONTEXT-AWARE SELECTOR GENERATOR (like your examples!)
        const generateContextAwareSelector = (element) => {
          const tag = element.tagName.toLowerCase();
          const text = element.textContent?.trim() || '';
          const attrs = Array.from(element.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {});
          
          // 🏗️ GET CONTEXT CONTAINERS (for location specification)
          const getContextContainers = (el) => {
            const containers = [];
            let current = el.parentElement;
            
            while (current && containers.length < 3) { // Max 3 levels for readability
              const currentTag = current.tagName.toLowerCase();
              const currentRole = current.getAttribute('role');
              const currentClass = current.className;
              const currentId = current.id;
              
              // Add meaningful containers
              if (currentTag === 'nav' || currentRole === 'navigation') {
                containers.unshift('nav');
              } else if (currentTag === 'header') {
                containers.unshift('header');
              } else if (currentTag === 'footer') {
                containers.unshift('footer');
              } else if (currentTag === 'main' || currentRole === 'main') {
                containers.unshift('main');
              } else if (currentTag === 'form') {
                const formName = current.getAttribute('name') || current.getAttribute('id');
                containers.unshift(formName ? 'form[name="' + formName + '"]' : 'form');
              } else if (currentTag === 'table') {
                containers.unshift('table');
              } else if (currentId) {
                containers.unshift('#' + currentId);
              } else if (currentClass && currentClass.match(/(container|wrapper|section|panel|modal|dialog)/)) {
                const relevantClass = currentClass.split(' ').find(cls => 
                  cls.match(/(container|wrapper|section|panel|modal|dialog)/)
                );
                if (relevantClass) {
                  containers.unshift('.' + relevantClass);
                }
              }
              
              current = current.parentElement;
            }
            
            return containers;
          };
          
          const contextContainers = getContextContainers(element);
          const selectors = [];
          
          // 🥇 STRATEGY 1: CONTEXT + ID (highest priority)
          if (attrs.id && attrs.id.length > 0) {
            if (contextContainers.length > 0) {
              selectors.push(contextContainers.join(' >> ') + ' >> #' + attrs.id);
            }
            selectors.push('#' + attrs.id);
            if (text && text.length < 50) {
              selectors.push('#' + attrs.id + ':has-text("' + text.replace(/"/g, '\\"') + '")');
            }
          }
          
          // 🥈 STRATEGY 2: CONTEXT + TEST ATTRIBUTES
          const testAttrs = ['data-testid', 'data-test', 'data-cy', 'data-e2e'];
          testAttrs.forEach(testAttr => {
            if (attrs[testAttr]) {
              if (contextContainers.length > 0) {
                selectors.push(contextContainers.join(' >> ') + ' >> [' + testAttr + '="' + attrs[testAttr] + '"]');
              }
              selectors.push('[' + testAttr + '="' + attrs[testAttr] + '"]');
              if (text && text.length < 50) {
                selectors.push('[' + testAttr + '="' + attrs[testAttr] + '"]:has-text("' + text.replace(/"/g, '\\"') + '")');
              }
            }
          });
          
          // 🥉 STRATEGY 3: CONTEXT + ROLE + TEXT (your preferred style!)
          if (attrs.role) {
            if (text && text.length > 0 && text.length < 50) {
              if (contextContainers.length > 0) {
                selectors.push(contextContainers.join(' >> ') + ' >> [role="' + attrs.role + '"]:has-text("' + text.replace(/"/g, '\\"') + '")');
              }
              selectors.push('[role="' + attrs.role + '"]:has-text("' + text.replace(/"/g, '\\"') + '")');
            }
            
            if (contextContainers.length > 0) {
              selectors.push(contextContainers.join(' >> ') + ' >> [role="' + attrs.role + '"]');
            }
            selectors.push('[role="' + attrs.role + '"]');
            
            if (attrs['aria-label']) {
              if (contextContainers.length > 0) {
                selectors.push(contextContainers.join(' >> ') + ' >> [role="' + attrs.role + '"][aria-label="' + attrs['aria-label'] + '"]');
              }
              selectors.push('[role="' + attrs.role + '"][aria-label="' + attrs['aria-label'] + '"]');
            }
          }
          
          // 🎯 STRATEGY 4: CONTEXT + TAG + TEXT (like your examples!)
          if (['button', 'input', 'select', 'textarea', 'a'].includes(tag)) {
            if (text && text.length > 0 && text.length < 50 && tag !== 'input') {
              if (contextContainers.length > 0) {
                selectors.push(contextContainers.join(' >> ') + ' >> ' + tag + ':has-text("' + text.replace(/"/g, '\\"') + '")');
              }
              selectors.push(tag + ':has-text("' + text.replace(/"/g, '\\"') + '")');
            }
            
            if (contextContainers.length > 0) {
              selectors.push(contextContainers.join(' >> ') + ' >> ' + tag);
            }
            
            // Input-specific selectors with context
            if (tag === 'input' && attrs.type) {
              if (contextContainers.length > 0) {
                selectors.push(contextContainers.join(' >> ') + ' >> input[type="' + attrs.type + '"]');
              }
              selectors.push('input[type="' + attrs.type + '"]');
              
              if (attrs.placeholder) {
                if (contextContainers.length > 0) {
                  selectors.push(contextContainers.join(' >> ') + ' >> input[type="' + attrs.type + '"][placeholder="' + attrs.placeholder + '"]');
                }
                selectors.push('input[type="' + attrs.type + '"][placeholder="' + attrs.placeholder + '"]');
              }
              
              if (attrs.name) {
                if (contextContainers.length > 0) {
                  selectors.push(contextContainers.join(' >> ') + ' >> input[name="' + attrs.name + '"]');
                }
                selectors.push('input[name="' + attrs.name + '"]');
              }
            }
            
            // Link-specific selectors with context
            if (tag === 'a' && attrs.href) {
              if (contextContainers.length > 0) {
                selectors.push(contextContainers.join(' >> ') + ' >> a[href="' + attrs.href + '"]');
              }
              selectors.push('a[href="' + attrs.href + '"]');
            }
          }
          
          return selectors.length > 0 ? selectors[0] : tag;
        };
        
        // 🚀 MAIN ANALYSIS EXECUTION
        console.log('🎯 Starting smart element collection...');
        const { elements, categories } = collectSmartElements();
        
        console.log('🎨 Processing elements with CSS extraction and selector generation...');
        const processedElements = elements.map((element, index) => {
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent?.trim() || '';
          const rect = element.getBoundingClientRect();
          
          // Generate context-aware selector
          const selector = generateContextAwareSelector(element);
          
          // Extract complete CSS for visual recreation
          const cssProperties = extractCompleteCSS(element);
          
          // Generate semantic description
          const generateDescription = () => {
            if (tagName === 'button') {
              return text ? 'Button: "' + text + '"' : 'Button';
            } else if (tagName === 'input') {
              const type = element.getAttribute('type') || 'text';
              const placeholder = element.getAttribute('placeholder');
              return placeholder ? type + ' input: "' + placeholder + '"' : type + ' input';
            } else if (tagName === 'a') {
              return text ? 'Link: "' + text + '"' : 'Link';
            } else if (tagName === 'select') {
              return 'Dropdown menu';
            } else if (tagName === 'textarea') {
              return 'Text area';
            } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
              return text ? 'Heading: "' + text + '"' : 'Heading (' + tagName + ')';
            } else if (element.hasAttribute('role')) {
              const role = element.getAttribute('role');
              return text ? role + ': "' + text + '"' : role;
            } else {
              return text ? 'Text: "' + text.substring(0, 50) + (text.length > 50 ? '...' : '') + '"' : tagName + ' element';
            }
          };
          
          return {
            id: 'element-' + index,
            tagName,
            selector,
            description: generateDescription(),
            textContent: text,
            attributes: Array.from(element.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {}),
            boundingRect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            cssProperties, // 🎨 Complete CSS for visual recreation
            isInteractive: ['button', 'input', 'select', 'textarea', 'a'].includes(tagName) ||
                          element.hasAttribute('onclick') ||
                          element.hasAttribute('role') &&
                          ['button', 'link', 'menuitem', 'tab'].includes(element.getAttribute('role')),
            isVerification: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'].includes(tagName) &&
                           !element.closest('button, a, [role="button"], [role="link"]')
          };
        });
        
        console.log('✅ Smart analysis complete! Found ' + processedElements.length + ' useful elements');
        console.log('📊 Categories:', categories);
        
        return {
          elements: processedElements,
          categories,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        };
      })();
    `;
  }
}