import { useState, useEffect } from 'react';
import { X, Search, Loader2, CheckCircle, AlertCircle, Globe, Map, Link as LinkIcon, Database, Minimize2, Lock, Unlock } from 'lucide-react';
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
  const { activeDiscovery, startBackgroundDiscovery, minimizeDiscovery, clearDiscovery } = useDiscoveryContext();

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
    const phaseOrder = ['initialization', 'connectivity', 'sitemap', 'crawling', 'saving', 'complete'];
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {showResults ? 'Discovery Results' : showProgress ? 'Discovering Pages...' : 'Discover Pages'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {showProgress
                ? `${activeDiscovery?.pagesFound || 0} pages found so far`
                : showResults
                ? `${siteMapData?.nodes.length || 0} pages discovered`
                : 'Automatically find pages on your website'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Minimize button — during discovery */}
            {showProgress && (
              <button
                onClick={handleMinimize}
                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                title="Minimize — discovery continues in background"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showForm && (
            /* Discovery Form */
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">Smart Discovery</h3>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Enter your website URL and we'll automatically discover all pages using sitemaps and link crawling.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Starting URL <span className="text-red-500">*</span>
                </label>
                {projectUrls.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={useCustomUrl ? '__custom__' : rootUrl}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setUseCustomUrl(true);
                        } else {
                          setUseCustomUrl(false);
                          setRootUrl(e.target.value);
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {projectUrls.map((url) => (
                        <option key={url.id} value={url.url}>
                          {url.title ? `${url.title} - ${url.url}` : url.url}
                        </option>
                      ))}
                      <option value="__custom__">Enter a custom URL...</option>
                    </select>
                    {useCustomUrl && (
                      <input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://example.com/custom-page"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="url"
                    value={rootUrl}
                    onChange={(e) => setRootUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Depth</label>
                  <select
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 level</option>
                    <option value={2}>2 levels</option>
                    <option value={3}>3 levels (recommended)</option>
                    <option value={5}>5 levels</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How deep to follow links from the root</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Pages</label>
                  <select
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={25}>25 pages</option>
                    <option value={50}>50 pages (recommended)</option>
                    <option value={100}>100 pages</option>
                    <option value={200}>200 pages</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum pages to discover</p>
                </div>
              </div>

              {/* Auth Flow Selector */}
              {authFlows.length === 0 && !loadingAuthFlows && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Unlock className="w-5 h-5 text-amber-500 dark:text-amber-400 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">No Authentication Configured</h3>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Only public pages will be discovered. To find pages behind login, set up an authentication flow first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {authFlows.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {selectedAuthFlowId ? (
                      <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    ) : (
                      <Unlock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200">Authenticated Discovery</h3>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 mb-3">
                        Select an auth flow to discover pages that require login
                      </p>
                      <select
                        value={selectedAuthFlowId}
                        onChange={(e) => setSelectedAuthFlowId(e.target.value)}
                        disabled={loadingAuthFlows}
                        className="w-full px-3 py-2 text-sm border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">No authentication (public pages only)</option>
                        {authFlows.map((flow) => (
                          <option key={flow.id} value={flow.id}>
                            {flow.name} ({flow.loginUrl})
                          </option>
                        ))}
                      </select>
                      {selectedAuthFlowId && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
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
            /* Discovery Progress View */
            <div className="p-6 space-y-6">
              {/* Phase Progress */}
              <div className="space-y-3">
                {DISCOVERY_PHASES.map((phase) => {
                  const status = getPhaseStatus(phase.id);
                  const Icon = phase.icon;
                  return (
                    <div key={phase.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        status === 'completed' ? 'bg-green-100 dark:bg-green-900/40' :
                        status === 'active' ? 'bg-blue-100 dark:bg-blue-900/40' :
                        status === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                        'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        {status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : status === 'active' ? (
                          <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                        ) : status === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        ) : (
                          <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                      <span className={`text-sm ${
                        status === 'completed' ? 'text-green-700 dark:text-green-300' :
                        status === 'active' ? 'text-blue-700 dark:text-blue-300 font-medium' :
                        status === 'error' ? 'text-red-700 dark:text-red-300' :
                        'text-gray-400 dark:text-gray-500'
                      }`}>
                        {phase.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>{activeDiscovery?.pagesFound || 0} pages found</span>
                  <span>
                    {activeDiscovery?.maxPages
                      ? `${Math.round(((activeDiscovery.pagesFound || 0) / activeDiscovery.maxPages) * 100)}%`
                      : ''}
                    {elapsedSeconds > 0 ? ` · ${elapsedSeconds}s` : ''}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${activeDiscovery?.maxPages
                        ? Math.min(100, Math.round(((activeDiscovery.pagesFound || 0) / activeDiscovery.maxPages) * 100))
                        : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Recently discovered URLs */}
              {activeDiscovery?.discoveredUrls && activeDiscovery.discoveredUrls.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recent pages:</div>
                  <div className="space-y-1">
                    {activeDiscovery.discoveredUrls.slice(-8).reverse().map((url, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Globe className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{(() => { try { return new URL(url).pathname; } catch { return url; } })()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {showError && (
            /* Error View */
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Discovery failed</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{discoveryError}</p>
              </div>
            </div>
          )}

          {showResults && siteMapData && (
            /* Site Map Results View */
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-900 dark:text-green-100">
                      Discovery Complete — {siteMapData.nodes.length} pages found!
                    </h3>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      <strong>Next step:</strong> Select pages to add, then click "Add Pages".
                    </p>
                    {onAnalyzePages && (
                      <button
                        onClick={() => {
                          const urls = siteMapData.nodes
                            .filter(n => selectedNodes.includes(n.id))
                            .map(n => n.url);
                          onAnalyzePages(urls);
                        }}
                        disabled={selectedNodes.length === 0}
                        className="mt-2 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        <Search className="w-3 h-3" />
                        Analyze {selectedNodes.length} selected page{selectedNodes.length !== 1 ? 's' : ''} for elements
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Selection Controls */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    <strong>{selectedNodes.length}</strong> of {siteMapData.nodes.length} pages selected
                  </span>
                  <div className="flex gap-2">
                    <button onClick={handleSelectAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      Select All
                    </button>
                    <span className="text-gray-300 dark:text-gray-500">|</span>
                    <button onClick={handleSelectNone} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      Select None
                    </button>
                  </div>
                </div>
              </div>

              {/* Graph */}
              <div className="flex-1 min-h-[400px]">
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
          >
            {showProgress ? 'Close' : 'Cancel'}
          </button>
          <div className="flex gap-3">
            {showResults && (
              <button
                onClick={() => {
                  clearDiscovery();
                  setSiteMapData(null);
                  setSelectedNodes([]);
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
              >
                Start Over
              </button>
            )}
            {showForm && (
              <button
                onClick={handleStartDiscovery}
                disabled={useCustomUrl ? !customUrl.trim() : !rootUrl.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Start Discovery
              </button>
            )}
            {showProgress && (
              <button
                onClick={handleMinimize}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Minimize2 className="w-4 h-4" />
                Minimize
              </button>
            )}
            {showError && (
              <button
                onClick={() => {
                  clearDiscovery();
                  setSiteMapData(null);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Try Again
              </button>
            )}
            {showResults && (
              <button
                onClick={handleConfirmSelection}
                disabled={selectedNodes.length === 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Add {selectedNodes.length} Pages
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiscoveryModal;
