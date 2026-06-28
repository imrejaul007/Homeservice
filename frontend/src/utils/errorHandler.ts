/**
 * Error Handler Utility
 *
 * Provides centralized error handling for API calls with user-friendly
 * toast notifications based on error type and HTTP status codes.
 */

import { toast } from 'react-hot-toast';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ErrorContext {
  title?: string;
  fallbackMessage?: string;
}

interface AxiosError {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
      errors?: Array<{ field?: string; message?: string }>;
    };
  };
  message?: string;
  code?: string;
}

// =============================================================================
// Toast Cooldown System (Prevents duplicate error toasts)
// =============================================================================

const lastToastTime: Record<string, number> = {};
const TOAST_COOLDOWN_MS = 3000; // 3 second cooldown between same errors

const shouldShowToast = (key: string): boolean => {
  const now = Date.now();
  const lastTime = lastToastTime[key] || 0;

  if (now - lastTime < TOAST_COOLDOWN_MS) {
    return false;
  }

  lastToastTime[key] = now;
  return true;
};

// =============================================================================
// Error Detection Utilities
// =============================================================================

/**
 * Check if error is a network connectivity issue
 */
const isNetworkError = (error: unknown): boolean => {
  if (!navigator.onLine) return true;

  const axiosError = error as AxiosError;

  // TypeError often indicates network issues
  if (error instanceof TypeError) {
    return true;
  }

  // Network-specific error codes
  const code = axiosError?.code;
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'NETWORK_ERROR') {
    return true;
  }

  // CORS or fetch errors
  const message = axiosError?.message || '';
  if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
    return true;
  }

  return false;
};

/**
 * Extract error message from various error formats
 */
const extractErrorMessage = (error: unknown): string => {
  const axiosError = error as AxiosError;

  // Try response-level message first
  if (axiosError?.response?.data?.message) {
    return axiosError.response.data.message;
  }

  // Try response-level error field
  if (axiosError?.response?.data?.error) {
    return axiosError.response.data.error;
  }

  // Try top-level message
  if (axiosError?.message) {
    return axiosError.message;
  }

  return 'An unexpected error occurred';
};

/**
 * Extract field validation errors
 */
const extractFieldErrors = (error: unknown): Array<{ field: string; message: string }> => {
  const axiosError = error as AxiosError;
  const fieldErrors = axiosError?.response?.data?.errors;

  if (Array.isArray(fieldErrors)) {
    return fieldErrors.map(e => ({
      field: e.field || 'unknown',
      message: e.message || 'Validation error',
    }));
  }

  return [];
};

// =============================================================================
// Main Error Handler
// =============================================================================

/**
 * Handle API errors with appropriate toast notifications
 *
 * @param error - The error object from an API call
 * @param context - Optional context for the error (title, fallback message)
 *
 * @example
 * ```typescript
 * // In an API call catch block:
 * .catch(err => handleApiError(err, 'Create booking'));
 *
 * // With custom message:
 * .catch(err => handleApiError(err, { title: 'Payment', fallbackMessage: 'Payment failed' }));
 * ```
 */
