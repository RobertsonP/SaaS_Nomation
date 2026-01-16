interface StepItemProps {
  /**
   * Step index (0-based)
   */
  index: number;

  /**
   * Step description
   */
  description: string;

  /**
   * Current status of the step
   */
  status: 'pending' | 'running' | 'passed' | 'failed';

  /**
   * Error message if step failed
   */
  error?: string;

  /**
   * Show step number badge
   */
  showNumber?: boolean;
}

const statusConfig = {
  passed: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-500 text-white',
    icon: '✓',
  },
  failed: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-500 text-white',
    icon: '✗',
  },
  running: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-500 text-white',
    icon: '⟳',
  },
  pending: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    badge: 'bg-gray-300 text-gray-600',
    icon: '',
  },
};

/**
 * A reusable step item component for execution lists
 */
export function StepItem({
  index,
  description,
  status,
  error,
  showNumber = true,
}: StepItemProps) {
  const config = statusConfig[status];

  return (
    <div
      className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${config.badge}`}
          >
            {config.icon || (showNumber ? index + 1 : '')}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              Step {index + 1}: {description}
            </p>
            {error && (
              <p className="text-xs text-red-600 mt-1">Error: {error}</p>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {status === 'passed' && '✅'}
          {status === 'failed' && '❌'}
          {status === 'running' && (
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
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A list container for multiple step items
 */
interface StepListProps {
  steps: Array<{
    stepIndex: number;
    description: string;
    status: 'pending' | 'running' | 'passed' | 'failed';
    error?: string;
  }>;
  emptyMessage?: string;
}

export function StepList({ steps, emptyMessage = 'No steps to display' }: StepListProps) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="animate-pulse">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <StepItem
          key={index}
          index={step.stepIndex}
          description={step.description}
          status={step.status}
          error={step.error}
        />
      ))}
    </div>
  );
}
