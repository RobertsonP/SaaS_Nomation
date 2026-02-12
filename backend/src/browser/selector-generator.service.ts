import { Injectable } from '@nestjs/common';
import {
  SelectorOptions,
  GeneratedSelector,
} from './strategies/selector-strategy.interface';
import { isTestableElement } from './selector-utils';
import { TestAttributeStrategy } from './strategies/test-attribute.strategy';
import { PlaywrightStrategy } from './strategies/playwright.strategy';
import { SemanticStrategy } from './strategies/semantic.strategy';
import { RelationalStrategy } from './strategies/relational.strategy';
import { LayoutStrategy } from './strategies/layout.strategy';
import { CombinedStrategy } from './strategies/combined.strategy';
import { XPathStrategy } from './strategies/xpath.strategy';

/**
 * Orchestrator service for selector generation using Strategy Pattern
 * Coordinates multiple selector strategies to generate robust selectors
 */
@Injectable()
export class SelectorGeneratorService {
  private readonly testAttributeStrategy = new TestAttributeStrategy();
  private readonly playwrightStrategy = new PlaywrightStrategy();
  private readonly semanticStrategy = new SemanticStrategy();
  private readonly relationalStrategy = new RelationalStrategy();
  private readonly layoutStrategy = new LayoutStrategy();
  private readonly combinedStrategy = new CombinedStrategy();
  private readonly xpathStrategy = new XPathStrategy();

  /**
   * Generate selectors using all available strategies
   */
  generateSelectors(options: SelectorOptions): GeneratedSelector[] {
    const { element, document, includePlaywrightSpecific, prioritizeUniqueness, testableElementsOnly } = options;

    // Skip non-testable elements if requested
    if (testableElementsOnly && !isTestableElement(element)) {
      return [];
    }

    const selectors: GeneratedSelector[] = [];

    // 1. Test-specific attributes
    this.testAttributeStrategy.addTestSpecificSelectors(element, selectors, document);

    // 2. Unique IDs
    this.testAttributeStrategy.addIdSelectors(element, selectors, document);

    // 3. Playwright-specific selectors
    if (includePlaywrightSpecific) {
      this.playwrightStrategy.addPlaywrightSelectors(element, selectors, document);
    }

    // 4. Semantic selectors
    this.semanticStrategy.addSemanticSelectors(element, selectors, document);

    // 5. Stable attribute selectors
    this.semanticStrategy.addStableAttributeSelectors(element, selectors, document);

    // 6. Relational selectors
    this.relationalStrategy.addStableRelationalSelectors(element, selectors, document);

    // 7. Layout, visibility, state, text, deep combinator selectors
    this.layoutStrategy.addVisibilitySelectors(element, selectors, document);
    this.layoutStrategy.addStateAttributeSelectors(element, selectors, document);
    this.combinedStrategy.addEnhancedTextSelectors(element, selectors, document);
    this.combinedStrategy.addDeepCombinatorSelectors(element, selectors, document);

    // 7b. Sibling-based selectors
    this.relationalStrategy.addSiblingBasedSelectors(element, selectors, document);

    // 8. Comprehensive combined selectors
    this.combinedStrategy.addComprehensiveCombinedSelectors(element, selectors, document);

    // 9. XPath fallback
    if (selectors.length < 3) {
      this.xpathStrategy.addXPathSelectors(element, selectors, document);
    }

    return this.filterAndSort(selectors, prioritizeUniqueness);
  }

  /**
   * Generate a single best selector
   */
  generateBestSelector(options: SelectorOptions): GeneratedSelector | null {
    const selectors = this.generateSelectors(options);
    return selectors.length > 0 ? selectors[0] : null;
  }

  /**
   * Get list of available strategy names
   */
  getAvailableStrategies(): string[] {
    return [
      'test-attribute',
      'playwright',
      'semantic',
      'relational',
      'layout',
      'combined',
      'xpath'
    ];
  }

  /**
   * Filter and sort selectors by quality
   */
  private filterAndSort(selectors: GeneratedSelector[], prioritizeUniqueness: boolean): GeneratedSelector[] {
    // Remove duplicates
    const seen = new Set<string>();
    const unique = selectors.filter(s => {
      if (seen.has(s.selector)) return false;
      seen.add(s.selector);
      return true;
    });

    // Filter for high-confidence selectors only
    const highConfidence = unique.filter(s => s.confidence >= 0.75);

    // Sort by uniqueness (if prioritized) then confidence
    const sorted = highConfidence.sort((a, b) => {
      if (prioritizeUniqueness) {
        if (a.isUnique !== b.isUnique) return a.isUnique ? -1 : 1;
      }
      return b.confidence - a.confidence;
    });

    // Return top 10
    return sorted.slice(0, 10);
  }
}
