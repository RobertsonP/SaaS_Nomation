export interface ProjectElement {
  id: string;
  projectId: string;
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
  };
  sourceUrl?: {
    id: string;
    url: string;
    title?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PageAnalysisResult {
  url: string;
  elements: ProjectElement[];
  analysisDate: string;
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