import { toast } from 'react-hot-toast';
import { AxiosError } from 'axios';

export interface ApiErrorResponse {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
  code?: string;
}

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (!navigator.onLine) return true;

  const axiosError = error as AxiosError;
  // Network errors typically have no response or status 0
  return !axiosError.response || axiosError.response.status === 0;
};

/**
 * Parse error and return user-friendly message
 */
export const parseErrorMessage = (error: unknown, fallbackMessage = 'An error occurred'): string => {
  const axiosError = error as ApiErrorResponse;

  // Network errors
  if (isNetworkError(error)) {
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
      return message || 'Resource not found.';
    case 409:
      return message || 'Conflict. The resource may have been modified.';
    case 422:
      return message || 'Validation error. Please check your input.';
    case 429:
      return 'Too many requests. Please wait before trying again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again.';
    default:
      return message || fallbackMessage;
  }
};

/**
 * Show error toast with parsed message
 */
export const showErrorToast = (error: unknown, fallbackMessage = 'An error occurred'): void => {
  const message = parseErrorMessage(error, fallbackMessage);
  toast.error(message);
};

/**
 * Show success toast with optional description
 */
export const showSuccessToast = (message: string, description?: string): void => {
  if (description) {
    toast.success(message, { description });
  } else {
    toast.success(message);
  }
};

/**
 * Show warning toast
 */
export const showWarningToast = (message: string, description?: string): void => {
  if (description) {
    toast(message, {
      icon: '⚠️',
      description,
      style: {
        background: '#FEF3C7',
        color: '#92400E',
      }
    });
  } else {
    toast(message, {
      icon: '⚠️',
      style: {
        background: '#FEF3C7',
        color: '#92400E',
      }
    });
  }
};

/**
 * Handle API error with optimistic rollback
 */
export async function withOptimisticRollback<T>(
  previousValue: T,
  setValue: (value: T) => void,
  optimisticUpdate: () => void,
  apiCall: () => Promise<unknown>,
  options: {
    errorMessage?: string;
    onSuccess?: () => void;
  } = {}
): Promise<boolean> {
  const { errorMessage = 'Action failed', onSuccess } = options;

  // Apply optimistic update
  optimisticUpdate();

  try {
    await apiCall();
    onSuccess?.();
    return true;
  } catch (error) {
    // Rollback on failure
    setValue(previousValue);
    showErrorToast(error, errorMessage);
    return false;
  }
}

/**
 * Retry wrapper for transient failures
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    retryableStatuses?: number[];
  } = {}
): Promise<T> {
  const { maxRetries = 2, retryDelay = 1000, retryableStatuses = [0, 500, 502, 503, 504, 429] } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      // Check if error is retryable
      const isRetryable = !status || retryableStatuses.includes(status);

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }

  throw lastError;
}
