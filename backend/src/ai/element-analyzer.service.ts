import { Injectable } from '@nestjs/common';
import { Page, ElementHandle } from 'playwright';
import { AiService } from './ai.service';
import { DetectedElement, PageAnalysisResult, SelectorValidationResult, QualityMetrics, LoginFlow } from './interfaces/element.interface';
import { AdvancedSelectorGeneratorService } from '../browser/advanced-selector-generator.service';
import { BrowserManagerService } from './browser-manager.service';
import { SelectorQualityService } from './selector-quality.service';
import { ScreenshotService } from './screenshot.service';
import { TestStep, MultiUrlAnalysisResult, UrlAnalysisResult, ElementHuntResult } from '../common/types/execution.types';
import { MockElementData, MockElement, MockDocument, MockElementWrapper, MockElementList } from '../common/types/dom.types';

@Injectable()
export class ElementAnalyzerService {
  // Feature flags for safe rollback
  private readonly USE_ADVANCED_SELECTORS = true;
  private readonly USE_ENHANCED_FILTERING = true;

  constructor(
    private aiService: AiService,
    private advancedSelectorService: AdvancedSelectorGeneratorService,
    private browserManager: BrowserManagerService,
    private selectorQuality: SelectorQualityService,
    private screenshotService: ScreenshotService
  ) {}

