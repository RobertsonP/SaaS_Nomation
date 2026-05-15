import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Minus, X, XCircle } from 'lucide-react';
import { AnalysisProgressState, AnalysisPhase } from '../../contexts/AnalysisContext';

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

  const {
    isComplete, hasError, currentPhase, currentPhaseLabel, overallPercent,
    currentUrlIndex, totalUrls, elementsFound, elapsedSeconds, rawEvents, errorMessage,
  } = progress;

  const currentPhaseIdx = phaseIndex(currentPhase);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {projectName}
          </div>
          <div className="row" style={{ gap: 2 }}>
            {onMinimize && !isComplete && !hasError && (
              <button
                type="button"
                className="icon-btn"
                onClick={onMinimize}
                title="Minimize"
              >
                <Minus size={14} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              title={isComplete || hasError ? 'Close' : 'Close (analysis continues in background)'}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body col" style={{ gap: 16 }}>
          {/* Stepper */}
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 0 }}>
            {PHASES.map((phase, idx) => {
              const isDone = idx < currentPhaseIdx || isComplete;
              const isActive = idx === currentPhaseIdx && !isComplete;
              const isError = hasError && idx === currentPhaseIdx;

              let bg = 'var(--surface-2)';
              let fg = 'var(--ink-3)';
              let borderColor = 'var(--hair)';
              if (isError) {
                bg = 'var(--clay)';
                fg = '#fff';
                borderColor = 'var(--clay)';
              } else if (isDone) {
                bg = 'var(--moss)';
                fg = '#fff';
                borderColor = 'var(--moss)';
              } else if (isActive) {
                bg = 'var(--info)';
                fg = '#fff';
                borderColor = 'var(--info)';
              }

              return (
                <React.Fragment key={phase.key}>
                  {idx > 0 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        margin: '0 6px',
                        borderRadius: 999,
                        background: isDone ? 'var(--moss)' : isActive ? 'var(--info-soft)' : 'var(--hair)',
                      }}
                    />
                  )}
                  <div className="col" style={{ alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: bg,
                        color: fg,
                        border: `1px solid ${borderColor}`,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {isError ? (
                        <XCircle size={13} />
                      ) : isDone ? (
                        <CheckCircle2 size={13} />
                      ) : isActive ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: isDone || isActive ? 600 : 500,
                        color: isError
                          ? 'var(--clay)'
                          : isDone || isActive
                          ? 'var(--ink)'
                          : 'var(--ink-3)',
                      }}
                    >
                      {phase.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 6,
              background: 'var(--surface-2)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${overallPercent}%`,
                background: hasError ? 'var(--clay)' : isComplete ? 'var(--moss)' : 'var(--info)',
                transition: 'width .5s ease, background .3s ease',
              }}
            />
          </div>

          {/* Main status */}
          <div className="col" style={{ gap: 6 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: hasError ? 'var(--clay)' : isComplete ? 'var(--moss)' : 'var(--ink)',
              }}
            >
              {currentPhaseLabel}
            </p>
            <div className="row dim tabular" style={{ gap: 12, fontSize: 11 }}>
              {totalUrls > 0 && (
                <span>
                  Page {Math.min(currentUrlIndex, totalUrls)} of {totalUrls}
                </span>
              )}
              {elementsFound > 0 && <span>{elementsFound} elements found</span>}
              {elapsedSeconds > 0 && <span>{formatElapsed(elapsedSeconds)}</span>}
            </div>

            {hasError && errorMessage && (
              <div
                style={{
                  marginTop: 4,
                  padding: 10,
                  background: 'var(--clay-soft)',
                  border: '1px solid var(--clay-edge)',
                  borderRadius: 6,
                }}
              >
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--clay)' }}>{errorMessage}</p>
                {rawEvents
                  .filter(e => e.status === 'error' && e.details?.suggestions)
                  .map((e, i) => (
                    <ul
                      key={i}
                      style={{
                        marginTop: 6,
                        marginBottom: 0,
                        paddingLeft: 18,
                        fontSize: 11.5,
                        color: 'var(--clay)',
                        lineHeight: 1.6,
                      }}
                    >
                      {e.details.suggestions.map((s: string, j: number) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  ))}
              </div>
            )}
          </div>

          {/* Details toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="row btn-ghost btn-sm"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-3)',
                fontSize: 11.5,
                padding: 0,
                cursor: 'pointer',
                gap: 4,
              }}
            >
              {showDetails ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showDetails ? 'Hide details' : 'Show details'}
            </button>

            {showDetails && rawEvents.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--hair)',
                  borderRadius: 6,
                  padding: 10,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                <div className="col" style={{ gap: 4 }}>
                  {rawEvents.map((event, index) => (
                    <div key={index} className="row" style={{ alignItems: 'flex-start', gap: 6, fontSize: 11 }}>
                      <span
                        style={{
                          flexShrink: 0,
                          width: 6,
                          height: 6,
                          marginTop: 6,
                          borderRadius: 999,
                          background:
                            event.status === 'error'
                              ? 'var(--clay)'
                              : event.status === 'completed'
                              ? 'var(--moss)'
                              : event.status === 'started'
                              ? 'var(--info)'
                              : 'var(--ink-4)',
                        }}
                      />
                      <span className="dim mono" style={{ flexShrink: 0 }}>
                        {new Date(event.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      <span style={{ color: 'var(--ink-2)' }}>{event.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {(isComplete || hasError) && (
          <div className="modal-foot">
            <button
              type="button"
              onClick={onClose}
              className={hasError ? 'btn btn-danger' : 'btn btn-success'}
            >
              {hasError ? 'Close' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
