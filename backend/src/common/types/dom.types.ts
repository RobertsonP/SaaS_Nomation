/**
 * DOM-related type definitions for browser context operations
 * These types represent DOM elements when extracted in page.evaluate()
 */

/**
 * Serialized DOM element data extracted from browser context
 */
export interface SerializedElement {
  tagName: string;
  id: string;
  className: string;
  textContent: string;
  innerText: string;
  innerHTML: string;
  attributes: Record<string, string>;
  boundingBox: ElementBoundingBox | null;
  isVisible: boolean;
  isEnabled: boolean;
  computedStyles: Partial<CSSStyleDeclaration> | null;
}

/**
 * Element bounding box coordinates
 */
export interface ElementBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Element attributes map
 */
export interface ElementAttributes {
  id?: string;
  class?: string;
  name?: string;
  type?: string;
  value?: string;
  href?: string;
  src?: string;
  alt?: string;
  title?: string;
  placeholder?: string;
  role?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'data-testid'?: string;
  'data-test'?: string;
  'data-cy'?: string;
  [key: string]: string | undefined;
}

/**
 * Extracted element data for analysis
 */
export interface ExtractedElementData {
  tagName: string;
  id: string;
  classes: string[];
  text: string;
  attributes: ElementAttributes;
  rect: ElementBoundingBox | null;
  isInteractive: boolean;
  interactionType: ElementInteractionType;
  selector: string;
  xpath: string;
}

/**
 * Element interaction types
 */
export type ElementInteractionType =
  | 'click'
  | 'type'
  | 'select'
  | 'check'
  | 'hover'
  | 'scroll'
  | 'upload'
  | 'none';

/**
 * DOM query result
 */
export interface DOMQueryResult {
  element: SerializedElement | null;
  count: number;
  matchedElements: SerializedElement[];
}

/**
 * Page metadata extracted from DOM
 */
export interface PageMetadata {
  title: string;
  description: string | null;
  url: string;
  canonicalUrl: string | null;
  language: string | null;
  charset: string | null;
  viewport: string | null;
  robots: string | null;
}

/**
 * Form field data
 */
export interface FormFieldData {
  name: string;
  type: string;
  value: string;
  label: string | null;
  placeholder: string | null;
  required: boolean;
  disabled: boolean;
  readonly: boolean;
  options?: SelectOption[];
}

/**
 * Select option data
 */
export interface SelectOption {
  value: string;
  text: string;
  selected: boolean;
  disabled: boolean;
}

/**
 * Document ready state
 */
export type DocumentReadyState = 'loading' | 'interactive' | 'complete';

/**
 * Element visibility info
 */
export interface ElementVisibility {
  isVisible: boolean;
  isInViewport: boolean;
  isDisplayed: boolean;
  isHidden: boolean;
  opacity: number;
}

/**
 * Mock element data for selector generation testing
 * This represents extracted element data that is passed to createMockElement
 */
export interface MockElementData {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  innerHTML?: string;
  attributes?: Record<string, string | null>;
  parentId?: string;
  parentTagName?: string;
  parentRole?: string;
  siblingCount?: number;
  childrenCount?: number;
  firstChildTag?: string;
  isVisible?: boolean;
  hasClickHandler?: boolean;
  computedStyle?: {
    display?: string;
    visibility?: string;
    opacity?: string;
  };
}

/**
 * Mock element list for selector querying
 */
export interface MockElementList {
  length: number;
  item(index: number): MockElement | null;
  [index: number]: MockElement;
  forEach(callback: (element: MockElement, index: number) => void): void;
}

/**
 * Mock DOM element for selector testing in Node.js context
 * Simulates DOM Element interface for selector validation
 */
export interface MockElement {
  tagName: string;
  id: string;
  className: string;
  textContent: string;
  innerHTML: string;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
  setAttribute: (name: string, value: string) => void;
  querySelectorAll: (selector: string) => MockElementList;
  parentElement: MockParentElement | null;
  children: { length: number; 0?: { tagName: string } | null };
  offsetParent: object | null;
  onclick: (() => void) | null;
  style: {
    cursor: string;
    display: string;
    visibility: string;
    opacity: string;
  };
  getBoundingClientRect: () => ElementBoundingBox;
  closest: (selector: string) => object | null;
  attributes: Array<{ name: string; value: string | null }>;
  previousElementSibling: MockElement | null;
  nextElementSibling: MockElement | null;
  // Index signature for additional properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Mock parent element interface
 */
export interface MockParentElement {
  id?: string;
  tagName?: string;
  className: string;
  getAttribute: (name: string) => string | null;
  children: { length: number };
}

/**
 * Mock document for selector uniqueness testing
 */
export interface MockDocument {
  querySelectorAll: (selector: string) => MockElementList;
  querySelector: (selector: string) => MockElement | null;
  getElementById: (id: string) => MockElement | null;
  // Index signature for additional properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Wrapper for element with its data for mock document operations
 */
export interface MockElementWrapper {
  elementData: MockElementData;
}
