import { useState } from 'react';
import { cellTextAssertion, cellContainsAssertion, cellVisibleAssertion } from '../../utils/assertion-templates';

export interface CellStepData {
  type: string;
  selector: string;
  value: string;
  description: string;
}

interface CellSelectorPopoverProps {
  cellSelector: string;
  cellText: string;
  position: { top: number; left: number };
  onClose: () => void;
  onAddStep?: (step: CellStepData) => void;
}

export function CellSelectorPopover({ cellSelector, cellText, position, onClose, onAddStep }: CellSelectorPopoverProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const truncatedText = cellText.length > 50 ? cellText.substring(0, 50) + '...' : cellText;

  const assertions = [
    { label: 'Selector', code: cellSelector },
    { label: 'Exact text', code: cellTextAssertion(cellSelector, cellText) },
    { label: 'Contains', code: cellContainsAssertion(cellSelector, cellText) },
    { label: 'Visible', code: cellVisibleAssertion(cellSelector) },
  ];

  // Step creation options for "Add to test" actions
  const stepActions = [
    { label: 'Assert contains', type: 'assert', value: cellText, description: `Assert cell contains: "${truncatedText}"` },
    { label: 'Assert equals', type: 'assert', value: cellText, description: `Assert cell text equals: "${truncatedText}"` },
    { label: 'Assert visible', type: 'assert', value: '', description: `Assert cell is visible` },
    { label: 'Click cell', type: 'click', value: '', description: `Click table cell: "${truncatedText}"` },
  ];

  const handleCopy = async (code: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // Clipboard API may not be available
    }
  };

  const handleAddStep = (action: typeof stepActions[0]) => {
    if (onAddStep) {
      onAddStep({
        type: action.type,
        selector: cellSelector,
        value: action.value,
        description: action.description,
      });
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover */}
      <div
        className="absolute z-50 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{ top: position.top, left: position.left }}
      >
        {/* Header */}
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Cell: "{cellText.substring(0, 30)}{cellText.length > 30 ? '...' : ''}"</span>
          <button
            onClick={onClose}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add to test actions */}
        {onAddStep && (
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1.5">Add to test</div>
            <div className="grid grid-cols-2 gap-1.5">
              {stepActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAddStep(action)}
                  className="px-2 py-1.5 text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-left"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Copy assertion options */}
        <div className="p-2 space-y-1.5">
          <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Copy code</div>
          {assertions.map((a, idx) => (
            <div key={idx} className="group">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{a.label}</span>
                <button
                  onClick={() => handleCopy(a.code, idx)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedIdx === idx ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <code
                className="block text-xs font-mono bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 truncate"
                onClick={() => handleCopy(a.code, idx)}
                title={a.code}
              >
                {copiedIdx === idx ? 'Copied!' : a.code}
              </code>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
