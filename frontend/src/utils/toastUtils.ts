/**
 * Toast Utilities
 *
 * Provides deduplication and rate-limiting for toast notifications
 * to prevent chaotic stacking when multiple errors fire rapidly.
 */

import toast from 'react-hot-toast';

// Default cooldown period in milliseconds (5 seconds)
const DEFAULT_COOLDOWN = 5000;

// Track last toast time per key
const lastToastTime: Record<string, number> = {};

/**
 * Show a toast with deduplication based on a key.
 * If the same key has been used within the cooldown period, the toast is suppressed.
 *
 * @param key - Unique identifier for deduplication
 * @param callback - Function that returns the toast options/call
 * @param cooldown - Cooldown period in milliseconds (default: 5000)
 *
 * @example
 * // These two calls within 5 seconds will only show one toast
 * showDeduplicatedToast('network-error', () => toast.error('Connection lost'));
 * showDeduplicatedToast('network-error', () => toast.error('Connection lost'));
 */
export function showDeduplicatedToast(
  key: string,
  callback: () => void,
  cooldown: number = DEFAULT_COOLDOWN
): void {
  const now = Date.now();
  const lastTime = lastToastTime[key] || 0;

  if (now - lastTime >= cooldown) {
    lastToastTime[key] = now;
    callback();
  }
}

/**
 * Show a deduplicated error toast.
 *
 * @param title - Error title
 * @param description - Optional error description
 * @param key - Optional key for deduplication (defaults to title)
 * @param cooldown - Cooldown period in milliseconds
 */
export function showDeduplicatedError(
  title: string,
  description?: string,
  key?: string,
  cooldown: number = DEFAULT_COOLDOWN
): void {
  const toastKey = key || `error:${title}`;

  showDeduplicatedToast(toastKey, () => {
    if (description) {
      toast.error(title, { description });
    } else {
      toast.error(title);
    }
  }, cooldown);
}

/**
 * Show a deduplicated success toast.
 *
 * @param title - Success message
 * @param description - Optional description
 * @param key - Optional key for deduplication (defaults to title)
 * @param cooldown - Cooldown period in milliseconds
 */
export function showDeduplicatedSuccess(
  title: string,
  description?: string,
  key?: string,
  cooldown: number = DEFAULT_COOLDOWN
): void {
  const toastKey = key || `success:${title}`;

  showDeduplicatedToast(toastKey, () => {
    if (description) {
      toast.success(title, { description });
    } else {
      toast.success(title);
    }
  }, cooldown);
}

/**
 * Show a deduplicated warning toast.
 *
 * @param title - Warning message
 * @param description - Optional description
 * @param key - Optional key for deduplication (defaults to title)
 * @param cooldown - Cooldown period in milliseconds
 */
export function showDeduplicatedWarning(
  title: string,
  description?: string,
  key?: string,
  cooldown: number = DEFAULT_COOLDOWN
): void {
  const toastKey = key || `warning:${title}`;

  showDeduplicatedToast(toastKey, () => {
    toast(title, {
      icon: '⚠️',
      duration: 4000,
    });
  }, cooldown);
}

/**
 * Clear the deduplication history for a specific key.
 * Useful when you want to allow the same toast again after a specific action.
 *
 * @param key - The key to clear
 */
export function clearToastCooldown(key: string): void {
  delete lastToastTime[key];
}

/**
 * Clear all deduplication history.
 * Use with caution - this will reset all cooldowns.
 */
export function clearAllToastCooldowns(): void {
  Object.keys(lastToastTime).forEach((key) => {
    delete lastToastTime[key];
  });
}

/**
 * Network error handler with automatic toast deduplication.
 * Detects network errors and shows appropriate messaging.
 *
 * @param error - The error object
 * @param options - Configuration options
 * @returns boolean - true if this was a network error, false otherwise
 */
export function handleNetworkError(
  error: unknown,
  options: {
    onNetworkError?: string;
    onServerError?: string;
    onAuthError?: string;
    onNotFound?: string;
  } = {}
): boolean {
  const {
    onNetworkError = 'Connection error',
    onServerError = 'Server error',
    onAuthError = 'Session expired',
    onNotFound = 'Not found',
  } = options;

  // Detect network errors
  const isNetworkError =
    !navigator.onLine ||
    error instanceof TypeError ||
    (error as { message?: string })?.message?.includes('NetworkError') ||
    (error as { message?: string })?.message?.includes('Failed to fetch') ||
    (error as { status?: number })?.status === 0;

  if (isNetworkError) {
    showDeduplicatedError(onNetworkError, 'Please check your internet connection and try again', 'network-error');
    return true;
  }

  // Handle HTTP status codes
  const status = (error as { response?: { status?: number } })?.response?.status;

  switch (status) {
    case 401:
      showDeduplicatedError(onAuthError, 'Please log in again', 'auth-error');
      return true;
    case 403:
      showDeduplicatedError('Access denied', 'You do not have permission', 'access-denied');
      return true;
    case 404:
      showDeduplicatedError(onNotFound, undefined, 'not-found');
      return true;
    case 429:
      showDeduplicatedError('Too many requests', 'Please wait before trying again', 'rate-limit');
      return true;
    case 500:
    case 502:
    case 503:
      showDeduplicatedError(onServerError, 'Please try again later', 'server-error');
      return true;
    default:
      return false;
  }
}

/**
 * API error handler that extracts error messages and shows deduplicated toasts.
 *
 * @param error - The error from API call
 * @param defaultMessage - Default message if error parsing fails
 */
export function handleApiError(error: unknown, defaultMessage: string = 'An error occurred'): void {
  // First check for network/server errors
  if (handleNetworkError(error)) {
    return;
  }

  // Try to extract message from API error
  const apiMessage =
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    (error as { message?: string })?.message;

  showDeduplicatedError(
    apiMessage || defaultMessage,
    undefined,
    `api-error:${apiMessage || defaultMessage}`
  );
}
