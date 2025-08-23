import { ProjectElement } from '../../types/element.types';

interface ElementPreviewProps {
  element: ProjectElement;
  size?: 'small' | 'medium' | 'large';
  showSelector?: boolean;
  showDiscoveryState?: boolean;
  onClick?: () => void;
}

export function ElementPreview({ 
  element, 
  size = 'medium', 
  showSelector = true, 
  showDiscoveryState = true,
  onClick 
}: ElementPreviewProps) {
  // Extract CSS info from element attributes
  const cssInfo = (element.attributes as any)?.cssInfo || {};
  // const boundingRect = (element.attributes as any)?.boundingRect || {};
  const discoveryState = (element.attributes as any)?.discoveryState;

  // Size configurations
  const sizeConfig = {
    small: { width: 120, height: 60, fontSize: '10px', padding: '4px' },
    medium: { width: 200, height: 100, fontSize: '12px', padding: '8px' },
    large: { width: 300, height: 150, fontSize: '14px', padding: '12px' }
  };

  const config = sizeConfig[size];

  // Create realistic CSS styles based on captured element data
  const previewStyles: React.CSSProperties = {
    width: config.width,
    height: config.height,
    backgroundColor: cssInfo.backgroundColor || '#f3f4f6',
    color: cssInfo.color || '#374151',
    fontSize: config.fontSize,
    fontFamily: cssInfo.fontFamily || 'system-ui, sans-serif',
    fontWeight: cssInfo.fontWeight || 'normal',
    padding: config.padding,
    border: cssInfo.border || '1px solid #d1d5db',
    borderRadius: cssInfo.borderRadius || '4px',
    boxShadow: cssInfo.boxShadow || 'none',
    cursor: onClick ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    textAlign: 'center' as const,
    opacity: cssInfo.opacity || '1',
    transform: cssInfo.transform || 'none',
    transition: 'all 0.2s ease',
  };

  // Hover effect for interactive elements
  const hoverStyles: React.CSSProperties = onClick ? {
    transform: 'scale(1.02)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  } : {};

  // Get element type icon
  const getElementIcon = () => {
    switch (element.elementType) {
      case 'button': return '🔘';
      case 'input': return '📝';
      case 'link': return '🔗';
      case 'form': return '📋';
      case 'navigation': return '🧭';
      default: return '📄';
    }
  };

  // Get discovery state indicator
  const getDiscoveryStateIndicator = () => {
    if (!discoveryState) return null;

    const stateConfig = {
      static: { color: '#6b7280', icon: '📄', label: 'Static' },
      after_login: { color: '#3b82f6', icon: '🔐', label: 'After Login' },
      after_interaction: { color: '#10b981', icon: '👆', label: 'Interactive' },
      modal: { color: '#8b5cf6', icon: '🪟', label: 'Modal' },
      hover: { color: '#f59e0b', icon: '🎯', label: 'Hover' }
    };

    const config = stateConfig[discoveryState as keyof typeof stateConfig];
    if (!config) return null;

    return (
      <div 
        className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs"
        style={{ backgroundColor: config.color, color: 'white' }}
        title={`Discovery State: ${config.label}`}
      >
        {config.icon}
      </div>
    );
  };

  return (
    <div className="element-preview-container">
      {/* Element Preview */}
      <div
        className="element-preview relative border-2 border-dashed border-gray-300 hover:border-blue-400 transition-all"
        style={previewStyles}
        onClick={onClick}
        onMouseEnter={(e) => {
          if (onClick) {
            Object.assign(e.currentTarget.style, hoverStyles);
          }
        }}
        onMouseLeave={(e) => {
          if (onClick) {
            Object.assign(e.currentTarget.style, previewStyles);
          }
        }}
      >
        {/* Discovery State Indicator */}
        {showDiscoveryState && getDiscoveryStateIndicator()}

        {/* Element Content */}
        <div className="element-content flex flex-col items-center justify-center h-full">
          <div className="text-lg mb-1">{getElementIcon()}</div>
          
          {/* Element text or description */}
          <div className="text-center px-1">
            {element.attributes.text ? (
              <div className="font-medium truncate max-w-full">
                {element.attributes.text}
              </div>
            ) : (
              <div className="text-gray-500 text-xs truncate max-w-full">
                {element.description}
              </div>
            )}
          </div>

          {/* Element type badge */}
          <div 
            className="mt-1 px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: 
                element.elementType === 'button' ? '#dbeafe' :
                element.elementType === 'input' ? '#dcfce7' :
                element.elementType === 'link' ? '#f3e8ff' :
                element.elementType === 'form' ? '#fed7aa' :
                element.elementType === 'navigation' ? '#e0e7ff' :
                '#f3f4f6',
              color:
                element.elementType === 'button' ? '#1e40af' :
                element.elementType === 'input' ? '#166534' :
                element.elementType === 'link' ? '#7c3aed' :
                element.elementType === 'form' ? '#ea580c' :
                element.elementType === 'navigation' ? '#4338ca' :
                '#374151'
            }}
          >
            {element.elementType}
          </div>
        </div>

        {/* Confidence indicator */}
        <div 
          className="absolute bottom-1 left-1 text-xs px-1 py-0.5 bg-black bg-opacity-70 text-white rounded"
          title={`AI Confidence: ${Math.round(element.confidence * 100)}%`}
        >
          {Math.round(element.confidence * 100)}%
        </div>
      </div>

      {/* Selector Information */}
      {showSelector && (
        <div className="mt-2 text-xs">
          <div className="font-mono text-gray-600 truncate bg-gray-100 px-2 py-1 rounded">
            {element.selector}
          </div>
          
          {/* Additional attributes */}
          {(element.attributes.id || element.attributes['data-testid'] || element.attributes['aria-label']) && (
            <div className="mt-1 text-gray-500">
              {element.attributes.id && (
                <div>ID: <span className="font-mono">#{element.attributes.id}</span></div>
              )}
              {element.attributes['data-testid'] && (
                <div>Test ID: <span className="font-mono">{element.attributes['data-testid']}</span></div>
              )}
              {element.attributes['aria-label'] && (
                <div>Aria Label: <span className="font-mono">{element.attributes['aria-label']}</span></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Discovery Context */}
      {showDiscoveryState && discoveryState && (
        <div className="mt-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">Discovered:</span>
            <span 
              className="px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: 
                  discoveryState === 'static' ? '#f3f4f6' :
                  discoveryState === 'after_login' ? '#dbeafe' :
                  discoveryState === 'after_interaction' ? '#dcfce7' :
                  discoveryState === 'modal' ? '#f3e8ff' :
                  discoveryState === 'hover' ? '#fef3c7' : '#f3f4f6',
                color:
                  discoveryState === 'static' ? '#374151' :
                  discoveryState === 'after_login' ? '#1e40af' :
                  discoveryState === 'after_interaction' ? '#166534' :
                  discoveryState === 'modal' ? '#7c3aed' :
                  discoveryState === 'hover' ? '#92400e' : '#374151'
              }}
            >
              {discoveryState === 'static' && '📄 On page load'}
              {discoveryState === 'after_login' && '🔐 After login'}
              {discoveryState === 'after_interaction' && '👆 After interaction'}
              {discoveryState === 'modal' && '🪟 In modal'}
              {discoveryState === 'hover' && '🎯 On hover'}
            </span>
          </div>
          
          {(element.attributes as any)?.discoveryTrigger && (
            <div className="mt-1 text-gray-500">
              Trigger: <span className="font-mono">{(element.attributes as any).discoveryTrigger}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}