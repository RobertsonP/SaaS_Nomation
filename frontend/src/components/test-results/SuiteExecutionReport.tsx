import { useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, XCircle } from 'lucide-react';
import { Pill } from '../ui/Pill';
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

function statusTone(status: string): { bg: string; fg: string; edge: string; Icon: typeof CheckCircle2 } {
  switch (status) {
    case 'passed':
      return { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)', Icon: CheckCircle2 };
    case 'running':
      return { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)', Icon: Loader2 };
    case 'failed':
      return { bg: 'var(--clay-soft)', fg: 'var(--clay)', edge: 'var(--clay-edge)', Icon: XCircle };
    default:
      return { bg: 'var(--surface-2)', fg: 'var(--ink-3)', edge: 'var(--hair)', Icon: CheckCircle2 };
  }
}

export function SuiteExecutionReport({ execution, suiteName }: SuiteExecutionReportProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tests = execution.results?.testResults ?? [];
  const total = tests.length;
  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = total - passed;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const tone = statusTone(execution.status);
  const StatusIcon = tone.Icon;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      {/* Header */}
      <div className="card">
        <div className="card-pad">
          <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'Inter Tight',
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {suiteName}
              </h2>
              <div className="row dim" style={{ gap: 12, marginTop: 4, fontSize: 11.5, flexWrap: 'wrap' }}>
                <span>Started: {formatTime(execution.startedAt)}</span>
                <span>Duration: {formatDuration(execution.duration)}</span>
                <span>
                  Run ID: <code className="mono">{execution.id.slice(0, 8)}…</code>
                </span>
              </div>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: tone.bg,
                color: tone.fg,
                border: `1px solid ${tone.edge}`,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              <StatusIcon size={13} className={execution.status === 'running' ? 'animate-spin' : undefined} />
              {execution.status}
            </span>
          </div>

          {/* Summary tiles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              marginTop: 14,
            }}
          >
            <SummaryTile label="Total tests" value={total} />
            <SummaryTile label="Passed" value={passed} tone="moss" />
            <SummaryTile label="Failed" value={failed} tone="clay" />
            <SummaryTile
              label="Pass rate"
              value={`${passRate}%`}
              tone={passRate === 100 ? 'moss' : passRate > 0 ? 'amber' : 'clay'}
            />
          </div>

          {total > 0 && (
            <div
              style={{
                marginTop: 12,
                width: '100%',
                height: 6,
                background: 'var(--surface-2)',
                borderRadius: 999,
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(passed / total) * 100}%`,
                  background: 'var(--moss)',
                  transition: 'width .3s ease',
                }}
                title={`${passed} passed`}
              />
              <div
                style={{
                  height: '100%',
                  width: `${(failed / total) * 100}%`,
                  background: 'var(--clay)',
                  transition: 'width .3s ease',
                }}
                title={`${failed} failed`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Per-test rows */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Tests</span>
          <span className="dim tabular" style={{ fontSize: 11 }}>
            {total}
          </span>
        </div>
        <div className="card-pad">
          {total === 0 ? (
            <p className="dim" style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic' }}>
              No test results recorded.
            </p>
          ) : (
            <div>
              {tests.map((t) => {
                const open = expanded.has(t.executionId);
                const failedTest = t.status === 'failed';
                return (
                  <div key={t.executionId}>
                    <button
                      type="button"
                      onClick={() => toggle(t.executionId)}
                      className="row"
                      style={{
                        width: '100%',
                        gap: 8,
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--hair)',
                        textAlign: 'left',
                        background: open ? 'var(--surface-2)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        alignItems: 'center',
                      }}
                    >
                      <Pill kind={failedTest ? 'err' : 'ok'} dot={false}>
                        {failedTest ? 'fail' : 'pass'}
                      </Pill>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: 'var(--ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.testName}
                        </div>
                        <div
                          className="dim tabular"
                          style={{
                            fontSize: 11,
                            marginTop: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.stepCount ?? '—'} steps
                          {t.duration ? ` · ${formatDuration(t.duration)}` : ''}
                          {t.failedStep ? ` · failed at: ${t.failedStep}` : ''}
                        </div>
                      </div>
                      <ChevronDown
                        size={14}
                        style={{
                          color: 'var(--ink-3)',
                          flexShrink: 0,
                          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform .15s ease',
                        }}
                      />
                    </button>

                    {open && (
                      <div
                        style={{
                          borderTop: '1px solid var(--hair)',
                          padding: 12,
                          background: 'var(--bone)',
                        }}
                      >
                        {t.execution ? (
                          <TestExecutionReport
                            execution={t.execution}
                            testName={t.testName}
                            showAttachments={false}
                          />
                        ) : (
                          <p
                            className="dim"
                            style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic' }}
                          >
                            Detailed step results not available for this test.
                            {t.errorMsg && (
                              <span style={{ display: 'block', marginTop: 4, color: 'var(--clay)' }}>
                                {t.errorMsg}
                              </span>
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
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'moss' | 'clay' | 'amber';
}) {
  const toneFg = tone === 'moss' ? 'var(--moss)' : tone === 'clay' ? 'var(--clay)' : tone === 'amber' ? 'var(--amber)' : 'var(--ink)';
  const toneBg = tone === 'moss' ? 'var(--moss-soft)' : tone === 'clay' ? 'var(--clay-soft)' : tone === 'amber' ? 'var(--amber-soft)' : 'var(--surface-2)';
  const toneEdge = tone === 'moss' ? 'var(--moss-edge)' : tone === 'clay' ? 'var(--clay-edge)' : tone === 'amber' ? 'var(--amber-edge)' : 'var(--hair)';
  return (
    <div
      style={{
        background: toneBg,
        border: `1px solid ${toneEdge}`,
        borderRadius: 6,
        padding: '10px 12px',
      }}
    >
      <div
        className="dim"
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: tone ? toneFg : 'var(--ink-3)',
        }}
      >
        {label}
      </div>
      <div
        className="tabular"
        style={{
          fontFamily: 'Inter Tight',
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: toneFg,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
