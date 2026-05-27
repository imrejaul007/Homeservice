import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useDebounce - Delays updating a value until after a specified delay
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500)
 * @returns The debounced value
 *
 * @example
 * const debouncedSearch = useDebounce(searchTerm, 300);
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchResults(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback - Returns a debounced version of the callback
 *
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 500)
 * @returns A debounced callback function
 *
 * @example
 * const debouncedSearch = useDebouncedCallback((query) => {
 *   api.search(query);
 * }, 300);
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/**
 * useDebouncedValue - Like useDebounce but with immediate option
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500)
 * @param immediate - If true, trigger on leading edge instead of trailing (default: false)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(
  value: T,
  delay: number = 500,
  immediate: boolean = false
): { value: T; debouncedValue: T; isPending: boolean } {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (immediate) {
      // Leading edge debounce
      if (!timeoutRef.current) {
        setDebouncedValue(value);
        setIsPending(true);
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setIsPending(false);
      }, delay);
    } else {
      // Trailing edge debounce (default)
      const timer = setTimeout(() => {
        setDebouncedValue(value);
        setIsPending(false);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [value, delay, immediate]);

  return { value, debouncedValue, isPending };
}

export default useDebounce;
