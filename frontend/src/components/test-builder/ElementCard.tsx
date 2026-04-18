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
      case 'heading': return '🔤';
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
      case 'heading': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'text': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Check if element is newly discovered (within last 10 minutes)
  const isNewElement = () => {
    const now = new Date();
    const createdAt = new Date(element.createdAt);
    const timeDiff = now.getTime() - createdAt.getTime();
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
    return timeDiff < tenMinutes;
  };

  // Check if element was discovered through hunting (has specific discovery state)
  const isHuntedElement = () => {
    const discoveryState = (element.attributes as any)?.discoveryState;
    return discoveryState === 'after_interaction' || 
           discoveryState === 'modal' || 
           discoveryState === 'after_login' ||
           discoveryState === 'hover';
  };

  // Get discovery state badge
  const getDiscoveryStateBadge = () => {
    const discoveryState = (element.attributes as any)?.discoveryState;
    if (!discoveryState) return null;

    const stateConfig = {
      after_interaction: { color: 'bg-green-100 text-green-800', icon: '👆', label: 'Interactive' },
      modal: { color: 'bg-purple-100 text-purple-800', icon: '🪟', label: 'Modal' },
      after_login: { color: 'bg-blue-100 text-blue-800', icon: '🔐', label: 'Auth' },
      hover: { color: 'bg-yellow-100 text-yellow-800', icon: '🎯', label: 'Hover' },
      static: { color: 'bg-gray-100 text-gray-800', icon: '📄', label: 'Static' }
    };

    const config = stateConfig[discoveryState as keyof typeof stateConfig];
    if (!config) return null;

    return (
      <span className={`px-1.5 py-0.5 text-xs rounded-full ${config.color} font-medium`}>
        {config.icon} {config.label}
      </span>
    );
  };

  // Classify native Playwright locator type
  const getLocatorType = (selector: string): { type: string; color: string } | null => {
    if (selector.startsWith('getByRole(')) return { type: 'Role', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' };
    if (selector.startsWith('getByText(')) return { type: 'Text', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' };
    if (selector.startsWith('getByLabel(')) return { type: 'Label', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' };
    if (selector.startsWith('getByTestId(')) return { type: 'TestId', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' };
    if (selector.startsWith('getByPlaceholder(')) return { type: 'Placeholder', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
    if (selector.startsWith('getByTitle(')) return { type: 'Title', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' };
    return null;
  };

  // Parse native locator into readable parts
  const parseNativeLocator = (selector: string): { role?: string; name?: string } | null => {
    const roleMatch = selector.match(/^getByRole\('([^']+)'(?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?\)/);
    if (roleMatch) return { role: roleMatch[1], name: roleMatch[2] };
    const simpleMatch = selector.match(/^getBy(?:Text|Label|TestId|Placeholder|Title)\('([^']+)'\)/);
    if (simpleMatch) return { name: simpleMatch[1] };
    return null;
  };

  // Generate human-readable selector preview
  const getReadableSelector = (selector: string) => {
    // Native Playwright locators — format as readable badge + value
    const locType = getLocatorType(selector);
    if (locType) {
      const parsed = parseNativeLocator(selector);
      if (parsed) {
        const value = parsed.role
          ? `${parsed.role}${parsed.name ? ` \u203A ${parsed.name}` : ''}`
          : parsed.name || selector;
        return value.length > 80 ? value.substring(0, 77) + '...' : value;
      }
      return selector.length > 80 ? selector.substring(0, 77) + '...' : selector;
    }

    // Simple heuristics to make CSS selectors more readable
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
    return selector.length > 60 ? selector.substring(0, 57) + '...' : selector;
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

  const isNew = isNewElement();
  const isHunted = isHuntedElement();

  return (
    <div 
      className={`
        bg-white dark:bg-gray-800 border rounded-lg cursor-pointer transition-all duration-200 relative
        ${isNew || isHunted 
          ? 'border-orange-300 shadow-md ring-2 ring-orange-100' 
          : isHovered 
            ? 'border-blue-300 shadow-md' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
        }
        ${cardSizeClasses[size]}
        ${className}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(element)}
    >
      {/* NEW Badge - Top Right Corner */}
      {isNew && (
        <div className="absolute -top-1 -right-1 z-10">
          <span className="bg-orange-500 text-white px-2 py-0.5 text-xs font-bold rounded-full shadow-md animate-pulse">
            NEW
          </span>
        </div>
      )}

      {/* Header: Type Badge + Element Name + Discovery State */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <span className="text-sm">{getElementTypeIcon(element.elementType)}</span>
          <span className={`px-2 py-1 text-xs rounded border font-medium whitespace-nowrap ${getElementTypeColor(element.elementType)}`}>
            {element.elementType}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
          {Math.round(element.confidence * 100)}%
        </div>
      </div>

      {/* Discovery State Badge */}
      {getDiscoveryStateBadge() && (
        <div className="mb-3">
          {getDiscoveryStateBadge()}
        </div>
      )}

      {/* Element Name/Description */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-3 mb-1">
          {element.description}
        </h3>
      </div>

      {/* Enhanced Visual Preview */}
      <div className={`bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-md mb-3 ${previewSizeClasses[size]} flex items-center justify-center relative overflow-hidden group`}>
        {/* Preview Content */}
        {element.attributes?.cssInfo ? (
          <div className="w-full h-full">
            <CSSPreviewRenderer
              element={element}
              mode="compact"
              showQuality={false}
              interactive={false}
              className="w-full h-full"
            />
          </div>
        ) : element.screenshot ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img 
              src={`data:image/png;base64,${element.screenshot}`}
              alt={`Preview of ${element.description}`}
              className="max-w-full max-h-full object-contain rounded shadow-sm"
            />
            {/* Screenshot overlay indicator */}
            <div className="absolute top-1 right-1 bg-blue-500 text-white px-1 py-0.5 text-xs rounded opacity-75">
              📸
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 relative">
            {/* Enhanced fallback preview */}
            <div className="text-2xl mb-2">{getElementTypeIcon(element.elementType)}</div>
            <div className="text-xs font-medium">{element.elementType}</div>
            <div className="text-xs opacity-75 mt-1">No visual data</div>
            
            {/* Simulated element preview based on type */}
            <div className="absolute inset-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded opacity-30 flex items-center justify-center">
              <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        )}

        {/* Quality indicator overlay */}
        {element.overallQuality !== undefined && element.overallQuality < 0.6 && (
          <div className="absolute top-1 left-1 bg-yellow-500 text-white px-1 py-0.5 text-xs rounded opacity-90" title="Low quality selector">
            ⚠️
          </div>
        )}
      </div>

      {/* Enhanced Selector Display */}
      <div className="mb-3">
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Selector</span>
              {getLocatorType(element.selector) && (
                <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${getLocatorType(element.selector)!.color}`}>
                  {getLocatorType(element.selector)!.type}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {/* Validation Status */}
              {element.overallQuality !== undefined && (
                <span 
                  className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                    element.overallQuality >= 0.8 ? 'bg-green-100 text-green-800' :
                    element.overallQuality >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                    element.overallQuality >= 0.4 ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}
                  title={`Selector Quality: ${Math.round(element.overallQuality * 100)}%`}
                >
                  {element.overallQuality >= 0.8 ? '🌟' : 
                   element.overallQuality >= 0.6 ? '✅' : 
                   element.overallQuality >= 0.4 ? '⚠️' : '❌'}
                  {Math.round(element.overallQuality * 100)}%
                </span>
              )}
              {/* Copy Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(element.selector);
                }}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
                title="Copy selector"
              >
                📋
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border dark:border-gray-600 break-all">
            {getReadableSelector(element.selector)}
          </div>
          {/* Full selector tooltip on hover */}
          {element.selector.length > 40 && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate" title={element.selector}>
              Full: {element.selector}
            </div>
          )}
        </div>
      </div>

      {/* Page Source (if showing elements from multiple pages) */}
      {element.sourceUrl && (
        <div className="text-xs text-blue-600 truncate mb-2">
          📄 {element.sourceUrl.title || 'Page'}
        </div>
      )}

      {/* Enhanced Actions (if enabled) */}
      {showActions && (
        <div className="space-y-2">
          {/* Primary action */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(element);
            }}
            className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Use in Test
          </button>
          
          {/* Secondary actions */}
          <div className="flex space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(element.selector);
              }}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Copy selector"
            >
              📋
            </button>
          </div>
          
          {/* Quality warning */}
          {element.overallQuality !== undefined && element.overallQuality < 0.5 && (
            <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1">
              ⚠️ Low quality selector - consider improving
            </div>
          )}
        </div>
      )}
    </div>
  );
}