  async analyzePage(url: string): Promise<PageAnalysisResult> {
    const browser = await this.browserManager.setupBrowser();
    // Use createPageForUrl to handle localhost SSL errors
    const page = await this.browserManager.createPageForUrl(browser, url);

    try {
      console.log(`Analyzing page: ${url}`);
      
      // Navigate to the page and wait for content to load
      await this.browserManager.navigateToPage(page, url);
      
      // Enhanced element extraction with CSS information
      const elements = await this.extractAllPageElements(page);
      
      console.log(`Found ${elements.length} elements with enhanced data`);
      
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

  /**
   * Extract all testable elements from a page
   */
  private async extractAllPageElements(page: Page): Promise<DetectedElement[]> {
    console.log('🔄 Starting extractAllPageElements - entering page.evaluate()...');

    // First, extract elements without screenshots in browser context
    let extractedElements = await page.evaluate(() => {
      console.log('🔍 === INSIDE BROWSER CONTEXT - ELEMENT EXTRACTION ===');
      const extractedElements: any[] = [];
      
      // Debug: Check basic page state
      console.log('📄 Document ready state:', document.readyState);
      console.log('📄 Document location:', window.location.href);
      console.log('📄 Document title:', document.title);
      
      // Helper function: Get comprehensive element selectors
      const getElementSelectors = (): string[] => {
        return [
          // Basic interactive elements
          'button',
          'input',
          'textarea',
          'select',
          'option',
          'optgroup',
          'a',
          'area',
          
          // Form elements (all types)
          'input[type="text"]',
          'input[type="email"]', 
          'input[type="password"]',
          'input[type="submit"]',
          'input[type="button"]',
          'input[type="reset"]',
          'input[type="search"]',
          'input[type="tel"]',
          'input[type="url"]',
          'input[type="number"]',
          'input[type="range"]',
          'input[type="date"]',
          'input[type="time"]',
          'input[type="datetime-local"]',
          'input[type="month"]',
          'input[type="week"]',
          'input[type="color"]',
          'input[type="file"]',
          'input[type="checkbox"]',
          'input[type="radio"]',
          'input[type="hidden"]',
          'input[type="image"]',
          
          // Form structure
          'form',
          'fieldset',
          'legend',
          'label',
          'datalist',
          'output',
          'progress',
          'meter',
          
          // Interactive elements by role
          '[role="button"]',
          '[role="link"]',
          '[role="textbox"]',
          '[role="combobox"]',
          '[role="listbox"]',
          '[role="option"]',
          '[role="menuitem"]',
          '[role="tab"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="slider"]',
          '[role="spinbutton"]',
          '[role="searchbox"]',
          '[role="switch"]',
          '[role="tooltip"]',
          '[role="dialog"]',
          '[role="alertdialog"]',
          '[role="banner"]',
          '[role="main"]',
          '[role="navigation"]',
          '[role="contentinfo"]',
          '[role="complementary"]',
          
          // Content and media
          'img',
          'picture',
          'video',
          'audio',
          'canvas',
          'svg',
          'iframe',
          'embed',
          'object',
          
          // Text content
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'p',
          'span',
          'div',
          'section',
          'article',
          'aside',
          'header',
          'footer',
          'main',
          'nav',
          'details',
          'summary',
          
          // Lists
          'ul',
          'ol',
          'li',
          'dl',
          'dt',
          'dd',
          
          // Tables
          'table',
          'thead',
          'tbody',
          'tfoot',
          'tr',
          'th',
          'td',
          'caption',
          'colgroup',
          'col',
          
          // Interactive by attributes
          '[onclick]',
          '[onchange]',
          '[onsubmit]',
          '[onkeydown]',
          '[onkeyup]',
          '[onkeypress]',
          '[onfocus]',
          '[onblur]',
          '[onmousedown]',
          '[onmouseup]',
          '[onmouseover]',
          '[onmouseout]',
          '[tabindex]',
          '[contenteditable="true"]',
          '[contenteditable=""]',
          '[draggable="true"]',
          
          // Testing attributes
          '[data-testid]',
          '[data-test]',
          '[data-cy]',
          '[data-e2e]',
          '[data-selenium]',
          '[data-automation]',
          '[data-qa]',
          '[test-id]',
          '[automation-id]',
          
          // Accessibility attributes
          '[aria-label]',
          '[aria-labelledby]',
          '[aria-describedby]',
          '[aria-expanded]',
          '[aria-selected]',
          '[aria-checked]',
          '[aria-pressed]',
          '[aria-hidden="false"]',
          
          // Common UI patterns
          '.btn',
          '.button',
          '.link',
          '.clickable',
          '.selectable',
          '.interactive',
          '.form-control',
          '.input',
          '.checkbox',
          '.radio',
          '.select',
          '.dropdown',
          '.menu-item',
          '.tab',
          '.card',
          '.modal',
          '.popup',
          '.tooltip',
          
          // Modern framework selectors
          '[ng-click]',
          '[v-on\\:click]',
          '[v-click]',
          '[\\@click]',
          'router-link',
          'nuxt-link'
        ];
      };
        
      // Helper function: Collect all matching elements with deduplication
      const collectAllElements = (selectors: string[]): Set<Element> => {
        const allElements = new Set<Element>();
        
        selectors.forEach(selector => {
          try {
            const matches = document.querySelectorAll(selector);
            matches.forEach(el => allElements.add(el));
          } catch (e) {
            // Skip invalid selectors for some browsers
            console.warn('Invalid selector:', selector);
          }
        });
        
        return allElements;
      };
      
      // Get selectors and collect elements
      const selectors = getElementSelectors();
      console.log(`🎯 Using ${selectors.length} selectors for element detection`);
      
      const allElements = collectAllElements(selectors);
      console.log(`🔍 Found ${allElements.size} unique elements after selector matching`);
      
      if (allElements.size === 0) {
        console.error('❌ CRITICAL: No elements found by any selectors!');
        console.error('❌ This suggests the page is empty or selectors are not matching.');
        // Test basic selectors
        const basicTest = document.querySelectorAll('*');
        console.error(`❌ Basic * selector finds ${basicTest.length} elements`);
        const buttonTest = document.querySelectorAll('button');
        console.error(`❌ Button selector finds ${buttonTest.length} elements`);
        const inputTest = document.querySelectorAll('input');
        console.error(`❌ Input selector finds ${inputTest.length} elements`);
        const linkTest = document.querySelectorAll('a');
        console.error(`❌ Link selector finds ${linkTest.length} elements`);
      }
      
      // Phase 2: Enhanced CSS Property Validation and Extraction Helper
      const extractValidatedCSSProperties = (element: Element, computedStyle: CSSStyleDeclaration) => {
        try {
          // Helper to safely get CSS property with fallbacks
          const getCSSProperty = (property: string, fallback: string = '') => {
            try {
              const value = computedStyle.getPropertyValue(property) || computedStyle[property as any] || fallback;
              return value === 'none' || value === 'auto' || value === 'normal' ? fallback : value;
            } catch (e) {
              return fallback;
            }
          };
          
          // Helper to determine element visibility and interaction state
          const isElementVisible = () => {
            return computedStyle.visibility !== 'hidden' && 
                   computedStyle.display !== 'none' && 
                   parseFloat(computedStyle.opacity || '1') > 0;
          };
          
          const hasVisualStyling = () => {
            const bgColor = computedStyle.backgroundColor;
            const hasBackground = bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent';
            const hasBorder = computedStyle.border && computedStyle.border !== 'none' && computedStyle.border !== '0px none';
            const hasShadow = computedStyle.boxShadow && computedStyle.boxShadow !== 'none';
            return hasBackground || hasBorder || hasShadow;
          };
          
          // Extract and validate comprehensive CSS properties
          return {
            // Visual properties with validation
            backgroundColor: getCSSProperty('background-color', 'transparent'),
            color: getCSSProperty('color', '#000000'),
            fontSize: getCSSProperty('font-size', '16px'),
            fontFamily: getCSSProperty('font-family', 'inherit'),
            fontWeight: getCSSProperty('font-weight', 'normal'),
            textDecoration: getCSSProperty('text-decoration', 'none'),
            textAlign: getCSSProperty('text-align', 'start'),
            lineHeight: getCSSProperty('line-height', 'normal'),
            letterSpacing: getCSSProperty('letter-spacing', 'normal'),
            
            // Border and spacing with validation
            padding: getCSSProperty('padding', '0px'),
            margin: getCSSProperty('margin', '0px'),
            border: getCSSProperty('border', 'none'),
            borderRadius: getCSSProperty('border-radius', '0px'),
            boxShadow: getCSSProperty('box-shadow', 'none'),
            outline: getCSSProperty('outline', 'none'),
            
            // Layout properties with validation
            width: getCSSProperty('width', 'auto'),
            height: getCSSProperty('height', 'auto'),
            display: getCSSProperty('display', 'block'),
            position: getCSSProperty('position', 'static'),
            top: getCSSProperty('top', 'auto'),
            left: getCSSProperty('left', 'auto'),
            right: getCSSProperty('right', 'auto'),
            bottom: getCSSProperty('bottom', 'auto'),
            zIndex: getCSSProperty('z-index', 'auto'),
            overflow: getCSSProperty('overflow', 'visible'),
            
            // Visual effects and transforms with validation
            opacity: getCSSProperty('opacity', '1'),
            visibility: getCSSProperty('visibility', 'visible'),
            transform: getCSSProperty('transform', 'none'),
            filter: getCSSProperty('filter', 'none'),
            cursor: getCSSProperty('cursor', 'auto'),
            pointerEvents: getCSSProperty('pointer-events', 'auto'),
            
            // Background and images with validation
            backgroundImage: getCSSProperty('background-image', 'none'),
            backgroundSize: getCSSProperty('background-size', 'auto'),
            backgroundPosition: getCSSProperty('background-position', '0% 0%'),
            backgroundRepeat: getCSSProperty('background-repeat', 'repeat'),
            
            // Flexbox and Grid properties with validation
            flexDirection: getCSSProperty('flex-direction', 'row'),
            justifyContent: getCSSProperty('justify-content', 'flex-start'),
            alignItems: getCSSProperty('align-items', 'stretch'),
            gridTemplateColumns: getCSSProperty('grid-template-columns', 'none'),
            gridTemplateRows: getCSSProperty('grid-template-rows', 'none'),
            
            // Interactive state indicators with validation
            transition: getCSSProperty('transition', 'none'),
            animation: getCSSProperty('animation', 'none'),
            
            // Quality indicators for CSS preview
            isVisible: isElementVisible(),
            hasBackground: computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && computedStyle.backgroundColor !== 'transparent',
            hasText: (element.textContent?.trim() || '').length > 0,
            isStyled: hasVisualStyling()
          };
        } catch (error) {
          console.warn('CSS property extraction failed for element:', error);
          // Return minimal fallback CSS properties
          return {
            backgroundColor: 'transparent',
            color: '#000000',
            fontSize: '16px',
            fontFamily: 'inherit',
            fontWeight: 'normal',
            display: 'block',
            position: 'static',
            isVisible: true,
            hasBackground: false,
            hasText: (element.textContent?.trim() || '').length > 0,
            isStyled: false
          };
        }
      };
        
      // Extract information for each element
      let processedCount = 0;
      allElements.forEach((element, index) => {
          try {
            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);
            const tagName = element.tagName.toLowerCase();
            
            // ENHANCED TESTABILITY FILTERING - Only include elements useful for testing

            // Get text content and length for filtering
            const textContent = element.textContent?.trim() || '';
            const textLength = textContent.length;
            const hasText = textLength > 0;

            // Skip scripts, styles, metadata immediately
            if (['script', 'style', 'meta', 'noscript', 'link', 'head'].includes(tagName)) {
              return;
            }

            // PRIMARY: Core interactive elements (ALWAYS include)
            const isInteractiveElement = [
              'input', 'textarea', 'select', 'button', 'a', 'label', 'option', 'form'
            ].includes(tagName);

            // SECONDARY: Elements with explicit test attributes
            const hasTestAttributes =
              element.hasAttribute('data-testid') ||
              element.hasAttribute('data-test') ||
              element.hasAttribute('data-cy') ||
              element.hasAttribute('data-test-id');

            // TERTIARY: Elements with interactive attributes or roles
            const hasInteractiveAttributes =
              element.hasAttribute('onclick') ||
              element.hasAttribute('onchange') ||
              element.hasAttribute('tabindex') ||
              element.hasAttribute('aria-label');

            const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab', 'option', 'combobox', 'searchbox'];
            const elementRole = element.getAttribute('role');
            const hasInteractiveRole = elementRole && interactiveRoles.includes(elementRole);

            // QUATERNARY: Clickable elements (pointer cursor)
            const isClickable =
              element.hasAttribute('onclick') ||
              (element as HTMLElement).style?.cursor === 'pointer' ||
              computedStyle.cursor === 'pointer';

            // QUINARY: Images with alt text (for visual verification)
            const isDescriptiveImage = tagName === 'img' &&
              element.hasAttribute('alt') &&
              element.getAttribute('alt').trim().length > 0;

            // SENARY: Media elements (for interaction/verification)
            const isMediaElement = ['video', 'audio', 'canvas', 'svg', 'iframe'].includes(tagName);

            // SEPTENARY: Important verification text (headings, messages, alerts)
            // Only include text < 300 chars that serves verification purpose
            const className = element.className || '';
            const isImportantText = hasText && textLength <= 300 && (
              // Headings (important page structure)
              ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) ||
              // Labels (help identify inputs)
              tagName === 'label' ||
              // Error/message/alert elements
              className.includes('error') ||
              className.includes('message') ||
              className.includes('alert') ||
              className.includes('notification') ||
              className.includes('toast') ||
              className.includes('status') ||
              elementRole === 'alert' ||
              elementRole === 'status'
            );

            // OCTENARY: Structural containers ONLY if they have interactive attributes
            const isInteractiveContainer =
              ['div', 'span', 'section', 'article', 'aside'].includes(tagName) &&
              (hasTestAttributes || hasInteractiveAttributes || hasInteractiveRole || isClickable);

            // DECIDE: Should this element be included?
            const shouldInclude =
              isInteractiveElement ||
              hasTestAttributes ||
              hasInteractiveAttributes ||
              hasInteractiveRole ||
              isClickable ||
              isDescriptiveImage ||
              isMediaElement ||
              isImportantText ||
              isInteractiveContainer;

            if (!shouldInclude) {
              // LOG excluded elements occasionally for debugging
              if (processedCount < 10 || processedCount % 50 === 0) {
                console.log(`🚫 Excluded: ${tagName}${className ? '.' + className.split(' ')[0] : ''} - Text: "${textContent.substring(0, 30)}${textLength > 30 ? '...' : ''}"`);
              }
              return;
            }
            
            // Skip truly hidden elements but be very permissive
            if (computedStyle.display === 'none' || 
                computedStyle.visibility === 'hidden' ||
                (computedStyle.opacity === '0' && !isInteractiveElement)) {
              return;
            }
            
            // Very lenient size requirements
            if (isInteractiveElement || hasInteractiveAttributes) {
              // Interactive elements - allow very small sizes (for hidden inputs, etc.)
              if (rect.width === 0 && rect.height === 0 && 
                  !element.hasAttribute('type') || 
                  element.getAttribute('type') === 'hidden') {
                return; // Only skip truly zero-sized non-hidden elements
              }
            } else {
              // Non-interactive elements need some size unless they have special attributes
              if (rect.width < 5 && rect.height < 5 && !hasText) {
                return;
              }
            }
            
            // Generate highly accurate and unique selector with comprehensive strategy
            const generateSelector = (el: Element, allElements: Element[]): string => {

              // Helper function to escape strings for Playwright selectors
              const escapePlaywrightString = (str: string): string => {
                return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
              };

              // Helper function to escape CSS selectors
              const escapeCSSSelector = (str: string): string => {
                return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
              };

              // Helper function to test selector uniqueness
              const testUniqueness = (selector: string): boolean => {
                try {
                  const matches = document.querySelectorAll(selector);
                  return matches.length === 1 && matches[0] === el;
                } catch (e) {
                  return false;
                }
              };

              // CSS SELECTORS ONLY - Playwright locators disabled
              // Advanced selector service will enhance these after extraction

              const tagName = el.tagName.toLowerCase();
              const textContent = el.textContent?.trim() || '';
              const ariaLabel = el.getAttribute('aria-label');
              const role = el.getAttribute('role');
              const placeholder = el.getAttribute('placeholder');
              const type = el.getAttribute('type');
              const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');

              // NOTE: Playwright locator generation (getByRole, getByTestId, etc.) has been
              // moved to advanced-selector-generator.service.ts for better control and consistency.
              // Browser context now only generates CSS selectors which are enhanced later.

              // GENERATE CSS SELECTORS

              // 6. ID selector (high priority CSS fallback)
              if (el.id && el.id.trim() !== '') {
                const idSelector = `#${escapeCSSSelector(el.id)}`;
                if (testUniqueness(idSelector)) {
                  return idSelector;
                }
              }
              
              // 7. data-testid CSS fallback (if Playwright selector wasn't generated above)
              // testId already declared at top of function
              if (testId && testId.trim() !== '') {
                const testIdSelector = `[data-testid="${escapeCSSSelector(testId)}"]`;
                if (testUniqueness(testIdSelector)) {
                  return testIdSelector;
                }
              }
              
              // 3. name attribute (for form elements)
              const name = el.getAttribute('name');
              if (name && name.trim() !== '') {
                const nameSelector = `[name="${escapeCSSSelector(name)}"]`;
                if (testUniqueness(nameSelector)) {
                  return nameSelector;
                }
                // Try with tag name for more specificity
                const tagNameSelector = `${el.tagName.toLowerCase()}[name="${escapeCSSSelector(name)}"]`;
                if (testUniqueness(tagNameSelector)) {
                  return tagNameSelector;
                }
              }
              
              // 9. aria-label CSS fallback (accessibility attributes)
              // ariaLabel already declared at top of function
              if (ariaLabel && ariaLabel.trim() !== '') {
                const ariaSelector = `[aria-label="${escapeCSSSelector(ariaLabel)}"]`;
                if (testUniqueness(ariaSelector)) {
                  return ariaSelector;
                }
              }
              
              // 10. Combination of tag + type + specific attributes
              // tagName and type already declared at top of function

              if (type) {
                const typeSelector = `${tagName}[type="${type}"]`;
                if (testUniqueness(typeSelector)) {
                  return typeSelector;
                }
              }
              
              // 6. Tag + Class combinations (use stable classes)
              if (el.className && el.className.trim() !== '') {
                const classes = el.className.split(' ')
                  .filter(c => c.trim() !== '')
                  .filter(c => !c.match(/^(active|hover|focus|selected|disabled|loading)$/)) // Filter out state classes
                  .filter(c => c.length > 2) // Filter out very short classes
                  .slice(0, 3); // Limit to first 3 stable classes
                
                if (classes.length > 0) {
                  // Try most specific first (all classes)
                  const allClassesSelector = `${tagName}.${classes.map(c => escapeCSSSelector(c)).join('.')}`;
                  if (testUniqueness(allClassesSelector)) {
                    return allClassesSelector;
                  }
                  
                  // Try single class combinations
                  for (const cls of classes) {
                    const singleClassSelector = `${tagName}.${escapeCSSSelector(cls)}`;
                    if (testUniqueness(singleClassSelector)) {
                      return singleClassSelector;
                    }
                  }
                }
              }
              
              // 7. Multiple attribute combinations
              const importantAttrs = ['role', 'placeholder', 'value', 'title', 'href', 'alt', 'for'];
              const availableAttrs = importantAttrs.filter(attr => el.getAttribute(attr));
              
              // Try combinations of 2-3 attributes
              for (let i = 0; i < availableAttrs.length; i++) {
                for (let j = i + 1; j < availableAttrs.length; j++) {
                  const attr1 = availableAttrs[i];
                  const attr2 = availableAttrs[j];
                  const val1 = el.getAttribute(attr1);
                  const val2 = el.getAttribute(attr2);
                  
                  if (val1 && val2) {
                    const multiAttrSelector = `${tagName}[${attr1}="${escapeCSSSelector(val1)}"][${attr2}="${escapeCSSSelector(val2)}"]`;
                    if (testUniqueness(multiAttrSelector)) {
                      return multiAttrSelector;
                    }
                  }
                }
              }
              
              // 8. Single attribute selectors
              for (const attr of importantAttrs) {
                const attrValue = el.getAttribute(attr);
                if (attrValue && attrValue.trim() !== '') {
                  const attrSelector = `${tagName}[${attr}="${escapeCSSSelector(attrValue)}"]`;
                  if (testUniqueness(attrSelector)) {
                    return attrSelector;
                  }
                }
              }
              
              // 12. Text content-based CSS selectors (for elements with unique text)
              // textContent already declared at top of function
              if (textContent && textContent.length > 0 && textContent.length < 100) {
                // Clean text for selector use
                const cleanText = textContent.substring(0, 50).trim();
                if (cleanText && !cleanText.match(/^\s*$/)) {
                  const textSelector = `${tagName}:has-text("${escapeCSSSelector(cleanText)}")`;
                  // Note: :has-text is Playwright-specific, but we'll use it as a fallback
                  if (document.querySelectorAll(tagName).length < 10) { // Only if few elements of same tag
                    return textSelector;
                  }
                }
              }
              
              // 10. Parent-child relationship selectors
              const parent = el.parentElement;
              if (parent) {
                // Try parent class + child tag
                if (parent.className) {
                  const parentClasses = parent.className.split(' ')
                    .filter(c => c.trim() !== '' && c.length > 2)
                    .slice(0, 2);
                    
                  for (const parentClass of parentClasses) {
                    const parentChildSelector = `.${escapeCSSSelector(parentClass)} > ${tagName}`;
                    if (testUniqueness(parentChildSelector)) {
                      return parentChildSelector;
                    }
                  }
                }
                
                // Try parent ID + child
                if (parent.id) {
                  const parentIdSelector = `#${escapeCSSSelector(parent.id)} ${tagName}`;
                  if (testUniqueness(parentIdSelector)) {
                    return parentIdSelector;
                  }
                }
                
                // Try parent tag + child with attributes
                if (type) {
                  const parentTagSelector = `${parent.tagName.toLowerCase()} > ${tagName}[type="${type}"]`;
                  if (testUniqueness(parentTagSelector)) {
                    return parentTagSelector;
                  }
                }
              }
              
              // 11. Advanced structural selectors
              if (parent) {
                const siblings = Array.from(parent.children).filter(child => child.tagName === el.tagName);
                const siblingIndex = siblings.indexOf(el as Element);
                
                if (siblings.length > 1 && siblingIndex >= 0) {
                  // Try first/last shortcuts
                  if (siblingIndex === 0) {
                    const firstChildSelector = parent.className 
                      ? `.${parent.className.split(' ')[0]} > ${tagName}:first-child`
                      : `${parent.tagName.toLowerCase()} > ${tagName}:first-child`;
                    if (testUniqueness(firstChildSelector)) {
                      return firstChildSelector;
                    }
                  }
                  
                  if (siblingIndex === siblings.length - 1) {
                    const lastChildSelector = parent.className 
                      ? `.${parent.className.split(' ')[0]} > ${tagName}:last-child`
                      : `${parent.tagName.toLowerCase()} > ${tagName}:last-child`;
                    if (testUniqueness(lastChildSelector)) {
                      return lastChildSelector;
                    }
                  }
                  
                  // nth-child as last resort
                  const nthChildSelector = parent.className 
                    ? `.${parent.className.split(' ')[0]} > ${tagName}:nth-child(${siblingIndex + 1})`
                    : `${parent.tagName.toLowerCase()} > ${tagName}:nth-child(${siblingIndex + 1})`;
                  if (testUniqueness(nthChildSelector)) {
                    return nthChildSelector;
                  }
                }
              }
              
              // 12. Final fallback - position among all similar elements
              const allSimilarElements = document.querySelectorAll(tagName);
              const elementIndex = Array.from(allSimilarElements).indexOf(el);
              
              if (elementIndex >= 0 && allSimilarElements.length > 1) {
                return `${tagName}:nth-of-type(${elementIndex + 1})`;
              }
              
              // Ultimate fallback
              return tagName;
            };
            
            // Determine element type - enhanced for better form detection
            const getElementType = (el: Element): string => {
              const tagName = el.tagName.toLowerCase();
              const role = el.getAttribute('role');
              const type = el.getAttribute('type');
              
              // Button elements
              if (tagName === 'button' || role === 'button' || type === 'button' || type === 'submit') return 'button';
              
              // Input elements - be more specific
              if (tagName === 'input') {
                if (['submit', 'button'].includes(type)) return 'button';
                if (['checkbox', 'radio'].includes(type)) return 'input';
                return 'input'; // text, email, password, etc.
              }
              
              // Other form elements
              if (tagName === 'textarea' || role === 'textbox') return 'input';
              if (tagName === 'select') return 'input';
              if (tagName === 'label') return 'text';
              
              // Links
              if (tagName === 'a' || role === 'link') return 'link';
              
              // Form containers
              if (tagName === 'form') return 'form';
              
              // Navigation
              if (tagName === 'nav' || role === 'navigation') return 'navigation';
              
              // Image elements
              if (tagName === 'img' || tagName === 'svg' || tagName === 'canvas') return 'image';
              
              // Text elements
              if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'text';
              if (tagName === 'p' || tagName === 'span' || tagName === 'div' && el.textContent?.trim()) return 'text';
              
              return 'element';
            };
            
            // Generate description - enhanced for form elements
            // Get visual location context for element (helps distinguish similar elements)
            const getVisualLocation = (el: Element): string => {
              const locations: string[] = [];

              // Check if inside semantic containers
              const nav = el.closest('nav');
              const header = el.closest('header');
              const footer = el.closest('footer');
              const aside = el.closest('aside');
              const form = el.closest('form');
              const main = el.closest('main');

              if (nav) {
                // Check if in top navigation or other nav
                const navRect = nav.getBoundingClientRect();
                if (navRect.top < 100) {
                  locations.push('top navigation');
                } else {
                  locations.push('navigation');
                }
              } else if (header) {
                locations.push('header');
              } else if (footer) {
                locations.push('footer');
              } else if (aside) {
                // Try to determine sidebar position
                const asideRect = aside.getBoundingClientRect();
                if (asideRect.left < window.innerWidth / 3) {
                  locations.push('left sidebar');
                } else if (asideRect.right > (window.innerWidth * 2) / 3) {
                  locations.push('right sidebar');
                } else {
                  locations.push('sidebar');
                }
              } else if (form) {
                // Identify form type if possible
                const formClass = form.className.toLowerCase();
                const formId = form.id.toLowerCase();
                if (formClass.includes('login') || formId.includes('login')) {
                  locations.push('login form');
                } else if (formClass.includes('search') || formId.includes('search')) {
                  locations.push('search form');
                } else if (formClass.includes('signup') || formClass.includes('register') || formId.includes('signup') || formId.includes('register')) {
                  locations.push('signup form');
                } else {
                  locations.push('form');
                }
              } else if (main) {
                locations.push('main content');
              }

              // If no semantic container found, use position-based description
              if (locations.length === 0) {
                const rect = el.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;

                // Vertical position
                if (rect.top < viewportHeight / 3) {
                  locations.push('top of page');
                } else if (rect.top > (viewportHeight * 2) / 3) {
                  locations.push('bottom of page');
                }

                // Horizontal position (only for non-full-width elements)
                if (rect.width < viewportWidth * 0.8) {
                  if (rect.left < viewportWidth / 3) {
                    locations.push('left side');
                  } else if (rect.right > (viewportWidth * 2) / 3) {
                    locations.push('right side');
                  }
                }
              }

              return locations.length > 0 ? ` in ${locations.join(', ')}` : '';
            };

            const getDescription = (el: Element): string => {
              const text = el.textContent?.trim() || '';
              const ariaLabel = el.getAttribute('aria-label') || '';
              const placeholder = el.getAttribute('placeholder') || '';
              const title = el.getAttribute('title') || '';
              const name = el.getAttribute('name') || '';
              const id = el.getAttribute('id') || '';
              const type = el.getAttribute('type') || '';
              const tagName = el.tagName.toLowerCase();

              // Get visual location to distinguish similar elements
              const location = getVisualLocation(el);

              // For form elements, try to build a meaningful description
              if (['input', 'textarea', 'select'].includes(tagName)) {
                if (ariaLabel) return `${ariaLabel}${location}`;
                if (placeholder) return `${placeholder} (${type || tagName})${location}`;
                if (name) return `${name} ${type || tagName}${location}`;
                if (id) return `${id} ${type || tagName}${location}`;
                if (type) return `${type} input${location}`;
                return `${tagName} field${location}`;
              }

              // For labels, try to find what they're labeling
              if (tagName === 'label') {
                const forAttr = el.getAttribute('for');
                if (forAttr) return `Label for ${forAttr}${location}`;
                if (text) return `Label: ${text.slice(0, 30)}${location}`;
                return `Label${location}`;
              }

              // For buttons, use text or type
              if (tagName === 'button' || type === 'submit' || type === 'button') {
                if (text) return `${text.slice(0, 30)} button${location}`;
                if (type === 'submit') return `Submit button${location}`;
                return `Button${location}`;
              }

              // Default logic for other elements
              const baseDescription = ariaLabel || text.slice(0, 50) || placeholder || title || `${tagName} element`;
              return `${baseDescription}${location}`;
            };
            
            const elementType = getElementType(element);
            const selector = generateSelector(element, Array.from(allElements));
            
            // Extract CSS properties
            const cssProps = extractValidatedCSSProperties(element, computedStyle);

            // Create element object
            const detectedElement: any = {
              selector,
              elementType,
              description: getDescription(element),
              confidence: 0.9, // High confidence for visible elements
              attributes: {
                text: element.textContent?.trim() || '',
                tagName: element.tagName.toLowerCase(),
                id: element.id || '',
                className: element.className || '',
                'aria-label': element.getAttribute('aria-label') || '',
                placeholder: element.getAttribute('placeholder') || '',
                type: element.getAttribute('type') || '',
                href: element.getAttribute('href') || '',
                'data-testid': element.getAttribute('data-testid') || '',
                // Add image-specific attributes
                alt: element.getAttribute('alt') || '',
                src: element.getAttribute('src') || '',
                // CSS information - Enhanced Phase 2 with comprehensive validation
                cssInfo: cssProps,
                // Position and size
                boundingRect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                },
                // NEW: Structured visual data for efficient frontend rendering
                visualData: {
                  type: (elementType === 'image' || cssProps.backgroundImage !== 'none') ? 'image' : 'css',
                  // Layout dimensions
                  layout: {
                    width: cssProps.width,
                    height: cssProps.height
                  },
                  // Color information
                  colors: {
                    backgroundColor: cssProps.backgroundColor,
                    color: cssProps.color,
                    borderColor: cssProps.border && cssProps.border !== 'none'
                      ? cssProps.border.split(' ').find(v => v.includes('rgb') || v.startsWith('#')) || 'transparent'
                      : 'transparent'
                  },
                  // Typography
                  typography: {
                    fontSize: cssProps.fontSize,
                    fontWeight: cssProps.fontWeight,
                    fontFamily: cssProps.fontFamily,
                    textAlign: cssProps.textAlign
                  },
                  // Spacing
                  spacing: {
                    padding: cssProps.padding,
                    margin: cssProps.margin
                  },
                  // Borders and shape
                  borders: {
                    border: cssProps.border,
                    borderRadius: cssProps.borderRadius
                  },
                  // Visual effects
                  effects: {
                    boxShadow: cssProps.boxShadow,
                    opacity: cssProps.opacity
                  },
                  // Text content for rendering
                  content: {
                    innerText: element.textContent?.trim() || ''
                  }
                }
              }
            };

            // Mark interactive elements for screenshot capture (buttons, inputs, links, forms, images)
            const interactiveTypes = ['button', 'input', 'link', 'form', 'image'];
            const hasBackgroundImage = cssProps.backgroundImage !== 'none';
            if (interactiveTypes.includes(elementType) || hasBackgroundImage) {
              detectedElement.needsScreenshot = true;
            }

            extractedElements.push(detectedElement);
          } catch (error) {
            console.error('Error processing element:', error);
          }
          processedCount++;
        });
        
        console.log(`🔄 Processed ${processedCount} elements, ${extractedElements.length} added to results`);
        
        if (extractedElements.length === 0) {
          console.error('❌ CRITICAL: No elements passed filtering! All elements were filtered out.');
          if (allElements.size > 0) {
            console.error('❌ This suggests the filtering logic is too restrictive for this page.');
          }
        }
        
        // Post-process to ensure all selectors are unique
        const uniqueSelectors = new Set<string>();
        const finalElements = extractedElements.map((element, index) => {
          let selector = element.selector;
          let counter = 1;
          
          // If selector is not unique, modify it
          while (uniqueSelectors.has(selector)) {
            // Try adding an index suffix
            if (selector.includes(':nth-of-type(')) {
              // Already has nth-of-type, increment it
              selector = selector.replace(/:nth-of-type\(\d+\)/, `:nth-of-type(${counter + 1})`);
            } else if (selector.includes(':nth-child(')) {
              // Already has nth-child, increment it
              selector = selector.replace(/:nth-child\(\d+\)/, `:nth-child(${counter + 1})`);
            } else {
              // Add nth-of-type to make it unique
              selector = `${selector}:nth-of-type(${counter + 1})`;
            }
            counter++;
          }
          
          uniqueSelectors.add(selector);
          return {
            ...element,
            selector: selector
          };
        });
        
        console.log(`✅ Final result: ${finalElements.length} elements ready for return`);
        console.log('🏁 === BROWSER CONTEXT ELEMENT EXTRACTION COMPLETE ===');
        
        return finalElements;
      });

