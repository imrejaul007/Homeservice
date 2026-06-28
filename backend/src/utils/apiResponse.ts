/**
 * Standardized API Response Utilities
 * Provides consistent response format across all API endpoints
 */

import { Response } from 'express';
import { ERROR_CODES } from './ApiError';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  message?: string;
  errors?: Array<{
    field?: string;
    message: string;
    type?: string;
    value?: unknown;
  }>;
  details?: Record<string, unknown>;
  timestamp?: string;
  retryAfter?: number;
}

export interface PaginatedResponse<T> {
  success: true;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
      nextPage: number | null;
      prevPage: number | null;
    };
  };
  timestamp?: string;
}

// ============================================
// SUCCESS RESPONSE HELPERS
// ============================================

/**
 * Send a success response
 */
export const apiSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response<SuccessResponse<T>> => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send a created response (201)
 */
export const apiCreated = <T>(
  res: Response,
  data: T,
  message?: string
): Response<SuccessResponse<T>> => {
  return apiSuccess(res, data, message, 201);
};

/**
 * Send an updated response (200)
 */
export const apiUpdated = <T>(
  res: Response,
  data: T,
  message: string = 'Updated successfully'
): Response<SuccessResponse<T>> => {
  return apiSuccess(res, data, message, 200);
};

/**
 * Send a deleted response (200)
 */
export const apiDeleted = <T>(
  res: Response,
  data: T,
  message: string = 'Deleted successfully'
): Response<SuccessResponse<T>> => {
  return apiSuccess(res, data, message, 200);
};

// ============================================
// PAGINATED RESPONSE HELPERS
// ============================================

/**
 * Send a paginated success response
 */
export const apiPaginated = <T>(
  res: Response,
  items: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  }
): Response<PaginatedResponse<T>> => {
  const { page, limit, total } = pagination;
  const pages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
        nextPage: page < pages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    },
    timestamp: new Date().toISOString(),
  });
};

// ============================================
// ERROR RESPONSE HELPERS
// ============================================

/**
 * Send a generic error response
 */
export const apiError = (
  res: Response,
  statusCode: number,
  error: string,
  message?: string,
  options?: {
    code?: string;
    errors?: ErrorResponse['errors'];
    details?: Record<string, unknown>;
    retryAfter?: number;
  }
): Response<ErrorResponse> => {
  return res.status(statusCode).json({
    success: false,
    error,
    code: options?.code || ERROR_CODES.INTERNAL_ERROR,
    ...(message && { message }),
    ...(options?.errors && { errors: options.errors }),
    ...(options?.details && { details: options.details }),
    ...(options?.retryAfter && { retryAfter: options.retryAfter }),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send a bad request error response (400)
 */
export const apiBadRequest = (
  res: Response,
  message: string,
  errors?: ErrorResponse['errors'],
  details?: Record<string, unknown>
): Response<ErrorResponse> => {
  return apiError(res, 400, 'Bad Request', message, {
    code: ERROR_CODES.INVALID_INPUT,
    errors,
    details,
  });
};

/**
 * Send a validation error response (400)
 */
export const apiValidationError = (
  res: Response,
  message: string,
  errors: Array<{ field?: string; message: string }>
): Response<ErrorResponse> => {
  return apiError(res, 400, 'Validation Error', message, {
    code: ERROR_CODES.VALIDATION_ERROR,
    errors,
  });
};

/**
 * Send an unauthorized error response (401)
 */
export const apiUnauthorized = (
  res: Response,
  message: string = 'Authentication required'
): Response<ErrorResponse> => {
  return apiError(res, 401, 'Unauthorized', message, {
    code: ERROR_CODES.UNAUTHORIZED,
  });
};

/**
 * Send a forbidden error response (403)
 */
export const apiForbidden = (
  res: Response,
  message: string = 'Access denied'
): Response<ErrorResponse> => {
  return apiError(res, 403, 'Forbidden', message, {
    code: ERROR_CODES.FORBIDDEN,
  });
};

/**
 * Send a not found error response (404)
 */
export const apiNotFound = (
  res: Response,
  resource: string = 'Resource'
): Response<ErrorResponse> => {
  return apiError(res, 404, 'Not Found', `${resource} not found`, {
    code: ERROR_CODES.NOT_FOUND,
  });
};

/**
 * Send a conflict error response (409)
 */
export const apiConflict = (
  res: Response,
  message: string,
  details?: Record<string, unknown>
): Response<ErrorResponse> => {
  return apiError(res, 409, 'Conflict', message, {
    code: ERROR_CODES.CONFLICT,
    details,
  });
};

/**
 * Send a rate limit error response (429)
 */
export const apiRateLimit = (
  res: Response,
  message: string = 'Too many requests, please try again later',
  retryAfter: number = 60
): Response<ErrorResponse> => {
  return apiError(res, 429, 'Too Many Requests', message, {
    code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    retryAfter,
  });
};

/**
 * Send an internal server error response (500)
 */
export const apiServerError = (
  res: Response,
  message: string = 'Internal server error',
  details?: Record<string, unknown>
): Response<ErrorResponse> => {
  return apiError(res, 500, 'Internal Server Error', message, {
    code: ERROR_CODES.INTERNAL_ERROR,
    details,
  });
};

// ============================================
// EXPORT ALL HELPERS
// ============================================

const apiResponse = {
  // Success helpers
  success: apiSuccess,
  created: apiCreated,
  updated: apiUpdated,
  deleted: apiDeleted,
  paginated: apiPaginated,

  // Error helpers
  error: apiError,
  badRequest: apiBadRequest,
  validationError: apiValidationError,
  unauthorized: apiUnauthorized,
  forbidden: apiForbidden,
  notFound: apiNotFound,
  conflict: apiConflict,
  rateLimit: apiRateLimit,
  serverError: apiServerError,
};

export default apiResponse;