export const handleApiError = (error: unknown, context?: string | ErrorContext): void => {
  const contextStr = typeof context === 'string' ? context : context?.title;
  const fallbackMessage = typeof context === 'object' ? context?.fallbackMessage : undefined;

  const axiosError = error as AxiosError;
  const status = axiosError?.response?.status;

  // Network errors (no response or specific network conditions)
  if (isNetworkError(error)) {
    if (shouldShowToast('network')) {
      toast.error(
        'Connection error',
        `${contextStr || 'Request'} failed. Please check your internet connection.`,
        { id: 'network-error' }
      );
    }
    return;
  }

  // Handle based on HTTP status code
  switch (status) {
    case 400:
      if (shouldShowToast('400')) {
        const fieldErrors = extractFieldErrors(error);
        if (fieldErrors.length > 0) {
          // Show first field error with context
          toast.error(
            'Invalid request',
            fieldErrors[0].message,
            { id: `400-${fieldErrors[0].field}` }
          );
        } else {
          toast.error(
            'Invalid request',
            extractErrorMessage(error),
            { id: '400-error' }
          );
        }
      }
      break;

    case 401:
      if (shouldShowToast('401')) {
        toast.error(
          'Session expired',
          'Please log in again to continue.',
          { id: '401-error', duration: 5000 }
        );
        // Could trigger auth store logout here
      }
      break;

    case 403:
      if (shouldShowToast('403')) {
        toast.error(
          'Access denied',
          extractErrorMessage(error) || 'You do not have permission for this action.',
          { id: '403-error' }
        );
      }
      break;

    case 404:
      if (shouldShowToast('404')) {
        toast.error(
          'Not found',
          `${contextStr || 'Resource'} not found.`,
          { id: '404-error' }
        );
      }
      break;

    case 409:
      if (shouldShowToast('409')) {
        toast.error(
          'Conflict',
          extractErrorMessage(error) || 'This action conflicts with existing data.',
          { id: '409-error' }
        );
      }
      break;

    case 422:
      if (shouldShowToast('422')) {
        const fieldErrors = extractFieldErrors(error);
        if (fieldErrors.length > 0) {
          toast.error(
            'Validation error',
            fieldErrors.map(e => `${e.field}: ${e.message}`).join(', '),
            { id: '422-error' }
          );
        } else {
          toast.error(
            'Validation error',
            extractErrorMessage(error),
            { id: '422-error' }
          );
        }
      }
      break;

    case 429:
      if (shouldShowToast('429')) {
        toast.error(
          'Too many requests',
          'Please wait a moment before trying again.',
          { id: '429-error', duration: 4000 }
        );
      }
      break;

    case 500:
      if (shouldShowToast('500')) {
        toast.error(
          'Server error',
          'Something went wrong on our end. Please try again later.',
          { id: '500-error' }
        );
      }
      break;

    case 502:
    case 503:
    case 504:
      if (shouldShowToast(`gateway-${status}`)) {
        toast.error(
          'Service unavailable',
          'The server is temporarily unavailable. Please try again.',
          { id: `gateway-${status}-error`, duration: 5000 }
        );
      }
      break;

    default:
      // Unknown error or non-HTTP error
      if (shouldShowToast('unknown')) {
        const message = extractErrorMessage(error);
        toast.error(
          'Error',
          fallbackMessage || message,
          { id: 'unknown-error' }
        );
      }
  }
};

/**
 * Handle errors silently (no toast) - for batch operations
 */
export const handleApiErrorSilent = (error: unknown): string => {
  const axiosError = error as AxiosError;
  const status = axiosError?.response?.status;

  if (isNetworkError(error)) {
    return 'Connection error';
  }

  switch (status) {
    case 400: return 'Invalid request';
    case 401: return 'Session expired';
    case 403: return 'Access denied';
    case 404: return 'Not found';
    case 409: return 'Conflict';
    case 422: return 'Validation error';
    case 429: return 'Rate limited';
    case 500: return 'Server error';
    case 502:
    case 503:
    case 504:
      return 'Service unavailable';
    default:
      return axiosError?.message || 'An error occurred';
  }
};

/**
 * Async wrapper that handles errors automatically with toasts
 *
 * @example
 * ```typescript
 * const handleSubmit = async () => {
 *   await withErrorToast(
 *     api.post('/bookings', data),
 *     'Creating booking...',
 *     'Booking created!',
 *     'Create booking'
 *   );
 * };
 * ```
 */
export const withErrorToast = async <T>(
  promise: Promise<T>,
  loadingMessage?: string,
  successMessage?: string,
  errorContext?: string
): Promise<T | null> => {
  const loadingId = loadingMessage ? toast.loading(loadingMessage) : null;

  try {
    const result = await promise;

    if (loadingId) toast.dismiss(loadingId);
    if (successMessage) toast.success(successMessage);

    return result;
  } catch (error) {
    if (loadingId) toast.dismiss(loadingId);
    handleApiError(error, errorContext);
    return null;
  }
};

/**
 * Create a toast for offline mode
 */
export const showOfflineToast = (): void => {
  if (shouldShowToast('offline')) {
    toast.error(
      'You are offline',
      'Some features may be unavailable until you reconnect.',
      { id: 'offline-toast', duration: 4000 }
    );
  }
};

/**
 * Create a toast for back online
 */
export const showBackOnlineToast = (): void => {
  toast.success('Back online', 'Connection restored.', {
    id: 'back-online-toast',
    duration: 3000,
  });
};

export default {
  handleApiError,
  handleApiErrorSilent,
  withErrorToast,
  showOfflineToast,
  showBackOnlineToast,
};
