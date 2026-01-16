import { useState, useCallback, useRef } from 'react';
import { createLogger } from '../lib/logger';

const logger = createLogger('useAsyncOperation');

interface AsyncOperationState<T, E = Error> {
  /**
   * The result data from the operation
   */
  data: T | null;

  /**
   * Whether the operation is currently running
   */
  isLoading: boolean;

  /**
   * Any error that occurred
   */
  error: E | null;

  /**
   * Whether the operation has been executed at least once
   */
  hasExecuted: boolean;
}

interface UseAsyncOperationOptions<T, E = Error> {
  /**
   * Callback on successful execution
   */
  onSuccess?: (data: T) => void;

  /**
   * Callback on error
   */
  onError?: (error: E) => void;

  /**
   * Callback when operation starts
   */
  onStart?: () => void;

  /**
   * Callback when operation finishes (success or error)
   */
  onFinish?: () => void;
}

interface UseAsyncOperationReturn<T, TArgs extends unknown[], E = Error>
  extends AsyncOperationState<T, E> {
  /**
   * Execute the async operation
   */
  execute: (...args: TArgs) => Promise<T | null>;

  /**
   * Reset the state to initial values
   */
  reset: () => void;
}

/**
 * Custom hook for managing async operations with loading and error states
 *
 * @example
 * ```tsx
 * const { execute, isLoading, error, data } = useAsyncOperation(
 *   async (projectId: string) => {
 *     return await api.projects.delete(projectId);
 *   },
 *   {
 *     onSuccess: () => toast.success('Project deleted'),
 *     onError: (err) => toast.error(err.message),
 *   }
 * );
 *
 * // Later:
 * <button onClick={() => execute(projectId)} disabled={isLoading}>
 *   {isLoading ? 'Deleting...' : 'Delete'}
 * </button>
 * ```
 */
export function useAsyncOperation<T, TArgs extends unknown[] = [], E = Error>(
  asyncFn: (...args: TArgs) => Promise<T>,
  options: UseAsyncOperationOptions<T, E> = {}
): UseAsyncOperationReturn<T, TArgs, E> {
  const { onSuccess, onError, onStart, onFinish } = options;

  const [state, setState] = useState<AsyncOperationState<T, E>>({
    data: null,
    isLoading: false,
    error: null,
    hasExecuted: false,
  });

  const mountedRef = useRef(true);

  const execute = useCallback(
    async (...args: TArgs): Promise<T | null> => {
      if (!mountedRef.current) return null;

      logger.debug('Starting async operation');
      onStart?.();

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const result = await asyncFn(...args);

        if (!mountedRef.current) return null;

        logger.debug('Async operation successful');
        setState({
          data: result,
          isLoading: false,
          error: null,
          hasExecuted: true,
        });

        onSuccess?.(result);
        onFinish?.();
        return result;
      } catch (err) {
        if (!mountedRef.current) return null;

        const error = err as E;
        logger.error('Async operation failed', error);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
          hasExecuted: true,
        }));

        onError?.(error);
        onFinish?.();
        return null;
      }
    },
    [asyncFn, onSuccess, onError, onStart, onFinish]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
      hasExecuted: false,
    });
  }, []);

  // Track mounted state
  useState(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  });

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Simpler hook for form submissions
 *
 * @example
 * ```tsx
 * const { submit, isSubmitting, error } = useFormSubmit(
 *   async (formData: FormData) => {
 *     return await api.projects.create(formData);
 *   }
 * );
 *
 * <form onSubmit={(e) => { e.preventDefault(); submit(formData); }}>
 *   ...
 * </form>
 * ```
 */
export function useFormSubmit<T, TFormData = unknown>(
  submitFn: (data: TFormData) => Promise<T>,
  options: UseAsyncOperationOptions<T> = {}
) {
  const { execute, isLoading, error, data, reset } = useAsyncOperation<
    T,
    [TFormData]
  >(submitFn, options);

  return {
    submit: execute,
    isSubmitting: isLoading,
    error,
    result: data,
    reset,
  };
}
