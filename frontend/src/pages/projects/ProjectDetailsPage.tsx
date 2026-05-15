import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { projectsAPI, authFlowsAPI, analyzeProjectPages } from '../../lib/api';
import { ElementLibraryPanel } from '../../components/test-builder/ElementLibraryPanel';
import { ElementInspectDrawer } from '../../components/elements/ElementInspectDrawer';
import { AnalysisProgressModal } from '../../components/analysis/AnalysisProgressModal';
import { SimplifiedAuthSetup } from '../../components/auth/SimplifiedAuthSetup';
import { SiteMapGraph, useSiteMapData, DiscoveryModal } from '../../components/sitemap';
import { useNotification } from '../../contexts/NotificationContext';
import { useDiscoveryContext } from '../../contexts/DiscoveryContext';
import { useDiscoveryProgress } from '../../hooks/useDiscoveryProgress';
import { ProjectElement } from '../../types/element.types';
import { createLogger } from '../../lib/logger';
import { useUrlManagement } from './hooks';
import { useAnalysisContext } from '../../contexts/AnalysisContext';
import { ProjectOverviewTab, ProjectUrlsTab, ProjectSiteMapTab, ProjectAuthTab } from './components';
import { EditSiteModal, EditSiteUrl } from '../../components/projects/EditSiteModal';
import { PageHelpButton } from '../../components/help/PageHelpButton';

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

type ProjectTab = 'overview' | 'sitemap' | 'urls' | 'elements' | 'auth';
const VALID_TABS: ProjectTab[] = ['overview', 'sitemap', 'urls', 'elements', 'auth'];

