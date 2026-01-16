import { BaseSelectorStrategy, SelectorOptions, GeneratedSelector } from './selector-strategy.interface';

/**
 * Strategy for generating XPath selectors as fallback
 * Used when CSS selectors are insufficient
 */
export class XPathSelectorStrategy extends BaseSelectorStrategy {
  readonly name = 'xpath';
  readonly priority = 9; // Lower priority - fallback only
  readonly requiresPlaywright = false;

  generate(options: SelectorOptions): GeneratedSelector[] {
    const { element, document } = options;
    const selectors: GeneratedSelector[] = [];

    const text = element.textContent?.trim();
    const tag = element.tagName?.toLowerCase() || '*';
    const ariaLabel = element.getAttribute?.('aria-label');
    const name = element.getAttribute?.('name');
    const id = element.id;

    // XPath by exact text
    if (text && text.length > 0 && text.length < 50) {
      const escapedText = this.escapeXPathText(text);
      selectors.push({
        selector: `xpath=//${tag}[normalize-space(text())=${escapedText}]`,
        confidence: 0.82,
        type: 'xpath',
        description: 'XPath exact text match',
        isUnique: false, // Can't easily verify XPath uniqueness
        isPlaywrightOptimized: true
      });

      // XPath contains text
      selectors.push({
        selector: `xpath=//${tag}[contains(text(), ${escapedText})]`,
        confidence: 0.75,
        type: 'xpath',
        description: 'XPath contains text',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // XPath by aria-label
    if (ariaLabel) {
      const escapedLabel = this.escapeXPathText(ariaLabel);
      selectors.push({
        selector: `xpath=//${tag}[@aria-label=${escapedLabel}]`,
        confidence: 0.88,
        type: 'xpath',
        description: 'XPath ARIA label',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // XPath by name attribute
    if (name) {
      const escapedName = this.escapeXPathText(name);
      selectors.push({
        selector: `xpath=//${tag}[@name=${escapedName}]`,
        confidence: 0.85,
        type: 'xpath',
        description: 'XPath name attribute',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // XPath by ID (fallback if CSS ID fails)
    if (id && id.length > 0) {
      selectors.push({
        selector: `xpath=//${tag}[@id="${id}"]`,
        confidence: 0.80,
        type: 'xpath',
        description: 'XPath ID selector',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // XPath combining multiple attributes for uniqueness
    if (ariaLabel && name) {
      const escapedLabel = this.escapeXPathText(ariaLabel);
      const escapedName = this.escapeXPathText(name);
      selectors.push({
        selector: `xpath=//${tag}[@aria-label=${escapedLabel} and @name=${escapedName}]`,
        confidence: 0.90,
        type: 'xpath',
        description: 'XPath combined attributes',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    return selectors;
  }

  private escapeXPathText(text: string): string {
    if (!text) return '""';

    // Handle quotes in text
    if (!text.includes("'")) {
      return `'${text}'`;
    }
    if (!text.includes('"')) {
      return `"${text}"`;
    }

    // Handle text with both quote types using concat
    const parts: string[] = [];
    let current = '';
    for (const char of text) {
      if (char === "'") {
        if (current) parts.push(`'${current}'`);
        parts.push(`"'"`);
        current = '';
      } else {
        current += char;
      }
    }
    if (current) parts.push(`'${current}'`);

    return `concat(${parts.join(', ')})`;
  }
}
