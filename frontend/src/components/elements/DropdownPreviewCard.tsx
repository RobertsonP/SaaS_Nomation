import { useState } from 'react';
import { ProjectElement } from '../../types/element.types';
import { CellStepData } from './CellSelectorPopover';

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
      // Clipboard API may not be available
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
      // Clipboard API may not be available
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
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectElement(element)}
      onKeyDown={handleKeyDown}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden
        hover:border-blue-400 hover:shadow-md cursor-pointer active:scale-[0.98] transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
    >
      {/* Header */}
      <div className="px-3 py-2 bg-violet-50 dark:bg-violet-900/30 border-b border-violet-200 dark:border-violet-800 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-600 dark:text-violet-400 flex-shrink-0">
          <rect x="2" y="3" width="12" height="3" rx="1" />
          <path d="M5 5L8 8L11 5" />
          <rect x="2" y="8" width="12" height="6" rx="1" strokeDasharray="2 1" />
          <line x1="4" y1="10" x2="12" y2="10" />
          <line x1="4" y1="12" x2="12" y2="12" />
        </svg>
        <span className="text-sm font-medium text-violet-800 dark:text-violet-200 truncate">
          {element.description || 'Dropdown'}
        </span>
        <span className="px-1.5 py-0.5 text-xs bg-violet-100 dark:bg-violet-800 text-violet-700 dark:text-violet-300 rounded flex-shrink-0">
          {optionCount} option{optionCount !== 1 ? 's' : ''}
        </span>
        <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded flex-shrink-0">
          {isNative ? 'native' : 'custom'}
        </span>
      </div>

      {/* Trigger Selector */}
      {triggerSelector && (
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">Select:</span>
          <code
            className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 truncate"
            onClick={(e) => handleCopy(e, triggerSelector)}
            title="Click to copy"
          >
            {copiedSelector === triggerSelector ? 'Copied!' : triggerSelector}
          </code>
        </div>
      )}

      {/* Options List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700" onClick={(e) => e.stopPropagation()}>
        {displayOptions.map((option: DropdownOption) => (
          <div
            key={option.index}
            className="px-3 py-1.5 flex items-center gap-2 hover:bg-violet-50 dark:hover:bg-violet-900/20 group"
          >
            {/* Option index */}
            <span className="text-xs text-gray-400 dark:text-gray-500 w-5 text-right flex-shrink-0">
              {option.index + 1}
            </span>

            {/* CSS color swatch if available */}
            {option.cssPreview?.backgroundColor && option.cssPreview.backgroundColor !== 'rgba(0, 0, 0, 0)' && (
              <span
                className="w-3 h-3 rounded-sm border border-gray-200 dark:border-gray-600 flex-shrink-0"
                style={{ backgroundColor: option.cssPreview.backgroundColor }}
              />
            )}

            {/* Option text */}
            <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
              {option.text || <span className="italic text-gray-400">(empty)</span>}
            </span>

            {/* Value badge (if different from text) */}
            {option.value && option.value !== option.text && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate max-w-[80px]" title={option.value}>
                ={option.value}
              </span>
            )}

            {/* Selected indicator */}
            {option.selected && (
              <span className="text-[10px] text-green-600 dark:text-green-400 flex-shrink-0">selected</span>
            )}

            {/* Action buttons (visible on hover) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {/* Add as test step */}
              {onAddStep && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddStep({
                      type: 'select',
                      selector: triggerSelector || option.selector,
                      value: option.value || option.text,
                      description: `Select "${option.text}" from dropdown`,
                    });
                  }}
                  className="p-0.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                  title={`Add step: Select "${option.text}"`}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 5v6M5 8h6" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              {/* Copy selector */}
              <button
                onClick={(e) => handleCopy(e, option.selector)}
                className="p-0.5 text-gray-400 hover:text-violet-600 dark:hover:text-violet-400"
                title={`Copy: ${option.selector}`}
              >
                {copiedSelector === option.selector ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                    <path d="M4 8L7 11L12 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="5" y="5" width="8" height="8" rx="1" />
                    <path d="M3 11V3h8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              {/* Copy assertion */}
              <button
                onClick={(e) => handleCopyAssertion(e, option)}
                className="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                title="Copy assertion"
              >
                {copiedSelector === `assert-${option.index}` ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                    <path d="M4 8L7 11L12 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 8L7 11L12 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Expand/Collapse */}
      {options.length > 5 && (
        <button
          onClick={handleToggleExpand}
          className="w-full px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 border-t border-gray-100 dark:border-gray-700"
        >
          {expanded ? 'Show less' : `Show ${Math.min(options.length, 50) - 5} more options`}
        </button>
      )}
    </div>
  );
}
