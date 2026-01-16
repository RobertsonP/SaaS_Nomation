import { Injectable } from '@nestjs/common';
import {
  SelectorOptions,
  GeneratedSelector,
  BrowserElement,
  BrowserDocument
} from './strategies/selector-strategy.interface';

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
    
    // 5. STABLE ATTRIBUTE SELECTORS: Only stable, meaningful attributes
    this.addStableAttributeSelectors(element, selectors, document);

    // 6. COMPLEX CSS: Stable parent-child relationships
    this.addStableRelationalSelectors(element, selectors, document);

    // 7. PLAYWRIGHT CSS EXTENSIONS: Visibility, state, and text matching
    this.addVisibilitySelectors(element, selectors, document);
    this.addStateAttributeSelectors(element, selectors, document);
    this.addEnhancedTextSelectors(element, selectors, document);
    this.addDeepCombinatorSelectors(element, selectors, document);

    // 7b. C1.2: SIBLING-BASED SELECTORS: Form labels, button context, table cells
    this.addSiblingBasedSelectors(element, selectors, document);

    // 8. COMPREHENSIVE COMBINED SELECTORS: Multiple attributes for maximum uniqueness
    this.addComprehensiveCombinedSelectors(element, selectors, document);

    // 9. ULTIMATE FALLBACK: XPath for complex cases (only if needed)
    if (selectors.length < 3) {
      this.addXPathSelectors(element, selectors, document);
    }

    // REMOVED FRAGILE SELECTORS:
    // - Structural selectors (nth-child, nth-of-type) - break when DOM structure changes
    // - Class selectors - CSS classes change with styling frameworks and updates
    // - Layout-based selectors - deprecated by Playwright, viewport-dependent
    // - Functional pseudo-classes (:has, :not, :is) - low confidence, non-standard support
    
    // Sort by confidence and uniqueness, filter for high-confidence only
    return selectors
      .filter(s => s.confidence >= 0.75) // STRICT: Only robust selectors (user requirement)
      .sort((a, b) => {
        if (prioritizeUniqueness) {
          if (a.isUnique !== b.isUnique) return a.isUnique ? -1 : 1;
        }
        return b.confidence - a.confidence;
      })
      .slice(0, 10); // Return top 10 robust selectors
  }
  
  private isTestableElement(element: BrowserElement): boolean {
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
  
  private addTestSpecificSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
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
  
  private addIdSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
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
  
  private addPlaywrightSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
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
  
  private addSemanticSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
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
  
  // REMOVED: addStructuralSelectors - nth-child/nth-of-type are fragile and break on DOM changes
  
  /**
   * NEW: Add stable attribute selectors (only meaningful, stable attributes)
   * Filters out temporary/generated values and focuses on semantic attributes
   */
  private addStableAttributeSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
    const attributes = Array.from(element.attributes) as Attr[];
    const tag = element.tagName.toLowerCase();

    // List of stable attribute names (semantic, unlikely to change)
    const stableAttributes = [
      'name', 'type', 'href', 'src', 'alt',
      'value', 'for', 'action', 'method',
      'rel', 'target', 'autocomplete', 'inputmode'
    ];

    for (const attr of attributes) {
      // Skip already-handled attributes
      if (['id', 'class', 'data-testid', 'data-test', 'aria-label', 'role'].includes(attr.name)) {
        continue;
      }

      // Only process stable attributes
      if (!stableAttributes.includes(attr.name)) {
        continue;
      }

      const value = attr.value;

      // Validate value stability
      if (!this.isStableValue(value)) {
        continue;
      }

      // Exact match with stable attribute
      const exactSelector = `${tag}[${attr.name}="${value}"]`;
      selectors.push({
        selector: exactSelector,
        confidence: 0.85, // Raised: Stable attributes are reliable
        type: 'css',
        description: `Stable ${attr.name} attribute selector`,
        isUnique: this.isUniqueSelector(exactSelector, document),
        isPlaywrightOptimized: true
      });

      // Combined with visibility for interactive elements
      if (['button', 'input', 'a', 'select', 'textarea'].includes(tag)) {
        selectors.push({
          selector: `${tag}[${attr.name}="${value}"]:visible`,
          confidence: 0.87,
          type: 'playwright',
          description: `Stable ${attr.name} with visibility`,
          isUnique: this.isUniqueSelector(exactSelector, document),
          isPlaywrightOptimized: true
        });
      }
    }
  }

  /**
   * Helper: Check if attribute value is stable (not generated/temporary)
   */
  private isStableValue(value: string): boolean {
    if (!value || value.length === 0) return false;
    if (value.length > 100) return false; // Too long, likely generated

    // Reject pure UUID/hash patterns
    if (/^[a-f0-9]{8,}$/i.test(value)) return false;

    // Reject pure numbers
    if (/^\d+$/.test(value)) return false;

    // Reject timestamp patterns
    if (/\d{13}/.test(value)) return false;

    // Accept meaningful values
    return value.length >= 2;
  }
  
  /**
   * NEW: Add stable relational selectors (parent-child with stable anchors only)
   * Only uses ID-based or role-based parent relationships
   */
  private addStableRelationalSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
    // C1.2: NEW - Multi-level stable anchoring (walk up 3-5 levels)
    const anchorInfo = this.findStableAnchor(element);
    if (anchorInfo) {
      const anchorSelectors = this.buildSelectorFromAnchor(anchorInfo, element, document);
      selectors.push(...anchorSelectors);
    }

    // EXISTING: 1-level parent logic (keep for backward compatibility and additional options)
    const parent = element.parentElement;
    if (!parent) return;

    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();
    const role = element.getAttribute('role');

    // Parent ID > child (very stable)
    if (parent.id && !this.isGeneratedId(parent.id)) {
      const childSelector = `#${parent.id} > ${tag}`;
      selectors.push({
        selector: childSelector,
        confidence: 0.88,
        type: 'css',
        description: `Parent ID child selector`,
        isUnique: this.isUniqueSelector(childSelector, document),
        isPlaywrightOptimized: true
      });

      // Parent ID > child with text
      if (text && text.length > 0 && text.length < 40) {
        selectors.push({
          selector: `#${parent.id} > ${tag}:has-text("${this.escapeText(text)}")`,
          confidence: 0.92,
          type: 'playwright',
          description: `Parent ID child with text`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }

      // Parent ID > child with role
      if (role) {
        selectors.push({
          selector: `#${parent.id} > [role="${role}"]`,
          confidence: 0.91,
          type: 'playwright',
          description: `Parent ID child with role`,
          isUnique: this.isUniqueSelector(`#${parent.id} > [role="${role}"]`, document),
          isPlaywrightOptimized: true
        });
      }
    }

    // Parent role > child (semantic hierarchy)
    const parentRole = parent.getAttribute('role');
    if (parentRole) {
      selectors.push({
        selector: `[role="${parentRole}"] > ${tag}`,
        confidence: 0.82,
        type: 'playwright',
        description: `Parent role child selector`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // Parent role > child with role (semantic hierarchy)
      if (role) {
        selectors.push({
          selector: `[role="${parentRole}"] > [role="${role}"]`,
          confidence: 0.86,
          type: 'playwright',
          description: `Semantic role hierarchy`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Semantic containers > interactive elements
    const semanticContainers = ['nav', 'header', 'footer', 'main', 'aside', 'form'];
    let container = element.parentElement;
    let depth = 0;

    while (container && depth < 3) {
      const containerTag = container.tagName.toLowerCase();

      if (semanticContainers.includes(containerTag)) {
        // Semantic container >> child
        if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) {
          selectors.push({
            selector: `${containerTag} >> ${tag}:visible`,
            confidence: 0.78,
            type: 'playwright',
            description: `${containerTag} container child`,
            isUnique: false,
            isPlaywrightOptimized: true
          });

          // With text for specificity
          if (text && text.length > 0 && text.length < 30) {
            selectors.push({
              selector: `${containerTag} >> ${tag}:has-text("${this.escapeText(text)}"):visible`,
              confidence: 0.83,
              type: 'playwright',
              description: `${containerTag} container child with text`,
              isUnique: false,
              isPlaywrightOptimized: true
            });
          }
        }
        break;
      }

      container = container.parentElement;
      depth++;
    }
  }

  /**
   * C1.2: Find stable anchor element by walking up DOM tree
   * Returns nearest stable anchor (ID, aria-label, semantic tag, data attribute)
   * with path from anchor to target element
   */
  private findStableAnchor(element: BrowserElement): {
    anchor: BrowserElement;
    anchorSelector: string;
    pathToElement: BrowserElement[];
    confidence: number;
  } | null {
    const maxDepth = 5;
    let current = element.parentElement;
    let depth = 0;
    const path = [element];

    while (current && depth < maxDepth) {
      path.unshift(current);

      // Priority 1: Stable ID (not generated)
      if (current.id && !this.isGeneratedId(current.id)) {
        return {
          anchor: current,
          anchorSelector: `#${current.id}`,
          pathToElement: path,
          confidence: 0.92
        };
      }

      // Priority 2: ARIA label (highly descriptive)
      const ariaLabel = current.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.length > 0 && ariaLabel.length < 50) {
        const role = current.getAttribute('role');
        const tag = current.tagName.toLowerCase();
        const anchorSelector = role
          ? `[role="${role}"][aria-label="${ariaLabel}"]`
          : `${tag}[aria-label="${ariaLabel}"]`;

        return {
          anchor: current,
          anchorSelector,
          pathToElement: path,
          confidence: 0.90
        };
      }

      const tag = current.tagName.toLowerCase();
      const role = current.getAttribute('role');
      const semanticTags = ['main', 'nav', 'aside', 'form', 'header', 'footer'];

      // Priority 3: Landmark roles with aria-label (enhanced)
      const landmarkRoles = [
        'main', 'navigation', 'search', 'form',
        'region', 'complementary', 'contentinfo'
      ];

      if (role && landmarkRoles.includes(role)) {
        const landmarkAriaLabel = current.getAttribute('aria-label');

        // Landmark with aria-label (most specific)
        if (landmarkAriaLabel) {
          return {
            anchor: current,
            anchorSelector: `[role="${role}"][aria-label="${landmarkAriaLabel}"]`,
            pathToElement: path,
            confidence: 0.94
          };
        }

        // Landmark with semantic tag
        const semanticLandmarks = ['main', 'nav', 'form', 'aside', 'header', 'footer'];
        if (semanticLandmarks.includes(tag)) {
          return {
            anchor: current,
            anchorSelector: tag, // Use semantic tag over role
            pathToElement: path,
            confidence: 0.90
          };
        }

        // Landmark role alone
        return {
          anchor: current,
          anchorSelector: `[role="${role}"]`,
          pathToElement: path,
          confidence: 0.88
        };
      }

      // Priority 4: Semantic tag with role (non-landmark)
      if (semanticTags.includes(tag) && role) {
        return {
          anchor: current,
          anchorSelector: `${tag}[role="${role}"]`,
          pathToElement: path,
          confidence: 0.88
        };
      }

      // Priority 5: Data attributes (component markers)
      for (const attr of ['data-component', 'data-section', 'data-module', 'data-testid']) {
        const value = current.getAttribute(attr);
        if (value && !this.isGeneratedId(value) && value.length < 50) {
          return {
            anchor: current,
            anchorSelector: `[${attr}="${value}"]`,
            pathToElement: path,
            confidence: 0.86
          };
        }
      }

      // Priority 6: Semantic tags alone (last resort)
      if (semanticTags.includes(tag)) {
        return {
          anchor: current,
          anchorSelector: tag,
          pathToElement: path,
          confidence: 0.82
        };
      }

      current = current.parentElement;
      depth++;
    }

    return null; // No stable anchor found within max depth
  }

  /**
   * C1.2: Build multiple selector strategies from found anchor
   * Generates 2-4 selectors with different specificity levels
   */
  private buildSelectorFromAnchor(
    anchorInfo: ReturnType<typeof this.findStableAnchor>,
    element: BrowserElement,
    document: BrowserDocument
  ): GeneratedSelector[] {
    if (!anchorInfo) return [];

    const selectors: GeneratedSelector[] = [];
    const { anchorSelector, pathToElement, confidence } = anchorInfo;
    const targetTag = element.tagName.toLowerCase();
    const targetRole = element.getAttribute('role');
    const targetText = element.textContent?.trim();

    // Strategy 1: Anchor >> direct descendant (least specific)
    const directSelector = `${anchorSelector} >> ${targetTag}`;
    selectors.push({
      selector: directSelector,
      confidence: confidence * 0.95,
      type: 'playwright',
      description: 'Multi-level anchor to element',
      isUnique: this.isUniqueSelector(directSelector, document),
      isPlaywrightOptimized: true
    });

    // Strategy 2: Anchor >> element with role (more specific)
    if (targetRole) {
      const roleSelector = `${anchorSelector} >> [role="${targetRole}"]`;
      selectors.push({
        selector: roleSelector,
        confidence: confidence * 0.97,
        type: 'playwright',
        description: 'Anchor to role-based element',
        isUnique: this.isUniqueSelector(roleSelector, document),
        isPlaywrightOptimized: true
      });
    }

    // Strategy 3: Anchor >> element with text (most specific)
    if (targetText && targetText.length > 0 && targetText.length < 40) {
      const textSelector = `${anchorSelector} >> ${targetTag}:has-text("${this.escapeText(targetText)}")`;
      selectors.push({
        selector: textSelector,
        confidence: confidence * 0.98, // Highest confidence
        type: 'playwright',
        description: 'Anchor to element with text',
        isUnique: this.isUniqueSelector(textSelector, document),
        isPlaywrightOptimized: true
      });
    }

    // Strategy 4: Full path from anchor (maximum specificity, if path is short)
    if (pathToElement.length > 1 && pathToElement.length <= 4) {
      const pathSelectors = pathToElement.slice(1).map((el: BrowserElement) => {
        const elTag = el.tagName.toLowerCase();
        const elRole = el.getAttribute('role');
        return elRole ? `[role="${elRole}"]` : elTag;
      });

      const fullPathSelector = `${anchorSelector} > ${pathSelectors.join(' > ')}`;
      selectors.push({
        selector: fullPathSelector,
        confidence: confidence * 0.93,
        type: 'css',
        description: 'Full path from anchor',
        isUnique: this.isUniqueSelector(fullPathSelector, document),
        isPlaywrightOptimized: true
      });
    }

    return selectors;
  }

  /**
   * C1.2: Add sibling-based selectors for form fields, buttons, and table cells
   * Detects adjacent relationships (labels, headings, table cells)
   */
  private addSiblingBasedSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');

    // Strategy 1: Form label + input relationship
    if (['input', 'textarea', 'select'].includes(tag)) {
      this.addLabelInputSelectors(element, selectors, document);
    }

    // Strategy 2: Button/Link with preceding text context
    if (['button', 'a'].includes(tag) || role === 'button' || role === 'link') {
      this.addTextContextSelectors(element, selectors, document);
    }

    // Strategy 3: Table cell context
    if (tag === 'td' || element.closest('td')) {
      this.addTableCellSelectors(element, selectors, document);
    }
  }

  /**
   * C1.2: Generate selectors for form inputs based on adjacent or wrapping labels
   */
  private addLabelInputSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
    const tag = element.tagName.toLowerCase();
    const type = element.getAttribute('type');
    const name = element.getAttribute('name');

    // Check for preceding label (previousElementSibling)
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (sibling.tagName.toLowerCase() === 'label') {
        const labelText = sibling.textContent?.trim();
        if (labelText && labelText.length > 0 && labelText.length < 50) {
          // label ~ input (basic)
          const selector = `label:has-text("${this.escapeText(labelText)}") ~ ${tag}`;
          selectors.push({
            selector,
            confidence: 0.89,
            type: 'playwright',
            description: 'Input by adjacent label',
            isUnique: this.isUniqueSelector(selector, document),
            isPlaywrightOptimized: true
          });

          // label ~ input[type] (more specific)
          if (type) {
            const typeSelector = `label:has-text("${this.escapeText(labelText)}") ~ ${tag}[type="${type}"]`;
            selectors.push({
              selector: typeSelector,
              confidence: 0.91,
              type: 'playwright',
              description: 'Input by label and type',
              isUnique: this.isUniqueSelector(typeSelector, document),
              isPlaywrightOptimized: true
            });
          }

          // label ~ input[name] (most specific)
          if (name) {
            const nameSelector = `label:has-text("${this.escapeText(labelText)}") ~ ${tag}[name="${name}"]`;
            selectors.push({
              selector: nameSelector,
              confidence: 0.93,
              type: 'playwright',
              description: 'Input by label and name',
              isUnique: this.isUniqueSelector(nameSelector, document),
              isPlaywrightOptimized: true
            });
          }
        }
        break; // Found label, stop searching siblings
      }
      sibling = sibling.previousElementSibling;
    }

    // Check for wrapping label (parent element)
    const parent = element.parentElement;
    if (parent && parent.tagName.toLowerCase() === 'label') {
      const labelText = parent.textContent?.replace(element.value || '', '').trim();
      if (labelText && labelText.length > 0 && labelText.length < 50) {
        const selector = `label:has-text("${this.escapeText(labelText)}") >> ${tag}`;
        selectors.push({
          selector,
          confidence: 0.90,
          type: 'playwright',
          description: 'Input inside label',
          isUnique: this.isUniqueSelector(selector, document),
          isPlaywrightOptimized: true
        });
      }
    }
  }

  /**
   * C1.2: Generate selectors for buttons/links using preceding heading or label context
   */
  private addTextContextSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();

    if (!text || text.length === 0 || text.length > 40) return;

    // Check for preceding heading or label (up to 3 siblings back)
    let sibling = element.previousElementSibling;
    let distance = 0;
    const maxDistance = 3;

    while (sibling && distance < maxDistance) {
      const siblingTag = sibling.tagName.toLowerCase();
      const siblingText = sibling.textContent?.trim();

      // Heading + button/link pattern
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'span'].includes(siblingTag)) {
        if (siblingText && siblingText.length > 0 && siblingText.length < 50) {
          const selector = `${siblingTag}:has-text("${this.escapeText(siblingText)}") ~ ${tag}:has-text("${this.escapeText(text)}")`;
          selectors.push({
            selector,
            confidence: 0.87,
            type: 'playwright',
            description: 'Element with text context',
            isUnique: this.isUniqueSelector(selector, document),
            isPlaywrightOptimized: true
          });
        }
      }

      sibling = sibling.previousElementSibling;
      distance++;
    }
  }

  /**
   * C1.2: Generate selectors for elements in table cells using row context
   */
  private addTableCellSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
    const cell = element.closest('td') || element.closest('th');
    if (!cell) return;

    const row = cell.parentElement;
    if (!row) return;

    // Find first cell with text in this row (anchor cell)
    const cells = Array.from(row.children);
    const firstCellWithText = cells.find((c) => {
      const cellElement = c as unknown as BrowserElement;
      const text = cellElement.textContent?.trim();
      return text && text.length > 0 && text.length < 50;
    });

    if (firstCellWithText && firstCellWithText !== cell) {
      const anchorText = (firstCellWithText as unknown as BrowserElement).textContent?.trim() || '';
      const targetTag = element.tagName.toLowerCase();

      // td:has-text("anchor") ~ td >> element
      const selector = `td:has-text("${this.escapeText(anchorText)}") ~ td >> ${targetTag}`;
      selectors.push({
        selector,
        confidence: 0.85,
        type: 'playwright',
        description: 'Table cell with row context',
        isUnique: this.isUniqueSelector(selector, document),
        isPlaywrightOptimized: true
      });
    }
  }

  // REMOVED: addFunctionalSelectors - :has/:not/:is have low confidence and browser support issues

  /**
   * NEW: Add Playwright :visible pseudo-class selectors
   * Filters elements that are actually visible on the page
   */
  private addVisibilitySelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
    const tag = element.tagName.toLowerCase();
    // Cast to Element for browser API compatibility - at runtime this IS an Element
    const isVisible = element.offsetParent !== null ||
                     window.getComputedStyle(element as unknown as Element).display !== 'none';

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
  private addStateAttributeSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
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
  private addEnhancedTextSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
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
  private addDeepCombinatorSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
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
  private addLayoutBasedSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument, allElements: BrowserElement[]) {
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

  // REMOVED: addClassSelectors - CSS classes are fragile and change with styling updates

  /**
   * NEW: Add comprehensive combined selectors (multiple attributes for maximum uniqueness)
   * User requirement: "use all possible ways to describe selector as detailed as possible"
   */
  private addComprehensiveCombinedSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const name = element.getAttribute('name');
    const type = element.getAttribute('type');
    const id = element.id;
    const placeholder = element.getAttribute('placeholder');
    const href = element.getAttribute('href');
    const parent = element.parentElement;

    // Strategy: Build LONG but UNIQUE selectors combining multiple stable attributes
    const parts: string[] = [];
    let confidence = 0.75; // Base confidence

    // Start with tag
    parts.push(tag);

    // Add stable attributes (each adds confidence)
    if (role) {
      parts.push(`[role="${role}"]`);
      confidence += 0.05;
    }

    if (ariaLabel) {
      parts.push(`[aria-label="${ariaLabel}"]`);
      confidence += 0.08; // ARIA labels are very stable
    }

    if (name && ['input', 'select', 'textarea'].includes(tag)) {
      parts.push(`[name="${name}"]`);
      confidence += 0.04;
    }

    if (type && this.isStableValue(type)) {
      parts.push(`[type="${type}"]`);
      confidence += 0.03;
    }

    if (placeholder && this.isStableValue(placeholder)) {
      parts.push(`[placeholder="${placeholder}"]`);
      confidence += 0.03;
    }

    // Add visibility for interactive elements
    if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) {
      parts.push(':visible');
      confidence += 0.02;
    }

    // Add text matching for short, meaningful text
    if (text && text.length > 0 && text.length <= 30) {
      parts.push(`:has-text("${this.escapeText(text)}")`);
      confidence += 0.06; // Text is user-facing
    }

    // Only add if we have multiple attributes (comprehensive)
    if (parts.length >= 3) {
      selectors.push({
        selector: parts.join(''),
        confidence: Math.min(confidence, 0.95), // Cap at 0.95
        type: 'playwright',
        description: `Comprehensive multi-attribute selector`,
        isUnique: false, // Assume non-unique for safety
        isPlaywrightOptimized: true
      });
    }

    // Parent context + comprehensive child (for even more uniqueness)
    if (parent && (parent.id || parent.getAttribute('role'))) {
      const parentParts: string[] = [];

      if (parent.id && !this.isGeneratedId(parent.id)) {
        parentParts.push(`#${parent.id}`);
        confidence = 0.88;
      } else if (parent.getAttribute('role')) {
        parentParts.push(`[role="${parent.getAttribute('role')}"]`);
        confidence = 0.82;
      }

      if (parentParts.length > 0 && parts.length >= 2) {
        selectors.push({
          selector: `${parentParts.join('')} >> ${parts.join('')}`,
          confidence: Math.min(confidence + 0.05, 0.95),
          type: 'playwright',
          description: `Parent-child comprehensive selector`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Form inputs: Combine multiple form-specific attributes
    if (['input', 'textarea', 'select'].includes(tag)) {
      const formParts: string[] = [tag];
      let formConfidence = 0.80;

      if (name) {
        formParts.push(`[name="${name}"]`);
        formConfidence += 0.04;
      }

      if (type && this.isStableValue(type)) {
        formParts.push(`[type="${type}"]`);
        formConfidence += 0.03;
      }

      if (placeholder && this.isStableValue(placeholder)) {
        formParts.push(`[placeholder="${placeholder}"]`);
        formConfidence += 0.03;
      }

      if (ariaLabel) {
        formParts.push(`[aria-label="${ariaLabel}"]`);
        formConfidence += 0.05;
      }

      formParts.push(':visible');

      if (formParts.length >= 3) {
        selectors.push({
          selector: formParts.join(''),
          confidence: Math.min(formConfidence, 0.95),
          type: 'playwright',
          description: `Comprehensive form input selector`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Links: Combine href + text + role
    if (tag === 'a' && href && this.isStableValue(href)) {
      const linkParts: string[] = ['a', `[href="${href}"]`];
      let linkConfidence = 0.82;

      if (text && text.length > 0 && text.length <= 40) {
        linkParts.push(`:has-text("${this.escapeText(text)}")`);
        linkConfidence += 0.08;
      }

      if (role) {
        linkParts.push(`[role="${role}"]`);
        linkConfidence += 0.03;
      }

      linkParts.push(':visible');

      selectors.push({
        selector: linkParts.join(''),
        confidence: Math.min(linkConfidence, 0.95),
        type: 'playwright',
        description: `Comprehensive link selector`,
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Buttons: Combine type + text + role + aria
    if (tag === 'button') {
      const buttonParts: string[] = ['button'];
      let buttonConfidence = 0.80;

      if (type && this.isStableValue(type)) {
        buttonParts.push(`[type="${type}"]`);
        buttonConfidence += 0.02;
      }

      if (role) {
        buttonParts.push(`[role="${role}"]`);
        buttonConfidence += 0.03;
      }

      if (ariaLabel) {
        buttonParts.push(`[aria-label="${ariaLabel}"]`);
        buttonConfidence += 0.08;
      }

      if (text && text.length > 0 && text.length <= 40) {
        buttonParts.push(`:has-text("${this.escapeText(text)}")`);
        buttonConfidence += 0.07;
      }

      buttonParts.push(':visible');

      if (buttonParts.length >= 3) {
        selectors.push({
          selector: buttonParts.join(''),
          confidence: Math.min(buttonConfidence, 0.95),
          type: 'playwright',
          description: `Comprehensive button selector`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }
  }
  
  private addXPathSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument) {
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
      confidence: 0.75, // Raised: Only used as fallback when other selectors fail
      type: 'xpath',
      description: `XPath fallback selector`,
      isUnique: true, // XPath is generally unique
      isPlaywrightOptimized: true // Playwright supports XPath
    });
  }
  
  private isUniqueSelector(selector: string, document: BrowserDocument): boolean {
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
  
  // REMOVED: isStableClass - no longer needed since class selectors are removed
}