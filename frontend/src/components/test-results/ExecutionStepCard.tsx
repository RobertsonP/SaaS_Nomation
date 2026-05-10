import { Pill, PillKind } from '../ui/Pill';

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

function statusKind(status: string): PillKind {
  if (status === 'passed') return 'ok';
  if (status === 'failed') return 'err';
  return 'mute';
}

function statusLabel(status: string): string {
  if (status === 'passed') return 'pass';
  if (status === 'failed') return 'fail';
  if (status === 'skipped') return 'skip';
  return status;
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
    <div>
      {/* Canonical step row — matches pages.jsx:212–220 / :274–279 */}
      <div
        className="row"
        style={{
          padding: '8px 12px',
          borderBottom: failed && result.error ? 'none' : '1px solid var(--hair)',
          gap: 8,
          opacity: skipped ? 0.7 : 1,
        }}
      >
        <span
          className="mono dim"
          style={{ width: 18, fontSize: 10.5, flexShrink: 0 }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <Pill kind={statusKind(result.status)} dot={false}>
          {statusLabel(result.status)}
        </Pill>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: 'var(--ink)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={result.description || `${result.step} step`}
        >
          {result.description || `${result.step} step`}
        </span>
        {result.selector && (
          <span
            className="mono dim"
            style={{
              fontSize: 10.5,
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title={result.selector}
          >
            {result.selector}
          </span>
        )}
        {duration && (
          <span className="mono dim" style={{ fontSize: 10.5, flexShrink: 0 }}>
            {duration}
          </span>
        )}
      </div>

      {/* Error pane — matches the prototype's failure card style for inline rows */}
      {failed && result.error && (
        <div
          style={{
            marginLeft: 30,
            marginRight: 12,
            marginBottom: 8,
            padding: 10,
            background: 'var(--clay-soft)',
            border: '1px solid var(--clay-edge)',
            borderRadius: 6,
            borderTop: 'none',
          }}
        >
          <div
            className="dim"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--clay)',
              marginBottom: 4,
            }}
          >
            Error
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
            {result.error}
          </pre>
          {failureScreenshot && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--clay)',
                  marginBottom: 4,
                }}
              >
                Screenshot at failure
              </div>
              <img
                src={failureScreenshot}
                alt="Failure"
                style={{
                  maxWidth: '100%',
                  borderRadius: 4,
                  border: '1px solid var(--clay-edge)',
                }}
              />
            </div>
          )}
        </div>
      )}

      {result.attempts && result.attempts > 1 && (
        <div
          style={{
            marginLeft: 30,
            fontSize: 11,
            color: 'var(--amber)',
            fontWeight: 500,
            paddingBottom: 4,
          }}
        >
          Recovered after {result.attempts} attempts
        </div>
      )}
    </div>
  );
}
