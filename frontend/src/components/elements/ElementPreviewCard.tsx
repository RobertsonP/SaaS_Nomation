import { useState } from 'react';
import { ProjectElement } from '../../types/element.types';
import { CSSPreviewRenderer } from './CSSPreviewRenderer';

interface ElementPreviewCardProps {
  element: ProjectElement;
  onSelectElement: (element: ProjectElement) => void;
  isLiveMode?: boolean;
  onPerformAction?: (action: { type: string; selector: string; value?: string }) => void;
  showQuality?: boolean;
  compact?: boolean;
}

function getPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return url;
  }
}

export function ElementPreviewCard({
  element,
  onSelectElement,
  isLiveMode,
  onPerformAction,
}: ElementPreviewCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopySelector = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(element.selector);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may not be available
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectElement(element);
    }
  };

  const handleLiveAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
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

  const getElementTypeColor = (type: string) => {
    switch (type) {
      case 'button': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700';
      case 'input': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700';
      case 'link': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700';
      case 'form': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700';
      case 'navigation': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700';
      case 'table': return 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getDiscoveryStateBadge = (discoveryState?: string) => {
    if (!discoveryState || discoveryState === 'static') return null;

    const stateConfig: Record<string, { color: string; label: string }> = {
      after_login: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', label: 'After Login' },
      login_page: { color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300', label: 'Login' },
      after_interaction: { color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: 'Interactive' },
      modal: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', label: 'Modal' },
      hover: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', label: 'Hover' },
      tab: { color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300', label: 'Tab' },
    };

    const config = stateConfig[discoveryState];
    if (!config) return null;

    return (
      <span className={`px-1.5 py-0.5 text-xs rounded ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const attributes = element.attributes as any;
  const sourceUrl = element.sourceUrl?.url;
  const truncatedSelector = element.selector.length > 40
    ? element.selector.substring(0, 40) + '...'
    : element.selector;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectElement(element)}
      onKeyDown={handleKeyDown}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden
        hover:border-blue-400 hover:shadow-md cursor-pointer active:scale-[0.98] transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
    >
      {/* Badges */}
      <div className="px-3 pt-3 flex items-center gap-1.5 flex-wrap">
        <span className={`px-2 py-0.5 text-xs rounded border ${getElementTypeColor(element.elementType)}`}>
          {element.elementType}
        </span>
        {attributes?.discoveryState && getDiscoveryStateBadge(attributes.discoveryState)}
      </div>

      {/* Description */}
      <div className="px-3 pt-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
          {element.description}
        </p>
      </div>

      {/* CSS Preview */}
      {element.attributes?.cssInfo && (
        <div className="px-3 pt-2">
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-1.5 max-h-20 overflow-hidden">
            <CSSPreviewRenderer
              element={element}
              mode="compact"
              showQuality={false}
              interactive={false}
              className="mx-auto"
            />
          </div>
        </div>
      )}

      {/* Selector + Copy */}
      <div className="px-3 pt-2 flex items-center gap-1.5">
        <code className="flex-1 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
          {truncatedSelector}
        </code>
        <button
          onClick={handleCopySelector}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Copy selector"
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Source URL */}
      {sourceUrl && (
        <div className="px-3 pt-1.5 pb-3">
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate block">
            {getPathFromUrl(sourceUrl)}
          </span>
        </div>
      )}
      {!sourceUrl && <div className="pb-3" />}

      {/* Live Mode Actions (only in live mode) */}
      {isLiveMode && onPerformAction && (
        <div className="px-3 pb-3 flex gap-1 border-t border-gray-100 dark:border-gray-700 pt-2">
          <button
            onClick={(e) => handleLiveAction(e, 'click')}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
          >
            Click
          </button>
          <button
            onClick={(e) => handleLiveAction(e, 'hover')}
            className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Hover
          </button>
          {element.elementType === 'input' && (
            <button
              onClick={(e) => handleLiveAction(e, 'type')}
              className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Type
            </button>
          )}
        </div>
      )}
    </div>
  );
}
