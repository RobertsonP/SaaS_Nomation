import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '../lib/logger';

const logger = createLogger('useAnalysisProgress');

/** Phases displayed in the stepper */
export type AnalysisPhase = 'prepare' | 'scan' | 'save' | 'done';

export interface AnalysisProgressState {
  /** Is analysis currently in progress? */
  isRunning: boolean;
  /** Current phase for the stepper */
  currentPhase: AnalysisPhase;
  /** Human-readable label for current action */
  currentPhaseLabel: string;
  /** Overall percent 0-100 */
  overallPercent: number;
  /** Which URL index is being processed (1-based) */
  currentUrlIndex: number;
  /** Total URLs to analyze */
  totalUrls: number;
  /** Total elements found so far */
  elementsFound: number;
  /** Seconds since analysis started */
  elapsedSeconds: number;
  /** True when analysis finished successfully */
  isComplete: boolean;
  /** True when analysis had an error */
  hasError: boolean;
  /** Error message if hasError */
  errorMessage: string;
  /** Raw event log (collapsed by default in UI) */
  rawEvents: AnalysisEvent[];
}

export interface AnalysisEvent {
  step: string;
  status: string;
  message: string;
  friendlyMessage?: string;
  timestamp: Date;
  progress?: { current: number; total: number; percentage: number };
  details?: any;
}

interface UseAnalysisProgressOptions {
  projectId: string | undefined;
  /** Called when analysis completes successfully */
  onComplete?: () => void;
  /** Called on error */
  onError?: (message: string) => void;
}

/** Map backend step names to user-friendly labels */
function getFriendlyLabel(event: AnalysisEvent): string {
  // Use backend-provided friendly message if available
  if (event.friendlyMessage) return event.friendlyMessage;

  const step = event.step;
  const msg = event.message || '';

  if (step === 'initialization') {
    if (msg.includes('Found')) return msg;
    return 'Preparing analysis...';
  }
  if (step === 'auth_check') {
    if (msg.includes('Found authentication')) return 'Authenticating...';
    return 'Checking authentication...';
  }
  if (step === 'authenticated_analysis' || step === 'standard_analysis') {
    // Extract URL count if present
    const urlMatch = msg.match(/URL (\d+)\/(\d+)/i) || msg.match(/(\d+) of (\d+)/i);
    if (urlMatch) return `Scanning page ${urlMatch[1]} of ${urlMatch[2]}...`;
    if (event.status === 'started') return 'Scanning page elements...';
    if (event.status === 'completed') return 'Analysis complete!';
    return 'Scanning page elements...';
  }
  if (step === 'element_extraction') {
    if (msg.includes('Found')) return msg.replace(/^Found/, 'Found');
    return 'Extracting elements...';
  }
  if (step === 'element_storage') {
    const elemMatch = msg.match(/(\d+) elements/);
    if (elemMatch) return `Saving ${elemMatch[1]} elements...`;
    return 'Saving elements...';
  }
  if (step === 'analysis_completed') return 'Analysis complete!';
  if (step === 'analysis_error') return 'Analysis failed';

  return msg || 'Processing...';
}

/** Map backend step to stepper phase */
function getPhase(step: string, status: string): AnalysisPhase {
  if (step === 'initialization' || step === 'auth_check') return 'prepare';
  if (step === 'element_storage') return 'save';
  if (step === 'analysis_completed' || (status === 'completed' &&
    (step === 'authenticated_analysis' || step === 'standard_analysis'))) return 'done';
  if (step === 'analysis_error') return 'done';
  return 'scan';
}

/** Calculate overall percent from step + progress */
function calculatePercent(step: string, status: string, progress?: { current: number; total: number; percentage: number }): number {
  // Phase ranges: prepare=0-15, scan=15-80, save=80-95, done=95-100
  if (step === 'initialization') return progress ? Math.min(progress.percentage * 0.1, 10) : 5;
  if (step === 'auth_check') return 12;
  if (step === 'element_extraction' && progress) {
    return 15 + Math.round(progress.percentage * 0.65);
  }
  if (step === 'authenticated_analysis' || step === 'standard_analysis') {
    if (status === 'started') return 15;
    if (status === 'completed') return 95;
    if (progress) return 15 + Math.round(progress.percentage * 0.65);
    return 50;
  }
  if (step === 'element_storage') return progress ? 80 + Math.round(progress.percentage * 0.15) : 85;
  if (step === 'analysis_completed') return 100;
  if (step === 'analysis_error') return 100;
  return 50;
}

