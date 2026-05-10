import { useEffect, useState } from 'react';
import { Check, Copy, Pencil, RefreshCw, X } from 'lucide-react';
import { Pill, PillKind } from '../ui/Pill';
import { ProjectElement } from '../../types/element.types';
import { CSSPreviewRenderer } from './CSSPreviewRenderer';

interface UsedInTest {
  id: string;
  name: string;
  status?: 'ok' | 'fail' | 'flake' | 'skip' | string;
}

interface ElementInspectDrawerProps {
  element: ProjectElement | null;
  onClose: () => void;
  usedInTests?: UsedInTest[];
  onSuggestAlternates?: () => void;
  onEditSelector?: () => void;
}

function getPathFromUrl(url?: string): string {
  if (!url) return '—';
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

function confidenceKind(confidence?: string): PillKind {
  if (!confidence) return 'mute';
  const c = confidence.toLowerCase();
  if (c === 'high' || c === 'ok') return 'ok';
  if (c === 'med' || c === 'medium' || c === 'warn') return 'warn';
  if (c === 'low' || c === 'err') return 'err';
  return 'mute';
}

function testStatusKind(status?: string): PillKind {
  if (status === 'ok' || status === 'passed') return 'ok';
  if (status === 'fail' || status === 'failed') return 'err';
  if (status === 'flake' || status === 'warn') return 'warn';
  return 'mute';
}

/**
 * Mirrors `modals.jsx:193–226` — right-slide drawer that opens when the user
 * clicks an element row in the project Elements tab. Shows the element's
 * preview, selector, type/page/confidence row, and a "Used in" list of tests.
 */
export function ElementInspectDrawer({
  element,
  onClose,
  usedInTests,
  onSuggestAlternates,
  onEditSelector,
}: ElementInspectDrawerProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!element) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [element, onClose]);

  if (!element) return null;

  const attributes = element.attributes as any;
  const confidence = attributes?.confidence ? String(attributes.confidence) : undefined;
  const sourceUrl = element.sourceUrl?.url;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(element.selector);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 560,
          maxWidth: '95vw',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div
              className="dim"
              style={{
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Element
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={element.description}
            >
              {element.description}
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 14, overflowY: 'auto', flex: 1 }}>
          {/* Visual preview */}
          {element.screenshot ? (
            <div
              style={{
                background: 'var(--bone)',
                border: '1px solid var(--hair)',
                borderRadius: 6,
                overflow: 'hidden',
                maxHeight: 220,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <img
                src={element.screenshot}
                alt={element.description}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              />
            </div>
          ) : element.attributes?.cssInfo ? (
            <div
              style={{
                background: (() => {
                  const bg = (element.attributes as any)?.resolvedColors?.backgroundColor
                    || (element.attributes as any)?.cssInfo?.backgroundColor;
                  return bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' ? bg : 'var(--surface-2)';
                })(),
                border: '1px solid var(--hair)',
                borderRadius: 6,
                padding: 16,
                display: 'grid',
                placeItems: 'center',
                minHeight: 120,
              }}
            >
              <CSSPreviewRenderer
                element={element}
                mode="detailed"
                showQuality={false}
                interactive={false}
              />
            </div>
          ) : (
            <div
              className="dim"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--hair)',
                borderRadius: 6,
                padding: 24,
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              No preview available
            </div>
          )}

          {/* Selector card */}
          <div className="card card-pad">
            <div
              className="dim"
              style={{
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
              }}
            >
              Selector
            </div>
            <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
              <code
                className="mono"
                style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--hair)',
                  borderRadius: 4,
                  padding: '6px 8px',
                  fontSize: 11.5,
                  color: 'var(--ink-2)',
                  wordBreak: 'break-all',
                }}
              >
                {element.selector}
              </code>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy selector'}
              >
                {copied ? <Check size={12} style={{ color: 'var(--moss)' }} /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Type / Page / Confidence */}
          <div className="row" style={{ gap: 16, fontSize: 12 }}>
            <div>
              <div
                className="dim"
                style={{
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 2,
                }}
              >
                Type
              </div>
              <div style={{ color: 'var(--ink)' }}>{element.elementType}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                className="dim"
                style={{
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 2,
                }}
              >
                Page
              </div>
              <div
                className="mono"
                style={{
                  color: 'var(--ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 260,
                }}
                title={sourceUrl}
              >
                {getPathFromUrl(sourceUrl)}
              </div>
            </div>
            {confidence && (
              <div>
                <div
                  className="dim"
                  style={{
                    fontSize: 10.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 2,
                  }}
                >
                  Confidence
                </div>
                <Pill kind={confidenceKind(confidence)} dot={false}>
                  {confidence}
                </Pill>
              </div>
            )}
          </div>

          {/* Used in */}
          {usedInTests && usedInTests.length > 0 && (
            <div className="card">
              <div className="card-head">
                <span className="card-title">Used in</span>
                <Pill kind="mute" dot={false}>
                  {usedInTests.length} {usedInTests.length === 1 ? 'test' : 'tests'}
                </Pill>
              </div>
              <div>
                {usedInTests.map((t) => (
                  <div
                    key={t.id}
                    className="row"
                    style={{ padding: '8px 12px', borderBottom: '1px solid var(--hair)' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.name}
                      </div>
                      <div className="dim mono" style={{ fontSize: 10.5 }}>
                        {t.id}
                      </div>
                    </div>
                    {t.status && (
                      <Pill kind={testStatusKind(t.status)} dot={false}>
                        {t.status}
                      </Pill>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {onSuggestAlternates && (
            <button type="button" className="btn btn-outline" onClick={onSuggestAlternates}>
              <RefreshCw size={12} />
              <span>Suggest alternates</span>
            </button>
          )}
          {onEditSelector && (
            <button type="button" className="btn btn-primary" onClick={onEditSelector}>
              <Pencil size={12} />
              <span>Edit selector</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
