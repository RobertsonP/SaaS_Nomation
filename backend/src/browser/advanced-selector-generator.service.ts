import { Injectable } from '@nestjs/common';

export interface SelectorOptions {
  element: any;
  document: any;
  prioritizeUniqueness: boolean;
  includePlaywrightSpecific: boolean;
  maxLength?: number; // null means no limit (long selectors OK)
  testableElementsOnly: boolean;
  allElements?: any[]; // Optional: All elements for layout-based selectors
}

export interface GeneratedSelector {
  selector: string;
  confidence: number;
  type: 'id' | 'testid' | 'aria' | 'text' | 'xpath' | 'css' | 'playwright';
  description: string;
  isUnique: boolean;
  isPlaywrightOptimized: boolean;
}

@Injectable()
export class AdvancedSelectorGeneratorService {
  
  /**
   * Generate advanced CSS selectors based on W3Schools specification + Playwright optimizations
   * Long selectors are acceptable if they ensure uniqueness
   */
  generateSelectors(options: SelectorOptions): GeneratedSelector[] {
    const { element, document, prioritizeUniqueness, includePlaywrightSpecific, testableElementsOnly, allElements } = options;
    const selectors: GeneratedSelector[] = [];
    
    // Skip non-testable elements if requested
    if (testableElementsOnly && !this.isTestableElement(element)) {
      return [];
    }
    
    // 1. HIGHEST PRIORITY: Test-specific attributes (Playwright optimized)
    this.addTestSpecificSelectors(element, selectors, document);
    
    // 2. HIGH PRIORITY: Unique IDs (W3Schools compliant)
    this.addIdSelectors(element, selectors, document);
    
    // 3. PLAYWRIGHT SPECIFIC: Text and role selectors
    if (includePlaywrightSpecific) {
      this.addPlaywrightSelectors(element, selectors, document);
    }
    
    // 4. ADVANCED CSS: Semantic selectors (ARIA, etc.)
    this.addSemanticSelectors(element, selectors, document);
    
    // 5. W3SCHOOLS ADVANCED: Structural pseudo-classes
    this.addStructuralSelectors(element, selectors, document);
    
    // 6. W3SCHOOLS ADVANCED: Attribute selectors
    this.addAttributeSelectors(element, selectors, document);
    
    // 7. COMPLEX CSS: Descendant and sibling selectors
    this.addRelationalSelectors(element, selectors, document);
    
    // 8. W3SCHOOLS ADVANCED: Functional pseudo-classes (:has, :not, :is)
    this.addFunctionalSelectors(element, selectors, document);

    // NEW: PLAYWRIGHT CSS EXTENSIONS - Visibility, state, and text matching
    this.addVisibilitySelectors(element, selectors, document);
    this.addStateAttributeSelectors(element, selectors, document);
    this.addEnhancedTextSelectors(element, selectors, document);
    this.addDeepCombinatorSelectors(element, selectors, document);

    // REMOVED: Layout-based selectors (:near, :right-of, :left-of, :above, :below)
    // Playwright documentation states these are DEPRECATED as of 2024:
    // - "Matching based on layout may produce unexpected results"
    // - "These queries are based on the rendered viewport and may change with viewport size"
    // - "If you use them exclusively, resulting selector may match elements not visible to users"
    // See: https://playwright.dev/docs/other-locators#css-matching-by-layout
    // Replaced with role + text + visibility combinations which are more reliable
    // if (allElements && allElements.length > 0) {
    //   this.addLayoutBasedSelectors(element, selectors, document, allElements);
    // }

    // 9. FALLBACK: Class-based selectors (filtered for stability)
    this.addClassSelectors(element, selectors, document);
    
    // 10. ULTIMATE FALLBACK: XPath for complex cases
    this.addXPathSelectors(element, selectors, document);
    
    // Sort by confidence and uniqueness
    return selectors
      .sort((a, b) => {
        if (prioritizeUniqueness) {
          if (a.isUnique !== b.isUnique) return a.isUnique ? -1 : 1;
        }
        return b.confidence - a.confidence;
      })
      .slice(0, 10); // Return top 10 selectors
  }
  
