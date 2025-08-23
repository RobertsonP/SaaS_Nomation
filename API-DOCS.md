# API Documentation - Phase 2 Enhancements

## 🔌 API Changes for Smart Element Discovery 2.0

This document outlines new and modified API endpoints for Phase 2 implementation.

## 📋 Overview

Phase 2 introduces several new capabilities that require API enhancements:
- CSS property capture and storage
- Real-time selector uniqueness validation
- Quality scoring and metrics
- Enhanced element preview data

## 🆕 New Endpoints

### 1. Enhanced Element Analysis

#### `POST /projects/:id/analyze-enhanced`
Performs enhanced element discovery with CSS capture and quality validation.

**Request Body:**
```typescript
interface EnhancedAnalysisRequest {
  urls?: string[];              // Specific URLs to analyze (optional)
  captureCSS: boolean;          // Whether to capture CSS properties
  validateUniqueness: boolean;  // Whether to validate selector uniqueness
  qualityThreshold?: number;    // Minimum quality score (0-1)
}
```

**Response:**
```typescript
interface EnhancedAnalysisResponse {
  success: boolean;
  data: {
    elements: EnhancedElement[];
    performance: PerformanceMetrics;
    qualityStats: QualityStats;
    warnings: string[];
  };
}

interface EnhancedElement {
  id: string;
  selector: string;
  elementType: string;
  description: string;
  confidence: number;
  attributes: Record<string, any>;
  sourceUrl: {
    id: string;
    url: string;
    title?: string;
  };
  // New Phase 2 properties
  cssProperties: CSSProperties;
  uniquenessScore: number;
  qualityMetrics: QualityMetrics;
  fallbackSelectors: string[];
  stabilityScore: number;
}

interface CSSProperties {
  visual: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontFamily: string;
    fontWeight: string;
    border: string;
    borderRadius: string;
    padding: string;
    margin: string;
    textDecoration: string;
  };
  layout: {
    display: string;
    position: string;
    width: string;
    height: string;
    top: string;
    left: string;
    zIndex: string;
    overflow: string;
  };
  content: {
    text: string;
    placeholder?: string;
    value?: string;
    title?: string;
    alt?: string;
  };
}

interface QualityMetrics {
  uniqueness: number;     // 0-1 score
  stability: number;      // 0-1 score
  specificity: number;    // 0-1 score
  accessibility: number; // 0-1 score
  overall: number;        // Weighted average
}

interface PerformanceMetrics {
  discoveryTime: number;      // Element discovery time (ms)
  cssExtractionTime: number;  // CSS property extraction time (ms)
  validationTime: number;     // Uniqueness validation time (ms)
  totalTime: number;          // Total analysis time (ms)
  elementsProcessed: number;  // Number of elements analyzed
}

interface QualityStats {
  totalElements: number;
  uniqueElements: number;
  averageQualityScore: number;
  excellentCount: number;     // Score 0.8-1.0
  goodCount: number;          // Score 0.6-0.8
  fairCount: number;          // Score 0.4-0.6
  poorCount: number;          // Score 0.0-0.4
}
```

### 2. Selector Validation

#### `POST /projects/:id/validate-selector`
Validates a selector for uniqueness and provides improvement suggestions.

**Request Body:**
```typescript
interface ValidateSelectorRequest {
  selector: string;
  url?: string;               // URL to test against (optional)
  generateAlternatives?: boolean; // Generate alternative selectors
}
```

**Response:**
```typescript
interface ValidateSelectorResponse {
  isValid: boolean;
  isUnique: boolean;
  matchCount: number;
  qualityScore: number;
  stabilityScore: number;
  suggestions: SelectorSuggestion[];
  improvements: SelectorImprovement[];
  performance: {
    validationTime: number;
    generationTime: number;
  };
}

interface SelectorSuggestion {
  selector: string;
  score: number;
  reasoning: string;
  isUnique: boolean;
}

interface SelectorImprovement {
  type: 'specificity' | 'stability' | 'accessibility' | 'uniqueness';
  description: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
}
```

### 3. Quality Metrics

#### `GET /projects/:id/quality-metrics`
Retrieves quality metrics and analytics for project elements.

**Response:**
```typescript
interface QualityMetricsResponse {
  overall: {
    averageUniqueness: number;
    averageStability: number;
    averageQuality: number;
    totalElements: number;
    uniqueElements: number;
    problematicElements: number;
  };
  breakdown: {
    excellent: number;    // Count of elements with score 0.8-1.0
    good: number;         // Count of elements with score 0.6-0.8
    fair: number;         // Count of elements with score 0.4-0.6
    poor: number;         // Count of elements with score 0.0-0.4
  };
  recommendations: Recommendation[];
  trends: {
    improvementSuggestions: number;
    criticalIssues: number;
    stabilityIssues: number;
  };
}

interface Recommendation {
  type: 'critical' | 'improvement' | 'optimization';
  title: string;
  description: string;
  affectedElements: number;
  actionRequired: string;
}
```

### 4. Bulk Selector Improvement

#### `POST /projects/:id/improve-selectors`
Automatically improves low-quality selectors in the project.