export function useAnalysisProgress({ projectId, onComplete, onError }: UseAnalysisProgressOptions) {
  const socketRef = useRef<Socket | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Stable refs for callbacks to prevent re-render loops
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [state, setState] = useState<AnalysisProgressState>({
    isRunning: false,
    currentPhase: 'prepare',
    currentPhaseLabel: 'Waiting...',
    overallPercent: 0,
    currentUrlIndex: 0,
    totalUrls: 0,
    elementsFound: 0,
    elapsedSeconds: 0,
    isComplete: false,
    hasError: false,
    errorMessage: '',
    rawEvents: [],
  });

  /** Reset state for a new analysis run */
  const reset = useCallback(() => {
    startTimeRef.current = Date.now();
    setState({
      isRunning: true,
      currentPhase: 'prepare',
      currentPhaseLabel: 'Preparing analysis...',
      overallPercent: 0,
      currentUrlIndex: 0,
      totalUrls: 0,
      elementsFound: 0,
      elapsedSeconds: 0,
      isComplete: false,
      hasError: false,
      errorMessage: '',
      rawEvents: [],
    });
  }, []);

  /** Disconnect socket and clear timer */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Elapsed time timer
  useEffect(() => {
    if (!state.isRunning || state.isComplete || state.hasError) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setState(prev => ({
        ...prev,
        elapsedSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isRunning, state.isComplete, state.hasError]);

  // WebSocket connection
  useEffect(() => {
    if (!projectId) return;

    const socket = io('http://localhost:3002/analysis-progress', {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      logger.debug('Analysis progress socket connected');
      socket.emit('subscribe-to-project', projectId);
    });

    socket.on('analysis-progress', (event: AnalysisEvent) => {
      logger.debug('Progress event', event);

      setState(prev => {
        const phase = getPhase(event.step, event.status);
        const label = getFriendlyLabel(event);
        const percent = calculatePercent(event.step, event.status, event.progress);

        // Track URL index from progress data
        let urlIndex = prev.currentUrlIndex;
        let totalUrls = prev.totalUrls;
        let elementsFound = prev.elementsFound;

        if (event.progress) {
          if (event.step === 'authenticated_analysis' || event.step === 'standard_analysis') {
            urlIndex = event.progress.current;
            totalUrls = event.progress.total;
          }
        }

        // Extract element count from details
        if (event.details?.elementCount !== undefined) {
          elementsFound = prev.elementsFound + event.details.elementCount;
        }
        // Also parse from message
        const elemMatch = event.message?.match(/Found (\d+) elements/);
        if (elemMatch) {
          elementsFound = Math.max(elementsFound, parseInt(elemMatch[1], 10));
        }

        // Extract total URLs from initialization
        if (event.step === 'initialization' && event.details?.urls) {
          totalUrls = event.details.urls.length;
        }

        const isComplete = event.status === 'completed' && (
          event.step === 'authenticated_analysis' ||
          event.step === 'standard_analysis' ||
          event.step === 'analysis_completed'
        );

        const hasError = event.status === 'error';

        return {
          ...prev,
          currentPhase: isComplete ? 'done' : phase,
          currentPhaseLabel: label,
          overallPercent: isComplete ? 100 : Math.max(prev.overallPercent, percent),
          currentUrlIndex: urlIndex,
          totalUrls,
          elementsFound,
          isComplete,
          hasError,
          errorMessage: hasError ? (event.message || 'Analysis failed') : prev.errorMessage,
          rawEvents: [...prev.rawEvents, event],
        };
      });
    });

    // Legacy events (from useProjectWebSocket pattern)
    socket.on('analysis-started', () => {
      setState(prev => ({ ...prev, isRunning: true }));
    });

    socket.on('analysis-completed', () => {
      setState(prev => ({
        ...prev,
        isComplete: true,
        currentPhase: 'done' as AnalysisPhase,
        currentPhaseLabel: 'Analysis complete!',
        overallPercent: 100,
      }));
    });

    socket.on('analysis-error', (data: any) => {
      setState(prev => ({
        ...prev,
        hasError: true,
        errorMessage: data?.message || 'Analysis failed',
        currentPhaseLabel: 'Analysis failed',
      }));
    });

    socket.on('connect_error', (error) => {
      logger.warn('Analysis WebSocket connection failed', error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId]);

  // Fire callbacks on completion/error (using stable refs)
  useEffect(() => {
    if (state.isComplete && onCompleteRef.current) onCompleteRef.current();
  }, [state.isComplete]);

  useEffect(() => {
    if (state.hasError && onErrorRef.current) onErrorRef.current(state.errorMessage);
  }, [state.hasError, state.errorMessage]);

  return {
    ...state,
    reset,
    disconnect,
  };
}
