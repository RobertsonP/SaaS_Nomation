export interface DetectedElement {
  selector: string;
  elementType: 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text';
  description: string;
  confidence: number;
  
  // NEW: Discovery context
  discoveryState?: 'static' | 'after_login' | 'after_interaction' | 'modal' | 'hover';
  discoveryTrigger?: string; // "clicked #menu", "logged in", "hovered .tooltip"
  sourcePageTitle?: string;  // Actual page title
  sourceUrlPath?: string;    // /contact, /dashboard
  requiresAuth?: boolean;
  isModal?: boolean;
  
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
    
    // Phase 2 Enhanced: Comprehensive CSS data for visual preview
    cssInfo?: {
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
    };
    
    // NEW: Element position and size
    boundingRect?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    
    [key: string]: any; // Allow additional attributes
  };
}

export interface PageAnalysisResult {
  url: string;
  elements: DetectedElement[];
  analysisDate: Date;
  success: boolean;
  errorMessage?: string;
  // ENHANCED ERROR HANDLING
  errorCategory?: 'NETWORK_ERROR' | 'TIMEOUT_ERROR' | 'AUTHENTICATION_ERROR' | 'JAVASCRIPT_ERROR' | 'BROWSER_ERROR' | 'ELEMENT_ANALYSIS_ERROR' | 'SSL_ERROR' | 'UNKNOWN_ERROR' | 'SLOW_SITE_TIMEOUT' | 'LOADING_TIMEOUT' | 'BOT_DETECTION';
  errorDetails?: {
    originalError: string;
    url: string;
    suggestions: string[];
    [key: string]: any;
  };
}

export interface SelectorValidationResult {
  selector: string;
  isValid: boolean;
  elementCount: number;
  qualityScore: number;
  suggestions: string[];
  error?: string;
  // Phase 2 Enhanced validation results
  isUnique?: boolean;
  stabilityScore?: number;
  accessibilityScore?: number;
  specificityScore?: number;
  crossPageValidation?: CrossPageValidationResult;
  alternativeSelectors?: string[];
  qualityBreakdown?: QualityMetrics;
}

// Phase 2: New interfaces for enhanced validation
export interface QualityMetrics {
  uniqueness: number;      // 0-1 score for selector uniqueness
  stability: number;       // 0-1 score for selector stability
  specificity: number;     // 0-1 score for selector specificity
  accessibility: number;   // 0-1 score for accessibility attributes
  overall: number;         // Weighted overall score
}

export interface CrossPageValidationResult {
  totalUrls: number;
  validUrls: number;
  uniqueOnAllPages: boolean;
  averageMatchCount: number;
  inconsistentPages: string[];
  validationErrors: string[];
}

// NEW: Authentication flow interfaces
export interface LoginStep {
  type: 'type' | 'click' | 'wait';
  selector: string;
  value?: string;
  description: string;
}

export interface LoginFlow {
  id?: string;
  name: string;
  loginUrl: string;
  steps: LoginStep[];
  credentials: {
    username: string;
    password: string;
  };
}

// NEW: State-based analysis interfaces
export interface StateBasedAnalysisResult {
  url: string;
  states: PageStateResult[];
  analysisDate: Date;
  success: boolean;
  errorMessage?: string;
}

export interface PageStateResult {
  stateName: string; // "initial", "after_login", "after_interaction"
  trigger?: string;  // What action led to this state
  elements: DetectedElement[];
  capturedAt: Date;
}

export interface ElementDifference {
  added: DetectedElement[];
  removed: DetectedElement[];
  unchanged: DetectedElement[];
  modified: DetectedElement[];
}

// NEW: Live browser session interface
export interface BrowserSession {
  id: string;
  projectId: string;
  browserInstance?: any; // Playwright browser instance
  pageInstance?: any;    // Playwright page instance
  isAuthenticated: boolean;
  currentState: string;
  startedAt: Date;
}