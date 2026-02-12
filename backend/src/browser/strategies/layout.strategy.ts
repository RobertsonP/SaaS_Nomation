import { BrowserElement, BrowserDocument, GeneratedSelector } from './selector-strategy.interface';
import { escapeText, escapeRegex, isUniqueSelector, isGeneratedId } from '../selector-utils';

/**
 * Strategy: Layout, visibility, and state attribute selectors
 * Handles: :visible, state attributes (ARIA states, disabled, readonly),
 *          layout-based selectors (:near, :right-of, :left-of, :above, :below)
 */
export class LayoutStrategy {

  /**
   * Add Playwright :visible pseudo-class selectors
   * Filters elements that are actually visible on the page
   */
  addVisibilitySelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    const tag = element.tagName.toLowerCase();
    // Cast to Element for browser API compatibility - at runtime this IS an Element
    const isVisible = element.offsetParent !== null ||
                     window.getComputedStyle(element as unknown as Element).display !== 'none';

    if (!isVisible) return; // Skip hidden elements

    // Add :visible to existing selectors
    const id = element.id;
    const role = element.getAttribute('role');

    // ID with visibility
    if (id && !isGeneratedId(id)) {
      selectors.push({
        selector: `#${id}:visible`,
        confidence: 0.84, // Slightly higher than plain ID (0.82) due to visibility filter
        type: 'playwright',
        description: 'ID selector with visibility filter',
        isUnique: isUniqueSelector(`#${id}`, document),
        isPlaywrightOptimized: true
      });
    }

    // Role with visibility
    if (role) {
      selectors.push({
        selector: `[role="${role}"]:visible`,
        confidence: 0.75,
        type: 'playwright',
        description: 'Role selector with visibility filter',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }

    // Tag with visibility (useful for unique tags)
    if (['button', 'input', 'textarea', 'select', 'a'].includes(tag)) {
      selectors.push({
        selector: `${tag}:visible`,
        confidence: 0.50,
        type: 'playwright',
        description: 'Tag selector with visibility filter',
        isUnique: false,
        isPlaywrightOptimized: true
      });
    }
  }

  /**
   * Add state attribute selectors (ARIA states, disabled, readonly, custom attributes)
   */
  addStateAttributeSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    const tag = element.tagName.toLowerCase();

    // State attributes to check
    const stateAttributes: Record<string, number> = {
      'aria-checked': 0.80,
      'aria-selected': 0.80,
      'aria-expanded': 0.78,
      'aria-pressed': 0.78,
      'disabled': 0.82,
      'readonly': 0.80,
      'checked': 0.82,
      'selected': 0.80,
      'aria-current': 0.76,
      'aria-disabled': 0.78,
      'robotId': 0.88,  // Custom attribute (high priority)
      'data-robotid': 0.88,
      'data-state': 0.74,
      'data-status': 0.74
    };

    for (const [attr, confidence] of Object.entries(stateAttributes)) {
      const value = element.getAttribute(attr);
      if (value !== null) {
        // Exact attribute with value
        const selectorWithValue = `${tag}[${attr}="${value}"]`;
        selectors.push({
          selector: selectorWithValue,
          confidence,
          type: 'aria',
          description: `State attribute ${attr}="${value}" selector`,
          isUnique: isUniqueSelector(selectorWithValue, document),
          isPlaywrightOptimized: true
        });

        // With visibility for interactive elements
        if (['button', 'input', 'a', 'select'].includes(tag)) {
          selectors.push({
            selector: `${tag}[${attr}="${value}"]:visible`,
            confidence: confidence + 0.02,
            type: 'playwright',
            description: `State attribute ${attr} with visibility`,
            isUnique: isUniqueSelector(selectorWithValue, document),
            isPlaywrightOptimized: true
          });
        }

        // Boolean attributes (just presence, no value needed)
        if (['disabled', 'readonly', 'checked', 'selected'].includes(attr) && value) {
          const boolSelector = `${tag}[${attr}]`;
          selectors.push({
            selector: boolSelector,
            confidence: confidence - 0.05,
            type: 'css',
            description: `Boolean state attribute ${attr}`,
            isUnique: isUniqueSelector(boolSelector, document),
            isPlaywrightOptimized: false
          });
        }
      }
    }

    // NOT patterns - exclude disabled/hidden elements
    if (tag === 'button' || tag === 'input' || tag === 'a') {
      const text = element.textContent?.trim();
      const isDisabled = element.getAttribute('disabled') !== null ||
                        element.getAttribute('aria-disabled') === 'true';

      if (!isDisabled) {
        // Only add :not() for enabled elements
        selectors.push({
          selector: `${tag}:not([disabled]):visible`,
          confidence: 0.72,
          type: 'playwright',
          description: 'Enabled element with visibility',
          isUnique: false,
          isPlaywrightOptimized: true
        });

        // Exclude hidden elements
        selectors.push({
          selector: `${tag}:not([aria-hidden="true"]):visible`,
          confidence: 0.70,
          type: 'playwright',
          description: 'Non-hidden element with visibility',
          isUnique: false,
          isPlaywrightOptimized: true
        });

        // Combined exclusions
        if (text && text.length > 0 && text.length < 50) {
          selectors.push({
            selector: `${tag}:not([disabled]):not([aria-hidden="true"]):visible:has-text("${text}")`,
            confidence: 0.85,
            type: 'playwright',
            description: 'Combined exclusion with text match',
            isUnique: isUniqueSelector(tag, document) && text.length < 20,
            isPlaywrightOptimized: true
          });
        }
      }
    }
  }

