import { useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '../lib/logger';

const logger = createLogger('usePolling');

interface UsePollingOptions<T> {
  /**
   * Async function that fetches the data
   */
  fetchFn: () => Promise<T>;

  /**
   * Polling interval in milliseconds (default: 1000ms)
   */
  interval?: number;

  /**
   * Whether polling is enabled (default: true)
   */
  enabled?: boolean;

  /**
   * Callback when data is successfully fetched
   */
  onSuccess?: (data: T) => void;

  /**
   * Callback when fetch fails
   */
  onError?: (error: Error) => void;

  /**
   * Condition to stop polling (return true to stop)
   */
  stopCondition?: (data: T) => boolean;

  /**
   * Whether to fetch immediately on mount (default: true)
   */
  fetchOnMount?: boolean;

  /**
   * Maximum number of retries on error (default: 3)
   */
  maxRetries?: number;
}

interface UsePollingReturn<T> {
  /**
   * The latest fetched data
   */
  data: T | null;

  /**
   * Whether a fetch is currently in progress
   */
  isLoading: boolean;

  /**
   * The last error that occurred
   */
  error: Error | null;

  /**
   * Whether polling is currently active
   */
  isPolling: boolean;

  /**
   * Manually trigger a fetch
   */
  refetch: () => Promise<void>;

  /**
   * Start polling
   */
  startPolling: () => void;

  /**
   * Stop polling
   */
  stopPolling: () => void;
}

/**
 * Custom hook for polling data at regular intervals
 *
 * @example
 * ```tsx
 * const { data, isLoading, isPolling } = usePolling({
 *   fetchFn: () => api.getExecutionStatus(executionId),
 *   interval: 1000,
 *   enabled: isModalOpen,
 *   stopCondition: (data) => data.status !== 'running',
 *   onSuccess: (data) => setStatus(data),
 * });
 * ```
 */
export function usePolling<T>({
  fetchFn,
  interval = 1000,
  enabled = true,
  onSuccess,
  onError,
  stopCondition,
  fetchOnMount = true,
  maxRetries = 3,
}: UsePollingOptions<T>): UsePollingReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(enabled);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  const clearPollingInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetch = useCallback(async () => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn();

      if (!mountedRef.current) return;

      setData(result);
      retryCountRef.current = 0;
      onSuccess?.(result);

      // Check stop condition
      if (stopCondition && stopCondition(result)) {
        logger.debug('Stop condition met, stopping polling');
        clearPollingInterval();
        setIsPolling(false);
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);

      retryCountRef.current++;
      if (retryCountRef.current >= maxRetries) {
        logger.warn(`Max retries (${maxRetries}) reached, stopping polling`);
        clearPollingInterval();
        setIsPolling(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFn, onSuccess, onError, stopCondition, maxRetries, clearPollingInterval]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling

    logger.debug(`Starting polling with ${interval}ms interval`);
    setIsPolling(true);
    retryCountRef.current = 0;

    intervalRef.current = setInterval(fetch, interval);
  }, [fetch, interval]);

  const stopPolling = useCallback(() => {
    logger.debug('Stopping polling');
    clearPollingInterval();
    setIsPolling(false);
  }, [clearPollingInterval]);

  const refetch = useCallback(async () => {
    await fetch();
  }, [fetch]);

  // Start/stop polling based on enabled prop
  useEffect(() => {
    if (enabled) {
      if (fetchOnMount) {
        fetch();
      }
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      clearPollingInterval();
    };
  }, [enabled, fetchOnMount]); // Intentionally not including all deps to avoid restart

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPollingInterval();
    };
  }, [clearPollingInterval]);

  return {
    data,
    isLoading,
    error,
    isPolling,
    refetch,
    startPolling,
    stopPolling,
  };
}
