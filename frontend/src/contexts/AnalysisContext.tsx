import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '../lib/logger';

const logger = createLogger('AnalysisContext');

export type AnalysisPhase = 'prepare' | 'scan' | 'save' | 'done';

export interface AnalysisEvent {
  step: string;
  status: string;
  message: string;
  friendlyMessage?: string;
  timestamp: Date;
  progress?: { current: number; total: number; percentage: number };
  details?: any;
}

export interface AnalysisProgressState {
  isRunning: boolean;
  currentPhase: AnalysisPhase;
  currentPhaseLabel: string;
  overallPercent: number;
  currentUrlIndex: number;
  totalUrls: number;
  elementsFound: number;
  elapsedSeconds: number;
  isComplete: boolean;
  hasError: boolean;
  errorMessage: string;
  rawEvents: AnalysisEvent[];
}

const INITIAL_STATE: AnalysisProgressState = {
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
};

interface AnalysisContextType {
  /** ProjectId currently being analyzed (null when no analysis is active or has been dismissed). */
  activeProjectId: string | null;
  /** Display name of the project being analyzed (for the floating indicator). */
  projectName: string;
  /** Whether the user has minimized the analysis modal — drives floating indicator visibility. */
  isMinimized: boolean;
  /** Live progress state from the analysis-progress WebSocket. */
  progress: AnalysisProgressState;
  /** Begin tracking analysis for a project. Resets progress, opens the WebSocket, exits minimized state. */
  startAnalysis: (projectId: string, projectName: string) => void;
  /** User minimized the modal — keep socket alive, surface the floating indicator. */
  minimizeAnalysis: () => void;
  /** User restored the modal from the floating indicator. */
  restoreAnalysis: () => void;
  /** User dismissed the indicator — clear all state and disconnect socket. */
  clearAnalysis: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

function getFriendlyLabel(event: AnalysisEvent): string {
  if (event.friendlyMessage) return event.friendlyMessage;
  const step = event.step;
  const msg = event.message || '';
  if (step === 'initialization') return msg.includes('Found') ? msg : 'Preparing analysis...';
  if (step === 'auth_check') return msg.includes('Found authentication') ? 'Authenticating...' : 'Checking authentication...';
  if (step === 'authenticated_analysis' || step === 'standard_analysis') {
    const urlMatch = msg.match(/URL (\d+)\/(\d+)/i) || msg.match(/(\d+) of (\d+)/i);
    if (urlMatch) return `Scanning page ${urlMatch[1]} of ${urlMatch[2]}...`;
    if (event.status === 'started') return 'Scanning page elements...';
    if (event.status === 'completed') return 'Analysis complete!';
    return 'Scanning page elements...';
  }
  if (step === 'element_extraction') return msg.includes('Found') ? msg : 'Extracting elements...';
  if (step === 'element_storage') {
    const elemMatch = msg.match(/(\d+) elements/);
    return elemMatch ? `Saving ${elemMatch[1]} elements...` : 'Saving elements...';
  }
  if (step === 'analysis_completed') return 'Analysis complete!';
  if (step === 'analysis_error') return 'Analysis failed';
  return msg || 'Processing...';
}

function getPhase(step: string, status: string): AnalysisPhase {
  if (step === 'initialization' || step === 'auth_check') return 'prepare';
  if (step === 'element_storage') return 'save';
  if (step === 'analysis_completed' || (status === 'completed' &&
    (step === 'authenticated_analysis' || step === 'standard_analysis'))) return 'done';
  if (step === 'analysis_error') return 'done';
  return 'scan';
}

function calculatePercent(step: string, status: string, progress?: { current: number; total: number; percentage: number }): number {
  if (step === 'initialization') return progress ? Math.min(progress.percentage * 0.1, 10) : 5;
  if (step === 'auth_check') return 12;
  if (step === 'element_extraction' && progress) return 15 + Math.round(progress.percentage * 0.65);
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

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgressState>(INITIAL_STATE);

  const socketRef = useRef<Socket | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const startAnalysis = useCallback((projectId: string, name: string) => {
    // Reset everything for the new run.
    disconnect();
    startTimeRef.current = Date.now();
    setActiveProjectId(projectId);
    setProjectName(name);
    setIsMinimized(false);
    setProgress({ ...INITIAL_STATE, isRunning: true, currentPhaseLabel: 'Preparing analysis...' });

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3002';
    const wsBase = apiBase.replace(/\/api\/?$/, '');
    const socket = io(`${wsBase}/analysis-progress`, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      logger.debug('Analysis progress socket connected');
      socket.emit('subscribe-to-project', projectId);
    });

    socket.on('analysis-progress', (event: AnalysisEvent) => {
      setProgress(prev => {
        const phase = getPhase(event.step, event.status);
        const label = getFriendlyLabel(event);
        const percent = calculatePercent(event.step, event.status, event.progress);

        let urlIndex = prev.currentUrlIndex;
        let totalUrls = prev.totalUrls;
        let elementsFound = prev.elementsFound;

        if (event.progress && (event.step === 'authenticated_analysis' || event.step === 'standard_analysis')) {
          urlIndex = event.progress.current;
          totalUrls = event.progress.total;
        }
        if (event.details?.elementCount !== undefined) {
          elementsFound = prev.elementsFound + event.details.elementCount;
        }
        const elemMatch = event.message?.match(/Found (\d+) elements/);
        if (elemMatch) {
          elementsFound = Math.max(elementsFound, parseInt(elemMatch[1], 10));
        }
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
          isRunning: !(isComplete || hasError),
          isComplete,
          hasError,
          errorMessage: hasError ? (event.message || 'Analysis failed') : prev.errorMessage,
          rawEvents: [...prev.rawEvents, event],
        };
      });
    });

    socket.on('analysis-completed', () => {
      setProgress(prev => ({
        ...prev,
        isRunning: false,
        isComplete: true,
        currentPhase: 'done',
        currentPhaseLabel: 'Analysis complete!',
        overallPercent: 100,
      }));
    });

    socket.on('analysis-error', (data: any) => {
      setProgress(prev => ({
        ...prev,
        isRunning: false,
        hasError: true,
        errorMessage: data?.message || 'Analysis failed',
        currentPhaseLabel: 'Analysis failed',
      }));
    });

    socket.on('connect_error', (error: any) => {
      logger.warn('Analysis WebSocket connection failed', error?.message);
    });
  }, [disconnect]);

  // Elapsed-time timer: ticks while progress.isRunning is true.
  useEffect(() => {
    if (!progress.isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        elapsedSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [progress.isRunning]);

  // Disconnect socket on unmount only.
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  const minimizeAnalysis = useCallback(() => setIsMinimized(true), []);
  const restoreAnalysis = useCallback(() => setIsMinimized(false), []);
  const clearAnalysis = useCallback(() => {
    disconnect();
    setActiveProjectId(null);
    setProjectName('');
    setIsMinimized(false);
    setProgress(INITIAL_STATE);
  }, [disconnect]);

  return (
    <AnalysisContext.Provider
      value={{
        activeProjectId,
        projectName,
        isMinimized,
        progress,
        startAnalysis,
        minimizeAnalysis,
        restoreAnalysis,
        clearAnalysis,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisContext() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysisContext must be used within an AnalysisProvider');
  return ctx;
}
