// Strategy interface and base class
export * from './selector-strategy.interface';

// Individual strategies
export * from './testid-selector.strategy';
export * from './id-selector.strategy';
export * from './playwright-selector.strategy';
export * from './semantic-selector.strategy';
export * from './attribute-selector.strategy';
export * from './combined-selector.strategy';
export * from './xpath-selector.strategy';

// Import all strategies for easy registration
import { SelectorStrategy } from './selector-strategy.interface';
import { TestIdSelectorStrategy } from './testid-selector.strategy';
import { IdSelectorStrategy } from './id-selector.strategy';
import { PlaywrightSelectorStrategy } from './playwright-selector.strategy';
import { SemanticSelectorStrategy } from './semantic-selector.strategy';
import { AttributeSelectorStrategy } from './attribute-selector.strategy';
import { CombinedSelectorStrategy } from './combined-selector.strategy';
import { XPathSelectorStrategy } from './xpath-selector.strategy';

/**
 * Get all available selector strategies in priority order
 */
export function getAllStrategies(): SelectorStrategy[] {
  return [
    new TestIdSelectorStrategy(),
    new IdSelectorStrategy(),
    new PlaywrightSelectorStrategy(),
    new SemanticSelectorStrategy(),
    new AttributeSelectorStrategy(),
    new CombinedSelectorStrategy(),
    new XPathSelectorStrategy()
  ].sort((a, b) => a.priority - b.priority);
}

/**
 * Get strategies that don't require Playwright-specific features
 */
export function getCssOnlyStrategies(): SelectorStrategy[] {
  return getAllStrategies().filter(s => !s.requiresPlaywright);
}
