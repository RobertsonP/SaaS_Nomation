import { BaseSelectorStrategy, SelectorOptions, GeneratedSelector } from './selector-strategy.interface';

/**
 * Strategy for generating test-specific attribute selectors
 * Handles: data-testid, data-test, data-cy, data-test-id, data-automation
 */
export class TestIdSelectorStrategy extends BaseSelectorStrategy {
  readonly name = 'testid';
  readonly priority = 1;
  readonly requiresPlaywright = false;

  private readonly testAttributes = [
    'data-testid',
    'data-test',
    'data-cy',
    'data-test-id',
    'data-automation'
  ];

  generate(options: SelectorOptions): GeneratedSelector[] {
    const { element, document } = options;
    const selectors: GeneratedSelector[] = [];

    for (const attr of this.testAttributes) {
      const value = element.getAttribute?.(attr);
      if (value) {
        const selector = `[${attr}="${this.escapeAttributeValue(value)}"]`;
        selectors.push(this.createSelector(
          selector,
          0.85, // Test IDs are stable but not user-facing
          'testid',
          `Test-specific ${attr} attribute`,
          document,
          true
        ));
      }
    }

    return selectors;
  }
}
