import { useEffect, useState } from 'react';
import { Check, RefreshCw, Trash2, X } from 'lucide-react';
import { Pill } from '../ui/Pill';

export interface EditSiteUrl {
  id: string;
  url: string;
  title?: string | null;
  analyzed?: boolean;
  verified?: boolean;
  discovered?: boolean;
}

interface EditSiteModalProps {
  open: boolean;
  url: EditSiteUrl | null;
  /** Save the title (the only field the backend currently accepts). */
  onSave: (urlId: string, title: string) => Promise<void> | void;
  /** Trigger the verify flow on this URL. */
  onVerify?: (urlId: string) => Promise<void> | void;
  /** Remove the URL — call site already handles confirmation. */
  onRemove: (url: string) => Promise<void> | void;
  onClose: () => void;
  isSaving?: boolean;
  isVerifying?: boolean;
}

/**
 * Edit Site modal — verdant-styled. Today the backend only persists `title`
 * on a ProjectUrl (see schema.prisma:117 ProjectUrl model — no env / auth
 * profile / crawl depth / excluded paths fields). The modal therefore shows
 * the read-only URL plus an editable title and the existing verify / remove
 * actions, mirroring per-row buttons in the URLs tab. Future fields land
 * here once the backend grows them.
 */
export function EditSiteModal({
  open,
  url,
  onSave,
  onVerify,
  onRemove,
  onClose,
  isSaving = false,
  isVerifying = false,
}: EditSiteModalProps) {
  const [title, setTitle] = useState<string>('');

  useEffect(() => {
    if (open && url) {
      setTitle(url.title ?? '');
    }
  }, [open, url]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !url) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    await onSave(url.id, title.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal modal-lg"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSave}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">Edit site</div>
            <div className="modal-sub mono" style={{ marginTop: 2 }}>
              {url.url}
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 14 }}>
          <div className="field">
            <label>URL</label>
            <input className="mono" value={url.url} readOnly />
            <span className="hint">URL is fixed once a site is created. Remove and re-add to change.</span>
          </div>

          <div className="field">
            <label>Title / Alias</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Production storefront"
              autoFocus
            />
            <span className="hint">Shown in the sidebar and across the app instead of the raw URL.</span>
          </div>

          <div className="field">
            <label>Status</label>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Pill kind={url.analyzed ? 'ok' : 'mute'}>
                {url.analyzed ? 'Analyzed' : 'Not analyzed'}
              </Pill>
              <Pill kind={url.verified ? 'ok' : 'mute'}>
                {url.verified ? 'Verified' : 'Unverified'}
              </Pill>
              {url.discovered && <Pill kind="info">Auto-discovered</Pill>}
            </div>
            <span className="hint">
              Verify checks the URL is reachable. Analyze runs Playwright element extraction.
            </span>
          </div>
        </div>

        <div className="modal-foot">
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ marginRight: 'auto' }}
            onClick={() => onRemove(url.url)}
          >
            <Trash2 size={13} />
            <span>Remove site</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {onVerify && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onVerify(url.id)}
              disabled={isVerifying}
            >
              <RefreshCw size={13} />
              <span>{isVerifying ? 'Verifying…' : 'Verify'}</span>
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSaving || title.trim() === (url.title ?? '').trim()}
          >
            <Check size={13} />
            <span>{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
