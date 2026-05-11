import { useState } from 'react';
import { Check, ChevronsUpDown, CheckCheck, Copy, ExternalLink, Plus } from 'lucide-react';
import { ProjectElement } from '../../types/element.types';
import { CellStepData } from './CellSelectorPopover';
import { DropdownExplorerModal } from './DropdownExplorerModal';

interface DropdownOption {
  value: string;
  text: string;
  selected: boolean;
  selector: string;
  index: number;
  cssPreview?: { color: string; backgroundColor: string; fontSize: string };
}

interface DropdownPreviewCardProps {
  element: ProjectElement;
  onSelectElement: (element: ProjectElement) => void;
  onAddStep?: (step: CellStepData) => void;
}

export function DropdownPreviewCard({ element, onSelectElement, onAddStep }: DropdownPreviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null);

  const dropdownData = element.dropdownData || (element.attributes as any)?.dropdownData;
  if (!dropdownData || !dropdownData.options?.length) return null;

  const { options, triggerSelector, isNative, optionCount } = dropdownData;
  const displayOptions = options.slice(0, expanded ? 50 : 5);

  const handleCopy = async (e: React.MouseEvent, selector: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(selector);
      setCopiedSelector(selector);
      setTimeout(() => setCopiedSelector(null), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleCopyAssertion = async (e: React.MouseEvent, option: DropdownOption) => {
    e.stopPropagation();
    const assertion = `await expect(page.locator('${option.selector}')).toHaveText('${option.text.replace(/'/g, "\\'")}');`;
    try {
      await navigator.clipboard.writeText(assertion);
      setCopiedSelector(`assert-${option.index}`);
      setTimeout(() => setCopiedSelector(null), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectElement(element);
    }
  };

  return (
    <>
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
        transition: 'border-color .12s ease, box-shadow .12s ease',
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
      {/* Header */}
      <div
        className="row"
        style={{
          padding: '8px 12px',
          background: 'var(--slate-soft)',
          borderBottom: '1px solid var(--slate-edge)',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <ChevronsUpDown size={14} style={{ color: 'var(--slate)', flexShrink: 0 }} />
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--ink)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {element.description || 'Dropdown'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowExplorer(true);
          }}
          className="btn btn-outline btn-sm"
          style={{
            color: 'var(--slate)',
            borderColor: 'var(--slate-edge)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
          title="Open the dropdown explorer to browse and act on every option"
        >
          <ExternalLink size={11} />
          <span>Open explorer</span>
        </button>
        <span
          className="tabular"
          style={{
            padding: '1px 7px',
            borderRadius: 999,
            background: 'var(--surface)',
            border: '1px solid var(--slate-edge)',
            color: 'var(--slate)',
            fontSize: 10.5,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {optionCount} option{optionCount !== 1 ? 's' : ''}
        </span>
        <span
          style={{
            padding: '1px 7px',
            borderRadius: 999,
            background: 'var(--surface-2)',
            border: '1px solid var(--hair)',
            color: 'var(--ink-3)',
            fontSize: 10.5,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {isNative ? 'native' : 'custom'}
        </span>
      </div>

      {/* Trigger selector */}
      {triggerSelector && (
        <div
          className="row"
          style={{
            padding: '6px 12px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--hair)',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span className="dim" style={{ fontSize: 11, flexShrink: 0 }}>
            Select:
          </span>
          <code
            className="mono"
            onClick={(e) => handleCopy(e, triggerSelector)}
            title="Click to copy"
            style={{
              fontSize: 11,
              color: 'var(--slate)',
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              padding: '2px 6px',
              borderRadius: 4,
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {copiedSelector === triggerSelector ? 'Copied!' : triggerSelector}
          </code>
        </div>
      )}

      {/* Options list */}
      <div onClick={(e) => e.stopPropagation()}>
        {displayOptions.map((option: DropdownOption) => (
          <div
            key={option.index}
            className="row dropdown-option-row"
            style={{
              padding: '6px 12px',
              gap: 8,
              alignItems: 'center',
              borderBottom: '1px solid var(--hair)',
              transition: 'background .12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span
              className="tabular dim"
              style={{
                fontSize: 10.5,
                width: 20,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {option.index + 1}
            </span>

            {option.cssPreview?.backgroundColor && option.cssPreview.backgroundColor !== 'rgba(0, 0, 0, 0)' && (
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  border: '1px solid var(--hair)',
                  flexShrink: 0,
                  backgroundColor: option.cssPreview.backgroundColor,
                }}
              />
            )}

            <span
              style={{
                fontSize: 11.5,
                color: 'var(--ink-2)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {option.text || <span style={{ fontStyle: 'italic', color: 'var(--ink-4)' }}>(empty)</span>}
            </span>

            {option.value && option.value !== option.text && (
              <span
                className="mono dim"
                title={option.value}
                style={{
                  fontSize: 10,
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                ={option.value}
              </span>
            )}

            {option.selected && (
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--moss)',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                selected
              </span>
            )}

            <div className="row" style={{ gap: 2, flexShrink: 0 }}>
              {onAddStep && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddStep({
                      type: 'select',
                      selector: triggerSelector || option.selector,
                      value: option.value || option.text,
                      description: `Select "${option.text}" from dropdown`,
                    });
                  }}
                  title={`Add step: Select "${option.text}"`}
                  style={{ width: 20, height: 20, color: 'var(--moss)' }}
                >
                  <Plus size={10} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                onClick={(e) => handleCopy(e, option.selector)}
                title={`Copy: ${option.selector}`}
                style={{
                  width: 20,
                  height: 20,
                  color: copiedSelector === option.selector ? 'var(--moss)' : 'var(--ink-3)',
                }}
              >
                {copiedSelector === option.selector ? <Check size={10} /> : <Copy size={10} />}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={(e) => handleCopyAssertion(e, option)}
                title="Copy assertion"
                style={{
                  width: 20,
                  height: 20,
                  color: copiedSelector === `assert-${option.index}` ? 'var(--moss)' : 'var(--ink-3)',
                }}
              >
                {copiedSelector === `assert-${option.index}` ? <Check size={10} /> : <CheckCheck size={10} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {options.length > 5 && (
        <button
          type="button"
          onClick={handleToggleExpand}
          style={{
            width: '100%',
            padding: '6px 12px',
            fontSize: 11,
            color: 'var(--ink-3)',
            background: 'var(--surface-2)',
            border: 'none',
            cursor: 'pointer',
            transition: 'background .12s ease, color .12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--ink)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-2)';
            e.currentTarget.style.color = 'var(--ink-3)';
          }}
        >
          {expanded ? 'Show less' : `Show ${Math.min(options.length, 50) - 5} more options`}
        </button>
      )}
    </div>

    <DropdownExplorerModal
      open={showExplorer}
      dropdownData={dropdownData}
      onClose={() => setShowExplorer(false)}
      onAddStep={onAddStep}
      title={element.description || 'Dropdown options'}
    />
    </>
  );
}
