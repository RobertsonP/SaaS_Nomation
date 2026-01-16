interface ExecutionStatusBadgeProps {
  /**
   * Current execution status
   */
  status: 'running' | 'passed' | 'failed' | 'pending';

  /**
   * Show animated pulse for running status
   */
  animated?: boolean;

  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

const statusColors = {
  running: 'bg-blue-500',
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  pending: 'bg-gray-400',
};

const sizes = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

/**
 * A status indicator badge (colored dot)
 */
export function ExecutionStatusBadge({
  status,
  animated = true,
  size = 'md',
}: ExecutionStatusBadgeProps) {
  const color = statusColors[status];
  const sizeClass = sizes[size];

  return (
    <div
      className={`${sizeClass} rounded-full ${color} ${status === 'running' && animated ? 'animate-pulse' : ''}`}
    />
  );
}

/**
 * Props for the execution result banner
 */
interface ExecutionResultBannerProps {
  /**
   * Whether the execution passed
   */
  passed: boolean;

  /**
   * Execution duration in milliseconds
   */
  duration?: number;

  /**
   * Error message if failed
   */
  error?: string;
}

/**
 * A banner showing the final execution result
 */
export function ExecutionResultBanner({
  passed,
  duration,
  error,
}: ExecutionResultBannerProps) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}
    >
      <div className="flex items-center space-x-2">
        <span className="text-2xl">{passed ? '✅' : '❌'}</span>
        <div>
          <h3
            className={`text-lg font-bold ${
              passed ? 'text-green-700' : 'text-red-700'
            }`}
          >
            Test {passed ? 'Passed' : 'Failed'}
          </h3>
          {duration !== undefined && (
            <p className="text-sm text-gray-600">
              Duration: {(duration / 1000).toFixed(2)}s
            </p>
          )}
          {error && <p className="text-sm text-red-600 mt-1">Error: {error}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Props for current step indicator
 */
interface CurrentStepIndicatorProps {
  /**
   * Current step index (1-based for display)
   */
  stepNumber: number;

  /**
   * Description of the current step
   */
  description: string;
}

/**
 * An indicator showing the currently running step
 */
export function CurrentStepIndicator({
  stepNumber,
  description,
}: CurrentStepIndicatorProps) {
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <svg
          className="animate-spin h-4 w-4 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm font-medium text-blue-700">Current Step</span>
      </div>
      <p className="text-sm text-gray-700">
        Step {stepNumber}: {description}
      </p>
    </div>
  );
}
