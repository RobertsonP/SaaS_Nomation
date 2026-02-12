/**
 * Strategy interface for selector generation
 * Each strategy implements a specific approach to generating CSS/XPath selectors
 */

/**
 * Browser element list - represents NodeListOf in browser context
 */
export interface BrowserElementList {
  length: number;
  item(index: number): BrowserElement | null;
  [index: number]: BrowserElement;
  forEach(callback: (element: BrowserElement, index: number) => void): void;
}

/**
 * Browser context element - represents a DOM Element in page.evaluate()
 * This is a subset of the DOM Element interface for type safety
 *
 * Note: In browser context, this extends the actual Element interface.
 * For mock usage, only the core properties are required.
 */
export interface BrowserElement {
  tagName: string;
  id: string;
  className: string;
  textContent: string | null;
  innerHTML: string;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  querySelectorAll(selector: string): BrowserElementList;
  parentElement: BrowserElement | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow additional DOM properties for browser compatibility
}

/**
 * Browser context document - represents Document in page.evaluate()
 * Note: Includes index signature for browser DOM compatibility
 */
export interface BrowserDocument {
  querySelectorAll(selector: string): BrowserElementList;
  querySelector(selector: string): BrowserElement | null;
  body?: BrowserElement;
  documentElement?: BrowserElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow additional DOM properties for browser compatibility
}

export interface SelectorOptions {
  element: BrowserElement;
  document: BrowserDocument;
  prioritizeUniqueness: boolean;
  includePlaywrightSpecific: boolean;
  maxLength?: number;
  testableElementsOnly: boolean;
  allElements?: BrowserElement[];
}

// getBy* types kept for backward compatibility with existing stored selectors resolved via resolveLocator()
export type LocatorType = 'css' | 'xpath' | 'getByRole' | 'getByText' | 'getByLabel' | 'getByTestId' | 'getByPlaceholder' | 'getByTitle';

export interface GeneratedSelector {
  selector: string;
  confidence: number;
  type: 'id' | 'testid' | 'aria' | 'text' | 'xpath' | 'css' | 'playwright';
  description: string;
  isUnique: boolean;
  isPlaywrightOptimized: boolean;
  /** How to resolve this selector — 'css' for page.locator(), native methods for getBy* */
  locatorType?: LocatorType;
  /** Arguments for native locator methods (e.g. { role: 'button', name: 'Submit' }) */
  locatorArgs?: Record<string, unknown>;
}

export interface SelectorStrategy {
  /**
   * Strategy name for identification
   */
  readonly name: string;

  /**
   * Priority order (lower = higher priority)
   */
  readonly priority: number;

  /**
   * Whether this strategy requires Playwright-specific features
   */
  readonly requiresPlaywright: boolean;

  /**
   * Generate selectors using this strategy
   */
  generate(options: SelectorOptions): GeneratedSelector[];
}

/**
 * Base class with common utility methods for selector strategies
 */
export abstract class BaseSelectorStrategy implements SelectorStrategy {
  abstract readonly name: string;
  abstract readonly priority: number;
  readonly requiresPlaywright: boolean = false;

  abstract generate(options: SelectorOptions): GeneratedSelector[];

  /**
   * Check if a selector is unique in the document
   */
  protected isUnique(selector: string, document: BrowserDocument): boolean {
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1;
    } catch {
      return false;
    }
  }

  /**
   * Check if a selector matches the target element
   */
  protected matchesElement(selector: string, element: BrowserElement, document: BrowserDocument): boolean {
    try {
      const matches = document.querySelectorAll(selector);
      return Array.from(matches).includes(element);
    } catch {
      return false;
    }
  }

  /**
   * Escape special characters in attribute values
   */
  protected escapeAttributeValue(value: string): string {
    if (!value) return '';
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Get clean text content (first 50 chars, trimmed)
   */
  protected getCleanText(element: BrowserElement): string {
    const text = element.textContent?.trim() || '';
    return text.substring(0, 50);
  }

  /**
   * Check if element is interactive/testable
   */
  protected isTestableElement(element: BrowserElement): boolean {
    const tag = element.tagName?.toLowerCase();
    const role = element.getAttribute('role');

    const interactiveTags = ['button', 'input', 'textarea', 'select', 'a', 'form', 'img'];
    const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab'];

    return interactiveTags.includes(tag) ||
           interactiveRoles.includes(role) ||
           element.hasAttribute('onclick') ||
           element.hasAttribute('data-testid');
  }

  /**
   * Create a selector result object
   */
  protected createSelector(
    selector: string,
    confidence: number,
    type: GeneratedSelector['type'],
    description: string,
    document: BrowserDocument,
    isPlaywrightOptimized: boolean = false
  ): GeneratedSelector {
    return {
      selector,
      confidence,
      type,
      description,
      isUnique: this.isUnique(selector, document),
      isPlaywrightOptimized
    };
  }
}
