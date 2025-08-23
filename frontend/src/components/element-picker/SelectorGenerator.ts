interface ElementData {
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
}

export class SelectorGenerator {
  
  /**
   * Generate the optimal CSS selector for an element
   * PRIORITY: Stability over brevity - longer selectors are better if more stable
   */
  generateOptimalSelector(elementData: ElementData): string {
    const { selectors, attributes, tagName } = elementData;
    
    // Prioritize selectors by reliability and stability (not brevity)
    const prioritizedSelectors = this.prioritizeSelectorsForStability(selectors, attributes, tagName);
    
    // Return the highest priority selector
    return prioritizedSelectors[0] || this.generateRobustFallbackSelector(elementData);
  }

  /**
   * Prioritize selectors based on stability and reliability (not brevity)
   * Longer, more specific selectors are preferred if they're more stable
   */
  private prioritizeSelectorsForStability(selectors: string[], attributes: Record<string, any>, tagName: string): string[] {
    const scoredSelectors = selectors.map(selector => ({
      selector,
      score: this.calculateStabilityScore(selector, attributes, tagName)
    }));

    // Sort by stability score (higher is better)
    scoredSelectors.sort((a, b) => b.score - a.score);
    
    return scoredSelectors.map(item => item.selector);
  }


  /**
   * Calculate stability score for selector (prioritizes stable, specific selectors over short ones)
   */
  private calculateStabilityScore(selector: string, _attributes: Record<string, any>, tagName: string): number {
    let score = 0;

    // HIGHEST PRIORITY: Test-specific attributes (very stable)
    if (selector.includes('[data-testid')) {
      score += 100;
    } else if (selector.includes('[data-test')) {
      score += 95;
    } else if (selector.includes('[data-cy')) {
      score += 95; // Cypress test selectors
    } else if (selector.includes('[data-') && !selector.includes('[data-reactid')) {
      score += 85;
    }
    
    // HIGH PRIORITY: Meaningful IDs (stable)
    else if (selector.includes('#')) {
      score += 90;
      
      // Bonus for meaningful IDs
      const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        const id = idMatch[1];
        if (this.isMeaningfulId(id)) score += 10;
        if (id.length > 8) score += 5; // Longer IDs often more meaningful
      }
    }
    
    // HIGH PRIORITY: ARIA and semantic attributes (very stable)
    else if (selector.includes('[aria-label') || selector.includes('[role=')) {
      score += 80;
      // Bonus for specificity
      if (selector.includes(tagName.toLowerCase())) score += 10;
    }
    
    // MEDIUM-HIGH PRIORITY: Name attributes for form elements (stable)
    else if (selector.includes('[name=') && this.isFormElement(tagName)) {
      score += 75;
    }
    
    // MEDIUM PRIORITY: Stable class combinations
    else if (selector.includes('.')) {
      score += 60;
      
      // Count stable classes (avoid utility classes)
      const classNames = selector.match(/\.([a-zA-Z0-9_-]+)/g);
      if (classNames) {
        let stableClassCount = 0;
        let utilityPenalty = 0;
        
        classNames.forEach(className => {
          const name = className.substring(1);
          if (this.isSemanticClassName(name)) {
            stableClassCount++;
            score += 8;
          } else if (this.isComponentClassName(name)) {
            stableClassCount++;
            score += 5;
          } else if (this.hasUtilityPattern(name)) {
            utilityPenalty += 15;
          }
        });
        
        // Bonus for multiple stable classes (more specific = more stable)
        if (stableClassCount > 1) score += stableClassCount * 5;
        
        // Penalty for utility classes
        score -= utilityPenalty;
      }
    }
    
    // MEDIUM PRIORITY: Specific attribute selectors (fairly stable)
    else if (selector.includes('[') && selector.includes('=')) {
      score += 50;
      
      // Bonus for semantic attributes
      if (selector.includes('[type=') || selector.includes('[placeholder=')) {
        score += 15;
      }
    }
    
    // STABILITY BONUS: Longer, more specific selectors (opposite of brevity preference)
    const selectorLength = selector.length;
    if (selectorLength > 30) score += 20; // Long selectors often more specific
    if (selectorLength > 50) score += 10; // Very long selectors get extra bonus
    
