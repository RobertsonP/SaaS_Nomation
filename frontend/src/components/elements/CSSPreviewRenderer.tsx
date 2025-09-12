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
  // 🎯 CRITICAL FIX: Use dedicated cssInfo column first, fallback to attributes.cssInfo for compatibility
  const cssInfo = element.cssInfo || element.attributes?.cssInfo;
  
  // 🎯 FORCE CSS VISUAL PREVIEWS ALWAYS - No fallbacks allowed
  // Create default CSS properties if none exist to ensure visual rendering
  const safeCssInfo = cssInfo || {
    backgroundColor: 'rgba(243, 244, 246, 1)', // Default gray background
    color: 'rgba(55, 65, 81, 1)', // Default dark text
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '8px 12px',
    border: '1px solid rgba(209, 213, 219, 1)',
    borderRadius: '4px',
    display: 'inline-block'
  };
  
  // Always render CSS visual preview - NEVER fallback

  // Generate preview styles based on CSS data (using safeCssInfo to guarantee rendering)
  const previewStyle = generatePreviewStyle(safeCssInfo, mode);
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
  // Enhanced color handling with robust fallbacks
  const getValidColor = (color: string | undefined, fallback: string) => {
    if (!color || 
        color === 'transparent' || 
        color === 'rgba(0, 0, 0, 0)' ||
        color === 'inherit' ||
        color === 'initial' ||
        color.trim() === '') {
      return fallback;
    }
    // Handle CSS color keywords that might not be visible
    const invisibleColors = ['transparent', 'rgba(0,0,0,0)', 'rgba(255,255,255,0)'];
    if (invisibleColors.includes(color.toLowerCase().replace(/\s/g, ''))) {
      return fallback;
    }
    return color;
  };

  // Enhanced background handling with smart defaults
  const getValidBackground = (bg: string | undefined) => {
    if (!bg || 
        bg === 'transparent' || 
        bg === 'rgba(0, 0, 0, 0)' ||
        bg === 'inherit' ||
        bg === 'initial' ||
        bg === 'none' ||
        bg.trim() === '') {
      // Return a subtle background that works well for previews
      return '#ffffff';
    }
    // Handle problematic backgrounds
    const problematicBgs = ['transparent', 'rgba(0,0,0,0)', 'rgba(255,255,255,0)', 'none'];
    if (problematicBgs.includes(bg.toLowerCase().replace(/\s/g, ''))) {
      return '#ffffff';
    }
    return bg;
  };

  // Enhanced border handling with better defaults
  const getValidBorder = (border: string | undefined) => {
    if (!border || 
        border === 'none' || 
        border === '0px' ||
        border === '0' ||
        border === 'inherit' ||
        border === 'initial' ||
        border.trim() === '') {
      // Provide a subtle border that helps define the element
      return '1px solid #e5e7eb';
    }
    return border;
  };

  const baseStyle: React.CSSProperties = {
    // Core visual properties with robust fallbacks
    backgroundColor: getValidBackground(cssInfo.backgroundColor),
    color: getValidColor(cssInfo.color, '#212529'),
    fontSize: cssInfo.fontSize || '14px',
    fontFamily: cssInfo.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: cssInfo.fontWeight || 'normal',
    
    // Text styling
    textDecoration: cssInfo.textDecoration || 'none',
    textAlign: cssInfo.textAlign as any || 'left',
    lineHeight: cssInfo.lineHeight || '1.5',
    
    // Border and spacing with better defaults
    padding: cssInfo.padding || '8px 12px',
    margin: cssInfo.margin || '0',
    border: getValidBorder(cssInfo.border),
    borderRadius: cssInfo.borderRadius || '4px',
    boxShadow: cssInfo.boxShadow === 'none' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : cssInfo.boxShadow,
    
    // Layout properties
    display: mode === 'compact' ? 'inline-flex' : 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    
    // Visual effects with better defaults
    opacity: cssInfo.opacity || '1',
    transform: cssInfo.transform !== 'none' ? cssInfo.transform : undefined,
    transition: 'all 0.2s ease',
    
    // Ensure minimum visibility
    minHeight: mode === 'compact' ? '24px' : '32px',
    minWidth: mode === 'compact' ? '60px' : '80px',
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
function renderElementContent(element: ProjectElement, _cssInfo: CSSProperties, mode: string): React.ReactNode {
  const text = element.attributes?.text || '';
  const placeholder = element.attributes?.type === 'input' ? (element.attributes as any)?.placeholder : '';
  const elementType = element.elementType?.toLowerCase();
  
  // Enhanced content rendering with icons and better representation
  switch (elementType) {
    case 'button':
      return (
        <span className="flex items-center gap-1">
          <span>🔘</span>
          <span>{text || element.description || 'Button'}</span>
        </span>
      );
    
    case 'input':
      const inputType = (element.attributes as any)?.type || 'text';
      const inputIcon = inputType === 'password' ? '🔒' : 
                       inputType === 'email' ? '📧' : 
                       inputType === 'search' ? '🔍' : '📝';
      return (
        <span className="flex items-center gap-1" style={{ color: placeholder ? '#6B7280' : 'inherit', fontStyle: placeholder ? 'italic' : 'normal' }}>
          <span>{inputIcon}</span>
          <span>{placeholder || text || `${inputType} input`}</span>
        </span>
      );
    
    case 'link':
    case 'a':
      return (
        <span className="flex items-center gap-1" style={{ color: '#3B82F6', textDecoration: 'underline' }}>
          <span>🔗</span>
          <span>{text || element.description || 'Link'}</span>
        </span>
      );
    
    case 'form':
      return (
        <span className="flex items-center gap-1">
          <span>📋</span>
          <span>{text || element.description || 'Form'}</span>
        </span>
      );
    
    case 'navigation':
    case 'nav':
      return (
        <span className="flex items-center gap-1">
          <span>🧭</span>
          <span>{text || element.description || 'Navigation'}</span>
        </span>
      );
    
    case 'text':
    case 'span':
    case 'p':
    case 'div':
      if (text && text.length > 0) {
        const truncatedText = mode === 'compact' && text.length > 20 ? text.substring(0, 20) + '...' : text;
        return (
          <span className="flex items-center gap-1">
            <span>📄</span>
            <span>{truncatedText}</span>
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1">
          <span>📄</span>
          <span>{element.description || 'Text element'}</span>
        </span>
      );
    
    case 'img':
    case 'image':
      return (
        <span className="flex items-center gap-1">
          <span>🖼️</span>
          <span>{element.description || 'Image'}</span>
        </span>
      );
    
    case 'select':
    case 'dropdown':
      return (
        <span className="flex items-center gap-1">
          <span>📋</span>
          <span>{text || element.description || 'Dropdown'}</span>
          <span style={{ fontSize: '0.8em' }}>▼</span>
        </span>
      );
    
    case 'checkbox':
      return (
        <span className="flex items-center gap-1">
          <span>☐</span>
          <span>{text || element.description || 'Checkbox'}</span>
        </span>
      );
    
    case 'radio':
      return (
        <span className="flex items-center gap-1">
          <span>◯</span>
          <span>{text || element.description || 'Radio button'}</span>
        </span>
      );
    
    default:
      // Fallback with better formatting
      const displayText = text || element.description || elementType || 'Element';
      const truncatedText = mode === 'compact' && displayText.length > 25 ? displayText.substring(0, 25) + '...' : displayText;
      return (
        <span className="flex items-center gap-1">
          <span>⚪</span>
          <span>{truncatedText}</span>
        </span>
      );
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

// 🎯 CSSPreviewFallback function removed - We now FORCE CSS visual previews always