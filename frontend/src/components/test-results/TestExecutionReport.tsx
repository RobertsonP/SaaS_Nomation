import { useState } from 'react';
import { ChevronDown, ChevronUp, Image as ImageIcon, Target, Video, Zap } from 'lucide-react';
import { Pill, PillKind } from '../ui/Pill';
import { StatTile } from '../ui/StatTile';
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
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function statusKind(status: string): PillKind {
  if (status === 'passed') return 'ok';
  if (status === 'failed') return 'err';
  if (status === 'running') return 'info';
  return 'mute';
}

export function TestExecutionReport({
  execution,
  testName,
  showAttachments = true,
}: TestExecutionReportProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);

  const results = execution.results ?? [];
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const total = results.length;

  const failedIndex = results.findIndex((r) => r.status === 'failed');
  const failedStep = failedIndex >= 0 ? results[failedIndex] : null;

  // Failure screenshot — last entry of execution.screenshots when a step failed.
  const failureScreenshot = (() => {
    if (failedIndex < 0 || !execution.screenshots || execution.screenshots.length === 0) {
      return undefined;
    }
    const last = execution.screenshots[execution.screenshots.length - 1];
    return last.startsWith('data:') ? last : `data:image/png;base64,${last}`;
  })();

  const isFailed = execution.status === 'failed';
  const isPassed = execution.status === 'passed';
  const isRunning = execution.status === 'running';

  // Stat tiles — Status / Duration / Steps Passed / Steps Failed.
  // Network and Console placeholders aren't backend-supplied today.
  const statusValue = isPassed
    ? 'Passed'
    : isFailed
    ? 'Failed'
    : isRunning
    ? 'Running'
    : execution.status;

  return (
    <div className="col" style={{ gap: 12 }}>
      {/* 4-tile row matching pages.jsx:247–251 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}
      >
        <StatTile
          label="Status"
          value={statusValue}
          sub={
            isFailed && failedIndex >= 0
              ? `step ${failedIndex + 1} of ${total}`
              : isPassed
              ? `${total} steps`
              : undefined
          }
        />
        <StatTile
          label="Duration"
          value={formatDuration(execution.duration)}
          sub={total > 0 ? `${total} step${total === 1 ? '' : 's'}` : undefined}
        />
        <StatTile
          label="Passed"
          value={passed}
          sub={total > 0 ? `${Math.round((passed / total) * 100)}% of run` : undefined}
        />
        <StatTile
          label="Failed"
          value={failed}
          sub={failed > 0 ? 'check the failure card' : 'none'}
        />
      </div>

      {/* Two-column body: Failure (or Attachments) on the left, All steps on the right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: total > 0 ? '1fr 1fr' : '1fr',
          gap: 12,
        }}
      >
        {/* Left column — Failure card when failed; otherwise Attachments card. */}
        {isFailed && failedStep ? (
          <div className="card">
            <div className="card-head">
              <span className="card-title">Failure</span>
              <Pill kind="err" dot={false}>
                step {failedIndex + 1}
              </Pill>
            </div>
            <div className="card-pad">
              {failureScreenshot ? (
                <div
                  style={{
                    background: 'var(--bone)',
                    border: '1px solid var(--hair)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    height: 200,
                    marginBottom: 10,
                  }}
                >
                  <img
                    src={failureScreenshot}
                    alt="Failure screenshot"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                  />
                </div>
              ) : (
                <div
                  className="dim"
                  style={{
                    height: 200,
                    marginBottom: 10,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                    borderRadius: 6,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                  }}
                >
                  No screenshot captured
                </div>
              )}
              <div
                className="code"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--hair)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--ink-2)',
                }}
              >
                <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>
                  {/* description */}// {failedStep.description || `${failedStep.step} step`}
                </span>
                {'\n'}
                <span style={{ color: 'var(--clay)' }}>
                  Error: {failedStep.error || execution.errorMsg || 'Unknown error'}
                </span>
                {failedStep.selector && (
                  <>
                    {'\n'}
                    <span style={{ color: 'var(--ink-4)' }}>→ selector: {failedStep.selector}</span>
                  </>
                )}
                {failedStep.value && (
                  <>
                    {'\n'}
                    <span style={{ color: 'var(--ink-4)' }}>→ value: {failedStep.value}</span>
                  </>
                )}
              </div>
              <div className="row" style={{ marginTop: 10, gap: 6 }}>
                <button type="button" className="btn btn-outline btn-sm">
                  <Target size={12} />
                  <span>Re-pick element</span>
                </button>
                <button type="button" className="btn btn-outline btn-sm">
                  <Zap size={12} />
                  <span>Suggest alt selectors</span>
                </button>
              </div>
            </div>
          </div>
        ) : showAttachments && (execution.videoPath || (execution.screenshots && execution.screenshots.length > 0)) ? (
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
                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
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
                          }}
                        >
                          <img
                            src={shot.startsWith('data:') ? shot : `data:image/png;base64,${shot}`}
                            alt={`Screenshot ${i + 1}`}
                            style={{ width: '100%', height: 80, objectFit: 'cover', objectPosition: 'top' }}
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
        ) : null}

        {/* Right column — All steps */}
        {total > 0 && (
          <div className="card">
            <div className="card-head">
              <span className="card-title">All steps</span>
              <span className="dim tabular" style={{ fontSize: 11 }}>
                {total}
              </span>
            </div>
            <div>
              {results.map((r, i) => (
                <ExecutionStepCard
                  key={i}
                  index={i}
                  result={r}
                  failureScreenshot={i === failedIndex ? failureScreenshot : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {execution.errorMsg && !isFailed && (
        <div
          style={{
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

      <div className="row dim" style={{ gap: 12, fontSize: 11.5, flexWrap: 'wrap' }}>
        <span>
          Test: <strong style={{ color: 'var(--ink-2)' }}>{testName}</strong>
        </span>
        <span>·</span>
        <span>
          Run ID: <code className="mono">{execution.id.slice(0, 8)}…</code>
        </span>
        <span>·</span>
        <span>Started: {new Date(execution.startedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}
