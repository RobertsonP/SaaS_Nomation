import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import { AiService } from './ai.service';
import { DetectedElement, PageAnalysisResult, SelectorValidationResult, QualityMetrics } from './interfaces/element.interface';

@Injectable()
export class ElementAnalyzerService {
  constructor(private aiService: AiService) {}

  async analyzePage(url: string): Promise<PageAnalysisResult> {
    const browser = await this.setupBrowser();
    const page = await browser.newPage();
    
    try {
      console.log(`Analyzing page: ${url}`);
      
      // Navigate to the page and wait for content to load
      await this.navigateToPage(page, url);
      
      // Enhanced element extraction with CSS information
      const elements = await this.extractAllPageElements(page);
      
      console.log(`Found ${elements.length} elements with enhanced data`);
      
      await this.closeBrowser(browser);
      
      return {
        url,
        elements,
        analysisDate: new Date(),
        success: true
      };
    } catch (error) {
      await this.closeBrowser(browser);
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
  private async extractAllPageElements(page: any): Promise<any[]> {
    console.log('🔄 Starting extractAllPageElements - entering page.evaluate()...');
    
    return await page.evaluate(() => {
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
            
            // Determine if element is potentially interactive
            const isInteractiveElement = [
              'input', 'textarea', 'select', 'button', 'a', 'label', 'option'
            ].includes(tagName);
            
            const hasInteractiveAttributes = element.hasAttribute('onclick') ||
              element.hasAttribute('onchange') || element.hasAttribute('tabindex') ||
              element.hasAttribute('role') || element.hasAttribute('aria-label') ||
              element.hasAttribute('data-testid');
              
            const hasInteractiveRole = element.getAttribute('role') && [
              'button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab', 'option'
            ].includes(element.getAttribute('role'));
            
            const isClickable = element.hasAttribute('onclick') || 
              (element as HTMLElement).style?.cursor === 'pointer' ||
              computedStyle.cursor === 'pointer';
              
            const hasText = element.textContent && element.textContent.trim().length > 0;
            
            // Enhanced permissive filtering - include more element types for better discovery
            const shouldInclude = 
              isInteractiveElement ||
              hasInteractiveAttributes ||
              hasInteractiveRole ||
              isClickable ||
              (hasText && tagName !== 'script' && tagName !== 'style' && tagName !== 'noscript') ||
              tagName === 'img' ||
              tagName === 'iframe' ||
              tagName === 'form' ||
              tagName === 'video' ||
              tagName === 'audio' ||
              tagName === 'canvas' ||
              tagName === 'svg' ||
              // Include structural elements that might be clickable
              (tagName === 'div' && (element.hasAttribute('onclick') || 
                                     element.hasAttribute('data-testid') ||
                                     element.hasAttribute('data-test') ||
                                     element.hasAttribute('role') ||
                                     element.className.includes('btn') ||
                                     element.className.includes('button') ||
                                     element.className.includes('click') ||
                                     element.className.includes('link'))) ||
              // Include navigation elements
              (tagName === 'nav' || element.closest('nav') !== null) ||
              // Include list items that might be clickable
              (tagName === 'li' && (element.hasAttribute('onclick') || 
                                   element.querySelector('a') !== null ||
                                   element.className.includes('menu') ||
                                   element.className.includes('item'))) ||
              // Include headers if they have interactive properties
              (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) && 
               (element.hasAttribute('onclick') || element.hasAttribute('data-testid'))) ||
              // Include spans and divs with specific patterns (modern frameworks)
              ((tagName === 'span' || tagName === 'div') && 
               (element.hasAttribute('data-') || element.className.match(/\b(component|widget|control|action)\b/i)));
            
            if (!shouldInclude) {
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
              
              // 1. ID selector (highest priority)
              if (el.id && el.id.trim() !== '') {
                const idSelector = `#${escapeCSSSelector(el.id)}`;
                if (testUniqueness(idSelector)) {
                  return idSelector;
                }
              }
              
              // 2. data-testid (testing-specific attributes)
              const testId = el.getAttribute('data-testid');
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
              
              // 4. aria-label (accessibility attributes)
              const ariaLabel = el.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.trim() !== '') {
                const ariaSelector = `[aria-label="${escapeCSSSelector(ariaLabel)}"]`;
                if (testUniqueness(ariaSelector)) {
                  return ariaSelector;
                }
              }
              
              // 5. Combination of tag + type + specific attributes
              const tagName = el.tagName.toLowerCase();
              const type = el.getAttribute('type');
              
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
              
              // 9. Text content-based selectors (for elements with unique text)
              const textContent = el.textContent?.trim() || '';
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
              
              // Text elements
              if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'text';
              if (tagName === 'p' || tagName === 'span' || tagName === 'div' && el.textContent?.trim()) return 'text';
              
              return 'element';
            };
            
            // Generate description - enhanced for form elements
            const getDescription = (el: Element): string => {
              const text = el.textContent?.trim() || '';
              const ariaLabel = el.getAttribute('aria-label') || '';
              const placeholder = el.getAttribute('placeholder') || '';
              const title = el.getAttribute('title') || '';
              const name = el.getAttribute('name') || '';
              const id = el.getAttribute('id') || '';
              const type = el.getAttribute('type') || '';
              const tagName = el.tagName.toLowerCase();
              
              // For form elements, try to build a meaningful description
              if (['input', 'textarea', 'select'].includes(tagName)) {
                if (ariaLabel) return ariaLabel;
                if (placeholder) return `${placeholder} (${type || tagName})`;
                if (name) return `${name} ${type || tagName}`;
                if (id) return `${id} ${type || tagName}`;
                if (type) return `${type} input`;
                return `${tagName} field`;
              }
              
              // For labels, try to find what they're labeling
              if (tagName === 'label') {
                const forAttr = el.getAttribute('for');
                if (forAttr) return `Label for ${forAttr}`;
                if (text) return `Label: ${text.slice(0, 30)}`;
                return 'Label';
              }
              
              // For buttons, use text or type
              if (tagName === 'button' || type === 'submit' || type === 'button') {
                if (text) return `${text.slice(0, 30)} button`;
                if (type === 'submit') return 'Submit button';
                return 'Button';
              }
              
              // Default logic for other elements
              return ariaLabel || text.slice(0, 50) || placeholder || title || `${tagName} element`;
            };
            
            extractedElements.push({
              selector: generateSelector(element, Array.from(allElements)),
              elementType: getElementType(element),
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
                // CSS information - Enhanced Phase 2 with comprehensive validation
                cssInfo: extractValidatedCSSProperties(element, computedStyle),
                // Position and size
                boundingRect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              }
            });
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
  }

  /**
   * Setup browser with optimal configuration for element analysis
   */
  private async setupBrowser() {
    console.log('🚀 Setting up browser with enhanced configuration for slow sites...');
    
    const browser = await chromium.launch({ 
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
        '--disable-images', // Skip images for faster loading in analysis
        '--disable-javascript-harmony-shipping',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps'
      ]
    });
    
    console.log('✅ Browser setup complete');
    return browser;
  }

