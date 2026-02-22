import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsAPI, authFlowsAPI, analyzeProjectPages } from '../../lib/api';
import { ElementLibraryPanel } from '../../components/test-builder/ElementLibraryPanel';
import { AnalysisProgressModal } from '../../components/analysis/AnalysisProgressModal';
import { AnalysisFloatingIndicator } from '../../components/analysis/AnalysisFloatingIndicator';
import { SimplifiedAuthSetup } from '../../components/auth/SimplifiedAuthSetup';
import { SiteMapGraph, useSiteMapData, DiscoveryModal } from '../../components/sitemap';
import { useNotification } from '../../contexts/NotificationContext';
import { useDiscoveryContext } from '../../contexts/DiscoveryContext';
import { useDiscoveryProgress } from '../../hooks/useDiscoveryProgress';
import { ProjectElement } from '../../types/element.types';
import { createLogger } from '../../lib/logger';
import { useUrlManagement } from './hooks';
import { useAnalysisProgress } from '../../hooks/useAnalysisProgress';
import { ProjectOverviewTab, ProjectUrlsTab, ProjectSiteMapTab, ProjectAuthTab } from './components';

const logger = createLogger('ProjectDetails');

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

/**
 * Normalize URL for comparison to prevent duplicates
 * - Removes trailing slashes
 * - Normalizes 127.0.0.1 to localhost
 * - Removes www. prefix
 * - Lowercases for comparison
 */
