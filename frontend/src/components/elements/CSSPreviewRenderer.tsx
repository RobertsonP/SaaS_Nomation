import React from 'react';
import { ProjectElement, CSSProperties } from '../../types/element.types';

interface CSSPreviewRendererProps {
  element: ProjectElement;
  mode?: 'compact' | 'detailed' | 'live';
  showQuality?: boolean;
  interactive?: boolean;
  onClick?: (element: ProjectElement) => void;
  className?: string;
}

export function CSSPreviewRenderer({
  element,
  mode = 'detailed',
  showQuality = true,
  interactive = true,
  onClick,
  className = ''
}: CSSPreviewRendererProps) {
  const cssInfo = element.attributes?.cssInfo;
  
  // Fallback to screenshot if no CSS data available
  if (!cssInfo || !cssInfo.isVisible) {
    return (
      <CSSPreviewFallback 
        element={element}
        onClick={onClick}
        className={className}
      />
    );
  }

  // Generate preview styles based on CSS data
  const previewStyle = generatePreviewStyle(cssInfo, mode);
  const containerStyle = generateContainerStyle(mode);

  return (
    <div 
      className={`css-preview-container ${className}`}
      style={containerStyle}
      onClick={() => interactive && onClick?.(element)}
    >
      {/* Main preview element */}
      <div 
        className="css-preview-element"
        style={previewStyle}
        title={`${element.elementType}: ${element.description}`}
      >
        {renderElementContent(element, cssInfo, mode)}
      </div>
      
      {/* Quality indicators */}
      {showQuality && element.overallQuality !== undefined && (
        <QualityIndicatorBadge 
          element={element}
          mode={mode === 'compact' ? 'minimal' : 'standard'}
        />
      )}
      
      {/* Mode-specific additional info */}
      {mode === 'detailed' && (
        <div className="css-preview-details">
          <ElementInfoOverlay element={element} />
        </div>
      )}
    </div>
  );
}

// Generate CSS styles for preview element
function generatePreviewStyle(cssInfo: CSSProperties, mode: string): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    // Core visual properties
    backgroundColor: cssInfo.backgroundColor || 'transparent',
    color: cssInfo.color || '#000000',
    fontSize: cssInfo.fontSize || '14px',
    fontFamily: cssInfo.fontFamily || 'inherit',
    fontWeight: cssInfo.fontWeight || 'normal',
    
    // Text styling
    textDecoration: cssInfo.textDecoration || 'none',
    textAlign: cssInfo.textAlign as any || 'left',
    lineHeight: cssInfo.lineHeight || 'normal',
    
    // Border and spacing
    padding: cssInfo.padding || '4px 8px',
    margin: cssInfo.margin || '0',
    border: cssInfo.border || 'none',
    borderRadius: cssInfo.borderRadius || '0',
    boxShadow: cssInfo.boxShadow || 'none',
    
    // Layout properties
    display: mode === 'compact' ? 'inline-block' : (cssInfo.display || 'block'),
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    
    // Visual effects
    opacity: cssInfo.opacity || '1',
    transform: cssInfo.transform !== 'none' ? cssInfo.transform : undefined,
    transition: 'all 0.2s ease',
  };

  // Mode-specific adjustments
  switch (mode) {
    case 'compact':
      return {
        ...baseStyle,
        maxWidth: '120px',
        maxHeight: '32px',
        fontSize: '12px',
        padding: '2px 6px',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      };
    
    case 'detailed':
      return {
        ...baseStyle,
        maxWidth: '200px',
        maxHeight: '80px',
        minHeight: '32px',
        padding: cssInfo.padding || '8px 12px',
      };
    
    case 'live':
      return {
        ...baseStyle,
        maxWidth: '300px',
        maxHeight: '120px',
        padding: cssInfo.padding || '8px 12px',
        border: '2px dashed #3B82F6',
      };
    
    default:
      return baseStyle;
  }
}

// Generate container styles
function generateContainerStyle(mode: string): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FAFAFA',
    transition: 'all 0.2s ease',
  };

  switch (mode) {
    case 'compact':
      return {
        ...baseStyle,
        flexDirection: 'row',
        alignItems: 'center',
        padding: '4px 6px',
        gap: '6px',
      };
    
    case 'detailed':
      return {
        ...baseStyle,
        padding: '12px',
      };
    
    case 'live':
      return {
        ...baseStyle,
        border: '2px solid #10B981',
        backgroundColor: '#F0FDF4',
      };
    
    default:
      return baseStyle;
  }
}

