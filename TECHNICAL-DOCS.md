# Technical Documentation - Phase 2 Smart Element Discovery

## 🏗️ System Architecture Overview

This document contains technical specifications and architecture details for Phase 2 of the Nomation platform.

## 🎯 Phase 2 Technical Architecture

### Current System Analysis
The existing element discovery system consists of:
- **Backend**: Element analyzer service using Playwright
- **Frontend**: Element library panel with screenshot previews
- **Database**: Basic element storage with selector and metadata
- **API**: REST endpoints for element CRUD operations

### Enhanced System Design

#### Backend Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Enhanced Element Discovery                │
├─────────────────────────────────────────────────────────────┤
│  Page Load → Element Detection → CSS Capture →              │
│  Uniqueness Validation → Quality Scoring → Storage          │
└─────────────────────────────────────────────────────────────┘
```

#### Frontend Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Smart Preview System                     │
├─────────────────────────────────────────────────────────────┤
│  Load Data → CSS Rendering → Quality Display →              │
│  User Actions → Test Integration                            │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Technical Components

### 1. CSS Property Extractor
**Purpose**: Capture visual and layout properties during element discovery

**Implementation**:
```typescript
interface CSSPropertyExtractor {
  extractVisualProperties(element: ElementHandle): Promise<VisualProperties>;
  extractLayoutProperties(element: ElementHandle): Promise<LayoutProperties>;
  extractContentProperties(element: ElementHandle): Promise<ContentProperties>;
}

interface VisualProperties {
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
}

interface LayoutProperties {
  display: string;
  position: string;
  width: string;
  height: string;
  top: string;
  left: string;
  zIndex: string;
  overflow: string;
}

interface ContentProperties {
  text: string;
  placeholder?: string;
  value?: string;
  title?: string;
  alt?: string;
}
```

### 2. Selector Uniqueness Validator
**Purpose**: Ensure all selectors target exactly one element

**Algorithm**:
```typescript
interface UniquenessValidator {
  validateSelector(selector: string, page: Page): Promise<ValidationResult>;
  generateFallbackSelectors(element: ElementHandle): Promise<string[]>;
  improveSelector(selector: string, page: Page): Promise<string>;
}

interface ValidationResult {
  isUnique: boolean;
  matchCount: number;
  confidence: number;
  suggestions: string[];
  stabilityScore: number;
}

// Implementation Strategy
async function validateSelector(selector: string, page: Page): Promise<ValidationResult> {
  const elements = await page.$$(selector);
  const isUnique = elements.length === 1;
  
  if (!isUnique) {
    const improvements = await generateMoreSpecificSelectors(selector, page);
    return {
      isUnique: false,
      matchCount: elements.length,
      confidence: 0,
      suggestions: improvements,
      stabilityScore: calculateStabilityScore(selector)
    };
  }
  
  return {
    isUnique: true,
    matchCount: 1,
    confidence: 1.0,
    suggestions: [],
    stabilityScore: calculateStabilityScore(selector)
  };
}
```

### 3. Quality Scoring Algorithm
**Purpose**: Rate selector reliability and stability

**Scoring Factors**:
- **Uniqueness** (40%): Does selector target exactly one element?
- **Stability** (30%): Will selector survive DOM changes?
- **Specificity** (20%): Is selector appropriately specific?
- **Accessibility** (10%): Does selector use semantic attributes?

**Implementation**:
```typescript
interface QualityScorer {
  calculateOverallScore(element: EnhancedElement): QualityMetrics;
  calculateUniquenessScore(selector: string, page: Page): number;
  calculateStabilityScore(selector: string): number;
  calculateSpecificityScore(selector: string): number;
  calculateAccessibilityScore(element: ElementHandle): number;
}

function calculateStabilityScore(selector: string): number {
  const weights = {
    dataTestId: 1.0,        // data-testid="..." (most stable)
    id: 0.9,                // #unique-id (very stable)
    name: 0.8,              // [name="..."] (stable)
    className: 0.6,         // .class-name (moderate)
    textContent: 0.5,       // :contains("text") (moderate)
    nthChild: 0.2,          // :nth-child(n) (fragile)
    position: 0.1           // descendant selectors (fragile)
  };
  
  // Analyze selector components and calculate weighted score
  return calculateWeightedScore(selector, weights);
}
```

### 4. CSS Preview Renderer
**Purpose**: Generate instant visual previews using CSS data

**Frontend Component**:
```tsx
interface CSSPreviewProps {
  element: EnhancedElement;
  showQuality?: boolean;
  onSelect?: (element: EnhancedElement) => void;
}

