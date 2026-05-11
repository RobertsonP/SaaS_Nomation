import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { CellStepData } from './CellSelectorPopover';

interface OptionSelectorPopoverProps {
  triggerSelector: string;
  optionSelector: string;
  optionText: string;
  optionValue: string;
  position: { top: number; left: number };
  onClose: () => void;
  onAddStep?: (step: CellStepData) => void;
}

/**
 * Per-option popover surfaced from the DropdownExplorer. Mirrors
 * CellSelectorPopover.tsx but tailored to dropdown options:
 * - Add to test: Select / Click / Assert value / Assert visible
 * - Copy code: 4 Playwright snippets
 */
export function OptionSelectorPopover({
  triggerSelector,
  optionSelector,
  optionText,
  optionValue,
  position,
  onClose,
  onAddStep,
}: OptionSelectorPopoverProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const truncated = optionText.length > 30 ? optionText.substring(0, 30) + '…' : optionText;
  const valueOrText = optionValue || optionText;

  const stepActions: Array<{
    label: string;
    type: 'select' | 'click' | 'assert';
    selector: string;
    value: string;
    description: string;
  }> = [
    {
      label: 'Select option',
      type: 'select',
      selector: triggerSelector || optionSelector,
      value: valueOrText,
      description: `Select "${truncated}" from dropdown`,
    },
    {
      label: 'Click option',
      type: 'click',
      selector: optionSelector,
      value: '',
      description: `Click option "${truncated}"`,
    },
    {
      label: 'Assert value',
      type: 'assert',
      selector: triggerSelector || optionSelector,
      value: valueOrText,
      description: `Assert dropdown value: "${truncated}"`,
    },
    {
      label: 'Assert visible',
      type: 'assert',
      selector: optionSelector,
      value: optionText,
      description: `Assert option "${truncated}" is visible`,
    },
  ];

  const escapeSingle = (s: string) => s.replace(/'/g, "\\'");

  const snippets: Array<{ label: string; code: string }> = [
    {
      label: 'Select option',
      code: `await page.locator('${escapeSingle(triggerSelector || optionSelector)}').selectOption('${escapeSingle(valueOrText)}');`,
    },
    {
      label: 'Click option',
      code: `await page.locator('${escapeSingle(optionSelector)}').click();`,
    },
    {
      label: 'Assert value',
      code: `await expect(page.locator('${escapeSingle(triggerSelector || optionSelector)}')).toHaveValue('${escapeSingle(valueOrText)}');`,
    },
    {
      label: 'Assert visible',
      code: `await expect(page.locator('${escapeSingle(optionSelector)}')).toBeVisible();`,
    },
  ];

  const handleCopy = async (code: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // Clipboard API may be unavailable
    }
  };

  const handleAddStep = (action: typeof stepActions[number]) => {
    if (!onAddStep) return;
    onAddStep({
      type: action.type,
      selector: action.selector,
      value: action.value,
      description: action.description,
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop captures outside-click */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
        onClick={onClose}
      />

      {/* Popover */}
      <div
        style={{
          position: 'absolute',
          zIndex: 50,
          top: position.top,
          left: position.left,
          width: 320,
          background: 'var(--surface)',
          border: '1px solid var(--hair-2)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="row"
          style={{
            padding: '8px 10px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--hair)',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--ink-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={optionText}
          >
            Option: "{truncated}"
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 20, height: 20, padding: 0 }}
          >
            <X size={12} />
          </button>
        </div>

        {/* Add to test */}
        {onAddStep && (
          <div style={{ padding: 8, borderBottom: '1px solid var(--hair)' }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--moss)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 6,
              }}
            >
              Add to test
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {stepActions.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddStep(action)}
                  className="btn btn-outline btn-sm"
                  style={{
                    justifyContent: 'flex-start',
                    fontSize: 11,
                    padding: '4px 8px',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Copy code */}
        <div style={{ padding: 8 }}>
          <div
            className="dim"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 6,
            }}
          >
            Copy code
          </div>
          <div className="col" style={{ gap: 6 }}>
            {snippets.map((s, idx) => (
              <div key={idx}>
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    fontSize: 10.5,
                    color: 'var(--ink-3)',
                    marginBottom: 2,
                  }}
                >
                  <span>{s.label}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(s.code, idx)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0 4px', height: 16, fontSize: 10 }}
                  >
                    {copiedIdx === idx ? (
                      <>
                        <Check size={10} style={{ color: 'var(--moss)' }} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={10} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <code
                  className="mono"
                  onClick={() => handleCopy(s.code, idx)}
                  title={s.code}
                  style={{
                    display: 'block',
                    background: 'var(--surface-2)',
                    color: 'var(--slate)',
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--hair)',
                    fontSize: 10.5,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.code}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
