import { Injectable, Logger } from '@nestjs/common';
import { DetectedElement } from './interfaces/element.interface';
import { OllamaService } from './ollama.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private ollamaService: OllamaService) {}

  async analyzeAriaSnapshot(ariaSnapshot: string, url: string): Promise<DetectedElement[]> {
    try {
      this.logger.log(`Starting AI analysis for ${url}`);
      
      // Try Ollama AI analysis first if available
      const htmlContent = this.extractHtmlFromAriaSnapshot(ariaSnapshot);
      if (htmlContent && this.ollamaService.isOllamaAvailable()) {
        const ollamaElements = await this.ollamaService.analyzePageElements(htmlContent, url);
        if (ollamaElements.length > 0) {
          this.logger.log(`✅ Ollama found ${ollamaElements.length} elements`);
          return ollamaElements;
        }
      }
      
      // Fallback to rule-based analysis
      this.logger.log('Falling back to rule-based analysis');
      return this.parseAriaSnapshotRuleBased(ariaSnapshot);
      
    } catch (error) {
      this.logger.error('AI analysis failed:', error);
      return this.parseAriaSnapshotRuleBased(ariaSnapshot);
    }
  }

  private extractHtmlFromAriaSnapshot(ariaSnapshot: string): string | null {
    // Try to extract HTML content from ARIA snapshot
    // If ariaSnapshot contains HTML, use it; otherwise return null for fallback
    if (ariaSnapshot.includes('<html') || ariaSnapshot.includes('<!DOCTYPE')) {
      return ariaSnapshot;
    }
    return null;
  }

  private buildAnalysisPrompt(ariaSnapshot: string): string {
    return `
      Analyze this ARIA snapshot and extract interactive elements suitable for automated testing.
      For each element, provide:
      1. A reliable CSS selector
      2. Element type (button, input, link, form, navigation, text)
      3. A descriptive name
      4. Confidence score (0-1)
      5. Important attributes
      
      Focus on elements that are:
      - Interactive (clickable, fillable)
      - Have stable identifiers (id, data-testid, aria-label)
      - Are likely to be used in automated tests
      
      ARIA Snapshot:
      ${ariaSnapshot}
      
      Return as JSON array of elements with this structure:
      {
        "selector": "CSS selector",
        "elementType": "button|input|link|form|navigation|text",
        "description": "Human readable description",
        "confidence": 0.85,
        "attributes": {
          "role": "button",
          "aria-label": "Submit form",
          "text": "Submit"
        }
      }
    `;
  }

  private parseAriaSnapshotRuleBased(ariaSnapshot: string): DetectedElement[] {
    const elements: DetectedElement[] = [];
    
    try {
      // Try to parse as JSON first (accessibility tree)
      const accessibilityTree = JSON.parse(ariaSnapshot);
      return this.parseAccessibilityTree(accessibilityTree);
    } catch {
      // Fallback: parse as text-based ARIA snapshot
      return this.parseTextAriaSnapshot(ariaSnapshot);
    }
  }

  private parseAccessibilityTree(node: any, elements: DetectedElement[] = []): DetectedElement[] {
    if (!node) return elements;

    // Process current node
    if (node.role && this.isInteractiveRole(node.role)) {
      const element = this.createElementFromAccessibilityNode(node);
      if (element) elements.push(element);
    }

    // Process children recursively
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.parseAccessibilityTree(child, elements);
      }
    }

    return elements;
  }

  private parseTextAriaSnapshot(ariaSnapshot: string): DetectedElement[] {
    const elements: DetectedElement[] = [];
    const lines = ariaSnapshot.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Enhanced pattern matching for interactive elements
      const patterns = [
        { pattern: /button|role="button"/i, type: 'button' as const },
        { pattern: /textbox|input|role="textbox"/i, type: 'input' as const },
        { pattern: /link|role="link"/i, type: 'link' as const },
        { pattern: /navigation|role="navigation"/i, type: 'navigation' as const },
        { pattern: /checkbox|role="checkbox"/i, type: 'input' as const },
        { pattern: /radio|role="radio"/i, type: 'input' as const },
        { pattern: /combobox|role="combobox"|select/i, type: 'input' as const },
        { pattern: /form|role="form"/i, type: 'form' as const },
        { pattern: /tab|role="tab"/i, type: 'button' as const },
        { pattern: /menu|role="menu"/i, type: 'navigation' as const }
      ];

      for (const { pattern, type } of patterns) {
        if (pattern.test(trimmedLine)) {
          const element = this.createElementFromLine(trimmedLine, type);
          if (element) elements.push(element);
          break; // Only match first pattern to avoid duplicates
        }
      }
    }
    
    return elements;
  }

  private isInteractiveRole(role: string): boolean {
    const interactiveRoles = [
      'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 
      'listbox', 'tab', 'menuitem', 'option', 'switch', 'slider',
      'spinbutton', 'searchbox', 'form', 'navigation'
    ];
    return interactiveRoles.includes(role.toLowerCase());
  }

  private createElementFromAccessibilityNode(node: any): DetectedElement | null {
    try {
      const attributes: any = { role: node.role };
      let selector = '';
      let confidence = 0.5;
      let description = '';
      let elementType: DetectedElement['elementType'] = this.mapRoleToElementType(node.role);

      // Extract name/label
      if (node.name) {
        attributes['aria-label'] = node.name;
        description = node.name;
        selector = `[aria-label="${node.name}"]`;
        confidence = 0.8;
      }

      // Extract value for inputs
      if (node.value) {
        attributes.value = node.value;
      }

      // Use role if no better selector available
      if (!selector && node.role) {
        selector = `[role="${node.role}"]`;
        description = `${node.role} element`;
        confidence = 0.6;
      }

      // Enhance selector with additional attributes
      if (node.checked !== undefined) {
        attributes['aria-checked'] = node.checked.toString();
        selector += `[aria-checked="${node.checked}"]`;
        confidence += 0.1;
      }

      if (node.expanded !== undefined) {
        attributes['aria-expanded'] = node.expanded.toString();
        selector += `[aria-expanded="${node.expanded}"]`;
        confidence += 0.1;
      }

      if (!selector) return null;

      return {
        selector: selector.length > 100 ? `[role="${node.role}"]` : selector, // Fallback for overly complex selectors
        elementType,
        description: description || `${elementType} element`,
        confidence: Math.min(confidence, 1),
        attributes
      };
    } catch (error) {
      console.error('Error creating element from accessibility node:', error);
      return null;
    }
  }

  private mapRoleToElementType(role: string): DetectedElement['elementType'] {
    const roleMap: Record<string, DetectedElement['elementType']> = {
      'button': 'button',
      'link': 'link', 
      'textbox': 'input',
      'searchbox': 'input',
      'checkbox': 'input',
      'radio': 'input',
      'combobox': 'input',
      'listbox': 'input',
      'spinbutton': 'input',
      'slider': 'input',
      'switch': 'input',
      'form': 'form',
      'navigation': 'navigation',
      'tab': 'button',
      'menuitem': 'button',
      'option': 'button'
    };
    return roleMap[role.toLowerCase()] || 'button';
  }

  private createElementFromLine(line: string, elementType: DetectedElement['elementType']): DetectedElement | null {
    try {
      const attributes: any = {};
      
      // Enhanced attribute extraction with multiple patterns
      const extractors = [
        { pattern: /"([^"]+)"/g, key: 'text' },
        { pattern: /aria-label="([^"]+)"/g, key: 'aria-label' },
        { pattern: /role="([^"]+)"/g, key: 'role' },
        { pattern: /id="([^"]+)"/g, key: 'id' },
        { pattern: /class="([^"]+)"/g, key: 'class' },
        { pattern: /data-testid="([^"]+)"/g, key: 'data-testid' },
        { pattern: /placeholder="([^"]+)"/g, key: 'placeholder' },
        { pattern: /title="([^"]+)"/g, key: 'title' },
        { pattern: /name="([^"]+)"/g, key: 'name' },
        { pattern: /value="([^"]+)"/g, key: 'value' },
        { pattern: /href="([^"]+)"/g, key: 'href' },
        { pattern: /alt="([^"]+)"/g, key: 'alt' }
      ];

      // Extract all attributes
      for (const { pattern, key } of extractors) {
        const matches = [...line.matchAll(pattern)];
        if (matches.length > 0) {
          if (key === 'text' && !attributes.text) {
            // Only take first text match to avoid confusion
            attributes[key] = matches[0][1];
          } else if (key !== 'text') {
            attributes[key] = matches[0][1];
          }
        }
      }

      // Generate smart selector with priority system
      let selector = '';
      let confidence = 0.5;
      let description = '';

      // Priority 1: data-testid (most stable)
      if (attributes['data-testid']) {
        selector = `[data-testid="${attributes['data-testid']}"]`;
        description = attributes['data-testid'];
        confidence = 0.9;
      }
      // Priority 2: id (stable if unique)
      else if (attributes.id) {
        selector = `#${attributes.id}`;
        description = attributes.id;
        confidence = 0.85;
      }
      // Priority 3: aria-label (semantic and stable)
      else if (attributes['aria-label']) {
        selector = `[aria-label="${attributes['aria-label']}"]`;
        description = attributes['aria-label'];
        confidence = 0.8;
      }
      // Priority 4: name attribute (for form elements)
      else if (attributes.name && elementType === 'input') {
        selector = `input[name="${attributes.name}"]`;
        description = `${attributes.name} input`;
        confidence = 0.75;
      }
      // Priority 5: text content with element type
      else if (attributes.text) {
        const cleanText = attributes.text.replace(/"/g, '\\"');
        if (elementType === 'button') {
          selector = `button:has-text("${cleanText}")`;
          description = `${attributes.text} button`;
        } else if (elementType === 'link') {
          selector = `a:has-text("${cleanText}")`;
          description = `${attributes.text} link`;
        } else {
          selector = `${elementType}:has-text("${cleanText}")`;
          description = attributes.text;
        }
        confidence = 0.7;
      }
      // Priority 6: role + additional attributes
      else if (attributes.role) {
        selector = `[role="${attributes.role}"]`;
        description = `${attributes.role} element`;
        confidence = 0.6;
        
        // Enhance with additional attributes for uniqueness
        if (attributes.title) {
          selector += `[title="${attributes.title}"]`;
          description = attributes.title;
          confidence += 0.1;
        } else if (attributes.alt) {
          selector += `[alt="${attributes.alt}"]`;
          description = attributes.alt;
          confidence += 0.1;
        }
      }
      // Priority 7: element type + class (less stable)
      else if (attributes.class) {
        const classes = attributes.class.split(' ');
        const stableClass = classes.find(cls => 
          !cls.includes('btn-') && !cls.includes('bg-') && !cls.includes('text-') &&
          !cls.includes('p-') && !cls.includes('m-') && !cls.includes('w-') &&
          !cls.includes('h-') && cls.length > 3
        );
        if (stableClass) {
          selector = `${elementType}.${stableClass}`;
          description = `${elementType} with ${stableClass}`;
          confidence = 0.5;
        }
      }
      
      // Fallback: generic element type selector
      if (!selector) {
        selector = elementType === 'input' ? 'input' : elementType;
        description = `${elementType} element`;
        confidence = 0.3;
      }

      // Add element type to attributes for better categorization
      attributes.elementType = elementType;

      return {
        selector,
        elementType,
        description,
        confidence: Math.min(confidence, 1),
        attributes
      };
    } catch (error) {
      console.error('Error creating element from line:', line, error);
      return null;
    }
  }

  async callAIAPI(prompt: string): Promise<any> {
    // Placeholder for future AI API integration
    // Could integrate with OpenAI, Claude, or other AI services
    console.log('AI API call would be made here with prompt:', prompt.substring(0, 100) + '...');
    
    // For now, return empty response
    return { elements: [] };
  }
}