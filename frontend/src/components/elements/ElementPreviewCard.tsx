import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ProjectElement } from '../../types/element.types';
import { CSSPreviewRenderer } from './CSSPreviewRenderer';

interface ElementPreviewCardProps {
  element: ProjectElement;
  onSelectElement: (element: ProjectElement) => void;
  isLiveMode?: boolean;
  onPerformAction?: (action: { type: string; selector: string; value?: string }) => void;
  showQuality?: boolean;
  compact?: boolean;
}

function getPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return url;
  }
}

type Tone = { bg: string; fg: string; edge: string };

function elementTypeTone(type: string): Tone {
  switch (type) {
    case 'button':
      return { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)' };
    case 'input':
    case 'form':
      return { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)' };
    case 'link':
    case 'navigation':
      return { bg: 'var(--slate-soft)', fg: 'var(--slate)', edge: 'var(--slate-edge)' };
    case 'table':
    case 'heading':
      return { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)' };
    case 'image':
      return { bg: 'var(--amber-soft)', fg: 'var(--amber)', edge: 'var(--amber-edge)' };
    default:
      return { bg: 'var(--surface-2)', fg: 'var(--ink-2)', edge: 'var(--hair)' };
  }
}

function discoveryStateMeta(state?: string): { label: string; tone: Tone } | null {
  if (!state || state === 'static') return null;
  const map: Record<string, { label: string; tone: Tone }> = {
    after_login: {
      label: 'After login',
      tone: { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)' },
    },
    login_page: {
      label: 'Login',
      tone: { bg: 'var(--slate-soft)', fg: 'var(--slate)', edge: 'var(--slate-edge)' },
    },
    after_interaction: {
      label: 'Interactive',
      tone: { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)' },
    },
    modal: {
      label: 'Modal',
      tone: { bg: 'var(--slate-soft)', fg: 'var(--slate)', edge: 'var(--slate-edge)' },
    },
    hover: {
      label: 'Hover',
      tone: { bg: 'var(--amber-soft)', fg: 'var(--amber)', edge: 'var(--amber-edge)' },
    },
    tab: {
      label: 'Tab',
      tone: { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)' },
    },
    popup: {
      label: 'Popup',
      tone: { bg: 'var(--clay-soft)', fg: 'var(--clay)', edge: 'var(--clay-edge)' },
    },
  };
  return map[state] ?? null;
}

function locatorTypeMeta(selector: string): { type: string; tone: Tone } | null {
  const moss: Tone = { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)' };
  const info: Tone = { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)' };
  const slate: Tone = { bg: 'var(--slate-soft)', fg: 'var(--slate)', edge: 'var(--slate-edge)' };
  const amber: Tone = { bg: 'var(--amber-soft)', fg: 'var(--amber)', edge: 'var(--amber-edge)' };
  if (selector.startsWith('getByRole(')) return { type: 'Role', tone: moss };
  if (selector.startsWith('getByText(')) return { type: 'Text', tone: info };
  if (selector.startsWith('getByLabel(')) return { type: 'Label', tone: slate };
  if (selector.startsWith('getByTestId(')) return { type: 'TestId', tone: moss };
  if (selector.startsWith('getByPlaceholder(')) return { type: 'Placeholder', tone: amber };
  if (selector.startsWith('getByTitle(')) return { type: 'Title', tone: info };
  return null;
}

function parseNativeLocator(selector: string): { role?: string; name?: string } | null {
  const roleMatch = selector.match(/^getByRole\('([^']+)'(?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?\)/);
  if (roleMatch) return { role: roleMatch[1], name: roleMatch[2] };
  const simpleMatch = selector.match(/^getBy(?:Text|Label|TestId|Placeholder|Title)\('([^']+)'\)/);
  if (simpleMatch) return { name: simpleMatch[1] };
  return null;
}

function pillStyle(tone: Tone): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: '0.02em',
    background: tone.bg,
    color: tone.fg,
    border: `1px solid ${tone.edge}`,
  };
}

