import { BrowserElement, BrowserDocument, GeneratedSelector } from './selector-strategy.interface';
import { escapeText, escapeRegex, isUniqueSelector, isGeneratedId, isStableValue } from '../selector-utils';

/**
 * Strategy: Combined/compound selectors and enhanced text selectors
 * Handles: comprehensive multi-attribute, deep combinator, enhanced text matching
 */
export class CombinedStrategy {

  /**
   * Enhanced :has-text() implementation (Playwright CSS extension)
   */
  addEnhancedTextSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    const text = element.textContent?.trim();
    const tag = element.tagName.toLowerCase();

    if (!text || text.length === 0) return;

    // Exact text match with :has-text()
    if (text.length > 0 && text.length <= 50) {
      selectors.push({
        selector: `${tag}:has-text("${escapeText(text)}")`,
        confidence: 0.82,
        type: 'playwright',
        description: 'Exact text match with :has-text()',
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // With visibility
      selectors.push({
        selector: `${tag}:has-text("${escapeText(text)}"):visible`,
        confidence: 0.84,
        type: 'playwright',
        description: 'Exact text match with visibility',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Partial text match with regex
    if (text.length > 10 && text.length <= 100) {
      const partialText = text.substring(0, 20);
      selectors.push({
        selector: `${tag}:has-text(/${escapeRegex(partialText)}/)`,
        confidence: 0.75,
        type: 'playwright',
        description: 'Partial text regex match',
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // Case-insensitive regex
      selectors.push({
        selector: `${tag}:has-text(/${escapeRegex(partialText)}/i)`,
        confidence: 0.73,
        type: 'playwright',
        description: 'Case-insensitive text match',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Combined with role
    const role = element.getAttribute('role');
    if (role && text.length <= 30) {
      selectors.push({
        selector: `[role="${role}"]:has-text("${escapeText(text)}"):visible`,
        confidence: 0.87,
        type: 'playwright',
        description: 'Role + text + visibility',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }
  }

  /**
   * Deep combinator >> selectors (Playwright-specific for shadow DOM piercing)
   */
  addDeepCombinatorSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    const parent = element.parentElement;
    if (!parent) return;

    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();

    // Parent ID >> child element
    if (parent.id && !isGeneratedId(parent.id)) {
      selectors.push({
        selector: `#${parent.id} >> ${tag}`,
        confidence: 0.78,
        type: 'playwright',
        description: 'Deep combinator with parent ID',
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // With text
      if (text && text.length > 0 && text.length <= 30) {
        selectors.push({
          selector: `#${parent.id} >> ${tag}:has-text("${escapeText(text)}")`,
          confidence: 0.83,
          type: 'playwright',
          description: 'Deep combinator with text',
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }

      // With visibility
      selectors.push({
        selector: `#${parent.id} >> ${tag}:visible`,
        confidence: 0.80,
        type: 'playwright',
        description: 'Deep combinator with visibility',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Parent role >> child element
    const parentRole = parent.getAttribute('role');
    if (parentRole) {
      selectors.push({
        selector: `[role="${parentRole}"] >> ${tag}`,
        confidence: 0.72,
        type: 'playwright',
        description: 'Deep combinator with parent role',
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // Child with role
      const childRole = element.getAttribute('role');
      if (childRole) {
        selectors.push({
          selector: `[role="${parentRole}"] >> [role="${childRole}"]:visible`,
          confidence: 0.76,
          type: 'playwright',
          description: 'Deep combinator role hierarchy',
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Common containers >> interactive elements
    const containerSelectors = ['nav', 'header', 'footer', 'main', '.menu', '.navbar', '[role="navigation"]'];
    for (const container of containerSelectors) {
      try {
        if (element.closest(container)) {
          if (['button', 'a', 'input'].includes(tag)) {
            selectors.push({
              selector: `${container} >> ${tag}:visible`,
              confidence: 0.68,
              type: 'playwright',
              description: `Container ${container} deep selector`,
              isUnique: false,
              isPlaywrightOptimized: true
            });
          }
        }
      } catch {
        // Ignore invalid selectors
      }
    }
  }

  /**
   * Add comprehensive combined selectors (multiple attributes for maximum uniqueness)
   * User requirement: "use all possible ways to describe selector as detailed as possible"
   */
  addComprehensiveCombinedSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const name = element.getAttribute('name');
    const type = element.getAttribute('type');
    const id = element.id;
    const placeholder = element.getAttribute('placeholder');
    const href = element.getAttribute('href');
    const parent = element.parentElement;

    // Strategy: Build LONG but UNIQUE selectors combining multiple stable attributes
    const parts: string[] = [];
    let confidence = 0.75; // Base confidence

    // Start with tag
    parts.push(tag);

    // Add stable attributes (each adds confidence)
    if (role) {
      parts.push(`[role="${role}"]`);
      confidence += 0.05;
    }

    if (ariaLabel) {
      parts.push(`[aria-label="${ariaLabel}"]`);
      confidence += 0.08; // ARIA labels are very stable
    }

    if (name && ['input', 'select', 'textarea'].includes(tag)) {
      parts.push(`[name="${name}"]`);
      confidence += 0.04;
    }

    if (type && isStableValue(type)) {
      parts.push(`[type="${type}"]`);
      confidence += 0.03;
    }

    if (placeholder && isStableValue(placeholder)) {
      parts.push(`[placeholder="${placeholder}"]`);
      confidence += 0.03;
    }

    // Add visibility for interactive elements
    if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) {
      parts.push(':visible');
      confidence += 0.02;
    }

    // Add text matching for short, meaningful text
    if (text && text.length > 0 && text.length <= 30) {
      parts.push(`:has-text("${escapeText(text)}")`);
      confidence += 0.06; // Text is user-facing
    }

    // Only add if we have multiple attributes (comprehensive)
    if (parts.length >= 3) {
      selectors.push({
        selector: parts.join(''),
        confidence: Math.min(confidence, 0.95), // Cap at 0.95
        type: 'playwright',
        description: `Comprehensive multi-attribute selector`,
        isUnique: false, // Assume non-unique for safety
        isPlaywrightOptimized: true
      });
    }

    // Parent context + comprehensive child (for even more uniqueness)
    if (parent && (parent.id || parent.getAttribute('role'))) {
      const parentParts: string[] = [];

      if (parent.id && !isGeneratedId(parent.id)) {
        parentParts.push(`#${parent.id}`);
        confidence = 0.88;
      } else if (parent.getAttribute('role')) {
        parentParts.push(`[role="${parent.getAttribute('role')}"]`);
        confidence = 0.82;
      }

      if (parentParts.length > 0 && parts.length >= 2) {
        selectors.push({
          selector: `${parentParts.join('')} >> ${parts.join('')}`,
          confidence: Math.min(confidence + 0.05, 0.95),
          type: 'playwright',
          description: `Parent-child comprehensive selector`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Form inputs: Combine multiple form-specific attributes
    if (['input', 'textarea', 'select'].includes(tag)) {
      const formParts: string[] = [tag];
      let formConfidence = 0.80;

      if (name) {
        formParts.push(`[name="${name}"]`);
        formConfidence += 0.04;
      }

      if (type && isStableValue(type)) {
        formParts.push(`[type="${type}"]`);
        formConfidence += 0.03;
      }

      if (placeholder && isStableValue(placeholder)) {
        formParts.push(`[placeholder="${placeholder}"]`);
        formConfidence += 0.03;
      }

      if (ariaLabel) {
        formParts.push(`[aria-label="${ariaLabel}"]`);
        formConfidence += 0.05;
      }

      formParts.push(':visible');

      if (formParts.length >= 3) {
        selectors.push({
          selector: formParts.join(''),
          confidence: Math.min(formConfidence, 0.95),
          type: 'playwright',
          description: `Comprehensive form input selector`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Links: Combine href + text + role
    if (tag === 'a' && href && isStableValue(href)) {
      const linkParts: string[] = ['a', `[href="${href}"]`];
      let linkConfidence = 0.82;

      if (text && text.length > 0 && text.length <= 40) {
        linkParts.push(`:has-text("${escapeText(text)}")`);
        linkConfidence += 0.08;
      }

      if (role) {
        linkParts.push(`[role="${role}"]`);
        linkConfidence += 0.03;
      }

      linkParts.push(':visible');

      selectors.push({
        selector: linkParts.join(''),
        confidence: Math.min(linkConfidence, 0.95),
        type: 'playwright',
        description: `Comprehensive link selector`,
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Buttons: Combine type + text + role + aria
    if (tag === 'button') {
      const buttonParts: string[] = ['button'];
      let buttonConfidence = 0.80;

      if (type && isStableValue(type)) {
        buttonParts.push(`[type="${type}"]`);
        buttonConfidence += 0.02;
      }

      if (role) {
        buttonParts.push(`[role="${role}"]`);
        buttonConfidence += 0.03;
      }

      if (ariaLabel) {
        buttonParts.push(`[aria-label="${ariaLabel}"]`);
        buttonConfidence += 0.08;
      }

      if (text && text.length > 0 && text.length <= 40) {
        buttonParts.push(`:has-text("${escapeText(text)}")`);
        buttonConfidence += 0.07;
      }

      buttonParts.push(':visible');

      if (buttonParts.length >= 3) {
        selectors.push({
          selector: buttonParts.join(''),
          confidence: Math.min(buttonConfidence, 0.95),
          type: 'playwright',
          description: `Comprehensive button selector`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }
  }
}
