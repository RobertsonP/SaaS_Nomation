import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Lock, CheckCircle2, AlertCircle, Globe, ExternalLink } from 'lucide-react';

interface SiteMapNodeDataPayload {
  url: string;
  title: string;
  analyzed: boolean;
  verified: boolean;
  requiresAuth: boolean;
  pageType?: string;
  discovered: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  screenshot?: string;
}

interface SiteMapNodeProps {
  id: string;
  data: SiteMapNodeDataPayload;
}

type Tone = { bg: string; fg: string; edge: string };

function statusTone(d: SiteMapNodeDataPayload): Tone {
  if (d.requiresAuth) {
    return { bg: 'var(--amber-soft)', fg: 'var(--amber)', edge: 'var(--amber-edge)' };
  }
  if (d.analyzed && d.verified) {
    return { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)' };
  }
  if (d.analyzed) {
    return { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)' };
  }
  if (!d.discovered) {
    return { bg: 'var(--surface)', fg: 'var(--ink-3)', edge: 'var(--hair)' };
  }
  return { bg: 'var(--surface-2)', fg: 'var(--ink-3)', edge: 'var(--hair)' };
}

function pageTypeTone(pageType?: string): Tone {
  switch (pageType) {
    case 'home':
      return { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)' };
    case 'product':
    case 'category':
      return { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)' };
    case 'cart':
    case 'account':
      return { bg: 'var(--amber-soft)', fg: 'var(--amber)', edge: 'var(--amber-edge)' };
    case 'checkout':
      return { bg: 'var(--clay-soft)', fg: 'var(--clay)', edge: 'var(--clay-edge)' };
    case 'form':
      return { bg: 'var(--slate-soft)', fg: 'var(--slate)', edge: 'var(--slate-edge)' };
    default:
      return { bg: 'var(--surface-2)', fg: 'var(--ink-3)', edge: 'var(--hair)' };
  }
}

function pillStyle(tone: Tone): React.CSSProperties {
  return {
    padding: '1px 6px',
    borderRadius: 999,
    fontSize: 9.5,
    fontWeight: 600,
    letterSpacing: '0.02em',
    background: tone.bg,
    color: tone.fg,
    border: `1px solid ${tone.edge}`,
  };
}

function SiteMapNode({ id, data }: SiteMapNodeProps) {
  const { title, url, analyzed, verified, requiresAuth, pageType, discovered, selected, onSelect, screenshot } = data;
  const tone = statusTone(data);

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const StatusIcon = requiresAuth ? Lock : verified ? CheckCircle2 : analyzed ? AlertCircle : Globe;

  const displayUrl = (() => {
    try {
      const parsed = new URL(url);
      return parsed.pathname || '/';
    } catch {
      return url;
    }
  })();

  const dashed = !analyzed && discovered;

  return (
    <div
      onClick={() => onSelect?.(id)}
      style={{
        background: tone.bg,
        border: `2px ${dashed ? 'dashed' : 'solid'} ${tone.edge}`,
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 200,
        maxWidth: 280,
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 2px var(--moss)' : 'var(--shadow-1)',
        transition: 'box-shadow .15s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 8, height: 8, background: 'var(--ink-4)', border: 'none' }}
      />

      {/* Header */}
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div className="row" style={{ alignItems: 'center', gap: 6, minWidth: 0 }}>
          <StatusIcon size={13} style={{ color: tone.fg, flexShrink: 0 }} />
          <button
            type="button"
            onClick={handleOpenUrl}
            title={`Open ${url} in new tab`}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--ink)',
              maxWidth: 130,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 110,
              }}
            >
              {title || 'Untitled'}
            </span>
            <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.5 }} />
          </button>
        </div>
        {selected && (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: 'var(--moss)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={10} style={{ color: '#fff' }} />
          </span>
        )}
      </div>

      {/* URL */}
      <div
        className="mono dim"
        style={{
          fontSize: 11,
          marginBottom: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayUrl}
      </div>

      {/* Footer badges */}
      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
        {pageType && <span style={pillStyle(pageTypeTone(pageType))}>{pageType}</span>}
        {requiresAuth && (
          <span
            style={pillStyle({
              bg: 'var(--amber-soft)',
              fg: 'var(--amber)',
              edge: 'var(--amber-edge)',
            })}
          >
            Auth
          </span>
        )}
        {discovered && (
          <span
            style={pillStyle({
              bg: 'var(--info-soft)',
              fg: 'var(--info)',
              edge: 'var(--info-edge)',
            })}
          >
            Auto
          </span>
        )}
      </div>

      {/* Screenshot */}
      {screenshot && (
        <div
          style={{
            marginTop: 8,
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid var(--hair)',
            background: 'var(--surface-2)',
          }}
        >
          <img
            src={screenshot}
            alt={`Preview of ${title}`}
            style={{ width: '100%', height: 64, objectFit: 'cover', objectPosition: 'top' }}
            loading="lazy"
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ width: 8, height: 8, background: 'var(--ink-4)', border: 'none' }}
      />
    </div>
  );
}

export default memo(SiteMapNode);
