/**
 * Centralized error handling for API services
 * Provides consistent error handling across all API services
 */

/**
 * Standard error class for API service errors
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public fieldErrors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ServiceError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Check if the error is a network error (no response)
   */
  isNetworkError(): boolean {
    return this.statusCode === undefined;
  }

  /**
   * Check if the error is an authentication error
   */
  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if the error is a permission error
   */
  isPermissionError(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Check if the error is a not found error
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Check if the error is a validation error
   */
  isValidationError(): boolean {
    return this.statusCode === 400 || this.fieldErrors !== undefined;
  }

  /**
   * Convert to plain object for logging/debugging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      fieldErrors: this.fieldErrors,
      stack: this.stack,
    };
  }
}

/**
 * Type for API error response structure
 */
interface ApiErrorResponse {
  success?: boolean;
  message?: string;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Type for axios error structure
 */
interface AxiosErrorLike {
  response?: {
    status?: number;
    data?: ApiErrorResponse;
  };
  message?: string;
  code?: string;
}

/**
 * Extract error information from various error types
 */
function extractErrorInfo(error: unknown): { message: string; statusCode?: number; code?: string; fieldErrors?: Array<{ field: string; message: string }> } {
  // Handle axios error format
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosErrorLike;
    const responseData = axiosError.response?.data;

    if (responseData) {
      return {
        message: responseData.message || responseData.error || 'An error occurred',
        statusCode: axiosError.response?.status,
        code: responseData.error,
        fieldErrors: responseData.errors,
      };
    }
  }

  // Handle standard Error
  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error || 'An unexpected error occurred',
    };
  }

  // Handle unknown errors
  return {
    message: 'An unexpected error occurred',
  };
}

/**
 * Standard error handler for API operations
 * Use this in try/catch blocks to convert errors to ServiceError
 *
 * @param error - The caught error
 * @param operation - Description of the operation for the error message
 * @returns Never returns - always throws ServiceError
 *
 * @example
 * try {
 *   const response = await api.get('/users');
 *   return response.data;
 * } catch (error) {
 *   throw handleApiError(error, 'fetch user list');
 * }
 */
export function handleApiError(error: unknown, operation: string): never {
  const { message, statusCode, code, fieldErrors } = extractErrorInfo(error);

  // Format the message with the operation
  const formattedMessage = message.includes(operation)
    ? message
    : `Failed to ${operation}: ${message}`;

  throw new ServiceError(
    formattedMessage,
    statusCode,
    code,
    fieldErrors
  );
}

/**
 * Safe error handler that returns a fallback value instead of throwing
 * Use this when you want to handle errors gracefully without try/catch
 *
 * @param error - The caught error
 * @param fallback - Fallback value to return
 * @param operation - Description of the operation for logging
 * @returns The fallback value
 *
 * @example
 * const users = await safeApiCall(fetchUsers, [], 'fetch users');
 */
export function safeApiCall<T>(error: unknown, fallback: T, operation: string): T {
  const { message } = extractErrorInfo(error);
  console.error(`[API Error] Failed to ${operation}:`, message);
  return fallback;
}

/**
 * Check if an error is a specific type of ServiceError
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

/**
 * Get user-friendly error message
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (isServiceError(error)) {
    if (error.isNetworkError()) {
      return 'Network connection error. Please check your internet connection.';
    }
    if (error.isAuthError()) {
      return 'Your session has expired. Please log in again.';
    }
    if (error.isPermissionError()) {
      return "You don't have permission to perform this action.";
    }
    if (error.isNotFoundError()) {
      return 'The requested resource was not found.';
    }
    if (error.isValidationError()) {
      if (error.fieldErrors && error.fieldErrors.length > 0) {
        return error.fieldErrors.map(e => e.message).join(', ');
      }
      return 'Please check your input and try again.';
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Format field errors for form display
 * Returns an object mapping field names to error messages
 */
export function formatFieldErrors(error: unknown): Record<string, string> {
  if (isServiceError(error) && error.fieldErrors) {
    return error.fieldErrors.reduce((acc, { field, message }) => {
      if (field) {
        acc[field] = message;
      }
      return acc;
    }, {} as Record<string, string>);
  }
  return {};
}
