import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle, Maximize2, X, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { useDiscoveryContext } from '../../contexts/DiscoveryContext';

export function DiscoveryFloatingIndicator() {
  const { activeDiscovery, restoreDiscovery, clearDiscovery } = useDiscoveryContext();
  const [expanded, setExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed time timer
  useEffect(() => {
    if (!activeDiscovery || activeDiscovery.status !== 'discovering') return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeDiscovery?.status]);

  // Show whenever there's active discovery
  if (!activeDiscovery) {
    return null;
  }

  const isComplete = activeDiscovery.status === 'complete';
  const isFailed = activeDiscovery.status === 'failed';
  const isRunning = activeDiscovery.status === 'discovering';

  // Get recent discovered URLs (last 5)
  const recentUrls = activeDiscovery.discoveredUrls.slice(-5).reverse();

  // Extract path from URL for display
  const getPathFromUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname || '/';
    } catch {
      return url;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className={`
        rounded-lg shadow-lg border overflow-hidden
        ${isComplete
          ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700'
          : isFailed
          ? 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-700'
          : 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700'
        }
      `}>
        {/* Main content */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Status Icon */}
          {isRunning && (
            <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
          )}
          {isComplete && (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          )}
          {isFailed && (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}

          {/* Status Text */}
          <div className="flex flex-col flex-1 min-w-0">
            <span className={`text-sm font-medium ${
              isComplete
                ? 'text-green-800 dark:text-green-200'
                : isFailed
                ? 'text-red-800 dark:text-red-200'
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              {isRunning && `Discovering: ${activeDiscovery.phase}${elapsedSeconds > 0 ? ` (${elapsedSeconds}s)` : ''}`}
              {isComplete && 'Discovery Complete'}
              {isFailed && 'Discovery Failed'}
            </span>
            <span className={`text-xs ${
              isComplete
                ? 'text-green-600 dark:text-green-300'
                : isFailed
                ? 'text-red-600 dark:text-red-300'
                : 'text-blue-600 dark:text-blue-300'
            }`}>
              {activeDiscovery.pagesFound} / {activeDiscovery.maxPages} pages
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isRunning && recentUrls.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300"
                title={expanded ? 'Hide details' : 'Show recent pages'}
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={restoreDiscovery}
              className={`p-1.5 rounded hover:bg-opacity-20 ${
                isComplete
                  ? 'hover:bg-green-600 text-green-700 dark:text-green-300'
                  : isFailed
                  ? 'hover:bg-red-600 text-red-700 dark:text-red-300'
                  : 'hover:bg-blue-600 text-blue-700 dark:text-blue-300'
              }`}
              title="View full details"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            {(isComplete || isFailed) && (
              <button
                onClick={clearDiscovery}
                className={`p-1.5 rounded hover:bg-opacity-20 ${
                  isComplete
                    ? 'hover:bg-green-600 text-green-700 dark:text-green-300'
                    : 'hover:bg-red-600 text-red-700 dark:text-red-300'
                }`}
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="px-4 pb-2">
            <div className="h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${activeDiscovery.maxPages > 0 ? Math.min(100, Math.round((activeDiscovery.pagesFound / activeDiscovery.maxPages) * 100)) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Expanded section - Recent URLs */}
        {expanded && isRunning && recentUrls.length > 0 && (
          <div className="border-t border-blue-200 dark:border-blue-700 px-4 py-2 max-h-40 overflow-y-auto">
            <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
              Recent pages found:
            </div>
            <div className="space-y-1">
              {recentUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400"
                >
                  <Globe className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate" title={url}>
                    {getPathFromUrl(url)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
