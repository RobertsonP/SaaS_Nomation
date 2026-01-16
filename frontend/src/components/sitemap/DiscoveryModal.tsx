import { useState } from 'react';
import { X, Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { SiteMapGraph } from './SiteMapGraph';
import { useDiscovery, useSiteMapData, SiteMapNodeData, SiteMapEdgeData } from './useSiteMapData';

interface DiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialUrl?: string;
  onDiscoveryComplete?: (selectedUrlIds: string[]) => void;
}

export function DiscoveryModal({
  isOpen,
  onClose,
  projectId,
  initialUrl = '',
  onDiscoveryComplete,
}: DiscoveryModalProps) {
  const [rootUrl, setRootUrl] = useState(initialUrl);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(50);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [discoveryStarted, setDiscoveryStarted] = useState(false);
  const [siteMapData, setSiteMapData] = useState<{ nodes: SiteMapNodeData[]; edges: SiteMapEdgeData[] } | null>(null);

  const { discovering, error, startDiscovery } = useDiscovery(projectId);
  const { data: existingData, loading: loadingExisting } = useSiteMapData(projectId);

  const handleStartDiscovery = async () => {
    if (!rootUrl.trim()) return;

    try {
      const result = await startDiscovery(rootUrl.trim(), {
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
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
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
                  Root URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={rootUrl}
                  onChange={(e) => setRootUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
                disabled={discovering || !rootUrl.trim()}
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