export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();
  const { activeDiscovery, isMinimized } = useDiscoveryContext();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Active tab is sourced from `?tab=…` so the Verdant sidebar's per-project
  // sub-nav (Sites/Sitemap/Elements/Auth) drives this page. Default = overview.
  const tabFromUrl = searchParams.get('tab') as ProjectTab | null;
  const initialTab: ProjectTab =
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview';
  const [activeTab, setActiveTabRaw] = useState<ProjectTab>(initialTab);

  // Keep state ↔ query string in sync. Sidebar navigation updates the URL,
  // so we mirror that into local state. Tab clicks within the page update
  // the URL so the sidebar's active highlight stays accurate.
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabRaw(tabFromUrl);
    }
    if (!tabFromUrl && activeTab !== 'overview') {
      // URL has no tab → reset to overview without re-navigating.
      setActiveTabRaw('overview');
    }
  }, [tabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveTab = (next: ProjectTab) => {
    setActiveTabRaw(next);
    if (next === 'overview') {
      // Clean URL: remove ?tab when returning to overview.
      const params = new URLSearchParams(searchParams);
      params.delete('tab');
      setSearchParams(params, { replace: true });
    } else {
      const params = new URLSearchParams(searchParams);
      params.set('tab', next);
      setSearchParams(params, { replace: true });
    }
  };
  const [selectedElementType, setSelectedElementType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]); // URL IDs for selective analysis

  // URL Management State
  const [showUrlManager, setShowUrlManager] = useState(false);

  // Authentication and analysis state
  const [authFlows, setAuthFlows] = useState<any[]>([]);
  const [showElementLibrary, setShowElementLibrary] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  // Minimize state now lives in AnalysisContext (lifted to app shell so the
  // floating indicator persists across route changes). See call sites below
  // — they reference `isAnalysisMinimizedCtx` from the context destructure.
  const [showLivePicker, setShowLivePicker] = useState(false);
  const [elementsKey, setElementsKey] = useState(0);
  // Edit Site modal — opened from per-URL row in the URLs tab.
  const [editingSite, setEditingSite] = useState<EditSiteUrl | null>(null);
  const [editingSiteSaving, setEditingSiteSaving] = useState(false);

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

  // AI test generation state
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);

  // Auth setup state
  const [showAuthSetup, setShowAuthSetup] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [inspectingElement, setInspectingElement] = useState<ProjectElement | null>(null);
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

  // Analysis progress lives in app-shell context so the floating indicator
  // and progress survive route changes (per project_analysis_indicator_persistence.md).
  const {
    progress: analysisProgress,
    startAnalysis,
    minimizeAnalysis,
    restoreAnalysis,
    clearAnalysis,
    isMinimized: isAnalysisMinimizedCtx,
  } = useAnalysisContext();

  // Fire side effects when the active analysis transitions to complete/error.
  const lastCompletedRef = useRef(false);
  const lastErroredRef = useRef(false);
  useEffect(() => {
    if (analysisProgress.isComplete && !lastCompletedRef.current) {
      lastCompletedRef.current = true;
      lastErroredRef.current = false;
      loadProject();
      setElementsKey(prev => prev + 1);
      loadAnalysisDashboard();
    }
    if (analysisProgress.hasError && !lastErroredRef.current) {
      lastErroredRef.current = true;
      lastCompletedRef.current = false;
      showError('Analysis Error', analysisProgress.errorMessage);
    }
    if (!analysisProgress.isComplete && !analysisProgress.hasError) {
      lastCompletedRef.current = false;
      lastErroredRef.current = false;
    }
  }, [analysisProgress.isComplete, analysisProgress.hasError, analysisProgress.errorMessage]);

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

    // Show progress modal; start the app-shell analysis context so the
    // socket is owned by the provider and the floating indicator can persist
    // across navigation.
    setShowAnalysisModal(true);
    setAnalyzing(true);
    startAnalysis(projectId, project?.name || 'Project');

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

    // Show progress modal; start the app-shell analysis context.
    setShowAnalysisModal(true);
    startAnalysis(projectId, project?.name || 'Project');

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
    // Once user dismisses the modal AND analysis is over, also clear the
    // app-shell context so the floating indicator stops showing. While running
    // we leave context alone — minimize-on-close is the user's call via the
    // dedicated minimize button.
    if (!analysisProgress.isRunning) {
      clearAnalysis();
    }
    loadProject();
    setElementsKey(prev => prev + 1);
  };

  const handleAnalysisMinimize = () => {
    setShowAnalysisModal(false);
    minimizeAnalysis();
  };

  // Restore from the floating indicator → reopen the in-page modal.
  // The floating indicator already calls restoreAnalysis() in context;
  // we observe that via a useEffect (below) to reopen our local modal.
  useEffect(() => {
    if (!isAnalysisMinimizedCtx && analysisProgress.isRunning && !showAnalysisModal) {
      setShowAnalysisModal(true);
    }
  }, [isAnalysisMinimizedCtx, analysisProgress.isRunning, showAnalysisModal]);

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

  // AI Test Generation handler
  const handleGenerateTests = async () => {
    if (!projectId) return;
    setIsGeneratingTests(true);
    try {
      const res = await projectsAPI.generateTests(projectId);
      const data = res?.data || res;
      const total = data?.summary?.total || data?.tests?.length || 0;
      showSuccess(
        'Tests Generated',
        `Successfully generated ${total} test scenarios as drafts.`
      );
      loadProject();
      navigate(`/projects/${projectId}/tests`);
    } catch (error: any) {
      logger.error('AI test generation failed', error);
      showError(
        'Generation Failed',
        error.response?.data?.message || 'Failed to generate tests. Make sure ANTHROPIC_API_KEY is configured.'
      );
    } finally {
      setIsGeneratingTests(false);
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
      case 'heading': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
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
      case 'heading': return '🔤';
      case 'text': return '📄';
      default: return '📦';
    }
  };

  if (loading) {
    return (
      <div className="content">
        <div className="row" style={{ minHeight: '40vh', justifyContent: 'center' }}>
          <div className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="content">
        <div className="card">
          <div className="empty">
            <div className="empty-icon">!</div>
            <h3>Project not found</h3>
            <p>The project you tried to open doesn't exist or you don't have access.</p>
            <Link to="/projects" className="btn btn-outline">
              ← Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const analyzedUrlsCount = project.urls.filter(u => u.analyzed).length;
  const tabs: Array<{ id: typeof activeTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'sitemap', label: 'Site Map' },
    { id: 'urls', label: 'URLs', count: project._count.urls },
    { id: 'elements', label: 'Elements', count: project._count.elements },
    { id: 'auth', label: 'Authentication', count: authFlows.length || undefined },
  ];

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <Link
            to="/projects"
            className="dim"
            style={{ fontSize: 11.5, textDecoration: 'none', display: 'inline-block', marginBottom: 4 }}
          >
            ← Back to Projects
          </Link>
          <h1>{project.name}</h1>
          {project.description && <div className="sub">{project.description}</div>}
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <Link to={`/projects/${project.id}/suites`} className="btn btn-outline btn-sm">
            Test Suites
          </Link>
          <Link to={`/projects/${project.id}/tests`} className="btn btn-outline btn-sm">
            Tests ({project._count.tests})
          </Link>
          {project._count.elements > 0 && (
            <button
              type="button"
              onClick={handleGenerateTests}
              disabled={isGeneratingTests}
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--amber)', borderColor: 'var(--amber-edge)' }}
            >
              {isGeneratingTests ? 'Generating…' : 'AI Generate Tests'}
            </button>
          )}
          {project.urls.length > 0 ? (
            <Link to={`/projects/${project.id}/tests/new`} className="btn btn-primary btn-sm">
              Create Test
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowUrlManager(true)}
              className="btn btn-primary btn-sm"
            >
              Setup Project
            </button>
          )}
          <PageHelpButton
            helpKey={
              activeTab === 'urls'
                ? 'project-urls'
                : activeTab === 'elements'
                ? 'project-elements'
                : activeTab === 'auth'
                ? 'project-auth'
                : activeTab === 'sitemap'
                ? 'project-sitemap'
                : 'project-details'
            }
          />
        </div>
      </div>

      {/* Project stat row — matches the prototype's compact 4-up layout. */}
      <div
        className="stat-grid-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          className="card card-pad"
          onClick={() => setActiveTab('urls')}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            URLs
          </div>
          <div
            className="tabular"
            style={{
              fontFamily: 'Inter Tight',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              marginTop: 4,
            }}
          >
            {project._count.urls}
          </div>
        </button>
        <button
          type="button"
          className="card card-pad"
          onClick={() => setActiveTab('elements')}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Elements
          </div>
          <div
            className="tabular"
            style={{
              fontFamily: 'Inter Tight',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              marginTop: 4,
            }}
          >
            {project._count.elements}
          </div>
        </button>
        <div className="card card-pad">
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Tests
          </div>
          <div
            className="tabular"
            style={{
              fontFamily: 'Inter Tight',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              marginTop: 4,
            }}
          >
            {project._count.tests}
          </div>
        </div>
        <div className="card card-pad">
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Analyzed
          </div>
          <div
            className="tabular"
            style={{
              fontFamily: 'Inter Tight',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              marginTop: 4,
            }}
          >
            {analyzedUrlsCount}
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && <span className="count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card" style={{ padding: 16 }}>
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
            onGenerateTests={handleGenerateTests}
            isGeneratingTests={isGeneratingTests}
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
            onProjectReload={loadProject}
            onEditUrl={(url) => setEditingSite({
              id: url.id,
              url: url.url,
              title: url.title,
              analyzed: url.analyzed,
              verified: url.verified,
              discovered: (url as any).discovered ?? false,
            })}
          />
        )}

        {/* Elements Tab */}
        {activeTab === 'elements' && (
          <ElementLibraryPanel
            key={elementsKey}
            mode="project-details"
            projectId={projectId}
            onSelectElement={setInspectingElement}
            selectedElementType={selectedElementType}
            selectedUrl={selectedUrl}
            onElementTypeChange={setSelectedElementType}
            onUrlChange={setSelectedUrl}
            previewMode="auto"
            showQuality={true}
            compact={false}
            isLoading={false}
            setShowLivePicker={setShowLivePicker}
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

      {/* Analysis Floating Indicator is now rendered at app level via AnalysisContext */}
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

      {/* Element Inspector Drawer (project Elements tab row click) */}
      <ElementInspectDrawer
        element={inspectingElement}
        onClose={() => setInspectingElement(null)}
      />

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

      {/* Edit Site modal — opened from per-row "Edit" button in the URLs tab. */}
      <EditSiteModal
        open={!!editingSite}
        url={editingSite}
        onClose={() => setEditingSite(null)}
        isSaving={editingSiteSaving}
        isVerifying={!!verifyingUrl}
        onSave={async (urlId, title) => {
          setEditingSiteSaving(true);
          try {
            await projectsAPI.renameUrl(urlId, title);
            await loadProject();
            setEditingSite(null);
            showSuccess('Site updated', `Title saved as "${title || '(empty)'}"`);
          } catch (err: any) {
            showError('Save Failed', err?.message || 'Could not save the site');
          } finally {
            setEditingSiteSaving(false);
          }
        }}
        onVerify={async (urlId) => {
          await handleVerifyUrl(urlId);
        }}
        onRemove={async (rawUrl) => {
          if (!confirm(`Remove ${rawUrl} from this project?`)) return;
          await handleRemoveUrl(rawUrl);
          setEditingSite(null);
        }}
      />
    </div>
  );
}