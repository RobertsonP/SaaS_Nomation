import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { DetectedElement } from './interfaces/element.interface';
import { ScreenshotService } from './screenshot.service';

@Injectable()
export class ElementDetectionService {
  constructor(
    private screenshotService: ScreenshotService,
  ) {}

  /**
   * Extract all testable elements from a page
   */
  async extractAllPageElements(page: Page, options?: { skipScreenshots?: boolean }): Promise<DetectedElement[]> {
    const skipScreenshots = options?.skipScreenshots ?? false;
    console.log(`🔄 Starting extractAllPageElements${skipScreenshots ? ' (NO SCREENSHOTS)' : ''}...`);

    // First, extract elements without screenshots in browser context
    let extractedElements = await page.evaluate(() => {
      console.log('🔍 === INSIDE BROWSER CONTEXT - ELEMENT EXTRACTION ===');
      const extractedElements: any[] = [];

      // Debug: Check basic page state
      console.log('📄 Document ready state:', document.readyState);
      console.log('📄 Document location:', window.location.href);
      console.log('📄 Document title:', document.title);

      // OPTIMIZED: Single combined selector instead of 100+ separate queries
      // This dramatically reduces DOM query overhead
      const getOptimizedSelector = (): string => {
        return [
          // Core interactive elements (single query)
          'button', 'input', 'textarea', 'select', 'a',
          // Elements with roles
          '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="checkbox"]',
          '[role="radio"]', '[role="menuitem"]', '[role="tab"]', '[role="combobox"]',
          // Elements with test attributes
          '[data-testid]', '[data-test]', '[data-cy]',
          // Elements with interactive attributes
          '[onclick]', '[tabindex]', '[aria-label]',
          // Important text elements
          'h1', 'h2', 'h3', 'label',
          // Media
          'img[alt]', 'video', 'iframe'
        ].join(', ');
      };

      // OPTIMIZED: Single query with combined selector
      const collectElementsOptimized = (): Set<Element> => {
        const allElements = new Set<Element>();
        const startTime = performance.now();

        try {
          // Single optimized query instead of 100+ separate queries
          const optimizedSelector = getOptimizedSelector();
          const matches = document.querySelectorAll(optimizedSelector);
          matches.forEach(el => allElements.add(el));
          console.log(`⚡ Optimized query found ${matches.length} elements in ${(performance.now() - startTime).toFixed(1)}ms`);
        } catch (e) {
          console.warn('Optimized selector failed:', e);
        }

        return allElements;
      };

      // Helper function: Quick visibility check (BEFORE expensive CSS extraction)
      const isQuickVisible = (el: Element): boolean => {
        const rect = el.getBoundingClientRect();
        // Skip elements with no size (unless they're inputs which can be hidden)
        if (rect.width === 0 && rect.height === 0) {
          const tag = el.tagName.toLowerCase();
          if (!['input', 'textarea', 'select'].includes(tag)) {
            return false;
          }
        }
        // Quick style check without full getComputedStyle
        const style = (el as HTMLElement).style;
        if (style?.display === 'none' || style?.visibility === 'hidden') {
          return false;
        }
        return true;
      };

      // === TABLE DETECTION: Extract tables as single structured elements ===
      const tableElements: any[] = [];
      const tableDescendants = new Set<Element>();
      document.querySelectorAll('table').forEach((table) => {
        // Skip invisible tables
        const tableRect = table.getBoundingClientRect();
        if (tableRect.width === 0 && tableRect.height === 0) return;

        // Detect table structure
        const hasTbody = table.querySelector('tbody') !== null;
        const hasThead = table.querySelector('thead') !== null;

        // Extract headers
        const headers: string[] = [];
        table.querySelectorAll('thead th, thead td, tr:first-child th').forEach((th) => {
          headers.push((th.textContent || '').trim());
        });
        const hasHeaders = headers.length > 0;

        // Build header-column map: { "Name": 0, "Email": 1, ... }
        const headerColumnMap: Record<string, number> = {};
        headers.forEach((h, i) => { if (h) headerColumnMap[h] = i; });

        // Generate table selector
        let tableSelector = 'table';
        if (table.id) tableSelector = `#${table.id}`;
        else if (table.className && typeof table.className === 'string') {
          const cls = table.className.split(/\s+/).filter(c => c.length > 2).slice(0, 2);
          if (cls.length > 0) tableSelector = `table.${cls.join('.')}`;
        }

        // Selector building helpers
        const rowTag = hasTbody ? `${tableSelector} tbody tr` : `${tableSelector} tr`;
        const headerRowOffset = (!hasTbody && hasHeaders) ? 1 : 0;

        // Count data rows (excluding header rows)
        const bodyRows = table.querySelectorAll(hasTbody ? 'tbody tr' : 'tr');
        const rowCount = bodyRows.length - headerRowOffset;

        // Extract up to 50 rows of data with selectors
        const sampleData: string[][] = [];
        const rowSelectors: string[] = [];
        const cellSelectors: string[][] = [];
        const dataRows = bodyRows;
        const startIdx = headerRowOffset;
        const maxRows = Math.min(startIdx + 50, dataRows.length);

        for (let i = startIdx; i < maxRows; i++) {
          const row = dataRows[i];
          const rowNum = i - startIdx + 1; // 1-based for nth-child
          const nthChild = i + 1; // actual position in DOM
          rowSelectors.push(`${rowTag}:nth-child(${nthChild})`);

          const cells: string[] = [];
          const rowCellSelectors: string[] = [];
          row.querySelectorAll('td, th').forEach((cell, cellIdx) => {
            cells.push((cell.textContent || '').trim().substring(0, 100));
            rowCellSelectors.push(`${rowTag}:nth-child(${nthChild}) td:nth-child(${cellIdx + 1})`);
          });
          sampleData.push(cells);
          cellSelectors.push(rowCellSelectors);
        }

        // Column selectors: select all cells in column N
        const columnSelectors: string[] = [];
        if (headers.length > 0) {
          for (let c = 0; c < headers.length; c++) {
            if (hasThead) {
              columnSelectors.push(`${tableSelector} thead th:nth-child(${c + 1})`);
            } else {
              columnSelectors.push(`${tableSelector} tr:first-child th:nth-child(${c + 1})`);
            }
          }
        }

        tableElements.push({
          selector: tableSelector,
          elementType: 'table',
          description: `Data table${hasHeaders ? ': ' + headers.slice(0, 3).join(', ') : ''} (${rowCount} rows)`,
          confidence: 0.8,
          attributes: {
            text: '',
            tagName: 'table',
            id: table.id || '',
            className: table.className || '',
            'aria-label': table.getAttribute('aria-label') || '',
            tableData: {
              headers,
              rowCount,
              sampleData,
              tableSelector,
              rowSelectors,
              columnSelectors,
              cellSelectors,
              headerColumnMap,
              hasHeaders,
              hasTbody,
            },
          },
        });

        // Mark all descendants as excluded from main collection
        table.querySelectorAll('*').forEach((desc) => tableDescendants.add(desc));
        tableDescendants.add(table);
      });
      console.log(`📊 Found ${tableElements.length} tables, excluded ${tableDescendants.size} table descendants`);

      // Use optimized collection
      const allElements = collectElementsOptimized();
      console.log(`🔍 Found ${allElements.size} unique elements after optimized selector matching`);

      if (allElements.size === 0) {
        console.error('❌ CRITICAL: No elements found by any selectors!');
        console.error('❌ This suggests the page is empty or selectors are not matching.');
        // Test basic selectors
        const basicTest = document.querySelectorAll('*');
        console.error(`❌ Basic * selector finds ${basicTest.length} elements`);
        const buttonTest = document.querySelectorAll('button');
        console.error(`❌ Button selector finds ${buttonTest.length} elements`);
        const inputTest = document.querySelectorAll('input');
        console.error(`❌ Input selector finds ${inputTest.length} elements`);
        const linkTest = document.querySelectorAll('a');
        console.error(`❌ Link selector finds ${linkTest.length} elements`);
      }

      // OPTIMIZED: Extract essential CSS properties (reduced from ~40 to ~20)
      // Keeps properties required by cssInfo output, removes rarely-used ones
      const extractValidatedCSSProperties = (element: Element, computedStyle: CSSStyleDeclaration) => {
        try {
          // Direct property access is faster than getPropertyValue
          const bgColor = computedStyle.backgroundColor;
          const isVisible = computedStyle.visibility !== 'hidden' &&
                           computedStyle.display !== 'none' &&
                           parseFloat(computedStyle.opacity || '1') > 0;
          const hasBackground = bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent';
          const border = computedStyle.border || 'none';

          // OPTIMIZED: Essential properties for testing + cssInfo output
          return {
            // Visibility/interaction
            display: computedStyle.display || 'block',
            visibility: computedStyle.visibility || 'visible',
            opacity: computedStyle.opacity || '1',
            cursor: computedStyle.cursor || 'auto',
            pointerEvents: computedStyle.pointerEvents || 'auto',

            // Colors
            backgroundColor: bgColor || 'transparent',
            color: computedStyle.color || '#000000',

            // Typography (needed for cssInfo)
            fontSize: computedStyle.fontSize || '16px',
            fontWeight: computedStyle.fontWeight || 'normal',
            fontFamily: computedStyle.fontFamily || 'inherit',
            textAlign: computedStyle.textAlign || 'start',

            // Spacing (needed for cssInfo)
            padding: computedStyle.padding || '0px',
            margin: computedStyle.margin || '0px',

            // Borders (needed for cssInfo)
            border: border,
            borderRadius: computedStyle.borderRadius || '0px',

            // Effects (needed for cssInfo)
            boxShadow: computedStyle.boxShadow || 'none',

            // Layout
            width: computedStyle.width || 'auto',
            height: computedStyle.height || 'auto',
            position: computedStyle.position || 'static',

            // Background image check
            backgroundImage: computedStyle.backgroundImage || 'none',

            // Quality indicators
            isVisible,
            hasBackground,
            hasText: (element.textContent?.trim() || '').length > 0,
            isStyled: hasBackground || (border && border !== 'none')
          };
        } catch (error) {
          console.warn('CSS property extraction failed for element:', error);
          // Return minimal fallback CSS properties
          return {
            backgroundColor: 'transparent',
            color: '#000000',
            fontSize: '16px',
            fontFamily: 'inherit',
            fontWeight: 'normal',
            display: 'block',
            position: 'static',
            isVisible: true,
            hasBackground: false,
            hasText: (element.textContent?.trim() || '').length > 0,
            isStyled: false
          };
        }
      };

      // Track seen text for content deduplication
      const seenTextContent = new Set<string>();

      // Extract information for each element
      let processedCount = 0;
      let skippedEarly = 0;
      const startProcessTime = performance.now();

      allElements.forEach((element, index) => {
          try {
            const tagName = element.tagName.toLowerCase();

            // EARLY EXIT 1: Skip scripts, styles, metadata immediately (no DOM queries needed)
            if (['script', 'style', 'meta', 'noscript', 'link', 'head', 'br', 'hr'].includes(tagName)) {
              skippedEarly++;
              return;
            }

            // EARLY EXIT: Skip table-related tags (tables handled as structured elements above)
            if (['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col'].includes(tagName)) {
              skippedEarly++;
              return;
            }

            // EARLY EXIT: Skip elements inside tables (descendants already tracked)
            if (tableDescendants.has(element)) {
              skippedEarly++;
              return;
            }

            // EARLY EXIT 2: Quick visibility check BEFORE expensive computedStyle
            if (!isQuickVisible(element)) {
              skippedEarly++;
              return;
            }

            // PRIMARY: Core interactive elements (ALWAYS include - proceed with full analysis)
            const isInteractiveElement = [
              'input', 'textarea', 'select', 'button', 'a', 'label', 'option', 'form'
            ].includes(tagName);

            // EARLY EXIT 3: For non-interactive elements, check if they have any reason to be included
            // before doing expensive DOM operations
            if (!isInteractiveElement) {
              const hasTestAttr = element.hasAttribute('data-testid') ||
                element.hasAttribute('data-test') ||
                element.hasAttribute('data-cy');
              const hasOnClick = element.hasAttribute('onclick');
              const hasRole = element.hasAttribute('role');
              const hasTabindex = element.hasAttribute('tabindex');
              const hasAriaLabel = element.hasAttribute('aria-label');
              const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName);
              const isMedia = ['img', 'video', 'audio', 'iframe', 'canvas', 'svg'].includes(tagName);

              // Elements with ONLY tabindex or aria-label (no onclick, no role=button)
              // must have meaningful text (>2 chars, <200 chars)
              if (!hasTestAttr && !hasOnClick && !hasRole && (hasTabindex || hasAriaLabel) && !isHeading && !isMedia) {
                const quickText = (element.textContent || '').trim();
                if (quickText.length <= 2 || quickText.length > 200) {
                  skippedEarly++;
                  return;
                }
              }

              if (!hasTestAttr && !hasOnClick && !hasRole && !hasTabindex && !hasAriaLabel && !isHeading && !isMedia) {
                // Check for clickable class or pointer cursor via inline style only
                const classList = element.className?.toString() || '';
                const hasClickableClass = classList.includes('btn') ||
                  classList.includes('button') ||
                  classList.includes('clickable') ||
                  classList.includes('link');
                const inlinePointer = (element as HTMLElement).style?.cursor === 'pointer';

                if (!hasClickableClass && !inlinePointer) {
                  skippedEarly++;
                  return;
                }
              }

              // Skip empty containers: divs/spans with no visible text, no interactive children
              if (['div', 'span'].includes(tagName)) {
                const innerText = (element.textContent || '').trim();
                if (!innerText && !element.querySelector('button, input, a, select, textarea, [role="button"]')) {
                  skippedEarly++;
                  return;
                }
              }
            }

            // Now do the expensive operations only for elements that passed early checks
            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);

            // ENHANCED TESTABILITY FILTERING - Only include elements useful for testing

            // Get text content and length for filtering
            const textContent = element.textContent?.trim() || '';
            const textLength = textContent.length;
            const hasText = textLength > 0;

            // SECONDARY: Elements with explicit test attributes
            const hasTestAttributes =
              element.hasAttribute('data-testid') ||
              element.hasAttribute('data-test') ||
              element.hasAttribute('data-cy') ||
              element.hasAttribute('data-test-id');

            // TERTIARY: Elements with interactive attributes or roles
            const hasInteractiveAttributes =
              element.hasAttribute('onclick') ||
              element.hasAttribute('onchange') ||
              element.hasAttribute('tabindex') ||
              element.hasAttribute('aria-label');

            const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab', 'option', 'combobox', 'searchbox'];
            const elementRole = element.getAttribute('role');
            const hasInteractiveRole = elementRole && interactiveRoles.includes(elementRole);

            // QUATERNARY: Clickable elements (pointer cursor)
            const isClickable =
              element.hasAttribute('onclick') ||
              (element as HTMLElement).style?.cursor === 'pointer' ||
              computedStyle.cursor === 'pointer';

            // QUINARY: Images with alt text (for visual verification)
            const isDescriptiveImage = tagName === 'img' &&
              element.hasAttribute('alt') &&
              element.getAttribute('alt').trim().length > 0;

            // SENARY: Media elements (for interaction/verification)
            const isMediaElement = ['video', 'audio', 'canvas', 'svg', 'iframe'].includes(tagName);

            // SEPTENARY: Important verification text (headings, messages, alerts)
            // Only include text < 300 chars that serves verification purpose
            const className = element.className || '';
            const isImportantText = hasText && textLength <= 300 && (
              // Headings (important page structure)
              ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) ||
              // Labels (help identify inputs)
              tagName === 'label' ||
              // Error/message/alert elements
              className.includes('error') ||
              className.includes('message') ||
              className.includes('alert') ||
              className.includes('notification') ||
              className.includes('toast') ||
              className.includes('status') ||
              elementRole === 'alert' ||
              elementRole === 'status'
            );

            // OCTENARY: Structural containers ONLY if they have interactive attributes
            const isInteractiveContainer =
              ['div', 'span', 'section', 'article', 'aside'].includes(tagName) &&
              (hasTestAttributes || hasInteractiveAttributes || hasInteractiveRole || isClickable);

            // CONTENT DEDUPLICATION: Skip non-interactive elements with duplicate text
            if (!isInteractiveElement && hasText && textLength > 2 && textLength <= 200) {
              const textKey = textContent.substring(0, 100);
              if (seenTextContent.has(textKey)) {
                skippedEarly++;
                return;
              }
              seenTextContent.add(textKey);
            }

            // DECIDE: Should this element be included?
            const shouldInclude =
              isInteractiveElement ||
              hasTestAttributes ||
              hasInteractiveAttributes ||
              hasInteractiveRole ||
              isClickable ||
              isDescriptiveImage ||
              isMediaElement ||
              isImportantText ||
              isInteractiveContainer;

            if (!shouldInclude) {
              // LOG excluded elements occasionally for debugging
              if (processedCount < 10 || processedCount % 50 === 0) {
                console.log(`🚫 Excluded: ${tagName}${className ? '.' + className.split(' ')[0] : ''} - Text: "${textContent.substring(0, 30)}${textLength > 30 ? '...' : ''}"`);
              }
              return;
            }

            // Skip truly hidden elements but be very permissive
            if (computedStyle.display === 'none' ||
                computedStyle.visibility === 'hidden' ||
                (computedStyle.opacity === '0' && !isInteractiveElement)) {
              return;
            }

            // Very lenient size requirements
            if (isInteractiveElement || hasInteractiveAttributes) {
              // Interactive elements - allow very small sizes (for hidden inputs, etc.)
              if (rect.width === 0 && rect.height === 0 &&
                  !element.hasAttribute('type') ||
                  element.getAttribute('type') === 'hidden') {
                return; // Only skip truly zero-sized non-hidden elements
              }
            } else {
              // Non-interactive elements need some size unless they have special attributes
              if (rect.width < 5 && rect.height < 5 && !hasText) {
                return;
              }
            }

            // Generate highly accurate and unique selector with comprehensive strategy
            const generateSelector = (el: Element, allElements: Element[]): string => {

              // Helper function to escape strings for Playwright selectors
              const escapePlaywrightString = (str: string): string => {
                return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
              };

              // Helper function to escape CSS selectors
              const escapeCSSSelector = (str: string): string => {
                return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
              };

              // Helper function to test selector uniqueness
              const testUniqueness = (selector: string): boolean => {
                try {
                  const matches = document.querySelectorAll(selector);
                  return matches.length === 1 && matches[0] === el;
                } catch (e) {
                  return false;
                }
              };

              // CSS SELECTORS ONLY - Playwright locators disabled
              // Advanced selector service will enhance these after extraction

              const tagName = el.tagName.toLowerCase();
              const textContent = el.textContent?.trim() || '';
              const ariaLabel = el.getAttribute('aria-label');
              const role = el.getAttribute('role');
              const placeholder = el.getAttribute('placeholder');
              const type = el.getAttribute('type');
              const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');

              // NOTE: Playwright locator generation (getByRole, getByTestId, etc.) has been
              // moved to advanced-selector-generator.service.ts for better control and consistency.
              // Browser context now only generates CSS selectors which are enhanced later.

              // GENERATE CSS SELECTORS

              // 6. ID selector (high priority CSS fallback)
              if (el.id && el.id.trim() !== '') {
                const idSelector = `#${escapeCSSSelector(el.id)}`;
                if (testUniqueness(idSelector)) {
                  return idSelector;
                }
              }

              // 7. data-testid CSS fallback (if Playwright selector wasn't generated above)
              // testId already declared at top of function
              if (testId && testId.trim() !== '') {
                const testIdSelector = `[data-testid="${escapeCSSSelector(testId)}"]`;
                if (testUniqueness(testIdSelector)) {
                  return testIdSelector;
                }
              }

              // 3. name attribute (for form elements)
              const name = el.getAttribute('name');
              if (name && name.trim() !== '') {
                const nameSelector = `[name="${escapeCSSSelector(name)}"]`;
                if (testUniqueness(nameSelector)) {
                  return nameSelector;
                }
                // Try with tag name for more specificity
                const tagNameSelector = `${el.tagName.toLowerCase()}[name="${escapeCSSSelector(name)}"]`;
                if (testUniqueness(tagNameSelector)) {
                  return tagNameSelector;
                }
              }

              // 9. aria-label CSS fallback (accessibility attributes)
              // ariaLabel already declared at top of function
              if (ariaLabel && ariaLabel.trim() !== '') {
                const ariaSelector = `[aria-label="${escapeCSSSelector(ariaLabel)}"]`;
                if (testUniqueness(ariaSelector)) {
                  return ariaSelector;
                }
              }

              // 10. Combination of tag + type + specific attributes
              // tagName and type already declared at top of function

              if (type) {
                const typeSelector = `${tagName}[type="${type}"]`;
                if (testUniqueness(typeSelector)) {
                  return typeSelector;
                }
              }

              // 6. Tag + Class combinations (use stable classes)
              if (el.className && el.className.trim() !== '') {
                const classes = el.className.split(' ')
                  .filter(c => c.trim() !== '')
                  .filter(c => !c.match(/^(active|hover|focus|selected|disabled|loading)$/)) // Filter out state classes
                  .filter(c => c.length > 2) // Filter out very short classes
                  .slice(0, 3); // Limit to first 3 stable classes

                if (classes.length > 0) {
                  // Try most specific first (all classes)
                  const allClassesSelector = `${tagName}.${classes.map(c => escapeCSSSelector(c)).join('.')}`;
                  if (testUniqueness(allClassesSelector)) {
                    return allClassesSelector;
                  }

                  // Try single class combinations
                  for (const cls of classes) {
                    const singleClassSelector = `${tagName}.${escapeCSSSelector(cls)}`;
                    if (testUniqueness(singleClassSelector)) {
                      return singleClassSelector;
                    }
                  }
                }
              }

              // 7. Multiple attribute combinations
              const importantAttrs = ['role', 'placeholder', 'value', 'title', 'href', 'alt', 'for'];
              const availableAttrs = importantAttrs.filter(attr => el.getAttribute(attr));

              // Try combinations of 2-3 attributes
              for (let i = 0; i < availableAttrs.length; i++) {
                for (let j = i + 1; j < availableAttrs.length; j++) {
                  const attr1 = availableAttrs[i];
                  const attr2 = availableAttrs[j];
                  const val1 = el.getAttribute(attr1);
                  const val2 = el.getAttribute(attr2);

                  if (val1 && val2) {
                    const multiAttrSelector = `${tagName}[${attr1}="${escapeCSSSelector(val1)}"][${attr2}="${escapeCSSSelector(val2)}"]`;
                    if (testUniqueness(multiAttrSelector)) {
                      return multiAttrSelector;
                    }
                  }
                }
              }

              // 8. Single attribute selectors
              for (const attr of importantAttrs) {
                const attrValue = el.getAttribute(attr);
                if (attrValue && attrValue.trim() !== '') {
                  const attrSelector = `${tagName}[${attr}="${escapeCSSSelector(attrValue)}"]`;
                  if (testUniqueness(attrSelector)) {
                    return attrSelector;
                  }
                }
              }

              // 12. Text content-based CSS selectors (for elements with unique text)
              // textContent already declared at top of function
              if (textContent && textContent.length > 0 && textContent.length < 100) {
                // Clean text for selector use
                const cleanText = textContent.substring(0, 50).trim();
                if (cleanText && !cleanText.match(/^\s*$/)) {
                  const textSelector = `${tagName}:has-text("${escapeCSSSelector(cleanText)}")`;
                  // Note: :has-text is Playwright-specific, but we'll use it as a fallback
                  if (document.querySelectorAll(tagName).length < 10) { // Only if few elements of same tag
                    return textSelector;
                  }
                }
              }

              // 10. Parent-child relationship selectors
              const parent = el.parentElement;
              if (parent) {
                // Try parent class + child tag
                if (parent.className) {
                  const parentClasses = parent.className.split(' ')
                    .filter(c => c.trim() !== '' && c.length > 2)
                    .slice(0, 2);

                  for (const parentClass of parentClasses) {
                    const parentChildSelector = `.${escapeCSSSelector(parentClass)} > ${tagName}`;
                    if (testUniqueness(parentChildSelector)) {
                      return parentChildSelector;
                    }
                  }
                }

                // Try parent ID + child
                if (parent.id) {
                  const parentIdSelector = `#${escapeCSSSelector(parent.id)} ${tagName}`;
                  if (testUniqueness(parentIdSelector)) {
                    return parentIdSelector;
                  }
                }

                // Try parent tag + child with attributes
                if (type) {
                  const parentTagSelector = `${parent.tagName.toLowerCase()} > ${tagName}[type="${type}"]`;
                  if (testUniqueness(parentTagSelector)) {
                    return parentTagSelector;
                  }
                }
              }

              // 11. Advanced structural selectors
              if (parent) {
                const siblings = Array.from(parent.children).filter(child => child.tagName === el.tagName);
                const siblingIndex = siblings.indexOf(el as Element);

                if (siblings.length > 1 && siblingIndex >= 0) {
                  // Try first/last shortcuts
                  if (siblingIndex === 0) {
                    const firstChildSelector = parent.className
                      ? `.${parent.className.split(' ')[0]} > ${tagName}:first-child`
                      : `${parent.tagName.toLowerCase()} > ${tagName}:first-child`;
                    if (testUniqueness(firstChildSelector)) {
                      return firstChildSelector;
                    }
                  }

                  if (siblingIndex === siblings.length - 1) {
                    const lastChildSelector = parent.className
                      ? `.${parent.className.split(' ')[0]} > ${tagName}:last-child`
                      : `${parent.tagName.toLowerCase()} > ${tagName}:last-child`;
                    if (testUniqueness(lastChildSelector)) {
                      return lastChildSelector;
                    }
                  }

                  // nth-child as last resort
                  const nthChildSelector = parent.className
                    ? `.${parent.className.split(' ')[0]} > ${tagName}:nth-child(${siblingIndex + 1})`
                    : `${parent.tagName.toLowerCase()} > ${tagName}:nth-child(${siblingIndex + 1})`;
                  if (testUniqueness(nthChildSelector)) {
                    return nthChildSelector;
                  }
                }
              }

              // 12. Final fallback - position among all similar elements
              const allSimilarElements = document.querySelectorAll(tagName);
              const elementIndex = Array.from(allSimilarElements).indexOf(el);

              if (elementIndex >= 0 && allSimilarElements.length > 1) {
                return `${tagName}:nth-of-type(${elementIndex + 1})`;
              }

              // Ultimate fallback
              return tagName;
            };

            // Determine element type - enhanced for better form detection
            const getElementType = (el: Element): string => {
              const tagName = el.tagName.toLowerCase();
              const role = el.getAttribute('role');
              const type = el.getAttribute('type');
              const className = (el.className || '').toString().toLowerCase();
              const ariaModal = el.getAttribute('aria-modal');

              // Modal/popup detection
              if (role === 'dialog' || role === 'alertdialog') return 'modal';
              if (ariaModal === 'true') return 'modal';
              if (tagName === 'dialog') return 'modal';
              if (className.includes('modal') || className.includes('popup') || className.includes('lightbox')) {
                return 'modal';
              }
              // jQuery UI dialog
              if (className.includes('ui-dialog')) return 'modal';

              // Modal trigger detection
              const dataToggle = el.getAttribute('data-toggle') || el.getAttribute('data-bs-toggle');
              if (dataToggle === 'modal') return 'modal-trigger';
              const dataTarget = el.getAttribute('data-target') || el.getAttribute('data-bs-target');
              const ariaHaspopup = el.getAttribute('aria-haspopup');
              if (ariaHaspopup === 'dialog') return 'modal-trigger';
              const ariaControls = el.getAttribute('aria-controls');
              if (ariaControls && (ariaControls.includes('modal') || ariaControls.includes('dialog'))) return 'modal-trigger';
              // Broader data-target matching: if data-target points to an element with dialog role
              if (dataTarget && dataTarget.startsWith('#')) {
                const targetEl = document.getElementById(dataTarget.slice(1));
                if (targetEl && (targetEl.getAttribute('role') === 'dialog' || targetEl.getAttribute('aria-modal') === 'true' || targetEl.tagName.toLowerCase() === 'dialog' || (targetEl.className || '').toString().toLowerCase().includes('modal'))) {
                  return 'modal-trigger';
                }
              }
              // onclick modal patterns
              const onclick = el.getAttribute('onclick') || '';
              if (onclick.match(/openModal|showModal|showDialog|openDialog/i)) return 'modal-trigger';

              // Dropdown detection
              if (tagName === 'select') return 'dropdown';
              if (role === 'listbox' || role === 'combobox') return 'dropdown';
              if (ariaHaspopup === 'listbox' || ariaHaspopup === 'menu' || ariaHaspopup === 'true') return 'dropdown';
              if (className.includes('dropdown') || className.includes('combobox')) {
                // Must look like a dropdown control or container
                if (role === 'button' || tagName === 'button' || el.getAttribute('aria-expanded') !== null || ariaHaspopup) {
                  return 'dropdown';
                }
              }
              // Button with aria-expanded that controls a listbox
              if ((tagName === 'button' || role === 'button') && el.getAttribute('aria-expanded') !== null && ariaControls) {
                const controlledEl = document.getElementById(ariaControls);
                if (controlledEl && (controlledEl.getAttribute('role') === 'listbox' || controlledEl.getAttribute('role') === 'menu')) {
                  return 'dropdown';
                }
              }
              // Dropdown option detection
              if (role === 'option' || role === 'menuitem') return 'dropdown-option';

              // Toggle/accordion/collapse detection
              const ariaExpanded = el.getAttribute('aria-expanded');
              const ariaPressed = el.getAttribute('aria-pressed');
              // Bootstrap collapse triggers
              if (dataToggle === 'collapse' || dataToggle === 'tab') return 'toggle';
              if (ariaExpanded !== null) return 'toggle';
              if (ariaPressed !== null) return 'toggle';
              if (role === 'switch') return 'toggle';
              if (role === 'tab') return 'tab';
              if (className.includes('accordion') || className.includes('collapsible')) return 'accordion';

              // Button elements
              if (tagName === 'button' || role === 'button' || type === 'button' || type === 'submit') return 'button';

              // Input elements - be more specific
              if (tagName === 'input') {
                if (['submit', 'button'].includes(type)) return 'button';
                if (['checkbox', 'radio'].includes(type)) return 'input';
                return 'input'; // text, email, password, etc.
              }

              // Other form elements
              if (tagName === 'textarea' || role === 'textbox') return 'input';
              if (tagName === 'label') return 'text';

              // Links
              if (tagName === 'a' || role === 'link') return 'link';

              // Form containers
              if (tagName === 'form') return 'form';

              // Navigation
              if (tagName === 'nav' || role === 'navigation') return 'navigation';

              // Image elements
              if (tagName === 'img' || tagName === 'svg' || tagName === 'canvas') return 'image';

              // Text elements
              if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) return 'text';
              if (tagName === 'p' || tagName === 'span' || tagName === 'div' && el.textContent?.trim()) return 'text';

              return 'element';
            };

            // Generate description - enhanced for form elements
            // Get visual location context for element (helps distinguish similar elements)
            const getVisualLocation = (el: Element): string => {
              const locations: string[] = [];

              // Check if inside semantic containers
              const nav = el.closest('nav');
              const header = el.closest('header');
              const footer = el.closest('footer');
              const aside = el.closest('aside');
              const form = el.closest('form');
              const main = el.closest('main');

              if (nav) {
                // Check if in top navigation or other nav
                const navRect = nav.getBoundingClientRect();
                if (navRect.top < 100) {
                  locations.push('top navigation');
                } else {
                  locations.push('navigation');
                }
              } else if (header) {
                locations.push('header');
              } else if (footer) {
                locations.push('footer');
              } else if (aside) {
                // Try to determine sidebar position
                const asideRect = aside.getBoundingClientRect();
                if (asideRect.left < window.innerWidth / 3) {
                  locations.push('left sidebar');
                } else if (asideRect.right > (window.innerWidth * 2) / 3) {
                  locations.push('right sidebar');
                } else {
                  locations.push('sidebar');
                }
              } else if (form) {
                // Identify form type if possible
                const formClass = form.className.toLowerCase();
                const formId = form.id.toLowerCase();
                if (formClass.includes('login') || formId.includes('login')) {
                  locations.push('login form');
                } else if (formClass.includes('search') || formId.includes('search')) {
                  locations.push('search form');
                } else if (formClass.includes('signup') || formClass.includes('register') || formId.includes('signup') || formId.includes('register')) {
                  locations.push('signup form');
                } else {
                  locations.push('form');
                }
              } else if (main) {
                locations.push('main content');
              }

              // If no semantic container found, use position-based description
              if (locations.length === 0) {
                const rect = el.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;

                // Vertical position
                if (rect.top < viewportHeight / 3) {
                  locations.push('top of page');
                } else if (rect.top > (viewportHeight * 2) / 3) {
                  locations.push('bottom of page');
                }

                // Horizontal position (only for non-full-width elements)
                if (rect.width < viewportWidth * 0.8) {
                  if (rect.left < viewportWidth / 3) {
                    locations.push('left side');
                  } else if (rect.right > (viewportWidth * 2) / 3) {
                    locations.push('right side');
                  }
                }
              }

              return locations.length > 0 ? ` in ${locations.join(', ')}` : '';
            };

            const getDescription = (el: Element): string => {
              const text = el.textContent?.trim() || '';
              const ariaLabel = el.getAttribute('aria-label') || '';
              const placeholder = el.getAttribute('placeholder') || '';
              const title = el.getAttribute('title') || '';
              const name = el.getAttribute('name') || '';
              const id = el.getAttribute('id') || '';
              const type = el.getAttribute('type') || '';
              const tagName = el.tagName.toLowerCase();

              // Get visual location to distinguish similar elements
              const location = getVisualLocation(el);

              // For form elements, try to build a meaningful description
              if (['input', 'textarea', 'select'].includes(tagName)) {
                if (ariaLabel) return `${ariaLabel}${location}`;
                if (placeholder) return `${placeholder} (${type || tagName})${location}`;
                if (name) return `${name} ${type || tagName}${location}`;
                if (id) return `${id} ${type || tagName}${location}`;
                if (type) return `${type} input${location}`;
                return `${tagName} field${location}`;
              }

              // For labels, try to find what they're labeling
              if (tagName === 'label') {
                const forAttr = el.getAttribute('for');
                if (forAttr) return `Label for ${forAttr}${location}`;
                if (text) return `Label: ${text.slice(0, 30)}${location}`;
                return `Label${location}`;
              }

              // For buttons, use text or type
              if (tagName === 'button' || type === 'submit' || type === 'button') {
                if (text) return `${text.slice(0, 30)} button${location}`;
                if (type === 'submit') return `Submit button${location}`;
                return `Button${location}`;
              }

              // Default logic for other elements
              const baseDescription = ariaLabel || text.slice(0, 50) || placeholder || title || `${tagName} element`;
              return `${baseDescription}${location}`;
            };

            const elementType = getElementType(element);
            const selector = generateSelector(element, Array.from(allElements));

            // Extract CSS properties
            const cssProps = extractValidatedCSSProperties(element, computedStyle);

            // QUALITY SCORING (0-1) — replaces hardcoded 0.9
            let qualityScore = 0;
            if (element.hasAttribute('data-testid') || element.hasAttribute('data-test') || element.hasAttribute('data-cy')) qualityScore += 0.3;
            if (isInteractiveElement) qualityScore += 0.25;
            if (hasText && textLength > 2 && textLength < 200) qualityScore += 0.15;
            if (element.hasAttribute('aria-label') || element.hasAttribute('role')) qualityScore += 0.15;
            if (element.id || element.hasAttribute('data-testid')) qualityScore += 0.1;
            if (element.closest('form')) qualityScore += 0.05;
            // Ensure minimum score for included elements
            qualityScore = Math.max(qualityScore, 0.1);

            // Create element object
            const detectedElement: any = {
              selector,
              elementType,
              description: getDescription(element),
              confidence: Math.round(qualityScore * 100) / 100,
              attributes: {
                text: element.textContent?.trim() || '',
                tagName: element.tagName.toLowerCase(),
                id: element.id || '',
                className: element.className || '',
                'aria-label': element.getAttribute('aria-label') || '',
                placeholder: element.getAttribute('placeholder') || '',
                type: element.getAttribute('type') || '',
                href: element.getAttribute('href') || '',
                'data-testid': element.getAttribute('data-testid') || '',
                // Add image-specific attributes
                alt: element.getAttribute('alt') || '',
                src: element.getAttribute('src') || '',
                // CSS information - Enhanced Phase 2 with comprehensive validation
                cssInfo: cssProps,
                // Position and size
                boundingRect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                },
                // NEW: Structured visual data for efficient frontend rendering
                visualData: {
                  type: (elementType === 'image' || cssProps.backgroundImage !== 'none') ? 'image' : 'css',
                  // Layout dimensions
                  layout: {
                    width: cssProps.width,
                    height: cssProps.height
                  },
                  // Color information
                  colors: {
                    backgroundColor: cssProps.backgroundColor,
                    color: cssProps.color,
                    borderColor: cssProps.border && cssProps.border !== 'none'
                      ? cssProps.border.split(' ').find(v => v.includes('rgb') || v.startsWith('#')) || 'transparent'
                      : 'transparent'
                  },
                  // Typography
                  typography: {
                    fontSize: cssProps.fontSize,
                    fontWeight: cssProps.fontWeight,
                    fontFamily: cssProps.fontFamily,
                    textAlign: cssProps.textAlign
                  },
                  // Spacing
                  spacing: {
                    padding: cssProps.padding,
                    margin: cssProps.margin
                  },
                  // Borders and shape
                  borders: {
                    border: cssProps.border,
                    borderRadius: cssProps.borderRadius
                  },
                  // Visual effects
                  effects: {
                    boxShadow: cssProps.boxShadow,
                    opacity: cssProps.opacity
                  },
                  // Text content for rendering
                  content: {
                    innerText: element.textContent?.trim() || ''
                  }
                },
                // Task 1.5: Modal-trigger pairing - extract target modal ID
                modalTargetId: (() => {
                  if (elementType !== 'modal-trigger') return null;
                  const dataTarget = element.getAttribute('data-target');
                  if (dataTarget) return dataTarget.replace(/^#/, '');
                  const dataBsTarget = element.getAttribute('data-bs-target');
                  if (dataBsTarget) return dataBsTarget.replace(/^#/, '');
                  const ariaControls = element.getAttribute('aria-controls');
                  if (ariaControls) return ariaControls;
                  const href = element.getAttribute('href');
                  if (href && href.startsWith('#') && href.length > 1) return href.replace(/^#/, '');
                  return null;
                })(),
                // Task 1.6: Dropdown options + structured dropdown data
                dropdownOptions: (() => {
                  if (elementType !== 'dropdown') return null;
                  const tagName = element.tagName.toLowerCase();

                  // Native select element
                  if (tagName === 'select') {
                    const selectEl = element as HTMLSelectElement;
                    return Array.from(selectEl.options).map((opt: HTMLOptionElement) => ({
                      value: opt.value,
                      text: opt.text || opt.textContent?.trim() || '',
                      selected: opt.selected,
                    }));
                  }

                  // Custom dropdown with ARIA options — scoped to dropdown container
                  let optionEls = element.querySelectorAll('[role="option"], [role="menuitem"]');
                  if (optionEls.length === 0) {
                    const menuContainer = element.querySelector('ul, [role="listbox"], [role="menu"], .dropdown-menu, [class*="menu"], [class*="options"], [class*="list"]');
                    if (menuContainer) {
                      optionEls = menuContainer.querySelectorAll('li');
                    }
                  }
                  if (optionEls.length > 0) {
                    return Array.from(optionEls).slice(0, 50).map((opt: Element) => ({
                      value: opt.getAttribute('data-value') || opt.getAttribute('value') || opt.textContent?.trim() || '',
                      text: opt.textContent?.trim() || '',
                      selected: opt.getAttribute('aria-selected') === 'true',
                    }));
                  }

                  return null;
                })(),
                // Structured dropdown data with per-option selectors and CSS
                dropdownData: (() => {
                  if (elementType !== 'dropdown') return null;
                  const tagName = element.tagName.toLowerCase();
                  const parentSelector = selector;
                  const isNative = tagName === 'select';

                  if (isNative) {
                    const selectEl = element as HTMLSelectElement;
                    const options = Array.from(selectEl.options).slice(0, 50).map((opt, i) => {
                      const optStyle = window.getComputedStyle(opt);
                      // Build selector: prefer value, fall back to nth-child
                      const optSelector = opt.value
                        ? `${parentSelector} option[value="${opt.value}"]`
                        : `${parentSelector} option:nth-child(${i + 1})`;
                      return {
                        value: opt.value,
                        text: opt.text || opt.textContent?.trim() || '',
                        selected: opt.selected,
                        selector: optSelector,
                        index: i,
                        cssPreview: {
                          color: optStyle.color || '',
                          backgroundColor: optStyle.backgroundColor || '',
                          fontSize: optStyle.fontSize || '',
                        },
                      };
                    });
                    return {
                      triggerSelector: parentSelector,
                      isNative: true,
                      optionCount: selectEl.options.length,
                      options,
                    };
                  }

                  // Custom dropdown
                  let optionEls = element.querySelectorAll('[role="option"], [role="menuitem"]');
                  if (optionEls.length === 0) {
                    const menuContainer = element.querySelector('ul, [role="listbox"], [role="menu"], .dropdown-menu, [class*="menu"], [class*="options"], [class*="list"]');
                    if (menuContainer) {
                      optionEls = menuContainer.querySelectorAll('li');
                    }
                  }
                  if (optionEls.length > 0) {
                    const optArray = Array.from(optionEls).slice(0, 50);
                    const options = optArray.map((opt, i) => {
                      const optStyle = window.getComputedStyle(opt);
                      const role = opt.getAttribute('role');
                      // Build selector: data-value, text content, or nth-child
                      let optSelector: string;
                      const dataValue = opt.getAttribute('data-value');
                      if (dataValue) {
                        optSelector = `${parentSelector} [data-value="${dataValue}"]`;
                      } else if (role === 'option' || role === 'menuitem') {
                        optSelector = `${parentSelector} [role="${role}"]:nth-child(${i + 1})`;
                      } else {
                        optSelector = `${parentSelector} li:nth-child(${i + 1})`;
                      }
                      return {
                        value: dataValue || opt.getAttribute('value') || opt.textContent?.trim() || '',
                        text: opt.textContent?.trim() || '',
                        selected: opt.getAttribute('aria-selected') === 'true',
                        selector: optSelector,
                        index: i,
                        cssPreview: {
                          color: optStyle.color || '',
                          backgroundColor: optStyle.backgroundColor || '',
                          fontSize: optStyle.fontSize || '',
                        },
                      };
                    });
                    return {
                      triggerSelector: parentSelector,
                      isNative: false,
                      optionCount: optArray.length,
                      options,
                    };
                  }

                  return null;
                })(),
                // Richer element context for CSS recreation
                parentContext: (() => {
                  const parent = element.parentElement;
                  if (!parent) return null;
                  const parentStyle = window.getComputedStyle(parent);
                  return {
                    tag: parent.tagName.toLowerCase(),
                    role: parent.getAttribute('role') || undefined,
                    className: (parent.className || '').toString().split(/\s+/).slice(0, 3).join(' ') || undefined,
                    id: parent.id || undefined,
                    display: parentStyle.display || undefined,
                    flexDirection: parentStyle.flexDirection || undefined,
                    text: (parent.textContent || '').substring(0, 100) || undefined,
                  };
                })(),
                siblingInfo: (() => {
                  const parent = element.parentElement;
                  if (!parent) return null;
                  const siblings = Array.from(parent.children);
                  const nearbyLabels: string[] = [];
                  // Find nearby label elements
                  for (const sib of siblings) {
                    if (sib === element) continue;
                    if (sib.tagName === 'LABEL' || sib.getAttribute('role') === 'label') {
                      const labelText = (sib.textContent || '').trim();
                      if (labelText) nearbyLabels.push(labelText.substring(0, 80));
                    }
                  }
                  return {
                    count: siblings.length,
                    index: siblings.indexOf(element),
                    nearbyLabels: nearbyLabels.slice(0, 3),
                  };
                })(),
                contextHTML: (() => {
                  const parent = element.parentElement;
                  if (!parent) return undefined;
                  try {
                    const html = parent.outerHTML;
                    return html.length > 500 ? html.substring(0, 500) + '...' : html;
                  } catch { return undefined; }
                })(),
                containerSelector: (() => {
                  const semanticTags = ['form', 'nav', 'section', 'main', 'aside', 'header', 'footer', 'article'];
                  let current: Element | null = element.parentElement;
                  while (current) {
                    if (semanticTags.includes(current.tagName.toLowerCase())) {
                      if (current.id) return `${current.tagName.toLowerCase()}#${current.id}`;
                      const cls = (current.className || '').toString().split(/\s+/)[0];
                      if (cls) return `${current.tagName.toLowerCase()}.${cls}`;
                      return current.tagName.toLowerCase();
                    }
                    current = current.parentElement;
                  }
                  return undefined;
                })(),
                resolvedColors: (() => {
                  // Walk up parent chain to find first non-transparent background
                  let bgColor = computedStyle.backgroundColor;
                  let current: Element | null = element;
                  while (current && (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {
                    current = current.parentElement;
                    if (current) {
                      bgColor = window.getComputedStyle(current).backgroundColor;
                    }
                  }
                  // Extract border color from computed border
                  const borderStyle = computedStyle.borderTopColor || computedStyle.borderColor;
                  return {
                    backgroundColor: bgColor || '#ffffff',
                    color: computedStyle.color || '#000000',
                    borderColor: borderStyle || undefined,
                  };
                })(),
                visualDescription: (() => {
                  // Auto-generate a human-readable visual description
                  const elType = elementType || element.tagName.toLowerCase();
                  const elText = (element.textContent || '').trim().substring(0, 40);
                  const w = Math.round(rect.width);
                  const h = Math.round(rect.height);

                  // Determine color name from computed background
                  let colorHint = '';
                  const bg = computedStyle.backgroundColor;
                  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                    // Parse rgb values for rough color naming
                    const rgbMatch = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (rgbMatch) {
                      const [, r, g, b] = rgbMatch.map(Number);
                      if (r > 200 && g < 100 && b < 100) colorHint = 'Red';
                      else if (r < 100 && g > 150 && b < 100) colorHint = 'Green';
                      else if (r < 100 && g < 100 && b > 200) colorHint = 'Blue';
                      else if (r > 200 && g > 200 && b < 100) colorHint = 'Yellow';
                      else if (r > 200 && g > 100 && b < 100) colorHint = 'Orange';
                      else if (r > 200 && g > 200 && b > 200) colorHint = 'White';
                      else if (r < 50 && g < 50 && b < 50) colorHint = 'Black';
                      else if (r > 100 && g > 100 && b > 100) colorHint = 'Gray';
                    }
                  }

                  // Get position context
                  const locationStr = getVisualLocation(element) || '';

                  // Build description
                  const parts: string[] = [];
                  if (colorHint) parts.push(colorHint);
                  parts.push(`'${elText || elType}'`);
                  parts.push(elType);
                  if (w > 0 && h > 0) parts.push(`(${w}x${h}px)`);
                  if (locationStr) parts.push(locationStr);

                  return parts.join(' ');
                })(),
                // Task 1.7: Toggle state extraction
                toggleState: (() => {
                  if (elementType !== 'toggle' && elementType !== 'tab' && elementType !== 'accordion') return null;

                  // Determine current state
                  const ariaExpanded = element.getAttribute('aria-expanded');
                  const ariaPressed = element.getAttribute('aria-pressed');
                  const ariaChecked = element.getAttribute('aria-checked');
                  const elClassName = (element.className || '').toString().toLowerCase();

                  let currentState: string = 'unknown';
                  if (ariaExpanded === 'true') currentState = 'expanded';
                  else if (ariaExpanded === 'false') currentState = 'collapsed';
                  else if (ariaPressed === 'true' || ariaChecked === 'true') currentState = 'on';
                  else if (ariaPressed === 'false' || ariaChecked === 'false') currentState = 'off';
                  else if (elClassName.includes('expanded') || elClassName.includes('open') || elClassName.includes('show')) currentState = 'expanded';
                  else if (elClassName.includes('collapsed') || elClassName.includes('closed')) currentState = 'collapsed';

                  // Get controlled element ID and validate it exists
                  let controlledElementId: string | null = null;
                  const ctrlAriaControls = element.getAttribute('aria-controls');
                  if (ctrlAriaControls) controlledElementId = ctrlAriaControls;
                  else {
                    const ctrlDataTarget = element.getAttribute('data-target') || element.getAttribute('data-bs-target');
                    if (ctrlDataTarget) controlledElementId = ctrlDataTarget.replace(/^#/, '');
                    else {
                      const ctrlHref = element.getAttribute('href');
                      if (ctrlHref && ctrlHref.startsWith('#') && ctrlHref.length > 1) controlledElementId = ctrlHref.replace(/^#/, '');
                    }
                  }

                  // Validate the controlled element exists in the DOM
                  const controlledExists = controlledElementId ? !!document.getElementById(controlledElementId) : false;

                  return {
                    currentState,
                    controlledElementId: controlledExists ? controlledElementId : null,
                    type: elementType,
                  };
                })()
              }
            };

            // Flag elements containing images for screenshot capture
            const isImageElement = element.tagName.toLowerCase() === 'img';
            const containsChildImage = !isImageElement && element.querySelector('img') !== null;
            const hasBackgroundImage = cssProps.backgroundImage !== 'none';
            if (isImageElement || containsChildImage || hasBackgroundImage) {
              detectedElement.needsScreenshot = true;
            }

            extractedElements.push(detectedElement);
          } catch (error) {
            console.error('Error processing element:', error);
          }
          processedCount++;
        });

        const processTime = performance.now() - startProcessTime;
        console.log(`⚡ Processing complete in ${processTime.toFixed(1)}ms: ${processedCount} full, ${skippedEarly} skipped early, ${extractedElements.length} results`);

        if (extractedElements.length === 0) {
          console.error('❌ CRITICAL: No elements passed filtering! All elements were filtered out.');
          if (allElements.size > 0) {
            console.error('❌ This suggests the filtering logic is too restrictive for this page.');
          }
        }

        // Post-process to ensure all selectors are unique
        const uniqueSelectors = new Set<string>();
        const finalElements = extractedElements.map((element, index) => {
          let selector = element.selector;
          let counter = 1;

          // If selector is not unique, modify it
          while (uniqueSelectors.has(selector)) {
            // Try adding an index suffix
            if (selector.includes(':nth-of-type(')) {
              // Already has nth-of-type, increment it
              selector = selector.replace(/:nth-of-type\(\d+\)/, `:nth-of-type(${counter + 1})`);
            } else if (selector.includes(':nth-child(')) {
              // Already has nth-child, increment it
              selector = selector.replace(/:nth-child\(\d+\)/, `:nth-child(${counter + 1})`);
            } else {
              // Add nth-of-type to make it unique
              selector = `${selector}:nth-of-type(${counter + 1})`;
            }
            counter++;
          }

          uniqueSelectors.add(selector);
          return {
            ...element,
            selector: selector
          };
        });

        // Inject table elements at the beginning
        const allFinalElements = [...tableElements, ...finalElements];

        // Sort by confidence (quality score) descending
        allFinalElements.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));

        // Cap at MAX_ELEMENTS to prevent junk overload
        const MAX_ELEMENTS = 200;
        const cappedElements = allFinalElements.slice(0, MAX_ELEMENTS);

        console.log(`✅ Final result: ${cappedElements.length} elements (from ${allFinalElements.length}, cap ${MAX_ELEMENTS})`);
        console.log('🏁 === BROWSER CONTEXT ELEMENT EXTRACTION COMPLETE ===');

        return cappedElements;
      });

