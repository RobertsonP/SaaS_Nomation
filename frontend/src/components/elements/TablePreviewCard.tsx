import { useState } from 'react';
import { ProjectElement } from '../../types/element.types';
import { TableExplorer } from './TableExplorer';
import { CellStepData } from './CellSelectorPopover';

interface TablePreviewCardProps {
  element: ProjectElement;
  onSelectElement: (element: ProjectElement) => void;
  onAddStep?: (step: CellStepData) => void;
}

export function TablePreviewCard({ element, onSelectElement, onAddStep }: TablePreviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null);

  const tableData = element.tableData || (element.attributes as any)?.tableData;
  if (!tableData) return null;

  const { headers, rowCount, sampleData, tableSelector, rowSelectors } = tableData;
  const displayRows = sampleData?.slice(0, expanded ? 10 : 3) || [];

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

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleToggleExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowExplorer(!showExplorer);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectElement(element);
    }
  };

  // Check if table has full selector data for explorer
  const hasExplorerData = tableData.cellSelectors && tableData.cellSelectors.length > 0;

  return (
    <div className="space-y-2">
      {/* Card */}
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
        <div className="px-3 py-2 bg-teal-50 dark:bg-teal-900/30 border-b border-teal-200 dark:border-teal-800 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-600 dark:text-teal-400 flex-shrink-0">
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <line x1="2" y1="6" x2="14" y2="6" />
            <line x1="2" y1="10" x2="14" y2="10" />
            <line x1="6" y1="2" x2="6" y2="14" />
            <line x1="10" y1="2" x2="10" y2="14" />
          </svg>
          <span className="text-sm font-medium text-teal-800 dark:text-teal-200 truncate">
            {element.description || 'Data Table'}
          </span>
          <span className="px-1.5 py-0.5 text-xs bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300 rounded flex-shrink-0">
            {rowCount} row{rowCount !== 1 ? 's' : ''}
          </span>
          {hasExplorerData && (
            <button
              onClick={handleToggleExplorer}
              className={`ml-auto px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                showExplorer
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-700'
              }`}
            >
              {showExplorer ? 'Close' : 'Explore'}
            </button>
          )}
        </div>

        {/* Table Selector */}
        {tableSelector && (
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">Table:</span>
            <code
              className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 truncate"
              onClick={(e) => handleCopy(e, tableSelector)}
              title="Click to copy"
            >
              {copiedSelector === tableSelector ? 'Copied!' : tableSelector}
            </code>
          </div>
        )}

        {/* Mini Table Preview (hidden when explorer is open) */}
        {!showExplorer && headers && headers.length > 0 && (
          <div className="overflow-x-auto" onClick={(e) => e.stopPropagation()}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-2 py-1 text-left text-gray-500 dark:text-gray-400 font-medium w-8">#</th>
                  {headers.slice(0, 5).map((header: string, i: number) => (
                    <th key={i} className="px-2 py-1 text-left text-gray-700 dark:text-gray-300 font-medium truncate max-w-[120px]">
                      {header || `Col ${i + 1}`}
                    </th>
                  ))}
                  {headers.length > 5 && (
                    <th className="px-2 py-1 text-gray-400 dark:text-gray-500">+{headers.length - 5}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row: string[], rowIdx: number) => (
                  <tr key={rowIdx} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-2 py-1 text-gray-400 dark:text-gray-500">
                      {rowSelectors?.[rowIdx] ? (
                        <button
                          onClick={(e) => handleCopy(e, rowSelectors[rowIdx])}
                          className="hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
                          title={`Copy: ${rowSelectors[rowIdx]}`}
                        >
                          {copiedSelector === rowSelectors[rowIdx] ? (
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                              <path d="M4 8L7 11L12 5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <span>{rowIdx + 1}</span>
                          )}
                        </button>
                      ) : (
                        rowIdx + 1
                      )}
                    </td>
                    {row.slice(0, 5).map((cell: string, cellIdx: number) => (
                      <td key={cellIdx} className="px-2 py-1 text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                        {cell || '-'}
                      </td>
                    ))}
                    {row.length > 5 && (
                      <td className="px-2 py-1 text-gray-400">...</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Expand/Collapse (only when explorer is closed) */}
        {!showExplorer && sampleData && sampleData.length > 3 && (
          <button
            onClick={handleToggleExpand}
            className="w-full px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 border-t border-gray-100 dark:border-gray-700"
          >
            {expanded ? 'Show less' : `Show ${Math.min(sampleData.length, 10) - 3} more rows`}
          </button>
        )}
      </div>

      {/* Table Explorer (inline below the card) */}
      {showExplorer && hasExplorerData && (
        <div onClick={(e) => e.stopPropagation()}>
          <TableExplorer
            tableData={tableData}
            onClose={() => setShowExplorer(false)}
            onAddStep={onAddStep}
          />
        </div>
      )}
    </div>
  );
}
