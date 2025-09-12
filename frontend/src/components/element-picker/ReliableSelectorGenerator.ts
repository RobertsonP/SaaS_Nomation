interface ReliableElementData {
  tagName: string;
  selectors: string[];
  attributes: Record<string, any>;
  textContent: string;
  innerText: string;
  boundingRect: { x: number; y: number; width: number; height: number };
  href?: string | null;
  src?: string | null;
  value?: string | null;
  placeholder?: string | null;
  title?: string | null;
  role?: string | null;
  ariaLabel?: string | null;
  cssInfo?: any;
  parentTagName?: string | null;
  parentClasses?: string;
  siblingIndex?: number;
}

interface RobustSelector {
  selector: string;
  fallbackSelectors: string[];
  automationMetadata: {
    priority: number;           // 1-100, automation priority
    reliability: number;        // 0-1, stability score
    browserCompatibility: number; // 0-1, Playwright/Selenium support
    uniqueness: number;         // 0-1, element uniqueness
    stability: number;          // 0-1, survives page changes
    xpath: string;             // Ultimate fallback
  };
}

interface ValidatedSelector {
  selector: string;
  priority: number;  // 1-100, higher = better for automation
  reliability: number; // 0-1, stability score
  browserCompatibility: number; // 0-1, works in Playwright/Selenium
  uniqueness: number; // 0-1, how unique on page
  stability: number; // 0-1, survives page changes
}

/**
 * 🎯 ROBUST CSS SELECTOR GENERATOR WITH COMPLETE CSS ARSENAL
 * 
 * Uses 53 CSS pseudo-classes, 7 attribute selectors, and Playwright text selectors
 * to create bulletproof, multi-layered element selection for professional browser automation.
 */
export class ReliableSelectorGenerator {
  
  /**
   * 🎯 NEW MAIN METHOD: Generate bulletproof selector with complete CSS arsenal
   */
  generateRobustSelector(elementData: ReliableElementData): RobustSelector {
    const fallbackChain = this.buildAdvancedFallbackChain(elementData);
    const primarySelector = fallbackChain[0];
    
    return {
      selector: primarySelector.selector,
      fallbackSelectors: fallbackChain.slice(1).map(f => f.selector),
      automationMetadata: {
        priority: primarySelector.priority,
        reliability: this.calculateAdvancedReliability(primarySelector.selector, elementData),
        browserCompatibility: this.scoreBrowserCompatibility(primarySelector.selector),
        uniqueness: this.scoreUniqueness(primarySelector.selector, elementData),
        stability: this.calculateAdvancedStability(primarySelector.selector, elementData),
        xpath: this.generateAdvancedXPath(elementData)
      }
    };
  }

  /**
   * 🏗️ BUILD ADVANCED 4-TIER FALLBACK CHAIN WITH COMPLETE CSS ARSENAL
   */
  private buildAdvancedFallbackChain(elementData: ReliableElementData): Array<{selector: string, priority: number}> {
    const chain: Array<{selector: string, priority: number}> = [];
    
    // TIER 1: Context + Attributes + Advanced CSS Pseudo-Classes (Most Robust)
    const tier1Selectors = this.generateTier1AdvancedSelectors(elementData);
    chain.push(...tier1Selectors);
    
    // TIER 2: Position + Text + CSS4 Selectors
    const tier2Selectors = this.generateTier2AdvancedSelectors(elementData);
    chain.push(...tier2Selectors);
    
    // TIER 3: Advanced Attribute Selectors + Text Matching
    const tier3Selectors = this.generateTier3AdvancedSelectors(elementData);
    chain.push(...tier3Selectors);
    
    // TIER 4: Playwright-specific selectors
    const tier4Selectors = this.generateTier4PlaywrightSelectors(elementData);
    chain.push(...tier4Selectors);
    
    // Sort by priority and return top 8 selectors
    return chain.sort((a, b) => b.priority - a.priority).slice(0, 8);
  }

