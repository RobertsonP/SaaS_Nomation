import { useState, useRef } from 'react';
import { CellSelectorPopover } from './CellSelectorPopover';

interface TableData {
  headers: string[];
  rowCount: number;
  sampleData: string[][];
  tableSelector: string;
  rowSelectors: string[];
  columnSelectors: string[];
  cellSelectors: string[][];
  headerColumnMap: Record<string, number>;
  hasHeaders: boolean;
  hasTbody: boolean;
}

interface TableExplorerProps {
  tableData: TableData;
  onClose: () => void;
}

export function TableExplorer({ tableData, onClose }: TableExplorerProps) {
  const [copiedSelector, setCopiedSelector] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number; selector: string; text: string; position: { top: number; left: number } } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const { headers, sampleData, rowSelectors, columnSelectors, cellSelectors, tableSelector, hasTbody } = tableData;
  const displayRows = sampleData || [];

  const handleCopySelector = async (selector: string) => {
    try {
      await navigator.clipboard.writeText(selector);
      setCopiedSelector(selector);
      setTimeout(() => setCopiedSelector(null), 1500);
    } catch {
      // Clipboard API may not be available
    }
  };

  const handleCellClick = (e: React.MouseEvent, rowIdx: number, colIdx: number) => {
    e.stopPropagation();
    const selector = cellSelectors?.[rowIdx]?.[colIdx];
    const text = sampleData[rowIdx]?.[colIdx] || '';
    if (!selector) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = tableRef.current?.getBoundingClientRect() || rect;

    setActiveCell({
      row: rowIdx,
      col: colIdx,
      selector,
      text,
      position: {
        top: rect.bottom - containerRect.top + 4,
        left: Math.min(rect.left - containerRect.left, containerRect.width - 320),
      },
    });
  };

  const handleHeaderClick = (e: React.MouseEvent, colIdx: number) => {
    e.stopPropagation();
    const selector = columnSelectors?.[colIdx];
    if (selector) handleCopySelector(selector);
  };

  const handleRowClick = (e: React.MouseEvent, rowIdx: number) => {
    e.stopPropagation();
    const selector = rowSelectors?.[rowIdx];
    if (selector) handleCopySelector(selector);
  };

  return (
    <div className="border border-teal-200 dark:border-teal-800 rounded-lg overflow-hidden bg-white dark:bg-gray-800" ref={tableRef}>
      {/* Header */}
      <div className="px-3 py-2 bg-teal-50 dark:bg-teal-900/30 border-b border-teal-200 dark:border-teal-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-teal-800 dark:text-teal-200">Table Explorer</span>
          <span className="text-xs text-teal-600 dark:text-teal-400">Click cells for selectors</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Copy table selector */}
          <button
            onClick={() => handleCopySelector(tableSelector)}
            className="text-xs px-2 py-1 bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300 rounded hover:bg-teal-200 dark:hover:bg-teal-700"
          >
            {copiedSelector === tableSelector ? 'Copied!' : 'Copy table selector'}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto relative" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <table className="w-full text-xs">
          {/* Sticky header */}
          {headers.length > 0 && (
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-2 py-1.5 text-left text-gray-500 dark:text-gray-400 font-medium w-10 sticky left-0 bg-gray-100 dark:bg-gray-700">#</th>
                {headers.map((header, i) => (
                  <th
                    key={i}
                    onClick={(e) => handleHeaderClick(e, i)}
                    className="px-2 py-1.5 text-left text-gray-700 dark:text-gray-300 font-medium cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors truncate max-w-[150px]"
                    title={`Click to copy column selector: ${columnSelectors?.[i] || ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {header || `Col ${i + 1}`}
                      {copiedSelector === columnSelectors?.[i] && (
                        <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                {/* Row number — clickable for row selector */}
                <td
                  className="px-2 py-1.5 text-gray-400 dark:text-gray-500 sticky left-0 bg-white dark:bg-gray-800 cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 font-mono"
                  onClick={(e) => handleRowClick(e, rowIdx)}
                  title={`Click to copy row selector: ${rowSelectors?.[rowIdx] || ''}`}
                >
                  {copiedSelector === rowSelectors?.[rowIdx] ? (
                    <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    rowIdx + 1
                  )}
                </td>
                {/* Data cells — clickable for cell popover */}
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    onClick={(e) => handleCellClick(e, rowIdx, cellIdx)}
                    className={`px-2 py-1.5 truncate max-w-[150px] cursor-pointer transition-colors ${
                      activeCell?.row === rowIdx && activeCell?.col === cellIdx
                        ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                    }`}
                    title={cell || '-'}
                  >
                    {cell || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Cell selector popover */}
        {activeCell && (
          <CellSelectorPopover
            cellSelector={activeCell.selector}
            cellText={activeCell.text}
            position={activeCell.position}
            onClose={() => setActiveCell(null)}
          />
        )}
      </div>

      {/* Footer info */}
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        Showing {displayRows.length} of {tableData.rowCount} rows
      </div>
    </div>
  );
}
