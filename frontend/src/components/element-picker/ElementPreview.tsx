import React from 'react';

interface ElementPreviewProps {
  element: {
    tagName: string;
    selector: string;
    text: string;
    attributes: {
      text: string;
      tagName: string;
      id: string;
      className: string;
      'aria-label': string;
      placeholder: string;
      type: string;
      href: string;
      'data-testid': string;
      cssInfo: {
        backgroundColor: string;
        color: string;
        fontSize: string;
        fontFamily: string;
        fontWeight: string;
        padding: string;
        margin: string;
        border: string;
        borderRadius: string;
        width: string;
        height: string;
        display: string;
        isVisible: boolean;
        hasBackground: boolean;
        hasText: boolean;
        isStyled: boolean;
      };
      boundingRect: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
    elementType: string;
    description: string;
  };
  className?: string;
}

export function ElementPreview({ element, className = '' }: ElementPreviewProps) {
  const { tagName, attributes, text, elementType } = element;
  const { cssInfo } = attributes;

  // Helper function to create safe inline styles from cssInfo
  const createSafeStyles = () => {
    const baseStyles: React.CSSProperties = {
      fontFamily: cssInfo.fontFamily || 'system-ui, -apple-system, sans-serif',
      fontSize: cssInfo.fontSize || '14px',
      fontWeight: cssInfo.fontWeight || 'normal',
      color: cssInfo.color || '#374151',
      backgroundColor: cssInfo.backgroundColor !== 'transparent' ? cssInfo.backgroundColor : '#ffffff',
      padding: cssInfo.padding || '8px 12px',
      border: cssInfo.border !== 'none' ? cssInfo.border : '1px solid #d1d5db',
      borderRadius: cssInfo.borderRadius || '6px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: '36px',
      maxWidth: '300px',
      boxSizing: 'border-box',
      transition: 'all 0.2s ease',
    };

    return baseStyles;
  };

  // Generate preview content based on element type
  const renderElementPreview = () => {
    const styles = createSafeStyles();
    const displayText = text || attributes.placeholder || attributes['aria-label'] || 'Element';

    switch (elementType) {
      case 'button':
        return (
          <button
            style={{
              ...styles,
              cursor: 'pointer',
              backgroundColor: cssInfo.hasBackground ? cssInfo.backgroundColor : '#3b82f6',
              color: cssInfo.hasBackground ? cssInfo.color : '#ffffff',
              fontWeight: '500',
            }}
            disabled
          >
            {displayText || 'Button'}
          </button>
        );

      case 'input':
        const inputType = attributes.type || 'text';
        if (inputType === 'checkbox') {
          return (
            <label style={{ ...styles, gap: '8px' }}>
              <input
                type="checkbox"
                style={{ margin: '0' }}
                disabled
              />
              <span>{displayText || 'Checkbox'}</span>
            </label>
          );
        } else if (inputType === 'radio') {
          return (
            <label style={{ ...styles, gap: '8px' }}>
              <input
                type="radio"
                style={{ margin: '0' }}
                disabled
              />
              <span>{displayText || 'Radio Button'}</span>
            </label>
          );
        } else {
          return (
            <input
              type={inputType === 'password' ? 'password' : 'text'}
              placeholder={attributes.placeholder || displayText || `${inputType} input`}
              style={{
                ...styles,
                backgroundColor: '#ffffff',
                border: '2px solid #e5e7eb',
                outline: 'none',
              }}
              disabled
              value={inputType === 'password' ? '••••••••' : ''}
            />
          );
        }

      case 'link':
        return (
          <a
            href="#"
            style={{
              ...styles,
              color: '#3b82f6',
              textDecoration: 'underline',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '4px 0',
            }}
            onClick={(e) => e.preventDefault()}
          >
            {displayText || 'Link'}
          </a>
        );

      case 'text':
        const textTag = tagName.toLowerCase();
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(textTag)) {
          const HeadingTag = textTag as keyof JSX.IntrinsicElements;
          return (
            <HeadingTag
              style={{
                ...styles,
                fontWeight: 'bold',
                fontSize: textTag === 'h1' ? '24px' : textTag === 'h2' ? '20px' : '16px',
                backgroundColor: 'transparent',
                border: 'none',
                padding: '4px 0',
              }}
            >
              {displayText || `${textTag.toUpperCase()} Heading`}
            </HeadingTag>
          );
        } else {
          return (
            <span
              style={{
                ...styles,
                backgroundColor: 'transparent',
                border: 'none',
                padding: '4px 0',
              }}
            >
              {displayText || 'Text Content'}
            </span>
          );
        }

      case 'form':
        return (
          <div
            style={{
              ...styles,
              backgroundColor: '#f9fafb',
              border: '2px dashed #d1d5db',
              padding: '16px',
              borderRadius: '8px',
              minHeight: '60px',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              📝 Form Container
              {displayText && (
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  "{displayText}"
                </div>
              )}
            </div>
          </div>
        );

      case 'navigation':
        return (
          <nav
            style={{
              ...styles,
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              padding: '12px 16px',
              borderRadius: '8px',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🧭 Navigation
            {displayText && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                "{displayText}"
              </span>
            )}
          </nav>
        );

      default:
        // Generic element preview
        return (
          <div
            style={{
              ...styles,
              backgroundColor: '#f8fafc',
              border: '2px dashed #cbd5e1',
              color: '#64748b',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>
              {getElementIcon(tagName.toLowerCase())}
            </span>
            <div>
              <div style={{ fontWeight: '500', fontSize: '12px' }}>
                &lt;{tagName.toLowerCase()}&gt;
              </div>
              {displayText && (
                <div style={{ fontSize: '11px', opacity: 0.7 }}>
                  "{displayText.substring(0, 30)}{displayText.length > 30 ? '...' : ''}"
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  // Helper function to get appropriate icon for element type
  const getElementIcon = (tagName: string): string => {
    const iconMap: { [key: string]: string } = {
      'div': '📦',
      'span': '📄',
      'img': '🖼️',
      'video': '🎥',
      'audio': '🔊',
      'canvas': '🎨',
      'svg': '🖼️',
      'iframe': '🪟',
      'table': '📊',
      'ul': '📋',
      'ol': '📝',
      'li': '•',
      'section': '📑',
      'article': '📰',
      'aside': '📌',
      'header': '🏠',
      'footer': '🔻',
      'main': '🎯',
    };
    return iconMap[tagName] || '📄';
  };

  return (
    <div className={`element-preview ${className}`} style={{ margin: '8px 0' }}>
      <div style={{ marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
          Preview:
        </span>
      </div>
      <div style={{ 
        padding: '12px', 
        backgroundColor: '#f9fafb', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '50px'
      }}>
        {renderElementPreview()}
      </div>
    </div>
  );
}