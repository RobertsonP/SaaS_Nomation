export interface DetectedElement {
  selector: string;
  elementType: 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text';
  description: string;
  confidence: number;
  attributes: {
    role?: string;
    'aria-label'?: string;
    'data-testid'?: string;
    text?: string;
    tag?: string;
    id?: string;
    class?: string;
    type?: string;
    name?: string;
    value?: string;
    href?: string;
    alt?: string;
    title?: string;
    placeholder?: string;
    [key: string]: any; // Allow additional attributes
  };
}

export interface PageAnalysisResult {
  url: string;
  elements: DetectedElement[];
  analysisDate: Date;
  success: boolean;
  errorMessage?: string;
}

export interface SelectorValidationResult {
  selector: string;
  isValid: boolean;
  elementCount: number;
  qualityScore: number;
  suggestions: string[];
  error?: string;
}