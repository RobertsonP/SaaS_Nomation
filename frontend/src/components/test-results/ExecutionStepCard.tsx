// Per-step result card. Visual style mirrors SortableTestStep so a result
// view feels like a "ghost" of the editable test in the builder.
interface ExecutionStepResult {
  step: string;
  description?: string;
  selector?: string;
  value?: string;
  status: 'passed' | 'failed' | 'skipped' | string;
  error?: string;
  attempts?: number;
  result?: { duration?: number };
  timestamp?: string | Date;
}

interface ExecutionStepCardProps {
  index: number;
  result: ExecutionStepResult;
  failureScreenshot?: string;
}

function getStepTypeColor(type: string): string {
  switch (type) {
    case 'click':
    case 'doubleclick':
    case 'rightclick':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
    case 'hover':
      return 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300';
    case 'type':
    case 'clear':
      return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
    case 'select':
    case 'check':
    case 'uncheck':
      return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300';
    case 'upload':
      return 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300';
    case 'scroll':
    case 'press':
      return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
    case 'wait':
      return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300';
    case 'assert':
      return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300';
    case 'navigation':
      return 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  }
}

function getStepTypeIcon(type: string): string {
  switch (type) {
    case 'click': return '👆';
    case 'doubleclick': return '👆👆';
    case 'rightclick': return '👆';
    case 'hover': return '🫸';
    case 'type': return '⌨️';
    case 'clear': return '🧹';
    case 'select': return '📋';
    case 'check': return '☑️';
    case 'uncheck': return '◻️';
    case 'upload': return '📁';
    case 'scroll': return '↕️';
    case 'press': return '⌨️';
    case 'wait': return '⏳';
    case 'assert': return '✓';
    case 'navigation': return '🧭';
    default: return '📝';
  }
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function ExecutionStepCard({ index, result, failureScreenshot }: ExecutionStepCardProps) {
  const failed = result.status === 'failed';
  const skipped = result.status === 'skipped';
  const duration = formatDuration(result.result?.duration);

  return (
    <div
      className={`border rounded-lg p-2 bg-white dark:bg-gray-800 shadow-sm transition-colors ${
        failed
          ? 'border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-900/50'
          : skipped
            ? 'border-gray-200 dark:border-gray-700 opacity-70'
            : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Step Number */}
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex-shrink-0">
          {index + 1}
        </span>

        {/* Step Type Badge */}
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStepTypeColor(result.step)}`}>
          <span className="mr-1">{getStepTypeIcon(result.step)}</span>
          {result.step.toUpperCase()}
        </span>

        {/* Description + selector */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 dark:text-white truncate">
            {result.description || `${result.step} step`}
          </div>
          {(result.selector || result.value) && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {result.selector && <code className="font-mono truncate">{result.selector}</code>}
              {result.value && (
                <>
                  <span>→</span>
                  <span className="truncate font-medium">{result.value}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status + duration */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {duration && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{duration}</span>
          )}
          {failed ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              ✕ FAILED
            </span>
          ) : skipped ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              ⏸ SKIPPED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
              ✓ PASSED
            </span>
          )}
        </div>
      </div>

      {/* Error message (failed steps only) */}
      {failed && result.error && (
        <div className="mt-2 ml-12 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Error</div>
          <pre className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words font-mono">
            {result.error}
          </pre>
          {failureScreenshot && (
            <div className="mt-2">
              <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Screenshot at failure</div>
              <img
                src={failureScreenshot}
                alt="Failure"
                className="max-w-full rounded border border-red-300 dark:border-red-700"
              />
            </div>
          )}
        </div>
      )}

      {/* Retry annotation */}
      {result.attempts && result.attempts > 1 && (
        <div className="mt-1 ml-12 text-xs text-amber-600 dark:text-amber-400">
          Recovered after {result.attempts} attempts
        </div>
      )}
    </div>
  );
}
