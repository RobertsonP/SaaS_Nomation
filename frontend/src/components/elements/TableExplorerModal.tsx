import { useEffect } from 'react';
import { TableExplorer } from './TableExplorer';
import { CellStepData } from './CellSelectorPopover';

interface TableData {
  headers: string[];
  rowCount: number;
  sampleData: string[][];
  tableSelector: string;
  rowSelectors: string[];
  columnSelectors: string[];
  cellSelectors: string[][];
  cellActions?: Array<Array<Array<{ text: string; selector: string; tag: string }>>>;
  headerColumnMap: Record<string, number>;
  hasHeaders: boolean;
  hasTbody: boolean;
}

interface TableExplorerModalProps {
  open: boolean;
  tableData: TableData;
  onClose: () => void;
  onAddStep?: (step: CellStepData) => void;
  title?: string;
}

export function TableExplorerModal({ open, tableData, onClose, onAddStep, title }: TableExplorerModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{title}</h3>
          </div>
        )}
        <div className="flex-1 overflow-auto p-4">
          <TableExplorer
            tableData={tableData}
            onClose={onClose}
            onAddStep={onAddStep}
          />
        </div>
      </div>
    </div>
  );
}
