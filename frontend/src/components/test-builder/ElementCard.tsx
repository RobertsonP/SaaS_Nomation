import { useState } from 'react';
import { ProjectElement } from '../../types/element.types';
import { CSSPreviewRenderer } from '../elements/CSSPreviewRenderer';

interface ElementCardProps {
  element: ProjectElement;
  onSelect: (element: ProjectElement) => void;
  size?: 'small' | 'medium' | 'large';
  showActions?: boolean;
  className?: string;
}

export function ElementCard({ 
  element, 
  onSelect, 
  size = 'medium',
  showActions = true,
  className = ''
}: ElementCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getElementTypeIcon = (type: string) => {
    switch (type) {
      case 'button': return '🔘';
      case 'input': return '📝';
      case 'link': return '🔗';
      case 'form': return '📋';
      case 'navigation': return '🧭';
      case 'text': return '📄';
      default: return '📦';
    }
  };

  const getElementTypeColor = (type: string) => {
    switch (type) {
      case 'button': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'input': return 'bg-green-100 text-green-800 border-green-200';
      case 'link': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'form': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'navigation': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'text': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Generate human-readable selector preview
  const getReadableSelector = (selector: string) => {
    // Simple heuristics to make selectors more readable
    if (selector.includes('[data-testid=')) {
      const match = selector.match(/\[data-testid="([^"]+)"\]/);
      if (match) return `Test ID: ${match[1]}`;
    }
    if (selector.includes('#')) {
      const match = selector.match(/#([a-zA-Z0-9_-]+)/);
      if (match) return `ID: ${match[1]}`;
    }
    if (selector.includes('.') && !selector.includes(' ')) {
      const match = selector.match(/\.([a-zA-Z0-9_-]+)/);
      if (match) return `Class: ${match[1]}`;
    }
    
    // Truncate long selectors for better display
    return selector.length > 40 ? selector.substring(0, 37) + '...' : selector;
  };

  const cardSizeClasses = {
    small: 'p-2',
    medium: 'p-3',
    large: 'p-4'
  };

  const previewSizeClasses = {
    small: 'h-16',
    medium: 'h-20',
    large: 'h-24'
  };

  return (
    <div 
      className={`
        bg-white border border-gray-200 rounded-lg cursor-pointer transition-all duration-200
        ${isHovered ? 'border-blue-300 shadow-md' : 'hover:border-gray-300 hover:shadow-sm'}
        ${cardSizeClasses[size]}
        ${className}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(element)}
    >
      {/* Header: Type Badge + Element Name */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <span className="text-sm">{getElementTypeIcon(element.elementType)}</span>
          <span className={`px-2 py-1 text-xs rounded border font-medium whitespace-nowrap ${getElementTypeColor(element.elementType)}`}>
            {element.elementType}
          </span>
        </div>
        <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
          {Math.round(element.confidence * 100)}%
        </div>
      </div>

      {/* Element Name/Description */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
          {element.description}
        </h3>
      </div>

      {/* Visual Preview */}
      <div className={`bg-gray-50 border border-gray-200 rounded-md mb-3 ${previewSizeClasses[size]} flex items-center justify-center relative overflow-hidden`}>
        {element.attributes?.cssInfo ? (
          <CSSPreviewRenderer
            element={element}
            mode="compact"
            showQuality={false}
            interactive={false}
            className="w-full h-full"
          />
        ) : element.screenshot ? (
          <img 
            src={`data:image/png;base64,${element.screenshot}`}
            alt={`Preview of ${element.description}`}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center text-gray-400">
            <div className="text-lg mb-1">{getElementTypeIcon(element.elementType)}</div>
            <div className="text-xs">No preview</div>
          </div>
        )}
      </div>

      {/* Selector */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded border">
          {getReadableSelector(element.selector)}
        </div>
      </div>

      {/* Page Source (if showing elements from multiple pages) */}
      {element.sourceUrl && (
        <div className="text-xs text-blue-600 truncate mb-2">
          📄 {element.sourceUrl.title || 'Page'}
        </div>
      )}

      {/* Actions (if enabled) */}
      {showActions && (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(element);
            }}
            className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Use in Test
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add preview functionality
            }}
            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            title="Preview element"
          >
            👁️
          </button>
        </div>
      )}
    </div>
  );
}