// Render element content based on type and CSS data
function renderElementContent(element: ProjectElement, cssInfo: CSSProperties, _mode: string): React.ReactNode {
  const text = cssInfo.hasText ? element.attributes?.text : '';
  const placeholder = element.attributes?.type === 'input' ? (element.attributes as any)?.placeholder : '';
  
  switch (element.elementType) {
    case 'button':
      return text || 'Button';
    
    case 'input':
      return (
        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
          {placeholder || text || 'Input field'}
        </span>
      );
    
    case 'link':
      return (
        <span style={{ textDecoration: 'underline', color: '#3B82F6' }}>
          {text || 'Link'}
        </span>
      );
    
    case 'form':
      return `Form: ${text || 'Form element'}`;
    
    case 'navigation':
      return `Nav: ${text || 'Navigation'}`;
    
    case 'text':
      return text || 'Text content';
    
    default:
      return text || element.description || element.elementType;
  }
}

// Quality indicator badge component
function QualityIndicatorBadge({ element, mode }: { element: ProjectElement; mode: 'minimal' | 'standard' }) {
  const quality = element.overallQuality || 0;
  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (score >= 0.4) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getQualityIcon = (score: number) => {
    if (score >= 0.8) return '🌟';
    if (score >= 0.6) return '✅';
    if (score >= 0.4) return '⚠️';
    return '❌';
  };

  if (mode === 'minimal') {
    return (
      <span 
        className={`px-1 py-0.5 text-xs rounded border ${getQualityColor(quality)}`}
        title={`Quality Score: ${Math.round(quality * 100)}%`}
      >
        {getQualityIcon(quality)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span 
        className={`px-2 py-1 text-xs rounded border ${getQualityColor(quality)}`}
        title={element.qualityMetrics ? 
          `Uniqueness: ${Math.round((element.qualityMetrics.uniqueness || 0) * 100)}%\n` +
          `Stability: ${Math.round((element.qualityMetrics.stability || 0) * 100)}%\n` +
          `Specificity: ${Math.round((element.qualityMetrics.specificity || 0) * 100)}%\n` +
          `Accessibility: ${Math.round((element.qualityMetrics.accessibility || 0) * 100)}%`
          : `Quality Score: ${Math.round(quality * 100)}%`
        }
      >
        {getQualityIcon(quality)} {Math.round(quality * 100)}%
      </span>
      
      {!element.isValidated && (
        <span className="px-1 py-0.5 text-xs bg-gray-100 text-gray-600 rounded border" title="Not validated">
          ❓
        </span>
      )}
    </div>
  );
}

// Element info overlay for detailed mode
function ElementInfoOverlay({ element }: { element: ProjectElement }) {
  return (
    <div className="css-preview-info text-xs text-gray-600 space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium">{element.elementType}</span>
        <span className="text-gray-400">#{element.id.slice(-6)}</span>
      </div>
      
      <div className="truncate" title={element.selector}>
        <span className="font-mono text-xs">{element.selector}</span>
      </div>
      
      {element.sourceUrl && (
        <div className="truncate text-gray-500" title={element.sourceUrl.url}>
          📄 {element.sourceUrl.title || 'Page'}
        </div>
      )}
    </div>
  );
}

// Fallback component when CSS data is not available
function CSSPreviewFallback({ element, onClick, className }: {
  element: ProjectElement;
  onClick?: (element: ProjectElement) => void;
  className?: string;
}) {
  return (
    <div 
      className={`css-preview-fallback ${className}`}
      onClick={() => onClick?.(element)}
    >
      {element.screenshot ? (
        <img 
          src={element.screenshot} 
          alt={element.description}
          className="w-full h-auto max-w-48 max-h-16 object-contain rounded border"
        />
      ) : (
        <div className="flex items-center justify-center w-32 h-12 bg-gray-100 border rounded text-gray-500 text-xs">
          <span>📦 {element.elementType}</span>
        </div>
      )}
      
      <div className="text-xs text-gray-600 mt-1">
        <div className="font-medium truncate">{element.description}</div>
        <div className="font-mono text-gray-400 truncate">{element.selector}</div>
      </div>
    </div>
  );
}