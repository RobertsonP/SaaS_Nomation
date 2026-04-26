import { useState } from 'react';
import { TestExecutionReport } from './TestExecutionReport';

interface NestedTestExecution {
  id: string;
  status: string;
  startedAt: string | Date;
  completedAt?: string | Date | null;
  duration?: number | null;
  errorMsg?: string | null;
  results?: any[];
  screenshots?: string[];
  videoPath?: string | null;
  videoThumbnail?: string | null;
}

interface SuiteTestResult {
  testId: string;
  testName: string;
  executionId: string;
  status: 'passed' | 'failed' | string;
  duration?: number;
  errorMsg?: string;
  stepCount?: number;
  failedStep?: string;
  execution?: NestedTestExecution;
}

interface SuiteExecutionData {
  id: string;
  status: 'passed' | 'failed' | 'running' | string;
  startedAt: string | Date;
  completedAt?: string | Date | null;
  duration?: number | null;
  results?: { testResults?: SuiteTestResult[] } | null;
}

interface SuiteExecutionReportProps {
  execution: SuiteExecutionData;
  suiteName: string;
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

export function SuiteExecutionReport({ execution, suiteName }: SuiteExecutionReportProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tests = execution.results?.testResults ?? [];
  const total = tests.length;
  const passed = tests.filter(t => t.status === 'passed').length;
  const failed = total - passed;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const overallPassed = execution.status === 'passed';
  const headerStatusClasses = overallPassed
    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
    : execution.status === 'running'
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{suiteName}</h2>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Tests</div>
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
          <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Pass Rate</div>
            <div className={`mt-1 text-2xl font-semibold ${passRate === 100 ? 'text-green-700 dark:text-green-300' : passRate > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
              {passRate}%
            </div>
          </div>
        </div>

        {/* Pass-rate bar */}
        {total > 0 && (
          <div className="mt-4 w-full h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex">
            <div
              className="h-full bg-green-500 dark:bg-green-400"
              style={{ width: `${(passed / total) * 100}%` }}
              title={`${passed} passed`}
            />
            <div
              className="h-full bg-red-500 dark:bg-red-400"
              style={{ width: `${(failed / total) * 100}%` }}
              title={`${failed} failed`}
            />
          </div>
        )}
      </div>

      {/* Per-test rows */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Tests ({total})</h3>
        {total === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No test results recorded.</p>
        ) : (
          <div className="space-y-2">
            {tests.map(t => {
              const open = expanded.has(t.executionId);
              const failedTest = t.status === 'failed';
              return (
                <div
                  key={t.executionId}
                  className={`border rounded-lg ${
                    failedTest
                      ? 'border-red-200 dark:border-red-800'
                      : 'border-gray-200 dark:border-gray-700'
                  } bg-white dark:bg-gray-800`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(t.executionId)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <span
                      className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        failedTest
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                          : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      }`}
                    >
                      {failedTest ? '✕ FAILED' : '✓ PASSED'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.testName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {t.stepCount ?? '—'} steps
                        {t.duration ? ` · ${formatDuration(t.duration)}` : ''}
                        {t.failedStep ? ` · failed at: ${t.failedStep}` : ''}
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {open && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/30">
                      {t.execution ? (
                        <TestExecutionReport
                          execution={t.execution}
                          testName={t.testName}
                          showAttachments={false}
                        />
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          Detailed step results not available for this test.
                          {t.errorMsg && (
                            <span className="block mt-1 text-red-600 dark:text-red-300">{t.errorMsg}</span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
