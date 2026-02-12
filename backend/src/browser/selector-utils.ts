import { BrowserElement, BrowserDocument } from './strategies/selector-strategy.interface';

/**
 * Check if attribute value is stable (not generated/temporary)
 */
export function isStableValue(value: string): boolean {
  if (!value || value.length === 0) return false;
  if (value.length > 100) return false; // Too long, likely generated

  // Reject pure UUID/hash patterns
  if (/^[a-f0-9]{8,}$/i.test(value)) return false;

  // Reject pure numbers
  if (/^\d+$/.test(value)) return false;

  // Reject timestamp patterns
  if (/\d{13}/.test(value)) return false;

  // Accept meaningful values
  return value.length >= 2;
}

/**
 * Escape text for selector usage
 */
export function escapeText(text: string): string {
  return text.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Escape text for regex usage
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a CSS selector matches exactly one element in the document
 */
export function isUniqueSelector(selector: string, document: BrowserDocument): boolean {
  try {
    // For text-based selectors, we can't easily verify uniqueness without actual page context
    if (selector.includes('text=') || selector.includes('role=')) {
      return false; // Conservative assumption
    }

    const elements = document.querySelectorAll(selector);
    return elements.length === 1;
  } catch {
    return false;
  }
}

/**
 * Check if an ID looks auto-generated (framework IDs, UUIDs, pure numbers, etc.)
 */
export function isGeneratedId(id: string): boolean {
  // Common patterns for auto-generated IDs
  const generatedPatterns = [
    /^[a-f0-9]{8,}$/i,      // Pure hex strings
    /^react-.*$/i,          // React generated IDs
    /^ember\d+$/i,          // Ember generated IDs
    /^\d+$/,                // Pure numbers
    /^temp_.*$/i,           // Temporary IDs
    /^auto_.*$/i,           // Auto-generated IDs
  ];

  return generatedPatterns.some(pattern => pattern.test(id));
}

/**
 * Check if an element is interactive/testable (suitable for test automation)
 */
export function isTestableElement(element: BrowserElement): boolean {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute('role');
  const type = element.getAttribute('type');

  // Interactive elements suitable for testing
  const interactiveTags = ['button', 'input', 'textarea', 'select', 'a', 'form', 'img'];
  const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab'];
  const testableTypes = ['button', 'submit', 'reset', 'text', 'email', 'password', 'checkbox', 'radio'];

  // Element with click handlers
  const hasClickHandler = element.onclick ||
                         element.getAttribute('onclick') ||
                         element.style.cursor === 'pointer';

  // Navigation elements
  const isNavElement = element.closest('nav') ||
                      element.closest('[role="navigation"]') ||
                      element.closest('.menu') ||
                      element.closest('.navbar');

  // Text elements with meaningful content
  const isTextElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'].includes(tag) &&
                       element.textContent &&
                       element.textContent.trim().length > 0 &&
                       element.textContent.trim().length < 200;

  return interactiveTags.includes(tag) ||
         interactiveRoles.includes(role) ||
         testableTypes.includes(type) ||
         hasClickHandler ||
         isNavElement ||
         isTextElement;
}
