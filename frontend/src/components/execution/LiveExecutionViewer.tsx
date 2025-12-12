import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';

interface LiveExecutionStep {
  id: string;
  stepIndex: number;
  type: string;
  selector: string;
  value?: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  screenshot?: string; // Base64 encoded
  error?: string;
}

interface LiveExecutionData {
  executionId: string;
  testId: string;
  testName: string;
  status: 'initializing' | 'running' | 'passed' | 'failed' | 'stopped';
  currentStepIndex: number;
  totalSteps: number;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  steps: LiveExecutionStep[];
  currentScreenshot?: string;
  browserViewport?: {
    width: number;
    height: number;
    url: string;
  };
}

interface LiveExecutionViewerProps {
  testId: string;
  testName: string;
  isOpen: boolean;
  onClose: () => void;
  onExecutionComplete?: (result: LiveExecutionData) => void;
}

export function LiveExecutionViewer({
  testId,
  testName,
  isOpen,
  onClose,
  onExecutionComplete
}: LiveExecutionViewerProps) {
  const [executionData, setExecutionData] = useState<LiveExecutionData | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showViewport, setShowViewport] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isOpen && testId) {
      startExecution();
    }
    
    return () => {
      cleanup();
    };
  }, [isOpen, testId]);

  const startExecution = async () => {
    try {
      setIsExecuting(true);
      setError(null);

      // Initialize WebSocket connection for real-time updates (optional)
      // setupWebSocket();

      // Start the execution using the API - this now returns complete results
      const response = await api.post(`/api/execution/test/${testId}/run-live`);
      const execution = response.data;

      // Map the execution results to our live execution format
      const executionResults = execution.results || [];

      setExecutionData({
        executionId: execution.id,
        testId: testId,
        testName: testName,
        status: execution.status === 'passed' ? 'passed' : execution.status === 'failed' ? 'failed' : 'running',
        currentStepIndex: executionResults.length,
        totalSteps: executionResults.length,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        duration: execution.duration,
        steps: executionResults.map((result: any, index: number) => ({
          id: result.step || `step-${index}`,
          stepIndex: index,
          type: result.step,
          selector: result.selector,
          value: result.value,
          description: result.description,
          status: result.status === 'passed' ? 'passed' : result.status === 'failed' ? 'failed' : 'pending',
          screenshot: result.screenshot,
          error: result.error,
          duration: result.duration,
          startedAt: result.timestamp,
          completedAt: result.timestamp
        }))
      });

      setIsExecuting(false);

      // Call completion callback if provided
      if (onExecutionComplete) {
        onExecutionComplete(execution);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsExecuting(false);
    }
  };

  const setupWebSocket = () => {
    try {
      const wsUrl = `ws://localhost:3002/execution/${testId}/live`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('🔗 Live execution WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          handleExecutionUpdate(update);
        } catch (parseError) {
          console.error('Failed to parse WebSocket message:', parseError);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Live connection lost. Execution may still be running in background.');
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket connection closed');
      };

    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
    }
  };

  const handleExecutionUpdate = (update: any) => {
    setExecutionData(prev => {
      if (!prev) return null;

      let updatedData = { ...prev };

      switch (update.type) {
        case 'execution_started':
          updatedData.status = 'running';
          break;

        case 'step_started':
          updatedData.currentStepIndex = update.stepIndex;
          updatedData.steps = prev.steps.map((step, index) => 
            index === update.stepIndex 
              ? { ...step, status: 'running', startedAt: update.timestamp }
              : step
          );
          break;

        case 'step_completed':
          updatedData.steps = prev.steps.map((step, index) => 
            index === update.stepIndex 
              ? { 
                  ...step, 
                  status: update.status,
                  completedAt: update.timestamp,
                  duration: update.duration,
                  screenshot: update.screenshot,
                  error: update.error
                }
              : step
          );
          break;

        case 'viewport_update':
          updatedData.currentScreenshot = update.screenshot;
          updatedData.browserViewport = update.viewport;
          break;

        case 'execution_completed':
          updatedData.status = update.status;
          updatedData.duration = update.duration;
          setIsExecuting(false);
          onExecutionComplete?.(updatedData);
          break;

        case 'execution_failed':
          updatedData.status = 'failed';
          updatedData.duration = update.duration;
          setError(update.error || 'Execution failed');
          setIsExecuting(false);
          break;

        default:
          console.log('Unknown update type:', update.type);
      }

      return updatedData;
    });
  };

  const stopExecution = async () => {
    try {
      if (executionData?.executionId) {
        await api.post(`/api/execution/${executionData.executionId}/stop`);
      }
    } catch (error) {
      console.error('Failed to stop execution:', error);
    }
  };

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleClose = () => {
    if (isExecuting) {
      if (confirm('Test is currently running. Stop execution and close?')) {
        stopExecution();
        cleanup();
        onClose();
      }
    } else {
      cleanup();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">🚀 Live Test Execution</h2>
              <p className="text-sm opacity-90">{testName}</p>
            </div>
            <div className="flex items-center space-x-3">
              {executionData && (
                <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-xs">
                  Step {executionData.currentStepIndex + 1} of {executionData.totalSteps}
                </div>
              )}
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 text-2xl font-bold"
                aria-label="Close execution viewer"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="text-red-500 text-xl mr-3">⚠️</div>
              <div>
                <div className="text-red-800 font-medium">Execution Error</div>
                <div className="text-red-700 text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Browser Viewport */}
          {showViewport && (
            <div className="flex-1 flex flex-col border-r border-gray-200">
              <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Browser Viewport</div>
                <div className="flex items-center space-x-2">
                  {executionData?.browserViewport && (
                    <span className="text-xs text-gray-500">
                      {executionData.browserViewport.width}x{executionData.browserViewport.height}
                    </span>
                  )}
                  <button
                    onClick={() => setShowViewport(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Hide
                  </button>
                </div>
              </div>
              
              <div className="flex-1 bg-gray-100 flex items-center justify-center">
                {executionData?.currentScreenshot ? (
                  <img
                    src={executionData.currentScreenshot}
                    alt="Browser viewport"
                    className="max-w-full max-h-full object-contain border border-gray-300 rounded"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">🌐</div>
                    <p>Waiting for browser viewport...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Execution Progress */}
          <div className="w-96 flex flex-col">
            <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Execution Progress</div>
              {!showViewport && (
                <button
                  onClick={() => setShowViewport(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Show Viewport
                </button>
              )}
            </div>

            {/* Status Banner */}
            {executionData && (
              <div className={`p-3 border-b border-gray-200 ${
                executionData.status === 'running' ? 'bg-blue-50' :
                executionData.status === 'passed' ? 'bg-green-50' :
                executionData.status === 'failed' ? 'bg-red-50' :
                'bg-gray-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {executionData.status === 'initializing' && '⚙️ Initializing...'}
                    {executionData.status === 'running' && '▶️ Running'}
                    {executionData.status === 'passed' && '✅ Passed'}
                    {executionData.status === 'failed' && '❌ Failed'}
                    {executionData.status === 'stopped' && '⏹️ Stopped'}
                  </div>
                  {executionData.duration && (
                    <div className="text-xs text-gray-600">
                      {(executionData.duration / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Steps List */}
            <div className="flex-1 overflow-y-auto">
              {executionData?.steps.length ? (
                <div className="p-3 space-y-2">
                  {executionData.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`p-3 rounded-lg border ${
                        step.status === 'running' ? 'bg-blue-50 border-blue-200' :
                        step.status === 'passed' ? 'bg-green-50 border-green-200' :
                        step.status === 'failed' ? 'bg-red-50 border-red-200' :
                        'bg-gray-50 border-gray-200'
                      } ${index === executionData.currentStepIndex ? 'ring-2 ring-blue-300' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-medium text-gray-500">
                          Step {index + 1} • {step.type}
                        </div>
                        <div className="text-xs">
                          {step.status === 'pending' && '⏸️'}
                          {step.status === 'running' && '▶️'}
                          {step.status === 'passed' && '✅'}
                          {step.status === 'failed' && '❌'}
                          {step.status === 'skipped' && '⏭️'}
                        </div>
                      </div>
                      
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {step.description}
                      </div>
                      
                      {step.selector && (
                        <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 mb-1">
                          {step.selector}
                        </div>
                      )}
                      
                      {step.value && (
                        <div className="text-xs text-blue-600">
                          Value: "{step.value}"
                        </div>
                      )}
                      
                      {step.error && (
                        <div className="text-xs text-red-600 mt-1">
                          Error: {step.error}
                        </div>
                      )}
                      
                      {step.duration && (
                        <div className="text-xs text-gray-500 mt-1">
                          Duration: {(step.duration / 1000).toFixed(1)}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <div className="text-2xl mb-2">⏳</div>
                  <p>Loading test steps...</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="border-t border-gray-200 p-3 bg-gray-50">
              <div className="flex space-x-2">
                {isExecuting ? (
                  <button
                    onClick={stopExecution}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    ⏹️ Stop Execution
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}