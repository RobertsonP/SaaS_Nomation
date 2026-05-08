import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingModalProps {
  isOpen: boolean;
  message: string;
  subMessage?: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen, message, subMessage }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-body" style={{ padding: 28, textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--moss-soft)',
              border: '1px solid var(--moss-edge)',
              color: 'var(--moss)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 14px',
            }}
          >
            <Loader2 size={22} className="animate-spin" />
          </div>
          <div
            style={{
              fontFamily: 'Inter Tight',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              color: 'var(--ink)',
              marginBottom: 4,
            }}
          >
            {message}
          </div>
          {subMessage && (
            <div className="dim" style={{ fontSize: 12, lineHeight: 1.5 }}>
              {subMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