    // STABILITY BONUS: Path selectors with meaningful components
    if (selector.includes('>') || selector.includes(' ')) {
      const pathSegments = selector.split(/[>\s]+/).filter(s => s.trim());
      if (pathSegments.length >= 2) {
        score += 30; // Multi-level paths are more specific
        
        // Bonus for each meaningful segment
        pathSegments.forEach(segment => {
          if (segment.includes('#') || segment.includes('[data-')) score += 8;
          if (segment.includes('.') && this.isSemanticClassName(segment.replace(/^\./, ''))) score += 5;
        });
      }
      
      // Small penalty for overly deep paths (but still prefer specificity)
      const depth = pathSegments.length;
      if (depth > 5) score -= 5; // Only small penalty, stability is more important
    }

    // PENALTIES for unstable selectors
    if (selector.includes(':nth-child')) score -= 20; // Position-based (brittle)
    if (selector.includes('[class*=')) score -= 15; // Partial class matching
    if (selector.includes('.css-')) score -= 25; // CSS-in-JS generated classes
    if (/\.[a-z0-9]{6,}$/i.test(selector)) score -= 30; // Looks like generated hash

    return Math.max(0, score);
  }

  /**
   * Calculate a score for selector quality (0-100) - DEPRECATED, use calculateStabilityScore
   */
  private calculateSelectorScore(selector: string, _attributes: Record<string, any>, tagName: string): number {
    let score = 0;

    // ID selector - highest priority
    if (selector.includes('#')) {
      score += 95;
      
      // Bonus for meaningful IDs
      const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        const id = idMatch[1];
        if (this.isMeaningfulId(id)) score += 5;
      }
    }
    
    // Data attribute selectors - very high priority
    else if (selector.includes('[data-testid')) {
      score += 90;
    } else if (selector.includes('[data-test')) {
      score += 85;
    } else if (selector.includes('[data-cy')) {
      score += 85; // Cypress test selectors
    } else if (selector.includes('[data-') && !selector.includes('[data-reactid')) {
      score += 75;
    }
    
    // ARIA attributes
    else if (selector.includes('[aria-label') || selector.includes('[role=')) {
      score += 70;
    }
    
    // Name attribute for form elements
    else if (selector.includes('[name=') && this.isFormElement(tagName)) {
      score += 65;
    }
    
    // Type attribute for inputs
    else if (selector.includes('[type=') && tagName.toLowerCase() === 'input') {
      score += 60;
    }
    
    // Class selectors
    else if (selector.includes('.')) {
      score += 50;
      
      // Bonus for semantic class names
      const classNames = selector.match(/\.([a-zA-Z0-9_-]+)/g);
      if (classNames) {
        const semanticBonus = classNames.reduce((bonus, className) => {
          const name = className.substring(1); // Remove the dot
          if (this.isSemanticClassName(name)) bonus += 10;
          if (this.isComponentClassName(name)) bonus += 5;
          return bonus;
        }, 0);
        score += Math.min(semanticBonus, 25); // Cap the bonus
      }
      
      // Penalty for utility/framework classes
      if (this.hasUtilityClasses(selector)) score -= 20;
    }
    
    // Tag selectors with specific attributes
    else if (selector.includes('[') && selector.includes('=')) {
      score += 40;
    }
    
    // Path selectors
    else if (selector.includes('>') || selector.includes(' ')) {
      score += 25;
      
      // Penalty for overly complex paths
      const depth = (selector.match(/>/g) || []).length + (selector.match(/\s+/g) || []).length;
      score -= Math.min(depth * 2, 15);
    }
    
    // Simple tag selectors (lowest priority)
    else {
      score += 10;
    }

    // Penalties
    if (selector.includes(':nth-child')) score -= 10; // Brittle selectors
    if (selector.length > 100) score -= 10; // Overly complex
    if (selector.includes('[class*=')) score -= 5; // Partial class matching can be fragile

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate a robust, stable fallback selector (prioritizes stability over brevity)
   */
  private generateRobustFallbackSelector(elementData: ElementData): string {
    const { tagName, attributes } = elementData;
    let selector = tagName.toLowerCase();
    const selectorParts = [selector];

    // Build the most stable selector possible by combining multiple attributes
    
    // 1. Add test-specific attributes (highest priority)
    if (attributes['data-testid']) {
      return `[data-testid="${attributes['data-testid']}"]`;
    }
    if (attributes['data-test']) {
      return `[data-test="${attributes['data-test']}"]`;
    }
    if (attributes['data-cy']) {
      return `[data-cy="${attributes['data-cy']}"]`;
    }
    
    // 2. Add meaningful ID
    if (attributes.id && this.isMeaningfulId(attributes.id)) {
      return `#${attributes.id}`;
    }
    
    // 3. Build composite selector for maximum stability
    if (attributes['aria-label']) {
      selectorParts.push(`[aria-label="${attributes['aria-label']}"]`);
    } else if (attributes.role) {
      selectorParts.push(`[role="${attributes.role}"]`);
    } else if (attributes.name && this.isFormElement(tagName)) {
      selectorParts.push(`[name="${attributes.name}"]`);
    } else if (attributes.type && tagName.toLowerCase() === 'input') {
      selectorParts.push(`[type="${attributes.type}"]`);
    } else if (attributes.placeholder) {
      selectorParts.push(`[placeholder="${attributes.placeholder}"]`);
    }
    
    // 4. Add stable class if available
    if (attributes.class || attributes.className) {
      const classStr = attributes.class || attributes.className;
      const classes = classStr.split(/\s+/).filter((c: string) => 
        this.isSemanticClassName(c) && !this.hasUtilityPattern(c)
      );
      
      if (classes.length > 0) {
        selectorParts.push(`.${classes[0]}`);
      }
    }
    
    // 5. Return the most specific combination available
    return selectorParts.join('');
  }


  /**
   * Infer the element type based on attributes and context
   */
  inferElementType(elementData: ElementData): 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text' {
    const { tagName, attributes, textContent, href } = elementData;
    const tag = tagName.toLowerCase();
    
    // Direct tag mapping
    switch (tag) {
      case 'button':
        return 'button';
      
      case 'input':
        const inputType = (attributes.type || 'text').toLowerCase();
        switch (inputType) {
          case 'submit':
          case 'button':
            return 'button';
          case 'checkbox':
          case 'radio':
            return 'input'; // Map to 'input' as per ProjectElement type
          default:
            return 'input';
        }
      
      case 'textarea':
        return 'input';
      
      case 'select':
        return 'input'; // Map to 'input' as per ProjectElement type
      
      case 'a':
        return 'link';
      
      case 'form':
        return 'form';
      
      case 'nav':
        return 'navigation';
      
      case 'img':
        return 'text'; // Map to 'text' as per ProjectElement type
    }

    // Infer based on attributes
    if (attributes.role) {
      const role = attributes.role.toLowerCase();
      switch (role) {
        case 'button':
          return 'button';
        case 'link':
          return 'link';
        case 'navigation':
          return 'navigation';
        case 'textbox':
          return 'input';
        case 'checkbox':
        case 'radio':
          return 'input'; // Map to 'input' as per ProjectElement type
      }
    }

    // Infer based on behavior
    if (href) return 'link';
    if (attributes.onclick || attributes.click) return 'button';
    
    // Infer based on content
    if (textContent) {
      const text = textContent.toLowerCase();
      if (text.includes('submit') || text.includes('save') || text.includes('send')) {
        return 'button';
      }
      if (text.includes('menu') || text.includes('nav')) {
        return 'navigation';
      }
    }

    // Infer based on class names
    if (attributes.class || attributes.className) {
      const classStr = (attributes.class || attributes.className).toLowerCase();
      if (classStr.includes('btn') || classStr.includes('button')) return 'button';
      if (classStr.includes('link')) return 'link';
      if (classStr.includes('nav')) return 'navigation';
      if (classStr.includes('input') || classStr.includes('field')) return 'input';
      if (classStr.includes('form')) return 'form';
    }

    // Default based on common container elements
    if (['div', 'span', 'p', 'section', 'article'].includes(tag)) {
      return 'text';
    }

    // Default fallback for any unrecognized elements
    return 'text';
  }

  /**
   * Generate a human-readable description
   */
  generateDescription(elementData: ElementData): string {
    const { attributes, textContent, innerText } = elementData;
    const elementType = this.inferElementType(elementData);
    
    // Use explicit labels first
    if (attributes['aria-label']) {
      return attributes['aria-label'];
    }
    
    if (attributes.title) {
      return attributes.title;
    }
    
    if (attributes.alt) {
      return `Image: ${attributes.alt}`;
    }

    // Use text content
    const displayText = innerText || textContent;
    if (displayText && displayText.trim()) {
      const cleanText = displayText.trim().substring(0, 50);
      return `${this.capitalizeFirst(elementType)}: ${cleanText}`;
    }

    // Use specific attributes
    if (attributes.placeholder) {
      return `${this.capitalizeFirst(elementType)} with placeholder: ${attributes.placeholder}`;
    }
    
    if (attributes.value && elementType === 'input') {
      return `${this.capitalizeFirst(elementType)} with value: ${attributes.value}`;
    }
    
    if (attributes.href) {
      const url = new URL(attributes.href, window.location.href);
      return `Link to ${url.hostname}${url.pathname}`;
    }
    
    if (attributes.src) {
      return `${this.capitalizeFirst(elementType)}: ${this.getFilename(attributes.src)}`;
    }

    // Use ID or meaningful attributes
    if (attributes.id && this.isMeaningfulId(attributes.id)) {
      return `${this.capitalizeFirst(elementType)}: ${this.humanizeId(attributes.id)}`;
    }

    // Fallback to element type
    return `${this.capitalizeFirst(elementType)} element`;
  }

  /**
   * Calculate confidence score for the element selection
   */
  calculateConfidence(elementData: ElementData): number {
    let confidence = 0.5; // Base confidence
    
    const { selectors, attributes, textContent } = elementData;
    const bestSelector = this.generateOptimalSelector(elementData);
    const selectorScore = this.calculateSelectorScore(bestSelector, attributes, elementData.tagName);
    
    // Selector quality contributes significantly
    confidence += (selectorScore / 100) * 0.4;
    
    // Meaningful content adds confidence
    if (textContent && textContent.trim()) {
      confidence += 0.15;
    }
    
    // Semantic attributes add confidence
    if (attributes['data-testid'] || attributes['aria-label'] || attributes.role) {
      confidence += 0.2;
    }
    
    // ID attributes add confidence
    if (attributes.id && this.isMeaningfulId(attributes.id)) {
      confidence += 0.15;
    }
    
    // Multiple selector options add confidence
    if (selectors.length > 2) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // Helper methods
  private isMeaningfulId(id: string): boolean {
    // Check if ID is meaningful (not auto-generated)
    if (id.length < 3) return false;
    if (/^[0-9]+$/.test(id)) return false; // Pure numeric
    if (/^[a-z0-9]{8,}$/.test(id)) return false; // Looks like hash
    if (id.includes('reactid') || id.includes('uniqueid')) return false;
    return true;
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

  private isComponentClassName(className: string): boolean {
    // React/Vue component class patterns
    return /^[A-Z]/.test(className) || className.includes('Component');
  }

  private hasUtilityClasses(selector: string): boolean {
    // Common utility/framework class patterns
    const utilityPatterns = [
      /\.(p|m|pt|pb|pl|pr|mt|mb|ml|mr)-\d/, // Spacing utilities
      /\.(text|bg|border)-/, // Color utilities  
      /\.(flex|grid|block|inline)/, // Layout utilities
      /\.(w|h)-\d/, // Size utilities
    ];
    
    return utilityPatterns.some(pattern => pattern.test(selector));
  }

  private hasUtilityPattern(className: string): boolean {
    // Check if a single class name follows utility/framework patterns
    const utilityPatterns = [
      /^(p|m|pt|pb|pl|pr|mt|mb|ml|mr)-\d/, // Spacing: p-4, mt-2, etc.
      /^(text|bg|border)-(white|black|gray|red|blue|green|yellow|purple|pink|indigo)/, // Colors
      /^(flex|grid|block|inline|hidden|visible)$/, // Display
      /^(w|h|min-w|min-h|max-w|max-h)-/, // Sizing
      /^(rounded|shadow|opacity|z)-/, // Visual utilities
      /^(absolute|relative|fixed|sticky)$/, // Positioning
      /^(top|bottom|left|right|inset)-/, // Positioning values
      /^(cursor|pointer|select|user)-/, // Interaction
      /^(transition|duration|ease|animate)-/, // Animation
      /^(font|leading|tracking|whitespace)-/, // Typography utilities
      /^(uppercase|lowercase|capitalize|truncate)$/, // Text transform
      /^sm:|md:|lg:|xl:|2xl:/, // Responsive prefixes
      /^hover:|focus:|active:|disabled:/, // State prefixes
      /^[a-z0-9]{8,}$/, // Generated hashes (8+ chars, lowercase/numbers)
    ];
    
    return utilityPatterns.some(pattern => pattern.test(className));
  }

  private isFormElement(tagName: string): boolean {
    const formElements = ['input', 'textarea', 'select', 'button'];
    return formElements.includes(tagName.toLowerCase());
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private humanizeId(id: string): string {
    return id
      .replace(/[-_]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  }

  private getFilename(url: string): string {
    try {
      return url.split('/').pop() || url;
    } catch {
      return url;
    }
  }
}