  /**
   * Navigate to page and wait for content to load with enhanced loading strategies
   */
  private async navigateToPage(page: any, url: string) {
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
              const checkReady = () => {
                if (document.readyState === 'complete') {
                  resolve(true);
                } else {
                  setTimeout(checkReady, 100);
                }
              };
              checkReady();
            }
          });
        });
        console.log(`📋 Document ready state complete for ${url}`);
        
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
    
    // Stage 2: Check for common loading indicators and wait for them to disappear
    try {
      await page.waitForFunction(() => {
        const loadingSelectors = [
          '.loading', '.loader', '.spinner', '.preloader',
          '[data-loading]', '[data-testid="loading"]',
          '.fa-spinner', '.fa-circle-o-notch'
        ];
        
        for (const selector of loadingSelectors) {
          const element = document.querySelector(selector);
          if (element && window.getComputedStyle(element).display !== 'none') {
            return false; // Still loading
          }
        }
        return true; // No visible loading indicators
      }, {}, { timeout: 5000 });
      console.log(`🎯 Loading indicators cleared for ${url}`);
    } catch (indicatorError) {
      console.log(`⏰ Loading indicator wait timeout - proceeding: ${indicatorError.message}`);
    }
    
    // Stage 3: Wait for images to load
    try {
      await page.waitForFunction(() => {
        const images = document.querySelectorAll('img');
        return Array.from(images).every(img => img.complete || img.naturalWidth > 0);
      }, {}, { timeout: 3000 });
      console.log(`🖼️ Images loaded for ${url}`);
    } catch (imageError) {
      console.log(`📷 Image load timeout - proceeding: ${imageError.message}`);
    }
    
    // Stage 4: Final stabilization wait
    await page.waitForTimeout(1000);
    
    console.log(`🏁 Navigation and content loading complete for ${url}`);
  }

  /**
   * Properly close browser instance
   */
  private async closeBrowser(browser: any) {
    await browser.close();
  }

  // Phase 2: Enhanced selector validation with comprehensive metrics
  async validateSelector(url: string, selector: string): Promise<SelectorValidationResult> {
    const browser = await this.setupBrowser();
    const page = await browser.newPage();
    
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
      const qualityBreakdown = this.calculateEnhancedSelectorQuality(selector, elementCount, elementHandle);
      
      // Generate enhanced suggestions
      const suggestions = this.generateEnhancedSelectorSuggestions(selector, elementCount, qualityBreakdown);
      
      // Generate alternative selectors if not unique
      const alternativeSelectors = elementCount !== 1 ? 
        await this.generateAlternativeSelectors(page, selector, elementHandle) : [];
      
      await this.closeBrowser(browser);
      
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
      await this.closeBrowser(browser);
      
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
      const browser = await this.setupBrowser();

      for (const url of urls) {
        try {
          const page = await browser.newPage();
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

      await this.closeBrowser(browser);

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
      const qualityBreakdown = this.calculateEnhancedSelectorQuality(
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


  // Phase 2: Enhanced quality scoring with comprehensive metrics
  private calculateEnhancedSelectorQuality(selector: string, elementCount: number, elementHandle?: any): QualityMetrics {
    // Calculate uniqueness score (40% weight)
    const uniquenessScore = this.calculateUniquenessScore(selector, elementCount);
    
    // Calculate stability score (30% weight)
    const stabilityScore = this.calculateStabilityScore(selector);
    
    // Calculate specificity score (20% weight)
    const specificityScore = this.calculateSpecificityScore(selector);
    
    // Calculate accessibility score (10% weight)
    const accessibilityScore = this.calculateAccessibilityScore(selector, elementHandle);
    
    // Calculate weighted overall score
    const overall = (
      uniquenessScore * 0.4 +
      stabilityScore * 0.3 +
      specificityScore * 0.2 +
      accessibilityScore * 0.1
    );
    
    return {
      uniqueness: uniquenessScore,
      stability: stabilityScore,
      specificity: specificityScore,
      accessibility: accessibilityScore,
      overall: Math.max(0, Math.min(1, overall))
    };
  }
  
  private calculateUniquenessScore(selector: string, elementCount: number): number {
    if (elementCount === 0) return 0;
    if (elementCount === 1) return 1.0; // Perfect uniqueness
    if (elementCount <= 3) return 0.7;  // Good uniqueness
    if (elementCount <= 10) return 0.4; // Fair uniqueness
    return 0.1; // Poor uniqueness
  }
  
  private calculateStabilityScore(selector: string): number {
    let score = 0.5; // Base score
    
    // High stability attributes
    if (selector.includes('[data-testid=') || selector.includes('data-testid=')) {
      score += 0.5; // Most stable
    } else if (selector.includes('[data-test') || selector.includes('[data-cy') || selector.includes('[data-e2e')) {
      score += 0.45; // Very stable test attributes
    } else if (selector.includes('[aria-label=') || selector.includes('aria-label=')) {
      score += 0.4; // Stable accessibility attributes
    } else if (selector.includes('[id=') || selector.includes('#') && !selector.includes('nth-')) {
      score += 0.35; // Stable if unique ID
    } else if (selector.includes('[role=') || selector.includes('role=')) {
      score += 0.3; // Semantic stability
    } else if (selector.includes('[name=') || selector.includes('name=')) {
      score += 0.25; // Moderately stable
    }
    
    // Stability penalties
    if (selector.includes('nth-child') || selector.includes('nth-of-type')) {
      score -= 0.3; // Position-based selectors are fragile
    }
    if (selector.includes(':first-child') || selector.includes(':last-child')) {
      score -= 0.2; // Position-based but less fragile
    }
    if (selector.split(' ').length > 4) {
      score -= 0.15; // Overly complex selectors
    }
    if (selector.includes('>>') || selector.includes('xpath=')) {
      score -= 0.2; // Complex or non-CSS selectors
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  private calculateSpecificityScore(selector: string): number {
    let score = 0.5; // Base score for balanced specificity
    
    const parts = selector.split(' ').filter(p => p.trim() !== '');
    const complexity = parts.length;
    
    // Optimal specificity range (2-3 parts)
    if (complexity >= 2 && complexity <= 3) {
      score += 0.3;
    } else if (complexity === 1) {
      score += 0.1; // Too general
    } else if (complexity > 3) {
      score -= 0.2; // Too specific
    }
    
    // Bonus for semantic specificity
    if (selector.includes('[type=') || selector.includes('input[')) {
      score += 0.2; // Good semantic specificity
    }
    
    // Penalty for overly broad selectors
    if (selector === 'div' || selector === 'span' || selector === 'a') {
      score -= 0.4; // Too broad
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  private calculateAccessibilityScore(selector: string, elementHandle?: any): number {
    let score = 0.3; // Base score
    
    // Accessibility attribute bonuses
    if (selector.includes('[aria-label=') || selector.includes('aria-label=')) {
      score += 0.4;
    }
    if (selector.includes('[aria-') || selector.includes('aria-')) {
      score += 0.3;
    }
    if (selector.includes('[role=') || selector.includes('role=')) {
      score += 0.3;
    }
    if (selector.includes('[alt=') || selector.includes('alt=')) {
      score += 0.2;
    }
    if (selector.includes('[title=') || selector.includes('title=')) {
      score += 0.1;
    }
    
    // Semantic element bonuses
    const semanticElements = ['button', 'input', 'textarea', 'select', 'a', 'form', 'label'];
    if (semanticElements.some(elem => selector.includes(elem))) {
      score += 0.2;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  // Backward compatibility method
  private calculateSelectorQuality(selector: string, elementCount: number): number {
    const metrics = this.calculateEnhancedSelectorQuality(selector, elementCount);
    return metrics.overall;
  }

  private generateSelectorSuggestions(selector: string, elementCount: number): string[] {
    const suggestions: string[] = [];
    
    if (elementCount === 0) {
      suggestions.push('Element not found - check if selector is correct');
      suggestions.push('Try using browser dev tools to inspect the element');
      suggestions.push('Consider using more specific attributes like data-testid');
    } else if (elementCount > 1) {
      suggestions.push(`${elementCount} elements match - consider adding more specific attributes`);
      suggestions.push('Use :first, :last, or :nth-child() to target specific element');
      suggestions.push('Add data-testid attribute to the target element for better uniqueness');
    } else {
      suggestions.push('Great! Selector finds exactly one element');
    }
    
    // General suggestions based on selector type
    if (selector.includes('nth-child')) {
      suggestions.push('Position-based selectors may break if page structure changes');
      suggestions.push('Consider using semantic attributes instead');
    }
    
    if (!selector.includes('[') && !selector.includes('#') && !selector.includes('.')) {
      suggestions.push('Consider using ID, class, or attribute selectors for better stability');
    }
    
    if (selector.split(' ').length > 3) {
      suggestions.push('Complex selectors may be fragile - try to simplify if possible');
    }
    
    return suggestions;
  }

  // Phase 2: Enhanced suggestion generation with quality metrics context
  private generateEnhancedSelectorSuggestions(selector: string, elementCount: number, qualityMetrics: QualityMetrics): string[] {
    const suggestions: string[] = [];
    
    // Uniqueness suggestions
    if (elementCount === 0) {
      suggestions.push('🔍 Element not found - verify selector syntax and element existence');
      suggestions.push('💡 Use browser dev tools to inspect and get the correct selector');
      if (qualityMetrics.accessibility < 0.5) {
        suggestions.push('♿ Consider using accessible attributes like aria-label or role');
      }
    } else if (elementCount > 1) {
      suggestions.push(`⚠️ ${elementCount} elements match - selector needs to be more specific`);
      if (qualityMetrics.uniqueness < 0.5) {
        suggestions.push('🎯 Add unique identifiers: data-testid, id, or specific attributes');
        suggestions.push('🔧 Use :first, :last, or :nth-child() as temporary solution');
      }
    } else {
      suggestions.push('✅ Perfect! Selector finds exactly one element');
    }
    
    // Stability suggestions
    if (qualityMetrics.stability < 0.6) {
      suggestions.push('⚡ Improve stability: use data-testid or semantic attributes');
      if (selector.includes('nth-child') || selector.includes('nth-of-type')) {
        suggestions.push('🏗️ Position-based selectors are fragile - use semantic attributes instead');
      }
      if (!selector.includes('[data-') && !selector.includes('[aria-')) {
        suggestions.push('🛡️ Add test-specific attributes for better reliability');
      }
    }
    
    // Specificity suggestions
    if (qualityMetrics.specificity < 0.5) {
      if (selector.split(' ').length > 4) {
        suggestions.push('🎛️ Selector is too complex - simplify for better maintainability');
      } else if (selector.split(' ').length === 1 && !selector.includes('[') && !selector.includes('#')) {
        suggestions.push('🔍 Selector is too broad - add more specific attributes');
      }
    }
    
    // Accessibility suggestions
    if (qualityMetrics.accessibility < 0.5) {
      suggestions.push('♿ Enhance accessibility: use aria-label, role, or semantic elements');
      suggestions.push('🏷️ Consider using form labels and semantic HTML elements');
    }
    
    // Overall quality suggestions
    if (qualityMetrics.overall < 0.6) {
      suggestions.push('📈 Overall quality is low - consider improving stability and uniqueness');
    } else if (qualityMetrics.overall >= 0.8) {
      suggestions.push('🌟 Excellent selector quality - this is test-automation ready!');
    }
    
    return suggestions;
  }

  // Phase 2: Generate alternative selectors for non-unique ones
  private async generateAlternativeSelectors(page: any, originalSelector: string, elementHandle: any): Promise<string[]> {
    if (!elementHandle) return [];
    
    try {
      // Extract element attributes to generate alternatives
      const alternatives = await page.evaluate((element) => {
        const suggestions: string[] = [];
        
        // Try ID-based selector
        if (element.id && element.id.trim() !== '') {
          suggestions.push(`#${element.id}`);
        }
        
        // Try data-testid selector
        const testId = element.getAttribute('data-testid');
        if (testId) {
          suggestions.push(`[data-testid="${testId}"]`);
        }
        
        // Try aria-label selector
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          suggestions.push(`[aria-label="${ariaLabel}"]`);
        }
        
        // Try name attribute
        const name = element.getAttribute('name');
        if (name) {
          suggestions.push(`${element.tagName.toLowerCase()}[name="${name}"]`);
        }
        
        // Try type + class combination
        const type = element.getAttribute('type');
        const className = element.className;
        if (type && className) {
          const firstClass = className.split(' ')[0];
          if (firstClass) {
            suggestions.push(`${element.tagName.toLowerCase()}[type="${type}"].${firstClass}`);
          }
        }
        
        // Try parent-child combinations
        const parent = element.parentElement;
        if (parent && parent.id) {
          suggestions.push(`#${parent.id} > ${element.tagName.toLowerCase()}`);
        }
        
        return suggestions;
      }, elementHandle);
      
      // Filter out alternatives that are the same as original
      return alternatives.filter(alt => alt !== originalSelector);
      
    } catch (error) {
      console.warn('Failed to generate alternative selectors:', error);
      return [];
    }
  }

  // Phase 2: Generate cross-page validation suggestions
  private generateCrossPageSuggestions(validation: any, selector: string): string[] {
    const suggestions: string[] = [];
    
    if (validation.validUrls === 0) {
      suggestions.push('❌ Selector not found on any project pages');
      suggestions.push('🔍 Verify selector exists across your application');
    } else if (validation.validUrls < validation.totalUrls) {
      suggestions.push(`⚠️ Selector only works on ${validation.validUrls}/${validation.totalUrls} pages`);
      suggestions.push('🌐 Consider using more universal selectors for cross-page consistency');
    }
    
    if (!validation.uniqueOnAllPages) {
      suggestions.push('🎯 Selector matches multiple elements on some pages');
      suggestions.push('🔧 Add more specific attributes to ensure uniqueness');
      if (validation.inconsistentPages.length > 0) {
        suggestions.push(`📋 Inconsistent pages: ${validation.inconsistentPages.slice(0, 3).join(', ')}`);
      }
    }
    
    if (validation.averageMatchCount > 3) {
      suggestions.push('📊 High average match count indicates selector is too broad');
    }
    
    if (validation.validationErrors.length > 0) {
      suggestions.push('🚨 Some pages had validation errors - check browser console');
    }
    
    if (validation.uniqueOnAllPages && validation.validUrls === validation.totalUrls) {
      suggestions.push('🎉 Perfect cross-page consistency! This selector is production-ready');
    }
    
    return suggestions;
  }

  async getPageMetadata(url: string): Promise<{ title: string; description?: string }> {
    const browser = await this.setupBrowser();
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      
      await this.closeBrowser(browser);
      
      return { title, description };
    } catch (error) {
      await this.closeBrowser(browser);
      return { title: 'Page Title' };
    }
  }

  // Method for extracting elements from authenticated pages (used by authentication service)
  // NOW USES FULL COMPREHENSIVE SELECTOR SYSTEM (same as main analysis)
  extractElementsFromAuthenticatedPage(page: any): Promise<any[]> {
    console.log('🔍 Extracting elements from authenticated page with comprehensive selectors...');
    
    try {
      // Use the SAME comprehensive system as main analysis to avoid 0 elements issue
      console.log('🔄 Calling extractAllPageElements for authenticated page...');
      const result = this.extractAllPageElements(page);
      console.log('✅ extractAllPageElements call completed for authenticated page');
      return result;
      
    } catch (error) {
      console.error('❌ Error extracting elements from authenticated page:', error);
      console.error('❌ Error stack:', error.stack);
      return Promise.resolve([]);
    }
  }

  // Enhanced error categorization for better debugging and user feedback
  categorizeAnalysisError(error: any, url: string): { category: 'NETWORK_ERROR' | 'TIMEOUT_ERROR' | 'AUTHENTICATION_ERROR' | 'JAVASCRIPT_ERROR' | 'BROWSER_ERROR' | 'ELEMENT_ANALYSIS_ERROR' | 'SSL_ERROR' | 'UNKNOWN_ERROR' | 'SLOW_SITE_TIMEOUT' | 'LOADING_TIMEOUT' | 'BOT_DETECTION'; message: string; details: any } {
    const errorMessage = error.message || error.toString();
    const lowerMessage = errorMessage.toLowerCase();
    
    // Timeout errors (most common for slow sites)
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      if (lowerMessage.includes('networkidle') || lowerMessage.includes('waiting until')) {
        return {
          category: 'SLOW_SITE_TIMEOUT',
          message: `Site loads too slowly (>30s): ${new URL(url).hostname} may have heavy content, ads, or slow CDN. Try again or contact site administrator.`,
          details: { 
            url, 
            error: errorMessage,
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
          details: { url, error: errorMessage }
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
          error: errorMessage,
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
        details: { url, error: errorMessage }
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
          error: errorMessage,
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
          error: errorMessage,
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
        details: { url, error: errorMessage }
      };
    }
    
    // Generic fallback
    return {
      category: 'UNKNOWN_ERROR',
      message: `Analysis failed for ${new URL(url).hostname}: ${errorMessage}`,
      details: { 
        url, 
        error: errorMessage,
        suggestions: [
          'Try analyzing the page again',
          'Check browser console for detailed errors',
          'Contact support if the issue persists'
        ]
      }
    };
  }

  // Authentication-aware page analysis
  async analyzePageWithAuth(url: string, authFlow: any): Promise<PageAnalysisResult> {
    console.log(`🔐 Analyzing page with auth: ${url}`);
    return await this.analyzePage(url);
  }

  // Multiple URL analysis with authentication
  async analyzeAllUrlsWithAuth(urls: string[], authFlow: any, progressCallback?: (step: string, message: string, current?: number, total?: number) => void): Promise<any> {
    console.log(`🔐 Analyzing ${urls.length} URLs with auth flow`);
    
    const urlResults = [];
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
        urlResults.push({
          url,
          elements: [],
          success: false,
          errorMessage: error.message
        });
      }
    }
    
    return {
      success: true,
      urlResults,
      authenticationUsed: true
    };
  }

  // Element screenshot capture
  async captureElementScreenshot(url: string, selector: string): Promise<string | null> {
    console.log(`📸 Capturing screenshot for element: ${selector} on ${url}`);
    
    const browser = await this.setupBrowser();
    const page = await browser.newPage();
    
    try {
      await this.navigateToPage(page, url);
      
      const element = page.locator(selector).first();
      const screenshot = await element.screenshot({ type: 'png' });
      
      await this.closeBrowser(browser);
      
      return `data:image/png;base64,${screenshot.toString('base64')}`;
      
    } catch (error) {
      console.error(`❌ Failed to capture screenshot: ${error.message}`);
      await this.closeBrowser(browser);
      return null;
    }
  }

  async huntElementsAfterSteps(config: {
    startingUrl: string;
    steps: any[];
    projectId: string;
    testId: string;
  }): Promise<DetectedElement[]> {
    console.log(`🔍 Starting element hunting after executing ${config.steps.length} test steps`);
    
    let browser = null;
    try {
      browser = await this.setupBrowser();
      const page = await browser.newPage();
      
      // Set desktop viewport and navigate to starting URL (matches live-browser.service.ts)
      await page.setViewportSize({ width: 1920, height: 1080 });
      console.log(`🌐 Navigating to: ${config.startingUrl}`);
      await page.goto(config.startingUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Execute each test step to reach the final state
      console.log(`⚡ Executing ${config.steps.length} test steps...`);
      for (let i = 0; i < config.steps.length; i++) {
        const step = config.steps[i];
        console.log(`  Step ${i + 1}/${config.steps.length}: ${step.type} on ${step.selector}`);
        
        try {
          await this.executeTestStep(page, step);
          // Small delay between steps for stability
          await page.waitForTimeout(500);
        } catch (stepError) {
          console.warn(`⚠️ Step ${i + 1} failed: ${stepError.message}`);
          // Continue with remaining steps even if one fails
        }
      }
      
      console.log(`✅ Completed test step execution. Now discovering elements in final state...`);
      
      // Wait for page to stabilize after all interactions
      await page.waitForTimeout(1000);
      
      // Discover elements in the final state using existing method
      const elements = await this.extractAllPageElements(page);
      
      console.log(`🎯 Discovered ${elements.length} elements in post-interaction state`);
      
      await this.closeBrowser(browser);
      return elements;
      
    } catch (error) {
      console.error(`❌ Element hunting failed: ${error.message}`);
      await this.closeBrowser(browser);
      throw error;
    }
  }

  private async executeTestStep(page: any, step: any): Promise<void> {
    const { type, selector, value } = step;
    
    // Wait for element to be available
    await page.waitForSelector(selector, { timeout: 10000 });
    
    switch (type) {
      case 'click':
        await page.click(selector);
        break;
      
      case 'doubleclick':
        await page.dblclick(selector);
        break;
      
      case 'type':
        await page.type(selector, value || '');
        break;
      
      case 'clear':
        await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (element) element.value = '';
        }, selector);
        break;
      
      case 'hover':
        await page.hover(selector);
        break;
      
      case 'select':
        await page.select(selector, value || '');
        break;
      
      case 'check':
        await page.check(selector);
        break;
      
      case 'uncheck':
        await page.uncheck(selector);
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
        console.warn(`Unknown step type: ${type}`);
    }
    
    // Wait for any potential page changes after the action
    await page.waitForTimeout(200);
  }
}