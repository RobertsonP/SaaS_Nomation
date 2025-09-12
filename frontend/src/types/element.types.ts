// Phase 2: Enhanced CSS properties for instant visual preview
export interface CSSProperties {
  // Visual properties
  backgroundColor?: string;
  color?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  textDecoration?: string;
  textAlign?: string;
  lineHeight?: string;
  letterSpacing?: string;
  
  // Border and spacing
  padding?: string;
  margin?: string;
  border?: string;
  borderRadius?: string;
  boxShadow?: string;
  outline?: string;
  
  // Layout properties
  width?: string;
  height?: string;
  display?: string;
  position?: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  zIndex?: string;
  overflow?: string;
  
  // Visual effects and transforms
  opacity?: string;
  visibility?: string;
  transform?: string;
  filter?: string;
  cursor?: string;
  pointerEvents?: string;
  
  // Background and images
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  
  // Flexbox and Grid properties
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  
  // Interactive state indicators
  transition?: string;
  animation?: string;
  
  // Quality indicators for CSS preview
  isVisible?: boolean;
  hasBackground?: boolean;
  hasText?: boolean;
  isStyled?: boolean;
}

// Phase 2: Quality metrics for selector reliability assessment
export interface QualityMetrics {
  uniqueness: number;      // 0-1 score for selector uniqueness
  stability: number;       // 0-1 score for selector stability
  specificity: number;     // 0-1 score for selector specificity
  accessibility: number;   // 0-1 score for accessibility attributes
  overall: number;         // Weighted overall score
}

// Phase 2: Cross-page validation results
export interface CrossPageValidationResult {
  totalUrls: number;
  validUrls: number;
  uniqueOnAllPages: boolean;
  averageMatchCount: number;
  inconsistentPages: string[];
  validationErrors: string[];
}

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
    placeholder?: string;
    tagName?: string;
    sourceFile?: string;
    pickedLive?: boolean;
    pickedAt?: string;
    // Phase 2: Enhanced CSS data for visual preview
    cssInfo?: CSSProperties;
    // Phase 2: Element position and size
    boundingRect?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  sourceUrl?: {
    id: string;
    url: string;
    title?: string;
    description?: string;
  };
  screenshot?: string | null; // Base64 encoded screenshot
  
  // Phase 2: Enhanced quality and validation metrics
  uniquenessScore?: number;     // 0-1 score for selector uniqueness
  stabilityScore?: number;      // 0-1 score for selector stability
  accessibilityScore?: number;  // 0-1 score for accessibility attributes
  specificityScore?: number;    // 0-1 score for selector specificity
  overallQuality?: number;      // Weighted overall quality score 0-1
  qualityMetrics?: QualityMetrics; // Detailed quality breakdown
  
  // 🎯 CRITICAL FIX: Dedicated CSS info column for optimized preview rendering
  cssInfo?: CSSProperties; // CSS data stored in dedicated database column
  
  // Phase 2: Alternative and fallback selectors
  fallbackSelectors?: string[]; // Alternative selectors for this element
  isValidated?: boolean;        // Has been through Phase 2 validation
  lastValidated?: string;       // When quality validation was last performed
  validationErrors?: string[];  // Any validation errors or warnings
  
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
  // Phase 2: Enhanced validation results
  isUnique?: boolean;
  stabilityScore?: number;
  accessibilityScore?: number;
  specificityScore?: number;
  crossPageValidation?: CrossPageValidationResult;
  alternativeSelectors?: string[];
  qualityBreakdown?: QualityMetrics;
}

// Phase 2: Selector suggestion with quality context
export interface SelectorSuggestion {
  selector: string;
  score: number;
  reasoning: string;
  isUnique: boolean;
  type: 'improvement' | 'alternative' | 'fallback';
}

// Phase 2: Quality improvement recommendations
export interface SelectorImprovement {
  type: 'uniqueness' | 'stability' | 'accessibility' | 'specificity';
  description: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
  currentScore: number;
  potentialScore: number;
}