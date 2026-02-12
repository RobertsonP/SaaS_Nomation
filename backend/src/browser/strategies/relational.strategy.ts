import { BrowserElement, BrowserDocument, GeneratedSelector } from './selector-strategy.interface';
import { escapeText, isUniqueSelector, isGeneratedId } from '../selector-utils';

/**
 * Strategy: Relational selectors (parent-child, sibling, anchor-based)
 * Handles: stable relational selectors, anchor walking, sibling-based, label-input, text context, table cells
 */
export class RelationalStrategy {

  /**
   * Add stable relational selectors (parent-child with stable anchors only)
   * Only uses ID-based or role-based parent relationships
   */
  addStableRelationalSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
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
    if (parent.id && !isGeneratedId(parent.id)) {
      const childSelector = `#${parent.id} > ${tag}`;
      selectors.push({
        selector: childSelector,
        confidence: 0.88,
        type: 'css',
        description: `Parent ID child selector`,
        isUnique: isUniqueSelector(childSelector, document),
        isPlaywrightOptimized: true
      });

      // Parent ID > child with text
      if (text && text.length > 0 && text.length < 40) {
        selectors.push({
          selector: `#${parent.id} > ${tag}:has-text("${escapeText(text)}")`,
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
          isUnique: isUniqueSelector(`#${parent.id} > [role="${role}"]`, document),
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
              selector: `${containerTag} >> ${tag}:has-text("${escapeText(text)}"):visible`,
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
  findStableAnchor(element: BrowserElement): {
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
      if (current.id && !isGeneratedId(current.id)) {
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
        if (value && !isGeneratedId(value) && value.length < 50) {
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
  buildSelectorFromAnchor(
    anchorInfo: ReturnType<RelationalStrategy['findStableAnchor']>,
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
      isUnique: isUniqueSelector(directSelector, document),
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
        isUnique: isUniqueSelector(roleSelector, document),
        isPlaywrightOptimized: true
      });
    }

    // Strategy 3: Anchor >> element with text (most specific)
    if (targetText && targetText.length > 0 && targetText.length < 40) {
      const textSelector = `${anchorSelector} >> ${targetTag}:has-text("${escapeText(targetText)}")`;
      selectors.push({
        selector: textSelector,
        confidence: confidence * 0.98, // Highest confidence
        type: 'playwright',
        description: 'Anchor to element with text',
        isUnique: isUniqueSelector(textSelector, document),
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
        isUnique: isUniqueSelector(fullPathSelector, document),
        isPlaywrightOptimized: true
      });
    }

    return selectors;
  }

  /**
   * C1.2: Add sibling-based selectors for form fields, buttons, and table cells
   * Detects adjacent relationships (labels, headings, table cells)
   */
  addSiblingBasedSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
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
  addLabelInputSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
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
          const selector = `label:has-text("${escapeText(labelText)}") ~ ${tag}`;
          selectors.push({
            selector,
            confidence: 0.89,
            type: 'playwright',
            description: 'Input by adjacent label',
            isUnique: isUniqueSelector(selector, document),
            isPlaywrightOptimized: true
          });

          // label ~ input[type] (more specific)
          if (type) {
            const typeSelector = `label:has-text("${escapeText(labelText)}") ~ ${tag}[type="${type}"]`;
            selectors.push({
              selector: typeSelector,
              confidence: 0.91,
              type: 'playwright',
              description: 'Input by label and type',
              isUnique: isUniqueSelector(typeSelector, document),
              isPlaywrightOptimized: true
            });
          }

          // label ~ input[name] (most specific)
          if (name) {
            const nameSelector = `label:has-text("${escapeText(labelText)}") ~ ${tag}[name="${name}"]`;
            selectors.push({
              selector: nameSelector,
              confidence: 0.93,
              type: 'playwright',
              description: 'Input by label and name',
              isUnique: isUniqueSelector(nameSelector, document),
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
        const selector = `label:has-text("${escapeText(labelText)}") >> ${tag}`;
        selectors.push({
          selector,
          confidence: 0.90,
          type: 'playwright',
          description: 'Input inside label',
          isUnique: isUniqueSelector(selector, document),
          isPlaywrightOptimized: true
        });
      }
    }
  }

  /**
   * C1.2: Generate selectors for buttons/links using preceding heading or label context
   */
  addTextContextSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
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
          const selector = `${siblingTag}:has-text("${escapeText(siblingText)}") ~ ${tag}:has-text("${escapeText(text)}")`;
          selectors.push({
            selector,
            confidence: 0.87,
            type: 'playwright',
            description: 'Element with text context',
            isUnique: isUniqueSelector(selector, document),
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
  private addTableCellSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
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
      const selector = `td:has-text("${escapeText(anchorText)}") ~ td >> ${targetTag}`;
      selectors.push({
        selector,
        confidence: 0.85,
        type: 'playwright',
        description: 'Table cell with row context',
        isUnique: isUniqueSelector(selector, document),
        isPlaywrightOptimized: true
      });
    }
  }
}
