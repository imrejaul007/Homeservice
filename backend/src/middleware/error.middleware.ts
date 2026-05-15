import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { APP_CONSTANTS } from '../config/constants';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

// Map Mongoose error types to application error codes
const getMongooseErrorInfo = (err: Error): { code: string; statusCode: number; message?: string; errors?: any[] } => {
  if (err.name === 'CastError') {
    return {
      code: ERROR_CODES.INVALID_INPUT,
      statusCode: APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST,
      message: 'Invalid resource ID'
    };
  }
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    return {
      code: ERROR_CODES.DUPLICATE_ENTRY,
      statusCode: APP_CONSTANTS.HTTP_STATUS.CONFLICT,
      message: `${field} already exists`
    };
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => ({
      field: e.path,
      message: e.message
    }));
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST,
      message: APP_CONSTANTS.ERROR_MESSAGES.VALIDATION_ERROR,
      errors
    };
  }
  if (err.name === 'JsonWebTokenError') {
    return {
      code: ERROR_CODES.TOKEN_INVALID,
      statusCode: APP_CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
      message: APP_CONSTANTS.ERROR_MESSAGES.INVALID_TOKEN
    };
  }
  if (err.name === 'TokenExpiredError') {
    return {
      code: ERROR_CODES.TOKEN_EXPIRED,
      statusCode: APP_CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
      message: APP_CONSTANTS.ERROR_MESSAGES.TOKEN_EXPIRED
    };
  }
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    statusCode: APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: APP_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR
  };
};

// Get correlation ID from request if available
const getCorrelationId = (req: Request): string | undefined => {
  return (req as any).correlationId || req.headers['x-correlation-id'] as string;
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error: ApiError;
  let errorCode: string;
  let statusCode: number;
  let errorMessage: string;
  let errors: any[] = [];
  const correlationId = getCorrelationId(req);

  // Handle ApiError instances directly
  if (err instanceof ApiError) {
    error = err;
    errorCode = err.code || ERROR_CODES.INTERNAL_ERROR;
    statusCode = err.statusCode;
    errorMessage = err.message;
    errors = err.errors || [];
  } else {
    // Handle other Error types by extracting info
    const errorInfo = getMongooseErrorInfo(err);
    errorCode = errorInfo.code;
    statusCode = errorInfo.statusCode;
    errorMessage = errorInfo.message || err.message || APP_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR;
    errors = errorInfo.errors || [];
    error = new ApiError(statusCode, errorMessage, errors, errorCode);
  }

  // Log error with correlation ID for tracing
  logger.error({
    message: errorMessage,
    statusCode,
    code: errorCode,
    correlationId,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Build standardized error response
  const response: Record<string, any> = {
    success: false,
    message: errorMessage,
    code: errorCode
  };

  // Add correlation ID for client reference
  if (correlationId) {
    response.correlationId = correlationId;
  }

  // Add field errors if present
  if (errors.length > 0) {
    response.errors = errors;
  }

  // Add stack trace in development only
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};