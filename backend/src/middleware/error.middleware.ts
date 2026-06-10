/**
 * Enhanced Error Handler Middleware
 * Provides comprehensive error handling with proper classification,
 * logging, sanitization, and consistent API responses
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { APP_CONSTANTS } from '../config/constants';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { captureException } from '../config/sentry';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface StandardErrorResponse {
  success: false;
  message: string;
  code: string;
  correlationId?: string;
  errors?: ErrorDetail[];
  details?: Record<string, unknown>;
  timestamp: string;
  retryAfter?: number;
  stack?: string;
}

export interface ErrorDetail {
  field?: string;
  message: string;
  type?: string;
  value?: unknown;
}

/**
 * Extended Error interface that includes common custom error properties
 * Used to safely access error properties without type casting
 */
interface ExtendedError extends Error {
  code?: string | number;
  errors?: Record<string, { path?: string; message?: string; kind?: string; value?: unknown }>;
  keyValue?: Record<string, unknown>;
  statusCode?: number;
  field?: string;
  path?: string;
  kind?: string;
}

/**
 * Extended Request type with custom properties
 */
type AuthenticatedRequest = Request & {
  user?: { id?: string | number };
  correlationId?: string;
};

/**
 * Type guard to check if an error has a specific code
 */
const hasErrorCode = (err: Error, code: string | number): boolean => {
  return (err as ExtendedError).code === code;
};

/**
 * Type guard to check if error has keyValue property (MongoDB duplicate key)
 */
const hasKeyValue = (err: Error): err is Error & { keyValue: Record<string, unknown> } => {
  return 'keyValue' in err && typeof (err as ExtendedError).keyValue === 'object';
};

/**
 * Type guard to check if error has validation errors (Mongoose ValidationError)
 */
const hasValidationErrors = (err: Error): err is Error & { errors: Record<string, { path?: string; message?: string; kind?: string; value?: unknown }> } => {
  return 'errors' in err && typeof (err as ExtendedError).errors === 'object';
};

/**
 * Safely get error code as string
 */
const getErrorCode = (err: Error): string | undefined => {
  const code = (err as ExtendedError).code;
  return typeof code === 'string' ? code : undefined;
};

// ============================================
// ERROR CLASSIFICATION
// ============================================

type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'server_error'
  | 'external_service'
  | 'unknown';

/**
 * Classify error into a category for proper handling
 */
const classifyError = (err: Error, statusCode: number): ErrorCategory => {
  const errorCode = getErrorCode(err);

  // Validation errors (400)
  if (err.name === 'ValidationError' || statusCode === 400) {
    return 'validation';
  }

  // Authentication errors (401)
  if (err.name === 'JsonWebTokenError' ||
      err.name === 'TokenExpiredError' ||
      statusCode === 401 ||
      errorCode === ERROR_CODES.TOKEN_INVALID ||
      errorCode === ERROR_CODES.TOKEN_EXPIRED) {
    return 'authentication';
  }

  // Authorization errors (403)
  if (statusCode === 403 ||
      errorCode === ERROR_CODES.FORBIDDEN ||
      errorCode === ERROR_CODES.ACCESS_DENIED) {
    return 'authorization';
  }

  // Not found errors (404)
  if (statusCode === 404 ||
      errorCode === ERROR_CODES.NOT_FOUND ||
      errorCode === ERROR_CODES.USER_NOT_FOUND ||
      errorCode === ERROR_CODES.RESOURCE_NOT_FOUND) {
    return 'not_found';
  }

  // Conflict errors (409)
  if (statusCode === 409 ||
      errorCode === ERROR_CODES.DUPLICATE_ENTRY ||
      errorCode === ERROR_CODES.CONFLICT) {
    return 'conflict';
  }

  // Rate limit errors (429)
  if (statusCode === 429 ||
      errorCode === ERROR_CODES.RATE_LIMIT_EXCEEDED ||
      errorCode === ERROR_CODES.TOO_MANY_REQUESTS) {
    return 'rate_limit';
  }

  // External service errors
  if (err.message?.includes('ECONNREFUSED') ||
      err.message?.includes('ETIMEDOUT') ||
      err.message?.includes('ENOTFOUND') ||
      errorCode === ERROR_CODES.EXTERNAL_SERVICE_ERROR) {
    return 'external_service';
  }

  // Server errors (500+)
  if (statusCode >= 500) {
    return 'server_error';
  }

  return 'unknown';
};

// ============================================
// ERROR EXTRACTION
// ============================================

interface MongooseErrorInfo {
  code: string;
  statusCode: number;
  message: string;
  errors: ErrorDetail[];
  details: Record<string, unknown>;
}

