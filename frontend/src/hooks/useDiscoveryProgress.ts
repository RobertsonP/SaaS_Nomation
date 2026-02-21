import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface DiscoveryProgressState {
  isRunning: boolean;
  phase: 'idle' | 'crawling' | 'sitemap' | 'filtering' | 'completed' | 'error';
  message: string;
  urlsFound: number;
  isComplete: boolean;
  hasError: boolean;
  errorMessage: string;
}

interface UseDiscoveryProgressOptions {
  projectId: string | undefined;
  onComplete?: (urlsFound: number) => void;
  onError?: (message: string) => void;
}

export function useDiscoveryProgress({ projectId, onComplete, onError }: UseDiscoveryProgressOptions) {
  const socketRef = useRef<Socket | null>(null);

  // Stable refs for callbacks to prevent re-render loops
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [state, setState] = useState<DiscoveryProgressState>({
    isRunning: false,
    phase: 'idle',
    message: '',
    urlsFound: 0,
    isComplete: false,
    hasError: false,
    errorMessage: '',
  });

  const reset = useCallback(() => {
    setState({
      isRunning: true,
      phase: 'crawling',
      message: 'Starting discovery...',
      urlsFound: 0,
      isComplete: false,
      hasError: false,
      errorMessage: '',
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;

    const socket = io('http://localhost:3002/discovery-progress', {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe-to-project', projectId);
    });

    socket.on('discovery-progress', (event: any) => {
      setState(prev => {
        const isComplete = event.phase === 'completed';
        const hasError = event.phase === 'error';

        return {
          isRunning: !isComplete && !hasError,
          phase: event.phase || prev.phase,
          message: event.friendlyMessage || event.message || prev.message,
          urlsFound: event.urlsFound ?? prev.urlsFound,
          isComplete,
          hasError,
          errorMessage: hasError ? (event.message || 'Discovery failed') : prev.errorMessage,
        };
      });
    });

    socket.on('connect_error', () => {
      // Silent — discovery still works via HTTP polling fallback
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId]);

  // Fire callbacks (using stable refs)
  useEffect(() => {
    if (state.isComplete && onCompleteRef.current) onCompleteRef.current(state.urlsFound);
  }, [state.isComplete, state.urlsFound]);

  useEffect(() => {
    if (state.hasError && onErrorRef.current) onErrorRef.current(state.errorMessage);
  }, [state.hasError, state.errorMessage]);

  return { ...state, reset };
}
