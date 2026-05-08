import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'info' | 'warning' | 'error' | 'success';
  buttonText?: string;
}

export function InfoModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
  buttonText = 'OK',
}: InfoModalProps) {
  if (!isOpen) return null;

  const accent =
    variant === 'success'
      ? { color: 'var(--moss)', icon: <CheckCircle2 size={16} /> }
      : variant === 'warning'
      ? { color: 'var(--amber)', icon: <AlertTriangle size={16} /> }
      : variant === 'error'
      ? { color: 'var(--clay)', icon: <XCircle size={16} /> }
      : { color: 'var(--slate)', icon: <Info size={16} /> };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: accent.color, marginTop: 1 }}>{accent.icon}</span>
            <div className="modal-title">{title}</div>
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
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
