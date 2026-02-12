import { BrowserElement, BrowserDocument, GeneratedSelector } from './selector-strategy.interface';
import { escapeText, escapeRegex, isUniqueSelector } from '../selector-utils';

/**
 * Strategy: Playwright-specific selectors
 * Handles: text selectors, role selectors, placeholder/title attributes, native locators, implicit roles
 */
export class PlaywrightStrategy {

  /**
   * Add Playwright-specific CSS extension selectors (:has-text, role, placeholder, title)
   */
  addPlaywrightSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    const text = element.textContent?.trim();
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const title = element.getAttribute('title');
    const placeholder = element.getAttribute('placeholder');
    const tag = element.tagName.toLowerCase();

    // FIXED: Use valid CSS selector with :has-text() instead of text= engine syntax
    if (text && text.length > 0 && text.length < 100) {
      // Exact text match using :has-text() (valid CSS extension)
      const escapedText = escapeText(text);
      const textSelector = `${tag}:has-text("${escapedText}")`;
      selectors.push({
        selector: textSelector,
        confidence: 0.90, // Text selectors are #2 priority per Playwright (user-facing)
        type: 'playwright',
        description: `Text-based selector`,
        isUnique: isUniqueSelector(textSelector, document),
        isPlaywrightOptimized: true
      });

      // Partial text match with regex
      if (text.length > 10) {
        const partialText = escapeRegex(text.substring(0, 20));
        selectors.push({
          selector: `${tag}:has-text(/${partialText}/)`,
          confidence: 0.75,
          type: 'playwright',
          description: `Partial text regex match`,
          isUnique: false,
          isPlaywrightOptimized: true
        });
      }
    }

    // FIXED: Use valid CSS attribute selector [role="..."] instead of role= engine syntax
    if (role) {
      // Basic role selector (valid CSS)
      const roleSelector = `[role="${role}"]`;
      selectors.push({
        selector: roleSelector,
        confidence: 0.88,
        type: 'aria',
        description: `Role attribute selector`,
        isUnique: isUniqueSelector(roleSelector, document),
        isPlaywrightOptimized: true
      });

      // Role + ARIA label combination (highest priority - accessibility + uniqueness)
      if (ariaLabel) {
        const combinedSelector = `[role="${role}"][aria-label="${ariaLabel}"]`;
        selectors.push({
          selector: combinedSelector,
          confidence: 0.95, // Highest: Role + accessible name (Playwright #1 priority)
          type: 'aria',
          description: `Role with ARIA label (most resilient)`,
          isUnique: isUniqueSelector(combinedSelector, document),
          isPlaywrightOptimized: true
        });
      }
      // Role + text combination
      else if (text && text.length < 50) {
        const escapedText = escapeText(text);
        const combinedSelector = `[role="${role}"]:has-text("${escapedText}")`;
        selectors.push({
          selector: combinedSelector,
          confidence: 0.93, // Very high: Role + text (resilient + user-facing)
          type: 'playwright',
          description: `Role with text content`,
          isUnique: isUniqueSelector(`[role="${role}"]`, document),
          isPlaywrightOptimized: true
        });
      }
    }

    // FIXED: Use [placeholder="..."] instead of label= engine syntax
    if (placeholder) {
      selectors.push({
        selector: `[placeholder="${placeholder}"]`,
        confidence: 0.86, // Form inputs with placeholder (Playwright #4 priority)
        type: 'aria',
        description: `Placeholder attribute selector`,
        isUnique: isUniqueSelector(`[placeholder="${placeholder}"]`, document),
        isPlaywrightOptimized: true
      });
    }

