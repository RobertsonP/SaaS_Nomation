import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsAPI, authFlowsAPI, analyzeProjectPages } from '../../lib/api';
import { ElementLibraryPanel } from '../../components/test-builder/ElementLibraryPanel';
import { AnalysisProgressModal } from '../../components/analysis/AnalysisProgressModal';
import { SimplifiedAuthSetup } from '../../components/auth/SimplifiedAuthSetup';
import { useNotification } from '../../contexts/NotificationContext';
import { ProjectElement } from '../../types/element.types';
import { io, Socket } from 'socket.io-client';

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  description?: string;
  analyzed: boolean;
  analysisDate?: string;
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
  const [selectedElementType, setSelectedElementType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]); // URL IDs for selective analysis

  // NEW: URL Management State
  const [showUrlManager, setShowUrlManager] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  
  // ENHANCED: Add authentication and analysis state
  const [authFlows, setAuthFlows] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [showElementLibrary, setShowElementLibrary] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  
  // NEW: Analysis dashboard state
  const [showAnalysisDashboard, setShowAnalysisDashboard] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [analysisMetrics, setAnalysisMetrics] = useState<any>(null);
  
  // NEW: Auth setup state for collapsible section
  const [showAuthSetup, setShowAuthSetup] = useState<string | null>(null);

  // Authentication modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [editingAuthFlow, setEditingAuthFlow] = useState<{id: string; data: any} | null>(null);

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
          console.log('🔗 WebSocket connected for auto-refresh');
          socket.emit('subscribe-to-project', projectId);
        });

        socket.on('subscription-confirmed', (data) => {
          console.log('✅ Subscribed to project updates:', data);
        });

        // Listen for analysis events and trigger auto-refresh
        socket.on('analysis-started', (data) => {
          console.log('🚀 Analysis started, enabling auto-refresh');
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
          console.log('📊 Analysis progress update:', data);
          
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
            console.log(`🔄 Progress updated: ${progress}% (${data.progress.current}/${data.progress.total})`);
          } else if (data.current !== undefined && data.total !== undefined) {
            // Fallback for direct current/total values (if any)
            const progress = Math.round((data.current / data.total) * 100);
            setAnalysisProgressPercent(progress);
            console.log(`🔄 Progress updated (fallback): ${progress}% (${data.current}/${data.total})`);
          } else {
            console.log(`⚠️ No progress data available in event:`, data);
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

        socket.on('analysis-completed', (data) => {
          console.log('✅ Analysis completed, disabling auto-refresh');
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
          
          stopAutoRefresh();
          // Final refresh to get all new elements
          setTimeout(() => {
            loadProject();
            if (showAnalysisDashboard) {
              loadAnalysisHistory();
              loadAnalysisMetrics();
            }
          }, 1000);
        });

        socket.on('analysis-error', (data) => {
          console.error('❌ Analysis error:', data);
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
          console.log('🔌 WebSocket disconnected');
          stopAutoRefresh();
        });

        socket.on('connect_error', (error) => {
          console.warn('Real-time analysis WebSocket connection failed - live updates will not be available:', error.message);
          // Continue without real-time updates
        });

      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
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
        console.log('🔄 Auto-refreshing project data...');
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
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuthFlows = async () => {
    try {
      const response = await authFlowsAPI.getByProject(projectId!);
      setAuthFlows(response.data);
    } catch (error) {
      console.error('Failed to load auth flows:', error);
      setAuthFlows([]);
    }
  };

  // NEW: Load analysis history for dashboard
  const loadAnalysisHistory = async () => {
    try {
      const history = await projectsAPI.getAnalysisHistory(projectId!);
      setAnalysisHistory(history);
    } catch (error) {
      console.error('Failed to load analysis history:', error);
      setAnalysisHistory([]);
    }
  };

  // NEW: Load analysis metrics for dashboard
  const loadAnalysisMetrics = async () => {
    try {
      const metrics = await projectsAPI.getAnalysisMetrics(projectId!);
      setAnalysisMetrics(metrics);
    } catch (error) {
      console.error('Failed to load analysis metrics:', error);
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
      console.error('Analysis error:', error);
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
      console.error('Analysis error:', error);
      
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
      console.error('Clear elements error:', error);
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
      console.error('Failed to add URL:', error);
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
      console.error('Failed to remove URL:', error);
      showError('Failed to Remove URL', 'Please try again.');
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
      console.log('📥 Fetching latest auth flow data for edit...');
      const response = await authFlowsAPI.getById(authFlow.id);
      const freshAuthFlow = response.data;
      console.log('✅ Loaded fresh auth flow data:', freshAuthFlow);

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
      console.error('Failed to load auth flow for editing:', error);
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
      console.error('Failed to delete auth flow:', error);
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
              📦 Test Suites
            </Link>
            <Link
              to={`/projects/${project.id}/tests`}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              📋 Individual Tests ({project._count.tests})
            </Link>
            <Link
              to={`/projects/${project.id}/analyze`}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 relative"
            >
              🚀 Project Analysis
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded-full text-[10px]">
                NEW
              </span>
            </Link>
            {project.urls.length > 0 ? (
              <Link
                to={`/projects/${project.id}/tests/new`}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                ➕ Create Test
              </Link>
            ) : (
              <button
                onClick={() => setShowUrlManager(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium"
              >
                🚀 Setup Project
              </button>
            )}
          </div>
        </div>

        {/* Project Stats - Contentful-style subtle improvements */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
               onClick={() => setShowUrlManager(!showUrlManager)}>
            <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide">URLs</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{project._count.urls}</div>
            <div className="text-xs text-blue-700 mt-1">Click to manage</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-semibold text-green-900 uppercase tracking-wide">Elements</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{project._count.elements}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-semibold text-purple-900 uppercase tracking-wide">Tests</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">{project._count.tests}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-semibold text-orange-900 uppercase tracking-wide">Analyzed</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {project.urls.filter(url => url.analyzed).length}
            </div>
          </div>
        </div>

        {/* NEW: Empty Project Setup Guide */}
        {project.urls.length === 0 && !showUrlManager && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 mb-8 text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Your New Project!</h2>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Your project has been created successfully. Now let's add some URLs and start discovering testable elements 
              to build your automated test suite.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                <div className="text-blue-600 text-3xl mb-3">1️⃣</div>
                <h3 className="font-semibold text-gray-900 mb-2">Add URLs</h3>
                <p className="text-sm text-gray-600">Start by adding the web pages you want to test</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                <div className="text-blue-600 text-3xl mb-3">2️⃣</div>
                <h3 className="font-semibold text-gray-900 mb-2">Analyze Pages</h3>
                <p className="text-sm text-gray-600">Our AI discovers testable elements automatically</p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                <div className="text-blue-600 text-3xl mb-3">3️⃣</div>
                <h3 className="font-semibold text-gray-900 mb-2">Build Tests</h3>
                <p className="text-sm text-gray-600">Use discovered elements to create automated tests</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowUrlManager(true)}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
            >
              🌐 Add Your First URL
            </button>
          </div>
        )}

        {/* NEW: URL Management Section */}
        {showUrlManager && (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">URL Management</h3>
                  <p className="text-sm opacity-90">Add and manage URLs for analysis</p>
                </div>
                <button
                  onClick={() => setShowUrlManager(false)}
                  className="text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Add URL Form */}
              <div className="mb-6">
                <div className="flex space-x-3">
                  <div className="flex-1">
                    <input
                      type="url"
                      placeholder="https://example.com/page-to-test"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                    />
                  </div>
                  <button
                    onClick={handleAddUrl}
                    disabled={addingUrl || !newUrl.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {addingUrl ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                    ) : (
                      <span>+ Add URL</span>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Add URLs to pages you want to test. Each URL will be analyzed to discover testable elements.
                </p>
              </div>

              {/* URLs List */}
              <div className="space-y-3">
                {project.urls.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <div className="text-4xl mb-2">🌐</div>
                    <h4 className="text-lg font-medium text-gray-900 mb-1">No URLs Added Yet</h4>
                    <p className="text-sm text-gray-600 mb-4">Add your first URL to start building your test library</p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                      💡 <strong>Tip:</strong> Start with your login page, dashboard, or main application pages
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Select All/None Buttons */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => setSelectedUrls(project.urls.map(u => u.id))}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setSelectedUrls([])}
                        className="text-sm text-gray-700 hover:text-gray-800 font-medium"
                      >
                        Deselect All
                      </button>
                    </div>

                    {/* URL List with Checkboxes */}
                    {project.urls.map((url, index) => (
                      <div key={url.id || index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3 flex-1">
                          {/* Checkbox for selection */}
                          <input
                            type="checkbox"
                            checked={selectedUrls.includes(url.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUrls([...selectedUrls, url.id])
                              } else {
                                setSelectedUrls(selectedUrls.filter(id => id !== url.id))
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />

                          {/* Analysis status indicator */}
                          <div className={`w-3 h-3 rounded-full ${url.analyzed ? 'bg-green-500' : 'bg-gray-300'}`}></div>

                          {/* URL display */}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 break-all">{url.url}</p>
                            <p className="text-xs text-gray-500">
                              {url.analyzed ? `Analyzed ${url.analysisDate ? new Date(url.analysisDate).toLocaleDateString() : 'recently'}` : 'Not analyzed yet'}
                            </p>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => handleRemoveUrl(url.url)}
                          className="px-3 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {project.urls.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {project.urls.length} URL{project.urls.length !== 1 ? 's' : ''} • {project.urls.filter(url => url.analyzed).length} analyzed
                    </div>
                    <button
                      onClick={handleAnalyzeSelected}
                      disabled={selectedUrls.length === 0 || analyzing}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {analyzing ? 'Analyzing...' : `Analyze Selected (${selectedUrls.length})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ANALYSIS CONTROLS - Contentful-style subtle improvements */}
      <div className="mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Project Analysis</h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleClearElements}
                disabled={analyzing || project.elements.length === 0}
                className="bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                title={project.elements.length === 0 ? "No elements to clear" : "Clear all elements for fresh analysis"}
              >
                🧹 Clear Elements
              </button>
              <button
                onClick={handleAnalyzeProject}
                disabled={analyzing}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:bg-gray-400 transition-colors shadow-sm"
              >
                🔍 {analyzing ? 'Analyzing...' : 'Analyze Project'}
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Analysis Progress</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 font-medium">{currentAnalysisStep}</span>
                {(analyzing || analysisProgressPercent > 0) && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    Double-click for details
                  </span>
                )}
              </div>
            </div>
            <div 
              className="w-full bg-gray-200 rounded-full h-3 shadow-inner cursor-pointer hover:shadow-md transition-shadow"
              onDoubleClick={() => setShowAnalysisModal(true)}
              title="Double-click to view detailed analysis progress"
            >
              <div 
                className={`h-3 rounded-full transition-all duration-500 shadow-sm ${
                  analyzing && analysisProgressPercent < 100 ? 'bg-blue-500' : 
                  analysisProgressPercent === 100 ? 'bg-green-500' : 'bg-gray-400'
                }`}
                style={{ width: `${analysisProgressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE SECTIONS - Contentful-style subtle improvements */}
      <div className="space-y-6">
        {/* Authentication Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="p-4">
            <button
              onClick={() => setShowAuthSetup(showAuthSetup ? null : 'toggle')}
              className="w-full flex items-center justify-between text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <span className="text-base font-semibold text-gray-700">🔐 Authentication</span>
                {authFlows.length > 0 && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    {authFlows.length} flow{authFlows.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  showAuthSetup ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showAuthSetup && (
              <div className="mt-3 pt-3 border-t">
                {authFlows.length > 0 ? (
                  <div className="space-y-2">
                    {authFlows.map((authFlow) => (
                      <div key={authFlow.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{authFlow.name}</div>
                            <div className="text-xs text-gray-500">
                              Login URL: {authFlow.loginUrl}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditAuthentication(authFlow)}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-50 rounded"
                              title="Edit authentication"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAuthentication(authFlow.id, authFlow.name)}
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 hover:bg-red-50 rounded"
                              title="Delete authentication"
                            >
                              🗑️ Delete
                            </button>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-2">No authentication configured</p>
                    <button
                      onClick={handleAddAuthentication}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      + Add Authentication
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Element Library Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowElementLibrary(!showElementLibrary)}
                className="flex items-center space-x-3 text-lg font-semibold hover:text-gray-600 hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
              >
                <span>📚 Element Library</span>
                <svg
                  className={`w-5 h-5 transition-transform ${showElementLibrary ? 'rotate-180' : ''} text-gray-400`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="text-sm text-gray-600 font-medium">
                {filteredElements.length} element{filteredElements.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
          {showElementLibrary && (
            <ElementLibraryPanel
              elements={project.elements}
              onSelectElement={(element) => console.log('Selected:', element)}
              selectedElementType={selectedElementType}
              selectedUrl={selectedUrl}
              onElementTypeChange={setSelectedElementType}
              onUrlChange={setSelectedUrl}
              previewMode="auto"
              showQuality={true}
              compact={false}
              isLoading={false}
            />
          )}
        </div>
      </div>

      {/* Technical Details Modal */}
      {showTechnicalDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">🔧 Technical Analysis Details</h3>
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
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2">📊 Current Analysis Status</h4>
                  <div className="text-sm text-gray-700">
                    <p><span className="font-medium">Stage:</span> {currentAnalysisStep}</p>
                    <p><span className="font-medium">Progress:</span> {analysisProgressPercent}%</p>
                    <p><span className="font-medium">URLs Analyzed:</span> {project.urls.filter(url => url.analyzed).length}/{project.urls.length}</p>
                    <p><span className="font-medium">Elements Found:</span> {project.elements.length}</p>
                    <p>
                      <span className="font-medium">Auto-Refresh:</span> 
                      {isAnalysisRunning ? (
                        <span className="text-green-600 ml-1">🔄 Active (every 3s)</span>
                      ) : (
                        <span className="text-gray-500 ml-1">Inactive</span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2">🔍 Analysis Logs</h4>
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
                  <h4 className="font-medium text-sm mb-2">⚙️ Configuration</h4>
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
    </div>
  );
}