  private isTestableElement(element: any): boolean {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const type = element.getAttribute('type');
    
    // Interactive elements suitable for testing
    const interactiveTags = ['button', 'input', 'textarea', 'select', 'a', 'form', 'img'];
    const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab'];
    const testableTypes = ['button', 'submit', 'reset', 'text', 'email', 'password', 'checkbox', 'radio'];
    
    // Element with click handlers
    const hasClickHandler = element.onclick || 
                           element.getAttribute('onclick') || 
                           element.style.cursor === 'pointer';
    
    // Navigation elements
    const isNavElement = element.closest('nav') || 
                        element.closest('[role="navigation"]') ||
                        element.closest('.menu') ||
                        element.closest('.navbar');
    
    // Text elements with meaningful content
    const isTextElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'].includes(tag) &&
                         element.textContent && 
                         element.textContent.trim().length > 0 &&
                         element.textContent.trim().length < 200;
    
    return interactiveTags.includes(tag) ||
           interactiveRoles.includes(role) ||
           testableTypes.includes(type) ||
           hasClickHandler ||
           isNavElement ||
           isTextElement;
  }
  
  private addTestSpecificSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const testAttributes = ['data-testid', 'data-test', 'data-cy', 'data-test-id', 'data-automation'];
    
    for (const attr of testAttributes) {
      const value = element.getAttribute(attr);
      if (value) {
        const selector = `[${attr}="${value}"]`;
        selectors.push({
          selector,
          confidence: 0.85, // Lowered: Test IDs are last resort per Playwright best practices
          type: 'testid',
          description: `Test-specific ${attr} attribute`,
          isUnique: this.isUniqueSelector(selector, document),
          isPlaywrightOptimized: true
        });
      }
    }
  }
  
  private addIdSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const id = element.id;
    if (id && !this.isGeneratedId(id)) {
      const selector = `#${id}`;
      selectors.push({
        selector,
        confidence: 0.82, // Lowered: IDs less important than user-facing selectors
        type: 'id',
        description: `Unique ID selector`,
        isUnique: this.isUniqueSelector(selector, document),
        isPlaywrightOptimized: true
      });
    }
  }
  
  private addPlaywrightSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const text = element.textContent?.trim();
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const title = element.getAttribute('title');
    const placeholder = element.getAttribute('placeholder');
    const tag = element.tagName.toLowerCase();

    // FIXED: Use valid CSS selector with :has-text() instead of text= engine syntax
    if (text && text.length > 0 && text.length < 100) {
      // Exact text match using :has-text() (valid CSS extension)
      const escapedText = this.escapeText(text);
      const textSelector = `${tag}:has-text("${escapedText}")`;
      selectors.push({
        selector: textSelector,
        confidence: 0.90, // Text selectors are #2 priority per Playwright (user-facing)
        type: 'playwright',
        description: `Text-based selector`,
        isUnique: this.isUniqueSelector(textSelector, document),
        isPlaywrightOptimized: true
      });

      // Partial text match with regex
      if (text.length > 10) {
        const partialText = this.escapeRegex(text.substring(0, 20));
        selectors.push({
          selector: `${tag}:has-text(/${partialText}/)`,
          confidence: 0.75,
          type: 'playwright',
          description: `Partial text regex match`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // FIXED: Use valid CSS attribute selector [role="..."] instead of role= engine syntax
    if (role) {
      // Basic role selector (valid CSS)
      let roleSelector = `[role="${role}"]`;
      selectors.push({
        selector: roleSelector,
        confidence: 0.88,
        type: 'aria',
        description: `Role attribute selector`,
        isUnique: this.isUniqueSelector(roleSelector, document),
        isPlaywrightOptimized: true
      });

      // Role + ARIA label combination (highest priority - accessibility + uniqueness)
      if (ariaLabel) {
        const combinedSelector = `[role="${role}"][aria-label="${ariaLabel}"]`;
        selectors.push({
          selector: combinedSelector,
          confidence: 0.95, // Highest: Role + accessible name (Playwright #1 priority)
          type: 'aria',
          description: `Role with ARIA label (most resilient)`,
          isUnique: this.isUniqueSelector(combinedSelector, document),
          isPlaywrightOptimized: true
        });
      }
      // Role + text combination
      else if (text && text.length < 50) {
        const escapedText = this.escapeText(text);
        const combinedSelector = `[role="${role}"]:has-text("${escapedText}")`;
        selectors.push({
          selector: combinedSelector,
          confidence: 0.93, // Very high: Role + text (resilient + user-facing)
          type: 'playwright',
          description: `Role with text content`,
          isUnique: this.isUniqueSelector(`[role="${role}"]`, document),
          isPlaywrightOptimized: true
        });
      }
    }

    // FIXED: Use [placeholder="..."] instead of label= engine syntax
    if (placeholder) {
      selectors.push({
        selector: `[placeholder="${placeholder}"]`,
        confidence: 0.86, // Form inputs with placeholder (Playwright #4 priority)
        type: 'aria',
        description: `Placeholder attribute selector`,
        isUnique: this.isUniqueSelector(`[placeholder="${placeholder}"]`, document),
        isPlaywrightOptimized: true
      });
    }

    // FIXED: Use [title="..."] instead of title= engine syntax
    if (title) {
      selectors.push({
        selector: `[title="${title}"]`,
        confidence: 0.78,
        type: 'aria',
        description: `Title attribute selector`,
        isUnique: this.isUniqueSelector(`[title="${title}"]`, document),
        isPlaywrightOptimized: true
      });
    }
  }
  
  private addSemanticSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const ariaLabel = element.getAttribute('aria-label');
    const role = element.getAttribute('role');
    const name = element.getAttribute('name');
    
    if (ariaLabel) {
      const selector = `[aria-label="${ariaLabel}"]`;
      selectors.push({
        selector,
        confidence: 0.88, // Raised: ARIA labels are user-facing and accessible
        type: 'aria',
        description: `ARIA label selector`,
        isUnique: this.isUniqueSelector(selector, document),
        isPlaywrightOptimized: false
      });
    }
    
    if (role) {
      const selector = `[role="${role}"]`;
      selectors.push({
        selector,
        confidence: 0.85, // Raised: ARIA roles are semantic and accessible
        type: 'aria',
        description: `ARIA role selector`,
        isUnique: this.isUniqueSelector(selector, document),
        isPlaywrightOptimized: false
      });
    }
    
    if (name && ['input', 'textarea', 'select'].includes(element.tagName.toLowerCase())) {
      const selector = `${element.tagName.toLowerCase()}[name="${name}"]`;
      selectors.push({
        selector,
        confidence: 0.88, // Raised: Name attributes are important for form controls
        type: 'css',
        description: `Name attribute selector`,
        isUnique: this.isUniqueSelector(selector, document),
        isPlaywrightOptimized: false
      });
    }
  }
  
  private addStructuralSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const parent = element.parentElement;
    if (!parent) return;
    
    const tag = element.tagName.toLowerCase();
    const allSiblings = Array.from(parent.children) as Element[];
    const sameTags = allSiblings.filter((el: Element) => el.tagName.toLowerCase() === tag);
    const index = sameTags.indexOf(element);
    
    if (sameTags.length > 1) {
      // nth-of-type selector
      const nthSelector = `${tag}:nth-of-type(${index + 1})`;
      selectors.push({
        selector: nthSelector,
        confidence: 0.65,
        type: 'css',
        description: `Nth-of-type structural selector`,
        isUnique: this.isUniqueSelector(nthSelector, document),
        isPlaywrightOptimized: false
      });
      
      // nth-child selector  
      const childIndex = allSiblings.indexOf(element) + 1;
      const nthChildSelector = `${tag}:nth-child(${childIndex})`;
      selectors.push({
        selector: nthChildSelector,
        confidence: 0.63,
        type: 'css',
        description: `Nth-child structural selector`,
        isUnique: this.isUniqueSelector(nthChildSelector, document),
        isPlaywrightOptimized: false
      });
      
      // First/last child if applicable
      if (index === 0) {
        selectors.push({
          selector: `${tag}:first-of-type`,
          confidence: 0.68,
          type: 'css',
          description: `First-of-type selector`,
          isUnique: this.isUniqueSelector(`${tag}:first-of-type`, document),
          isPlaywrightOptimized: false
        });
      }
      
      if (index === sameTags.length - 1) {
        selectors.push({
          selector: `${tag}:last-of-type`,
          confidence: 0.68,
          type: 'css',
          description: `Last-of-type selector`,
          isUnique: this.isUniqueSelector(`${tag}:last-of-type`, document),
          isPlaywrightOptimized: false
        });
      }
    }
  }
  
  private addAttributeSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const attributes = Array.from(element.attributes) as Attr[];
    const tag = element.tagName.toLowerCase();
    
    for (const attr of attributes) {
      if (['id', 'class', 'data-testid', 'data-test', 'aria-label', 'role'].includes(attr.name)) {
        continue; // Already handled
      }
      
      const value = attr.value;
      if (value && value.length > 0 && value.length < 100) {
        // Exact match
        const exactSelector = `${tag}[${attr.name}="${value}"]`;
        selectors.push({
          selector: exactSelector,
          confidence: 0.72,
          type: 'css',
          description: `Attribute exact match selector`,
          isUnique: this.isUniqueSelector(exactSelector, document),
          isPlaywrightOptimized: false
        });
        
        // Prefix match (W3Schools ^= operator)
        if (value.length > 5) {
          const prefixSelector = `${tag}[${attr.name}^="${value.substring(0, 5)}"]`;
          selectors.push({
            selector: prefixSelector,
            confidence: 0.60,
            type: 'css',
            description: `Attribute prefix match selector`,
            isUnique: this.isUniqueSelector(prefixSelector, document),
            isPlaywrightOptimized: false
          });
        }
        
        // Suffix match (W3Schools $= operator)
        if (value.length > 5) {
          const suffixSelector = `${tag}[${attr.name}$="${value.slice(-5)}"]`;
          selectors.push({
            selector: suffixSelector,
            confidence: 0.58,
            type: 'css',
            description: `Attribute suffix match selector`,
            isUnique: this.isUniqueSelector(suffixSelector, document),
            isPlaywrightOptimized: false
          });
        }
        
        // Contains match (W3Schools *= operator)
        if (value.length > 3) {
          const containsSelector = `${tag}[${attr.name}*="${value.substring(1, value.length-1)}"]`;
          selectors.push({
            selector: containsSelector,
            confidence: 0.55,
            type: 'css',
            description: `Attribute contains match selector`,
            isUnique: this.isUniqueSelector(containsSelector, document),
            isPlaywrightOptimized: false
          });
        }
      }
    }
  }
  
  private addRelationalSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const parent = element.parentElement;
    if (!parent) return;
    
    const tag = element.tagName.toLowerCase();
    
    // Parent-child relationships
    if (parent.id) {
      const childSelector = `#${parent.id} > ${tag}`;
      selectors.push({
        selector: childSelector,
        confidence: 0.75,
        type: 'css',
        description: `Direct child selector`,
        isUnique: this.isUniqueSelector(childSelector, document),
        isPlaywrightOptimized: false
      });
    }
    
    if (parent.className) {
      const classes = parent.className.trim().split(/\s+/).filter(c => this.isStableClass(c));
      if (classes.length > 0) {
        const descendantSelector = `.${classes[0]} ${tag}`;
        selectors.push({
          selector: descendantSelector,
          confidence: 0.65,
          type: 'css',
          description: `Descendant selector`,
          isUnique: this.isUniqueSelector(descendantSelector, document),
          isPlaywrightOptimized: false
        });
      }
    }
    
    // Sibling selectors
    const prevSibling = element.previousElementSibling;
    const nextSibling = element.nextElementSibling;
    
    if (prevSibling && prevSibling.id) {
      const siblingSelector = `#${prevSibling.id} + ${tag}`;
      selectors.push({
        selector: siblingSelector,
        confidence: 0.70,
        type: 'css',
        description: `Adjacent sibling selector`,
        isUnique: this.isUniqueSelector(siblingSelector, document),
        isPlaywrightOptimized: false
      });
    }
  }
  
  private addFunctionalSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();
    
    // :has() pseudo-class (modern browsers)
    if (element.children.length > 0) {
      const firstChildTag = element.children[0].tagName.toLowerCase();
      const hasSelector = `${tag}:has(${firstChildTag})`;
      selectors.push({
        selector: hasSelector,
        confidence: 0.60,
        type: 'css',
        description: `:has() functional selector`,
        isUnique: this.isUniqueSelector(hasSelector, document),
        isPlaywrightOptimized: false
      });
    }
    
    // :not() pseudo-class
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((el: Element) => el.tagName.toLowerCase() === tag);
      if (siblings.length > 1) {
        // Find unique attribute to exclude others
        for (const sibling of siblings) {
          if (sibling !== element && (sibling as Element).className) {
            const excludeClass = (sibling as Element).className.split(' ')[0];
            const notSelector = `${tag}:not(.${excludeClass})`;
            selectors.push({
              selector: notSelector,
              confidence: 0.58,
              type: 'css',
              description: `:not() exclusion selector`,
              isUnique: this.isUniqueSelector(notSelector, document),
              isPlaywrightOptimized: false
            });
            break;
          }
        }
      }
    }
    
    // :is() pseudo-class for multiple tag matching
    if (text && text.length > 0) {
      const isSelector = `:is(${tag}, [aria-label*="${text.substring(0, 10)}"])`;
      selectors.push({
        selector: isSelector,
        confidence: 0.55,
        type: 'css',
        description: `:is() multiple match selector`,
        isUnique: this.isUniqueSelector(isSelector, document),
        isPlaywrightOptimized: false
      });
    }
  }

  /**
   * NEW: Add Playwright :visible pseudo-class selectors
   * Filters elements that are actually visible on the page
   */
  private addVisibilitySelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const tag = element.tagName.toLowerCase();
    const isVisible = element.offsetParent !== null ||
                     window.getComputedStyle(element).display !== 'none';

    if (!isVisible) return; // Skip hidden elements

    // Add :visible to existing selectors
    const id = element.id;
    const role = element.getAttribute('role');
    const text = element.textContent?.trim();

    // ID with visibility
    if (id && !this.isGeneratedId(id)) {
      selectors.push({
        selector: `#${id}:visible`,
        confidence: 0.84, // Slightly higher than plain ID (0.82) due to visibility filter
        type: 'playwright',
        description: 'ID selector with visibility filter',
        isUnique: this.isUniqueSelector(`#${id}`, document),
        isPlaywrightOptimized: true
      });
    }

    // Role with visibility
    if (role) {
      selectors.push({
        selector: `[role="${role}"]:visible`,
        confidence: 0.75,
        type: 'playwright',
        description: 'Role selector with visibility filter',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Tag with visibility (useful for unique tags)
    if (['button', 'input', 'textarea', 'select', 'a'].includes(tag)) {
      selectors.push({
        selector: `${tag}:visible`,
        confidence: 0.50,
        type: 'playwright',
        description: 'Tag selector with visibility filter',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }
  }

  /**
   * NEW: Add state attribute selectors (ARIA states, disabled, readonly, custom attributes)
   */
  private addStateAttributeSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const tag = element.tagName.toLowerCase();

    // State attributes to check
    const stateAttributes = {
      'aria-checked': 0.80,
      'aria-selected': 0.80,
      'aria-expanded': 0.78,
      'aria-pressed': 0.78,
      'disabled': 0.82,
      'readonly': 0.80,
      'checked': 0.82,
      'selected': 0.80,
      'aria-current': 0.76,
      'aria-disabled': 0.78,
      'robotId': 0.88,  // Custom attribute (high priority)
      'data-robotid': 0.88,
      'data-state': 0.74,
      'data-status': 0.74
    };

    for (const [attr, confidence] of Object.entries(stateAttributes)) {
      const value = element.getAttribute(attr);
      if (value !== null) {
        // Exact attribute with value
        const selectorWithValue = `${tag}[${attr}="${value}"]`;
        selectors.push({
          selector: selectorWithValue,
          confidence,
          type: 'aria',
          description: `State attribute ${attr}="${value}" selector`,
          isUnique: this.isUniqueSelector(selectorWithValue, document),
          isPlaywrightOptimized: true
        });

        // With visibility for interactive elements
        if (['button', 'input', 'a', 'select'].includes(tag)) {
          selectors.push({
            selector: `${tag}[${attr}="${value}"]:visible`,
            confidence: confidence + 0.02,
            type: 'playwright',
            description: `State attribute ${attr} with visibility`,
            isUnique: this.isUniqueSelector(selectorWithValue, document),
            isPlaywrightOptimized: true
          });
        }

        // Boolean attributes (just presence, no value needed)
        if (['disabled', 'readonly', 'checked', 'selected'].includes(attr) && value) {
          const boolSelector = `${tag}[${attr}]`;
          selectors.push({
            selector: boolSelector,
            confidence: confidence - 0.05,
            type: 'css',
            description: `Boolean state attribute ${attr}`,
            isUnique: this.isUniqueSelector(boolSelector, document),
            isPlaywrightOptimized: false
          });
        }
      }
    }

    // NOT patterns - exclude disabled/hidden elements
    if (tag === 'button' || tag === 'input' || tag === 'a') {
      const text = element.textContent?.trim();
      const isDisabled = element.getAttribute('disabled') !== null ||
                        element.getAttribute('aria-disabled') === 'true';

      if (!isDisabled) {
        // Only add :not() for enabled elements
        selectors.push({
          selector: `${tag}:not([disabled]):visible`,
          confidence: 0.72,
          type: 'playwright',
          description: 'Enabled element with visibility',
          isUnique: false,
          isPlaywrightOptimized: true
        });

        // Exclude hidden elements
        selectors.push({
          selector: `${tag}:not([aria-hidden="true"]):visible`,
          confidence: 0.70,
          type: 'playwright',
          description: 'Non-hidden element with visibility',
          isUnique: false,
          isPlaywrightOptimized: true
        });

        // Combined exclusions
        if (text && text.length > 0 && text.length < 50) {
          selectors.push({
            selector: `${tag}:not([disabled]):not([aria-hidden="true"]):visible:has-text("${text}")`,
            confidence: 0.85,
            type: 'playwright',
            description: 'Combined exclusion with text match',
            isUnique: this.isUniqueSelector(tag, document) && text.length < 20,
            isPlaywrightOptimized: true
          });
        }
      }
    }
  }

  /**
   * NEW: Enhanced :has-text() implementation (Playwright CSS extension)
   */
  private addEnhancedTextSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const text = element.textContent?.trim();
    const tag = element.tagName.toLowerCase();

    if (!text || text.length === 0) return;

    // Exact text match with :has-text()
    if (text.length > 0 && text.length <= 50) {
      selectors.push({
        selector: `${tag}:has-text("${this.escapeText(text)}")`,
        confidence: 0.82,
        type: 'playwright',
        description: 'Exact text match with :has-text()',
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // With visibility
      selectors.push({
        selector: `${tag}:has-text("${this.escapeText(text)}"):visible`,
        confidence: 0.84,
        type: 'playwright',
        description: 'Exact text match with visibility',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Partial text match with regex
    if (text.length > 10 && text.length <= 100) {
      const partialText = text.substring(0, 20);
      selectors.push({
        selector: `${tag}:has-text(/${this.escapeRegex(partialText)}/)`,
        confidence: 0.75,
        type: 'playwright',
        description: 'Partial text regex match',
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // Case-insensitive regex
      selectors.push({
        selector: `${tag}:has-text(/${this.escapeRegex(partialText)}/i)`,
        confidence: 0.73,
        type: 'playwright',
        description: 'Case-insensitive text match',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Combined with role
    const role = element.getAttribute('role');
    if (role && text.length <= 30) {
      selectors.push({
        selector: `[role="${role}"]:has-text("${this.escapeText(text)}"):visible`,
        confidence: 0.87,
        type: 'playwright',
        description: 'Role + text + visibility',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }
  }

  /**
   * NEW: Deep combinator >> selectors (Playwright-specific for shadow DOM piercing)
   */
  private addDeepCombinatorSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const parent = element.parentElement;
    if (!parent) return;

    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();

    // Parent ID >> child element
    if (parent.id && !this.isGeneratedId(parent.id)) {
      selectors.push({
        selector: `#${parent.id} >> ${tag}`,
        confidence: 0.78,
        type: 'playwright',
        description: 'Deep combinator with parent ID',
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // With text
      if (text && text.length > 0 && text.length <= 30) {
        selectors.push({
          selector: `#${parent.id} >> ${tag}:has-text("${this.escapeText(text)}")`,
          confidence: 0.83,
          type: 'playwright',
          description: 'Deep combinator with text',
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }

      // With visibility
      selectors.push({
        selector: `#${parent.id} >> ${tag}:visible`,
        confidence: 0.80,
        type: 'playwright',
        description: 'Deep combinator with visibility',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Parent role >> child element
    const parentRole = parent.getAttribute('role');
    if (parentRole) {
      selectors.push({
        selector: `[role="${parentRole}"] >> ${tag}`,
        confidence: 0.72,
        type: 'playwright',
        description: 'Deep combinator with parent role',
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // Child with role
      const childRole = element.getAttribute('role');
      if (childRole) {
        selectors.push({
          selector: `[role="${parentRole}"] >> [role="${childRole}"]:visible`,
          confidence: 0.76,
          type: 'playwright',
          description: 'Deep combinator role hierarchy',
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Common containers >> interactive elements
    const containerSelectors = ['nav', 'header', 'footer', 'main', '.menu', '.navbar', '[role="navigation"]'];
    for (const container of containerSelectors) {
      try {
        if (element.closest(container)) {
          if (['button', 'a', 'input'].includes(tag)) {
            selectors.push({
              selector: `${container} >> ${tag}:visible`,
              confidence: 0.68,
              type: 'playwright',
              description: `Container ${container} deep selector`,
              isUnique: false,
              isPlaywrightOptimized: true
            });
          }
        }
      } catch {
        // Ignore invalid selectors
      }
    }
  }

  /**
   * Helper: Escape text for selector usage
   */
  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Helper: Escape text for regex usage
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * NEW: Add layout-based selectors (Playwright CSS extensions for spatial relationships)
   * These are incredibly useful for finding elements based on visual position
   */
  private addLayoutBasedSelectors(element: any, selectors: GeneratedSelector[], document: any, allElements: any[]) {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();
    const id = element.id;
    const role = element.getAttribute('role');

    // Strategy: Look for nearby elements that can serve as reference points
    // (labels, headings, buttons with clear text)

    // Find potential reference elements (elements with meaningful text/ids/roles)
    const referenceElements = [];

    for (const refEl of allElements) {
      if (!refEl.elementData || refEl === element) continue;

      const refData = refEl.elementData;
      const refText = refData.textContent?.trim();
      const refId = refData.id;
      const refRole = refData.attributes?.role;

      // Good reference candidates: labels, headings, buttons with text
      const isGoodReference =
        (refText && refText.length > 2 && refText.length < 50) ||
        (refId && refId.length > 2 && refId.length < 30) ||
        (['label', 'h1', 'h2', 'h3', 'button', 'a'].includes(refData.tagName));

      if (isGoodReference) {
        // Build a selector for the reference element
        let refSelector = null;

        if (refId && refId.length < 30 && !this.isGeneratedId(refId)) {
          refSelector = `#${refId}`;
        } else if (refText && refText.length < 40) {
          refSelector = `:has-text("${this.escapeText(refText)}")`;
        } else if (refRole) {
          refSelector = `[role="${refRole}"]`;
        }

        if (refSelector) {
          referenceElements.push({
            selector: refSelector,
            text: refText,
            tag: refData.tagName
          });
        }
      }
    }

    // Generate layout-based selectors using reference elements
    // Limit to first 5 references to avoid too many selectors
    for (const ref of referenceElements.slice(0, 5)) {
      // :near() - Within 50px (default distance)
      selectors.push({
        selector: `${tag}:near(${ref.selector})`,
        confidence: 0.82,
        type: 'playwright',
        description: `Element near "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // With text for better specificity
      if (text && text.length > 0 && text.length < 40) {
        selectors.push({
          selector: `${tag}:has-text("${this.escapeText(text)}"):near(${ref.selector})`,
          confidence: 0.86,
          type: 'playwright',
          description: `Element with text near "${ref.text || ref.selector}"`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }

      // :right-of() - Element is to the right
      selectors.push({
        selector: `${tag}:right-of(${ref.selector})`,
        confidence: 0.80,
        type: 'playwright',
        description: `Element to the right of "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // :left-of() - Element is to the left
      selectors.push({
        selector: `${tag}:left-of(${ref.selector})`,
        confidence: 0.80,
        type: 'playwright',
        description: `Element to the left of "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // :above() - Element is above
      selectors.push({
        selector: `${tag}:above(${ref.selector})`,
        confidence: 0.78,
        type: 'playwright',
        description: `Element above "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // :below() - Element is below
      selectors.push({
        selector: `${tag}:below(${ref.selector})`,
        confidence: 0.78,
        type: 'playwright',
        description: `Element below "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // Combined: Role + near reference
      if (role) {
        selectors.push({
          selector: `[role="${role}"]:near(${ref.selector})`,
          confidence: 0.84,
          type: 'playwright',
          description: `Role element near "${ref.text || ref.selector}"`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Special case: Form inputs near their labels
    if (['input', 'textarea', 'select'].includes(tag)) {
      // Look for label elements specifically
      for (const refEl of allElements) {
        if (!refEl.elementData || refEl.elementData.tagName !== 'label') continue;

        const labelText = refEl.elementData.textContent?.trim();
        if (labelText && labelText.length > 0 && labelText.length < 50) {
          const labelSelector = `label:has-text("${this.escapeText(labelText)}")`;

          selectors.push({
            selector: `${tag}:right-of(${labelSelector})`,
            confidence: 0.87,
            type: 'playwright',
            description: `Form input to the right of label "${labelText}"`,
            isUnique: false,
            isPlaywrightOptimized: true
          });

          selectors.push({
            selector: `${tag}:below(${labelSelector})`,
            confidence: 0.86,
            type: 'playwright',
            description: `Form input below label "${labelText}"`,
            isUnique: false,
            isPlaywrightOptimized: true
          });

          selectors.push({
            selector: `${tag}:near(${labelSelector}):visible`,
            confidence: 0.89,
            type: 'playwright',
            description: `Form input near label "${labelText}"`,
            isUnique: false,
            isPlaywrightOptimized: true
          });
        }
      }
    }
  }

  private addClassSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    const className = element.className;
    if (!className) return;
    
    const classes = className.trim().split(/\s+/).filter(c => this.isStableClass(c));
    const tag = element.tagName.toLowerCase();
    
    if (classes.length > 0) {
      // Single class
      const singleClassSelector = `${tag}.${classes[0]}`;
      selectors.push({
        selector: singleClassSelector,
        confidence: 0.50,
        type: 'css',
        description: `Single class selector`,
        isUnique: this.isUniqueSelector(singleClassSelector, document),
        isPlaywrightOptimized: false
      });
      
      // Multiple classes (up to 3 for stability)
      if (classes.length > 1) {
        const multiClassSelector = `${tag}.${classes.slice(0, 3).join('.')}`;
        selectors.push({
          selector: multiClassSelector,
          confidence: 0.55,
          type: 'css',
          description: `Multiple class selector`,
          isUnique: this.isUniqueSelector(multiClassSelector, document),
          isPlaywrightOptimized: false
        });
      }
      
      // Just classes without tag (more flexible)
      const classOnlySelector = `.${classes[0]}`;
      selectors.push({
        selector: classOnlySelector,
        confidence: 0.45,
        type: 'css',
        description: `Class-only selector`,
        isUnique: this.isUniqueSelector(classOnlySelector, document),
        isPlaywrightOptimized: false
      });
    }
  }
  
  private addXPathSelectors(element: any, selectors: GeneratedSelector[], document: any) {
    // Generate XPath for complex cases
    let xpath = '';
    let current = element;
    const parts = [];
    
    while (current && current.nodeType === 1) {
      let part = current.tagName.toLowerCase();
      
      if (current.id) {
        part = `*[@id='${current.id}']`;
        parts.unshift(part);
        break;
      } else {
        const siblings = Array.from(current.parentElement?.children || [])
          .filter((el: Element) => el.tagName === current.tagName);
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          part = `${part}[${index}]`;
        }
        
        parts.unshift(part);
      }
      
      current = current.parentElement;
      
      // Limit XPath depth to prevent overly long selectors
      if (parts.length >= 5) break;
    }
    
    xpath = '//' + parts.join('/');
    
    selectors.push({
      selector: xpath,
      confidence: 0.40,
      type: 'xpath',
      description: `XPath selector`,
      isUnique: true, // XPath is generally unique
      isPlaywrightOptimized: true // Playwright supports XPath
    });
  }
  
  private isUniqueSelector(selector: string, document: any): boolean {
    try {
      // For text-based selectors, we can't easily verify uniqueness without actual page context
      if (selector.includes('text=') || selector.includes('role=')) {
        return false; // Conservative assumption
      }
      
      const elements = document.querySelectorAll(selector);
      return elements.length === 1;
    } catch {
      return false;
    }
  }
  
  private isGeneratedId(id: string): boolean {
    // Common patterns for auto-generated IDs
    const generatedPatterns = [
      /^[a-f0-9]{8,}$/i,      // Pure hex strings
      /^react-.*$/i,          // React generated IDs
      /^ember\d+$/i,          // Ember generated IDs  
      /^\d+$/,                // Pure numbers
      /^temp_.*$/i,           // Temporary IDs
      /^auto_.*$/i,           // Auto-generated IDs
    ];
    
    return generatedPatterns.some(pattern => pattern.test(id));
  }
  
  private isStableClass(className: string): boolean {
    // Filter out utility classes that might change
    const unstablePatterns = [
      /^(p|m|pt|pb|pl|pr|mt|mb|ml|mr)-/,  // Spacing utilities
      /^(text|bg|border|w|h|flex|grid)-/, // Style utilities
      /^(block|inline|hidden|visible)$/,   // Display utilities
      /^(sm|md|lg|xl):/,                   // Responsive prefixes
      /^\w{1,2}$/,                         // Very short classes (likely utilities)
      /^\d/,                               // Starting with numbers
    ];
    
    const isUnstable = unstablePatterns.some(pattern => pattern.test(className));
    return !isUnstable && className.length > 2 && className.length < 50;
  }
}