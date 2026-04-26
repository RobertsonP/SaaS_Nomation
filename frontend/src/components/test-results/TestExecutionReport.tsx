import { useState } from 'react';
import { ExecutionStepCard } from './ExecutionStepCard';

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

interface ExecutionData {
  id: string;
  status: 'passed' | 'failed' | 'running' | string;
  startedAt: string | Date;
  completedAt?: string | Date | null;
  duration?: number | null;
  errorMsg?: string | null;
  results?: ExecutionStepResult[];
  screenshots?: string[];
  videoPath?: string | null;
  videoThumbnail?: string | null;
}

interface TestExecutionReportProps {
  execution: ExecutionData;
  testName: string;
  /**
   * Renders the screenshots gallery and video player when true. Default true.
   * Some embedded usages (e.g. inside SuiteExecutionReport rows) may want
   * a more compact view without the gallery.
   */
  showAttachments?: boolean;
}

function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function formatTime(ts?: string | Date | null): string {
  if (!ts) return '—';
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return d.toLocaleString();
}

export function TestExecutionReport({ execution, testName, showAttachments = true }: TestExecutionReportProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);

  const results = execution.results ?? [];
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const total = results.length;

  const failedIndex = results.findIndex(r => r.status === 'failed');
  // The failure screenshot is the LAST entry in screenshots[] when a step
  // failed (the processor pushes the error screenshot before breaking out
  // of the step loop). Backend stores raw base64 (no data: prefix) — add it
  // here so <img src> renders correctly in ExecutionStepCard.
  const failureScreenshot = (() => {
    if (failedIndex < 0 || !execution.screenshots || execution.screenshots.length === 0) return undefined;
    const last = execution.screenshots[execution.screenshots.length - 1];
    return last.startsWith('data:') ? last : `data:image/png;base64,${last}`;
  })();

  const overallPassed = execution.status === 'passed';
  const headerStatusClasses = overallPassed
    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
    : execution.status === 'running'
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{testName}</h2>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
              <span>Started: {formatTime(execution.startedAt)}</span>
              <span>Duration: {formatDuration(execution.duration)}</span>
              <span>Run ID: <code className="font-mono">{execution.id.slice(0, 8)}…</code></span>
            </div>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium border ${headerStatusClasses}`}>
            {execution.status.toUpperCase()}
          </span>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Steps</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{total}</div>
          </div>
          <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
            <div className="text-xs uppercase tracking-wide text-green-700 dark:text-green-300">Passed</div>
            <div className="mt-1 text-2xl font-semibold text-green-700 dark:text-green-300">{passed}</div>
          </div>
          <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
            <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300">Failed</div>
            <div className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-300">{failed}</div>
          </div>
        </div>

        {execution.errorMsg && (
          <div className="mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Run-level error</div>
            <pre className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words font-mono">
              {execution.errorMsg}
            </pre>
          </div>
        )}
      </div>

      {/* Steps timeline */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Steps ({total})</h3>
        {total === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No step results recorded.</p>
        ) : (
          <div className="space-y-2">
            {results.map((r, i) => (
              <ExecutionStepCard
                key={i}
                index={i}
                result={r}
                failureScreenshot={i === failedIndex ? failureScreenshot : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Attachments: video + screenshots gallery */}
      {showAttachments && (execution.videoPath || (execution.screenshots && execution.screenshots.length > 0)) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Attachments</h3>

          {execution.videoPath && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Recording
              </div>
              <video
                src={`/api/execution/${execution.id}/video`}
                controls
                className="w-full max-w-3xl rounded border border-gray-200 dark:border-gray-700"
              />
            </div>
          )}

          {execution.screenshots && execution.screenshots.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setGalleryOpen(o => !o)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {galleryOpen ? 'Hide' : 'Show'} screenshots ({execution.screenshots.length})
              </button>
              {galleryOpen && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {execution.screenshots.map((shot, i) => (
                    <a
                      key={i}
                      href={shot.startsWith('data:') ? shot : `data:image/png;base64,${shot}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors"
                    >
                      <img
                        src={shot.startsWith('data:') ? shot : `data:image/png;base64,${shot}`}
                        alt={`Screenshot ${i + 1}`}
                        className="w-full h-32 object-cover object-top"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
