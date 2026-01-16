import { Injectable } from '@nestjs/common';
import { QualityMetrics } from './interfaces/element.interface';
import { Page, ElementHandle } from 'playwright';

@Injectable()
export class SelectorQualityService {
  // Minimum quality threshold - selectors below this are rejected
  private readonly MIN_QUALITY_THRESHOLD = 0.35;

  /**
   * Check if a selector should be rejected (too low quality or problematic pattern)
   */
  shouldRejectSelector(selector: string): { reject: boolean; reason: string | null } {
    // Reject selectors that are ONLY positional (no semantic value)
    const positionalOnlyPattern = /^[a-z]+:nth-(child|of-type)\(\d+\)$/i;
    if (positionalOnlyPattern.test(selector.trim())) {
      return { reject: true, reason: 'Position-only selector (e.g., a:nth-child(2)) is too fragile' };
    }

    // Reject selectors that end with only :nth-child without any other identifying attribute
    const endsWithNthPattern = /^[a-z]+ ?> ?[a-z]+:nth-(child|of-type)\(\d+\)$/i;
    if (endsWithNthPattern.test(selector.trim())) {
      return { reject: true, reason: 'Selector relies only on position without semantic attributes' };
    }

    // Reject generic tag-only selectors
    const genericTagPattern = /^(div|span|a|li|p|ul|ol)$/i;
    if (genericTagPattern.test(selector.trim())) {
      return { reject: true, reason: 'Generic tag selector without any attributes' };
    }

    // Reject selectors that are just a class on a generic element without other context
    const genericWithClassPattern = /^(div|span)\.[a-z0-9_-]+$/i;
    if (genericWithClassPattern.test(selector.trim())) {
      return { reject: true, reason: 'Generic element with single class is too common' };
    }

    return { reject: false, reason: null };
  }

  /**
   * Filter a list of selectors, keeping only high-quality ones
   */
  filterQualitySelectors(selectors: string[], minQuality?: number): string[] {
    const threshold = minQuality ?? this.MIN_QUALITY_THRESHOLD;
    return selectors.filter(selector => {
      const { reject } = this.shouldRejectSelector(selector);
      if (reject) return false;

      const quality = this.calculateSelectorQuality(selector, 1);
      return quality >= threshold;
    });
  }

  calculateEnhancedSelectorQuality(selector: string, elementCount: number, elementHandle?: ElementHandle): QualityMetrics {
    const uniquenessScore = this.calculateUniquenessScore(selector, elementCount);
    const stabilityScore = this.calculateStabilityScore(selector);
    const specificityScore = this.calculateSpecificityScore(selector);
    const accessibilityScore = this.calculateAccessibilityScore(selector, elementHandle);

    const overall = (
      uniquenessScore * 0.4 +
      stabilityScore * 0.3 +
      specificityScore * 0.2 +
      accessibilityScore * 0.1
    );

    return {
      uniqueness: uniquenessScore,
      stability: stabilityScore,
      specificity: specificityScore,
      accessibility: accessibilityScore,
      overall: Math.max(0, Math.min(1, overall))
    };
  }

  calculateUniquenessScore(selector: string, elementCount: number): number {
    if (elementCount === 0) return 0;
    if (elementCount === 1) return 1.0;
    if (elementCount <= 3) return 0.7;
    if (elementCount <= 10) return 0.4;
    return 0.1;
  }