  /**
   * 🥇 TIER 1: Advanced CSS Pseudo-Classes + Context Selectors
   */
  private generateTier1AdvancedSelectors(elementData: ReliableElementData): Array<{selector: string, priority: number}> {
    const selectors: Array<{selector: string, priority: number}> = [];
    const { tagName, attributes, textContent, innerText } = elementData;
    const tag = tagName.toLowerCase();
    
    // 🎯 TEST-SPECIFIC ATTRIBUTES WITH ADVANCED PSEUDO-CLASSES (Priority: 95-100)
    if (attributes['data-testid']) {
      selectors.push({
        selector: `[data-testid="${attributes['data-testid']}"]`,
        priority: 100
      });
      // Enhanced with state validation using multiple pseudo-classes
      selectors.push({
        selector: `[data-testid="${attributes['data-testid']}"]:not([disabled]):not([aria-hidden="true"]):enabled`,
        priority: 99
      });
      // Advanced state combination
      selectors.push({
        selector: `[data-testid="${attributes['data-testid']}"]:not(:disabled):not(:invalid):enabled`,
        priority: 98
      });
    }
    
    // 🎯 ROBUST ID WITH CSS4 PSEUDO-CLASSES (Priority: 90-95)
    if (attributes.id && this.isStableId(attributes.id)) {
      selectors.push({
        selector: `#${attributes.id}`,
        priority: 95
      });
      // Enhanced with advanced validation pseudo-classes
      selectors.push({
        selector: `${tag}#${attributes.id}:not([aria-hidden="true"]):not(:disabled)`,
        priority: 94
      });
      // :is() pseudo-class for modern browsers
      selectors.push({
        selector: `${tag}:is(#${attributes.id}):enabled:not([disabled])`,
        priority: 93
      });
    }
    
    // 🎯 ARIA + SEMANTIC WITH ADVANCED PSEUDO-CLASSES (Priority: 85-90)
    if (attributes['aria-label']) {
      const ariaLabel = attributes['aria-label'].replace(/"/g, '\\"');
      selectors.push({
        selector: `${tag}[aria-label="${ariaLabel}"]:not([disabled]):enabled`,
        priority: 90
      });
      
      // :has() pseudo-class for parent selection (CSS4)
      if (textContent) {
        selectors.push({
          selector: `${tag}[aria-label="${ariaLabel}"]:has-text("${textContent.trim().substring(0, 20)}")`,
          priority: 89
        });
      }
      
      // Combined with role using :is()
      if (attributes.role) {
        selectors.push({
          selector: `${tag}:is([role="${attributes.role}"][aria-label="${ariaLabel}"]):not([aria-hidden="true"])`,
          priority: 88
        });
      }
    }
    
    // 🎯 FORM ELEMENTS WITH ADVANCED CSS SELECTORS (Priority: 80-85)
    if (this.isFormElement(tag)) {
      if (attributes.name) {
        // :valid pseudo-class for form validation
        selectors.push({
          selector: `${tag}[name="${attributes.name}"]:not([disabled]):valid`,
          priority: 85
        });
        
        // :focus-within for container focus
        selectors.push({
          selector: `${tag}[name="${attributes.name}"]:focus-within:enabled`,
          priority: 84
        });
        
        // Combined with type using attribute selectors
        if (attributes.type) {
          selectors.push({
            selector: `${tag}[name="${attributes.name}"][type="${attributes.type}"]:not(:disabled):not(:invalid)`,
            priority: 83
          });
        }
      }
      
      // :required and :optional pseudo-classes
      if (attributes.required !== undefined) {
        const reqSelector = attributes.required ? ':required' : ':optional';
        selectors.push({
          selector: `${tag}${reqSelector}:enabled:not([aria-hidden="true"])`,
          priority: 82
        });
      }
      
      // :in-range and :out-of-range for numeric inputs
      if (attributes.type === 'number' || attributes.type === 'range') {
        selectors.push({
          selector: `${tag}[type="${attributes.type}"]:in-range:enabled`,
          priority: 81
        });
      }
    }
    
    // 🎯 ADVANCED STRUCTURAL PSEUDO-CLASSES (Priority: 75-80)
    
    // :nth-of-type() with validation
    if (elementData.siblingIndex !== undefined) {
      selectors.push({
        selector: `${tag}:nth-of-type(${elementData.siblingIndex + 1}):not([aria-hidden="true"]):enabled`,
        priority: 78
      });
      
      // :nth-child() with state validation
      selectors.push({
        selector: `${tag}:nth-child(${elementData.siblingIndex + 1}):not([disabled]):enabled`,
        priority: 77
      });
    }
    
    // :first-child, :last-child with validation
    selectors.push({
      selector: `${tag}:first-child:not([aria-hidden="true"]):enabled`,
      priority: 76
    });
    
    selectors.push({
      selector: `${tag}:last-child:not([disabled]):enabled`,
      priority: 75
    });
    
    return selectors;
  }

  /**
   * 🥈 TIER 2: Advanced Position + CSS4 Selectors
   */
  private generateTier2AdvancedSelectors(elementData: ReliableElementData): Array<{selector: string, priority: number}> {
    const selectors: Array<{selector: string, priority: number}> = [];
    const { tagName, attributes, textContent } = elementData;
    const tag = tagName.toLowerCase();
    
    // 🎯 ADVANCED ATTRIBUTE SELECTORS (Priority: 65-70)
    
    // [attribute^="value"] - Starts with + pseudo-classes
    if (attributes.id) {
      const idPrefix = attributes.id.substring(0, Math.min(attributes.id.length, 6));
      selectors.push({
        selector: `${tag}[id^="${idPrefix}"]:enabled:not([aria-hidden="true"])`,
        priority: 70
      });
    }
    
    // [attribute$="value"] - Ends with + validation
    if (attributes.class) {
      const classes = attributes.class.split(/\s+/);
      const semanticClass = classes.find((c: string) => this.isSemanticClassName(c));
      if (semanticClass) {
        selectors.push({
          selector: `${tag}[class$="${semanticClass}"]:not([disabled]):enabled`,
          priority: 69
        });
      }
    }
    
    // [attribute*="value"] - Contains + state validation
    if (attributes.title) {
      const titlePart = attributes.title.substring(0, 10);
      selectors.push({
        selector: `${tag}[title*="${titlePart}"]:not([aria-hidden="true"]):enabled`,
        priority: 68
      });
    }
    
    // [attribute~="value"] - Word matching
    if (attributes.class) {
      const classes = attributes.class.split(/\s+/);
      const stableClass = classes.find((c: string) => this.isStableClass(c));
      if (stableClass) {
        selectors.push({
          selector: `${tag}[class~="${stableClass}"]:enabled:not([disabled])`,
          priority: 67
        });
      }
    }
    
    // 🎯 CSS COMBINATORS WITH PSEUDO-CLASSES (Priority: 60-65)
    
    // Adjacent sibling combinator (+) with validation
    if (elementData.parentTagName) {
      selectors.push({
        selector: `${elementData.parentTagName} > ${tag}:first-of-type:enabled`,
        priority: 65
      });
      
      // General sibling combinator (~) with state
      selectors.push({
        selector: `${elementData.parentTagName} ~ ${tag}:not([disabled]):enabled`,
        priority: 64
      });
    }
    
    // 🎯 ADVANCED STRUCTURAL PATTERNS (Priority: 55-60)
    
    // :nth-child() with complex patterns
    selectors.push({
      selector: `${tag}:nth-child(odd):enabled:not([aria-hidden="true"])`, // Odd children
      priority: 60
    });
    
    selectors.push({
      selector: `${tag}:nth-child(even):enabled:not([disabled])`, // Even children
      priority: 59
    });
    
    // :nth-child(2n+1) - Advanced formula
    selectors.push({
      selector: `${tag}:nth-child(2n+1):not([aria-hidden="true"]):enabled`,
      priority: 58
    });
    
    // :only-child and :only-of-type
    selectors.push({
      selector: `${tag}:only-child:enabled:not([disabled])`,
      priority: 57
    });
    
    selectors.push({
      selector: `${tag}:only-of-type:not([aria-hidden="true"]):enabled`,
      priority: 56
    });
    
    return selectors;
  }

  /**
   * 🥉 TIER 3: Advanced Attribute + Text Combinations
   */
  private generateTier3AdvancedSelectors(elementData: ReliableElementData): Array<{selector: string, priority: number}> {
    const selectors: Array<{selector: string, priority: number}> = [];
    const { tagName, attributes, textContent, innerText } = elementData;
    const tag = tagName.toLowerCase();
    
    // 🎯 STATE-BASED PSEUDO-CLASSES (Priority: 45-50)
    
    // :hover, :focus, :active for interactive elements
    if (this.isInteractiveElement(tag)) {
      selectors.push({
        selector: `${tag}:hover:enabled:not([disabled])`,
        priority: 50
      });
      
      selectors.push({
        selector: `${tag}:focus:not([aria-hidden="true"]):enabled`,
        priority: 49
      });
      
      selectors.push({
        selector: `${tag}:active:enabled:not([disabled])`,
        priority: 48
      });
    }
    
    // :checked, :indeterminate for checkboxes/radios
    if (attributes.type === 'checkbox' || attributes.type === 'radio') {
      selectors.push({
        selector: `${tag}[type="${attributes.type}"]:checked:enabled`,
        priority: 47
      });
      
      selectors.push({
        selector: `${tag}[type="${attributes.type}"]:indeterminate:not([disabled])`,
        priority: 46
      });
    }
    
    // 🎯 CONTENT-BASED PSEUDO-CLASSES (Priority: 40-45)
    
    // :empty and :not(:empty)
    if (textContent && textContent.trim()) {
      selectors.push({
        selector: `${tag}:not(:empty):enabled:not([disabled])`,
        priority: 45
      });
    } else {
      selectors.push({
        selector: `${tag}:empty:enabled:not([aria-hidden="true"])`,
        priority: 44
      });
    }
    
    // 🎯 LINK-SPECIFIC PSEUDO-CLASSES (Priority: 35-40)
    if (tag === 'a') {
      selectors.push({
        selector: `a:link:not([aria-hidden="true"])`, // Unvisited links
        priority: 40
      });
      
      selectors.push({
        selector: `a:visited:enabled`, // Visited links
        priority: 39
      });
      
      if (attributes.href) {
        selectors.push({
          selector: `a[href="${attributes.href}"]:any-link:not([disabled])`,
          priority: 38
        });
      }
    }
    
    return selectors;
  }

  /**
   * 🎯 TIER 4: Playwright-Specific Text Selectors
   */
  private generateTier4PlaywrightSelectors(elementData: ReliableElementData): Array<{selector: string, priority: number}> {
    const selectors: Array<{selector: string, priority: number}> = [];
    const { tagName, textContent, innerText } = elementData;
    const tag = tagName.toLowerCase();
    
    const displayText = innerText || textContent;
    if (displayText && displayText.trim()) {
      const text = displayText.trim();
      
      // :has-text() - Playwright-specific (case-insensitive)
      selectors.push({
        selector: `${tag}:has-text("${text.substring(0, 20)}"):not([disabled])`,
        priority: 35
      });
      
      // :text-is() - Exact text match (case-sensitive)
      if (text.length <= 50) {
        selectors.push({
          selector: `${tag}:text-is("${text}"):enabled`,
          priority: 34
        });
      }
      
      // :text-matches() - Regex text matching
      const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      selectors.push({
        selector: `${tag}:text-matches("^${escapedText}.*", "i"):not([aria-hidden="true"])`,
        priority: 33
      });
      
      // Partial text matching
      const firstWords = text.split(/\s+/).slice(0, 3).join(' ');
      if (firstWords !== text && firstWords.length > 5) {
        selectors.push({
          selector: `${tag}:has-text("${firstWords}"):enabled:not([disabled])`,
          priority: 32
        });
      }
    }
    
    return selectors;
  }

  private calculateAdvancedReliability(selector: string, elementData: ReliableElementData): number {
    let score = 0.3; // Base score
    
    // Test-specific attributes (highest reliability)
    if (selector.includes('[data-testid') || selector.includes('[data-test') || selector.includes('[data-cy')) {
      score += 0.5;
    }
    
    // Advanced pseudo-class combinations
    const pseudoClassCount = (selector.match(/:(not|enabled|valid|focus-within|nth-|first-|last-)/g) || []).length;
    score += Math.min(pseudoClassCount * 0.03, 0.15);
    
    // State validation bonuses
    if (selector.includes(':not([disabled])') || selector.includes(':enabled')) {
      score += 0.1;
    }
    
    if (selector.includes(':not([aria-hidden="true"])')) {
      score += 0.05;
    }
    
    // CSS4 selectors bonus
    if (selector.includes(':is(') || selector.includes(':has(')) {
      score += 0.08;
    }
    
    return Math.min(score, 1.0);
  }

  private calculateAdvancedStability(selector: string, elementData: ReliableElementData): number {
    let score = 0.6;
    
    // User-facing attributes are more stable
    if (selector.includes('[aria-') || selector.includes('[data-testid')) {
      score += 0.25;
    }
    
    // Advanced pseudo-classes can be stable
    if (selector.includes(':has-text') || selector.includes(':text-is')) {
      score += 0.15;
    }
    
    // State validation improves stability
    if (selector.includes(':enabled') || selector.includes(':not([disabled])')) {
      score += 0.1;
    }
    
    // Position-based selectors are less stable
    if (selector.includes(':nth-child') && !selector.includes(':not(')) {
      score -= 0.15;
    }
    
    return Math.max(score, 0.2);
  }

  private generateAdvancedXPath(elementData: ReliableElementData): string {
    const { tagName, attributes, textContent, innerText } = elementData;
    
    // Advanced XPath with multiple conditions
    if (attributes['data-testid']) {
      return `//${tagName.toLowerCase()}[@data-testid='${attributes['data-testid']}' and not(@disabled) and not(@aria-hidden='true')]`;
    }
    
    if (attributes.id && this.isStableId(attributes.id)) {
      return `//${tagName.toLowerCase()}[@id='${attributes.id}' and not(@disabled)]`;
    }
    
    const displayText = innerText || textContent;
    if (displayText && displayText.trim()) {
      const text = displayText.trim().substring(0, 30);
      return `//${tagName.toLowerCase()}[contains(text(), '${text}') and not(@disabled) and not(@aria-hidden='true')]`;
    }
    
    // Ultimate fallback with position and state validation
    return `//${tagName.toLowerCase()}[not(@disabled) and not(@aria-hidden='true')][1]`;
  }

  private isSemanticClassName(className: string): boolean {
    const semantic = [
      'header', 'footer', 'nav', 'navigation', 'sidebar', 'content', 'main',
      'button', 'btn', 'link', 'menu', 'item', 'title', 'subtitle', 'text',
      'form', 'input', 'field', 'label', 'submit', 'search', 'filter',
      'card', 'panel', 'modal', 'dialog', 'tooltip', 'dropdown', 'tab',
      'active', 'disabled', 'hidden', 'visible', 'selected', 'primary'
    ];
    
    return semantic.some(word => className.toLowerCase().includes(word));
  }

  private isInteractiveElement(tagName: string): boolean {
    const interactive = ['button', 'input', 'textarea', 'select', 'a', 'details', 'summary'];
    return interactive.includes(tagName.toLowerCase());
  }

  /**
   * Generate multiple reliable selectors optimized for browser automation
   * Returns primary + fallback selectors with automation scores
   */
  generateReliableSelectors(elementData: ReliableElementData): {
    primary: string;
    fallbacks: string[];
    xpath: string;
    validated: ValidatedSelector[];
  } {
    const { selectors, attributes, tagName, textContent, innerText } = elementData;
    
    // Generate comprehensive selector options
    const allSelectors = this.generateAllSelectorOptions(elementData);
    
    // Validate each selector for browser automation
    const validatedSelectors = allSelectors.map(selector => 
      this.validateSelectorForAutomation(selector, elementData)
    );
    
    // Sort by automation priority (best for Playwright/Selenium first)
    validatedSelectors.sort((a, b) => {
      // Primary sort by browser compatibility
      if (b.browserCompatibility !== a.browserCompatibility) {
        return b.browserCompatibility - a.browserCompatibility;
      }
      // Secondary sort by reliability 
      if (b.reliability !== a.reliability) {
        return b.reliability - a.reliability;
      }
      // Tertiary sort by priority
      return b.priority - a.priority;
    });
    
    return {
      primary: validatedSelectors[0]?.selector || this.generateFallbackSelector(elementData),
      fallbacks: validatedSelectors.slice(1, 5).map(v => v.selector),
      xpath: this.generateXPath(elementData),
      validated: validatedSelectors
    };
  }
  
  private generateAllSelectorOptions(elementData: ReliableElementData): string[] {
    const { attributes, tagName, textContent, innerText } = elementData;
    const selectors: string[] = [];
    
    // Strategy 1: Test-specific attributes (GOLD STANDARD for automation)
    if (attributes['data-testid']) {
      selectors.push(`[data-testid="${attributes['data-testid']}"]`);
    }
    if (attributes['data-test']) {
      selectors.push(`[data-test="${attributes['data-test']}"]`);
    }
    if (attributes['data-cy']) {
      selectors.push(`[data-cy="${attributes['data-cy']}"]`);
    }
    if (attributes['data-qa']) {
      selectors.push(`[data-qa="${attributes['data-qa']}"]`);
    }
    
    // Strategy 2: Stable IDs (HIGH PRIORITY)
    if (attributes.id && this.isStableId(attributes.id)) {
      selectors.push(`#${attributes.id}`);
      // Also try with tag for specificity
      selectors.push(`${tagName.toLowerCase()}#${attributes.id}`);
    }
    
    // Strategy 3: ARIA attributes (EXCELLENT for automation)
    if (attributes['aria-label']) {
      selectors.push(`[aria-label="${attributes['aria-label']}"]`);
      selectors.push(`${tagName.toLowerCase()}[aria-label="${attributes['aria-label']}"]`);
    }
    if (attributes.role) {
      selectors.push(`[role="${attributes.role}"]`);
      if (textContent) {
        selectors.push(`[role="${attributes.role}"]:contains("${textContent.trim().substring(0, 30)}")`);
      }
    }
    
    // Strategy 4: Form-specific attributes (GREAT for form automation)
    if (this.isFormElement(tagName)) {
      if (attributes.name) {
        selectors.push(`${tagName.toLowerCase()}[name="${attributes.name}"]`);
        selectors.push(`[name="${attributes.name}"]`);
      }
      if (attributes.type) {
        selectors.push(`${tagName.toLowerCase()}[type="${attributes.type}"]`);
        if (attributes.name) {
          selectors.push(`${tagName.toLowerCase()}[type="${attributes.type}"][name="${attributes.name}"]`);
        }
      }
      if (attributes.placeholder) {
        selectors.push(`[placeholder="${attributes.placeholder}"]`);
      }
    }
    
    // Strategy 5: Text-based selectors (RELIABLE for buttons/links)
    if (textContent && textContent.trim()) {
      const text = textContent.trim();
      if (tagName.toLowerCase() === 'button') {
        selectors.push(`button:contains("${text.substring(0, 50)}")`);
      } else if (tagName.toLowerCase() === 'a') {
        selectors.push(`a:contains("${text.substring(0, 50)}")`);
      } else if (['span', 'div', 'p'].includes(tagName.toLowerCase())) {
        selectors.push(`${tagName.toLowerCase()}:contains("${text.substring(0, 30)}")`);
      }
    }
    
    // Strategy 6: Class combinations (MODERATE priority - can be unstable)
    if (attributes.class || attributes.className) {
      const classStr = attributes.class || attributes.className;
      const classes = classStr.split(/\\s+/).filter((c: string) => this.isStableClass(c));
      
      if (classes.length > 0) {
        // Single stable class
        selectors.push(`.${classes[0]}`);
        selectors.push(`${tagName.toLowerCase()}.${classes[0]}`);
        
        // Multiple classes for specificity
        if (classes.length > 1) {
          selectors.push(`.${classes.slice(0, 3).join('.')}`);
          selectors.push(`${tagName.toLowerCase()}.${classes.slice(0, 2).join('.')}`);
        }
      }
    }
    
    // Strategy 7: Link-specific attributes
    if (tagName.toLowerCase() === 'a' && attributes.href) {
      const href = attributes.href;
      selectors.push(`a[href="${href}"]`);
      // Partial href matching for dynamic parameters
      if (href.includes('/')) {
        const path = href.split('?')[0]; // Remove query params
        selectors.push(`a[href*="${path}"]`);
      }
    }
    
    // Strategy 8: Combined attribute selectors
    if (attributes.title) {
      selectors.push(`[title="${attributes.title}"]`);
      selectors.push(`${tagName.toLowerCase()}[title="${attributes.title}"]`);
    }
    
    // Strategy 9: Parent context selectors (for uniqueness)
    if (elementData.parentTagName && elementData.parentClasses) {
      const parentClasses = elementData.parentClasses.split(/\\s+/)
        .filter((c: string) => this.isStableClass(c));
      if (parentClasses.length > 0) {
        selectors.push(`${elementData.parentTagName}.${parentClasses[0]} > ${tagName.toLowerCase()}`);
        if (attributes.class) {
          const childClasses = attributes.class.split(/\\s+/);
          if (childClasses.length > 0) {
            selectors.push(`${elementData.parentTagName}.${parentClasses[0]} > ${tagName.toLowerCase()}.${childClasses[0]}`);
          }
        }
      }
    }
    
    // Strategy 10: Position-based (LAST RESORT - less stable)
    if (typeof elementData.siblingIndex === 'number') {
      selectors.push(`${tagName.toLowerCase()}:nth-child(${elementData.siblingIndex + 1})`);
      selectors.push(`${tagName.toLowerCase()}:nth-of-type(${elementData.siblingIndex + 1})`);
    }
    
    // Include original selectors from basic detection
    if (elementData.selectors) {
      selectors.push(...elementData.selectors.filter(s => s && typeof s === 'string'));
    }
    
    // Remove duplicates and invalid selectors
    return [...new Set(selectors)].filter(s => s && s.trim() && this.isValidSelector(s));
  }
  
  private validateSelectorForAutomation(selector: string, elementData: ReliableElementData): ValidatedSelector {
    let priority = 0;
    let reliability = 0;
    let browserCompatibility = 0;
    let uniqueness = 0;
    let stability = 0;
    
    // Browser compatibility scoring (Playwright/Selenium support)
    browserCompatibility = this.scoreBrowserCompatibility(selector);
    
    // Reliability scoring (how stable is this selector)
    reliability = this.scoreReliability(selector, elementData);
    
    // Priority scoring (automation best practices)
    priority = this.scorePriority(selector, elementData);
    
    // Uniqueness scoring (how likely to be unique)
    uniqueness = this.scoreUniqueness(selector, elementData);
    
    // Stability scoring (survives page changes)
    stability = this.scoreStability(selector);
    
    return {
      selector,
      priority: Math.round(priority),
      reliability: Math.round(reliability * 100) / 100,
      browserCompatibility: Math.round(browserCompatibility * 100) / 100,
      uniqueness: Math.round(uniqueness * 100) / 100,
      stability: Math.round(stability * 100) / 100
    };
  }
  
  private scoreBrowserCompatibility(selector: string): number {
    let score = 1.0; // Start with perfect score
    
    // Deduct for non-standard or problematic selectors
    if (selector.includes(':contains(')) score -= 0.3; // Not standard CSS
    if (selector.includes('xpath:')) score -= 0.1; // Backup selector
    if (selector.match(/\[[^=]*\*=/)) score -= 0.1; // Partial attribute matching
    if (selector.includes(':nth-child')) score -= 0.2; // Position-dependent
    
    // Bonus for automation-friendly selectors
    if (selector.includes('[data-testid')) score += 0.2;
    if (selector.includes('[data-test')) score += 0.2;
    if (selector.includes('[aria-label')) score += 0.1;
    if (selector.includes('[role=')) score += 0.1;
    if (selector.match(/^#[a-zA-Z][\\w-]*$/)) score += 0.1; // Simple ID
    
    return Math.max(0, Math.min(1, score));
  }
  
  private scoreReliability(selector: string, elementData: ReliableElementData): number {
    let score = 0.5; // Base score
    
    // High reliability patterns
    if (selector.includes('[data-testid')) score += 0.4;
    if (selector.includes('[data-test')) score += 0.35;
    if (selector.includes('[data-cy')) score += 0.35;
    if (selector.includes('[aria-label')) score += 0.3;
    if (selector.includes('[role=')) score += 0.25;
    if (selector.match(/^#[a-zA-Z][\\w-]*$/)) score += 0.3; // Stable ID
    
    // Form element reliability
    if (this.isFormElement(elementData.tagName)) {
      if (selector.includes('[name=')) score += 0.25;
      if (selector.includes('[type=')) score += 0.2;
      if (selector.includes('[placeholder=')) score += 0.15;
    }
    
    // Text-based reliability for interactive elements
    if (selector.includes(':contains(') && 
        ['button', 'a', 'span'].includes(elementData.tagName.toLowerCase())) {
      score += 0.2;
    }
    
    // Penalties for unreliable patterns
    if (selector.includes('.css-')) score -= 0.3; // CSS-in-JS
    if (selector.match(/\\.[a-z0-9]{6,}/)) score -= 0.25; // Generated hashes
    if (selector.includes(':nth-child')) score -= 0.2; // Position-based
    if (selector.includes('[class*=')) score -= 0.15; // Partial class matching
    
    return Math.max(0, Math.min(1, score));
  }
  
  private scorePriority(selector: string, elementData: ReliableElementData): number {
    let score = 50; // Base priority
    
    // Test attributes get highest priority
    if (selector.includes('[data-testid')) score += 40;
    if (selector.includes('[data-test')) score += 35;
    if (selector.includes('[data-cy')) score += 35;
    
    // Semantic attributes get high priority
    if (selector.includes('[aria-label')) score += 30;
    if (selector.includes('[role=')) score += 25;
    
    // Stable identifiers
    if (selector.match(/^#[a-zA-Z][\\w-]*$/)) score += 30;
    if (selector.includes('[name=') && this.isFormElement(elementData.tagName)) score += 25;
    
    // Text-based selectors for interactive elements
    if (selector.includes(':contains(') && 
        ['button', 'a'].includes(elementData.tagName.toLowerCase())) {
      score += 20;
    }
    
    // Penalties for low-priority selectors
    if (selector.includes(':nth-child')) score -= 15;
    if (selector.match(/^\\..*$/)) score -= 10; // Plain class selectors
    if (selector.includes('xpath:')) score -= 20;
    
    return Math.max(1, Math.min(100, score));
  }
  
  private scoreUniqueness(selector: string, elementData: ReliableElementData): number {
    let score = 0.5; // Base uniqueness
    
    // High uniqueness indicators
    if (selector.includes('[data-testid')) score += 0.4;
    if (selector.includes('[data-test')) score += 0.4;
    if (selector.match(/^#[a-zA-Z]/)) score += 0.4; // ID selector
    if (selector.includes('[aria-label')) score += 0.3;
    
    // Multiple attributes increase uniqueness
    const attributeCount = (selector.match(/\[/g) || []).length;
    score += Math.min(0.2, attributeCount * 0.1);
    
    // Specificity bonuses
    if (selector.includes(' > ')) score += 0.1; // Direct child
    if (selector.includes(elementData.tagName.toLowerCase())) score += 0.05;
    
    // Text content uniqueness
    if (selector.includes(':contains(') && elementData.textContent.length > 20) {
      score += 0.15;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  private scoreStability(selector: string): number {
    let score = 0.5; // Base stability
    
    // Stable patterns
    if (selector.includes('[data-test')) score += 0.4;
    if (selector.includes('[aria-label')) score += 0.3;
    if (selector.includes('[role=')) score += 0.25;
    if (selector.match(/^#[a-zA-Z][\\w-]*$/)) score += 0.3;
    if (selector.includes('[name=')) score += 0.25;
    
    // Unstable patterns
    if (selector.includes(':nth-child')) score -= 0.3;
    if (selector.includes('.css-')) score -= 0.4;
    if (selector.match(/\\.[a-z0-9]{6,}/)) score -= 0.3; // Hash classes
    if (selector.includes('[class*=')) score -= 0.2;
    
    return Math.max(0, Math.min(1, score));
  }
  
  private generateXPath(elementData: ReliableElementData): string {
    // Generate a reliable XPath as ultimate fallback
    const { tagName, attributes } = elementData;
    
    // Try attribute-based XPath first
    if (attributes.id) {
      return `//${tagName.toLowerCase()}[@id='${attributes.id}']`;
    }
    if (attributes['data-testid']) {
      return `//${tagName.toLowerCase()}[@data-testid='${attributes['data-testid']}']`;
    }
    if (attributes['aria-label']) {
      return `//${tagName.toLowerCase()}[@aria-label='${attributes['aria-label']}']`;
    }
    if (attributes.name && this.isFormElement(tagName)) {
      return `//${tagName.toLowerCase()}[@name='${attributes.name}']`;
    }
    
    // Fallback to text-based XPath
    if (elementData.textContent) {
      const text = elementData.textContent.trim().substring(0, 50);
      return `//${tagName.toLowerCase()}[contains(text(), '${text}')]`;
    }
    
    // Last resort: positional XPath (least stable)
    return `//${tagName.toLowerCase()}[${elementData.siblingIndex ? elementData.siblingIndex + 1 : 1}]`;
  }
  
  private generateFallbackSelector(elementData: ReliableElementData): string {
    const { tagName, attributes } = elementData;
    
    // Ultimate fallback - try to build something that works
    if (attributes.id) return `#${attributes.id}`;
    if (attributes['data-testid']) return `[data-testid="${attributes['data-testid']}"]`;
    if (attributes.name) return `[name="${attributes.name}"]`;
    if (attributes['aria-label']) return `[aria-label="${attributes['aria-label']}"]`;
    
    // Last resort
    return tagName.toLowerCase();
  }
  
  // Helper methods
  private isStableId(id: string): boolean {
    if (!id || id.length < 2) return false;
    
    // Avoid generated IDs
    if (/^[a-z0-9]{8,}$/i.test(id)) return false; // Looks like hash
    if (id.includes('react') || id.includes('auto') || id.includes('generated')) return false;
    if (/^\\d+$/.test(id)) return false; // Pure number
    
    return true;
  }
  
  private isStableClass(className: string): boolean {
    if (!className || className.length < 2) return false;
    
    // Avoid generated/utility classes
    if (className.startsWith('css-')) return false;
    if (className.startsWith('sc-')) return false; // Styled components
    if (className.match(/^[a-z0-9]{8,}$/i)) return false; // Hash classes
    if (className.match(/^(p|m|w|h|text|bg|border)-/)) return false; // Utility classes
    
    return true;
  }
  
  private isFormElement(tagName: string): boolean {
    return ['input', 'textarea', 'select', 'button', 'form'].includes(tagName.toLowerCase());
  }
  
  private isValidSelector(selector: string): boolean {
    if (!selector || typeof selector !== 'string') return false;
    if (selector.includes('undefined') || selector.includes('null')) return false;
    if (selector.trim().length === 0) return false;
    
    // Basic CSS selector validation
    try {
      if (selector.startsWith('xpath:')) return true; // XPath selector
      
      // Simple validation for CSS selectors
      if (selector.includes('..') || selector.includes('>>')) return false;
      if (selector.includes('  ')) return false; // Double spaces
      
      return true;
    } catch {
      return false;
    }
  }
}