function normalizeUrlForComparison(url: string): string {
  try {
    const urlObj = new URL(url);
    let normalized = urlObj.origin + urlObj.pathname;

    // Remove trailing slash (except for root path)
    if (normalized.endsWith('/') && normalized !== urlObj.origin + '/') {
      normalized = normalized.slice(0, -1);
    }

    // Normalize 127.0.0.1 to localhost
    normalized = normalized.replace('://127.0.0.1', '://localhost');

    // Remove www.
    normalized = normalized.replace('://www.', '://');

    // Lowercase for case-insensitive comparison
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  description?: string;
  analyzed: boolean;
  analysisDate?: string;
  verified: boolean;
  lastVerified?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  urls: ProjectUrl[];
  elements: ProjectElement[];
  _count: {
    tests: number;
    elements: number;
    urls: number;
  };
}

export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { showSuccess, showError } = useNotification();
  const { activeDiscovery, isMinimized } = useDiscoveryContext();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sitemap' | 'urls' | 'elements' | 'auth'>('overview');
  const [selectedElementType, setSelectedElementType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]); // URL IDs for selective analysis

  // URL Management State
  const [showUrlManager, setShowUrlManager] = useState(false);

  // Authentication and analysis state
  const [authFlows, setAuthFlows] = useState<any[]>([]);
  const [showElementLibrary, setShowElementLibrary] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [isAnalysisMinimized, setIsAnalysisMinimized] = useState(false);
  const [showLivePicker, setShowLivePicker] = useState(false);
  const [elementsKey, setElementsKey] = useState(0);

  // Analysis dashboard state
  const [showAnalysisDashboard, setShowAnalysisDashboard] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [analysisMetrics, setAnalysisMetrics] = useState<any>(null);

  // Test execution stats state
  const [testStats, setTestStats] = useState<{
    totalExecutions: number;
    totalPassed: number;
    totalFailed: number;
    regressions: number;
    successRate: number;
  } | null>(null);

  // Auth setup state
  const [showAuthSetup, setShowAuthSetup] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [editingAuthFlow, setEditingAuthFlow] = useState<{id: string; data: any} | null>(null);

  // Site Map state
  const [showSiteMap, setShowSiteMap] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const { data: siteMapData, loading: siteMapLoading, refetch: refetchSiteMap } = useSiteMapData(projectId);

  // Auto-show discovery modal when floating indicator is restored (minimize → restore)
  const wasMinimizedRef = useRef(false);
  useEffect(() => {
    if (isMinimized) {
      wasMinimizedRef.current = true;
    } else if (wasMinimizedRef.current && activeDiscovery && activeDiscovery.projectId === projectId) {
      wasMinimizedRef.current = false;
      setShowDiscoveryModal(true);
    }
  }, [isMinimized, activeDiscovery, projectId]);

  // Technical details state
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Load project function (memoized for hooks)
  const loadProject = useCallback(async () => {
    try {
      const response = await projectsAPI.getById(projectId!);
      setProject(response.data);
    } catch (error) {
      logger.error('Failed to load project', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load analysis dashboard data
  const loadAnalysisDashboard = useCallback(() => {
    loadAnalysisHistory();
    loadAnalysisMetrics();
  }, []);

  // Local busy state for non-WebSocket operations (e.g., clearing elements)
  const [analyzing, setAnalyzing] = useState(false);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState('Ready');

  // Unified analysis progress (single WebSocket connection)
  const analysisProgress = useAnalysisProgress({
    projectId,
    onComplete: () => {
      loadProject();
      setElementsKey(prev => prev + 1);
      loadAnalysisDashboard();
    },
    onError: (msg) => showError('Analysis Error', msg),
  });

  // Derived state combining local busy state with WebSocket progress
  const isAnalysisRunning = analysisProgress.isRunning || analyzing;
  const analysisProgressPercent = analysisProgress.isRunning ? analysisProgress.overallPercent : (analyzing ? 0 : 100);
  const analysisLogs = analysisProgress.rawEvents.map(e => ({
    timestamp: new Date(e.timestamp).toLocaleTimeString(),
    level: e.status === 'error' ? 'ERROR' : e.status === 'completed' ? 'SUCCESS' : 'PROGRESS',
    message: e.friendlyMessage || e.message || 'Processing...',
  }));

  // Discovery progress (WebSocket-based real-time updates)
  const discoveryProgress = useDiscoveryProgress({
    projectId,
    onComplete: () => {
      refetchSiteMap();
      loadProject();
    },
  });

  // URL management hook
  const {
    newUrl,
    setNewUrl,
    addingUrl,
    verifyingUrl,
    handleAddUrl,
    handleRemoveUrl,
    handleVerifyUrl,
  } = useUrlManagement({
    projectId,
    projectUrls: project?.urls || [],
    onProjectReload: loadProject,
    showSuccess,
    showError,
  });

  useEffect(() => {
    loadProject();
    loadAuthFlows();
    loadTestStats();
    if (showAnalysisDashboard) {
      loadAnalysisHistory();
      loadAnalysisMetrics();
    }
  }, [projectId, showAnalysisDashboard, loadProject]);

  const loadTestStats = async () => {
    try {
      const stats = await projectsAPI.getTestStats(projectId!);
      setTestStats(stats);
    } catch (error) {
      logger.error('Failed to load test stats', error);
      setTestStats(null);
    }
  };

  const loadAuthFlows = async () => {
    try {
      const response = await authFlowsAPI.getByProject(projectId!);
      setAuthFlows(response.data);
    } catch (error) {
      logger.error('Failed to load auth flows', error);
      setAuthFlows([]);
    }
  };

  // NEW: Load analysis history for dashboard
  const loadAnalysisHistory = async () => {
    try {
      const history = await projectsAPI.getAnalysisHistory(projectId!);
      setAnalysisHistory(history);
    } catch (error) {
      logger.error('Failed to load analysis history', error);
      setAnalysisHistory([]);
    }
  };

  // NEW: Load analysis metrics for dashboard
  const loadAnalysisMetrics = async () => {
    try {
      const metrics = await projectsAPI.getAnalysisMetrics(projectId!);
      setAnalysisMetrics(metrics);
    } catch (error) {
      logger.error('Failed to load analysis metrics', error);
      setAnalysisMetrics(null);
    }
  };

  // ENHANCED: Selective URL analysis with real-time progress
  const handleAnalyzeSelected = async () => {
    if (!projectId || selectedUrls.length === 0) return;

    // Show progress modal and reset progress state
    setShowAnalysisModal(true);
    setAnalyzing(true);
    analysisProgress.reset();

    // Wait for WebSocket to connect before starting analysis
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Call API with selected URL IDs - now events will be captured
      const result = await analyzeProjectPages(projectId, selectedUrls);

      showSuccess('Analysis Complete', `Analyzed ${selectedUrls.length} URL(s)`);

      // Reload project data
      setTimeout(() => {
        loadProject();
        // Force element library to re-render with new data
        setElementsKey(prev => prev + 1);
        setSelectedUrls([]); // Clear selection
      }, 2000);

    } catch (error: any) {
      logger.error('Analysis error', error);
      showError('Analysis Failed', error.response?.data?.message || 'Failed to analyze URLs');
    } finally {
      setAnalyzing(false);
    }
  };

  // Legacy handler for backward compatibility
  const handleAnalyzeProject = async () => {
    if (!projectId) return;

    // Show progress modal and reset progress state
    setShowAnalysisModal(true);
    analysisProgress.reset();

    // Wait for WebSocket to connect before starting analysis
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Start the analysis - the progress will be tracked via WebSocket
      const result = await analyzeProjectPages(projectId);

      // Reload project to show updated elements after analysis
      setTimeout(() => {
        loadProject();
        // Force element library to re-render with new data
        setElementsKey(prev => prev + 1);
      }, 2000);

    } catch (error) {
      logger.error('Analysis error', error);
      
      // Check if this is a timeout error while WebSocket continues
      if ((error as any)?.code === 'ECONNABORTED' && (error as any)?.message?.includes('timeout')) {
        showError(
          'API Timeout Notice', 
          'The analysis API timed out, but the process may still be running. Check the progress updates below for real-time status.'
        );
      } else {
        showError('Analysis Error', 'Failed to start analysis');
      }
    }
  };

  const handleAnalysisModalClose = () => {
    setShowAnalysisModal(false);
    setIsAnalysisMinimized(false);
    // Reload project to ensure we have the latest data
    loadProject();
    // Force element library to re-render with new data
    setElementsKey(prev => prev + 1);
  };

  const handleAnalysisMinimize = () => {
    setShowAnalysisModal(false);
    setIsAnalysisMinimized(true);
  };

  const handleAnalysisRestore = () => {
    setIsAnalysisMinimized(false);
    setShowAnalysisModal(true);
  };

  const handleAnalysisDismiss = () => {
    setIsAnalysisMinimized(false);
    // Reload project to ensure we have the latest data
    loadProject();
    setElementsKey(prev => prev + 1);
  };

  // NEW: Handle clearing all elements
  const handleClearElements = async () => {
    if (!projectId) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to clear all elements? This will delete all previously found elements and reset analysis status. This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    try {
      setAnalyzing(true);
      setCurrentAnalysisStep('Clearing elements...');
      
      const result = await projectsAPI.clearElements(projectId);
      
      showSuccess('Elements Cleared', `Successfully cleared ${result.elementsDeleted || 0} elements from the project.`);
      
      // Reload project to show updated state
      loadProject();
      
      setCurrentAnalysisStep('Ready for new analysis');
      
    } catch (error) {
      logger.error('Clear elements error', error);
      showError('Clear Error', 'Failed to clear project elements');
    } finally {
      setAnalyzing(false);
    }
  };

  // Authentication CRUD handlers
  const handleAddAuthentication = () => {
    setEditingAuthFlow(null);
    setShowAuthModal(true);
  };

  const handleEditAuthentication = async (authFlow: any) => {
    try {
      // Fetch fresh auth flow data from database to ensure we have latest values
      logger.debug('Fetching latest auth flow data for edit...');
      const response = await authFlowsAPI.getById(authFlow.id);
      const freshAuthFlow = response.data;
      logger.debug('Loaded fresh auth flow data', freshAuthFlow);

      setEditingAuthFlow({
        id: freshAuthFlow.id,
        data: {
          name: freshAuthFlow.name,
          loginUrl: freshAuthFlow.loginUrl,
          username: freshAuthFlow.credentials?.username || '',
          password: freshAuthFlow.credentials?.password || '',
          steps: freshAuthFlow.steps,
          useAutoDetection: freshAuthFlow.useAutoDetection !== undefined ? freshAuthFlow.useAutoDetection : true,
          manualSelectors: freshAuthFlow.manualSelectors || null
        }
      });
      setShowAuthModal(true);
    } catch (error) {
      logger.error('Failed to load auth flow for editing', error);
      showError('Load Failed', 'Failed to load authentication flow. Please try again.');
    }
  };

  const handleDeleteAuthentication = async (authFlowId: string, authFlowName: string) => {
    if (!confirm(`Are you sure you want to delete authentication flow "${authFlowName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await authFlowsAPI.delete(authFlowId);
      showSuccess('Authentication Deleted', `Successfully deleted authentication flow "${authFlowName}"`);
      loadAuthFlows(); // Reload auth flows
    } catch (error) {
      logger.error('Failed to delete auth flow', error);
      showError('Delete Failed', 'Failed to delete authentication flow. Please try again.');
    }
  };

  const handleAuthModalComplete = () => {
    setShowAuthModal(false);
    setEditingAuthFlow(null);
    loadAuthFlows(); // Reload auth flows
    showSuccess(
      editingAuthFlow ? 'Authentication Updated' : 'Authentication Added',
      editingAuthFlow
        ? 'Authentication flow updated successfully'
        : 'Authentication flow added successfully'
    );
  };

  const handleAuthModalCancel = () => {
    setShowAuthModal(false);
    setEditingAuthFlow(null);
  };

  // Filter elements based on type and URL
  const filteredElements = project ? project.elements.filter(element => {
    const matchesType = selectedElementType === 'all' || element.elementType === selectedElementType;
    const matchesUrl = selectedUrl === 'all' || element.sourceUrl?.id === selectedUrl;
    return matchesType && matchesUrl;
  }) : [];

  // Get unique element types for filter dropdown
  const elementTypes = project ? ['all', ...new Set(project.elements.map(e => e.elementType))] : ['all'];

  const getElementTypeColor = (type: string) => {
    switch (type) {
      case 'button': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'input': return 'bg-green-100 text-green-800 border-green-200';
      case 'link': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'form': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'navigation': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'text': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getElementIcon = (type: string) => {
    switch (type) {
      case 'button': return '🔘';
      case 'input': return '📝';
      case 'link': return '🔗';
      case 'form': return '📋';
      case 'navigation': return '🧭';
      case 'text': return '📄';
      default: return '📦';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading project details...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Project not found</h1>
          <Link to="/projects" className="text-blue-600 hover:text-blue-800">
            ← Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link to="/projects" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
              ← Back to Projects
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-2">{project.description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <Link
              to={`/projects/${project.id}/suites`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Test Suites
            </Link>
            <Link
              to={`/projects/${project.id}/tests`}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Tests ({project._count.tests})
            </Link>
            {project.urls.length > 0 ? (
              <Link
                to={`/projects/${project.id}/tests/new`}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Create Test
              </Link>
            ) : (
              <button
                onClick={() => setShowUrlManager(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium"
              >
                Setup Project
              </button>
            )}
          </div>
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div
            className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveTab('urls')}
          >
            <div className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wide">URLs</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{project._count.urls}</div>
          </div>
          <div
            className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveTab('elements')}
          >
            <div className="text-xs font-semibold text-green-900 dark:text-green-200 uppercase tracking-wide">Elements</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{project._count.elements}</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-semibold text-purple-900 dark:text-purple-200 uppercase tracking-wide">Tests</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{project._count.tests}</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-semibold text-orange-900 dark:text-orange-200 uppercase tracking-wide">Analyzed</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              {project.urls.filter(url => url.analyzed).length}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-1" aria-label="Tabs">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'sitemap', label: 'Site Map' },
              { id: 'urls', label: 'URLs' },
              { id: 'elements', label: 'Elements' },
              { id: 'auth', label: 'Authentication' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-5 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 border-t border-l border-r border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 -mb-px'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
                {tab.id === 'urls' && project._count.urls > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                    {project._count.urls}
                  </span>
                )}
                {tab.id === 'elements' && project._count.elements > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                    {project._count.elements}
                  </span>
                )}
                {tab.id === 'auth' && authFlows.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300">
                    {authFlows.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <ProjectOverviewTab
            project={project}
            testStats={testStats}
            analyzing={analyzing}
            currentAnalysisStep={currentAnalysisStep}
            analysisProgressPercent={analysisProgressPercent}
            onSetActiveTab={setActiveTab}
            onShowAnalysisModal={() => setShowAnalysisModal(true)}
          />
        )}

        {/* Site Map Tab */}
        {activeTab === 'sitemap' && (
          <ProjectSiteMapTab
            siteMapData={siteMapData}
            siteMapLoading={siteMapLoading}
            onShowDiscoveryModal={() => {
              if (activeDiscovery?.status === 'discovering') return;
              setShowDiscoveryModal(true);
            }}
          />
        )}

        {/* URLs Tab */}
        {activeTab === 'urls' && (
          <ProjectUrlsTab
            project={project}
            newUrl={newUrl}
            setNewUrl={setNewUrl}
            addingUrl={addingUrl}
            verifyingUrl={verifyingUrl}
            selectedUrls={selectedUrls}
            setSelectedUrls={setSelectedUrls}
            analyzing={analyzing}
            onAddUrl={handleAddUrl}
            onRemoveUrl={handleRemoveUrl}
            onVerifyUrl={handleVerifyUrl}
            onAnalyzeSelected={handleAnalyzeSelected}
            onShowDiscoveryModal={() => {
              if (activeDiscovery?.status === 'discovering') return;
              setShowDiscoveryModal(true);
            }}
          />
        )}

        {/* Elements Tab */}
        {activeTab === 'elements' && (
          <ElementLibraryPanel
            key={elementsKey}
            elements={project.elements}
            onSelectElement={(element) => logger.debug('Element selected', element)}
            selectedElementType={selectedElementType}
            selectedUrl={selectedUrl}
            onElementTypeChange={setSelectedElementType}
            onUrlChange={setSelectedUrl}
            previewMode="auto"
            showQuality={true}
            compact={false}
            isLoading={false}
            setShowLivePicker={setShowLivePicker}
            onAnalyzePages={handleAnalyzeProject}
            onAnalyzeSelected={async (urlIds) => {
              // Update selectedUrls state and trigger analysis
              setSelectedUrls(urlIds);
              // Show progress modal and wait for WebSocket connection
              setShowAnalysisModal(true);
              setAnalyzing(true);
              await new Promise(resolve => setTimeout(resolve, 500));
              try {
                await analyzeProjectPages(projectId!, urlIds);
                setTimeout(() => {
                  loadProject();
                  setElementsKey(prev => prev + 1);
                  setSelectedUrls([]);
                }, 2000);
              } catch (error: any) {
                logger.error('Analysis error', error);
              } finally {
                setAnalyzing(false);
              }
            }}
            onClearElements={handleClearElements}
            projectUrls={project.urls}
            isAnalyzing={analyzing}
          />
        )}

        {/* Auth Tab */}
        {activeTab === 'auth' && (
          <ProjectAuthTab
            authFlows={authFlows}
            onAddAuthentication={handleAddAuthentication}
            onEditAuthentication={handleEditAuthentication}
            onDeleteAuthentication={handleDeleteAuthentication}
          />
        )}
      </div>

      {/* Technical Details Modal */}
      {showTechnicalDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Technical Analysis Details</h3>
              <button
                onClick={() => setShowTechnicalDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-white">Current Analysis Status</h4>
                  <div className="text-sm text-gray-700">
                    <p><span className="font-medium">Stage:</span> {currentAnalysisStep}</p>
                    <p><span className="font-medium">Progress:</span> {analysisProgressPercent}%</p>
                    <p><span className="font-medium">URLs Analyzed:</span> {project.urls.filter(url => url.analyzed).length}/{project.urls.length}</p>
                    <p><span className="font-medium">Elements Found:</span> {project.elements.length}</p>
                    <p>
                      <span className="font-medium">Auto-Refresh:</span> 
                      {isAnalysisRunning ? (
                        <span className="text-green-600 dark:text-green-400 ml-1">Active (every 3s)</span>
                      ) : (
                        <span className="text-gray-500 ml-1">Inactive</span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-white">Analysis Logs</h4>
                  <div className="text-xs font-mono bg-white p-3 rounded border h-48 overflow-y-auto">
                    {analysisLogs.length > 0 ? (
                      <div className="space-y-1">
                        {analysisLogs.map((log, index) => (
                          <p key={index} className={`${
                            log.level === 'ERROR' ? 'text-red-600' :
                            log.level === 'SUCCESS' ? 'text-green-600' :
                            log.level === 'PROGRESS' ? 'text-blue-600' :
                            'text-gray-600'
                          }`}>
                            [{log.timestamp}] [{log.level}] {log.message}
                          </p>
                        ))}
                        {analyzing && (
                          <p className="text-cyan-600">[{new Date().toLocaleTimeString()}] [AUTO-REFRESH] Data refreshing every 3 seconds</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-gray-500">[INFO] No analysis logs yet</p>
                        <p className="text-gray-500">[INFO] Start an analysis to see detailed logs here</p>
                        <p className="text-blue-600">[INFO] System ready for analysis</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-white">Configuration</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p><span className="font-medium">Project:</span> {project.name}</p>
                    <p><span className="font-medium">Authentication:</span> {authFlows.length > 0 ? `${authFlows.length} flow(s) configured` : 'None configured'}</p>
                    <p><span className="font-medium">Browser:</span> Playwright Chromium</p>
                    <p><span className="font-medium">Timeout:</span> 30 seconds per URL</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Progress Modal */}
      <AnalysisProgressModal
        isOpen={showAnalysisModal}
        onClose={handleAnalysisModalClose}
        onMinimize={handleAnalysisMinimize}
        projectName={project.name}
        progress={analysisProgress}
      />

      {/* Analysis Floating Indicator (when minimized) */}
      <AnalysisFloatingIndicator
        isVisible={isAnalysisMinimized && analysisProgress.isRunning}
        projectName={project.name}
        progress={analysisProgress}
        onRestore={handleAnalysisRestore}
        onDismiss={handleAnalysisDismiss}
      />

      {/* Discovery Floating Indicator is now rendered at app level via DiscoveryContext */}

      {/* Authentication Setup Modal */}
      {showAuthModal && (
        <SimplifiedAuthSetup
          key={editingAuthFlow?.id || 'new'}
          projectId={projectId!}
          onComplete={handleAuthModalComplete}
          onCancel={handleAuthModalCancel}
          authFlowId={editingAuthFlow?.id}
          initialData={editingAuthFlow?.data}
        />
      )}

      {/* Discovery Modal */}
      <DiscoveryModal
        isOpen={showDiscoveryModal}
        onClose={() => setShowDiscoveryModal(false)}
        onMinimize={() => {
          setShowDiscoveryModal(false);
        }}
        projectId={projectId || ''}
        initialUrl={project.urls[0]?.url || ''}
        projectUrls={project.urls?.map((u: any) => ({ id: u.id, url: u.url, title: u.title })) || []}
        onDiscoveryComplete={(selectedUrls) => {
          // Backend already saved discovered URLs to DB during discovery.
          // Refresh to show them in the UI.
          refetchSiteMap();
          loadProject();
          showSuccess(
            'Pages Added',
            `${selectedUrls.length} discovered page${selectedUrls.length !== 1 ? 's' : ''} added to your project. You can now analyze them for elements.`
          );
          // Switch to sitemap tab to show the results
          setActiveTab('sitemap');
        }}
      />
    </div>
  );
}