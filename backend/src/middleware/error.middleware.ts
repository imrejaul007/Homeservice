import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { APP_CONSTANTS } from '../config/constants';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

// Map Mongoose error types to application error codes
const getMongooseErrorCode = (err: Error): string => {
  if (err.name === 'CastError') {
    return ERROR_CODES.INVALID_INPUT;
  }
  if ((err as any).code === 11000) {
    return ERROR_CODES.DUPLICATE_ENTRY;
  }
  if (err.name === 'ValidationError') {
    return ERROR_CODES.VALIDATION_ERROR;
  }
  if (err.name === 'JsonWebTokenError') {
    return ERROR_CODES.TOKEN_INVALID;
  }
  if (err.name === 'TokenExpiredError') {
    return ERROR_CODES.TOKEN_EXPIRED;
  }
  return ERROR_CODES.INTERNAL_ERROR;
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error: ApiError;
  let errorCode: string = ERROR_CODES.INTERNAL_ERROR;

  // Handle ApiError instances directly
  if (err instanceof ApiError) {
    error = err;
    errorCode = err.code || ERROR_CODES.INTERNAL_ERROR;
  } else {
    // Handle other Error types by wrapping them
    errorCode = getMongooseErrorCode(err);
    error = new ApiError(
      500,
      err.message || APP_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR,
      [],
      errorCode
    );
  }

  // Log error
  logger.error({
    message: error.message,
    statusCode: error.statusCode,
    code: errorCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID';
    error = new ApiError(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST, message, [], ERROR_CODES.INVALID_INPUT);
    errorCode = ERROR_CODES.INVALID_INPUT;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    const message = `${field} already exists`;
    error = new ApiError(APP_CONSTANTS.HTTP_STATUS.CONFLICT, message, [], ERROR_CODES.DUPLICATE_ENTRY);
    errorCode = ERROR_CODES.DUPLICATE_ENTRY;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => ({
      field: e.path,
      message: e.message
    }));
    const message = APP_CONSTANTS.ERROR_MESSAGES.VALIDATION_ERROR;
    error = new ApiError(APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST, message, errors, ERROR_CODES.VALIDATION_ERROR);
    errorCode = ERROR_CODES.VALIDATION_ERROR;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = APP_CONSTANTS.ERROR_MESSAGES.INVALID_TOKEN;
    error = new ApiError(APP_CONSTANTS.HTTP_STATUS.UNAUTHORIZED, message, [], ERROR_CODES.TOKEN_INVALID);
    errorCode = ERROR_CODES.TOKEN_INVALID;
  }

  if (err.name === 'TokenExpiredError') {
    const message = APP_CONSTANTS.ERROR_MESSAGES.TOKEN_EXPIRED;
    error = new ApiError(APP_CONSTANTS.HTTP_STATUS.UNAUTHORIZED, message, [], ERROR_CODES.TOKEN_EXPIRED);
    errorCode = ERROR_CODES.TOKEN_EXPIRED;
  }

  res.status(error.statusCode || APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message,
    code: errorCode,
    ...(error.errors && error.errors.length > 0 && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};