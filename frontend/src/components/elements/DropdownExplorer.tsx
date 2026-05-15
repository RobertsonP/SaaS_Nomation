import { useRef, useState } from 'react';
import { Check, ChevronsUpDown, Copy } from 'lucide-react';
import { Pill } from '../ui/Pill';
import { CellStepData } from './CellSelectorPopover';
import { OptionSelectorPopover } from './OptionSelectorPopover';

interface DropdownOption {
  value: string;
  text: string;
  selected: boolean;
  selector: string;
  index: number;
  cssPreview?: { color: string; backgroundColor: string; fontSize: string };
}

interface DropdownData {
  triggerSelector: string;
  isNative: boolean;
  optionCount: number;
  options: DropdownOption[];
}

interface DropdownExplorerProps {
  dropdownData: DropdownData;
  onAddStep?: (step: CellStepData) => void;
  onClose: () => void;
}

/**
 * Detailed dropdown options view, modelled on TableExplorer. Renders the
 * full option list with a click target on each row that:
 *   1. Auto-adds a "Select option" step
 *   2. Opens a popover anchored next to the row offering Click / Assert
 *      value / Assert visible alternatives + Playwright code snippets.
 */
export function DropdownExplorer({ dropdownData, onAddStep, onClose }: DropdownExplorerProps) {
  const { triggerSelector, isNative, options } = dropdownData;
  const [copiedTrigger, setCopiedTrigger] = useState(false);
  const [activeOption, setActiveOption] = useState<{
    option: DropdownOption;
    position: { top: number; left: number };
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleCopyTrigger = async () => {
    try {
      await navigator.clipboard.writeText(triggerSelector);
      setCopiedTrigger(true);
      setTimeout(() => setCopiedTrigger(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleOptionClick = (e: React.MouseEvent, option: DropdownOption) => {
    e.stopPropagation();

    // 1. Auto-add a Select step (matches TableExplorer's auto-add behaviour).
    if (onAddStep) {
      onAddStep({
        type: 'select',
        selector: triggerSelector || option.selector,
        value: option.value || option.text,
        description: `Select "${option.text}" from dropdown`,
      });
    }

    // 2. Anchor the popover next to the clicked row.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollRect = scrollRef.current?.getBoundingClientRect();
    setActiveOption({
      option,
      position: {
        top: rect.bottom - (scrollRect?.top ?? 0) + 4,
        left: rect.left - (scrollRect?.left ?? 0) + 16,
      },
    });
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header — trigger selector + native/custom pill + option count */}
      <div
        className="row"
        style={{
          padding: '10px 12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--hair)',
          borderRadius: 6,
          gap: 8,
          marginBottom: 10,
          alignItems: 'center',
        }}
      >
        <ChevronsUpDown size={14} style={{ color: 'var(--slate)', flexShrink: 0 }} />
        <span className="dim" style={{ fontSize: 11, flexShrink: 0 }}>
          Trigger:
        </span>
        <code
          className="mono"
          onClick={handleCopyTrigger}
          title={triggerSelector}
          style={{
            flex: 1,
            fontSize: 11.5,
            color: 'var(--slate)',
            background: 'var(--surface)',
            border: '1px solid var(--hair)',
            padding: '3px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {triggerSelector || '(none)'}
        </code>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={handleCopyTrigger}
          title={copiedTrigger ? 'Copied!' : 'Copy trigger selector'}
        >
          {copiedTrigger ? (
            <Check size={12} style={{ color: 'var(--moss)' }} />
          ) : (
            <Copy size={12} />
          )}
        </button>
        <Pill kind={isNative ? 'info' : 'mute'} dot={false}>
          {isNative ? 'native' : 'custom'}
        </Pill>
        <Pill kind="mute" dot={false}>
          {options.length} option{options.length === 1 ? '' : 's'}
        </Pill>
      </div>

      {/* Help line */}
      <div
        className="dim"
        style={{ fontSize: 11.5, marginBottom: 8, padding: '0 2px' }}
      >
        Click an option to auto-add a <strong style={{ color: 'var(--ink-2)' }}>Select</strong> step
        — a popover will offer alternatives (Click / Assert value / Assert visible) and code snippets.
      </div>

      {/* Scrollable option list */}
      <div
        ref={scrollRef}
        style={{
          position: 'relative',
          maxHeight: '60vh',
          overflowY: 'auto',
          border: '1px solid var(--hair)',
          borderRadius: 6,
          background: 'var(--surface)',
        }}
      >
        {options.length === 0 ? (
          <p className="dim" style={{ fontSize: 12.5, textAlign: 'center', padding: '32px 12px' }}>
            No options captured for this dropdown.
          </p>
        ) : (
          options.map((option) => {
            const isActive = activeOption?.option.index === option.index;
            const showSwatch =
              option.cssPreview?.backgroundColor &&
              option.cssPreview.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
              option.cssPreview.backgroundColor !== 'transparent';
            return (
              <button
                key={option.index}
                type="button"
                onClick={(e) => handleOptionClick(e, option)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--hair)',
                  background: isActive ? 'var(--moss-soft)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background .12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  className="mono dim"
                  style={{ width: 22, textAlign: 'right', fontSize: 10.5, flexShrink: 0 }}
                >
                  {option.index + 1}
                </span>
                {showSwatch && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: '1px solid var(--hair)',
                      flexShrink: 0,
                      backgroundColor: option.cssPreview!.backgroundColor,
                    }}
                  />
                )}
                <span
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    color: 'var(--ink)',
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
                      fontSize: 10.5,
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    ={option.value}
                  </span>
                )}
                {option.selected && (
                  <Pill kind="ok" dot={false}>
                    selected
                  </Pill>
                )}
              </button>
            );
          })
        )}

        {activeOption && (
          <OptionSelectorPopover
            triggerSelector={triggerSelector}
            optionSelector={activeOption.option.selector}
            optionText={activeOption.option.text}
            optionValue={activeOption.option.value}
            position={activeOption.position}
            onClose={() => setActiveOption(null)}
            onAddStep={onAddStep}
          />
        )}
      </div>

      {/* Footer */}
      <div
        className="row"
        style={{ justifyContent: 'flex-end', marginTop: 10 }}
      >
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
