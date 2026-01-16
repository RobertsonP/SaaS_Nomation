import { BaseSelectorStrategy, SelectorOptions, GeneratedSelector } from './selector-strategy.interface';

/**
 * Strategy for generating Playwright-optimized selectors
 * Handles: text selectors, role selectors, placeholder/title attributes
 */
export class PlaywrightSelectorStrategy extends BaseSelectorStrategy {
  readonly name = 'playwright';
  readonly priority = 3;
  readonly requiresPlaywright = true;

  generate(options: SelectorOptions): GeneratedSelector[] {
    const { element, document } = options;
    const selectors: GeneratedSelector[] = [];

    const text = element.textContent?.trim();
    const role = element.getAttribute?.('role');
    const ariaLabel = element.getAttribute?.('aria-label');
    const title = element.getAttribute?.('title');
    const placeholder = element.getAttribute?.('placeholder');
    const tag = element.tagName?.toLowerCase() || 'div';

    // Text-based selectors (highest priority for user-facing elements)
    if (text && text.length > 0 && text.length < 100) {
      const escapedText = this.escapeText(text);
      const textSelector = `${tag}:has-text("${escapedText}")`;
      selectors.push(this.createSelector(
        textSelector,
        0.90,
        'playwright',
        'Text-based selector',
        document,
        true
      ));

      // Partial text match for longer text
      if (text.length > 10) {
        const partialText = this.escapeRegex(text.substring(0, 20));
        selectors.push({
          selector: `${tag}:has-text(/${partialText}/)`,
          confidence: 0.75,
          type: 'playwright',
          description: 'Partial text regex match',
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Role-based selectors
    if (role) {
      const roleSelector = `[role="${role}"]`;
      selectors.push(this.createSelector(
        roleSelector,
        0.88,
        'aria',
        'Role attribute selector',
        document,
        true
      ));

      // Role + ARIA label (highest priority combination)
      if (ariaLabel) {
        const combinedSelector = `[role="${role}"][aria-label="${this.escapeAttributeValue(ariaLabel)}"]`;
        selectors.push(this.createSelector(
          combinedSelector,
          0.95,
          'aria',
          'Role with ARIA label (most resilient)',
          document,
          true
        ));
      }
      // Role + text combination
      else if (text && text.length < 50) {
        const escapedText = this.escapeText(text);
        const combinedSelector = `[role="${role}"]:has-text("${escapedText}")`;
        selectors.push(this.createSelector(
          combinedSelector,
          0.93,
          'playwright',
          'Role with text content',
          document,
          true
        ));
      }
    }

    // Placeholder attribute (for form inputs)
    if (placeholder) {
      selectors.push(this.createSelector(
        `[placeholder="${this.escapeAttributeValue(placeholder)}"]`,
        0.86,
        'aria',
        'Placeholder attribute selector',
        document,
        true
      ));
    }

    // Title attribute
    if (title) {
      selectors.push(this.createSelector(
        `[title="${this.escapeAttributeValue(title)}"]`,
        0.78,
        'aria',
        'Title attribute selector',
        document,
        true
      ));
    }

    return selectors;
  }

  private escapeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .substring(0, 80); // Limit length
  }

  private escapeRegex(text: string): string {
    if (!text) return '';
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
