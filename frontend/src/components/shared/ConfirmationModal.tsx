import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'info' | 'warning' | 'danger' | 'success';
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  // Map variant → icon + accent color + confirm button style
  const accent =
    variant === 'success'
      ? { color: 'var(--moss)', icon: <CheckCircle2 size={16} />, btn: 'btn btn-success' }
      : variant === 'warning'
      ? { color: 'var(--amber)', icon: <AlertTriangle size={16} />, btn: 'btn btn-primary' }
      : variant === 'danger'
      ? { color: 'var(--clay)', icon: <AlertTriangle size={16} />, btn: 'btn btn-danger' }
      : { color: 'var(--slate)', icon: <Info size={16} />, btn: 'btn btn-primary' };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: accent.color, marginTop: 1 }}>{accent.icon}</span>
            <div>
              <div className="modal-title">{title}</div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body">
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              color: 'var(--ink-2)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.55,
            }}
          >
            {message}
          </p>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {cancelText}
          </button>
          <button type="button" className={accent.btn} onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