export function ElementPreviewCard({
  element,
  onSelectElement,
  isLiveMode,
  onPerformAction,
}: ElementPreviewCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopySelector = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(element.selector);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectElement(element);
    }
  };

  const handleLiveAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    if (!onPerformAction) return;
    const map: Record<string, { type: string; selector: string; value?: string }> = {
      click: { type: 'click', selector: element.selector },
      hover: { type: 'hover', selector: element.selector },
      type: { type: 'type', selector: element.selector, value: 'test input' },
    };
    if (map[action]) onPerformAction(map[action]);
  };

  const attributes = element.attributes as any;
  const sourceUrl = element.sourceUrl?.url;
  const typeTone = elementTypeTone(element.elementType);
  const discoveryMeta = discoveryStateMeta(attributes?.discoveryState);
  const locatorMeta = locatorTypeMeta(element.selector);
  const parsedLocator = locatorMeta ? parseNativeLocator(element.selector) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectElement(element)}
      onKeyDown={handleKeyDown}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color .12s ease, box-shadow .12s ease, transform .1s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--moss)';
        e.currentTarget.style.boxShadow = 'var(--shadow-1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--hair)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Badges */}
      <div className="row" style={{ padding: '10px 12px 0', gap: 6, flexWrap: 'wrap' }}>
        <span style={pillStyle(typeTone)}>{element.elementType}</span>
        {discoveryMeta && <span style={pillStyle(discoveryMeta.tone)}>{discoveryMeta.label}</span>}
        {element.authFlow && (
          <span
            style={pillStyle({
              bg: 'var(--amber-soft)',
              fg: 'var(--amber)',
              edge: 'var(--amber-edge)',
            })}
          >
            {element.authFlow.name}
          </span>
        )}
      </div>

      {/* Description */}
      <div style={{ padding: '6px 12px 0' }}>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--ink)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {element.description}
        </p>
      </div>

      {/* Visual preview — prefer real screenshot, fall back to verdant
          el-preview-* mini chip per element type, then CSS preview as a
          last resort. The mini chip matches the design prototype. */}
      {element.screenshot ? (
        <div style={{ padding: '8px 12px 0' }}>
          <div
            style={{
              background: 'var(--bone)',
              border: '1px solid var(--hair)',
              borderRadius: 4,
              overflow: 'hidden',
              maxHeight: 160,
            }}
          >
            <img
              src={element.screenshot}
              alt={element.description}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              loading="lazy"
            />
          </div>
        </div>
      ) : (() => {
        const t = element.elementType;
        if (t === 'button' || t === 'link' || t === 'input' || t === 'form') {
          const text =
            (attributes?.text as string | undefined)?.trim() ||
            element.description?.split(' ').slice(0, 3).join(' ') ||
            (t === 'input' ? '' : 'Action');
          return (
            <div style={{ padding: '8px 12px 0' }}>
              <div className="el-preview">
                {t === 'button' ? (
                  <span className="el-preview-btn">
                    {text.length > 22 ? text.slice(0, 22) + '…' : text}
                  </span>
                ) : t === 'link' ? (
                  <span className="el-preview-link">
                    {text.length > 28 ? text.slice(0, 28) + '…' : text}
                  </span>
                ) : (
                  <span className="el-preview-input" />
                )}
              </div>
            </div>
          );
        }
        if (element.attributes?.cssInfo) {
          return (
            <div style={{ padding: '8px 12px 0' }}>
              <div
                style={{
                  borderRadius: 4,
                  padding: 6,
                  maxHeight: 128,
                  overflow: 'hidden',
                  border: '1px solid var(--hair)',
                  backgroundColor: (() => {
                    const bg = (element.attributes as any)?.resolvedColors?.backgroundColor
                      || (element.attributes as any)?.cssInfo?.backgroundColor;
                    return bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' ? bg : 'var(--surface-2)';
                  })(),
                }}
              >
                <CSSPreviewRenderer
                  element={element}
                  mode="compact"
                  showQuality={false}
                  interactive={false}
                  className="mx-auto"
                />
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Selector + Copy */}
      <div className="row" style={{ padding: '8px 12px 0', alignItems: 'flex-start', gap: 6 }}>
        {locatorMeta && (
          <span style={{ ...pillStyle(locatorMeta.tone), flexShrink: 0, marginTop: 1 }}>
            {locatorMeta.type}
          </span>
        )}
        <code
          className="mono"
          style={{
            flex: 1,
            background: 'var(--surface-2)',
            border: '1px solid var(--hair)',
            padding: '3px 6px',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--slate)',
            wordBreak: 'break-all',
            lineHeight: 1.45,
          }}
        >
          {parsedLocator
            ? parsedLocator.role
              ? `${parsedLocator.role}${parsedLocator.name ? ` › ${parsedLocator.name}` : ''}`
              : parsedLocator.name || element.selector
            : element.selector}
        </code>
        <button
          type="button"
          onClick={handleCopySelector}
          className="icon-btn"
          title="Copy selector"
          style={{ flexShrink: 0, color: copied ? 'var(--moss)' : 'var(--ink-3)' }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>

      {/* Source URL */}
      {sourceUrl ? (
        <div style={{ padding: '6px 12px 12px' }}>
          <span
            className="mono dim"
            style={{
              fontSize: 10.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {getPathFromUrl(sourceUrl)}
          </span>
        </div>
      ) : (
        <div style={{ paddingBottom: 12 }} />
      )}

      {/* Live mode actions */}
      {isLiveMode && onPerformAction && (
        <div
          className="row"
          style={{
            padding: '8px 12px 12px',
            gap: 4,
            borderTop: '1px solid var(--hair)',
            paddingTop: 8,
          }}
        >
          <button
            type="button"
            onClick={(e) => handleLiveAction(e, 'click')}
            className="btn btn-success btn-sm"
          >
            Click
          </button>
          <button
            type="button"
            onClick={(e) => handleLiveAction(e, 'hover')}
            className="btn btn-outline btn-sm"
            style={{ color: 'var(--amber)', borderColor: 'var(--amber-edge)' }}
          >
            Hover
          </button>
          {element.elementType === 'input' && (
            <button
              type="button"
              onClick={(e) => handleLiveAction(e, 'type')}
              className="btn btn-primary btn-sm"
            >
              Type
            </button>
          )}
        </div>
      )}
    </div>
  );
}
