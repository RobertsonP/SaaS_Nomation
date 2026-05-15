import { useEffect } from 'react';
import { CheckCircle2, Download, FileText, Image as ImageIcon, ListChecks, X, XCircle } from 'lucide-react';
import { TestStep } from '../../types/test.types';

interface ExecutionResult {
  success: boolean;
  result?: string;
  screenshot?: string;
  error?: string;
  timing?: {
    duration: number;
    startTime: string;
    endTime: string;
  };
  elementFound?: boolean;
  logs?: Array<{
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

interface LiveExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: TestStep;
  result: ExecutionResult;
}

export function LiveExecutionModal({ isOpen, onClose, step, result }: LiveExecutionModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTiming = (duration: number) => {
    if (duration < 1000) return `${Math.round(duration)}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const accentBg = result.success ? 'var(--moss-soft)' : 'var(--clay-soft)';
  const accentEdge = result.success ? 'var(--moss-edge)' : 'var(--clay-edge)';
  const accentFg = result.success ? 'var(--moss)' : 'var(--clay)';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div
          className="modal-head"
          style={{ background: accentBg, borderBottomColor: accentEdge }}
        >
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'var(--surface)',
                color: accentFg,
                border: `1px solid ${accentEdge}`,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {result.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            </span>
            <div>
              <div className="modal-title">
                {result.success ? 'Step executed successfully' : 'Step execution failed'}
              </div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                Live execution result for test step.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 16, overflowY: 'auto' }}>
          {/* Step details */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 10 }}>
              <FileText size={14} style={{ color: 'var(--ink-2)' }} />
              <span style={{ fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Step details
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="dim" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Action
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <span
                    className="pill"
                    style={{
                      background: accentBg,
                      color: accentFg,
                      borderColor: accentEdge,
                    }}
                  >
                    {step.type.toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <div className="dim" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Description
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 4 }}>
                  {step.description}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="dim" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Selector
              </div>
              <code
                className="mono"
                style={{
                  display: 'block',
                  marginTop: 4,
                  background: 'var(--surface-2)',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid var(--hair)',
                  fontSize: 11.5,
                  color: 'var(--slate)',
                  wordBreak: 'break-all',
                }}
              >
                {step.selector}
              </code>
            </div>
            {step.value && (
              <div style={{ marginTop: 10 }}>
                <div className="dim" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Value
                </div>
                <div
                  style={{
                    marginTop: 4,
                    background: 'var(--surface-2)',
                    padding: 8,
                    borderRadius: 4,
                    border: '1px solid var(--hair)',
                    fontSize: 12.5,
                    color: 'var(--ink)',
                  }}
                >
                  "{step.value}"
                </div>
              </div>
            )}
          </div>

          {/* Execution results */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 10 }}>
              <ListChecks size={14} style={{ color: 'var(--ink-2)' }} />
              <span style={{ fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Execution results
              </span>
            </div>

            <div className="col" style={{ gap: 10 }}>
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="dim" style={{ fontSize: 12 }}>Status</span>
                <span
                  className="pill"
                  style={{
                    background: accentBg,
                    color: accentFg,
                    borderColor: accentEdge,
                  }}
                >
                  {result.success ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {result.success ? 'Success' : 'Failed'}
                </span>
              </div>

              {result.timing && (
                <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="dim" style={{ fontSize: 12 }}>Duration</span>
                  <span className="mono tabular" style={{ fontSize: 12, color: 'var(--ink)' }}>
                    {formatTiming(result.timing.duration)}
                  </span>
                </div>
              )}

              {result.elementFound !== undefined && (
                <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="dim" style={{ fontSize: 12 }}>Element found</span>
                  <span
                    className="row"
                    style={{
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      color: result.elementFound ? 'var(--moss)' : 'var(--clay)',
                    }}
                  >
                    {result.elementFound ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {result.elementFound ? 'Yes' : 'No'}
                  </span>
                </div>
              )}

              {result.result && (
                <div>
                  <div className="dim" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Result
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      background: 'var(--surface-2)',
                      padding: 8,
                      borderRadius: 4,
                      border: '1px solid var(--hair)',
                      fontSize: 12,
                      color: 'var(--ink)',
                    }}
                  >
                    {result.result}
                  </div>
                </div>
              )}

              {result.error && (
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--clay)' }}>
                    Error
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      background: 'var(--clay-soft)',
                      border: '1px solid var(--clay-edge)',
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 12,
                      color: 'var(--clay)',
                    }}
                  >
                    {result.error}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Screenshot */}
          {result.screenshot && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hair)',
                borderRadius: 8,
                padding: 14,
              }}
            >
              <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 10 }}>
                <ImageIcon size={14} style={{ color: 'var(--ink-2)' }} />
                <span style={{ fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  Screenshot
                </span>
              </div>
              <div
                style={{
                  background: 'var(--bone)',
                  border: '1px solid var(--hair)',
                  borderRadius: 6,
                  padding: 10,
                  textAlign: 'center',
                }}
              >
                <img
                  src={
                    result.screenshot.startsWith('data:image/')
                      ? result.screenshot
                      : `data:image/png;base64,${result.screenshot}`
                  }
                  alt="Step execution screenshot"
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: 4, maxHeight: 500 }}
                />
                <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
                  Screenshot taken after step execution
                </div>
              </div>
            </div>
          )}

          {/* Logs */}
          {result.logs && result.logs.length > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hair)',
                borderRadius: 8,
                padding: 14,
              }}
            >
              <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 10 }}>
                <FileText size={14} style={{ color: 'var(--ink-2)' }} />
                <span style={{ fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  Execution logs
                </span>
              </div>
              <div
                className="mono"
                style={{
                  background: 'var(--ink)',
                  color: '#e6edf3',
                  padding: 10,
                  borderRadius: 6,
                  fontSize: 11,
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                {result.logs.map((log, index) => (
                  <div
                    key={index}
                    className="row"
                    style={{
                      gap: 8,
                      alignItems: 'flex-start',
                      marginBottom: 2,
                      color:
                        log.level === 'error'
                          ? '#fca5a5'
                          : log.level === 'warning'
                          ? '#fbbf24'
                          : '#e6edf3',
                    }}
                  >
                    <span style={{ color: '#7d8590', fontSize: 10 }}>{log.timestamp}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
                      [{log.level}]
                    </span>
                    <span style={{ flex: 1 }}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <span className="dim" style={{ fontSize: 11.5 }}>
            {result.timing && (
              <span>
                Executed at {new Date(result.timing.startTime).toLocaleTimeString()}
              </span>
            )}
          </span>
          <div className="row" style={{ gap: 6 }}>
            {result.screenshot && (
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `step-${step.id}-screenshot.png`;
                  link.href = result.screenshot?.startsWith('data:image/')
                    ? result.screenshot
                    : `data:image/png;base64,${result.screenshot || ''}`;
                  link.click();
                }}
                className="btn btn-ghost"
              >
                <Download size={13} />
                <span>Download screenshot</span>
              </button>
            )}
            <button type="button" onClick={onClose} className="btn btn-primary">
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
