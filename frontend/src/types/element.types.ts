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
    type?: string;
  };
  sourceUrl?: {
    id: string;
    url: string;
    title?: string;
    description?: string;
  };
  screenshot?: string | null; // Base64 encoded screenshot
  createdAt: string;
  updatedAt: string;
}

export interface PageAnalysisResult {
  url: string;
  elements: ProjectElement[];
  analysisDate: string;
  success: boolean;
  errorMessage?: string;
  totalUrls?: number;
}

export interface SelectorValidationResult {
  selector: string;
  isValid: boolean;
  elementCount: number;
  qualityScore: number;
  suggestions: string[];
  error?: string;
}