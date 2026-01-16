import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '../../lib/logger';

const logger = createLogger('AnalysisProgressModal');

interface AnalysisProgressEvent {
  projectId: string;
  step: string;
  status: 'started' | 'progress' | 'completed' | 'error';
  message: string;
  details?: any;
  timestamp: Date;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
}

interface AnalysisProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export const AnalysisProgressModal: React.FC<AnalysisProgressModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [progressEvents, setProgressEvents] = useState<AnalysisProgressEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    // Connect to WebSocket
    const newSocket = io('http://localhost:3002/analysis-progress', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      logger.debug('Connected to analysis progress socket');
      // Subscribe to this project's analysis updates
      newSocket.emit('subscribe-to-project', projectId);
    });

    newSocket.on('analysis-progress', (event: AnalysisProgressEvent) => {
      logger.debug('Received progress event', event);
      
      setProgressEvents(prev => [...prev, event]);
      setCurrentStep(event.step);

      // Update overall progress based on step
      if (event.progress) {
        setOverallProgress(event.progress.percentage);
      } else {
        // Enhanced progress estimation with more granular steps
        const stepProgress: Record<string, number> = {
          'initialization': 10,
          'auth_check': 20,
          'authenticated_analysis': 45,
          'standard_analysis': 45,
          'element_storage': 80,
          'fallback_analysis': 55,
          'analysis_completed': 100,
          'analysis_error': 100, // Completion at error
        };
        setOverallProgress(stepProgress[event.step] || 0);
      }

      // Enhanced completion detection
      if (event.status === 'completed' && (
        event.step === 'authenticated_analysis' || 
        event.step === 'standard_analysis' || 
        event.step === 'element_storage'
      )) {
        setIsCompleted(true);
        setOverallProgress(100);
      }

      // Enhanced error handling
      if (event.status === 'error') {
        setHasError(true);
        logger.error('Analysis error', event.details);
      }
    });

    // Handle subscription to project updates
    newSocket.on('connect', () => {
      logger.debug('Connected to analysis progress socket');
      newSocket.emit('subscribe-to-project', projectId);
    });

    newSocket.on('disconnect', () => {
      logger.debug('Disconnected from analysis progress socket');
    });

    newSocket.on('connect_error', (error) => {
      logger.warn('Analysis WebSocket connection failed - analysis progress will not be available', error.message);
      // Don't spam the console with repeated connection attempts
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isOpen, projectId]);

  const handleClose = () => {
    if (socket) {
      socket.disconnect();
    }
    setProgressEvents([]);
    setCurrentStep('');
    setOverallProgress(0);
    setIsCompleted(false);
    setHasError(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Analyzing Project: {projectName}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Real-time progress updates
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close (analysis will continue in background)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-500">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                hasError ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          {currentStep && (
            <p className="text-sm text-gray-600 mt-2">
              Current step: <span className="font-medium">{currentStep.replace('_', ' ')}</span>
            </p>
          )}
        </div>

        {/* Progress Log */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Progress Log</h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
            {progressEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Waiting for analysis to start...
              </p>
            ) : (
              <div className="space-y-2">
                {progressEvents.map((event, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      event.status === 'error'
                        ? 'bg-red-50 border-red-400 text-red-800'
                        : event.status === 'completed'
                        ? 'bg-green-50 border-green-400 text-green-800'
                        : event.status === 'started'
                        ? 'bg-blue-50 border-blue-400 text-blue-800'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            event.status === 'error' ? 'bg-red-500' :
                            event.status === 'completed' ? 'bg-green-500' :
                            event.status === 'started' ? 'bg-blue-500' : 'bg-gray-500'
                          }`} />
                          <span className="font-medium text-sm">
                            {event.step.replace('_', ' ').toUpperCase()}
                          </span>
                          {event.progress && (
                            <span className="text-xs bg-white px-2 py-1 rounded">
                              {event.progress.current}/{event.progress.total}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm">{event.message}</p>
                        {event.details && (
                          <div className="mt-2">
                            {/* Enhanced error details display for categorized errors */}
                            {event.status === 'error' && event.details.error && (
                              <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                                <div className="text-xs font-medium text-red-800 mb-1">Error Details:</div>
                                <div className="text-xs text-red-700">{event.details.error}</div>
                                {event.details.suggestions && event.details.suggestions.length > 0 && (
                                  <div className="mt-2">
                                    <div className="text-xs font-medium text-red-800 mb-1">Suggestions:</div>
                                    <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                                      {event.details.suggestions.map((suggestion: string, idx: number) => (
                                        <li key={idx}>{suggestion}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Progress details for successful steps */}
                            {event.status !== 'error' && (event.details.url || event.details.elementCount !== undefined) && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                                {event.details.url && (
                                  <div className="text-xs text-blue-700">
                                    <span className="font-medium">URL:</span> {event.details.url}
                                  </div>
                                )}
                                {event.details.elementCount !== undefined && (
                                  <div className="text-xs text-blue-700">
                                    <span className="font-medium">Elements found:</span> {event.details.elementCount}
                                  </div>
                                )}
                                {event.details.authFlow && (
                                  <div className="text-xs text-blue-700">
                                    <span className="font-medium">Auth flow:</span> {event.details.authFlow}
                                  </div>
                                )}
                                {event.details.retryCount !== undefined && event.details.retryCount > 0 && (
                                  <div className="text-xs text-orange-700 mt-1">
                                    <span className="font-medium">Retries:</span> {event.details.retryCount} 
                                    <span className="ml-2">Duration: {Math.round(event.details.totalDuration/1000)}s</span>
                                  </div>
                                )}
                                {event.details.recommendations && event.details.recommendations.length > 0 && (
                                  <div className="text-xs text-blue-700 mt-1">
                                    <span className="font-medium">Recommendations:</span>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                      {event.details.recommendations.slice(0, 2).map((rec: string, idx: number) => (
                                        <li key={idx}>{rec}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Full details toggle for debugging */}
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer text-gray-600">
                                View raw details
                              </summary>
                              <pre className="mt-1 text-xs bg-white p-2 rounded overflow-x-auto max-h-32">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-4">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            {!isCompleted && !hasError && (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-sm text-gray-600">Analysis in progress...</span>
              </>
            )}
            {isCompleted && (
              <>
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-green-600">Analysis completed successfully!</span>
              </>
            )}
            {hasError && (
              <>
                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-red-600">Analysis encountered errors</span>
              </>
            )}
          </div>
          
          {(isCompleted || hasError) && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};