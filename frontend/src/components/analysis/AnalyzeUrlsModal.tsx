import { useState, useMemo } from 'react';
import { CheckCircle2, Clock, Loader2, Sparkles, X } from 'lucide-react';

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  analyzed: boolean;
}

interface AnalyzeUrlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectUrls: ProjectUrl[];
  onAnalyze: (selectedUrlIds: string[]) => void;
  isAnalyzing?: boolean;
}

export function AnalyzeUrlsModal({
  isOpen,
  onClose,
  projectUrls,
  onAnalyze,
  isAnalyzing = false,
}: AnalyzeUrlsModalProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'analyzed' | 'unanalyzed'>('all');

  const filteredUrls = useMemo(() => {
    if (filter === 'all') return projectUrls;
    if (filter === 'analyzed') return projectUrls.filter(u => u.analyzed);
    return projectUrls.filter(u => !u.analyzed);
  }, [projectUrls, filter]);

  const analyzedCount = projectUrls.filter(u => u.analyzed).length;
  const unanalyzedCount = projectUrls.filter(u => !u.analyzed).length;

  const handleToggleUrl = (urlId: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(urlId)) next.delete(urlId);
      else next.add(urlId);
      return next;
    });
  };

  const handleSelectAll = () => setSelectedUrls(new Set(filteredUrls.map(u => u.id)));
  const handleDeselectAll = () => setSelectedUrls(new Set());
  const handleSelectUnanalyzed = () =>
    setSelectedUrls(new Set(projectUrls.filter(u => !u.analyzed).map(u => u.id)));

  const handleAnalyze = () => {
    if (selectedUrls.size > 0) onAnalyze(Array.from(selectedUrls));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">Select URLs to analyze</div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              {projectUrls.length} URLs total · {analyzedCount} analyzed · {unanalyzedCount} pending
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Filter tabs */}
        <div
          className="row"
          style={{
            gap: 0,
            borderBottom: '1px solid var(--hair)',
            padding: '0 20px',
          }}
        >
          {[
            { id: 'all', label: 'All', count: projectUrls.length },
            { id: 'unanalyzed', label: 'Pending', count: unanalyzedCount },
            { id: 'analyzed', label: 'Analyzed', count: analyzedCount },
          ].map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as 'all' | 'analyzed' | 'unanalyzed')}
                style={{
                  padding: '10px 14px',
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${active ? 'var(--moss)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'color .12s ease, border-color .12s ease',
                }}
              >
                {tab.label} <span className="tabular dim">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <div
          className="row"
          style={{
            gap: 6,
            padding: 12,
            borderBottom: '1px solid var(--hair)',
            background: 'var(--surface-2)',
          }}
        >
          <button type="button" onClick={handleSelectAll} className="btn btn-ghost btn-sm">
            Select all
          </button>
          <button type="button" onClick={handleDeselectAll} className="btn btn-ghost btn-sm">
            Deselect all
          </button>
          {unanalyzedCount > 0 && (
            <button
              type="button"
              onClick={handleSelectUnanalyzed}
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--moss)', borderColor: 'var(--moss-edge)' }}
            >
              Select unanalyzed
            </button>
          )}
        </div>

        {/* URL list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {filteredUrls.length === 0 ? (
            <div className="empty" style={{ padding: '32px 16px' }}>
              <p>No URLs match the current filter</p>
            </div>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {filteredUrls.map(url => {
                const checked = selectedUrls.has(url.id);
                return (
                  <label
                    key={url.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: 10,
                      borderRadius: 6,
                      border: `1px solid ${checked ? 'var(--moss)' : 'var(--hair)'}`,
                      background: checked ? 'var(--moss-soft)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'background .12s ease, border-color .12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleUrl(url.id)}
                      style={{
                        width: 14,
                        height: 14,
                        accentColor: 'var(--moss)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: 'var(--ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {url.title || 'Untitled'}
                      </div>
                      <div
                        className="mono dim"
                        style={{
                          fontSize: 11,
                          marginTop: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {url.url}
                      </div>
                    </div>
                    <span
                      className="pill"
                      style={
                        url.analyzed
                          ? {
                              background: 'var(--moss-soft)',
                              color: 'var(--moss)',
                              borderColor: 'var(--moss-edge)',
                            }
                          : {
                              background: 'var(--amber-soft)',
                              color: 'var(--amber)',
                              borderColor: 'var(--amber-edge)',
                            }
                      }
                    >
                      {url.analyzed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      {url.analyzed ? 'Analyzed' : 'Pending'}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <span className="dim" style={{ fontSize: 12, marginRight: 'auto' }}>
            {selectedUrls.size} URL{selectedUrls.size !== 1 ? 's' : ''} selected
          </span>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={selectedUrls.size === 0 || isAnalyzing}
            className="btn btn-success"
            style={
              selectedUrls.size === 0 || isAnalyzing
                ? { opacity: 0.5, cursor: 'not-allowed' }
                : undefined
            }
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Analyzing…</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>
                  Analyze {selectedUrls.size} URL{selectedUrls.size !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
