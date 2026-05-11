import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { APP_CONSTANTS } from '../config/constants';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  errors?: any[];
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;
  errors?: any[];

  constructor(message: string, statusCode: number, isOperational = true, errors?: any[]) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message || APP_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR;

  // Log error
  logger.error({
    message: error.message,
    statusCode: error.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID';
    error = new AppError(message, APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    const message = `${field} already exists`;
    error = new AppError(message, APP_CONSTANTS.HTTP_STATUS.CONFLICT);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => ({
      field: e.path,
      message: e.message
    }));
    const message = APP_CONSTANTS.ERROR_MESSAGES.VALIDATION_ERROR;
    error = new AppError(message, APP_CONSTANTS.HTTP_STATUS.BAD_REQUEST, true, errors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = APP_CONSTANTS.ERROR_MESSAGES.INVALID_TOKEN;
    error = new AppError(message, APP_CONSTANTS.HTTP_STATUS.UNAUTHORIZED);
  }

  if (err.name === 'TokenExpiredError') {
    const message = APP_CONSTANTS.ERROR_MESSAGES.TOKEN_EXPIRED;
    error = new AppError(message, APP_CONSTANTS.HTTP_STATUS.UNAUTHORIZED);
  }

  res.status(error.statusCode || APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};