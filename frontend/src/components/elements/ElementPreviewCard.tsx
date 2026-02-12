import { useState } from 'react';
import { ProjectElement } from '../../types/element.types';
import { CSSPreviewRenderer } from './CSSPreviewRenderer';
import { QualityIndicator } from './QualityIndicator';

interface ElementPreviewCardProps {
  element: ProjectElement;
  onSelectElement: (element: ProjectElement) => void;
  isLiveMode?: boolean;
  onPerformAction?: (action: { type: string; selector: string; value?: string }) => void;
  showQuality?: boolean;
  compact?: boolean;
}

export function ElementPreviewCard({
  element,
  onSelectElement,
  isLiveMode,
  onPerformAction,
  showQuality = true,
  compact = false
}: ElementPreviewCardProps) {
  const [showFullSelector, setShowFullSelector] = useState(false);

  const getElementTypeColor = (type: string) => {
    switch (type) {
      case 'button': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'input': return 'bg-green-100 text-green-800 border-green-200';
      case 'link': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'form': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'navigation': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'table': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'text': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDiscoveryStateBadge = (discoveryState?: string) => {
    if (!discoveryState) return null;

    const stateConfig: Record<string, { color: string; label: string }> = {
      static: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Static' },
      after_login: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'After Login' },
      login_page: { color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', label: 'Login Page' },
      after_interaction: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Interactive' },
      modal: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', label: 'Modal' },
      hover: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Hover' },
    };

    const config = stateConfig[discoveryState];
    if (!config) return null;

    return (
      <span className={`px-1.5 py-0.5 text-xs rounded ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleLiveAction = (action: string) => {
    if (!onPerformAction) return;

    const actionMap: Record<string, { type: string; selector: string; value?: string }> = {
      click: { type: 'click', selector: element.selector },
      hover: { type: 'hover', selector: element.selector },
      type: { type: 'type', selector: element.selector, value: 'test input' },
    };

    const actionConfig = actionMap[action];
    if (actionConfig) {
      onPerformAction(actionConfig);
    }
  };

  const attributes = element.attributes as any;
  const validatedSelectors = attributes?.validatedSelectors || [];
  const isShared = attributes?.isSharedElement;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Visual Preview Section */}
      <div className="relative">
        {element.attributes?.cssInfo ? (
          <div className="bg-gray-50 dark:bg-gray-900 p-2">
            <CSSPreviewRenderer
              element={element}
              mode={compact ? 'compact' : 'detailed'}
              showQuality={showQuality}
              interactive={false}
              className="max-h-32 mx-auto"
            />
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900 p-4 flex flex-col items-center justify-center min-h-16">
            <div className="text-sm text-gray-400 dark:text-gray-500">
              {element.elementType || 'Element'}
            </div>
          </div>
        )}

        {/* Quality Score Indicator */}
        <div className="absolute top-2 right-2 z-10 max-w-[calc(100%-1rem)]">
          {showQuality && element.overallQuality !== undefined && (
            <QualityIndicator
              element={element}
              mode="badge"
              className="text-xs"
            />
          )}
        </div>

        {/* Shared Element Indicator */}
        {isShared && (
          <div className="absolute top-2 left-2 z-10">
            <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded">
              Shared
            </span>
          </div>
        )}
      </div>

      {/* Element Information */}
      <div className="p-3">
        {/* Header with Element Type */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs rounded border ${getElementTypeColor(element.elementType)}`}>
              {element.elementType}
            </span>
            {attributes?.discoveryState && getDiscoveryStateBadge(attributes.discoveryState)}
          </div>
        </div>

        {/* Description */}
        <h3
          className="font-medium text-sm mb-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-gray-900 dark:text-white"
          onClick={() => onSelectElement(element)}
          title="Click to use in test"
        >
          {element.description}
        </h3>

        {/* Selector Information */}
        <div className="space-y-1">
          <div className="text-xs">
            <code
              className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
              onClick={() => setShowFullSelector(!showFullSelector)}
              title="Click to toggle full selector"
            >
              {showFullSelector ? element.selector :
               (element.selector.length > 35 ? element.selector.substring(0, 35) + '...' : element.selector)}
            </code>
          </div>

          {validatedSelectors.length > 1 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              +{validatedSelectors.length - 1} alternative{validatedSelectors.length > 2 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Element Text */}
        {attributes?.text && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">
            "{attributes.text}"
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 flex flex-wrap gap-1">
          <button
            onClick={() => onSelectElement(element)}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Use in Test
          </button>

          {/* Live Mode Actions */}
          {isLiveMode && onPerformAction && (
            <>
              <button
                onClick={() => handleLiveAction('click')}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                title="Click this element in live browser"
              >
                Click
              </button>
              <button
                onClick={() => handleLiveAction('hover')}
                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                title="Hover over this element"
              >
                Hover
              </button>
              {element.elementType === 'input' && (
                <button
                  onClick={() => handleLiveAction('type')}
                  className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                  title="Type in this element"
                >
                  Type
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