const CSSPreview: React.FC<CSSPreviewProps> = ({ 
  element, 
  showQuality = true,
  onSelect 
}) => {
  const previewStyle = {
    ...element.cssProperties.visual,
    ...element.cssProperties.layout,
    maxWidth: '200px',
    maxHeight: '60px',
    overflow: 'hidden',
    cursor: 'pointer'
  };

  return (
    <div className="css-preview-container">
      <div 
        className="css-preview-element"
        style={previewStyle}
        onClick={() => onSelect?.(element)}
      >
        {element.cssProperties.content.text}
      </div>
      
      {showQuality && (
        <QualityIndicator 
          uniqueness={element.uniquenessScore}
          stability={element.qualityMetrics.stability}
          overall={element.qualityMetrics.overall}
        />
      )}
    </div>
  );
};
```

## 🗄️ Database Schema Updates

### Enhanced Element Storage
```sql
-- Add new columns to existing elements table
ALTER TABLE elements ADD COLUMN css_properties JSONB;
ALTER TABLE elements ADD COLUMN uniqueness_score DECIMAL(3,2) DEFAULT 0;
ALTER TABLE elements ADD COLUMN stability_score DECIMAL(3,2) DEFAULT 0;
ALTER TABLE elements ADD COLUMN quality_metrics JSONB;
ALTER TABLE elements ADD COLUMN fallback_selectors TEXT[];

-- Create quality tracking table
CREATE TABLE selector_quality_history (
  id SERIAL PRIMARY KEY,
  element_id UUID REFERENCES elements(id) ON DELETE CASCADE,
  selector VARCHAR(1000) NOT NULL,
  uniqueness_score DECIMAL(3,2) NOT NULL,
  stability_score DECIMAL(3,2) NOT NULL,
  match_count INTEGER NOT NULL,
  test_results JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create performance tracking table
CREATE TABLE css_preview_performance (
  id SERIAL PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  element_count INTEGER NOT NULL,
  extraction_time_ms INTEGER NOT NULL,
  rendering_time_ms INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_elements_uniqueness_score ON elements(uniqueness_score);
CREATE INDEX idx_elements_quality_metrics ON elements USING GIN(quality_metrics);
CREATE INDEX idx_quality_history_element_id ON selector_quality_history(element_id);
CREATE INDEX idx_quality_history_created_at ON selector_quality_history(created_at);
```

## 🔌 API Enhancements

### New Endpoints

#### CSS Property Extraction
```typescript
// POST /projects/:id/elements/analyze-with-css
interface AnalyzeWithCSSRequest {
  url: string;
  captureCSS: boolean;
  validateUniqueness: boolean;
}

interface AnalyzeWithCSSResponse {
  elements: EnhancedElement[];
  performance: {
    discoveryTime: number;
    cssExtractionTime: number;
    validationTime: number;
  };
  qualityStats: {
    uniqueSelectors: number;
    totalElements: number;
    averageQualityScore: number;
  };
}
```

#### Selector Validation
```typescript
// POST /projects/:id/validate-selector
interface ValidateSelectorRequest {
  selector: string;
  url?: string;
}

interface ValidateSelectorResponse {
  isValid: boolean;
  isUnique: boolean;
  matchCount: number;
  suggestions: string[];
  qualityScore: number;
  improvements: SelectorImprovement[];
}
```

#### Quality Metrics
```typescript
// GET /projects/:id/quality-metrics
interface QualityMetricsResponse {
  overall: {
    averageUniqueness: number;
    averageStability: number;
    totalElements: number;
    uniqueElements: number;
  };
  breakdown: {
    excellent: number;    // Score 0.8-1.0
    good: number;         // Score 0.6-0.8
    fair: number;         // Score 0.4-0.6
    poor: number;         // Score 0.0-0.4
  };
  recommendations: string[];
}
```

## 📊 Performance Specifications

### Target Metrics
- **CSS Extraction**: <50ms per element
- **Preview Rendering**: <100ms for element library
- **Uniqueness Validation**: <200ms per selector
- **Quality Scoring**: <10ms per element

### Optimization Strategies
1. **Batch Processing**: Extract CSS for multiple elements simultaneously
2. **Caching**: Cache computed styles for similar elements
3. **Lazy Loading**: Load previews as user scrolls
4. **Worker Threads**: Offload heavy computations

## 🧪 Testing Strategy

### Unit Tests
- CSS property extraction accuracy
- Selector uniqueness validation logic
- Quality scoring algorithm correctness
- Preview rendering performance

### Integration Tests
- End-to-end element discovery with CSS capture
- Frontend preview rendering with real data
- API endpoint functionality
- Database operation performance

### Performance Tests
- Element discovery speed with large pages
- CSS preview rendering with many elements
- Memory usage during analysis
- Database query optimization

---

**Document Version:** 1.0  
**Last Updated:** August 2, 2025  
**Next Review:** After implementation Phase 2.1