/**
 * Extract detailed information from Mongoose errors
 */
const getMongooseErrorInfo = (err: Error): MongooseErrorInfo => {
  const extendedErr = err as ExtendedError;
  const errorCode = getErrorCode(err);

  // CastError - invalid ObjectId format
  if (err.name === 'CastError') {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      statusCode: 400,
      message: `Invalid ${extendedErr.path}: value format is incorrect`,
      errors: [{ field: extendedErr.path, message: 'Invalid format', type: 'cast_error' }],
      details: { path: extendedErr.path, valueType: extendedErr.kind }
    };
  }

  // Duplicate key error (11000)
  if (hasErrorCode(err, 11000)) {
    const keyValue = hasKeyValue(err) ? err.keyValue : {};
    const field = Object.keys(keyValue)[0] || 'field';
    return {
      code: ERROR_CODES.DUPLICATE_ENTRY,
      statusCode: 409,
      message: `A record with this ${field} already exists`,
      errors: [{ field, message: 'Value already exists', type: 'duplicate' }],
      details: { field, isDuplicate: true }
    };
  }

  // ValidationError - schema validation failed
  if (err.name === 'ValidationError') {
    const validationErrors = hasValidationErrors(err) ? err.errors : {};
    const errors = Object.values(validationErrors).map((e) => ({
      field: e?.path || 'unknown',
      message: e?.message || 'Validation failed',
      type: e?.kind || 'unknown',
      value: e?.value
    }));
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: 400,
      message: `Validation failed: ${errors.length} error(s)`,
      errors,
      details: { validationErrors: errors.length, fields: errors.map(e => e.field) }
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return {
      code: ERROR_CODES.TOKEN_INVALID,
      statusCode: 401,
      message: 'Authentication token is invalid. Please log in again.',
      errors: [],
      details: {}
    };
  }

  if (err.name === 'TokenExpiredError') {
    return {
      code: ERROR_CODES.TOKEN_EXPIRED,
      statusCode: 401,
      message: 'Your session has expired. Please log in again.',
      errors: [],
      details: {}
    };
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    return {
      code: ERROR_CODES.FILE_UPLOAD_ERROR,
      statusCode: 400,
      message: getMulterErrorMessage(extendedErr.code as string || ''),
      errors: [],
      details: { code: extendedErr.code, field: extendedErr.field }
    };
  }

  // Default to internal error
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    statusCode: 500,
    message: APP_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR,
    errors: [],
    details: {}
  };
};

/**
 * Get human-readable Multer error messages
 */
const getMulterErrorMessage = (code: string): string => {
  const messages: Record<string, string> = {
    'LIMIT_FILE_SIZE': 'File size exceeds the maximum allowed limit',
    'LIMIT_FILE_COUNT': 'Too many files uploaded',
    'LIMIT_UNEXPECTED_FILE': 'Unexpected file field in upload',
    'LIMIT_PART_COUNT': 'Too many parts in multipart form',
    'LIMIT_FIELD_KEY': 'Field name too long',
    'LIMIT_FIELD_VALUE': 'Field value too long',
    'LIMIT_FIELD_COUNT': 'Too many fields',
    'LIMIT_BODY': 'Request body too large'
  };
  return messages[code] || 'File upload failed';
};

// ============================================
// HEADER SANITIZATION FOR SENTRY
// ============================================

/**
 * Headers that are safe to include in Sentry events
 * Excludes: authorization tokens, cookies, API keys, and other credentials
 */
const SAFE_HEADERS = new Set([
  'user-agent',
  'content-type',
  'content-length',
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'x-correlation-id',
  'x-request-id',
  'x-forwarded-for',
  'x-real-ip',
  'x-forwarded-proto',
  'x-b3-traceid',
  'x-b3-spanid',
  'x-b3-parentspanid',
  'b3',
  'x-trace-token',
]);

/**
 * Filter request headers to only include safe, non-sensitive headers
 * Prevents credentials, tokens, and cookies from being sent to Sentry
 */
const filterSafeHeaders = (req: Request): Record<string, string> => {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.headers)) {
    if (SAFE_HEADERS.has(key.toLowerCase()) && typeof value === 'string') {
      filtered[key] = value;
    }
  }

  return filtered;
};

// ============================================
// ERROR SANITIZATION
// ============================================

/**
 * Sanitize error messages to prevent information leakage
 * In production, hide internal details that could aid attackers
 */
