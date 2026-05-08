import { useState, useEffect } from 'react';
import { X, Search, Loader2, CheckCircle2, AlertCircle, Globe, Map, Link as LinkIcon, Database, Minimize2, Lock, Unlock, StopCircle } from 'lucide-react';
import { SiteMapGraph } from './SiteMapGraph';
import { useSiteMapData, SiteMapNodeData, SiteMapEdgeData } from './useSiteMapData';
import { authFlowsAPI } from '../../lib/api';
import { useDiscoveryContext } from '../../contexts/DiscoveryContext';

interface AuthFlow {
  id: string;
  name: string;
  loginUrl: string;
}

const DISCOVERY_PHASES: Array<{ id: string; label: string; icon: React.ElementType }> = [
  { id: 'initialization', label: 'Initializing', icon: Globe },
  { id: 'connectivity', label: 'Checking connectivity', icon: Globe },
  { id: 'sitemap', label: 'Looking for sitemap', icon: Map },
  { id: 'crawling', label: 'Crawling pages', icon: LinkIcon },
  { id: 'processing', label: 'Processing results', icon: Database },
  { id: 'saving', label: 'Saving results', icon: Database },
];

/**
 * Normalize URL by adding protocol if missing
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const localPatterns = [
    /^localhost(:\d+)?/i,
    /^127\.0\.0\.1(:\d+)?/,
    /^192\.168\.\d+\.\d+(:\d+)?/,
    /^10\.\d+\.\d+\.\d+(:\d+)?/,
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?/,
    /^0\.0\.0\.0(:\d+)?/,
  ];
  const isLocal = localPatterns.some(pattern => pattern.test(trimmed));
  return (isLocal ? 'http://' : 'https://') + trimmed;
}

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
}

interface DiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  projectId: string;
  projectName?: string;
  initialUrl?: string;
  projectUrls?: ProjectUrl[];
  onDiscoveryComplete?: (selectedUrls: string[]) => void;
  onAnalyzePages?: (selectedUrls: string[]) => void;
}

export function DiscoveryModal({
  isOpen,
  onClose,
  onMinimize,
  projectId,
  projectName = '',
  initialUrl = '',
  projectUrls = [],
  onDiscoveryComplete,
  onAnalyzePages,
}: DiscoveryModalProps) {
  const { activeDiscovery, startBackgroundDiscovery, cancelDiscovery, minimizeDiscovery, clearDiscovery } = useDiscoveryContext();

  const [rootUrl, setRootUrl] = useState(initialUrl);
  const [useCustomUrl, setUseCustomUrl] = useState(!initialUrl && projectUrls.length === 0);
  const [customUrl, setCustomUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(50);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [siteMapData, setSiteMapData] = useState<{ nodes: SiteMapNodeData[]; edges: SiteMapEdgeData[] } | null>(null);

  // Auth flow state
  const [authFlows, setAuthFlows] = useState<AuthFlow[]>([]);
  const [selectedAuthFlowId, setSelectedAuthFlowId] = useState<string>('');
  const [loadingAuthFlows, setLoadingAuthFlows] = useState(false);

  // Elapsed time
  const [discoveryStartTime, setDiscoveryStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Stop confirmation state
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Derive state from context
  const isDiscovering = activeDiscovery?.status === 'discovering' && activeDiscovery.projectId === projectId;
  const isComplete = activeDiscovery?.status === 'complete' && activeDiscovery.projectId === projectId;
  const isFailed = activeDiscovery?.status === 'failed' && activeDiscovery.projectId === projectId;
  const discoveryError = isFailed ? activeDiscovery?.error : null;

  // Fetch auth flows when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      setLoadingAuthFlows(true);
      authFlowsAPI.getByProject(projectId)
        .then((response) => setAuthFlows(response.data || []))
        .catch(() => setAuthFlows([]))
        .finally(() => setLoadingAuthFlows(false));
    }
  }, [isOpen, projectId]);

  // Elapsed time timer during discovery
  useEffect(() => {
    if (!isDiscovering || !discoveryStartTime) return;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - discoveryStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isDiscovering, discoveryStartTime]);

  // Build sitemap data when discovery completes
  useEffect(() => {
    if (isComplete && activeDiscovery?.result?.pages && !siteMapData) {
      const nodes: SiteMapNodeData[] = activeDiscovery.result.pages.map((page: any, index: number) => ({
        id: `discovered-${index}`,
        url: page.url,
        title: page.title || 'Discovered Page',
        analyzed: false,
        verified: false,
        requiresAuth: page.requiresAuth,
        pageType: page.pageType,
        discovered: true,
        depth: page.depth,
        screenshot: page.screenshot,
      }));

      const edges: SiteMapEdgeData[] = (activeDiscovery.result.relationships || []).map((rel: any, index: number) => ({
        id: `edge-${index}`,
        source: nodes.find(n => n.url === rel.sourceUrl)?.id || '',
        target: nodes.find(n => n.url === rel.targetUrl)?.id || '',
        linkText: rel.linkText,
        linkType: rel.linkType,
      })).filter((e: SiteMapEdgeData) => e.source && e.target);

      setSiteMapData({ nodes, edges });
      setSelectedNodes(nodes.map(n => n.id));
    }
  }, [isComplete, activeDiscovery?.result, siteMapData]);

  // Compute phase statuses
  const getPhaseStatus = (phaseId: string): 'pending' | 'active' | 'completed' | 'error' => {
    if (!activeDiscovery) return 'pending';
    const currentPhase = activeDiscovery.phase;
    if (isFailed && currentPhase === phaseId) return 'error';
    const phaseOrder = ['initialization', 'connectivity', 'sitemap', 'crawling', 'processing', 'saving', 'complete'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const phaseIndex = phaseOrder.indexOf(phaseId);
    if (currentIndex === -1) return 'pending';
    if (phaseIndex < currentIndex) return 'completed';
    if (phaseIndex === currentIndex) return 'active';
    return 'pending';
  };

  const handleStartDiscovery = () => {
    const urlToUse = useCustomUrl ? customUrl : rootUrl;
    if (!urlToUse.trim()) return;

    const normalizedUrl = normalizeUrl(urlToUse);
    setDiscoveryStartTime(Date.now());
    setElapsedSeconds(0);
    setSiteMapData(null);

    // Use context — modal stays open showing progress
    startBackgroundDiscovery(projectId, projectName, normalizedUrl, {
      maxDepth,
      maxPages,
      useSitemap: true,
      authFlowId: selectedAuthFlowId || undefined,
    });
  };

  const handleStopDiscovery = async () => {
    setIsCancelling(true);
    await cancelDiscovery();
    setIsCancelling(false);
    setShowStopConfirm(false);
  };

  const handleMinimize = () => {
    minimizeDiscovery();
    onMinimize?.();
    onClose();
  };

  const handleNodeSelect = (nodeId: string, selected: boolean) => {
    if (selected) {
      setSelectedNodes(prev => [...prev, nodeId]);
    } else {
      setSelectedNodes(prev => prev.filter(id => id !== nodeId));
    }
  };

  const handleSelectAll = () => {
    if (siteMapData) setSelectedNodes(siteMapData.nodes.map(n => n.id));
  };

  const handleSelectNone = () => setSelectedNodes([]);

  const handleConfirmSelection = () => {
    const selectedUrls = siteMapData
      ? siteMapData.nodes.filter(n => selectedNodes.includes(n.id)).map(n => n.url)
      : [];
    onDiscoveryComplete?.(selectedUrls);
    onClose();
  };

  if (!isOpen) return null;

  // Determine which view to show
  const showForm = !isDiscovering && !isComplete && !isFailed;
  const showProgress = isDiscovering;
  const showResults = (isComplete || isFailed) && siteMapData;
  const showError = isFailed && !siteMapData;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">
              {showResults ? 'Discovery results' : showProgress ? 'Discovering pages…' : 'Discover pages'}
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              {showProgress
                ? `${activeDiscovery?.pagesFound || 0} pages found so far`
                : showResults
                ? `${siteMapData?.nodes.length || 0} pages discovered`
                : 'Automatically find pages on your website'}
            </div>
          </div>
          <div className="row" style={{ gap: 2 }}>
            {showProgress && (
              <>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowStopConfirm(true)}
                  title="Stop discovery"
                  style={{ color: 'var(--clay)' }}
                >
                  <StopCircle size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleMinimize}
                  title="Minimize — discovery continues in background"
                >
                  <Minimize2 size={14} />
                </button>
              </>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="col" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {showForm && (
            <div className="modal-body col" style={{ gap: 16, overflowY: 'auto' }}>
              <div
                style={{
                  background: 'var(--info-soft)',
                  border: '1px solid var(--info-edge)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <Search size={16} style={{ color: 'var(--info)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                      Smart discovery
                    </div>
                    <p className="dim" style={{ margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.55 }}>
                      Enter your website URL and we'll automatically discover all pages using sitemaps and link crawling.
                    </p>
                  </div>
                </div>
              </div>

              <div className="col" style={{ gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                  Starting URL <span style={{ color: 'var(--clay)' }}>*</span>
                </label>
                {projectUrls.length > 0 ? (
                  <div className="col" style={{ gap: 8 }}>
                    <select
                      className="field"
                      value={useCustomUrl ? '__custom__' : rootUrl}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setUseCustomUrl(true);
                        } else {
                          setUseCustomUrl(false);
                          setRootUrl(e.target.value);
                        }
                      }}
                    >
                      {projectUrls.map((url) => (
                        <option key={url.id} value={url.url}>
                          {url.title ? `${url.title} — ${url.url}` : url.url}
                        </option>
                      ))}
                      <option value="__custom__">Enter a custom URL…</option>
                    </select>
                    {useCustomUrl && (
                      <input
                        type="url"
                        className="field mono"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://example.com/custom-page"
                        autoFocus
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="url"
                    className="field mono"
                    value={rootUrl}
                    onChange={(e) => setRootUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div className="col" style={{ gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                    Max depth
                  </label>
                  <select
                    className="field"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                  >
                    <option value={1}>1 level</option>
                    <option value={2}>2 levels</option>
                    <option value={3}>3 levels (recommended)</option>
                    <option value={5}>5 levels</option>
                  </select>
                  <p className="dim" style={{ margin: 0, fontSize: 11 }}>
                    How deep to follow links from the root.
                  </p>
                </div>
                <div className="col" style={{ gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                    Max pages
                  </label>
                  <select
                    className="field"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                  >
                    <option value={25}>25 pages</option>
                    <option value={50}>50 pages (recommended)</option>
                    <option value={100}>100 pages</option>
                    <option value={200}>200 pages</option>
                  </select>
                  <p className="dim" style={{ margin: 0, fontSize: 11 }}>
                    Maximum pages to discover.
                  </p>
                </div>
              </div>

              {authFlows.length === 0 && !loadingAuthFlows && (
                <div
                  style={{
                    background: 'var(--amber-soft)',
                    border: '1px solid var(--amber-edge)',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <Unlock size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                        No authentication configured
                      </div>
                      <p className="dim" style={{ margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.55 }}>
                        Only public pages will be discovered. To find pages behind login, set up an authentication flow first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {authFlows.length > 0 && (
                <div
                  style={{
                    background: 'var(--amber-soft)',
                    border: '1px solid var(--amber-edge)',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    {selectedAuthFlowId ? (
                      <Lock size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <Unlock size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                        Authenticated discovery
                      </div>
                      <p className="dim" style={{ margin: '4px 0 8px', fontSize: 11.5, lineHeight: 1.55 }}>
                        Select an auth flow to discover pages that require login.
                      </p>
                      <select
                        className="field"
                        value={selectedAuthFlowId}
                        onChange={(e) => setSelectedAuthFlowId(e.target.value)}
                        disabled={loadingAuthFlows}
                      >
                        <option value="">No authentication (public pages only)</option>
                        {authFlows.map((flow) => (
                          <option key={flow.id} value={flow.id}>
                            {flow.name} ({flow.loginUrl})
                          </option>
                        ))}
                      </select>
                      {selectedAuthFlowId && (
                        <p className="row" style={{ gap: 4, margin: '6px 0 0', fontSize: 11.5, color: 'var(--moss)', alignItems: 'center' }}>
                          <CheckCircle2 size={11} />
                          Will log in before crawling to discover protected pages
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {showProgress && (
            <div className="modal-body col" style={{ gap: 16 }}>
              <div className="col" style={{ gap: 8 }}>
                {DISCOVERY_PHASES.map((phase) => {
                  const status = getPhaseStatus(phase.id);
                  const Icon = phase.icon;
                  let bg = 'var(--surface-2)';
                  let fg = 'var(--ink-3)';
                  let edge = 'var(--hair)';
                  let textColor = 'var(--ink-3)';
                  let textWeight = 500;
                  if (status === 'completed') {
                    bg = 'var(--moss-soft)';
                    fg = 'var(--moss)';
                    edge = 'var(--moss-edge)';
                    textColor = 'var(--moss)';
                  } else if (status === 'active') {
                    bg = 'var(--info-soft)';
                    fg = 'var(--info)';
                    edge = 'var(--info-edge)';
                    textColor = 'var(--ink)';
                    textWeight = 600;
                  } else if (status === 'error') {
                    bg = 'var(--clay-soft)';
                    fg = 'var(--clay)';
                    edge = 'var(--clay-edge)';
                    textColor = 'var(--clay)';
                  }
                  return (
                    <div key={phase.id} className="row" style={{ alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          background: bg,
                          color: fg,
                          border: `1px solid ${edge}`,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {status === 'completed' ? (
                          <CheckCircle2 size={14} />
                        ) : status === 'active' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : status === 'error' ? (
                          <AlertCircle size={14} />
                        ) : (
                          <Icon size={14} />
                        )}
                      </span>
                      <span style={{ fontSize: 12.5, color: textColor, fontWeight: textWeight }}>
                        {phase.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="row dim tabular" style={{ justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span>{activeDiscovery?.pagesFound || 0} pages found</span>
                  <span>
                    {activeDiscovery?.maxPages
                      ? `${Math.round(((activeDiscovery.pagesFound || 0) / activeDiscovery.maxPages) * 100)}%`
                      : ''}
                    {elapsedSeconds > 0 ? ` · ${elapsedSeconds}s` : ''}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: 'var(--surface-2)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${activeDiscovery?.maxPages
                        ? Math.min(100, Math.round(((activeDiscovery.pagesFound || 0) / activeDiscovery.maxPages) * 100))
                        : 0}%`,
                      background: 'var(--info)',
                      transition: 'width .5s ease',
                    }}
                  />
                </div>
              </div>

              {activeDiscovery?.discoveredUrls && activeDiscovery.discoveredUrls.length > 0 && (
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                    borderRadius: 6,
                    padding: 10,
                    maxHeight: 160,
                    overflowY: 'auto',
                  }}
                >
                  <div className="dim" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                    Recent pages
                  </div>
                  <div className="col" style={{ gap: 3 }}>
                    {activeDiscovery.discoveredUrls.slice(-8).reverse().map((url, idx) => (
                      <div key={idx} className="row mono" style={{ gap: 6, fontSize: 11, color: 'var(--ink-2)' }}>
                        <Globe size={11} style={{ flexShrink: 0, color: 'var(--info)' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(() => { try { return new URL(url).pathname; } catch { return url; } })()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showStopConfirm && (
                <div
                  style={{
                    background: 'var(--amber-soft)',
                    border: '1px solid var(--amber-edge)',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <StopCircle size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                        Stop discovery?
                      </div>
                      <p className="dim" style={{ margin: '4px 0 10px', fontSize: 11.5 }}>
                        {activeDiscovery?.pagesFound || 0} URLs found so far will be saved.
                      </p>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setShowStopConfirm(false)}
                          disabled={isCancelling}
                          className="btn btn-ghost btn-sm"
                          style={isCancelling ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                        >
                          Continue discovery
                        </button>
                        <button
                          type="button"
                          onClick={handleStopDiscovery}
                          disabled={isCancelling}
                          className="btn btn-danger btn-sm"
                          style={isCancelling ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                        >
                          {isCancelling ? (
                            <>
                              <Loader2 size={11} className="animate-spin" />
                              <span>Stopping…</span>
                            </>
                          ) : (
                            <span>Stop & save</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {showError && (
            <div className="modal-body">
              <div
                style={{
                  background: 'var(--clay-soft)',
                  border: '1px solid var(--clay-edge)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div className="row" style={{ alignItems: 'center', gap: 8, color: 'var(--clay)' }}>
                  <AlertCircle size={16} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Discovery failed</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--clay)' }}>
                  {discoveryError}
                </p>
              </div>
            </div>
          )}

          {showResults && siteMapData && (
            <div className="col" style={{ flex: 1, minHeight: 0 }}>
              <div
                style={{
                  padding: 14,
                  background: 'var(--moss-soft)',
                  borderBottom: '1px solid var(--moss-edge)',
                }}
              >
                <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--moss)', marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                      Discovery complete — {siteMapData.nodes.length} pages found
                    </div>
                    <p className="dim" style={{ margin: '4px 0 0', fontSize: 11.5 }}>
                      <strong style={{ color: 'var(--ink)' }}>Next step:</strong> select pages to add, then click "Add pages".
                    </p>
                    {onAnalyzePages && (
                      <button
                        type="button"
                        onClick={() => {
                          const urls = siteMapData.nodes
                            .filter(n => selectedNodes.includes(n.id))
                            .map(n => n.url);
                          onAnalyzePages(urls);
                        }}
                        disabled={selectedNodes.length === 0}
                        className="btn btn-success btn-sm"
                        style={{
                          marginTop: 8,
                          ...(selectedNodes.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                        }}
                      >
                        <Search size={11} />
                        <span>
                          Analyze {selectedNodes.length} selected page{selectedNodes.length !== 1 ? 's' : ''} for elements
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="row"
                style={{
                  padding: 12,
                  borderBottom: '1px solid var(--hair)',
                  background: 'var(--surface-2)',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    <strong style={{ color: 'var(--ink)' }}>{selectedNodes.length}</strong> of {siteMapData.nodes.length} pages selected
                  </span>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="btn btn-ghost btn-sm"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectNone}
                      className="btn btn-ghost btn-sm"
                    >
                      Select none
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 400, background: 'var(--bone)' }}>
                <SiteMapGraph
                  nodes={siteMapData.nodes}
                  edges={siteMapData.edges}
                  selectedNodes={selectedNodes}
                  onNodeSelect={handleNodeSelect}
                  selectable
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
          >
            {showProgress ? 'Close' : 'Cancel'}
          </button>
          <div className="row" style={{ gap: 6 }}>
            {showResults && (
              <button
                type="button"
                onClick={() => {
                  clearDiscovery();
                  setSiteMapData(null);
                  setSelectedNodes([]);
                }}
                className="btn btn-ghost"
              >
                Start over
              </button>
            )}
            {showForm && (
              <button
                type="button"
                onClick={handleStartDiscovery}
                disabled={useCustomUrl ? !customUrl.trim() : !rootUrl.trim()}
                className="btn btn-primary"
                style={
                  (useCustomUrl ? !customUrl.trim() : !rootUrl.trim())
                    ? { opacity: 0.5, cursor: 'not-allowed' }
                    : undefined
                }
              >
                <Search size={13} />
                <span>Start discovery</span>
              </button>
            )}
            {showProgress && (
              <>
                <button
                  type="button"
                  onClick={() => setShowStopConfirm(true)}
                  className="btn btn-outline"
                  style={{ color: 'var(--clay)', borderColor: 'var(--clay-edge)' }}
                >
                  <StopCircle size={13} />
                  <span>Stop discovery</span>
                </button>
                <button
                  type="button"
                  onClick={handleMinimize}
                  className="btn btn-primary"
                >
                  <Minimize2 size={13} />
                  <span>Minimize</span>
                </button>
              </>
            )}
            {showError && (
              <button
                type="button"
                onClick={() => {
                  clearDiscovery();
                  setSiteMapData(null);
                }}
                className="btn btn-primary"
              >
                <Search size={13} />
                <span>Try again</span>
              </button>
            )}
            {showResults && (
              <button
                type="button"
                onClick={handleConfirmSelection}
                disabled={selectedNodes.length === 0}
                className="btn btn-success"
                style={selectedNodes.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <CheckCircle2 size={14} />
                <span>Add {selectedNodes.length} pages</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiscoveryModal;
