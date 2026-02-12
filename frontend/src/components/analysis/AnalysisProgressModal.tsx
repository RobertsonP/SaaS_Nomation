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
  onMinimize?: () => void;
  projectId: string;
  projectName: string;
}

export const AnalysisProgressModal: React.FC<AnalysisProgressModalProps> = ({
  isOpen,
  onClose,
  onMinimize,
  projectId,
  projectName,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [progressEvents, setProgressEvents] = useState<AnalysisProgressEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [startTime] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Elapsed time timer
  useEffect(() => {
    if (!isOpen || isCompleted || hasError) return;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isCompleted, hasError, startTime]);

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
        // For element_extraction sub-progress, scale within 30-70% range
        if (event.step === 'element_extraction') {
          setOverallProgress(30 + Math.round(event.progress.percentage * 0.4));
        } else {
          setOverallProgress(event.progress.percentage);
        }
      } else {
        // Enhanced progress estimation with more granular steps
        const stepProgress: Record<string, number> = {
          'initialization': 5,
          'auth_check': 15,
          'element_extraction': 40,
          'authenticated_analysis': 45,
          'standard_analysis': 50,
          'element_storage': 80,
          'fallback_analysis': 55,
          'analysis_completed': 100,
          'analysis_error': 100,
        };
        setOverallProgress(stepProgress[event.step] || 0);
      }

      // Completion detection — ONLY on analysis_completed or completed auth/standard steps
      if (event.status === 'completed' && (
        event.step === 'authenticated_analysis' ||
        event.step === 'standard_analysis' ||
        event.step === 'analysis_completed'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              Analyzing Project: {projectName}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Real-time progress updates
            </p>
          </div>
          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            {/* Minimize button */}
            {onMinimize && !isCompleted && !hasError && (
              <button
                onClick={onMinimize}
                className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                title="Minimize to floating indicator"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            {/* Close button */}
            <button
              onClick={handleClose}
              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title="Close (analysis will continue in background)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!isCompleted && !hasError && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
              )}
              {isCompleted && (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {hasError && (
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <span className={`text-sm font-medium ${
                hasError ? 'text-red-700 dark:text-red-300' :
                isCompleted ? 'text-green-700 dark:text-green-300' :
                'text-gray-900 dark:text-white'
              }`}>
                {progressEvents.length > 0
                  ? progressEvents[progressEvents.length - 1].message
                  : 'Starting analysis...'}
              </span>
            </div>
            {!isCompleted && !hasError && elapsedSeconds > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {elapsedSeconds}s
              </span>
            )}
          </div>
        </div>

        {/* Progress Log */}
        <div className="p-6 flex-1 overflow-hidden flex flex-col min-h-0">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex-shrink-0">Progress Log</h3>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex-1 overflow-y-auto">
            {progressEvents.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Waiting for analysis to start...
              </p>
            ) : (
              <div className="space-y-2">
                {progressEvents.map((event, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      event.status === 'error'
                        ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-800 dark:text-red-300'
                        : event.status === 'completed'
                        ? 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-800 dark:text-green-300'
                        : event.status === 'started'
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-300'
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
                            <span className="text-xs bg-white dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded">
                              {event.progress.current}/{event.progress.total}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm">{event.message}</p>
                        {event.details && (
                          <div className="mt-2">
                            {/* Enhanced error details display for categorized errors */}
                            {event.status === 'error' && event.details.error && (
                              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-2 mb-2">
                                <div className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">Error Details:</div>
                                <div className="text-xs text-red-700 dark:text-red-400">{event.details.error}</div>
                                {event.details.suggestions && event.details.suggestions.length > 0 && (
                                  <div className="mt-2">
                                    <div className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">Suggestions:</div>
                                    <ul className="text-xs text-red-700 dark:text-red-400 list-disc list-inside space-y-1">
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
                              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded p-2 mb-2 overflow-hidden">
                                {event.details.url && (
                                  <div className="text-xs text-blue-700 dark:text-blue-300 truncate">
                                    <span className="font-medium">URL:</span> {event.details.url}
                                  </div>
                                )}
                                {event.details.elementCount !== undefined && (
                                  <div className="text-xs text-blue-700 dark:text-blue-300">
                                    <span className="font-medium">Elements found:</span> {event.details.elementCount}
                                  </div>
                                )}
                                {event.details.authFlow && (
                                  <div className="text-xs text-blue-700 dark:text-blue-300">
                                    <span className="font-medium">Auth flow:</span> {event.details.authFlow}
                                  </div>
                                )}
                                {event.details.retryCount !== undefined && event.details.retryCount > 0 && (
                                  <div className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                                    <span className="font-medium">Retries:</span> {event.details.retryCount}
                                    <span className="ml-2">Duration: {Math.round(event.details.totalDuration/1000)}s</span>
                                  </div>
                                )}
                                {event.details.recommendations && event.details.recommendations.length > 0 && (
                                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
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
                              <summary className="text-xs cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                                View raw details
                              </summary>
                              <pre className="mt-1 text-xs bg-white dark:bg-gray-800 dark:text-gray-300 p-2 rounded overflow-auto max-h-32 break-words whitespace-pre-wrap">
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
        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
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