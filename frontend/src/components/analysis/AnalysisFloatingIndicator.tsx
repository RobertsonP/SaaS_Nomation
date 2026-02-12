import { Loader2, CheckCircle, AlertCircle, Maximize2, X } from 'lucide-react';

interface AnalysisFloatingIndicatorProps {
  isVisible: boolean;
  projectName: string;
  currentStep: string;
  progressPercent: number;
  isComplete: boolean;
  hasError: boolean;
  onRestore: () => void;
  onDismiss: () => void;
}

export function AnalysisFloatingIndicator({
  isVisible,
  projectName,
  currentStep,
  progressPercent,
  isComplete,
  hasError,
  onRestore,
  onDismiss,
}: AnalysisFloatingIndicatorProps) {
  if (!isVisible) return null;

  const isRunning = !isComplete && !hasError;

  // Format step name for display
  const formatStepName = (step: string) => {
    return step
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .replace(/^\s*/, '')
      .replace(/^./, (c) => c.toUpperCase());
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className={`
        rounded-lg shadow-lg border overflow-hidden
        ${isComplete
          ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700'
          : hasError
          ? 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-700'
          : 'bg-purple-50 dark:bg-purple-900/40 border-purple-200 dark:border-purple-700'
        }
      `}>
        {/* Main content */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Status Icon */}
          {isRunning && (
            <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin flex-shrink-0" />
          )}
          {isComplete && (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          )}
          {hasError && (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}

          {/* Status Text */}
          <div className="flex flex-col flex-1 min-w-0">
            <span className={`text-sm font-medium ${
              isComplete
                ? 'text-green-800 dark:text-green-200'
                : hasError
                ? 'text-red-800 dark:text-red-200'
                : 'text-purple-800 dark:text-purple-200'
            }`}>
              {isRunning && `Analyzing: ${projectName}`}
              {isComplete && 'Analysis Complete'}
              {hasError && 'Analysis Failed'}
            </span>
            <span className={`text-xs ${
              isComplete
                ? 'text-green-600 dark:text-green-300'
                : hasError
                ? 'text-red-600 dark:text-red-300'
                : 'text-purple-600 dark:text-purple-300'
            }`}>
              {isRunning && formatStepName(currentStep)}
              {isComplete && 'Click to view results'}
              {hasError && 'Click to view details'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onRestore}
              className={`p-1.5 rounded hover:bg-opacity-20 ${
                isComplete
                  ? 'hover:bg-green-600 text-green-700 dark:text-green-300'
                  : hasError
                  ? 'hover:bg-red-600 text-red-700 dark:text-red-300'
                  : 'hover:bg-purple-600 text-purple-700 dark:text-purple-300'
              }`}
              title="View full details"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            {(isComplete || hasError) && (
              <button
                onClick={onDismiss}
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

        {/* Progress Bar - only when running */}
        {isRunning && (
          <div className="px-4 pb-2">
            <div className="h-1.5 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 dark:bg-purple-400 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
