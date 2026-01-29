import { Loader2, CheckCircle, AlertCircle, Maximize2, X } from 'lucide-react';
import { useDiscoveryContext } from '../../contexts/DiscoveryContext';

export function DiscoveryFloatingIndicator() {
  const { activeDiscovery, isMinimized, restoreDiscovery, clearDiscovery } = useDiscoveryContext();

  // Only show if minimized and has active discovery
  if (!isMinimized || !activeDiscovery) {
    return null;
  }

  const isComplete = activeDiscovery.status === 'complete';
  const isFailed = activeDiscovery.status === 'failed';
  const isRunning = activeDiscovery.status === 'discovering';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border
        ${isComplete
          ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700'
          : isFailed
          ? 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-700'
          : 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700'
        }
      `}>
        {/* Status Icon */}
        {isRunning && (
          <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
        )}
        {isComplete && (
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
        )}
        {isFailed && (
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        )}

        {/* Status Text */}
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${
            isComplete
              ? 'text-green-800 dark:text-green-200'
              : isFailed
              ? 'text-red-800 dark:text-red-200'
              : 'text-blue-800 dark:text-blue-200'
          }`}>
            {isRunning && 'Discovering...'}
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
            {activeDiscovery.pagesFound} pages found
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={restoreDiscovery}
            className={`p-1.5 rounded hover:bg-opacity-20 ${
              isComplete
                ? 'hover:bg-green-600 text-green-700 dark:text-green-300'
                : isFailed
                ? 'hover:bg-red-600 text-red-700 dark:text-red-300'
                : 'hover:bg-blue-600 text-blue-700 dark:text-blue-300'
            }`}
            title="View details"
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
    </div>
  );
}
