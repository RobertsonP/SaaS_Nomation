const { chromium } = require('playwright');

async function testSelectorGeneration() {
  console.log('🔍 Testing sophisticated selector generation...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://tts.am', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const elements = await page.evaluate(() => {
      const extractedElements = [];
      
      // FULL sophisticated selector logic from the main implementation
      const generateSelector = (el) => {
        const escapeCSSSelector = (str) => str.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\\\$&');
        
        const testUniqueness = (selector) => {
          try {
            const matches = document.querySelectorAll(selector);
            return matches.length === 1 && matches[0] === el;
          } catch (e) {
            return false;
          }
        };
        
        // 1. ID selector (highest priority)
        if (el.id && el.id.trim() !== '') {
          const idSelector = `#${escapeCSSSelector(el.id)}`;
          if (testUniqueness(idSelector)) return idSelector;
        }
        
        // 2. data-testid (testing-specific attributes)
        const testId = el.getAttribute('data-testid');
        if (testId && testId.trim() !== '') {
          const testIdSelector = `[data-testid="${escapeCSSSelector(testId)}"]`;
          if (testUniqueness(testIdSelector)) return testIdSelector;
        }
        
        // 3. name attribute (for form elements)
        const name = el.getAttribute('name');
        if (name && name.trim() !== '') {
          const nameSelector = `[name="${escapeCSSSelector(name)}"]`;
          if (testUniqueness(nameSelector)) return nameSelector;
          const tagNameSelector = `${el.tagName.toLowerCase()}[name="${escapeCSSSelector(name)}"]`;
          if (testUniqueness(tagNameSelector)) return tagNameSelector;
        }
        
        // 4. aria-label (accessibility attributes)
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim() !== '') {
          const ariaSelector = `[aria-label="${escapeCSSSelector(ariaLabel)}"]`;
          if (testUniqueness(ariaSelector)) return ariaSelector;
        }
        
        // 5. Combination of tag + type + specific attributes
        const tagName = el.tagName.toLowerCase();
        const type = el.getAttribute('type');
        
        if (type) {
          const typeSelector = `${tagName}[type="${type}"]`;
          if (testUniqueness(typeSelector)) return typeSelector;
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
        
        // 9. Text content-based selectors (for elements with unique text)
        const textContent = el.textContent?.trim() || '';
        if (textContent && textContent.length > 0 && textContent.length < 100) {
          const cleanText = textContent.substring(0, 50).trim();
          if (cleanText && !cleanText.match(/^\\s*$/)) {
            // Check if this text is unique enough
            const similarElements = document.querySelectorAll(tagName);
            const elementsWithSameText = Array.from(similarElements).filter(elem => 
              elem.textContent?.trim().includes(cleanText)
            );
            if (elementsWithSameText.length === 1) {
              return `${tagName}:contains("${escapeCSSSelector(cleanText)}")`;
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
          const siblingIndex = siblings.indexOf(el);
          
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
      
      // Find form inputs specifically to test quality
      const inputs = document.querySelectorAll('input, button, select, textarea');
      
      inputs.forEach((element, index) => {
        if (index < 10) { // Test first 10 elements
          const selector = generateSelector(element);
          const description = element.getAttribute('placeholder') || 
                            element.getAttribute('aria-label') || 
                            element.textContent?.trim() || 
                            element.getAttribute('name') || 
                            'Form element';
          
          extractedElements.push({
            index,
            tagName: element.tagName.toLowerCase(),
            type: element.getAttribute('type'),
            selector,
            description: description.slice(0, 50),
            hasId: !!element.id,
            hasName: !!element.getAttribute('name'),
            hasTestId: !!element.getAttribute('data-testid'),
            hasAriaLabel: !!element.getAttribute('aria-label')
          });
        }
      });
      
      return extractedElements;
    });
    
    console.log('\n📊 Selector Quality Test Results:');
    console.log('=====================================');
    
    elements.forEach(element => {
      const quality = element.selector === element.tagName ? '❌ POOR' : '✅ GOOD';
      console.log(`${quality} | ${element.tagName}[${element.type || 'N/A'}] → "${element.selector}"`);
      console.log(`      Description: ${element.description}`);
      console.log(`      Attributes: ID=${element.hasId}, Name=${element.hasName}, TestID=${element.hasTestId}, ARIA=${element.hasAriaLabel}`);
      console.log('');
    });
    
    // Count quality metrics
    const poorSelectors = elements.filter(e => e.selector === e.tagName).length;
    const goodSelectors = elements.filter(e => e.selector !== e.tagName).length;
    
    console.log('📈 Quality Summary:');
    console.log(`✅ Good selectors: ${goodSelectors}/${elements.length}`);
    console.log(`❌ Poor selectors: ${poorSelectors}/${elements.length}`);
    console.log(`📊 Quality score: ${Math.round((goodSelectors / elements.length) * 100)}%`);
    
    if (poorSelectors === 0) {
      console.log('\n🎉 SUCCESS: All selectors are high quality!');
    } else if (goodSelectors > poorSelectors) {
      console.log('\n✅ GOOD: Most selectors are high quality');
    } else {
      console.log('\n⚠️  NEEDS WORK: Many selectors are still poor quality');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testSelectorGeneration();