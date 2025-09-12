import { useState } from 'react';

interface CSSProperties {
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  textDecoration: string;
  textAlign: string;
  lineHeight: string;
  padding: string;
  margin: string;
  border: string;
  borderRadius: string;
  boxShadow: string;
  width: string;
  height: string;
  display: string;
  cursor: string;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  isVisible: boolean;
  hasBackground: boolean;
  hasText: boolean;
  hasInteractiveState?: boolean;
}

interface ElementVisualRecreationProps {
  element: {
    tagName: string;
    textContent: string;
    description: string;
    cssProperties: CSSProperties;
    isInteractive: boolean;
    isVerification: boolean;
    attributes?: Record<string, any>;
  };
  className?: string;
  maxWidth?: string;
  maxHeight?: string;
}

export function ElementVisualRecreation({ 
  element, 
  className = '', 
  maxWidth = '300px',
  maxHeight = '100px'
}: ElementVisualRecreationProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const { tagName, textContent, cssProperties, isInteractive, attributes = {} } = element;
  
  // 🎨 BUILD RECREATION STYLES FROM EXTRACTED CSS
  const recreationStyles: React.CSSProperties = {
    backgroundColor: cssProperties.backgroundColor !== 'transparent' ? cssProperties.backgroundColor : '#f8f9fa',
    color: cssProperties.color || '#000000',
    fontSize: cssProperties.fontSize || '14px',
    fontFamily: cssProperties.fontFamily || 'inherit',
    fontWeight: cssProperties.fontWeight || 'normal',
    textDecoration: cssProperties.textDecoration || 'none',
    textAlign: cssProperties.textAlign as any || 'left',
    lineHeight: cssProperties.lineHeight || 'normal',
    
    // Smart sizing for preview
    padding: cssProperties.padding !== '0px' ? cssProperties.padding : '8px 12px',
    border: cssProperties.border !== 'none' ? cssProperties.border : '1px solid #e2e8f0',
    borderRadius: cssProperties.borderRadius || '4px',
    boxShadow: cssProperties.boxShadow !== 'none' ? cssProperties.boxShadow : undefined,
    
    // Constrained dimensions for preview
    maxWidth,
    maxHeight,
    width: 'auto',
    height: 'auto',
    minWidth: '60px',
    minHeight: '24px',
    
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: cssProperties.textAlign === 'center' ? 'center' : 'flex-start',
    
    cursor: isInteractive ? 'pointer' : 'default',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    
    // Interactive state
    opacity: isHovered && isInteractive ? 0.8 : 1,
    transform: isHovered && isInteractive ? 'scale(1.02)' : 'scale(1)',
    transition: 'all 0.2s ease',
    
    // Background image handling
    backgroundImage: cssProperties.backgroundImage !== 'none' ? cssProperties.backgroundImage : undefined,
    backgroundSize: cssProperties.backgroundSize || 'cover',
    backgroundPosition: cssProperties.backgroundPosition || 'center',
  };
  
  // 🎭 ELEMENT TYPE SPECIFIC STYLING
  const getElementTypeStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {};
    
    if (tagName === 'button') {
      return {
        ...baseStyles,
        backgroundColor: cssProperties.backgroundColor !== 'transparent' ? cssProperties.backgroundColor : '#3b82f6',
        color: cssProperties.color || '#ffffff',
        border: cssProperties.border !== 'none' ? cssProperties.border : 'none',
        borderRadius: cssProperties.borderRadius || '6px',
        padding: cssProperties.padding !== '0px' ? cssProperties.padding : '8px 16px',
        cursor: 'pointer',
        fontWeight: 'medium'
      };
    } else if (tagName === 'input') {
      const inputType = attributes.type || 'text';
      if (inputType === 'submit' || inputType === 'button') {
        return {
          ...baseStyles,
          backgroundColor: cssProperties.backgroundColor !== 'transparent' ? cssProperties.backgroundColor : '#3b82f6',
          color: cssProperties.color || '#ffffff',
          border: cssProperties.border !== 'none' ? cssProperties.border : 'none',
          borderRadius: cssProperties.borderRadius || '6px',
          padding: cssProperties.padding !== '0px' ? cssProperties.padding : '8px 16px',
          cursor: 'pointer'
        };
      } else {
        return {
          ...baseStyles,
          backgroundColor: cssProperties.backgroundColor !== 'transparent' ? cssProperties.backgroundColor : '#ffffff',
          color: cssProperties.color || '#374151',
          border: cssProperties.border !== 'none' ? cssProperties.border : '1px solid #d1d5db',
          borderRadius: cssProperties.borderRadius || '4px',
          padding: cssProperties.padding !== '0px' ? cssProperties.padding : '8px 12px',
        };
      }
    } else if (tagName === 'a') {
      return {
        ...baseStyles,
        color: cssProperties.color || '#3b82f6',
        textDecoration: cssProperties.textDecoration || 'underline',
        cursor: 'pointer'
      };
    } else if (tagName === 'select') {
      return {
        ...baseStyles,
        backgroundColor: cssProperties.backgroundColor !== 'transparent' ? cssProperties.backgroundColor : '#ffffff',
        color: cssProperties.color || '#374151',
        border: cssProperties.border !== 'none' ? cssProperties.border : '1px solid #d1d5db',
        borderRadius: cssProperties.borderRadius || '4px',
        padding: cssProperties.padding !== '0px' ? cssProperties.padding : '8px 12px',
        cursor: 'pointer'
      };
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      const headingSize = tagName === 'h1' ? '24px' : tagName === 'h2' ? '20px' : tagName === 'h3' ? '18px' : '16px';
      return {
        ...baseStyles,
        fontSize: cssProperties.fontSize || headingSize,
        fontWeight: cssProperties.fontWeight || 'bold',
        color: cssProperties.color || '#111827'
      };
    }
    
    return baseStyles;
  };
  
  const finalStyles = {
    ...recreationStyles,
    ...getElementTypeStyles()
  };
  
  // 📝 DISPLAY TEXT LOGIC
  const getDisplayText = () => {
    if (tagName === 'input') {
      const inputType = attributes.type || 'text';
      if (inputType === 'submit') {
        return attributes.value || 'Submit';
      } else if (inputType === 'button') {
        return attributes.value || 'Button';
      } else {
        const placeholder = attributes.placeholder;
        return placeholder ? `[${placeholder}]` : '[input field]';
      }
    } else if (tagName === 'select') {
      return '[dropdown menu]';
    } else if (tagName === 'textarea') {
      return attributes.placeholder ? `[${attributes.placeholder}]` : '[text area]';
    } else {
      return textContent || `[${tagName}]`;
    }
  };
  
  const displayText = getDisplayText();
  
  // 🏷️ ELEMENT TYPE BADGE
  const getElementTypeBadge = () => {
    if (isInteractive) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 ml-2">
          Interactive
        </span>
      );
    } else if (element.isVerification) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 ml-2">
          Text
        </span>
      );
    }
    return null;
  };
  
  return (
    <div className={`relative ${className}`}>
      {/* 🎨 VISUAL RECREATION */}
      <div 
        className="relative inline-block"
        onMouseEnter={() => {
          setIsHovered(true);
          setShowTooltip(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowTooltip(false);
        }}
      >
        {/* Recreated Element */}
        <div
          style={finalStyles}
          className="select-none"
        >
          {displayText}
        </div>
        
        {/* Element Type Badge */}
        {getElementTypeBadge()}
        
        {/* CSS Property Tooltip */}
        {showTooltip && (
          <div className="absolute z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 -top-8 left-0 whitespace-nowrap">
            {element.description}
            <div className="absolute top-full left-2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>
      
      {/* 🔍 CSS DEBUG INFO (development) */}
      {process.env.NODE_ENV === 'development' && showTooltip && (
        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border text-left">
          <div><strong>Background:</strong> {cssProperties.backgroundColor}</div>
          <div><strong>Color:</strong> {cssProperties.color}</div>
          <div><strong>Font:</strong> {cssProperties.fontSize} {cssProperties.fontWeight}</div>
          {cssProperties.border !== 'none' && (
            <div><strong>Border:</strong> {cssProperties.border}</div>
          )}
        </div>
      )}
    </div>
  );
}