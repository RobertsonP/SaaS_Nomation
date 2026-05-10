import { useState } from 'react';
import { Check, Copy, Eye, GripVertical } from 'lucide-react';
import { ProjectElement } from '../../types/element.types';
import { ElPreview } from './ElPreview';
import { Pill, PillKind } from '../ui/Pill';

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
}: ElementPreviewCardProps) {
  const [copied, setCopied] = useState(false);

  const sourceUrl = element.sourceUrl?.url;
  const attributes = element.attributes as any;
  const confidence = attributes?.confidence || attributes?.score
    ? String(attributes?.confidence || attributes?.score)
    : undefined;

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectElement(element)}
      onKeyDown={handleKeyDown}
      draggable
      className="card"
      style={{
        padding: 8,
        display: 'grid',
        gap: 6,
        cursor: 'grab',
      }}
    >
      {/* Row 1: visual chip */}
      <ElPreview type={element.elementType} label={element.description} />

      {/* Row 2: drag · label/selector · confidence */}
      <div className="row" style={{ gap: 6 }}>
        <span className="dim" style={{ display: 'inline-flex', flexShrink: 0 }}>
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
