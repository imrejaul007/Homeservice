import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { AxiosError } from 'axios';

export interface OptimisticActionOptions<T> {
  /** Initial value for the state */
  initialValue: T;
  /** API call to execute */
  apiCall: (value: T) => Promise<unknown>;
  /** Success message to show on toast */
  successMessage?: string;
  /** Error message prefix */
  errorPrefix?: string;
  /** Enable retry on failure */
  enableRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Toast cooldown in ms to prevent duplicate toasts */
  toastCooldown?: number;
}

export interface OptimisticState<T> {
  value: T;
  isLoading: boolean;
  error: string | null;
  execute: (newValue: T) => Promise<boolean>;
  rollback: () => void;
  reset: () => void;
}

interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
}

/**
 * Hook for managing optimistic UI updates with automatic rollback on failure
 */
export function useOptimisticAction<T>({
  initialValue,
  apiCall,
  successMessage,
  errorPrefix = 'Action failed',
  enableRetry = false,
  maxRetries = 2,
  toastCooldown = 3000,
}: OptimisticActionOptions<T>): OptimisticState<T> {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousValueRef = useRef<T>(initialValue);
  const lastToastTimeRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);

  const parseError = useCallback((err: unknown): string => {
    const axiosError = err as ApiError;

    // Network errors
    if (!navigator.onLine || axiosError.response?.status === 0) {
      return 'Connection error. Please check your internet connection.';
    }

    const status = axiosError.response?.status;
    const message = axiosError.response?.data?.message || axiosError.message;

    switch (status) {
      case 400:
        return message || 'Invalid request. Please check your input.';
      case 401:
        return 'Session expired. Please log in again.';
      case 403:
        return 'Access denied. You do not have permission.';
      case 404:
        return 'Resource not found.';
      case 422:
        return message || 'Validation error.';
      case 429:
        return 'Too many requests. Please wait before trying again.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable.';
      default:
        return message || `${errorPrefix}. Please try again.`;
    }
  }, [errorPrefix]);

  const showErrorToast = useCallback((errorMessage: string) => {
    const now = Date.now();
    if (now - lastToastTimeRef.current < toastCooldown) {
      return;
    }
    lastToastTimeRef.current = now;
    toast.error(errorMessage);
  }, [toastCooldown]);

  const showSuccessToast = useCallback(() => {
    if (!successMessage) return;
    const now = Date.now();
    if (now - lastToastTimeRef.current < toastCooldown) {
      return;
    }
    lastToastTimeRef.current = now;
    toast.success(successMessage);
  }, [successMessage, toastCooldown]);

  const execute = useCallback(async (newValue: T): Promise<boolean> => {
    const previousValue = value;
    previousValueRef.current = previousValue;

    // Optimistic update
    setValue(newValue);
    setIsLoading(true);
    setError(null);

    // Calculate retry delay: 1s, 2s, 4s (exponential backoff)
    const getRetryDelay = (attempt: number) => Math.pow(2, attempt) * 1000;

    const attemptApiCall = async (attempt: number): Promise<boolean> => {
      try {
        await apiCall(newValue);
        showSuccessToast();
        retryCountRef.current = 0;
        return true;
      } catch (err) {
        const axiosError = err as ApiError;
        const status = axiosError.response?.status;
        const isRetryable = !status || status >= 500 || status === 429;

        // Check if we should retry
        if (enableRetry && isRetryable && attempt < maxRetries) {
          retryCountRef.current = attempt + 1;
          await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)));
          return attemptApiCall(attempt + 1);
        }

        // All retries exhausted or non-retryable error - rollback
        setValue(previousValueRef.current);
        const errorMessage = parseError(err);
        setError(errorMessage);
        showErrorToast(errorMessage);
        return false;
      }
    };

    try {
      const success = await attemptApiCall(0);
      return success;
    } finally {
      setIsLoading(false);
    }
  }, [value, apiCall, enableRetry, maxRetries, parseError, showErrorToast, showSuccessToast]);

  const rollback = useCallback(() => {
    setValue(previousValueRef.current);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setValue(initialValue);
    setIsLoading(false);
    setError(null);
  }, [initialValue]);

  return {
    value,
    isLoading,
    error,
    execute,
    rollback,
    reset,
  };
}

/**
 * Hook for optimistic list operations (add, remove, update items)
 */
export function useOptimisticList<T extends { id: string }>({
  apiCall,
  optimisticUpdate,
  successMessage,
  errorPrefix = 'Operation failed',
}: {
  apiCall: (item: T) => Promise<unknown>;
  optimisticUpdate: (items: T[], item: T) => T[];
  successMessage?: string;
  errorPrefix?: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousItemsRef = useRef<T[]>([]);

  const parseError = useCallback((err: unknown): string => {
    const axiosError = err as ApiError;
    if (!navigator.onLine || axiosError.response?.status === 0) {
      return 'Connection error. Please check your internet connection.';
    }
    const message = axiosError.response?.data?.message || axiosError.message;
    return message || `${errorPrefix}. Please try again.`;
  }, [errorPrefix]);

  const execute = useCallback(async (item: T): Promise<boolean> => {
    const previousItems = [...items];
    previousItemsRef.current = previousItems;

    // Optimistic update
    const newItems = optimisticUpdate(items, item);
    setItems(newItems);
    setIsLoading(true);
    setError(null);

    try {
      await apiCall(item);
      if (successMessage) {
        toast.success(successMessage);
      }
      return true;
    } catch (err) {
      // Rollback
      setItems(previousItemsRef.current);
      const errorMessage = parseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [items, optimisticUpdate, apiCall, successMessage, parseError]);

  const setList = useCallback((newItems: T[]) => {
    setItems(newItems);
  }, []);

  return {
    items,
    setItems: setList,
    execute,
    isLoading,
    error,
  };
}

/**
 * Hook for optimistic toggle operations (favorite, read status, etc.)
 */
export function useOptimisticToggle({
  initialValue,
  apiCall,
  successMessage,
  errorPrefix = 'Update failed',
}: {
  initialValue: boolean;
  apiCall: () => Promise<unknown>;
  successMessage?: string;
  errorPrefix?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousValueRef = useRef(initialValue);

  const parseError = useCallback((err: unknown): string => {
    const axiosError = err as ApiError;
    if (!navigator.onLine || axiosError.response?.status === 0) {
      return 'Connection error. Please check your internet connection.';
    }
    const message = axiosError.response?.data?.message || axiosError.message;
    return message || `${errorPrefix}. Please try again.`;
  }, [errorPrefix]);

  const toggle = useCallback(async (): Promise<boolean> => {
    const newValue = !value;
    previousValueRef.current = value;

    // Optimistic update
    setValue(newValue);
    setIsLoading(true);
    setError(null);

    try {
      await apiCall();
      if (successMessage) {
        toast.success(successMessage);
      }
      return true;
    } catch (err) {
      // Rollback
      setValue(previousValueRef.current);
      const errorMessage = parseError(err);
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [value, apiCall, successMessage, parseError]);

  return {
    value,
    isLoading,
    error,
    toggle,
    setValue,
  };
}
