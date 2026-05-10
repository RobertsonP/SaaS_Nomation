import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '../lib/logger';

const logger = createLogger('SuiteExecutionContext');

export interface SuiteExecutionState {
  suiteId: string;
  suiteName: string;
  executionId: string;
  startedAt: number;
  status: 'running' | 'passed' | 'failed';
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  currentTestName?: string;
  errorMessage?: string;
}

interface SuiteExecutionContextType {
  /** Currently running / recently finished suite execution, or null. */
  active: SuiteExecutionState | null;
  /** Whether the user has minimized the active modal. */
  isMinimized: boolean;
  /** Begin tracking — connects WebSocket, subscribes to suite progress. */
  startTracking: (params: {
    suiteId: string;
    suiteName: string;
    executionId: string;
    testsTotal: number;
  }) => void;
  /** User clicked "minimize" on a suite results modal. */
  minimize: () => void;
  /** User clicked the floating indicator to maximize / restore. */
  restore: () => void;
  /** User dismissed the indicator after completion. */
  clear: () => void;
}

const SuiteExecutionContext = createContext<SuiteExecutionContextType | undefined>(undefined);

export function SuiteExecutionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<SuiteExecutionState | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const startTracking = useCallback(
    ({ suiteId, suiteName, executionId, testsTotal }: { suiteId: string; suiteName: string; executionId: string; testsTotal: number }) => {
      // Replace any previous tracking
      disconnectSocket();
      setActive({
        suiteId,
        suiteName,
        executionId,
        startedAt: Date.now(),
        status: 'running',
        testsTotal,
        testsPassed: 0,
        testsFailed: 0,
      });
      setIsMinimized(false);

      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3002';
      const wsBase = apiBase.replace(/\/api\/?$/, '');
      const socket = io(`${wsBase}/execution-progress`, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('subscribe-to-suite', suiteId);
      });

      socket.on('execution-progress', (event: any) => {
        if (event?.type !== 'suite' && event?.type !== 'test') return;
        if (event?.type === 'suite') {
          setActive((prev) => {
            if (!prev) return prev;
            const details = event.details || {};
            const next: SuiteExecutionState = {
              ...prev,
              testsPassed: details.passed ?? prev.testsPassed,
              testsFailed: details.failed ?? prev.testsFailed,
              testsTotal: details.total ?? prev.testsTotal,
              currentTestName: details.currentTestName ?? prev.currentTestName,
            };
            if (event.status === 'completed') {
              next.status = (details.failed ?? 0) > 0 ? 'failed' : 'passed';
            } else if (event.status === 'failed' || event.status === 'error') {
              next.status = 'failed';
              next.errorMessage = details.error || 'Suite execution failed';
            }
            return next;
          });
        } else if (event?.type === 'test' && event?.status === 'completed') {
          // Per-test completed inside a suite — bump the counter
          setActive((prev) => {
            if (!prev) return prev;
            const passedDelta = event.details?.success === false ? 0 : 1;
            const failedDelta = event.details?.success === false ? 1 : 0;
            return {
              ...prev,
              testsPassed: prev.testsPassed + passedDelta,
              testsFailed: prev.testsFailed + failedDelta,
              currentTestName: event.details?.testName ?? prev.currentTestName,
            };
          });
        }
      });

      socket.on('disconnect', () => {
        logger.debug('Suite execution socket disconnected');
      });
    },
    [disconnectSocket],
  );

  const minimize = useCallback(() => setIsMinimized(true), []);
  const restore = useCallback(() => setIsMinimized(false), []);
  const clear = useCallback(() => {
    disconnectSocket();
    setActive(null);
    setIsMinimized(false);
  }, [disconnectSocket]);

  useEffect(() => () => disconnectSocket(), [disconnectSocket]);

  return (
    <SuiteExecutionContext.Provider
      value={{ active, isMinimized, startTracking, minimize, restore, clear }}
    >
      {children}
    </SuiteExecutionContext.Provider>
  );
}

export function useSuiteExecutionContext() {
  const ctx = useContext(SuiteExecutionContext);
  if (!ctx) {
    throw new Error('useSuiteExecutionContext must be used inside SuiteExecutionProvider');
  }
  return ctx;
}