    // ADVANCED SELECTOR GENERATION: Regenerate selectors using advanced service (Node context)
    console.log('🎯 Regenerating selectors using Advanced Selector Service...');

    // Re-evaluate in browser context to get element references for selector generation
    const elementsWithAdvancedSelectors = await page.evaluate((elementsData) => {
      const results = [];

      for (const elementData of elementsData) {
        try {
          // Try to find the element using the old selector
          let element: Element | null = null;

          // Try multiple selector strategies to find the element
          if (elementData.selector) {
            // Handle Playwright-native selectors (getByRole, getByText, etc.)
            if (elementData.selector.startsWith('getBy')) {
              // For Playwright-native, fall back to basic selectors from attributes
              if (elementData.attributes?.id) {
                element = document.querySelector(`#${elementData.attributes.id}`);
              } else if (elementData.attributes?.['data-testid']) {
                element = document.querySelector(`[data-testid="${elementData.attributes['data-testid']}"]`);
              }
            } else {
              // CSS selector - try directly
              try {
                const matches = document.querySelectorAll(elementData.selector);
                if (matches.length === 1) {
                  element = matches[0];
                } else if (matches.length > 1) {
                  // Multiple matches - try to find by position/text
                  for (const match of Array.from(matches)) {
                    if (match.textContent?.trim() === elementData.text) {
                      element = match;
                      break;
                    }
                  }
                  if (!element) element = matches[0]; // Fallback to first
                }
              } catch (e) {
                // Selector invalid
              }
            }
          }

          if (!element) {
            // Fallback: try to find by attributes
            if (elementData.attributes) {
              const attrs = elementData.attributes;
              if (attrs.id) {
                element = document.getElementById(attrs.id);
              } else if (attrs['data-testid']) {
                element = document.querySelector(`[data-testid="${attrs['data-testid']}"]`);
              } else if (attrs.name) {
                element = document.querySelector(`[name="${attrs.name}"]`);
              }
            }
          }

          if (element) {
            // Element found - extract comprehensive data for advanced selector generation
            results.push({
              ...elementData,
              elementData: {
                tagName: element.tagName.toLowerCase(),
                id: element.id,
                className: element.className,
                textContent: element.textContent?.trim() || '',
                innerHTML: element.innerHTML,
                attributes: {
                  'data-testid': element.getAttribute('data-testid'),
                  'data-test': element.getAttribute('data-test'),
                  'aria-label': element.getAttribute('aria-label'),
                  'aria-checked': element.getAttribute('aria-checked'),
                  'aria-selected': element.getAttribute('aria-selected'),
                  'aria-expanded': element.getAttribute('aria-expanded'),
                  'aria-pressed': element.getAttribute('aria-pressed'),
                  'aria-disabled': element.getAttribute('aria-disabled'),
                  'aria-hidden': element.getAttribute('aria-hidden'),
                  'role': element.getAttribute('role'),
                  'type': element.getAttribute('type'),
                  'name': element.getAttribute('name'),
                  'placeholder': element.getAttribute('placeholder'),
                  'title': element.getAttribute('title'),
                  'disabled': element.getAttribute('disabled'),
                  'readonly': element.getAttribute('readonly'),
                  'checked': element.getAttribute('checked'),
                  'selected': element.getAttribute('selected'),
                  'robotId': element.getAttribute('robotId'),
                  'data-robotid': element.getAttribute('data-robotid'),
                  'data-state': element.getAttribute('data-state'),
                  'data-status': element.getAttribute('data-status')
                },
                computedStyle: {
                  display: window.getComputedStyle(element).display,
                  visibility: window.getComputedStyle(element).visibility,
                  opacity: window.getComputedStyle(element).opacity
                },
                isVisible: (element as HTMLElement).offsetParent !== null,
                parentId: element.parentElement?.id,
                parentRole: element.parentElement?.getAttribute('role'),
                parentTagName: element.parentElement?.tagName.toLowerCase(),
                siblingCount: element.parentElement?.children.length || 0,
                childrenCount: element.children.length,
                firstChildTag: element.children[0]?.tagName.toLowerCase(),
                hasClickHandler: !!((element as any).onclick || element.getAttribute('onclick'))
              }
            });
          } else {
            // Element not found - keep original
            results.push(elementData);
          }
        } catch (error) {
          // Error - keep original element
          results.push(elementData);
        }
      }

      return results;
    }, extractedElements);

