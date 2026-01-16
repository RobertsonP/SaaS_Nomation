import { BaseSelectorStrategy, SelectorOptions, GeneratedSelector } from './selector-strategy.interface';

/**
 * Strategy for generating ID-based selectors
 * Filters out auto-generated IDs that are unstable
 */
export class IdSelectorStrategy extends BaseSelectorStrategy {
  readonly name = 'id';
  readonly priority = 2;
  readonly requiresPlaywright = false;

  // Patterns that indicate auto-generated IDs
  private readonly generatedIdPatterns = [
    /^ember\d+$/,
    /^react-/,
    /^ng-/,
    /^vue-/,
    /^[a-f0-9]{8}-[a-f0-9]{4}-/i, // UUID pattern
    /^:[a-z0-9]+:$/,
    /^\d+$/,
    /^_/,
    /^id_\d+$/,
    /^auto_/
  ];

  generate(options: SelectorOptions): GeneratedSelector[] {
    const { element, document } = options;
    const selectors: GeneratedSelector[] = [];

    const id = element.id;
    if (id && !this.isGeneratedId(id)) {
      const selector = `#${this.escapeIdForCss(id)}`;
      selectors.push(this.createSelector(
        selector,
        0.82,
        'id',
        'Unique ID selector',
        document,
        true
      ));
    }

    return selectors;
  }

  private isGeneratedId(id: string): boolean {
    if (!id) return true;
    return this.generatedIdPatterns.some(pattern => pattern.test(id));
  }

  private escapeIdForCss(id: string): string {
    // CSS ID selectors need special character escaping
    return id.replace(/([^\w-])/g, '\\$1');
  }
}