  /**
   * Add layout-based selectors (Playwright CSS extensions for spatial relationships)
   * These are useful for finding elements based on visual position
   */
  addLayoutBasedSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument, allElements: BrowserElement[]): void {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim();
    const id = element.id;
    const role = element.getAttribute('role');

    // Strategy: Look for nearby elements that can serve as reference points
    // (labels, headings, buttons with clear text)

    // Find potential reference elements (elements with meaningful text/ids/roles)
    const referenceElements: { selector: string; text: string | undefined; tag: string }[] = [];

    for (const refEl of allElements) {
      if (!refEl.elementData || refEl === element) continue;

      const refData = refEl.elementData;
      const refText = refData.textContent?.trim();
      const refId = refData.id;
      const refRole = refData.attributes?.role;

      // Good reference candidates: labels, headings, buttons with text
      const isGoodReference =
        (refText && refText.length > 2 && refText.length < 50) ||
        (refId && refId.length > 2 && refId.length < 30) ||
        (['label', 'h1', 'h2', 'h3', 'button', 'a'].includes(refData.tagName));

      if (isGoodReference) {
        // Build a selector for the reference element
        let refSelector: string | null = null;

        if (refId && refId.length < 30 && !isGeneratedId(refId)) {
          refSelector = `#${refId}`;
        } else if (refText && refText.length < 40) {
          refSelector = `:has-text("${escapeText(refText)}")`;
        } else if (refRole) {
          refSelector = `[role="${refRole}"]`;
        }

        if (refSelector) {
          referenceElements.push({
            selector: refSelector,
            text: refText,
            tag: refData.tagName
          });
        }
      }
    }

    // Generate layout-based selectors using reference elements
    // Limit to first 5 references to avoid too many selectors
    for (const ref of referenceElements.slice(0, 5)) {
      // :near() - Within 50px (default distance)
      selectors.push({
        selector: `${tag}:near(${ref.selector})`,
        confidence: 0.82,
        type: 'playwright',
        description: `Element near "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // With text for better specificity
      if (text && text.length > 0 && text.length < 40) {
        selectors.push({
          selector: `${tag}:has-text("${escapeText(text)}"):near(${ref.selector})`,
          confidence: 0.86,
          type: 'playwright',
          description: `Element with text near "${ref.text || ref.selector}"`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }

      // :right-of() - Element is to the right
      selectors.push({
        selector: `${tag}:right-of(${ref.selector})`,
        confidence: 0.80,
        type: 'playwright',
        description: `Element to the right of "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // :left-of() - Element is to the left
      selectors.push({
        selector: `${tag}:left-of(${ref.selector})`,
        confidence: 0.80,
        type: 'playwright',
        description: `Element to the left of "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // :above() - Element is above
      selectors.push({
        selector: `${tag}:above(${ref.selector})`,
        confidence: 0.78,
        type: 'playwright',
        description: `Element above "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // :below() - Element is below
      selectors.push({
        selector: `${tag}:below(${ref.selector})`,
        confidence: 0.78,
        type: 'playwright',
        description: `Element below "${ref.text || ref.selector}"`,
        isUnique: false,
        isPlaywrightOptimized: true
      });

      // Combined: Role + near reference
      if (role) {
        selectors.push({
          selector: `[role="${role}"]:near(${ref.selector})`,
          confidence: 0.84,
          type: 'playwright',
          description: `Role element near "${ref.text || ref.selector}"`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // Special case: Form inputs near their labels
    if (['input', 'textarea', 'select'].includes(tag)) {
      // Look for label elements specifically
      for (const refEl of allElements) {
        if (!refEl.elementData || refEl.elementData.tagName !== 'label') continue;

        const labelText = refEl.elementData.textContent?.trim();
        if (labelText && labelText.length > 0 && labelText.length < 50) {
          const labelSelector = `label:has-text("${escapeText(labelText)}")`;

          selectors.push({
            selector: `${tag}:right-of(${labelSelector})`,
            confidence: 0.87,
            type: 'playwright',
            description: `Form input to the right of label "${labelText}"`,
            isUnique: false,
            isPlaywrightOptimized: true
          });

          selectors.push({
            selector: `${tag}:below(${labelSelector})`,
            confidence: 0.86,
            type: 'playwright',
            description: `Form input below label "${labelText}"`,
            isUnique: false,
            isPlaywrightOptimized: true
          });

          selectors.push({
            selector: `${tag}:near(${labelSelector}):visible`,
            confidence: 0.89,
            type: 'playwright',
            description: `Form input near label "${labelText}"`,
            isUnique: false,
            isPlaywrightOptimized: true
          });
        }
      }
    }
  }
}
