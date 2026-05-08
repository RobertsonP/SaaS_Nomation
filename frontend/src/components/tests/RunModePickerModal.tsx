import { useEffect } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

interface RunModePickerModalProps {
  open: boolean;
  testName: string;
  onCancel: () => void;
  onPick: (mode: 'headed' | 'headless') => void;
}

export function RunModePickerModal({ open, testName, onCancel, onPick }: RunModePickerModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Run "{testName}"</div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              Choose how the test should run.
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 10 }}>
          <button
            type="button"
            onClick={() => onPick('headed')}
            style={{
              textAlign: 'left',
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 8,
              padding: 14,
              cursor: 'pointer',
              transition: 'border-color .15s ease, background .15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--info)';
              e.currentTarget.style.background = 'var(--info-soft)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--hair)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <Eye size={14} style={{ color: 'var(--info)' }} />
              <span style={{ fontFamily: 'Inter Tight', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                Headed
              </span>
            </div>
            <div className="dim" style={{ fontSize: 12, lineHeight: 1.55 }}>
              A real Chromium window opens on the host. Watch the test execute live.
              Video is recorded; progress streams to the modal. Falls back to headless if
              the host has no display.
            </div>
          </button>
          <button
            type="button"
            onClick={() => onPick('headless')}
            style={{
              textAlign: 'left',
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 8,
              padding: 14,
              cursor: 'pointer',
              transition: 'border-color .15s ease, background .15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--moss)';
              e.currentTarget.style.background = 'var(--moss-soft)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--hair)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <EyeOff size={14} style={{ color: 'var(--moss)' }} />
              <span style={{ fontFamily: 'Inter Tight', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                Headless
              </span>
            </div>
            <div className="dim" style={{ fontSize: 12, lineHeight: 1.55 }}>
              No browser window opens. Same video recording, same step-by-step progress
              streamed to the modal. Faster on busy machines.
            </div>
          </button>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
