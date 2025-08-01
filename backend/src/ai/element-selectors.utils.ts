/**
 * Element Selectors Utilities
 * 
 * Contains all CSS selectors, constants, and utility functions for element detection.
 * This is the single source of truth for all element selection logic.
 */

/**
 * Comprehensive list of CSS selectors for element detection
 * Organized by priority and purpose for test automation
 */
export const ELEMENT_SELECTORS = [
  // 1. FORM ELEMENTS (User interaction)
  'button',
  'input',
  'textarea', 
  'select',
  'option',
  'optgroup',
  'label',
  'fieldset',
  'legend',
  'datalist',
  'output',
  'progress',
  'meter',
  
  // 2. NAVIGATION ELEMENTS
  'a',
  'area',
  'nav',
  
  // 3. TEXT CONTENT (For verification)
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p',
  'span',
  'strong',
  'em',
  'mark',
  'small',
  'del',
  'ins',
  'sub',
  'sup',
  'code',
  'kbd',
  'samp',
  'var',
  'time',
  'abbr',
  'address',
  'blockquote',
  'cite',
  'q',
  
  // 4. LIST CONTENT (For verification)
  'li',
  'dt',
  'dd',
  
  // 5. TABLE DATA (For verification)
  'th',
  'td',
  'caption',
  
  // 6. MEDIA ELEMENTS (For verification)
  'img',
  'picture',
  'video',
  'audio',
  'canvas',
  'svg',
  'iframe',
  'embed',
  'object',
  
  // 7. INTERACTIVE CONTENT
  'details',
  'summary',
  'dialog',
  
  // 8. TEST-SPECIFIC ATTRIBUTES (Highest priority)
  '[data-testid]',
  '[data-test]',
  '[data-cy]',
  '[data-e2e]',
  '[data-selenium]',
  '[data-automation]',
  '[data-qa]',
  '[test-id]',
  '[automation-id]',
  
  // 9. SEMANTIC ROLES
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="searchbox"]',
  '[role="switch"]',
  '[role="tooltip"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  
  // 10. JAVASCRIPT INTERACTIVE
  '[onclick]',
  '[onchange]',
  '[onsubmit]',
  '[tabindex]',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[draggable="true"]',
  
  // 11. ACCESSIBILITY ATTRIBUTES
  '[aria-label]',
  '[aria-labelledby]',
  '[aria-describedby]',
  '[aria-expanded]',
  '[aria-selected]',
  '[aria-checked]',
  '[aria-pressed]',
  
  // 12. COMMON UI PATTERNS
  '.btn',
  '.button',
  '.link',
  '.clickable',
  '.selectable',
  '.interactive',
  '.form-control',
  '.input',
  '.checkbox',
  '.radio',
  '.select',
  '.dropdown',
  '.menu-item',
  '.tab',
  '.card',
  '.modal',
  '.popup',
  '.tooltip',
  
  // 13. MODERN FRAMEWORK SELECTORS
  '[ng-click]',
  '[v-on\\:click]',
  '[v-click]',
  '[\\@click]',
  'router-link',
  'nuxt-link'
];

/**
 * Test-specific attributes with highest priority for selector generation
 */
export const TEST_ATTRIBUTES = [
  'data-testid',
  'data-test', 
  'data-cy',
  'data-e2e',
  'data-selenium',
  'data-automation',
  'data-qa',
  'test-id',
  'automation-id'
];

/**
 * Basic selectors for simple fallback extraction
 */
export const BASIC_SELECTORS = ['button', 'input', 'a', 'select', 'textarea'];

/**
 * CSS selector escaping utility
 * Escapes special characters that could break CSS selectors
 */
export function escapeCSSSelector(str: string): string {
  if (!str) return '';
  return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

/**
 * Test selector uniqueness utility
 * Returns true if the selector matches exactly one element
 */
export function testSelectorUniqueness(selector: string, document: Document): boolean {
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1;
  } catch (e) {
    return false;
  }
}

/**
 * Generate element type from tag name and attributes
 */
export function getElementType(tagName: string, element: Element): string {
  if (tagName === 'button' || 
      element.getAttribute('role') === 'button' || 
      element.getAttribute('type') === 'button' || 
      element.getAttribute('type') === 'submit') {
    return 'button';
  } else if (['input', 'textarea', 'select'].includes(tagName)) {
    return 'input';
  } else if (tagName === 'a') {
    return 'link';
  } else if (['form', 'fieldset'].includes(tagName)) {
    return 'form';
  } else if (tagName === 'nav' || element.getAttribute('role') === 'navigation') {
    return 'navigation';
  } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'].includes(tagName)) {
    return 'text';
  }
  return 'element';
}

/**
 * Check if element is a structural container that should be filtered
 */
export function isStructuralContainer(tagName: string): boolean {
  return ['div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav', 
          'ul', 'ol', 'dl', 'table', 'thead', 'tbody', 'tfoot', 'tr'].includes(tagName);
}

/**
 * Check if element has test-specific attributes
 */
export function hasTestAttributes(element: Element): boolean {
  return TEST_ATTRIBUTES.some(attr => element.hasAttribute(attr));
}

/**
 * Check if element is a form element
 */
export function isFormElement(tagName: string): boolean {
  return ['input', 'textarea', 'select', 'button', 'option', 'label'].includes(tagName);
}

/**
 * Check if element is interactive
 */
export function isInteractiveElement(element: Element, computedStyle: CSSStyleDeclaration): boolean {
  const hasClickHandlers = element.hasAttribute('onclick') ||
    element.hasAttribute('onchange') ||
    element.hasAttribute('role') && ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab'].includes(element.getAttribute('role'));
  
  return hasClickHandlers || computedStyle.cursor === 'pointer';
}

/**
 * Check if element is a text element with meaningful content
 */
export function isTextElement(tagName: string): boolean {
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 'li', 'th', 'td'].includes(tagName);
}

/**
 * Check if element is a media element
 */
export function isMediaElement(tagName: string): boolean {
  return ['img', 'video', 'audio', 'canvas', 'svg', 'iframe'].includes(tagName);
}