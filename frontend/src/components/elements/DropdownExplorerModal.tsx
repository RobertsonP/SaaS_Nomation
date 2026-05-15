import { useEffect } from 'react';
import { X } from 'lucide-react';
import { DropdownExplorer } from './DropdownExplorer';
import { CellStepData } from './CellSelectorPopover';

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

interface DropdownExplorerModalProps {
  open: boolean;
  dropdownData: DropdownData;
  onClose: () => void;
  onAddStep?: (step: CellStepData) => void;
  title?: string;
}

export function DropdownExplorerModal({
  open,
  dropdownData,
  onClose,
  onAddStep,
  title,
}: DropdownExplorerModalProps) {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head">
          <h3>{title || 'Dropdown options'}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div
          className="modal-body"
          style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}
        >
          <DropdownExplorer
            dropdownData={dropdownData}
            onAddStep={onAddStep}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
