import { useEffect, useState } from 'react';
import { Check, Copy, Eye, GripVertical } from 'lucide-react';
import { ProjectElement } from '../../types/element.types';
import { ElPreview } from './ElPreview';
import { CSSPreviewRenderer } from './CSSPreviewRenderer';
import { Pill, PillKind } from '../ui/Pill';

interface ElementPreviewCardProps {
  element: ProjectElement;
  onSelectElement: (element: ProjectElement) => void;
  isLiveMode?: boolean;
  onPerformAction?: (action: { type: string; selector: string; value?: string }) => void;
  showQuality?: boolean;
  compact?: boolean;
  /** When true, the card is rendered as "selected" (clear visual state) and
   * scrolls itself to the top of its scroll container so the user notices
   * the selection and can pick the action from the right panel. */
  selected?: boolean;
}

function getPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return url;
  }
}

function confidenceKind(confidence?: string): PillKind {
  if (confidence === 'high' || confidence === 'ok') return 'ok';
  if (confidence === 'med' || confidence === 'medium' || confidence === 'warn') return 'warn';
  if (confidence === 'low' || confidence === 'err') return 'err';
  return 'mute';
}

export function ElementPreviewCard({
  element,
  onSelectElement,
  isLiveMode,
  onPerformAction,
  selected = false,
}: ElementPreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const sourceUrl = element.sourceUrl?.url;
  const attributes = element.attributes as any;
  const confidence = attributes?.confidence || attributes?.score
    ? String(attributes?.confidence || attributes?.score)
    : undefined;

  // Scroll the whole page to the top when an element becomes selected —
  // gives clear feedback that the click registered and brings the test
  // builder's action picker (in the right pane) into view. We deliberately
  // do NOT scroll the element library's inner scroll container; that would
  // hide the just-clicked card.
  useEffect(() => {
    if (!selected) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selected]);

  const handleCopySelector = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(element.selector);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
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

  // Background + border respond to selected first, then hover.
  const cardBackground = selected
    ? 'var(--moss-soft)'
    : hovered
    ? 'var(--surface-2)'
    : 'var(--surface)';
  const cardBorder = selected ? 'var(--moss)' : hovered ? 'var(--ink-3)' : 'var(--hair)';
  const cardShadow = selected ? 'var(--shadow-md)' : 'none';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelectElement(element)}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable
      className="card"
      style={{
        padding: 8,
        display: 'grid',
        gap: 6,
        cursor: 'pointer',
        background: cardBackground,
        borderColor: cardBorder,
        boxShadow: cardShadow,
        transition: 'background .12s ease, border-color .12s ease, box-shadow .15s ease',
      }}
    >
      {/* Row 1: visual preview — real screenshot first, then CSS-rendered
          preview when we have cssInfo (gives the user a faithful look at
          the element), falling back to the design's mini chip otherwise. */}
      {element.screenshot ? (
        <div
          style={{
            background: 'var(--bone)',
            border: '1px solid var(--hair)',
            borderRadius: 6,
            overflow: 'hidden',
            minHeight: 72,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <img
            src={element.screenshot}
            alt={element.description}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            loading="lazy"
          />
        </div>
      ) : attributes?.cssInfo ? (
        <div
          style={{
            background: (() => {
              const bg =
                attributes?.resolvedColors?.backgroundColor ||
                attributes?.cssInfo?.backgroundColor;
              return bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)'
                ? bg
                : 'var(--surface)';
            })(),
            border: '1px solid var(--hair)',
            borderRadius: 6,
            padding: '10px 12px',
            minHeight: 72,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
          }}
        >
          <CSSPreviewRenderer
            element={element}
            mode="compact"
            showQuality={false}
            interactive={false}
          />
        </div>
      ) : (
        <ElPreview type={element.elementType} label={element.description} />
      )}

      {/* Row 2: drag · label/selector · confidence */}
      <div className="row" style={{ gap: 6 }}>
        <span
          className="dim"
          title="Drag to reorder (or click anywhere on the card to select)"
          style={{
            display: 'inline-flex',
            flexShrink: 0,
            cursor: 'grab',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {element.description}
          </div>
          <div
            className="mono dim"
            style={{
              fontSize: 10,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={element.selector}
          >
            {element.selector}
          </div>
        </div>
        {confidence && (
          <Pill kind={confidenceKind(confidence)} dot={false}>
            {confidence}
          </Pill>
        )}
      </div>

      {/* Row 3: page path · spacer · actions */}
      <div className="row" style={{ gap: 4, fontSize: 10.5 }}>
        {sourceUrl && (
          <span
            className="dim mono"
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={sourceUrl}
          >
            {getPathFromUrl(sourceUrl)}
          </span>
        )}
        {!sourceUrl && <span className="spacer" style={{ flex: 1 }} />}

        {isLiveMode && onPerformAction && (
          <>
            <button
              type="button"
              onClick={(e) => handleLiveAction(e, 'click')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 10.5, padding: '2px 6px' }}
            >
              click
            </button>
            <button
              type="button"
              onClick={(e) => handleLiveAction(e, 'hover')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 10.5, padding: '2px 6px' }}
            >
              hover
            </button>
            {element.elementType === 'input' && (
              <button
                type="button"
                onClick={(e) => handleLiveAction(e, 'type')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 10.5, padding: '2px 6px' }}
              >
                type
              </button>
            )}
          </>
        )}

        <button
          type="button"
          onClick={handleCopySelector}
          className="btn btn-ghost btn-icon"
          title={copied ? 'Copied!' : 'Copy selector'}
          style={{ width: 18, height: 18, padding: 0 }}
        >
          {copied ? <Check size={11} style={{ color: 'var(--moss)' }} /> : <Copy size={11} />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectElement(element);
          }}
          className="btn btn-ghost btn-icon"
          title="Inspect"
          style={{ width: 18, height: 18, padding: 0 }}
        >
          <Eye size={11} />
        </button>
      </div>
    </div>
  );
}
