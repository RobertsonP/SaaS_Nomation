import {
  CheckCircle2,
  CheckSquare,
  ChevronsUpDown,
  Clock,
  Eraser,
  Keyboard,
  ListChecks,
  type LucideIcon,
  MousePointerClick,
  Move,
  Navigation,
  PauseCircle,
  Square,
  Type as TypeIcon,
  Upload,
  XCircle,
} from 'lucide-react';

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

type Tone = 'moss' | 'slate' | 'amber' | 'clay' | 'info' | 'mute';

const STEP_META: Record<string, { tone: Tone; Icon: LucideIcon }> = {
  click: { tone: 'info', Icon: MousePointerClick },
  doubleclick: { tone: 'info', Icon: MousePointerClick },
  rightclick: { tone: 'info', Icon: MousePointerClick },
  hover: { tone: 'info', Icon: MousePointerClick },
  type: { tone: 'moss', Icon: TypeIcon },
  clear: { tone: 'moss', Icon: Eraser },
  select: { tone: 'moss', Icon: ChevronsUpDown },
  check: { tone: 'moss', Icon: CheckSquare },
  uncheck: { tone: 'moss', Icon: Square },
  upload: { tone: 'moss', Icon: Upload },
  scroll: { tone: 'amber', Icon: Move },
  press: { tone: 'amber', Icon: Keyboard },
  wait: { tone: 'slate', Icon: Clock },
  assert: { tone: 'moss', Icon: ListChecks },
  navigation: { tone: 'slate', Icon: Navigation },
};

function toneTokens(tone: Tone): { bg: string; fg: string; edge: string } {
  switch (tone) {
    case 'moss':
      return { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)' };
    case 'amber':
      return { bg: 'var(--amber-soft)', fg: 'var(--amber)', edge: 'var(--amber-edge)' };
    case 'clay':
      return { bg: 'var(--clay-soft)', fg: 'var(--clay)', edge: 'var(--clay-edge)' };
    case 'slate':
      return { bg: 'var(--slate-soft)', fg: 'var(--slate)', edge: 'var(--slate-edge)' };
    case 'info':
      return { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)' };
    default:
      return { bg: 'var(--surface-2)', fg: 'var(--ink-2)', edge: 'var(--hair)' };
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

  const meta = STEP_META[result.step] ?? { tone: 'mute' as Tone, Icon: MousePointerClick };
  const stepTone = toneTokens(meta.tone);

  const cardBorder = failed
    ? 'var(--clay)'
    : skipped
    ? 'var(--hair)'
    : 'var(--hair)';
  const cardShadow = failed ? '0 0 0 2px var(--clay-soft)' : 'none';

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${cardBorder}`,
        borderRadius: 8,
        padding: 8,
        boxShadow: cardShadow,
        opacity: skipped ? 0.7 : 1,
      }}
    >
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        {/* Step number */}
        <span
          className="tabular"
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            minWidth: 22,
            height: 20,
            padding: '0 6px',
            borderRadius: 4,
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            fontSize: 11,
            fontWeight: 600,
            border: '1px solid var(--hair)',
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>

        {/* Step type pill */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 7px',
            borderRadius: 999,
            background: stepTone.bg,
            color: stepTone.fg,
            border: `1px solid ${stepTone.edge}`,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          <meta.Icon size={11} />
          {result.step}
        </span>

        {/* Description + selector */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.description || `${result.step} step`}
          </div>
          {(result.selector || result.value) && (
            <div
              className="row"
              style={{ gap: 6, fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}
            >
              {result.selector && (
                <code
                  className="mono"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--slate)',
                  }}
                >
                  {result.selector}
                </code>
              )}
              {result.value && (
                <>
                  <span style={{ color: 'var(--ink-4)' }}>→</span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--ink-2)',
                      fontWeight: 500,
                    }}
                  >
                    {result.value}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status + duration */}
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          {duration && (
            <span className="mono tabular dim" style={{ fontSize: 10.5 }}>
              {duration}
            </span>
          )}
          {failed ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--clay-soft)',
                color: 'var(--clay)',
                border: '1px solid var(--clay-edge)',
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              <XCircle size={11} />
              Failed
            </span>
          ) : skipped ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--surface-2)',
                color: 'var(--ink-3)',
                border: '1px solid var(--hair)',
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              <PauseCircle size={11} />
              Skipped
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--moss-soft)',
                color: 'var(--moss)',
                border: '1px solid var(--moss-edge)',
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              <CheckCircle2 size={11} />
              Passed
            </span>
          )}
        </div>
      </div>

      {/* Error details */}
      {failed && result.error && (
        <div
          style={{
            marginTop: 8,
            marginLeft: 48,
            padding: 8,
            borderRadius: 6,
            background: 'var(--clay-soft)',
            border: '1px solid var(--clay-edge)',
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
                  letterSpacing: '0.04em',
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

      {/* Retry annotation */}
      {result.attempts && result.attempts > 1 && (
        <div
          style={{
            marginTop: 4,
            marginLeft: 48,
            fontSize: 11,
            color: 'var(--amber)',
            fontWeight: 500,
          }}
        >
          Recovered after {result.attempts} attempts
        </div>
      )}
    </div>
  );
}
