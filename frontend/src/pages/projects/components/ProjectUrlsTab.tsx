import React, { useState, useMemo } from 'react';
import { projectsAPI } from '../../../lib/api';
import { Project, ProjectUrl } from './types';

interface ProjectUrlsTabProps {
  project: Project;
  newUrl: string;
  setNewUrl: (url: string) => void;
  addingUrl: boolean;
  verifyingUrl: string | null;
  selectedUrls: string[];
  setSelectedUrls: (urls: string[]) => void;
  analyzing: boolean;
  onAddUrl: () => void;
  onRemoveUrl: (url: string) => void;
  onVerifyUrl: (urlId: string) => void;
  onAnalyzeSelected: () => void;
  onShowDiscoveryModal: () => void;
  onProjectReload: () => Promise<void> | void;
  /** Open the rich Edit Site modal for a single URL row. */
  onEditUrl?: (url: ProjectUrl) => void;
}

// Collapsible section component for URL grouping
function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
  icon,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: '1px solid var(--hair)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--surface)',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--surface-2)',
          borderBottom: isOpen ? '1px solid var(--hair)' : 'none',
          color: 'var(--ink)',
        }}
      >
        <div className="row" style={{ gap: 8 }}>
          {icon && (
            <span className="dim" style={{ display: 'inline-flex' }}>
              {icon}
            </span>
          )}
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
          <span
            className="tabular dim"
            style={{
              fontSize: 11,
              padding: '0 6px',
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 999,
            }}
          >
            {count}
          </span>
        </div>
        <span
          className="dim"
          style={{
            display: 'inline-flex',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {isOpen && <div className="col" style={{ padding: 8, gap: 4 }}>{children}</div>}
    </div>
  );
}

