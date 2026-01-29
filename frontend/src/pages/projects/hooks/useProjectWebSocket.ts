import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('useProjectWebSocket');

interface AnalysisLog {
  timestamp: string;
  level: string;
  message: string;
}

interface UseProjectWebSocketOptions {
  projectId: string | undefined;
  projectName: string | undefined;
  onProjectReload: () => Promise<void>;
  onElementsKeyIncrement: () => void;
  onAnalysisDashboardReload?: () => void;
  showAnalysisDashboard?: boolean;
  showError: (title: string, message: string) => void;
}

interface UseProjectWebSocketReturn {
  isAnalysisRunning: boolean;
  analyzing: boolean;
  currentAnalysisStep: string;
  analysisProgressPercent: number;
  analysisLogs: AnalysisLog[];
  setAnalyzing: (value: boolean) => void;
  setCurrentAnalysisStep: (value: string) => void;
  clearLogs: () => void;
}

export function useProjectWebSocket({
  projectId,
  projectName,
  onProjectReload,
  onElementsKeyIncrement,
  onAnalysisDashboardReload,
  showAnalysisDashboard = false,
  showError,
}: UseProjectWebSocketOptions): UseProjectWebSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState('Ready');
  const [analysisProgressPercent, setAnalysisProgressPercent] = useState(100);
  const [analysisLogs, setAnalysisLogs] = useState<AnalysisLog[]>([]);

  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
  }, []);

  const startAutoRefresh = useCallback(() => {
    stopAutoRefresh();
    autoRefreshIntervalRef.current = setInterval(() => {
      if (isAnalysisRunning) {
        logger.debug('Auto-refreshing project data...');
        onProjectReload();
      }
    }, 3000);
  }, [isAnalysisRunning, onProjectReload, stopAutoRefresh]);

  const clearLogs = useCallback(() => {
    setAnalysisLogs([]);
  }, []);

  useEffect(() => {
    if (!projectId) return;

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

        socket.on('analysis-started', () => {
          logger.info('Analysis started, enabling auto-refresh');
          setIsAnalysisRunning(true);
          setAnalyzing(true);
          setCurrentAnalysisStep('Initializing...');
          setAnalysisProgressPercent(0);

          const timestamp = new Date().toLocaleTimeString();
          setAnalysisLogs(prev => [...prev, {
            timestamp,
            level: 'INFO',
            message: `Analysis started for project: ${projectName || 'Unknown'}`
          }]);

          startAutoRefresh();
        });

        socket.on('analysis-progress', (data) => {
          logger.debug('Analysis progress update', data);

          let stepMessage = data.message || 'Processing...';
          if (stepMessage.includes('Analyzing URL') || stepMessage.includes('elements from')) {
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

          if (data.progress && data.progress.current !== undefined && data.progress.total !== undefined) {
            const progress = data.progress.percentage || Math.round((data.progress.current / data.progress.total) * 100);
            setAnalysisProgressPercent(progress);
          } else if (data.current !== undefined && data.total !== undefined) {
            const progress = Math.round((data.current / data.total) * 100);
            setAnalysisProgressPercent(progress);
          }

          const timestamp = new Date().toLocaleTimeString();
          setAnalysisLogs(prev => [...prev, {
            timestamp,
            level: 'PROGRESS',
            message: data.message || 'Processing...'
          }]);

          onProjectReload();
        });

        socket.on('analysis-completed', async (data) => {
          logger.info('Analysis completed, disabling auto-refresh');
          setIsAnalysisRunning(false);
          setAnalyzing(false);
          setCurrentAnalysisStep('Complete');
          setAnalysisProgressPercent(100);

          const timestamp = new Date().toLocaleTimeString();
          setAnalysisLogs(prev => [...prev, {
            timestamp,
            level: 'SUCCESS',
            message: `Analysis completed successfully. Found ${data.totalElements || 0} elements.`
          }]);

          await onProjectReload();
          onElementsKeyIncrement();

          if (showAnalysisDashboard && onAnalysisDashboardReload) {
            onAnalysisDashboardReload();
          }

          stopAutoRefresh();
        });

        socket.on('analysis-error', (data) => {
          logger.error('Analysis error', data);
          setIsAnalysisRunning(false);
          setAnalyzing(false);
          setCurrentAnalysisStep('Error occurred');

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
          logger.warn('Real-time analysis WebSocket connection failed', error.message);
        });

      } catch (error) {
        logger.error('Failed to initialize WebSocket', error);
      }
    };

    initializeWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      stopAutoRefresh();
    };
  }, [projectId, projectName, onProjectReload, onElementsKeyIncrement, onAnalysisDashboardReload, showAnalysisDashboard, showError, startAutoRefresh, stopAutoRefresh]);

  return {
    isAnalysisRunning,
    analyzing,
    currentAnalysisStep,
    analysisProgressPercent,
    analysisLogs,
    setAnalyzing,
    setCurrentAnalysisStep,
    clearLogs,
  };
}
