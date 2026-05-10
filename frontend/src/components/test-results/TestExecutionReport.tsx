import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Image as ImageIcon, Loader2, Video, XCircle } from 'lucide-react';
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

function statusToneClass(status: string): { bg: string; fg: string; edge: string; Icon: typeof CheckCircle2 } {
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

export function TestExecutionReport({ execution, testName, showAttachments = true }: TestExecutionReportProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);

  const results = execution.results ?? [];
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const total = results.length;

  const failedIndex = results.findIndex((r) => r.status === 'failed');
  const failureScreenshot = (() => {
    if (failedIndex < 0 || !execution.screenshots || execution.screenshots.length === 0) return undefined;
    const last = execution.screenshots[execution.screenshots.length - 1];
    return last.startsWith('data:') ? last : `data:image/png;base64,${last}`;
  })();

  const tone = statusToneClass(execution.status);
  const StatusIcon = tone.Icon;

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
                {testName}
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
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginTop: 14,
            }}
          >
            <SummaryTile label="Total steps" value={total} />
            <SummaryTile label="Passed" value={passed} tone="moss" />
            <SummaryTile label="Failed" value={failed} tone="clay" />
          </div>

          {execution.errorMsg && (
            <div
              style={{
                marginTop: 14,
                padding: 10,
                background: 'var(--clay-soft)',
                border: '1px solid var(--clay-edge)',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--clay)',
                  marginBottom: 4,
                }}
              >
                Run-level error
              </div>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: 'var(--clay)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {execution.errorMsg}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Steps</span>
          <span className="dim tabular" style={{ fontSize: 11 }}>
            {total}
          </span>
        </div>
        <div className="card-pad">
          {total === 0 ? (
            <p className="dim" style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic' }}>
              No step results recorded.
            </p>
          ) : (
            <div className="col" style={{ gap: 6 }}>
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
      </div>

      {/* Attachments */}
      {showAttachments && (execution.videoPath || (execution.screenshots && execution.screenshots.length > 0)) && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Attachments</span>
          </div>
          <div className="card-pad col" style={{ gap: 14 }}>
            {execution.videoPath && (
              <div>
                <div
                  className="row dim"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 6,
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <Video size={11} />
                  Recording
                </div>
                <video
                  src={(() => {
                    const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3002';
                    const t = localStorage.getItem('auth_token');
                    const q = t ? `?token=${encodeURIComponent(t)}` : '';
                    return `${apiUrl}/api/execution/${execution.id}/video${q}`;
                  })()}
                  controls
                  style={{
                    width: '100%',
                    maxWidth: 768,
                    borderRadius: 6,
                    border: '1px solid var(--hair)',
                    background: 'var(--bone)',
                  }}
                />
              </div>
            )}

            {execution.screenshots && execution.screenshots.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setGalleryOpen((o) => !o)}
                  className="btn btn-ghost btn-sm"
                  style={{ paddingLeft: 0 }}
                >
                  {galleryOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  <ImageIcon size={12} />
                  <span>
                    {galleryOpen ? 'Hide' : 'Show'} screenshots ({execution.screenshots.length})
                  </span>
                </button>
                {galleryOpen && (
                  <div
                    style={{
                      marginTop: 10,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {execution.screenshots.map((shot, i) => (
                      <a
                        key={i}
                        href={shot.startsWith('data:') ? shot : `data:image/png;base64,${shot}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          borderRadius: 4,
                          overflow: 'hidden',
                          border: '1px solid var(--hair)',
                          transition: 'border-color .12s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--moss)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--hair)';
                        }}
                      >
                        <img
                          src={shot.startsWith('data:') ? shot : `data:image/png;base64,${shot}`}
                          alt={`Screenshot ${i + 1}`}
                          style={{ width: '100%', height: 96, objectFit: 'cover', objectPosition: 'top' }}
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'moss' | 'clay';
}) {
  const fg = tone === 'moss' ? 'var(--moss)' : tone === 'clay' ? 'var(--clay)' : 'var(--ink)';
  const bg = tone === 'moss' ? 'var(--moss-soft)' : tone === 'clay' ? 'var(--clay-soft)' : 'var(--surface-2)';
  const edge = tone === 'moss' ? 'var(--moss-edge)' : tone === 'clay' ? 'var(--clay-edge)' : 'var(--hair)';
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${edge}`,
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
          color: tone ? fg : 'var(--ink-3)',
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
          color: fg,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
