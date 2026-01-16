import { Injectable } from '@nestjs/common';
import {
  SelectorStrategy,
  SelectorOptions,
  GeneratedSelector,
  getAllStrategies,
  getCssOnlyStrategies
} from './strategies';

/**
 * Orchestrator service for selector generation using Strategy Pattern
 * Coordinates multiple selector strategies to generate robust selectors
 */
@Injectable()
export class SelectorGeneratorService {
  private readonly strategies: SelectorStrategy[];
  private readonly cssOnlyStrategies: SelectorStrategy[];

  constructor() {
    this.strategies = getAllStrategies();
    this.cssOnlyStrategies = getCssOnlyStrategies();
  }

  /**
   * Generate selectors using all available strategies
   */
  generateSelectors(options: SelectorOptions): GeneratedSelector[] {
    const { includePlaywrightSpecific, prioritizeUniqueness, testableElementsOnly, element } = options;

    // Skip non-testable elements if requested
    if (testableElementsOnly && !this.isTestableElement(element)) {
      return [];
    }

    // Select appropriate strategies based on options
    const activeStrategies = includePlaywrightSpecific
      ? this.strategies
      : this.cssOnlyStrategies;

    // Collect selectors from all strategies
    const allSelectors: GeneratedSelector[] = [];

    for (const strategy of activeStrategies) {
      try {
        const selectors = strategy.generate(options);
        allSelectors.push(...selectors);
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
      }
    }

    // Filter and sort results
    return this.filterAndSort(allSelectors, prioritizeUniqueness);
  }

  /**
   * Generate a single best selector
   */
  generateBestSelector(options: SelectorOptions): GeneratedSelector | null {
    const selectors = this.generateSelectors(options);
    return selectors.length > 0 ? selectors[0] : null;
  }

  /**
   * Generate selectors using a specific strategy
   */
  generateWithStrategy(strategyName: string, options: SelectorOptions): GeneratedSelector[] {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (!strategy) {
      console.warn(`Strategy ${strategyName} not found`);
      return [];
    }
    return strategy.generate(options);
  }

  /**
   * Get list of available strategy names
   */
  getAvailableStrategies(): string[] {
    return this.strategies.map(s => s.name);
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

  /**
   * Check if element is interactive/testable
   */
  private isTestableElement(element: any): boolean {
    const tag = element.tagName?.toLowerCase();
    const role = element.getAttribute?.('role');
    const type = element.getAttribute?.('type');

    const interactiveTags = ['button', 'input', 'textarea', 'select', 'a', 'form', 'img'];
    const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab'];
    const interactiveTypes = ['submit', 'button', 'checkbox', 'radio', 'text', 'password', 'email'];

    // Element is testable if it's an interactive tag, has interactive role, or has interactive type
    const isInteractive = interactiveTags.includes(tag) ||
                          interactiveRoles.includes(role) ||
                          interactiveTypes.includes(type);

    // Also check for event handlers
    const hasEventHandlers = element.hasAttribute?.('onclick') ||
                              element.hasAttribute?.('onsubmit') ||
                              element.hasAttribute?.('onchange');

    // Check for test attributes
    const hasTestAttributes = element.hasAttribute?.('data-testid') ||
                               element.hasAttribute?.('data-test') ||
                               element.hasAttribute?.('data-cy');

    // Check for meaningful text content (for text elements)
    const text = element.textContent?.trim() || '';
    const isTextElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'].includes(tag) &&
                          text.length > 0 && text.length < 200;

    return isInteractive || hasEventHandlers || hasTestAttributes || isTextElement;
  }
}
