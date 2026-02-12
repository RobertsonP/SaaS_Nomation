import { BrowserElement, BrowserDocument, GeneratedSelector } from './selector-strategy.interface';
import { isUniqueSelector, isGeneratedId } from '../selector-utils';

/**
 * Strategy: Test-specific attributes and unique IDs
 * Handles: data-testid, data-test, data-cy, data-test-id, data-automation, #id
 */
export class TestAttributeStrategy {

  /**
   * Add selectors based on test-specific attributes (data-testid, data-test, etc.)
   */
  addTestSpecificSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
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
          isUnique: isUniqueSelector(selector, document),
          isPlaywrightOptimized: true
        });
      }
    }
  }

  /**
   * Add selectors based on unique, non-generated element IDs
   */
  addIdSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    const id = element.id;
    if (id && !isGeneratedId(id)) {
      const selector = `#${id}`;
      selectors.push({
        selector,
        confidence: 0.82, // Lowered: IDs less important than user-facing selectors
        type: 'id',
        description: `Unique ID selector`,
        isUnique: isUniqueSelector(selector, document),
        isPlaywrightOptimized: true
      });
    }
  }
}
