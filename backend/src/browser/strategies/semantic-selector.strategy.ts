import { BaseSelectorStrategy, SelectorOptions, GeneratedSelector } from './selector-strategy.interface';

/**
 * Strategy for generating semantic/ARIA selectors
 * Handles: aria-label, aria-*, role, name attributes
 */
export class SemanticSelectorStrategy extends BaseSelectorStrategy {
  readonly name = 'semantic';
  readonly priority = 4;
  readonly requiresPlaywright = false;

  generate(options: SelectorOptions): GeneratedSelector[] {
    const { element, document } = options;
    const selectors: GeneratedSelector[] = [];

    const ariaLabel = element.getAttribute?.('aria-label');
    const role = element.getAttribute?.('role');
    const name = element.getAttribute?.('name');
    const ariaDescribedBy = element.getAttribute?.('aria-describedby');
    const ariaLabelledBy = element.getAttribute?.('aria-labelledby');

    // ARIA label selector
    if (ariaLabel) {
      selectors.push(this.createSelector(
        `[aria-label="${this.escapeAttributeValue(ariaLabel)}"]`,
        0.92,
        'aria',
        'ARIA label selector (accessibility)',
        document,
        true
      ));
    }

    // Role selector
    if (role) {
      selectors.push(this.createSelector(
        `[role="${role}"]`,
        0.85,
        'aria',
        'Role selector',
        document,
        true
      ));
    }

    // Name attribute (for form elements)
    if (name) {
      const tag = element.tagName?.toLowerCase() || '*';
      selectors.push(this.createSelector(
        `${tag}[name="${this.escapeAttributeValue(name)}"]`,
        0.88,
        'css',
        'Name attribute selector',
        document,
        true
      ));
    }

    // ARIA describedby
    if (ariaDescribedBy) {
      selectors.push(this.createSelector(
        `[aria-describedby="${this.escapeAttributeValue(ariaDescribedBy)}"]`,
        0.78,
        'aria',
        'ARIA describedby selector',
        document,
        false
      ));
    }

    // ARIA labelledby
    if (ariaLabelledBy) {
      selectors.push(this.createSelector(
        `[aria-labelledby="${this.escapeAttributeValue(ariaLabelledBy)}"]`,
        0.80,
        'aria',
        'ARIA labelledby selector',
        document,
        false
      ));
    }

    // Combined semantic selectors for uniqueness
    if (role && ariaLabel) {
      selectors.push(this.createSelector(
        `[role="${role}"][aria-label="${this.escapeAttributeValue(ariaLabel)}"]`,
        0.95,
        'aria',
        'Role + ARIA label combination',
        document,
        true
      ));
    }

    if (role && name) {
      const tag = element.tagName?.toLowerCase() || '*';
      selectors.push(this.createSelector(
        `${tag}[role="${role}"][name="${this.escapeAttributeValue(name)}"]`,
        0.90,
        'aria',
        'Role + name combination',
        document,
        true
      ));
    }

    return selectors;
  }
}