    // FIXED: Use [title="..."] instead of title= engine syntax
    if (title) {
      selectors.push({
        selector: `[title="${title}"]`,
        confidence: 0.78,
        type: 'aria',
        description: `Title attribute selector`,
        isUnique: isUniqueSelector(`[title="${title}"]`, document),
        isPlaywrightOptimized: true
      });
    }
  }

  /**
   * Generate Playwright-native locators (getByRole, getByText, getByLabel, getByTestId, getByPlaceholder, getByTitle)
   * These are the highest-priority selectors per Playwright best practices:
   * 1. getByRole (accessibility) 2. getByText (user-facing) 3. getByLabel (form inputs) 4. getByTestId (last resort)
   */
  addNativeLocators(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const text = element.textContent?.trim();
    const placeholder = element.getAttribute('placeholder');
    const title = element.getAttribute('title');

    // Infer implicit ARIA role from tag
    const implicitRole = this.getImplicitRole(element);
    const effectiveRole = role || implicitRole;

    // 1. getByRole -- Playwright's #1 recommended locator
    if (effectiveRole) {
      const roleArgs: Record<string, unknown> = { role: effectiveRole };

      // Add name for specificity (aria-label > text content)
      if (ariaLabel) {
        roleArgs.name = ariaLabel;
      } else if (text && text.length > 0 && text.length < 60) {
        roleArgs.name = text;
      }

      // Build readable selector string for display/storage
      const nameDisplay = roleArgs.name ? `, { name: '${escapeText(roleArgs.name as string)}' }` : '';
      selectors.push({
        selector: `getByRole('${effectiveRole}'${nameDisplay})`,
        confidence: 0.96,
        type: 'aria',
        description: `Playwright getByRole('${effectiveRole}')`,
        isUnique: false,
        isPlaywrightOptimized: true,
        locatorType: 'getByRole',
        locatorArgs: roleArgs,
      });

      // Also add exact match variant if we have a name
      if (roleArgs.name) {
        selectors.push({
          selector: `getByRole('${effectiveRole}', { name: '${escapeText(roleArgs.name as string)}', exact: true })`,
          confidence: 0.97,
          type: 'aria',
          description: `Playwright getByRole with exact name match`,
          isUnique: false,
          isPlaywrightOptimized: true,
          locatorType: 'getByRole',
          locatorArgs: { ...roleArgs, exact: true },
        });
      }
    }

    // 2. getByLabel -- for form inputs associated with labels
    if (['input', 'textarea', 'select'].includes(tag)) {
      // Check for associated label via 'for' attribute
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
          const labelText = label.textContent?.trim();
          if (labelText && labelText.length > 0 && labelText.length < 60) {
            selectors.push({
              selector: `getByLabel('${escapeText(labelText)}')`,
              confidence: 0.95,
              type: 'aria',
              description: `Playwright getByLabel('${escapeText(labelText)}')`,
              isUnique: false,
              isPlaywrightOptimized: true,
              locatorType: 'getByLabel',
              locatorArgs: { text: labelText },
            });
          }
        }
      }

      // Check for wrapping label
      if (element.parentElement?.tagName.toLowerCase() === 'label') {
        const labelText = element.parentElement.textContent?.replace(element.value || '', '').trim();
        if (labelText && labelText.length > 0 && labelText.length < 60) {
          selectors.push({
            selector: `getByLabel('${escapeText(labelText)}')`,
            confidence: 0.94,
            type: 'aria',
            description: `Playwright getByLabel (wrapping label)`,
            isUnique: false,
            isPlaywrightOptimized: true,
            locatorType: 'getByLabel',
            locatorArgs: { text: labelText },
          });
        }
      }

      // Use aria-label as label fallback
      if (ariaLabel) {
        selectors.push({
          selector: `getByLabel('${escapeText(ariaLabel)}')`,
          confidence: 0.93,
          type: 'aria',
          description: `Playwright getByLabel (aria-label)`,
          isUnique: false,
          isPlaywrightOptimized: true,
          locatorType: 'getByLabel',
          locatorArgs: { text: ariaLabel },
        });
      }
    }

    // 3. getByPlaceholder -- for inputs with placeholder text
    if (placeholder && ['input', 'textarea'].includes(tag)) {
      selectors.push({
        selector: `getByPlaceholder('${escapeText(placeholder)}')`,
        confidence: 0.91,
        type: 'aria',
        description: `Playwright getByPlaceholder('${escapeText(placeholder)}')`,
        isUnique: false,
        isPlaywrightOptimized: true,
        locatorType: 'getByPlaceholder',
        locatorArgs: { text: placeholder },
      });
    }

    // 4. getByText -- for non-form elements with visible text
    if (text && text.length > 0 && text.length < 60 && !['input', 'textarea', 'select'].includes(tag)) {
      selectors.push({
        selector: `getByText('${escapeText(text)}')`,
        confidence: 0.90,
        type: 'text',
        description: `Playwright getByText('${escapeText(text)}')`,
        isUnique: false,
        isPlaywrightOptimized: true,
        locatorType: 'getByText',
        locatorArgs: { text: text },
      });

      // Exact match variant
      selectors.push({
        selector: `getByText('${escapeText(text)}', { exact: true })`,
        confidence: 0.92,
        type: 'text',
        description: `Playwright getByText with exact match`,
        isUnique: false,
        isPlaywrightOptimized: true,
        locatorType: 'getByText',
        locatorArgs: { text: text, exact: true },
      });
    }

    // 5. getByTitle -- for elements with title attribute
    if (title) {
      selectors.push({
        selector: `getByTitle('${escapeText(title)}')`,
        confidence: 0.85,
        type: 'aria',
        description: `Playwright getByTitle('${escapeText(title)}')`,
        isUnique: false,
        isPlaywrightOptimized: true,
        locatorType: 'getByTitle',
        locatorArgs: { text: title },
      });
    }

    // 6. getByTestId -- last resort per Playwright best practices
    const testIdAttrs = ['data-testid', 'data-test', 'data-cy', 'data-test-id'];
    for (const attr of testIdAttrs) {
      const testId = element.getAttribute(attr);
      if (testId) {
        selectors.push({
          selector: `getByTestId('${testId}')`,
          confidence: 0.88,
          type: 'testid',
          description: `Playwright getByTestId('${testId}')`,
          isUnique: false,
          isPlaywrightOptimized: true,
          locatorType: 'getByTestId',
          locatorArgs: { testId: testId },
        });
        break; // Only use first matching test ID attribute
      }
    }
  }

  /**
   * Map HTML tag to implicit ARIA role
   * See: https://www.w3.org/TR/html-aria/#docconformance
   */
  getImplicitRole(element: BrowserElement): string | null {
    const tag = element.tagName.toLowerCase();
    const type = element.getAttribute('type');

    const roleMap: Record<string, string> = {
      'a': 'link',
      'button': 'button',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'img': 'img',
      'nav': 'navigation',
      'main': 'main',
      'header': 'banner',
      'footer': 'contentinfo',
      'aside': 'complementary',
      'form': 'form',
      'table': 'table',
      'textarea': 'textbox',
      'select': 'combobox',
      'progress': 'progressbar',
      'dialog': 'dialog',
    };

    if (tag === 'input') {
      const inputRoleMap: Record<string, string> = {
        'button': 'button',
        'submit': 'button',
        'reset': 'button',
        'checkbox': 'checkbox',
        'radio': 'radio',
        'range': 'slider',
        'search': 'searchbox',
        'email': 'textbox',
        'tel': 'textbox',
        'text': 'textbox',
        'url': 'textbox',
        'number': 'spinbutton',
      };
      return inputRoleMap[type || 'text'] || null;
    }

    // Only return role for <a> if it has href
    if (tag === 'a' && !element.getAttribute('href')) {
      return null;
    }

    return roleMap[tag] || null;
  }
}
