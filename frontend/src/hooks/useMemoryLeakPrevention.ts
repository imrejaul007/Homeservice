import { useEffect, useRef, useCallback } from 'react';

/**
 * Memory Leak Prevention Hooks
 *
 * Provides utilities to prevent memory leaks in React components by:
 * - Tracking mounted state
 * - Cleaning up async operations
 * - Canceling requests on unmount
 */

// =============================================================================
// Types
// =============================================================================

interface CancellablePromise<T> {
  promise: Promise<T>;
  cancel: () => void;
}

interface CleanupRef<T> {
  current: T | null;
}

// =============================================================================
// useIsMounted - Track if component is still mounted
// =============================================================================

/**
 * Hook to track if a component is still mounted.
 * Prevents state updates after unmount.
 *
 * @returns Object with isMounted boolean and setMounted function
 *
 * @example
 * const { isMounted } = useIsMounted();
 *
 * useEffect(() => {
 *   fetchData().then(data => {
 *     if (isMounted()) {
 *       setData(data);
 *     }
 *   });
 * }, []);
 */
export function useIsMounted() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Component mounted
    isMountedRef.current = true;

    return () => {
      // Component will unmount
      isMountedRef.current = false;
    };
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  return { isMounted, isMountedRef };
}

// =============================================================================
// useCancellable - Cancel async operations on unmount
// =============================================================================

/**
 * Creates a promise that can be cancelled.
 * Sets up automatic cleanup on unmount.
 *
 * @param promiseFactory - Function that creates the promise
 * @returns Object with promise and cancel function
 *
 * @example
 * const { promise, cancel } = useCancellable(() => fetchData());
 */
export function useCancellable<T>(
  promiseFactory: () => Promise<T>
): CancellablePromise<T> {
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const promise = new Promise<T>((resolve, reject) => {
    promiseFactory()
      .then((result) => {
        if (!cancelledRef.current) {
          resolve(result);
        }
      })
      .catch((error) => {
        if (!cancelledRef.current) {
          reject(error);
        }
      });
  });

  return { promise, cancel };
}

// =============================================================================
// useAbortController - Abort fetch requests on unmount
// =============================================================================

/**
 * Creates an AbortController that is aborted on unmount.
 * Use with fetch API for automatic request cancellation.
 *
 * @returns AbortController instance
 *
 * @example
 * const { signal } = useAbortController();
 *
 * useEffect(() => {
 *   fetch(url, { signal })
 *     .then(setData)
 *     .catch(err => {
 *       if (err.name !== 'AbortError') throw err;
 *     });
 * }, [signal]);
 */
export function useAbortController(): { signal: AbortSignal } {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return { signal: abortControllerRef.current?.signal! };
}

// =============================================================================
// useAsync - Handle async operations with proper cleanup
// =============================================================================

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface AsyncActions {
  execute: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook to handle async operations with:
 * - Loading state
 * - Error handling
 * - Automatic cleanup on unmount
 *
 * @param asyncFunction - The async function to execute
 * @param deps - Dependencies array (like useEffect)
 * @returns Object with state and actions
 *
 * @example
 * const { data, loading, error, execute } = useAsync(
 *   () => fetchData(),
 *   [id]
 * );
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  deps: React.DependencyList = []
): AsyncState<T> & AsyncActions {
  const { isMountedRef } = useIsMounted();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const execute = useCallback(async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await asyncFunction();
      if (isMountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      if (isMountedRef.current) {
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { ...state, execute, reset };
}

// Need to import useState
import { useState } from 'react';

// =============================================================================
// useTimeout - Proper cleanup of setTimeout
// =============================================================================

/**
 * Hook to manage setTimeout with automatic cleanup.
 *
 * @returns Object with set, clear, and reset functions
 *
 * @example
 * const { set, clear } = useTimeout();
 *
 * // Set a timeout
 * set(() => doSomething(), 1000);
 *
 * // Cleanup automatically on unmount
 */
export function useTimeout() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const set = useCallback(
    (callback: () => void, delay: number) => {
      clear();
      timeoutRef.current = setTimeout(() => {
        callback();
        timeoutRef.current = null;
      }, delay);
    },
    [clear]
  );

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { set, clear, reset };
}

// =============================================================================
// useInterval - Proper cleanup of setInterval
// =============================================================================

/**
 * Hook to manage setInterval with automatic cleanup.
 *
 * @returns Object with set, clear, and reset functions
 *
 * @example
 * const { set, clear } = useInterval();
 *
 * // Set an interval
 * set(() => doSomething(), 1000);
 *
 * // Must call clear to stop (not automatic!)
 */
export function useInterval() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const set = useCallback(
    (callback: () => void, delay: number) => {
      clear();
      intervalRef.current = setInterval(callback, delay);
    },
    [clear]
  );

  const reset = useCallback(() => {
    clear();
  }, [clear]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { set, clear, reset };
}

// =============================================================================
// useDebouncedCallback - Debounce with cleanup
// =============================================================================

/**
 * Hook to create a debounced callback that is properly cleaned up.
 *
 * @param callback - Function to debounce
 * @param delay - Debounce delay in ms
 * @returns Debounced callback function
 *
 * @example
 * const debouncedSearch = useDebouncedCallback(
 *   (query) => searchAPI(query),
 *   300
 * );
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// =============================================================================
// useRAFCallback - requestAnimationFrame with cleanup
// =============================================================================

/**
 * Hook to create a callback using requestAnimationFrame.
 * Automatically cancels on unmount.
 *
 * @param callback - Function to call in animation frame
 * @returns Object with call and cancel functions
 *
 * @example
 * const { call, cancel } = useRAFCallback((deltaTime) => {
 *   updateAnimation(deltaTime);
 * });
 */
export function useRAFCallback(callback: (deltaTime: number) => void) {
  const rafRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    previousTimeRef.current = null;
  }, []);

  const call = useCallback(() => {
    cancel();

    const tick = (currentTime: number) => {
      const deltaTime = previousTimeRef.current !== null
        ? currentTime - previousTimeRef.current
        : 0;
      previousTimeRef.current = currentTime;
      callbackRef.current(deltaTime);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [cancel]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { call, cancel };
}

// =============================================================================
// useSubscriptions - Manage multiple subscriptions with cleanup
// =============================================================================

type UnsubscribeFn = () => void;

/**
 * Hook to manage multiple subscriptions with automatic cleanup.
 *
 * @returns Object with subscribe and unsubscribeAll functions
 *
 * @example
 * const { subscribe, unsubscribeAll } = useSubscriptions();
 *
 * useEffect(() => {
 *   const unsub1 = eventBus.subscribe('event1', handler1);
 *   const unsub2 = eventBus.subscribe('event2', handler2);
 *
 *   subscribe(unsub1);
 *   subscribe(unsub2);
 * }, []);
 *
 * // All subscriptions cleaned up automatically on unmount
 */
export function useSubscriptions() {
  const subscriptionsRef = useRef<UnsubscribeFn[]>([]);

  const subscribe = useCallback((unsubscribe: UnsubscribeFn) => {
    subscriptionsRef.current.push(unsubscribe);
  }, []);

  const unsubscribeAll = useCallback(() => {
    subscriptionsRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        console.error('Error unsubscribing:', e);
      }
    });
    subscriptionsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      unsubscribeAll();
    };
  }, [unsubscribeAll]);

  return { subscribe, unsubscribeAll };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  useIsMounted,
  useCancellable,
  useAbortController,
  useAsync,
  useTimeout,
  useInterval,
  useDebouncedCallback,
  useRAFCallback,
  useSubscriptions,
};
