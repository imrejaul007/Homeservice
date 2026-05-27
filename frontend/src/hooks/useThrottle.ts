import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * useThrottle - Rate-limits a value update to at most once per interval
 *
 * @param value - The value to throttle
 * @param interval - Minimum interval between updates in milliseconds (default: 500)
 * @returns The throttled value
 *
 * @example
 * const throttledScroll = useThrottle(scrollPosition, 100);
 * useEffect(() => {
 *   analytics.trackScroll(throttledScroll);
 * }, [throttledScroll]);
 */
export function useThrottle<T>(value: T, interval: number = 500): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();

    if (now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timerId = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(timerId);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * useThrottledCallback - Returns a throttled version of the callback
 *
 * @param callback - The function to throttle
 * @param interval - Minimum interval between invocations in milliseconds (default: 500)
 * @returns A throttled callback function
 *
 * @example
 * const handleScroll = useThrottledCallback(() => {
 *   console.log('Scrolled:', window.scrollY);
 * }, 100);
 *
 * window.addEventListener('scroll', handleScroll);
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  interval: number = 500
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);
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
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= interval) {
        // Enough time has passed, call immediately
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else {
        // Store args and schedule a call
        pendingArgsRef.current = args;

        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            lastCallRef.current = Date.now();
            if (pendingArgsRef.current) {
              callbackRef.current(...pendingArgsRef.current);
              pendingArgsRef.current = null;
            }
            timeoutRef.current = null;
          }, interval - timeSinceLastCall);
        }
      }
    },
    [interval]
  );
}

/**
 * useThrottledState - State that updates at most once per interval
 *
 * @param initialValue - Initial state value
 * @param interval - Minimum interval between updates in milliseconds (default: 500)
 * @returns [state, setState, throttledState]
 *
 * @example
 * const [position, setPosition, throttledPosition] = useThrottledState(0, 100);
 * setPosition(newPosition); // Updates immediately
 * // throttledPosition updates at most 10 times per second
 */
export function useThrottledState<T>(
  initialValue: T,
  interval: number = 500
): [T, (value: T) => void, T] {
  const [state, setState] = useState<T>(initialValue);
  const [throttledState, setThrottledState] = useState<T>(initialValue);
  const lastUpdateRef = useRef<number>(Date.now());
  const pendingUpdateRef = useRef<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setThrottledStateValue = useCallback(
    (value: T) => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;

      if (timeSinceLastUpdate >= interval) {
        // Enough time has passed, update immediately
        lastUpdateRef.current = now;
        setState(value);
        setThrottledState(value);
      } else {
        // Schedule update
        setState(value);
        pendingUpdateRef.current = value;

        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            lastUpdateRef.current = Date.now();
            if (pendingUpdateRef.current !== null) {
              setThrottledState(pendingUpdateRef.current);
              pendingUpdateRef.current = null;
            }
            timeoutRef.current = null;
          }, interval - timeSinceLastUpdate);
        }
      }
    },
    [interval]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setThrottledStateValue, throttledState];
}

/**
 * useRAFThrottle - Throttle using requestAnimationFrame for smooth animations
 *
 * @param callback - The function to throttle
 * @returns A RAF-throttled callback function
 *
 * @example
 * const handleMouseMove = useRAFThrottle((e) => {
 *   setMousePosition({ x: e.clientX, y: e.clientY });
 * });
 */
export function useRAFThrottle<T extends (...args: any[]) => any>(
  callback: T
): (...args: Parameters<T>) => void {
  const frameRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      argsRef.current = args;

      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => {
          if (argsRef.current) {
            callbackRef.current(...argsRef.current);
          }
          frameRef.current = null;
        });
      }
    },
    []
  );
}

export default useThrottle;
