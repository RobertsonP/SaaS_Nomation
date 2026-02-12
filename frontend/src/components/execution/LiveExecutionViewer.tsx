import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '../../lib/logger';

const logger = createLogger('LiveExecutionViewer');

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
  const [queueStatus, setQueueStatus] = useState<{ position: number; waiting: boolean } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const stepsContainerRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (isOpen && testId) {
      startExecution();
    }

    return () => {
      cleanup();
    };
  }, [isOpen, testId]);

  // Auto-scroll to current step when it changes
  useEffect(() => {
    if (executionData?.currentStepIndex !== undefined) {
      const stepElement = stepRefs.current.get(executionData.currentStepIndex);
      if (stepElement) {
        stepElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [executionData?.currentStepIndex]);

  const setupSocketIO = useCallback(() => {
    // Connect to Socket.IO for real-time execution updates
    const socket = io('http://localhost:3002/execution-progress', {
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      logger.debug('Socket.IO connected for live execution');
      // Subscribe to this execution's updates if we have a job ID
      if (jobId) {
        socket.emit('subscribe-to-execution', { jobId, testId });
      }
    });

    socket.on('execution-queued', (data: { jobId: string; position: number }) => {
      logger.debug('Execution queued', data);
      setQueueStatus({ position: data.position, waiting: true });
    });

    socket.on('execution-started', (data: { jobId: string; executionId: string; totalSteps: number }) => {
      logger.debug('Execution started', data);
      setQueueStatus(null);
      setExecutionData(prev => ({
        executionId: data.executionId,
        testId: testId,
        testName: testName,
        status: 'running',
        currentStepIndex: 0,
        totalSteps: data.totalSteps,
        startedAt: new Date().toISOString(),
        steps: prev?.steps || []
      }));
    });

    socket.on('step-started', (data: { stepIndex: number; step: any }) => {
      logger.debug('Step started', data);
      setExecutionData(prev => {
        if (!prev) return prev;
        const steps = [...prev.steps];
        // Ensure the step exists in the array
        while (steps.length <= data.stepIndex) {
          steps.push({
            id: `step-${steps.length}`,
            stepIndex: steps.length,
            type: 'unknown',
            selector: '',
            description: 'Loading...',
            status: 'pending'
          });
        }
        steps[data.stepIndex] = {
          ...steps[data.stepIndex],
          id: data.step?.id || `step-${data.stepIndex}`,
          type: data.step?.type || 'unknown',
          selector: data.step?.selector || '',
          description: data.step?.description || 'Executing...',
          status: 'running',
          startedAt: new Date().toISOString()
        };
        return {
          ...prev,
          currentStepIndex: data.stepIndex,
          steps
        };
      });
    });

    socket.on('step-completed', (data: { stepIndex: number; status: string; screenshot?: string; error?: string; duration?: number }) => {
      logger.debug('Step completed', data);
      setExecutionData(prev => {
        if (!prev) return prev;
        const steps = [...prev.steps];
        if (steps[data.stepIndex]) {
          steps[data.stepIndex] = {
            ...steps[data.stepIndex],
            status: data.status === 'passed' ? 'passed' : data.status === 'failed' ? 'failed' : 'pending',
            screenshot: data.screenshot,
            error: data.error,
            duration: data.duration,
            completedAt: new Date().toISOString()
          };
        }
        return {
          ...prev,
          currentScreenshot: data.screenshot || prev.currentScreenshot,
          steps
        };
      });
    });

    socket.on('viewport-update', (data: { screenshot: string; viewport?: { width: number; height: number; url: string } }) => {
      setExecutionData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentScreenshot: data.screenshot,
          browserViewport: data.viewport || prev.browserViewport
        };
      });
    });

    socket.on('execution-completed', (data: { status: string; duration: number; results: any[] }) => {
      logger.debug('Execution completed', data);
      setIsExecuting(false);
      setExecutionData(prev => {
        if (!prev) return prev;
        const finalStatus: LiveExecutionData['status'] = data.status === 'passed' ? 'passed' : 'failed';
        const finalData: LiveExecutionData = {
          ...prev,
          status: finalStatus,
          duration: data.duration,
          completedAt: new Date().toISOString()
        };
        onExecutionComplete?.(finalData);
        return finalData;
      });
    });

    socket.on('execution-failed', (data: { error: string; duration?: number }) => {
      logger.error('Execution failed', data);
      setIsExecuting(false);
      setError(data.error);
      setExecutionData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'failed',
          duration: data.duration
        };
      });
    });

    socket.on('disconnect', () => {
      logger.debug('Socket.IO disconnected');
    });

    socket.on('connect_error', (error) => {
      logger.warn('Socket.IO connection error', error.message);
      // Don't show error to user - the execution may still complete via API
    });

    socketRef.current = socket;
    return socket;
  }, [jobId, testId, testName, onExecutionComplete]);

  const startExecution = async () => {
    try {
      setIsExecuting(true);
      setError(null);
      setQueueStatus(null);
      setExecutionData(null);

      // Setup Socket.IO for real-time updates
      const socket = setupSocketIO();

      // Start the execution using the API
      // The API may return immediately with a job ID, or wait and return results
      const response = await api.post(`/api/execution/test/${testId}/run-live`);
      const execution = response.data;

      // Check if we got a job ID (queued) or immediate results
      if (execution.jobId && !execution.results) {
        // Execution is queued - wait for Socket.IO updates
        setJobId(execution.jobId);
        setQueueStatus({ position: execution.position || 1, waiting: true });

        // Subscribe to this execution's updates
        socket.emit('subscribe-to-execution', { jobId: execution.jobId, testId });

        // Initialize empty execution data with pending steps
        if (execution.totalSteps) {
          const pendingSteps: LiveExecutionStep[] = [];
          for (let i = 0; i < execution.totalSteps; i++) {
            pendingSteps.push({
              id: `step-${i}`,
              stepIndex: i,
              type: execution.steps?.[i]?.type || 'unknown',
              selector: execution.steps?.[i]?.selector || '',
              description: execution.steps?.[i]?.description || `Step ${i + 1}`,
              status: 'pending'
            });
          }
          setExecutionData({
            executionId: execution.jobId,
            testId: testId,
            testName: testName,
            status: 'initializing',
            currentStepIndex: 0,
            totalSteps: execution.totalSteps,
            startedAt: new Date().toISOString(),
            steps: pendingSteps
          });
        }
        return; // Wait for WebSocket updates
      }

      // We got immediate results - execution completed synchronously
      const executionResults = execution.results || [];

      setExecutionData({
        executionId: execution.id || execution.executionId,
        testId: testId,
        testName: testName,
        status: execution.status === 'passed' ? 'passed' : execution.status === 'failed' ? 'failed' : 'running',
        currentStepIndex: executionResults.length > 0 ? executionResults.length - 1 : 0,
        totalSteps: executionResults.length,
        startedAt: execution.startedAt || new Date().toISOString(),
        completedAt: execution.completedAt,
        duration: execution.duration,
        steps: executionResults.map((result: any, index: number) => ({
          id: result.step || `step-${index}`,
          stepIndex: index,
          type: result.type || result.step || 'unknown',
          selector: result.selector || '',
          value: result.value,
          description: result.description || `Step ${index + 1}`,
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
      if (onExecutionComplete && execution.status) {
        onExecutionComplete(execution);
      }

    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Unknown error starting execution';
      setError(errorMessage);
      setIsExecuting(false);
      logger.error('Execution start failed', err);
    }
  };

  const stopExecution = async () => {
    try {
      if (executionData?.executionId) {
        await api.post(`/api/execution/${executionData.executionId}/stop`);
      }
      if (jobId) {
        await api.post(`/api/execution/job/${jobId}/cancel`).catch(() => {});
      }
    } catch (error) {
      logger.error('Failed to stop execution', error);
    }
  };

  const cleanup = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setJobId(null);
    setQueueStatus(null);
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
              {/* Queue Status Display */}
              {queueStatus?.waiting && (
                <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                  <div className="flex items-center gap-3">
                    <div className="animate-pulse">⏳</div>
                    <div>
                      <div className="text-sm font-medium text-yellow-800">Queued for Execution</div>
                      <div className="text-xs text-yellow-600">
                        Position #{queueStatus.position} in queue. Waiting for browser...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {executionData?.steps.length ? (
                <div ref={stepsContainerRef} className="p-3 space-y-2">
                  {executionData.steps.map((step, index) => (
                    <div
                      key={step.id}
                      ref={(el) => {
                        if (el) stepRefs.current.set(index, el);
                      }}
                      className={`p-3 rounded-lg border transition-all duration-300 ease-in-out ${
                        step.status === 'running'
                          ? 'bg-blue-50 border-blue-300 shadow-md shadow-blue-100 animate-pulse'
                          : step.status === 'passed'
                            ? 'bg-green-50 border-green-300 shadow-sm'
                            : step.status === 'failed'
                              ? 'bg-red-50 border-red-300 shadow-sm'
                              : 'bg-gray-50 border-gray-200 opacity-60'
                      } ${index === executionData.currentStepIndex && step.status === 'running'
                        ? 'ring-2 ring-blue-400 ring-offset-1 scale-[1.02]'
                        : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={`text-xs font-medium ${
                          step.status === 'running' ? 'text-blue-600' :
                          step.status === 'passed' ? 'text-green-600' :
                          step.status === 'failed' ? 'text-red-600' :
                          'text-gray-500'
                        }`}>
                          Step {index + 1} • {step.type}
                        </div>
                        <div className={`text-sm flex items-center gap-1 ${
                          step.status === 'passed' ? 'animate-bounce-once' : ''
                        }`}>
                          {step.status === 'pending' && <span className="opacity-40">⏸️</span>}
                          {step.status === 'running' && (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                              <span className="text-blue-600 font-medium">Running</span>
                            </span>
                          )}
                          {step.status === 'passed' && <span className="text-green-500">✅ Done</span>}
                          {step.status === 'failed' && <span className="text-red-500">❌ Failed</span>}
                          {step.status === 'skipped' && <span className="opacity-40">⏭️</span>}
                        </div>
                      </div>

                      <div className={`text-sm font-medium mb-1 ${
                        step.status === 'running' ? 'text-blue-900' :
                        step.status === 'passed' ? 'text-green-900' :
                        step.status === 'failed' ? 'text-red-900' :
                        'text-gray-700'
                      }`}>
                        {step.description}
                      </div>

                      {step.selector && (
                        <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300 mb-1 truncate" title={step.selector}>
                          {step.selector}
                        </div>
                      )}

                      {step.value && (
                        <div className="text-xs text-blue-600">
                          Value: "{step.value}"
                        </div>
                      )}

                      {step.error && (
                        <div className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded border border-red-200">
                          ⚠️ {step.error}
                        </div>
                      )}

                      {step.duration !== undefined && step.status !== 'pending' && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          ⏱️ {(step.duration / 1000).toFixed(2)}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  {isExecuting ? (
                    <>
                      <div className="text-2xl mb-2 animate-spin">⚙️</div>
                      <p>Initializing execution...</p>
                      <p className="text-xs mt-1">Setting up browser environment</p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl mb-2">⏳</div>
                      <p>Loading test steps...</p>
                    </>
                  )}
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