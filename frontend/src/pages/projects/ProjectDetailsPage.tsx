import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsAPI, authFlowsAPI, analyzeProjectPages } from '../../lib/api';
import { ElementLibraryPanel } from '../../components/test-builder/ElementLibraryPanel';
import { AnalysisProgressModal } from '../../components/analysis/AnalysisProgressModal';
import { SimplifiedAuthSetup } from '../../components/auth/SimplifiedAuthSetup';
import { SiteMapGraph, useSiteMapData, DiscoveryModal } from '../../components/sitemap';
import { useNotification } from '../../contexts/NotificationContext';
import { ProjectElement } from '../../types/element.types';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '../../lib/logger';

const logger = createLogger('ProjectDetails');

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
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sitemap' | 'urls' | 'elements' | 'auth'>('overview');
  const [selectedElementType, setSelectedElementType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]); // URL IDs for selective analysis

  // NEW: URL Management State
  const [showUrlManager, setShowUrlManager] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [verifyingUrl, setVerifyingUrl] = useState<string | null>(null);
  
  // ENHANCED: Add authentication and analysis state
  const [authFlows, setAuthFlows] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [showElementLibrary, setShowElementLibrary] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showLivePicker, setShowLivePicker] = useState(false);
  
  // NEW: Analysis dashboard state
  const [showAnalysisDashboard, setShowAnalysisDashboard] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [analysisMetrics, setAnalysisMetrics] = useState<any>(null);

  // NEW: Test execution stats state
  const [testStats, setTestStats] = useState<{
    totalExecutions: number;
    totalPassed: number;
    totalFailed: number;
    regressions: number;
    successRate: number;
  } | null>(null);
  
  // NEW: Auth setup state for collapsible section
  const [showAuthSetup, setShowAuthSetup] = useState<string | null>(null);

  // Authentication modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [editingAuthFlow, setEditingAuthFlow] = useState<{id: string; data: any} | null>(null);

  // Site Map state
  const [showSiteMap, setShowSiteMap] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);

  // Fetch site map data
  const { data: siteMapData, loading: siteMapLoading, refetch: refetchSiteMap } = useSiteMapData(projectId);

  // NEW: Progress and technical details state
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState('Ready');
  const [analysisProgressPercent, setAnalysisProgressPercent] = useState(100);
  const [analysisLogs, setAnalysisLogs] = useState<Array<{timestamp: string, level: string, message: string}>>([]);
  
  // NEW: WebSocket and auto-refresh state
  const socketRef = useRef<Socket | null>(null);
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProject();
    loadAuthFlows();
    loadTestStats();
    if (showAnalysisDashboard) {
      loadAnalysisHistory();
      loadAnalysisMetrics();
    }
  }, [projectId, showAnalysisDashboard]);

  // NEW: WebSocket connection and auto-refresh setup
  useEffect(() => {
    if (!projectId) return;

    // Initialize WebSocket connection for real-time updates
    const initializeWebSocket = () => {
      try {
        socketRef.current = io('http://localhost:3002/analysis-progress', {
          transports: ['websocket', 'polling'],
          timeout: 10000,
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
          logger.debug('WebSocket connected for auto-refresh');
          socket.emit('subscribe-to-project', projectId);
        });

        socket.on('subscription-confirmed', (data) => {
          logger.debug('Subscribed to project updates', data);
        });

        // Listen for analysis events and trigger auto-refresh
        socket.on('analysis-started', (data) => {
          logger.info('Analysis started, enabling auto-refresh');
          setIsAnalysisRunning(true);
          setAnalyzing(true);
          setCurrentAnalysisStep('Initializing...');
          setAnalysisProgressPercent(0);
          
          // Add log entry
          const timestamp = new Date().toLocaleTimeString();
          setAnalysisLogs(prev => [...prev, {
            timestamp,
            level: 'INFO',
            message: `Analysis started for project: ${project?.name || 'Unknown'}`
          }]);
          
          startAutoRefresh();
        });

        socket.on('analysis-progress', (data) => {
          logger.debug('Analysis progress update', data);
          
          // Enhanced step display with URL extraction for cleaner progress info
          let stepMessage = data.message || 'Processing...';
          if (stepMessage.includes('Analyzing URL') || stepMessage.includes('elements from')) {
            // Extract domain for cleaner display
            const urlMatch = stepMessage.match(/https?:\/\/([^\/]+)/);
            if (urlMatch) {
              const domain = urlMatch[1].replace('www.', '');
              if (stepMessage.includes('Analyzing URL')) {
                const urlCountMatch = stepMessage.match(/URL (\d+\/\d+)/);
                stepMessage = `Analyzing ${domain}${urlCountMatch ? ` (${urlCountMatch[1]})` : ''}...`;
              } else if (stepMessage.includes('elements from')) {
                const elementsMatch = stepMessage.match(/(\d+) elements/);
                if (elementsMatch) {
                  stepMessage = `✅ Found ${elementsMatch[1]} elements on ${domain}`;
                }
              }
            }
          }
          setCurrentAnalysisStep(stepMessage);
          
          // Check if progress data is available - backend sends it as data.progress.current/total/percentage
          if (data.progress && data.progress.current !== undefined && data.progress.total !== undefined) {
            const progress = data.progress.percentage || Math.round((data.progress.current / data.progress.total) * 100);
            setAnalysisProgressPercent(progress);
            logger.debug(`Progress updated: ${progress}% (${data.progress.current}/${data.progress.total})`);
          } else if (data.current !== undefined && data.total !== undefined) {
            // Fallback for direct current/total values (if any)
            const progress = Math.round((data.current / data.total) * 100);
            setAnalysisProgressPercent(progress);
            logger.debug(`Progress updated (fallback): ${progress}% (${data.current}/${data.total})`);
          } else {
            logger.warn('No progress data available in event', data);
          }
          
          // Add log entry
          const timestamp = new Date().toLocaleTimeString();
          setAnalysisLogs(prev => [...prev, {
            timestamp,
            level: 'PROGRESS',
            message: data.message || 'Processing...'
          }]);
          
          // Refresh project data during analysis
          loadProject();
        });

        socket.on('analysis-completed', async (data) => {
          logger.info('Analysis completed, disabling auto-refresh');
          setIsAnalysisRunning(false);
          setAnalyzing(false);
          setCurrentAnalysisStep('Complete');
          setAnalysisProgressPercent(100);

          // Add log entry
          const timestamp = new Date().toLocaleTimeString();
          setAnalysisLogs(prev => [...prev, {
            timestamp,
            level: 'SUCCESS',
            message: `Analysis completed successfully. Found ${data.totalElements || 0} elements.`
          }]);

          // CRITICAL FIX: Load project data BEFORE stopping auto-refresh
          // This ensures element library gets the latest data
          await loadProject();
          if (showAnalysisDashboard) {
            loadAnalysisHistory();
            loadAnalysisMetrics();
          }

          // THEN stop auto-refresh (after data is loaded)
          stopAutoRefresh();
        });

        socket.on('analysis-error', (data) => {
          logger.error('Analysis error', data);
          setIsAnalysisRunning(false);
          setAnalyzing(false);
          setCurrentAnalysisStep('Error occurred');
          
          // Add log entry
          const timestamp = new Date().toLocaleTimeString();
          setAnalysisLogs(prev => [...prev, {
            timestamp,
            level: 'ERROR',
            message: `Analysis failed: ${data.message || 'Unknown error'}`
          }]);
          
          stopAutoRefresh();
          showError('Analysis Error', data.message || 'Analysis failed');
        });

        socket.on('disconnect', () => {
          logger.debug('WebSocket disconnected');
          stopAutoRefresh();
        });

        socket.on('connect_error', (error) => {
          logger.warn('Real-time analysis WebSocket connection failed - live updates will not be available', error.message);
          // Continue without real-time updates
        });

      } catch (error) {
        logger.error('Failed to initialize WebSocket', error);
      }
    };

    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      stopAutoRefresh();
    };
  }, [projectId]);

  // Auto-refresh functionality
  const startAutoRefresh = () => {
    // Clear any existing interval
    stopAutoRefresh();
    
    // Start auto-refresh every 3 seconds during analysis
    autoRefreshIntervalRef.current = setInterval(() => {
      if (isAnalysisRunning) {
        logger.debug('Auto-refreshing project data...');
        loadProject();
      }
    }, 3000);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
  };

  const loadProject = async () => {
    try {
      const response = await projectsAPI.getById(projectId!);
      setProject(response.data);
    } catch (error) {
      logger.error('Failed to load project', error);
    } finally {
      setLoading(false);
    }
  };

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

    setAnalyzing(true);
    try {
      // Call API with selected URL IDs
      const result = await analyzeProjectPages(projectId, selectedUrls);

      showSuccess('Analysis Complete', `Analyzed ${selectedUrls.length} URL(s)`);

      // Reload project data
      setTimeout(() => {
        loadProject();
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

    try {
      // Start the analysis - the progress will be tracked via WebSocket
      // Modal only opens on progress bar double-click
      const result = await analyzeProjectPages(projectId);

      // Reload project to show updated elements after analysis
      setTimeout(() => {
        loadProject();
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
    // Reload project to ensure we have the latest data
    loadProject();
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

  // NEW: URL Management Functions
  const handleAddUrl = async () => {
    if (!projectId || !newUrl.trim()) return;
    
    setAddingUrl(true);
    try {
      // Validate URL format
      const urlToAdd = newUrl.trim();
      if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
        showError('Invalid URL', 'Please enter a valid URL starting with http:// or https://');
        return;
      }

      // Check if URL already exists
      if (project?.urls.some(url => url.url === urlToAdd)) {
        showError('Duplicate URL', 'This URL is already added to the project');
        return;
      }

      // Add URL to project
      const currentUrls = project?.urls || [];
      const updatedUrls = [...currentUrls, { url: urlToAdd, title: 'Page', description: 'Project URL' }];
      
      await projectsAPI.update(projectId, {
        urls: updatedUrls
      });

      setNewUrl('');
      showSuccess('URL Added', 'URL has been added to the project. Run analysis to discover elements.');
      loadProject(); // Reload to show updated URLs
    } catch (error) {
      logger.error('Failed to add URL', error);
      showError('Failed to Add URL', 'Please try again.');
    } finally {
      setAddingUrl(false);
    }
  };

  const handleRemoveUrl = async (urlToRemove: string) => {
    if (!projectId || !project) return;

    if (!confirm(`Remove URL: ${urlToRemove}?\n\nThis will also remove any elements discovered from this URL.`)) {
      return;
    }

    try {
      const updatedUrls = project.urls.filter(url => url.url !== urlToRemove);

      await projectsAPI.update(projectId, {
        urls: updatedUrls.map(url => ({ url: url.url, title: url.title, description: url.description }))
      });

      showSuccess('URL Removed', 'URL has been removed from the project.');
      loadProject(); // Reload to show updated URLs
    } catch (error) {
      logger.error('Failed to remove URL', error);
      showError('Failed to Remove URL', 'Please try again.');
    }
  };

  const handleVerifyUrl = async (urlId: string) => {
    if (!projectId) return;

    setVerifyingUrl(urlId);
    try {
      const organizationId = localStorage.getItem('organizationId');
      const response = await fetch(`http://localhost:3002/api/projects/urls/${urlId}/verify?organizationId=${organizationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();

      if (result.accessible) {
        showSuccess('URL Verified', result.message);
        loadProject(); // Reload to show updated verification status
      } else {
        showError('URL Not Accessible', result.message);
      }
    } catch (error) {
      logger.error('Failed to verify URL', error);
      showError('Verification Failed', 'Could not verify URL. Please try again.');
    } finally {
      setVerifyingUrl(null);
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
          <div className="space-y-6">
            {/* Empty Project Setup Guide */}
            {project.urls.length === 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8 mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Get Started</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              Your project is ready. Add URLs and start discovering testable elements to build your automated test suite.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-100 dark:border-gray-700">
                <div className="text-blue-600 dark:text-blue-400 text-2xl font-bold mb-3">1</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Add URLs</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Start by adding the web pages you want to test</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-100 dark:border-gray-700">
                <div className="text-blue-600 dark:text-blue-400 text-2xl font-bold mb-3">2</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Analyze Pages</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Our AI discovers testable elements automatically</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-100 dark:border-gray-700">
                <div className="text-blue-600 dark:text-blue-400 text-2xl font-bold mb-3">3</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Build Tests</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Use discovered elements to create automated tests</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('urls')}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Your First URL
            </button>
          </div>
            )}

            {/* Analysis Controls - Only show when project has URLs */}
            {project.urls.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Analysis</h3>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Analysis Progress</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{currentAnalysisStep}</span>
                  </div>
                  <div
                    className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 cursor-pointer"
                    onDoubleClick={() => setShowAnalysisModal(true)}
                    title="Double-click for details"
                  >
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        analyzing && analysisProgressPercent < 100 ? 'bg-blue-500' :
                        analysisProgressPercent === 100 ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${analysisProgressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Test Execution Stats */}
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {testStats?.totalPassed ?? 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Passed</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {testStats?.totalFailed ?? 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {testStats?.regressions ?? 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Regressions</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {testStats?.successRate ?? 0}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
                  </div>
                </div>
                {testStats && testStats.totalExecutions === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    No test executions yet. Run tests to see statistics.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Site Map Tab */}
        {activeTab === 'sitemap' && (
          <div>
            {siteMapLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading site map...</span>
              </div>
            ) : siteMapData && siteMapData.nodes.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Visual representation of your project's page structure
                  </p>
                  <button
                    onClick={() => setShowDiscoveryModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Discover More Pages
                  </button>
                </div>
                <div className="h-[500px] border border-gray-200 rounded-lg overflow-hidden">
                  <SiteMapGraph
                    nodes={siteMapData.nodes}
                    edges={siteMapData.edges}
                    className="w-full h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Site Map Yet</h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Discover pages automatically from a root URL to build your site map and visualize page relationships.
                </p>
                <button
                  onClick={() => setShowDiscoveryModal(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Start Page Discovery
                </button>
              </div>
            )}
          </div>
        )}

        {/* URLs Tab */}
        {activeTab === 'urls' && (
          <div className="space-y-6">
            {/* Add URL Form */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex space-x-3">
                <div className="flex-1">
                  <input
                    type="url"
                    placeholder="https://example.com/page-to-test"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                  />
                </div>
                <button
                  onClick={handleAddUrl}
                  disabled={addingUrl || !newUrl.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingUrl ? 'Adding...' : '+ Add URL'}
                </button>
                <button
                  onClick={() => setShowDiscoveryModal(true)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Auto-Discover
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Add URLs manually or use Auto-Discover to find pages from a root URL.
              </p>
            </div>

            {/* URLs List */}
            {project.urls.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No URLs Added Yet</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Add your first URL or use Auto-Discover to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Selective Analysis Controls */}
                {project.urls.length > 1 && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedUrls.length === project.urls.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUrls(project.urls.map(u => u.id));
                          } else {
                            setSelectedUrls([]);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedUrls.length > 0 ? `${selectedUrls.length} selected` : 'Select all'}
                      </span>
                    </div>
                    {selectedUrls.length > 0 && (
                      <button
                        onClick={handleAnalyzeSelected}
                        disabled={analyzing}
                        className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                      >
                        {analyzing ? 'Analyzing...' : `Analyze Selected (${selectedUrls.length})`}
                      </button>
                    )}
                  </div>
                )}

                {/* URL Cards */}
                {project.urls.map((url) => (
                  <div key={url.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {project.urls.length > 1 && (
                          <input
                            type="checkbox"
                            checked={selectedUrls.includes(url.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUrls([...selectedUrls, url.id]);
                              } else {
                                setSelectedUrls(selectedUrls.filter(id => id !== url.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded mt-1"
                          />
                        )}
                        <div>
                          <a
                            href={url.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {url.url}
                          </a>
                          <div className="flex items-center gap-2 mt-1">
                            {url.analyzed && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                Analyzed
                              </span>
                            )}
                            {url.verified && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleVerifyUrl(url.id)}
                          disabled={verifyingUrl === url.id}
                          className="text-xs text-gray-600 hover:text-blue-600 px-2 py-1"
                        >
                          {verifyingUrl === url.id ? 'Verifying...' : 'Verify'}
                        </button>
                        <button
                          onClick={() => handleRemoveUrl(url.url)}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Elements Tab */}
        {activeTab === 'elements' && (
          <ElementLibraryPanel
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
            onClearElements={handleClearElements}
          />
        )}

        {/* Auth Tab */}
        {activeTab === 'auth' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Authentication Flows</h3>
                <p className="text-sm text-gray-600">Configure login credentials for testing authenticated pages</p>
              </div>
              <button
                onClick={handleAddAuthentication}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Authentication
              </button>
            </div>

            {authFlows.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Authentication Configured</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Add authentication to test pages that require login credentials
                </p>
                <button
                  onClick={handleAddAuthentication}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Setup Authentication
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {authFlows.map((authFlow) => (
                  <div key={authFlow.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{authFlow.name}</div>
                        <div className="text-sm text-gray-500">{authFlow.loginUrl}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditAuthentication(authFlow)}
                          className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAuthentication(authFlow.id, authFlow.name)}
                          className="text-sm text-red-600 hover:text-red-800 px-3 py-1"
                        >
                          Delete
                        </button>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
        projectId={projectId || ''}
        projectName={project.name}
      />

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
        projectId={projectId || ''}
        initialUrl={project.urls[0]?.url || ''}
        onDiscoveryComplete={(selectedUrlIds) => {
          // Refresh the site map and project data
          refetchSiteMap();
          loadProject();
        }}
      />
    </div>
  );
}