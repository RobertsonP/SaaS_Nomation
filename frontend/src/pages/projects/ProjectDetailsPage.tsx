import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectsAPI, authFlowsAPI, analyzeProjectPages } from '../../lib/api';
import { ElementLibraryPanel } from '../../components/test-builder/ElementLibraryPanel';
import { AnalysisProgressModal } from '../../components/analysis/AnalysisProgressModal';
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
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedElementType, setSelectedElementType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');
  
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
          setCurrentAnalysisStep(data.message || 'Processing...');
          
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

  // ENHANCED: Add analysis functionality with real-time progress
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
      showError('Analysis Error', 'Failed to start analysis');
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

  const filteredElements = project?.elements.filter(element => {
    const typeMatch = selectedElementType === 'all' || element.elementType === selectedElementType;
    const urlMatch = selectedUrl === 'all' || element.sourceUrl?.id === selectedUrl;
    return typeMatch && urlMatch;
  }) || [];

  // Group elements by source URL for better organization
  const elementsByUrl = filteredElements.reduce((acc, element) => {
    const urlId = element.sourceUrl?.id || 'unknown';
    if (!acc[urlId]) {
      acc[urlId] = [];
    }
    acc[urlId].push(element);
    return acc;
  }, {} as Record<string, ProjectElement[]>);

  const elementTypes = [...new Set(project?.elements.map(e => e.elementType) || [])];

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
              to={`/projects/${project.id}/tests`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              View Tests ({project._count.tests})
            </Link>
            <Link
              to={`/projects/${project.id}/tests/new`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Create Test
            </Link>
          </div>
        </div>

        {/* Project Stats - Compact */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs font-medium text-blue-900">URLs</div>
            <div className="text-lg font-bold text-blue-600">{project._count.urls}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-xs font-medium text-green-900">Elements</div>
            <div className="text-lg font-bold text-green-600">{project._count.elements}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-xs font-medium text-purple-900">Tests</div>
            <div className="text-lg font-bold text-purple-600">{project._count.tests}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-xs font-medium text-orange-900">Analyzed</div>
            <div className="text-lg font-bold text-orange-600">
              {project.urls.filter(url => url.analyzed).length}
            </div>
          </div>
        </div>
      </div>

      {/* NEW LAYOUT: Sidebar + Main Content */}
      <div className="flex gap-6">
        {/* LEFT SIDEBAR: URL Navigation */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow border sticky top-6">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Project URLs</h3>
            </div>
            <div className="p-2 space-y-1">
              {/* All URLs option */}
              <button
                onClick={() => setSelectedUrl('all')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedUrl === 'all'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">All URLs</div>
                <div className="text-xs text-gray-500">{project.elements.length} elements</div>
              </button>
              
              {/* Individual URLs */}
              {project.urls.map((url) => {
                const elementCount = project.elements.filter(el => el.sourceUrl?.id === url.id).length;
                return (
                  <button
                    key={url.id}
                    onClick={() => setSelectedUrl(url.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedUrl === url.id
                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate">{url.title || 'Page'}</span>
                      <span className={`w-2 h-2 rounded-full ${url.analyzed ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{url.url}</div>
                    <div className="text-xs text-gray-400">{elementCount} elements</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT MAIN CONTENT */}
        <div className="flex-1 space-y-6">
          
          {/* ANALYSIS PROGRESS SECTION */}
          <div className="bg-white rounded-lg shadow border">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Analysis</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleClearElements}
                    disabled={analyzing || project.elements.length === 0}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                    title={project.elements.length === 0 ? "No elements to clear" : "Clear all elements for fresh analysis"}
                  >
                    🧹 Clear Elements
                  </button>
                  <button
                    onClick={handleAnalyzeProject}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    🔍 Analyze Project
                  </button>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm text-gray-500">{currentAnalysisStep}</span>
                  </div>
                  <div 
                    className="w-full bg-gray-200 rounded-full h-3 cursor-pointer hover:bg-gray-300 transition-colors"
                    onDoubleClick={() => setShowTechnicalDetails(true)}
                    title="Double-click to view detailed technical logs"
                  >
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        analyzing && analysisProgressPercent < 100 ? 'bg-blue-500' : 
                        analysisProgressPercent === 100 ? 'bg-green-500' : 
                        analysisProgressPercent > 0 ? 'bg-yellow-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${analysisProgressPercent}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {analyzing ? (
                      <span className="flex items-center space-x-2">
                        <span>Analysis in progress...</span>
                        {isAnalysisRunning && (
                          <span className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span>Auto-refreshing</span>
                          </span>
                        )}
                      </span>
                    ) : (
                      'Double-click to view detailed logs'
                    )}
                  </p>
                </div>
                <button 
                  onClick={() => setShowTechnicalDetails(true)}
                  className="text-gray-400 hover:text-gray-600"
                  title="View technical details"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* AUTHENTICATION SECTION */}
          <div className="bg-white rounded-lg shadow border">
            <div className="p-3">
              <button
                onClick={() => setShowAuthSetup(showAuthSetup ? null : 'toggle')}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">🔐 Authentication</span>
                  {authFlows.length > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      {authFlows.length} flow{authFlows.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
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
                        <div key={authFlow.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium">{authFlow.name}</h4>
                              <p className="text-xs text-gray-600">{authFlow.loginUrl}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => navigate(`/projects/${projectId}/auth/setup?edit=${authFlow.id}`)}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-50 rounded"
                                title="Edit authentication"
                              >
                                ✏️ Edit
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
                        onClick={() => navigate(`/projects/${projectId}/auth/setup`)}
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

          {/* SCRAPED ELEMENTS SECTION */}
          <div className="bg-white rounded-lg shadow border">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Scraped Elements
                  {selectedUrl !== 'all' && (
                    <span className="ml-2 text-sm text-gray-500">
                      from {project.urls.find(u => u.id === selectedUrl)?.title}
                    </span>
                  )}
                </h2>
              </div>
              
              {/* Element Filters */}
              <div className="flex items-center space-x-4 mt-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Element Type</label>
                  <select
                    value={selectedElementType}
                    onChange={(e) => setSelectedElementType(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Types</option>
                    {elementTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-gray-500">
                  {filteredElements.length} element{filteredElements.length !== 1 ? 's' : ''} found
                </div>
              </div>
            </div>

            {/* Elements Grid */}
            <div className="p-4">
              {filteredElements.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-4xl mb-4">📦</div>
                  <p className="text-gray-500 mb-2">No elements found</p>
                  <p className="text-sm text-gray-400">
                    Run analysis to discover elements from your project URLs
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredElements.map((element) => (
                    <div key={element.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{getElementIcon(element.elementType)}</span>
                          <span className={`px-2 py-1 text-xs rounded border ${getElementTypeColor(element.elementType)}`}>
                            {element.elementType}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(element.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">{element.description}</p>
                      <p className="text-xs text-gray-600 font-mono bg-gray-100 p-1 rounded truncate">
                        {element.selector}
                      </p>
                      {selectedUrl === 'all' && element.sourceUrl && (
                        <p className="text-xs text-blue-600 mt-1 truncate">
                          {element.sourceUrl.url}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
    </div>
  );
}