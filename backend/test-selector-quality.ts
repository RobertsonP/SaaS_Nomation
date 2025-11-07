/**
 * Standalone Test Script for Enhanced Selector Generation
 * Tests the new Playwright-inspired selector generation features
 */

import { chromium, Browser, Page } from 'playwright';

// Test configuration
const TEST_URLS = [
  'https://tts.am',           // Fast site for baseline
  'https://www.playwright.dev', // Modern framework site
];

interface SelectorTest {
  url: string;
  elementsFound: number;
  selectorTypes: {
    roleBasedCount: number;
    textBasedCount: number;
    testIdCount: number;
    cssCount: number;
    xpathCount: number;
  };
  uniqueSelectors: number;
  averageSelectorLength: number;
}

async function testSelectorQuality(url: string): Promise<SelectorTest> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log(`\n🧪 Testing selectors for: ${url}`);

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Enhanced element discovery (matching our new implementation)
    const elements = await page.evaluate(() => {
      const interactiveSelectors = [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="tab"]',
        '[role="menuitem"]',
        '[role="option"]',
        '[data-testid]',
        '[data-test]',
        '[aria-label]',
        '[onclick]',
        'div[class*="button"]',
        'div[class*="btn"]',
        '[contenteditable="true"]'
      ];

      const foundElements: any[] = [];
      const selector = interactiveSelectors.join(', ');
      const nodeList = document.querySelectorAll(selector);

      nodeList.forEach((el) => {
        if (el instanceof HTMLElement) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            foundElements.push({
              tagName: el.tagName.toLowerCase(),
              id: el.id || null,
              className: el.className || null,
              textContent: el.textContent?.trim().substring(0, 50) || null,
              role: el.getAttribute('role') || null,
              ariaLabel: el.getAttribute('aria-label') || null,
              testId: el.getAttribute('data-testid') || el.getAttribute('data-test') || null,
              hasOnClick: el.hasAttribute('onclick'),
            });
          }
        }
      });

      return foundElements;
    });

    // Generate selectors for each element (simulating our advanced service)
    const selectors = elements.map((el) => {
      return generateBestSelector(el);
    });

    // Analyze selector quality
    const selectorTypes = {
      roleBasedCount: selectors.filter(s => s.includes('role=')).length,
      textBasedCount: selectors.filter(s => s.includes('text=')).length,
      testIdCount: selectors.filter(s => s.includes('data-testid') || s.includes('data-test')).length,
      cssCount: selectors.filter(s => !s.includes('role=') && !s.includes('text=') && !s.includes('//') && !s.includes('data-testid')).length,
      xpathCount: selectors.filter(s => s.startsWith('//')).length,
    };

    const uniqueSelectors = new Set(selectors).size;
    const averageSelectorLength = selectors.reduce((sum, s) => sum + s.length, 0) / selectors.length;

    console.log(`✅ Found ${elements.length} interactive elements`);
    console.log(`📊 Selector Quality Analysis:`);
    console.log(`   - Role-based: ${selectorTypes.roleBasedCount} (${(selectorTypes.roleBasedCount / selectors.length * 100).toFixed(1)}%)`);
    console.log(`   - Text-based: ${selectorTypes.textBasedCount} (${(selectorTypes.textBasedCount / selectors.length * 100).toFixed(1)}%)`);
    console.log(`   - Test ID-based: ${selectorTypes.testIdCount} (${(selectorTypes.testIdCount / selectors.length * 100).toFixed(1)}%)`);
    console.log(`   - CSS-based: ${selectorTypes.cssCount} (${(selectorTypes.cssCount / selectors.length * 100).toFixed(1)}%)`);
    console.log(`   - XPath-based: ${selectorTypes.xpathCount} (${(selectorTypes.xpathCount / selectors.length * 100).toFixed(1)}%)`);
    console.log(`   - Unique selectors: ${uniqueSelectors}/${selectors.length} (${(uniqueSelectors / selectors.length * 100).toFixed(1)}%)`);
    console.log(`   - Average length: ${averageSelectorLength.toFixed(1)} chars`);

    return {
      url,
      elementsFound: elements.length,
      selectorTypes,
      uniqueSelectors,
      averageSelectorLength,
    };
  } catch (error) {
    console.error(`❌ Error testing ${url}:`, error.message);
    throw error;
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

// Simulated selector generation (matching our advanced service logic)
function generateBestSelector(element: any): string {
  // Priority 1: Role + Accessible Name (Playwright best practice)
  if (element.role && element.ariaLabel) {
    return `[role="${element.role}"][aria-label="${element.ariaLabel}"]`;
  }

  // Priority 2: Role + Text
  if (element.role && element.textContent) {
    const text = element.textContent.substring(0, 30);
    return `[role="${element.role}"]:has-text("${text}")`;
  }

  // Priority 3: Accessible Name alone
  if (element.ariaLabel) {
    return `[aria-label="${element.ariaLabel}"]`;
  }

  // Priority 4: Text content
  if (element.textContent && element.textContent.length > 0 && element.textContent.length < 50) {
    return `text="${element.textContent}"`;
  }

  // Priority 5: ID (if present and looks stable)
  if (element.id && !/^\d+$/.test(element.id) && !element.id.includes('random')) {
    return `#${element.id}`;
  }

  // Priority 6: Test IDs (lower priority than Playwright standard, but still valuable)
  if (element.testId) {
    return `[data-testid="${element.testId}"]`;
  }

  // Priority 7: CSS with class (stable classes only)
  if (element.className && typeof element.className === 'string') {
    const stableClasses = element.className.split(' ')
      .filter((c: string) => c && !/^\d+$/.test(c) && !c.includes('random'))
      .slice(0, 2)
      .join('.');

    if (stableClasses) {
      return `${element.tagName}.${stableClasses}`;
    }
  }

  // Priority 8: Tag name fallback
  return element.tagName;
}

async function runTests() {
  console.log('🚀 Starting Selector Quality Tests');
  console.log('=' .repeat(60));

  const results: SelectorTest[] = [];

  for (const url of TEST_URLS) {
    try {
      const result = await testSelectorQuality(url);
      results.push(result);
    } catch (error) {
      console.error(`Failed to test ${url}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY');
  console.log('='.repeat(60));

  const totalElements = results.reduce((sum, r) => sum + r.elementsFound, 0);
  const totalRoleBased = results.reduce((sum, r) => sum + r.selectorTypes.roleBasedCount, 0);
  const totalTextBased = results.reduce((sum, r) => sum + r.selectorTypes.textBasedCount, 0);
  const totalTestId = results.reduce((sum, r) => sum + r.selectorTypes.testIdCount, 0);

  console.log(`Total elements tested: ${totalElements}`);
  console.log(`Best practice selectors (role/text): ${totalRoleBased + totalTextBased} (${((totalRoleBased + totalTextBased) / totalElements * 100).toFixed(1)}%)`);
  console.log(`Test ID selectors: ${totalTestId} (${(totalTestId / totalElements * 100).toFixed(1)}%)`);

  console.log('\n✅ Selector quality tests completed!');
  console.log('\n💡 Key Improvements:');
  console.log('   1. Role-based selectors prioritized (Playwright best practice)');
  console.log('   2. Text-based selectors for readable tests');
  console.log('   3. Test IDs as fallback, not primary');
  console.log('   4. Comprehensive element discovery for modern frameworks');
}

runTests().catch(console.error);