  calculateStabilityScore(selector: string): number {
    let score = 0.5;

    if (selector.includes('[data-testid=') || selector.includes('data-testid=')) {
      score += 0.5;
    } else if (selector.includes('[data-test') || selector.includes('[data-cy') || selector.includes('[data-e2e')) {
      score += 0.45;
    } else if (selector.includes('[aria-label=') || selector.includes('aria-label=')) {
      score += 0.4;
    } else if (selector.includes('[id=') || selector.includes('#') && !selector.includes('nth-')) {
      score += 0.35;
    } else if (selector.includes('[role=') || selector.includes('role=')) {
      score += 0.3;
    } else if (selector.includes('[name=') || selector.includes('name=')) {
      score += 0.25;
    }

    if (selector.includes('nth-child') || selector.includes('nth-of-type')) {
      score -= 0.3;
    }
    if (selector.includes(':first-child') || selector.includes(':last-child')) {
      score -= 0.2;
    }
    if (selector.split(' ').length > 4) {
      score -= 0.15;
    }
    if (selector.includes('>>') || selector.includes('xpath=')) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  calculateSpecificityScore(selector: string): number {
    let score = 0.5;

    const parts = selector.split(' ').filter(p => p.trim() !== '');
    const complexity = parts.length;

    if (complexity >= 2 && complexity <= 3) {
      score += 0.3;
    } else if (complexity === 1) {
      score += 0.1;
    } else if (complexity > 3) {
      score -= 0.2;
    }

    if (selector.includes('[type=') || selector.includes('input[')) {
      score += 0.2;
    }

    if (selector === 'div' || selector === 'span' || selector === 'a') {
      score -= 0.4;
    }

    return Math.max(0, Math.min(1, score));
  }

  calculateAccessibilityScore(selector: string, elementHandle?: ElementHandle): number {
    let score = 0.3;

    if (selector.includes('[aria-label=') || selector.includes('aria-label=')) {
      score += 0.4;
    }
    if (selector.includes('[aria-') || selector.includes('aria-')) {
      score += 0.3;
    }
    if (selector.includes('[role=') || selector.includes('role=')) {
      score += 0.3;
    }
    if (selector.includes('[alt=') || selector.includes('alt=')) {
      score += 0.2;
    }
    if (selector.includes('[title=') || selector.includes('title=')) {
      score += 0.1;
    }

    const semanticElements = ['button', 'input', 'textarea', 'select', 'a', 'form', 'label'];
    if (semanticElements.some(elem => selector.includes(elem))) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  // Backward compatibility
  calculateSelectorQuality(selector: string, elementCount: number): number {
    const metrics = this.calculateEnhancedSelectorQuality(selector, elementCount);
    return metrics.overall;
  }

  generateSelectorSuggestions(selector: string, elementCount: number): string[] {
    const suggestions: string[] = [];

    if (elementCount === 0) {
      suggestions.push('Element not found - check if selector is correct');
      suggestions.push('Try using browser dev tools to inspect the element');
      suggestions.push('Consider using more specific attributes like data-testid');
    } else if (elementCount > 1) {
      suggestions.push(`${elementCount} elements match - consider adding more specific attributes`);
      suggestions.push('Use :first, :last, or :nth-child() to target specific element');
      suggestions.push('Add data-testid attribute to the target element for better uniqueness');
    } else {
      suggestions.push('Great! Selector finds exactly one element');
    }

    if (selector.includes('nth-child')) {
      suggestions.push('Position-based selectors may break if page structure changes');
      suggestions.push('Consider using semantic attributes instead');
    }

    if (!selector.includes('[') && !selector.includes('#') && !selector.includes('.')) {
      suggestions.push('Consider using ID, class, or attribute selectors for better stability');
    }

    if (selector.split(' ').length > 3) {
      suggestions.push('Complex selectors may be fragile - try to simplify if possible');
    }

    return suggestions;
  }

  generateEnhancedSelectorSuggestions(selector: string, elementCount: number, qualityMetrics: QualityMetrics): string[] {
    const suggestions: string[] = [];

    if (elementCount === 0) {
      suggestions.push('🔍 Element not found - verify selector syntax and element existence');
      suggestions.push('💡 Use browser dev tools to inspect and get the correct selector');
      if (qualityMetrics.accessibility < 0.5) {
        suggestions.push('♿ Consider using accessible attributes like aria-label or role');
      }
    } else if (elementCount > 1) {
      suggestions.push(`⚠️ ${elementCount} elements match - selector needs to be more specific`);
      if (qualityMetrics.uniqueness < 0.5) {
        suggestions.push('🎯 Add unique identifiers: data-testid, id, or specific attributes');
        suggestions.push('🔧 Use :first, :last, or :nth-child() as temporary solution');
      }
    } else {
      suggestions.push('✅ Perfect! Selector finds exactly one element');
    }

    if (qualityMetrics.stability < 0.6) {
      suggestions.push('⚡ Improve stability: use data-testid or semantic attributes');
      if (selector.includes('nth-child') || selector.includes('nth-of-type')) {
        suggestions.push('🏗️ Position-based selectors are fragile - use semantic attributes instead');
      }
      if (!selector.includes('[data-') && !selector.includes('[aria-')) {
        suggestions.push('🛡️ Add test-specific attributes for better reliability');
      }
    }

    if (qualityMetrics.specificity < 0.5) {
      if (selector.split(' ').length > 4) {
        suggestions.push('🎛️ Selector is too complex - simplify for better maintainability');
      } else if (selector.split(' ').length === 1 && !selector.includes('[') && !selector.includes('#')) {
        suggestions.push('🔍 Selector is too broad - add more specific attributes');
      }
    }

    if (qualityMetrics.accessibility < 0.5) {
      suggestions.push('♿ Enhance accessibility: use aria-label, role, or semantic elements');
      suggestions.push('🏷️ Consider using form labels and semantic HTML elements');
    }

    if (qualityMetrics.overall < 0.6) {
      suggestions.push('📈 Overall quality is low - consider improving stability and uniqueness');
    } else if (qualityMetrics.overall >= 0.8) {
      suggestions.push('🌟 Excellent selector quality - this is test-automation ready!');
    }

    return suggestions;
  }

  async generateAlternativeSelectors(page: Page, originalSelector: string, elementHandle: ElementHandle): Promise<string[]> {
    if (!elementHandle) return [];

    try {
      const alternatives = await page.evaluate((node) => {
        // Cast Node to Element for proper type access
        const element = node as Element;
        const suggestions: string[] = [];

        // Check for ID
        if (element.id && element.id.trim() !== '') {
          suggestions.push(`#${element.id}`);
        }

        // Check for data-testid
        const testId = element.getAttribute('data-testid');
        if (testId) {
          suggestions.push(`[data-testid="${testId}"]`);
        }

        // Check for aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          suggestions.push(`[aria-label="${ariaLabel}"]`);
        }

        // Check for name attribute
        const name = element.getAttribute('name');
        if (name) {
          suggestions.push(`${element.tagName.toLowerCase()}[name="${name}"]`);
        }

        // Check for type + class combination
        const type = element.getAttribute('type');
        const className = element.className;
        if (type && typeof className === 'string' && className) {
          const firstClass = className.split(' ')[0];
          if (firstClass) {
            suggestions.push(`${element.tagName.toLowerCase()}[type="${type}"].${firstClass}`);
          }
        }

        // Check for parent-child combinations
        const parent = element.parentElement;
        if (parent && parent.id) {
          suggestions.push(`#${parent.id} > ${element.tagName.toLowerCase()}`);
        }

        return suggestions;
      }, elementHandle);

      return alternatives.filter(alt => alt !== originalSelector);

    } catch (error) {
      console.warn('Failed to generate alternative selectors:', error);
      return [];
    }
  }

  generateCrossPageSuggestions(validation: {
    validUrls: number;
    totalUrls: number;
    uniqueOnAllPages: boolean;
    inconsistentPages: string[];
    averageMatchCount: number;
    validationErrors: string[];
  }, selector: string): string[] {
    const suggestions: string[] = [];

    if (validation.validUrls === 0) {
      suggestions.push('❌ Selector not found on any project pages');
      suggestions.push('🔍 Verify selector exists across your application');
    } else if (validation.validUrls < validation.totalUrls) {
      suggestions.push(`⚠️ Selector only works on ${validation.validUrls}/${validation.totalUrls} pages`);
      suggestions.push('🌐 Consider using more universal selectors for cross-page consistency');
    }

    if (!validation.uniqueOnAllPages) {
      suggestions.push('🎯 Selector matches multiple elements on some pages');
      suggestions.push('🔧 Add more specific attributes to ensure uniqueness');
      if (validation.inconsistentPages.length > 0) {
        suggestions.push(`📋 Inconsistent pages: ${validation.inconsistentPages.slice(0, 3).join(', ')}`);
      }
    }

    if (validation.averageMatchCount > 3) {
      suggestions.push('📊 High average match count indicates selector is too broad');
    }

    if (validation.validationErrors.length > 0) {
      suggestions.push('🚨 Some pages had validation errors - check browser console');
    }

    if (validation.uniqueOnAllPages && validation.validUrls === validation.totalUrls) {
      suggestions.push('🎉 Perfect cross-page consistency! This selector is production-ready');
    }

    return suggestions;
  }
}