const sanitizeErrorMessage = (message: string, statusCode: number, category: ErrorCategory): string => {
  // In production, only show detailed messages for client errors (4xx)
  if (process.env.NODE_ENV === 'production') {
    // For server errors (5xx), always show generic message
    if (statusCode >= 500) {
      return APP_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR;
    }

    // For rate limiting, show specific message
    if (category === 'rate_limit') {
      return message;
    }
  }

  // Remove potential file paths, stack traces, or internal details
  return message
    .replace(/\/[\w\/\.-]+/g, '[path]')    // Remove file paths
    .replace(/line \d+/gi, 'line N')        // Remove line numbers
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]')  // Remove IP addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')  // Remove emails
    .replace(/C:\\[^\\\s]+/g, '[path]')    // Remove Windows paths
    .replace(/\/home\/[^/\s]+/g, '[path]') // Remove Unix home paths
    .trim();
};

/**
 * Get correlation ID from request headers
 */
const getCorrelationId = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  return authReq.correlationId ||
         req.headers['x-correlation-id'] as string ||
         req.headers['x-request-id'] as string;
};

// ============================================
// MAIN ERROR HANDLER
// ============================================

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Extract error information
  let errorCode: string;
  let statusCode: number;
  let errorMessage: string;
  let errors: ErrorDetail[] = [];
  let details: Record<string, unknown> = {};
  let retryAfter: number | undefined;

  const authReq = req as AuthenticatedRequest;
  const correlationId = getCorrelationId(req);
  const timestamp = new Date().toISOString();
  const requestPath = req.originalUrl;
  const requestMethod = req.method;

  // Handle ApiError instances directly
  if (err instanceof ApiError) {
    errorCode = err.code || ERROR_CODES.INTERNAL_ERROR;
    statusCode = err.statusCode;
    errorMessage = err.message;
    errors = err.errors || [];
    details = err.data || {};
  } else {
    // Handle other Error types by extracting info
    const errorInfo = getMongooseErrorInfo(err);
    errorCode = errorInfo.code;
    statusCode = errorInfo.statusCode;
    errorMessage = errorInfo.message || err.message || APP_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR;
    errors = errorInfo.errors;
    details = errorInfo.details;
  }

  // Classify the error
  const category = classifyError(err, statusCode);

  // Sanitize error message
  const sanitizedMessage = sanitizeErrorMessage(errorMessage, statusCode, category);

  // Set retry-after header for rate limit errors
  if (category === 'rate_limit') {
    retryAfter = 60; // Default 60 seconds
    res.setHeader('Retry-After', String(retryAfter));
  }

  // Log error with structured data
  const logData = {
    correlationId,
    statusCode,
    code: errorCode,
    category,
    url: requestPath,
    method: requestMethod,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: authReq.user?.id,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    originalMessage: sanitizedMessage,
  };

  // Log based on severity
  if (category === 'server_error' || statusCode >= 500) {
    logger.error('Server error occurred', { ...logData, error: err });
  } else if (category === 'rate_limit') {
    logger.warn('Rate limit exceeded', logData);
  } else if (category === 'authorization' || category === 'authentication') {
    logger.warn('Auth error', logData);
  } else {
    logger.debug('Client error', logData);
  }

  // Capture exception in Sentry (only for server errors or unexpected errors)
  if (statusCode >= 500 || category === 'server_error' || category === 'external_service') {
    captureException(err, {
      request: {
        url: requestPath,
        method: requestMethod,
        headers: filterSafeHeaders(req),
        ip: req.ip,
        correlationId,
      },
      error: {
        code: errorCode,
        statusCode,
        category,
        userId: authReq.user?.id,
      },
    });
  }

  // Build standardized error response
  const response: StandardErrorResponse = {
    success: false,
    message: sanitizedMessage,
    code: errorCode,
    timestamp,
  };

  // Add correlation ID
  if (correlationId) {
    response.correlationId = correlationId;
  }

  // Add field errors if present
  if (errors.length > 0) {
    response.errors = errors;
  }

  // Add details in development or for specific error types
  const shouldShowDetails =
    process.env.NODE_ENV !== 'production' ||
    (statusCode >= 400 && statusCode < 500 && category !== 'rate_limit');

  if (shouldShowDetails && Object.keys(details).length > 0) {
    response.details = details;
  }

  // Add stack trace in development only
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Add retry-after for rate limit errors
  if (retryAfter) {
    response.retryAfter = retryAfter;
  }

  // Send response (only if headers not already sent)
  if (!res.headersSent) {
    res.status(statusCode).json(response);
  }
};

/**
 * Async handler wrapper that catches errors in async route handlers
 */
export const asyncErrorHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const correlationId = getCorrelationId(req);

  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    code: ERROR_CODES.NOT_FOUND,
    correlationId,
    timestamp: new Date().toISOString(),
  });
};

export default {
  errorHandler,
  asyncErrorHandler,
  notFoundHandler,
};
