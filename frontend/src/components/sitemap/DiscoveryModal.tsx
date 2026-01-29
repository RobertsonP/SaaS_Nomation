import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2, CheckCircle, AlertCircle, Globe, Map, Link as LinkIcon, Database, Minimize2 } from 'lucide-react';
import { SiteMapGraph } from './SiteMapGraph';
import { useDiscovery, useSiteMapData, SiteMapNodeData, SiteMapEdgeData } from './useSiteMapData';

interface DiscoveryPhase {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'completed' | 'error';
}

const DISCOVERY_PHASES: Array<{ id: string; label: string; icon: React.ElementType }> = [
  { id: 'connectivity', label: 'Checking connectivity', icon: Globe },
  { id: 'sitemap', label: 'Looking for sitemap', icon: Map },
  { id: 'crawling', label: 'Crawling pages', icon: LinkIcon },
  { id: 'saving', label: 'Saving results', icon: Database },
];

/**
 * Normalize URL by adding protocol if missing
 * Uses http:// for localhost/127.0.0.1/private IPs, https:// for all others
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();

  // Already has protocol
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Check if it's a local/private address that should use http://
  const localPatterns = [
    /^localhost(:\d+)?/i,
    /^127\.0\.0\.1(:\d+)?/,
    /^192\.168\.\d+\.\d+(:\d+)?/,
    /^10\.\d+\.\d+\.\d+(:\d+)?/,
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?/,
    /^0\.0\.0\.0(:\d+)?/,
  ];

  const isLocal = localPatterns.some(pattern => pattern.test(trimmed));
  const protocol = isLocal ? 'http://' : 'https://';

  return protocol + trimmed;
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
  initialUrl?: string;
  projectUrls?: ProjectUrl[];
  onDiscoveryComplete?: (selectedUrlIds: string[]) => void;
  onAnalyzePages?: (selectedUrlIds: string[]) => void;
}

export function DiscoveryModal({
  isOpen,
  onClose,
  onMinimize,
  projectId,
  initialUrl = '',
  projectUrls = [],
  onDiscoveryComplete,
  onAnalyzePages,
}: DiscoveryModalProps) {
  const [rootUrl, setRootUrl] = useState(initialUrl);
  const [useCustomUrl, setUseCustomUrl] = useState(!initialUrl && projectUrls.length === 0);
  const [customUrl, setCustomUrl] = useState('');
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(50);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [discoveryStarted, setDiscoveryStarted] = useState(false);
  const [siteMapData, setSiteMapData] = useState<{ nodes: SiteMapNodeData[]; edges: SiteMapEdgeData[] } | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [pagesFound, setPagesFound] = useState(0);
  const progressPollRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<number>(3000); // Start at 3 seconds
  const errorCountRef = useRef<number>(0);
  const [pollError, setPollError] = useState<string | null>(null);

  const { discovering, error, startDiscovery, progress, checkProgress } = useDiscovery(projectId);
  const { data: existingData, loading: loadingExisting } = useSiteMapData(projectId);

  // Poll for discovery progress during discovery with exponential backoff
  useEffect(() => {
    if (discovering && projectId) {
      // Reset polling state when starting
      pollIntervalRef.current = 3000; // Start at 3 seconds
      errorCountRef.current = 0;
      setPollError(null);

      const pollProgress = async () => {
        try {
          const progressData = await checkProgress();
          if (progressData) {
            // Success - reset backoff
            pollIntervalRef.current = 3000;
            errorCountRef.current = 0;
            setPollError(null);

            setCurrentPhase(progressData.phase);
            setPagesFound(progressData.discoveredUrls);
            // Track discovered URLs for live display
            if (progressData.urls && progressData.urls.length > 0) {
              setDiscoveredUrls(progressData.urls);
            }

            // Stop polling when complete or failed
            if (progressData.status === 'complete' || progressData.status === 'failed') {
              if (progressPollRef.current) {
                clearTimeout(progressPollRef.current);
                progressPollRef.current = null;
              }
              return;
            }
          }
        } catch (err) {
          // Exponential backoff on errors (3s -> 6s -> 12s -> max 30s)
          errorCountRef.current += 1;
          pollIntervalRef.current = Math.min(pollIntervalRef.current * 2, 30000);

          // Show error after 3 consecutive failures
          if (errorCountRef.current >= 3) {
            setPollError(`Connection issues (retrying every ${Math.round(pollIntervalRef.current / 1000)}s)...`);
          }

          // Stop polling after 10 consecutive failures
          if (errorCountRef.current >= 10) {
            setPollError('Unable to check progress. The discovery may still be running in the background.');
            if (progressPollRef.current) {
              clearTimeout(progressPollRef.current);
              progressPollRef.current = null;
            }
            return;
          }
        }

        // Schedule next poll with current interval
        progressPollRef.current = setTimeout(pollProgress, pollIntervalRef.current);
      };

      // Start first poll
      progressPollRef.current = setTimeout(pollProgress, pollIntervalRef.current);

      return () => {
        if (progressPollRef.current) {
          clearTimeout(progressPollRef.current);
          progressPollRef.current = null;
        }
      };
    }
  }, [discovering, projectId, checkProgress]);

  // Compute phase statuses based on current phase
  const getPhaseStatus = (phaseId: string): 'pending' | 'active' | 'completed' | 'error' => {
    if (error && currentPhase === phaseId) return 'error';
    const phaseOrder = ['connectivity', 'sitemap', 'crawling', 'saving', 'complete'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const phaseIndex = phaseOrder.indexOf(phaseId);
    if (currentIndex === -1) return 'pending';
    if (phaseIndex < currentIndex) return 'completed';
    if (phaseIndex === currentIndex) return 'active';
    return 'pending';
  };

  const handleStartDiscovery = async () => {
    const urlToUse = useCustomUrl ? customUrl : rootUrl;
    if (!urlToUse.trim()) return;

    // Reset progress tracking
    setCurrentPhase('initialization');
    setPagesFound(0);
    setDiscoveredUrls([]);

    try {
      // Normalize URL - auto-add protocol if missing
      const normalizedUrl = normalizeUrl(urlToUse);
      const result = await startDiscovery(normalizedUrl, {
        maxDepth,
        maxPages,
        useSitemap: true,
      });

      if (result && result.pages) {
        // Transform pages to nodes format
        const nodes: SiteMapNodeData[] = result.pages.map((page: {
          url: string;
          title: string;
          pageType: string;
          requiresAuth: boolean;
          depth: number;
        }, index: number) => ({
          id: `discovered-${index}`,
          url: page.url,
          title: page.title || 'Discovered Page',
          analyzed: false,
          verified: false,
          requiresAuth: page.requiresAuth,
          pageType: page.pageType,
          discovered: true,
          depth: page.depth,
        }));

        // Transform relationships to edges format
        const edges: SiteMapEdgeData[] = (result.relationships || []).map((rel: {
          sourceUrl: string;
          targetUrl: string;
          linkText: string;
          linkType: string;
        }, index: number) => ({
          id: `edge-${index}`,
          source: nodes.find(n => n.url === rel.sourceUrl)?.id || '',
          target: nodes.find(n => n.url === rel.targetUrl)?.id || '',
          linkText: rel.linkText,
          linkType: rel.linkType,
        })).filter((e: SiteMapEdgeData) => e.source && e.target);

        setSiteMapData({ nodes, edges });
        setDiscoveryStarted(true);
        // Select all nodes by default
        setSelectedNodes(nodes.map(n => n.id));
      }
    } catch {
      // Error is handled by the hook
    }
  };

  const handleNodeSelect = (nodeId: string, selected: boolean) => {
    if (selected) {
      setSelectedNodes(prev => [...prev, nodeId]);
    } else {
      setSelectedNodes(prev => prev.filter(id => id !== nodeId));
    }
  };

  const handleSelectAll = () => {
    if (siteMapData) {
      setSelectedNodes(siteMapData.nodes.map(n => n.id));
    }
  };

  const handleSelectNone = () => {
    setSelectedNodes([]);
  };

  const handleConfirmSelection = () => {
    onDiscoveryComplete?.(selectedNodes);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Discover Pages</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Automatically find pages on your website</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Minimize button - only show during discovery */}
            {discovering && onMinimize && (
              <button
                onClick={onMinimize}
                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                title="Minimize - discovery will continue in background"
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
          {!discoveryStarted ? (
            /* Discovery Form */
            <div className="p-6 space-y-6">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Depth
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Pages
                  </label>
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

              {/* Discovery Progress Display */}
              {discovering && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Discovery in progress...</span>
                    {pagesFound > 0 && (
                      <span className="text-sm text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded-full">
                        {pagesFound} pages found
                      </span>
                    )}
                  </div>

                  {/* Phase Progress Steps */}
                  <div className="space-y-2">
                    {DISCOVERY_PHASES.map((phase) => {
                      const status = getPhaseStatus(phase.id);
                      const Icon = phase.icon;
                      return (
                        <div key={phase.id} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            status === 'completed' ? 'bg-green-500' :
                            status === 'active' ? 'bg-blue-500' :
                            status === 'error' ? 'bg-red-500' :
                            'bg-gray-300 dark:bg-gray-600'
                          }`}>
                            {status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 text-white" />
                            ) : status === 'active' ? (
                              <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : status === 'error' ? (
                              <AlertCircle className="w-4 h-4 text-white" />
                            ) : (
                              <Icon className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                            )}
                          </div>
                          <span className={`text-sm ${
                            status === 'completed' ? 'text-green-700 dark:text-green-300' :
                            status === 'active' ? 'text-blue-700 dark:text-blue-300 font-medium' :
                            status === 'error' ? 'text-red-700 dark:text-red-300' :
                            'text-gray-500 dark:text-gray-400'
                          }`}>
                            {phase.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live URL Discovery List */}
                  {discoveredUrls.length > 0 && (
                    <details className="mt-4" open>
                      <summary className="text-xs font-medium text-blue-800 dark:text-blue-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-100">
                        View discovered URLs ({discoveredUrls.length})
                      </summary>
                      <div className="mt-2 max-h-32 overflow-y-auto bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                        {discoveredUrls.slice(-10).map((url, idx) => (
                          <div
                            key={idx}
                            className="px-2 py-1 text-xs text-blue-700 dark:text-blue-300 border-b border-blue-100 dark:border-blue-800 last:border-b-0 truncate"
                          >
                            {url}
                          </div>
                        ))}
                        {discoveredUrls.length > 10 && (
                          <div className="px-2 py-1 text-xs text-blue-500 dark:text-blue-400 italic">
                            ...and {discoveredUrls.length - 10} more
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {pollError && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{pollError}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Discovery failed</span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
                </div>
              )}
            </div>
          ) : (
            /* Site Map View */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Next Steps Guidance Panel */}
              <div className="p-4 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-900 dark:text-green-100">
                      Discovery Complete - {siteMapData?.nodes.length || 0} pages found!
                    </h3>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      <strong>Next step:</strong> Select the pages you want to add to your project, then click "Add Pages".
                      After adding, you can analyze these pages to find clickable elements for testing.
                    </p>
                    {onAnalyzePages && (
                      <button
                        onClick={() => {
                          onAnalyzePages(selectedNodes);
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
                    <strong>{selectedNodes.length}</strong> of {siteMapData?.nodes.length || 0} pages selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300 dark:text-gray-500">|</span>
                    <button
                      onClick={handleSelectNone}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Select None
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-gray-600 dark:text-gray-300">Click nodes to select/deselect</span>
                </div>
              </div>

              {/* Graph */}
              <div className="flex-1 min-h-[400px]">
                {siteMapData && (
                  <SiteMapGraph
                    nodes={siteMapData.nodes}
                    edges={siteMapData.edges}
                    selectedNodes={selectedNodes}
                    onNodeSelect={handleNodeSelect}
                    selectable
                    className="w-full h-full"
                  />
                )}
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
            Cancel
          </button>
          <div className="flex gap-3">
            {discoveryStarted && (
              <button
                onClick={() => {
                  setDiscoveryStarted(false);
                  setSiteMapData(null);
                  setSelectedNodes([]);
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
              >
                Start Over
              </button>
            )}
            {!discoveryStarted ? (
              <button
                onClick={handleStartDiscovery}
                disabled={discovering || (useCustomUrl ? !customUrl.trim() : !rootUrl.trim())}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {discovering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Start Discovery
                  </>
                )}
              </button>
            ) : (
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