    // Skip second-pass advanced selector regeneration — first pass CSS selectors are sufficient
    console.log(`✅ Element extraction complete — ${extractedElements.length} elements with CSS selectors (no second pass)`);

    // Capture screenshots for image-containing elements (max 20 to keep it fast)
    if (!skipScreenshots) {
      const imageElements = extractedElements.filter((el: any) => el.needsScreenshot);
      const screenshotLimit = Math.min(imageElements.length, 20);
      if (screenshotLimit > 0) {
        console.log(`📸 Capturing screenshots for ${screenshotLimit}/${imageElements.length} image elements...`);
        for (let i = 0; i < screenshotLimit; i++) {
          const el = imageElements[i];
          try {
            const locator = page.locator(el.selector).first();
            const isVisible = await locator.isVisible().catch(() => false);
            if (isVisible) {
              const screenshotBuffer = await locator.screenshot({
                type: 'jpeg',
                quality: 50,
                timeout: 3000,
              });
              el.screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
            }
          } catch {
            // Skip silently — element may not be screenshottable
          }
        }
        console.log(`📸 Screenshot capture complete`);
      }
    }

    // Clean up internal flags
    extractedElements.forEach((el: any) => delete el.needsScreenshot);

    return extractedElements;
  }

  /**
   * Capture element screenshot - delegates to ScreenshotService
   */
  async captureElementScreenshot(url: string, selector: string): Promise<string | null> {
    return this.screenshotService.captureElementScreenshot(url, selector);
  }

  // Second-pass advanced selector generation and screenshot capture were removed for speed.
  // CSS selectors from the first browser pass are used directly.
  // See git history for the removed _legacyAdvancedSelectorPass method if needed.
}
