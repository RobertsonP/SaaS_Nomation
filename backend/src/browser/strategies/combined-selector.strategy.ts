import { BaseSelectorStrategy, SelectorOptions, GeneratedSelector } from './selector-strategy.interface';

/**
 * Strategy for generating combined/compound selectors
 * Creates unique selectors by combining multiple attributes
 */
export class CombinedSelectorStrategy extends BaseSelectorStrategy {
  readonly name = 'combined';
  readonly priority = 8;
  readonly requiresPlaywright = false;

  generate(options: SelectorOptions): GeneratedSelector[] {
    const { element, document } = options;
    const selectors: GeneratedSelector[] = [];

    const tag = element.tagName?.toLowerCase() || '*';
    const type = element.getAttribute?.('type');
    const name = element.getAttribute?.('name');
    const role = element.getAttribute?.('role');
    const ariaLabel = element.getAttribute?.('aria-label');
    const placeholder = element.getAttribute?.('placeholder');
    const title = element.getAttribute?.('title');

    // Form element combinations
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      // Type + Name combination
      if (type && name) {
        selectors.push(this.createSelector(
          `${tag}[type="${type}"][name="${this.escapeAttributeValue(name)}"]`,
          0.90,
          'css',
          'Type + name combination',
          document,
          true
        ));
      }

      // Type + Placeholder combination
      if (type && placeholder) {
        selectors.push(this.createSelector(
          `${tag}[type="${type}"][placeholder="${this.escapeAttributeValue(placeholder)}"]`,
          0.88,
          'css',
          'Type + placeholder combination',
          document,
          true
        ));
      }

      // Name + Required/Disabled state
      if (name && element.hasAttribute?.('required')) {
        selectors.push(this.createSelector(
          `${tag}[name="${this.escapeAttributeValue(name)}"][required]`,
          0.85,
          'css',
          'Name + required combination',
          document,
          false
        ));
      }
    }

    // Button combinations
    if (tag === 'button' || (tag === 'input' && type === 'submit')) {
      const text = this.getCleanText(element);

      if (type && text) {
        selectors.push(this.createSelector(
          `${tag}[type="${type}"]:has-text("${this.escapeText(text)}")`,
          0.88,
          'playwright',
          'Button type + text combination',
          document,
          true
        ));
      }
    }

    // Link combinations
    if (tag === 'a') {
      const href = element.getAttribute?.('href');
      const text = this.getCleanText(element);

      if (href && text && text.length < 30) {
        const hrefPath = this.extractPath(href);
        if (hrefPath) {
          selectors.push(this.createSelector(
            `a[href*="${this.escapeAttributeValue(hrefPath)}"]:has-text("${this.escapeText(text)}")`,
            0.85,
            'playwright',
            'Link href + text combination',
            document,
            true
          ));
        }
      }
    }

    // Role + additional attribute combinations
    if (role) {
      if (name) {
        selectors.push(this.createSelector(
          `[role="${role}"][name="${this.escapeAttributeValue(name)}"]`,
          0.88,
          'aria',
          'Role + name combination',
          document,
          true
        ));
      }

      if (title) {
        selectors.push(this.createSelector(
          `[role="${role}"][title="${this.escapeAttributeValue(title)}"]`,
          0.82,
          'aria',
          'Role + title combination',
          document,
          false
        ));
      }
    }

    // ARIA combinations
    if (ariaLabel) {
      if (tag !== '*' && tag !== 'div' && tag !== 'span') {
        selectors.push(this.createSelector(
          `${tag}[aria-label="${this.escapeAttributeValue(ariaLabel)}"]`,
          0.92,
          'aria',
          'Tag + ARIA label combination',
          document,
          true
        ));
      }

      if (role) {
        selectors.push(this.createSelector(
          `[role="${role}"][aria-label="${this.escapeAttributeValue(ariaLabel)}"]`,
          0.95,
          'aria',
          'Role + ARIA label combination (highest priority)',
          document,
          true
        ));
      }
    }

    return selectors;
  }

  private escapeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .substring(0, 50);
  }

  private extractPath(url: string): string | null {
    try {
      if (url.startsWith('/') && !url.startsWith('//')) {
        return url.split('?')[0].split('#')[0];
      }
      const parsed = new URL(url, 'https://example.com');
      return parsed.pathname;
    } catch {
      return null;
    }
  }
}
