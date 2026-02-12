import { BrowserElement, BrowserDocument, GeneratedSelector } from './selector-strategy.interface';

/**
 * Strategy: XPath fallback selectors
 * Used when CSS selectors are insufficient (< 3 selectors generated)
 */
export class XPathStrategy {

  /**
   * Generate XPath selectors as ultimate fallback
   */
  addXPathSelectors(element: BrowserElement, selectors: GeneratedSelector[], document: BrowserDocument): void {
    // Generate XPath for complex cases
    let xpath = '';
    let current: BrowserElement | null = element;
    const parts: string[] = [];

    while (current && current.nodeType === 1) {
      let part = current.tagName.toLowerCase();

      if (current.id) {
        part = `*[@id='${current.id}']`;
        parts.unshift(part);
        break;
      } else {
        const siblings = Array.from(current.parentElement?.children || [])
          .filter((el: Element) => el.tagName === current!.tagName);

        if (siblings.length > 1) {
          const index = siblings.indexOf(current as unknown as Element) + 1;
          part = `${part}[${index}]`;
        }

        parts.unshift(part);
      }

      current = current.parentElement;

      // Limit XPath depth to prevent overly long selectors
      if (parts.length >= 5) break;
    }

    xpath = '//' + parts.join('/');

    selectors.push({
      selector: xpath,
      confidence: 0.75, // Raised: Only used as fallback when other selectors fail
      type: 'xpath',
      description: `XPath fallback selector`,
      isUnique: true, // XPath is generally unique
      isPlaywrightOptimized: true // Playwright supports XPath
    });
  }
}
