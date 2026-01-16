import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { createLogger } from '../lib/logger';

const logger = createLogger('useWebSocket');

interface UseWebSocketOptions<TEvent = unknown> {
  /**
   * WebSocket namespace/path to connect to
   */
  namespace: string;

  /**
   * Whether the connection should be active
   */
  enabled?: boolean;

  /**
   * Event name to subscribe to after connection
   */
  subscribeEvent?: string;

  /**
   * Data to send with the subscribe event
   */
  subscribeData?: unknown;

  /**
   * Event name to listen for progress/updates
   */
  progressEvent?: string;

  /**
   * Callback when connected
   */
  onConnect?: () => void;

  /**
   * Callback when disconnected
   */
  onDisconnect?: () => void;

  /**
   * Callback when receiving progress events
   */
  onProgress?: (event: TEvent) => void;

  /**
   * Callback on connection error
   */
  onError?: (error: Error) => void;
}

interface UseWebSocketReturn {
  /**
   * The Socket.IO socket instance
   */
  socket: Socket | null;

  /**
   * Whether the socket is connected
   */
  isConnected: boolean;

  /**
   * Manually disconnect the socket
   */
  disconnect: () => void;

  /**
   * Manually reconnect the socket
   */
  reconnect: () => void;

  /**
   * Emit an event to the server
   */
  emit: (event: string, data?: unknown) => void;
}

/**
 * Custom hook for Socket.IO WebSocket connections
 *
 * @example
 * ```tsx
 * const { isConnected, emit } = useWebSocket({
 *   namespace: '/execution-progress',
 *   enabled: isOpen && !!executionId,
 *   subscribeEvent: 'subscribe-to-execution',
 *   subscribeData: executionId,
 *   progressEvent: 'execution-progress',
 *   onProgress: (event) => {
 *     console.log('Progress:', event);
 *   },
 * });
 * ```
 */
export function useWebSocket<TEvent = unknown>({
  namespace,
  enabled = true,
  subscribeEvent,
  subscribeData,
  progressEvent,
  onConnect,
  onDisconnect,
  onProgress,
  onError,
}: UseWebSocketOptions<TEvent>): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Create and manage socket connection
  useEffect(() => {
    if (!enabled) {
      // Disconnect if disabled
      if (socketRef.current) {
        logger.debug('Disconnecting socket (disabled)');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    logger.debug(`Connecting to WebSocket: ${API_URL}${namespace}`);

    const newSocket = io(`${API_URL}${namespace}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;

    // Connection events
    newSocket.on('connect', () => {
      logger.debug('WebSocket connected');
      setIsConnected(true);
      onConnect?.();

      // Auto-subscribe if configured
      if (subscribeEvent && subscribeData !== undefined) {
        logger.debug(`Auto-subscribing: ${subscribeEvent}`, subscribeData);
        newSocket.emit(subscribeEvent, subscribeData);
      }
    });

    newSocket.on('disconnect', () => {
      logger.warn('WebSocket disconnected');
      setIsConnected(false);
      onDisconnect?.();
    });

    newSocket.on('connect_error', (error) => {
      logger.error('WebSocket connection error', error);
      onError?.(error);
    });

    // Subscription confirmation
    newSocket.on('subscription-confirmed', (data) => {
      logger.debug('Subscription confirmed', data);
    });

    // Progress events
    if (progressEvent && onProgress) {
      newSocket.on(progressEvent, (event: TEvent) => {
        logger.debug(`Received ${progressEvent}`, event);
        onProgress(event);
      });
    }

    setSocket(newSocket);

    // Cleanup
    return () => {
      logger.debug('Cleaning up WebSocket connection');
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [
    namespace,
    enabled,
    subscribeEvent,
    subscribeData,
    progressEvent,
    onConnect,
    onDisconnect,
    onProgress,
    onError,
  ]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setIsConnected(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data);
    } else {
      logger.warn(`Cannot emit ${event}: socket not connected`);
    }
  }, []);

  return {
    socket,
    isConnected,
    disconnect,
    reconnect,
    emit,
  };
}
