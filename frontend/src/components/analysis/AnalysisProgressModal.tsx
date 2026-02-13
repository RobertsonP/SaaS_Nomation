import React, { useState } from 'react';
import { AnalysisProgressState, AnalysisPhase, AnalysisEvent } from '../../hooks/useAnalysisProgress';

interface AnalysisProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  projectName: string;
  progress: AnalysisProgressState;
}

const PHASES: { key: AnalysisPhase; label: string }[] = [
  { key: 'prepare', label: 'Prepare' },
  { key: 'scan', label: 'Scan' },
  { key: 'save', label: 'Save' },
  { key: 'done', label: 'Done' },
];

function phaseIndex(phase: AnalysisPhase): number {
  return PHASES.findIndex(p => p.key === phase);
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export const AnalysisProgressModal: React.FC<AnalysisProgressModalProps> = ({
  isOpen,
  onClose,
  onMinimize,
  projectName,
  progress,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen) return null;

  const { isComplete, hasError, currentPhase, currentPhaseLabel, overallPercent,
    currentUrlIndex, totalUrls, elementsFound, elapsedSeconds, rawEvents, errorMessage } = progress;

  const currentPhaseIdx = phaseIndex(currentPhase);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {projectName}
            </h2>
          </div>
          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            {onMinimize && !isComplete && !hasError && (
              <button
                onClick={onMinimize}
                className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                title="Minimize"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title={isComplete || hasError ? 'Close' : 'Close (analysis continues in background)'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            {PHASES.map((phase, idx) => {
              const isDone = idx < currentPhaseIdx || isComplete;
              const isActive = idx === currentPhaseIdx && !isComplete;
              const isError = hasError && idx === currentPhaseIdx;

              return (
                <React.Fragment key={phase.key}>
                  {idx > 0 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded ${
                      isDone ? 'bg-green-500' :
                      isActive ? 'bg-blue-300 dark:bg-blue-700' :
                      'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isError ? 'bg-red-500 text-white' :
                      isDone ? 'bg-green-500 text-white' :
                      isActive ? 'bg-blue-500 text-white' :
                      'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {isError ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : isDone ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className={`text-xs mt-1 ${
                      isError ? 'text-red-600 dark:text-red-400 font-medium' :
                      isDone || isActive ? 'text-gray-900 dark:text-white font-medium' :
                      'text-gray-400 dark:text-gray-500'
                    }`}>
                      {phase.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-2">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-out rounded-full ${
                hasError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>

        {/* Main status area */}
        <div className="px-6 py-4">
          <p className={`text-sm font-medium ${
            hasError ? 'text-red-700 dark:text-red-300' :
            isComplete ? 'text-green-700 dark:text-green-300' :
            'text-gray-900 dark:text-white'
          }`}>
            {currentPhaseLabel}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {totalUrls > 0 && (
              <span>
                Page {Math.min(currentUrlIndex, totalUrls)} of {totalUrls}
              </span>
            )}
            {elementsFound > 0 && (
              <span>{elementsFound} elements found</span>
            )}
            {elapsedSeconds > 0 && (
              <span>{formatElapsed(elapsedSeconds)}</span>
            )}
          </div>

          {/* Error details */}
          {hasError && errorMessage && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
              {rawEvents.filter(e => e.status === 'error' && e.details?.suggestions).map((e, i) => (
                <ul key={i} className="mt-2 text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                  {e.details.suggestions.map((s: string, j: number) => (
                    <li key={j}>{s}</li>
                  ))}
                </ul>
              ))}
            </div>
          )}
        </div>

        {/* Details toggle */}
        <div className="px-6 pb-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>

          {showDetails && rawEvents.length > 0 && (
            <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
              <div className="space-y-1">
                {rawEvents.map((event, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    <span className={`flex-shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full ${
                      event.status === 'error' ? 'bg-red-500' :
                      event.status === 'completed' ? 'bg-green-500' :
                      event.status === 'started' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">{event.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — only show close button when done */}
        {(isComplete || hasError) && (
          <div className="flex items-center justify-end px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                hasError ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {hasError ? 'Close' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
