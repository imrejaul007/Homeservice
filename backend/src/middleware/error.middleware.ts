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
}

export interface ErrorDetail {
  field?: string;
  message: string;
  type?: string;
  value?: unknown;
}

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
  // Validation errors (400)
  if (err.name === 'ValidationError' || statusCode === 400) {
    return 'validation';
  }

  // Authentication errors (401)
  if (err.name === 'JsonWebTokenError' ||
      err.name === 'TokenExpiredError' ||
      statusCode === 401 ||
      (err as any).code === ERROR_CODES.TOKEN_INVALID ||
      (err as any).code === ERROR_CODES.TOKEN_EXPIRED) {
    return 'authentication';
  }

  // Authorization errors (403)
  if (statusCode === 403 ||
      (err as any).code === ERROR_CODES.FORBIDDEN ||
      (err as any).code === ERROR_CODES.ACCESS_DENIED) {
    return 'authorization';
  }

  // Not found errors (404)
  if (statusCode === 404 ||
      (err as any).code === ERROR_CODES.NOT_FOUND ||
      (err as any).code === ERROR_CODES.USER_NOT_FOUND ||
      (err as any).code === ERROR_CODES.RESOURCE_NOT_FOUND) {
    return 'not_found';
  }

  // Conflict errors (409)
  if (statusCode === 409 ||
      (err as any).code === ERROR_CODES.DUPLICATE_ENTRY ||
      (err as any).code === ERROR_CODES.CONFLICT) {
    return 'conflict';
  }

  // Rate limit errors (429)
  if (statusCode === 429 ||
      (err as any).code === ERROR_CODES.RATE_LIMIT_EXCEEDED ||
      (err as any).code === ERROR_CODES.TOO_MANY_REQUESTS) {
    return 'rate_limit';
  }

  // External service errors
  if (err.message?.includes('ECONNREFUSED') ||
      err.message?.includes('ETIMEDOUT') ||
      err.message?.includes('ENOTFOUND') ||
      (err as any).code === ERROR_CODES.EXTERNAL_SERVICE_ERROR) {
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
  // CastError - invalid ObjectId format
  if (err.name === 'CastError') {
    const castError = err as any;
    return {
      code: ERROR_CODES.INVALID_INPUT,
      statusCode: 400,
      message: `Invalid ${castError.path}: value format is incorrect`,
      errors: [{ field: castError.path, message: 'Invalid format', type: 'cast_error' }],
      details: { path: castError.path, valueType: castError.kind }
    };
  }

  // Duplicate key error (11000)
  if ((err as any).code === 11000) {
    const keyValue = (err as any).keyValue || {};
    const field = Object.keys(keyValue)[0] || 'field';
    return {
      code: ERROR_CODES.DUPLICATE_ENTRY,
      statusCode: 409,
      message: `A record with this ${field} already exists`,
      errors: [{ field, message: 'Value already exists', type: 'duplicate' }],
      details: { field, duplicateValue: keyValue[field] }
    };
  }

  // ValidationError - schema validation failed
  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors || {}).map((e: any) => ({
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
    const multerError = err as any;
    return {
      code: ERROR_CODES.FILE_UPLOAD_ERROR,
      statusCode: 400,
      message: getMulterErrorMessage(multerError.code),
      errors: [],
      details: { code: multerError.code, field: multerError.field }
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
  return (req as any).correlationId ||
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
    userId: (req as any).user?.id,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    originalMessage: err.message,
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
        headers: {
          'user-agent': req.get('user-agent'),
          'content-type': req.get('content-type'),
        },
        ip: req.ip,
        correlationId,
      },
      error: {
        code: errorCode,
        statusCode,
        category,
        userId: (req as any).user?.id,
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
    (response as any).stack = err.stack;
  }

  // Add retry-after for rate limit errors
  if (retryAfter) {
    response.retryAfter = retryAfter;
  }

  // Send response
  res.status(statusCode).json(response);
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
