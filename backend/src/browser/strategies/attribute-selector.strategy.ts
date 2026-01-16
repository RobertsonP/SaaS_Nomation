import { BaseSelectorStrategy, SelectorOptions, GeneratedSelector } from './selector-strategy.interface';

/**
 * Strategy for generating stable attribute-based selectors
 * Focuses on attributes that don't change frequently
 */
export class AttributeSelectorStrategy extends BaseSelectorStrategy {
  readonly name = 'attribute';
  readonly priority = 5;
  readonly requiresPlaywright = false;

  // Stable attributes suitable for selectors
  private readonly stableAttributes = [
    'type',
    'href',
    'src',
    'alt',
    'value',
    'for',
    'action',
    'method',
    'target',
    'rel',
    'disabled',
    'readonly',
    'required',
    'checked',
    'selected',
    'multiple',
    'autocomplete',
    'autofocus',
    'pattern',
    'min',
    'max',
    'step',
    'maxlength',
    'minlength'
  ];

  // Attributes to skip (unstable or auto-generated)
  private readonly unstableAttributes = [
    'style',
    'class',
    'id', // Handled by IdSelectorStrategy
    'data-reactid',
    'data-react-checksum',
    'data-v-',
    'ng-',
    '_ngcontent-',
    '_nghost-'
  ];

  generate(options: SelectorOptions): GeneratedSelector[] {
    const { element, document } = options;
    const selectors: GeneratedSelector[] = [];
    const tag = element.tagName?.toLowerCase() || '*';

    // Type attribute (for inputs)
    const type = element.getAttribute?.('type');
    if (type) {
      selectors.push(this.createSelector(
        `${tag}[type="${type}"]`,
        0.70,
        'css',
        `Type attribute selector`,
        document,
        false
      ));
    }

    // Href for links (use partial match for dynamic URLs)
    const href = element.getAttribute?.('href');
    if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      // Extract path from URL for stability
      const path = this.extractStablePath(href);
      if (path) {
        selectors.push(this.createSelector(
          `a[href*="${this.escapeAttributeValue(path)}"]`,
          0.82,
          'css',
          'Href path selector',
          document,
          false
        ));
      }
    }

    // Alt attribute for images
    const alt = element.getAttribute?.('alt');
    if (alt && alt.length > 0 && alt.length < 100) {
      selectors.push(this.createSelector(
        `img[alt="${this.escapeAttributeValue(alt)}"]`,
        0.85,
        'css',
        'Image alt text selector',
        document,
        true
      ));
    }

    // For attribute (labels pointing to inputs)
    const forAttr = element.getAttribute?.('for');
    if (forAttr) {
      selectors.push(this.createSelector(
        `label[for="${this.escapeAttributeValue(forAttr)}"]`,
        0.88,
        'css',
        'Label for attribute selector',
        document,
        true
      ));
    }

    // Form-specific attributes
    if (tag === 'form') {
      const action = element.getAttribute?.('action');
      const method = element.getAttribute?.('method');

      if (action) {
        const path = this.extractStablePath(action);
        if (path) {
          selectors.push(this.createSelector(
            `form[action*="${this.escapeAttributeValue(path)}"]`,
            0.80,
            'css',
            'Form action selector',
            document,
            false
          ));
        }
      }

      if (method) {
        selectors.push(this.createSelector(
          `form[method="${method}"]`,
          0.65,
          'css',
          'Form method selector',
          document,
          false
        ));
      }
    }

    // Input state attributes
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      this.addInputStateSelectors(element, selectors, document, tag, type);
    }

    return selectors;
  }

  private addInputStateSelectors(
    element: any,
    selectors: GeneratedSelector[],
    document: any,
    tag: string,
    type: string | null
  ) {
    const required = element.hasAttribute?.('required');
    const disabled = element.hasAttribute?.('disabled');
    const readonly = element.hasAttribute?.('readonly');

    if (required && type) {
      selectors.push(this.createSelector(
        `${tag}[type="${type}"][required]`,
        0.78,
        'css',
        'Required input selector',
        document,
        false
      ));
    }

    if (disabled && type) {
      selectors.push(this.createSelector(
        `${tag}[type="${type}"][disabled]`,
        0.75,
        'css',
        'Disabled input selector',
        document,
        false
      ));
    }

    if (readonly && type) {
      selectors.push(this.createSelector(
        `${tag}[type="${type}"][readonly]`,
        0.75,
        'css',
        'Readonly input selector',
        document,
        false
      ));
    }
  }

  private extractStablePath(url: string): string | null {
    try {
      // For relative URLs, return as-is
      if (url.startsWith('/') && !url.startsWith('//')) {
        return url.split('?')[0].split('#')[0];
      }
      // For absolute URLs, extract pathname
      const parsed = new URL(url, 'https://example.com');
      return parsed.pathname;
    } catch {
      return null;
    }
  }
}