    // Now generate advanced selectors in Node context
    for (let i = 0; i < elementsWithAdvancedSelectors.length; i++) {
      const element = elementsWithAdvancedSelectors[i];

      if (element.elementData) {
        try {
          // Create mock element and document for advanced selector service
          const mockElement = this.createMockElement(element.elementData);
          const mockDocument = this.createMockDocument(elementsWithAdvancedSelectors);

          // Generate selectors using advanced service
          // Type assertions needed: Mock objects implement BrowserElement/BrowserDocument via index signatures
          const generatedSelectors = this.advancedSelectorService.generateSelectors({
            element: mockElement as unknown as import('../browser/strategies/selector-strategy.interface').BrowserElement,
            document: mockDocument as unknown as import('../browser/strategies/selector-strategy.interface').BrowserDocument,
            prioritizeUniqueness: true,
            includePlaywrightSpecific: false, // Use CSS selectors only (not Playwright locators)
            testableElementsOnly: false, // We already filtered
            allElements: elementsWithAdvancedSelectors as unknown as import('../browser/strategies/selector-strategy.interface').BrowserElement[]
          });

          if (generatedSelectors && generatedSelectors.length > 0) {
            // Use best selector
            const bestSelector = generatedSelectors.find(s => s.isUnique) || generatedSelectors[0];
            element.selector = bestSelector.selector;

            // Store fallback selectors
            element.fallbackSelectors = generatedSelectors.slice(1, 6).map(s => s.selector);

            // Store quality metrics
            element.selectorQuality = {
              confidence: bestSelector.confidence,
              type: bestSelector.type,
              isUnique: bestSelector.isUnique,
              isPlaywrightOptimized: bestSelector.isPlaywrightOptimized,
              description: bestSelector.description
            };

            console.log(`✅ Generated advanced selector for ${element.elementType}: ${bestSelector.selector} (confidence: ${bestSelector.confidence})`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to generate advanced selector for element, keeping original:`, error.message);
        }
      }
    }

    // Replace extractedElements with enhanced version
    extractedElements = elementsWithAdvancedSelectors;

    console.log(`✅ Advanced selector generation complete - ${extractedElements.length} elements enhanced`);

    // Capture thumbnails for interactive elements (3x parallel for speed)
    const elementsNeedingScreenshots = extractedElements.filter(el => el.needsScreenshot);
    const totalCount = elementsNeedingScreenshots.length;

    if (totalCount > 0) {
      console.log(`📸 Capturing ${totalCount} element screenshots (3x parallel)...`);

      const BATCH_SIZE = 3;
      let capturedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < totalCount; i += BATCH_SIZE) {
        const batch = elementsNeedingScreenshots.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalCount / BATCH_SIZE);

        console.log(`📸 Batch ${batchNum}/${totalBatches} (${batch.length} elements)...`);

        await Promise.all(batch.map(async (element) => {
          try {
            const thumbnail = await this.screenshotService.captureElementScreenshotFromPage(
              page,
              element.selector,
              true // thumbnail mode (JPEG, quality 70)
            );

            if (thumbnail) {
              // Update visualData
              if (element.attributes?.visualData) {
                element.attributes.visualData.thumbnailBase64 = thumbnail;
                element.attributes.visualData.type = 'image';
              }
              // Backward compatibility
              element.screenshot = thumbnail;
              capturedCount++;
            } else {
              failedCount++;
            }
          } catch (error) {
            console.error(`⚠️ Screenshot failed for ${element.selector}:`, error.message);
            failedCount++;
          }
          // Clean up temporary flag
          delete element.needsScreenshot;
        }));
      }

      console.log(`✅ Screenshots complete: ${capturedCount} captured, ${failedCount} failed`);
    } else {
      console.log('📸 No elements need screenshots');
    }
    return extractedElements;
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
      const pageTitle = await this.extractIntelligentPageTitle(page, url);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      
      await this.browserManager.closeBrowser(browser);
      
      return { title: pageTitle, description };
    } catch (error) {
      await this.browserManager.closeBrowser(browser);
      
      // Generate user-friendly fallback title from URL
      const fallbackTitle = this.generateFallbackTitle(url);
      return { title: fallbackTitle };
    }
  }

  // Enhanced intelligent page title extraction
  private async extractIntelligentPageTitle(page: Page, url: string): Promise<string> {
    try {
      // Strategy 1: Get document title
      const documentTitle = await page.title();
      console.log(`📄 Document title: "${documentTitle}"`);
      
      // Strategy 2: Try multiple title sources in order of preference
      const titleSources = [
        'meta[property="og:title"]',           // Open Graph title
        'meta[name="twitter:title"]',         // Twitter Card title
        'h1',                                 // Main heading
        '.page-title, .title, .heading',     // Common title classes
        'header h1, header h2',              // Header titles
        'meta[name="title"]'                 // Meta title tag
      ];
      
      let bestTitle = documentTitle;
      
      for (const selector of titleSources) {
        try {
          const element = await page.locator(selector).first();
          const text = await element.textContent({ timeout: 1000 });
          
          if (text && text.trim() && text.trim().length > 0) {
            const cleanText = text.trim();
            console.log(`📋 Found title from ${selector}: "${cleanText}"`);
            
            // Prefer more specific titles over generic ones
            if (this.isBetterTitle(cleanText, bestTitle)) {
              bestTitle = cleanText;
            }
          }
        } catch (e) {
          // Continue to next strategy
        }
      }
      
      // Clean and improve the final title
      const cleanedTitle = this.cleanPageTitle(bestTitle, url);
      console.log(`✨ Final cleaned title: "${cleanedTitle}"`);
      
      return cleanedTitle;
      
    } catch (error) {
      console.error('Error extracting intelligent page title:', error);
      return this.generateFallbackTitle(url);
    }
  }
  
  // Determine if a new title is better than the current best title
  private isBetterTitle(newTitle: string, currentTitle: string): boolean {
    if (!currentTitle || currentTitle.trim().length === 0) return true;
    if (!newTitle || newTitle.trim().length === 0) return false;
    
    const current = currentTitle.toLowerCase();
    const candidate = newTitle.toLowerCase();
    
    // Prefer titles that are not too generic
    const genericWords = ['page', 'home', 'welcome', 'untitled', 'document', 'index'];
    const currentIsGeneric = genericWords.some(word => current.includes(word));
    const candidateIsGeneric = genericWords.some(word => candidate.includes(word));
    
    if (currentIsGeneric && !candidateIsGeneric) return true;
    if (!currentIsGeneric && candidateIsGeneric) return false;
    
    // Prefer shorter, more concise titles (but not too short)
    if (candidate.length >= 5 && candidate.length < current.length && current.length > 50) {
      return true;
    }
    
    return false;
  }
  
  // Clean and improve page title for better user experience
  private cleanPageTitle(title: string, url: string): string {
    if (!title || title.trim().length === 0) {
      return this.generateFallbackTitle(url);
    }
    
    let cleaned = title.trim();
    
    // Remove common site name patterns (e.g., "Page Title - Site Name" -> "Page Title")
    const patterns = [
      /\s*[-|–—]\s*[^-|–—]*$/,           // Remove " - Site Name" suffix
      /\s*\|\s*[^|]*$/,                  // Remove " | Site Name" suffix
      /\s*::\s*[^:]*$/,                  // Remove " :: Site Name" suffix
      /\s*•\s*[^•]*$/,                   // Remove " • Site Name" suffix
    ];
    
    for (const pattern of patterns) {
      const shortened = cleaned.replace(pattern, '');
      if (shortened.length >= 3 && shortened.length < cleaned.length) {
        cleaned = shortened.trim();
        break; // Only apply one pattern
      }
    }
    
    // Capitalize first letter if needed
    if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
      cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
    }
    
    // Limit length for UI purposes
    if (cleaned.length > 60) {
      cleaned = cleaned.substring(0, 57) + '...';
    }
    
    return cleaned;
  }
  
  // Generate user-friendly fallback title from URL
  private generateFallbackTitle(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      // Extract page name from path
      if (pathname && pathname !== '/') {
        const pathParts = pathname.split('/').filter(part => part.length > 0);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          
          // Convert URL-friendly names to readable titles
          const readable = lastPart
            .replace(/[-_]/g, ' ')           // Replace hyphens/underscores with spaces
            .replace(/\.(html?|php|jsp|asp)$/i, '') // Remove file extensions
            .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize words
            .trim();
          
          if (readable.length > 2) {
            return `${readable} - ${this.getReadableHostname(hostname)}`;
          }
        }
      }
      
      // Default fallback based on hostname
      return this.getReadableHostname(hostname);
      
    } catch (error) {
      return 'Web Page';
    }
  }
  
  // Convert hostname to readable format
  private getReadableHostname(hostname: string): string {
    // Remove www prefix
    const cleaned = hostname.replace(/^www\./, '');
    
    // Capitalize the domain name (before TLD)
    const parts = cleaned.split('.');
    if (parts.length >= 2) {
      const domain = parts[0];
      const tld = parts.slice(1).join('.');
      
      // Convert domain to readable format
      const readable = domain
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      return `${readable} (${tld})`;
    }
    
    return cleaned;
  }

  // Method for extracting elements from authenticated pages (used by authentication service)
  // NOW USES FULL COMPREHENSIVE SELECTOR SYSTEM (same as main analysis)
  async extractElementsFromAuthenticatedPage(page: Page): Promise<DetectedElement[]> {
    console.log('🔍 Extracting elements from authenticated page with comprehensive selectors...');

    try {
      // Use the SAME comprehensive system as main analysis to avoid 0 elements issue
      console.log('🔄 Calling extractAllPageElements for authenticated page...');
      const result = await this.extractAllPageElements(page);
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
    return await this.analyzePage(url);
  }

  // Multiple URL analysis with authentication
  async analyzeAllUrlsWithAuth(
    urls: string[],
    authFlow: LoginFlow,
    progressCallback?: (step: string, message: string, current?: number, total?: number) => void
  ): Promise<MultiUrlAnalysisResult> {
    console.log(`🔐 Analyzing ${urls.length} URLs with auth flow`);

    const urlResults: UrlAnalysisResult[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        if (progressCallback) {
          progressCallback('analyzing', `Analyzing ${url}`, i + 1, urls.length);
        }

        const result = await this.analyzePage(url);
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

  // Element screenshot capture - delegate to ScreenshotService
  async captureElementScreenshot(url: string, selector: string): Promise<string | null> {
    return this.screenshotService.captureElementScreenshot(url, selector);
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
      const elements = await this.extractAllPageElements(page);

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

  /**
   * Create a mock element object for advanced selector generation
   */
  private createMockElement(elementData: MockElementData): MockElement {
    // Helper to create empty mock element list
    const emptyList = (): MockElementList => {
      const arr: MockElement[] = [];
      return Object.assign(arr, {
        item: (index: number) => arr[index] || null,
        forEach: (cb: (el: MockElement, i: number) => void) => arr.forEach(cb)
      }) as MockElementList;
    };

    return {
      tagName: elementData.tagName?.toUpperCase() || '',
      id: elementData.id || '',
      className: elementData.className || '',
      textContent: elementData.textContent || '',
      innerHTML: elementData.innerHTML || '',
      getAttribute: (name: string) => elementData.attributes?.[name] || null,
      hasAttribute: (name: string) => !!(elementData.attributes?.[name]),
      setAttribute: () => {}, // No-op for mock
      querySelectorAll: () => emptyList(), // Simple mock - returns empty list
      parentElement: elementData.parentId || elementData.parentTagName ? {
        id: elementData.parentId,
        tagName: elementData.parentTagName?.toUpperCase(),
        getAttribute: (name: string) => {
          if (name === 'role') return elementData.parentRole || null;
          return null;
        },
        children: { length: elementData.siblingCount || 0 },
        className: ''
      } : null,
      children: { length: elementData.childrenCount || 0, 0: elementData.firstChildTag ? { tagName: elementData.firstChildTag.toUpperCase() } : null },
      offsetParent: elementData.isVisible ? {} : null,
      onclick: elementData.hasClickHandler ? () => {} : null,
      style: {
        cursor: elementData.hasClickHandler ? 'pointer' : 'auto',
        display: elementData.computedStyle?.display || 'block',
        visibility: elementData.computedStyle?.visibility || 'visible',
        opacity: elementData.computedStyle?.opacity || '1'
      },
      getBoundingClientRect: () => ({
        x: 0,
        y: 0,
        width: elementData.isVisible ? 100 : 0,
        height: elementData.isVisible ? 30 : 0,
        top: 0,
        left: 0,
        right: 100,
        bottom: 30
      }),
      closest: (selector: string) => {
        // Simple mock - check if parent matches
        if (selector === 'nav' || selector === '[role="navigation"]') {
          return elementData.parentRole === 'navigation' || elementData.parentTagName === 'nav' ? {} : null;
        }
        return null;
      },
      attributes: Object.keys(elementData.attributes || {}).map(name => ({
        name,
        value: elementData.attributes?.[name] || null
      })),
      previousElementSibling: null,
      nextElementSibling: null
    };
  }

  /**
   * Create a mock document object for selector uniqueness testing
   */
  private createMockDocument(allElements: MockElementWrapper[]): MockDocument {
    // Helper to convert array to MockElementList
    const toElementList = (arr: MockElement[]): MockElementList => {
      return Object.assign(arr, {
        item: (index: number) => arr[index] || null,
        forEach: (cb: (el: MockElement, i: number) => void) => arr.forEach(cb)
      }) as MockElementList;
    };

    const querySelectorAllImpl = (selector: string): MockElementList => {
      // Simple mock - try to match elements by basic selectors
      const matches: MockElement[] = [];

      for (const el of allElements) {
        if (!el.elementData) continue;

        let isMatch = false;

        // ID selector
        if (selector.startsWith('#')) {
          const id = selector.slice(1);
          if (el.elementData.id === id) isMatch = true;
        }
        // Class selector
        else if (selector.startsWith('.')) {
          const className = selector.slice(1);
          if (el.elementData.className?.includes(className)) isMatch = true;
        }
        // Attribute selector
        else if (selector.includes('[')) {
          const attrMatch = selector.match(/\[([^=\]]+)(?:="([^"]+)")?\]/);
          if (attrMatch) {
            const [, attrName, attrValue] = attrMatch;
            const elAttrValue = el.elementData.attributes?.[attrName];
            if (attrValue) {
              if (elAttrValue === attrValue) isMatch = true;
            } else {
              if (elAttrValue !== null && elAttrValue !== undefined) isMatch = true;
            }
          }
        }
        // Tag selector
        else if (selector.match(/^[a-z]+$/)) {
          if (el.elementData.tagName === selector) isMatch = true;
        }

        if (isMatch) {
          matches.push(this.createMockElement(el.elementData));
        }
      }

      return toElementList(matches);
    };

    return {
      querySelectorAll: querySelectorAllImpl,
      querySelector: (selector: string): MockElement | null => {
        const matches = querySelectorAllImpl(selector);
        return matches.length > 0 ? matches[0] : null;
      },
      getElementById: (id: string): MockElement | null => {
        for (const el of allElements) {
          if (el.elementData?.id === id) {
            return this.createMockElement(el.elementData);
          }
        }
        return null;
      }
    };
  }
}