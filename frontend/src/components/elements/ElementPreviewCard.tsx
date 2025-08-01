import { useState } from 'react';
import { ProjectElement } from '../../types/element.types';

interface ElementPreviewCardProps {
  element: ProjectElement;
  onSelectElement: (element: ProjectElement) => void;
  onRequestScreenshot?: (elementId: string, selector: string, url: string) => Promise<string>;
  isLiveMode?: boolean;
  onPerformAction?: (action: { type: string; selector: string; value?: string }) => void;
}

export function ElementPreviewCard({ 
  element, 
  onSelectElement, 
  onRequestScreenshot,
  isLiveMode,
  onPerformAction 
}: ElementPreviewCardProps) {
  const [screenshot, setScreenshot] = useState<string | null>(
    element.screenshot || null
  );
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);
  const [showFullSelector, setShowFullSelector] = useState(false);

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

  const getElementIcon = (type: string) => {
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

  const getDiscoveryStateBadge = (discoveryState?: string) => {
    if (!discoveryState) return null;
    
    const stateConfig = {
      static: { color: 'bg-gray-100 text-gray-800', icon: '📄', label: 'Static' },
      after_login: { color: 'bg-blue-100 text-blue-800', icon: '🔐', label: 'After Login' },
      login_page: { color: 'bg-indigo-100 text-indigo-800', icon: '🔑', label: 'Login Page' },
      after_interaction: { color: 'bg-green-100 text-green-800', icon: '👆', label: 'Interactive' },
      modal: { color: 'bg-purple-100 text-purple-800', icon: '🪟', label: 'Modal' },
      hover: { color: 'bg-yellow-100 text-yellow-800', icon: '🎯', label: 'Hover' }
    };
    
    const config = stateConfig[discoveryState as keyof typeof stateConfig];
    if (!config) return null;
    
    return (
      <span className={`px-1 py-0.5 text-xs rounded whitespace-nowrap ${config.color}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const handleScreenshotRequest = async () => {
    if (!onRequestScreenshot || !element.sourceUrl) return;
    
    setLoadingScreenshot(true);
    try {
      const screenshotBase64 = await onRequestScreenshot(
        element.id,
        element.selector,
        element.sourceUrl.url
      );
      setScreenshot(screenshotBase64);
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    } finally {
      setLoadingScreenshot(false);
    }
  };

  const handleLiveAction = (action: string) => {
    if (!onPerformAction) return;
    
    const actionMap = {
      click: { type: 'click', selector: element.selector },
      hover: { type: 'hover', selector: element.selector },
      type: { type: 'type', selector: element.selector, value: 'test input' }
    };
    
    const actionConfig = actionMap[action as keyof typeof actionMap];
    if (actionConfig) {
      onPerformAction(actionConfig);
    }
  };

  const attributes = element.attributes as any;
  const reliabilityScore = attributes?.selectorReliabilityScore || 0;
  const validatedSelectors = attributes?.validatedSelectors || [];
  const isShared = attributes?.isSharedElement;

  return (
    <div className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Visual Preview Section */}
      <div className="relative">
        {screenshot ? (
          <div className="bg-gray-50 p-2">
            <img 
              src={`data:image/png;base64,${screenshot}`}
              alt={`Preview of ${element.description}`}
              className="max-w-full h-auto max-h-32 mx-auto rounded border shadow-sm"
              style={{ imageRendering: 'crisp-edges' }}
            />
            <div className="text-xs text-gray-500 text-center mt-1">
              Element Preview
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 p-4 flex flex-col items-center justify-center min-h-24">
            <div className="text-2xl mb-1">{getElementIcon(element.elementType)}</div>
            <div className="text-xs text-gray-500 text-center mb-2">No preview available</div>
            <button
              onClick={handleScreenshotRequest}
              disabled={loadingScreenshot || !onRequestScreenshot}
              className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={!onRequestScreenshot ? 'Screenshot capture not available' : 'Capture element preview from live page'}
            >
              {loadingScreenshot ? (
                <>
                  <span className="inline-block animate-spin mr-1">⏳</span>
                  Capturing...
                </>
              ) : (
                <>
                  📸 Capture Preview
                </>
              )}
            </button>
            {onRequestScreenshot && (
              <div className="text-xs text-gray-400 text-center mt-1">
                Click to capture live element screenshot
              </div>
            )}
          </div>
        )}
        
        {/* Reliability Score Indicator */}
        <div className="absolute top-1 right-1">
          <div className={`px-1 py-0.5 text-xs rounded ${
            reliabilityScore > 0.8 ? 'bg-green-100 text-green-800' :
            reliabilityScore > 0.5 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {Math.round(reliabilityScore * 100)}%
          </div>
        </div>

        {/* Shared Element Indicator */}
        {isShared && (
          <div className="absolute top-1 left-1">
            <span className="px-1 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
              🔗 Shared
            </span>
          </div>
        )}
      </div>

      {/* Element Information */}
      <div className="p-3">
        {/* Header with Element Type and Confidence */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs rounded border ${getElementTypeColor(element.elementType)}`}>
              {element.elementType}
            </span>
            <span className="text-xs text-gray-500">
              {Math.round(element.confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Description */}
        <h3 
          className="font-medium text-sm mb-2 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => onSelectElement(element)}
          title="Click to use in test"
        >
          {element.description}
        </h3>

        {/* Discovery State Badge */}
        {attributes?.discoveryState && (
          <div className="mb-2">
            {getDiscoveryStateBadge(attributes.discoveryState)}
          </div>
        )}

        {/* Selector Information */}
        <div className="space-y-1">
          <div className="text-xs">
            <span className="text-gray-500">Primary:</span>
            <code 
              className="ml-1 bg-gray-100 px-1 rounded text-xs font-mono cursor-pointer hover:bg-gray-200"
              onClick={() => setShowFullSelector(!showFullSelector)}
              title="Click to toggle full view"
            >
              {showFullSelector ? element.selector : 
               (element.selector.length > 30 ? element.selector.substring(0, 30) + '...' : element.selector)}
            </code>
          </div>

          {/* Validated Selectors Count */}
          {validatedSelectors.length > 1 && (
            <div className="text-xs text-gray-500">
              +{validatedSelectors.length - 1} fallback selector{validatedSelectors.length > 2 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Element Text */}
        {attributes?.text && (
          <div className="text-xs text-gray-500 mt-2 truncate">
            Text: "{attributes.text}"
          </div>
        )}

        {/* Element Properties */}
        {(attributes?.id || attributes?.className || attributes?.dataTestId) && (
          <div className="text-xs text-gray-400 mt-2 space-y-1">
            {attributes.id && <div>ID: {attributes.id}</div>}
            {attributes.dataTestId && <div>Test ID: {attributes.dataTestId}</div>}
            {attributes.className && (
              <div>Classes: {attributes.className.split(' ').slice(0, 3).join(' ')}</div>
            )}
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

          {/* CRITICAL FIX: Always show preview button elegantly */}
          {onRequestScreenshot && (
            <button
              onClick={handleScreenshotRequest}
              disabled={loadingScreenshot}
              className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
              title={screenshot ? 'Refresh element preview' : 'Capture element preview'}
            >
              {loadingScreenshot ? 'Capturing...' : screenshot ? '🔄 Refresh' : '📸 Preview'}
            </button>
          )}

          {/* Live Mode Actions */}
          {isLiveMode && onPerformAction && (
            <>
              <button
                onClick={() => handleLiveAction('click')}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                title="Click this element in live browser"
              >
                Live Click
              </button>
              <button
                onClick={() => handleLiveAction('hover')}
                className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                title="Hover over this element in live browser"
              >
                Live Hover
              </button>
              {element.elementType === 'input' && (
                <button
                  onClick={() => handleLiveAction('type')}
                  className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                  title="Type in this element in live browser"
                >
                  Live Type
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}