// URL Card component for consistent rendering
function UrlCard({
  url,
  selectedUrls,
  setSelectedUrls,
  showCheckbox,
  verifyingUrl,
  onVerifyUrl,
  onRemoveUrl,
  onProjectReload,
  onEditUrl,
}: {
  url: ProjectUrl;
  selectedUrls: string[];
  setSelectedUrls: (urls: string[]) => void;
  showCheckbox: boolean;
  verifyingUrl: string | null;
  onVerifyUrl: (urlId: string) => void;
  onRemoveUrl: (urlStr: string) => void;
  onProjectReload: () => Promise<void> | void;
  onEditUrl?: (url: ProjectUrl) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(url.title || '');
  const [savingTitle, setSavingTitle] = useState(false);

  const startEdit = () => {
    setDraftTitle(url.title || '');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraftTitle(url.title || '');
  };

  const saveTitle = async () => {
    if (savingTitle) return;
    setSavingTitle(true);
    try {
      await projectsAPI.renameUrl(url.id, draftTitle);
      await onProjectReload();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to rename URL', err);
    } finally {
      setSavingTitle(false);
    }
  };

  return (
    <div
      style={{
        border: '1px solid var(--hair)',
        borderRadius: 6,
        padding: 10,
        background: 'var(--surface)',
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
        {showCheckbox && (
          <input
            type="checkbox"
            checked={selectedUrls.includes(url.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedUrls([...selectedUrls, url.id]);
              } else {
                setSelectedUrls(selectedUrls.filter((id) => id !== url.id));
              }
            }}
            style={{ marginTop: 3, flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
            {isEditing ? (
              <input
                type="text"
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') cancelEdit();
                }}
                placeholder="Page title"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '4px 6px',
                  fontSize: 12.5,
                  border: '1px solid var(--hair-2)',
                  borderRadius: 4,
                  color: 'var(--ink)',
                  background: 'var(--surface)',
                }}
              />
            ) : (
              url.title && (
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  {url.title}
                </span>
              )
            )}
            {!isEditing && url.pageType && (
              <span
                className="dim mono"
                style={{
                  fontSize: 10.5,
                  padding: '1px 6px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--hair)',
                  borderRadius: 3,
                }}
              >
                {url.pageType}
              </span>
            )}
          </div>
          <a
            href={url.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{
              fontSize: 11.5,
              color: 'var(--slate)',
              textDecoration: 'none',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
            title={url.url}
          >
            {url.url}
          </a>
          <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {url.analyzed && (
              <span
                className="pill pill-ok"
                style={{ fontSize: 10 }}
              >
                <span className="dot" />
                Analyzed
              </span>
            )}
            {url.verified && (
              <span
                className="pill pill-info"
                style={{ fontSize: 10 }}
              >
                <span className="dot" />
                Verified
              </span>
            )}
            {url.discovered && (
              <span
                className="pill pill-mute"
                style={{ fontSize: 10 }}
              >
                <span className="dot" />
                Auto-discovered
              </span>
            )}
          </div>
        </div>
        <div className="row" style={{ gap: 2, flexShrink: 0 }}>
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={saveTitle}
                disabled={savingTitle}
                className="btn btn-primary btn-sm"
                style={savingTitle ? { opacity: 0.5 } : undefined}
              >
                {savingTitle ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={savingTitle}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {onEditUrl && (
                <button
                  type="button"
                  onClick={() => onEditUrl(url)}
                  className="btn btn-ghost btn-sm"
                  title="Open the full Edit dialog"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={startEdit}
                className="btn btn-ghost btn-sm"
                title="Rename inline"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => onVerifyUrl(url.id)}
                disabled={verifyingUrl === url.id}
                className="btn btn-ghost btn-sm"
              >
                {verifyingUrl === url.id ? 'Verifying…' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={() => onRemoveUrl(url.url)}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--clay)' }}
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProjectUrlsTab({
  project,
  newUrl,
  setNewUrl,
  addingUrl,
  verifyingUrl,
  selectedUrls,
  setSelectedUrls,
  analyzing,
  onAddUrl,
  onRemoveUrl,
  onVerifyUrl,
  onAnalyzeSelected,
  onShowDiscoveryModal,
  onProjectReload,
  onEditUrl,
}: ProjectUrlsTabProps) {
  // Group URLs by depth
  const groupedUrls = useMemo(() => {
    const rootUrls: ProjectUrl[] = [];
    const level1Urls: ProjectUrl[] = [];
    const deepUrls: ProjectUrl[] = [];
    const manualUrls: ProjectUrl[] = [];

    project.urls.forEach(url => {
      const depth = url.discoveryDepth ?? -1;
      const isDiscovered = url.discovered ?? false;

      if (!isDiscovered) {
        manualUrls.push(url);
      } else if (depth === 0) {
        rootUrls.push(url);
      } else if (depth === 1) {
        level1Urls.push(url);
      } else {
        deepUrls.push(url);
      }
    });

    return { rootUrls, level1Urls, deepUrls, manualUrls };
  }, [project.urls]);

  // Determine if we should show hierarchical view (only if there are discovered URLs with different depths)
  const hasHierarchy = useMemo(() => {
    const hasDiscovered = project.urls.some(u => u.discovered);
    const hasMultipleDepths = new Set(project.urls.map(u => u.discoveryDepth ?? -1)).size > 1;
    return hasDiscovered && hasMultipleDepths;
  }, [project.urls]);

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Add URL Form */}
      <div
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--hair)',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div className="row" style={{ gap: 8 }}>
          <input
            type="url"
            placeholder="https://example.com/page-to-test"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddUrl()}
            className="mono"
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: 12.5,
              border: '1px solid var(--hair-2)',
              borderRadius: 5,
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          />
          <button
            type="button"
            onClick={onAddUrl}
            disabled={addingUrl || !newUrl.trim()}
            className="btn btn-primary"
            style={addingUrl || !newUrl.trim() ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {addingUrl ? 'Adding…' : '+ Add URL'}
          </button>
          <button type="button" onClick={onShowDiscoveryModal} className="btn btn-success">
            Auto-Discover
          </button>
        </div>
        <p className="dim" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
          Add URLs manually or use Auto-Discover to find pages from a root URL.
        </p>
      </div>

      {/* URLs List */}
      {project.urls.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <h3>No URLs added yet</h3>
            <p>Add your first URL or use Auto-Discover to get started.</p>
          </div>
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {/* Selective Analysis Controls */}
          {project.urls.length > 1 && (
            <div
              className="row"
              style={{
                justifyContent: 'space-between',
                paddingBottom: 8,
                borderBottom: '1px solid var(--hair)',
              }}
            >
              <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedUrls.length === project.urls.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUrls(project.urls.map((u) => u.id));
                    } else {
                      setSelectedUrls([]);
                    }
                  }}
                />
                <span className="dim" style={{ fontSize: 12 }}>
                  {selectedUrls.length > 0 ? `${selectedUrls.length} selected` : 'Select all'}
                </span>
              </label>
              {selectedUrls.length > 0 && (
                <button
                  type="button"
                  onClick={onAnalyzeSelected}
                  disabled={analyzing}
                  className="btn btn-success btn-sm"
                  style={analyzing ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  {analyzing ? 'Analyzing…' : `Analyze Selected (${selectedUrls.length})`}
                </button>
              )}
            </div>
          )}

          {/* Hierarchical URL View (when discovery data is available) */}
          {hasHierarchy ? (
            <div className="space-y-4">
              {/* Manually Added URLs */}
              {groupedUrls.manualUrls.length > 0 && (
                <CollapsibleSection
                  title="Manually Added"
                  count={groupedUrls.manualUrls.length}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                >
                  {groupedUrls.manualUrls.map(url => (
                    <UrlCard
                      key={url.id}
                      url={url}
                      selectedUrls={selectedUrls}
                      setSelectedUrls={setSelectedUrls}
                      showCheckbox={project.urls.length > 1}
                      verifyingUrl={verifyingUrl}
                      onVerifyUrl={onVerifyUrl}
                      onRemoveUrl={onRemoveUrl}
                      onProjectReload={onProjectReload}
                      onEditUrl={onEditUrl}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {/* Root Pages (depth 0) */}
              {groupedUrls.rootUrls.length > 0 && (
                <CollapsibleSection
                  title="Root Pages"
                  count={groupedUrls.rootUrls.length}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
                >
                  {groupedUrls.rootUrls.map(url => (
                    <UrlCard
                      key={url.id}
                      url={url}
                      selectedUrls={selectedUrls}
                      setSelectedUrls={setSelectedUrls}
                      showCheckbox={project.urls.length > 1}
                      verifyingUrl={verifyingUrl}
                      onVerifyUrl={onVerifyUrl}
                      onRemoveUrl={onRemoveUrl}
                      onProjectReload={onProjectReload}
                      onEditUrl={onEditUrl}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {/* Direct Links (depth 1) */}
              {groupedUrls.level1Urls.length > 0 && (
                <CollapsibleSection
                  title="Direct Links"
                  count={groupedUrls.level1Urls.length}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>}
                  defaultOpen={groupedUrls.level1Urls.length <= 10}
                >
                  {groupedUrls.level1Urls.map(url => (
                    <UrlCard
                      key={url.id}
                      url={url}
                      selectedUrls={selectedUrls}
                      setSelectedUrls={setSelectedUrls}
                      showCheckbox={project.urls.length > 1}
                      verifyingUrl={verifyingUrl}
                      onVerifyUrl={onVerifyUrl}
                      onRemoveUrl={onRemoveUrl}
                      onProjectReload={onProjectReload}
                      onEditUrl={onEditUrl}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {/* Deep Links (depth 2+) */}
              {groupedUrls.deepUrls.length > 0 && (
                <CollapsibleSection
                  title="Deep Links"
                  count={groupedUrls.deepUrls.length}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>}
                  defaultOpen={false}
                >
                  {groupedUrls.deepUrls.map(url => (
                    <UrlCard
                      key={url.id}
                      url={url}
                      selectedUrls={selectedUrls}
                      setSelectedUrls={setSelectedUrls}
                      showCheckbox={project.urls.length > 1}
                      verifyingUrl={verifyingUrl}
                      onVerifyUrl={onVerifyUrl}
                      onRemoveUrl={onRemoveUrl}
                      onProjectReload={onProjectReload}
                      onEditUrl={onEditUrl}
                    />
                  ))}
                </CollapsibleSection>
              )}
            </div>
          ) : (
            /* Flat URL List (no hierarchy data) */
            <div className="space-y-2">
              {project.urls.map((url) => (
                <UrlCard
                  key={url.id}
                  url={url}
                  selectedUrls={selectedUrls}
                  setSelectedUrls={setSelectedUrls}
                  showCheckbox={project.urls.length > 1}
                  verifyingUrl={verifyingUrl}
                  onVerifyUrl={onVerifyUrl}
                  onRemoveUrl={onRemoveUrl}
                  onProjectReload={onProjectReload}
                  onEditUrl={onEditUrl}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
