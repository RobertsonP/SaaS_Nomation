import { BrowserElement, BrowserDocument, GeneratedSelector } from './selector-strategy.interface';
import { isUniqueSelector, isStableValue } from '../selector-utils';

/**
 * Strategy: Semantic and stable attribute selectors
 * Handles: ARIA labels, roles, name attributes, stable HTML attributes
 */
export class SemanticStrategy {

  /**
   * Add semantic ARIA/role/name selectors
   */
  addSemanticSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
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
        isUnique: isUniqueSelector(selector, document),
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
        isUnique: isUniqueSelector(selector, document),
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
        isUnique: isUniqueSelector(selector, document),
        isPlaywrightOptimized: false
      });
    }
  }

  /**
   * Add stable attribute selectors (only meaningful, stable attributes)
   * Filters out temporary/generated values and focuses on semantic attributes
   */
  addStableAttributeSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
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
      if (!isStableValue(value)) {
        continue;
      }

      // Exact match with stable attribute
      const exactSelector = `${tag}[${attr.name}="${value}"]`;
      selectors.push({
        selector: exactSelector,
        confidence: 0.85, // Raised: Stable attributes are reliable
        type: 'css',
        description: `Stable ${attr.name} attribute selector`,
        isUnique: isUniqueSelector(exactSelector, document),
        isPlaywrightOptimized: true
      });

      // Combined with visibility for interactive elements
      if (['button', 'input', 'a', 'select', 'textarea'].includes(tag)) {
        selectors.push({
          selector: `${tag}[${attr.name}="${value}"]:visible`,
          confidence: 0.87,
          type: 'playwright',
          description: `Stable ${attr.name} with visibility`,
          isUnique: isUniqueSelector(exactSelector, document),
          isPlaywrightOptimized: true
        });
      }
    }
  }
}