**Request Body:**
```typescript
interface ImproveSelectorsRequest {
  minQualityThreshold: number;  // Only improve selectors below this score
  autoApply: boolean;           // Automatically apply improvements
  strategies: string[];         // ['uniqueness', 'stability', 'accessibility']
}
```

**Response:**
```typescript
interface ImproveSelectorsResponse {
  improved: SelectorImprovement[];
  failed: SelectorFailure[];
  summary: {
    totalProcessed: number;
    successfullyImproved: number;
    averageImprovement: number;
    criticalIssuesResolved: number;
  };
}

interface SelectorImprovement {
  elementId: string;
  originalSelector: string;
  improvedSelector: string;
  qualityImprovement: number;
  changes: string[];
}

interface SelectorFailure {
  elementId: string;
  selector: string;
  reason: string;
  suggestions: string[];
}
```

## 🔄 Modified Endpoints

### 1. Enhanced Element Retrieval

#### `GET /projects/:id/elements` (Enhanced)
Now includes CSS properties and quality metrics.

**New Query Parameters:**
```typescript
interface ElementsQueryParams {
  includeCSS?: boolean;         // Include CSS properties (default: true)
  includeQuality?: boolean;     // Include quality metrics (default: true)
  minQuality?: number;          // Filter by minimum quality score
  uniqueOnly?: boolean;         // Only return unique selectors
  sortBy?: 'quality' | 'uniqueness' | 'stability' | 'created';
}
```

**Enhanced Response:**
```typescript
interface ElementsResponse {
  elements: EnhancedElement[];  // Now includes CSS and quality data
  pagination: PaginationInfo;
  filters: ActiveFilters;
  summary: {
    total: number;
    unique: number;
    averageQuality: number;
  };
}
```

### 2. Element Creation with Quality Validation

#### `POST /projects/:id/elements` (Enhanced)
Now validates uniqueness and calculates quality scores during creation.

**Enhanced Request Body:**
```typescript
interface CreateElementRequest {
  selector: string;
  elementType: string;
  description: string;
  sourceUrl: string;
  // New validation options
  validateUniqueness?: boolean;  // Default: true
  captureCSS?: boolean;         // Default: true
  calculateQuality?: boolean;   // Default: true
}
```

**Enhanced Response:**
```typescript
interface CreateElementResponse {
  element: EnhancedElement;
  validation: ValidationResult;
  warnings: string[];
  suggestions: SelectorSuggestion[];
}
```

## 🚨 Error Handling

### New Error Codes

```typescript
enum PhaseIIErrorCodes {
  CSS_EXTRACTION_FAILED = 'CSS_EXTRACTION_FAILED',
  SELECTOR_NOT_UNIQUE = 'SELECTOR_NOT_UNIQUE',
  QUALITY_THRESHOLD_NOT_MET = 'QUALITY_THRESHOLD_NOT_MET',
  VALIDATION_TIMEOUT = 'VALIDATION_TIMEOUT',
  IMPROVEMENT_FAILED = 'IMPROVEMENT_FAILED'
}
```

### Error Response Format

```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    suggestions?: string[];
  };
  context?: {
    elementId?: string;
    selector?: string;
    projectId?: string;
  };
}
```

### Example Error Responses

```typescript
// Selector not unique error
{
  "error": {
    "code": "SELECTOR_NOT_UNIQUE",
    "message": "Selector matches multiple elements",
    "details": {
      "matchCount": 3,
      "selector": ".button"
    },
    "suggestions": [
      "Use more specific selector: .primary-button",
      "Add unique identifier: #submit-button",
      "Use data attribute: [data-testid='submit']"
    ]
  },
  "context": {
    "selector": ".button",
    "projectId": "proj_123"
  }
}

// CSS extraction failed error
{
  "error": {
    "code": "CSS_EXTRACTION_FAILED",
    "message": "Unable to extract CSS properties",
    "details": {
      "reason": "Element not visible",
      "elementSelector": "#hidden-element"
    }
  },
  "context": {
    "elementId": "elem_456",
    "selector": "#hidden-element"
  }
}
```

## 🔐 Authentication & Authorization

All new endpoints follow existing authentication patterns:
- Require valid JWT token
- Project-level authorization (user must have access to project)
- Rate limiting applied to analysis endpoints

## 📊 Rate Limiting

### Enhanced Analysis Endpoints
- `POST /projects/:id/analyze-enhanced`: 5 requests per minute
- `POST /projects/:id/validate-selector`: 60 requests per minute
- `POST /projects/:id/improve-selectors`: 3 requests per minute

### Metrics Endpoints
- `GET /projects/:id/quality-metrics`: 30 requests per minute

## 🔄 Backward Compatibility

All existing endpoints remain unchanged. New functionality is additive:
- Existing element responses include new fields when available
- Legacy clients continue to work without modification
- New fields are optional in requests

## 📝 Migration Notes

For clients upgrading to Phase 2:
1. Update TypeScript interfaces to include new fields
2. Handle new error codes appropriately
3. Consider using enhanced analysis for better element quality
4. Implement CSS preview rendering for faster user experience

---

**API Version:** 2.0  
**Last Updated:** August 2, 2025  
**Compatibility:** Backward compatible with v1.x