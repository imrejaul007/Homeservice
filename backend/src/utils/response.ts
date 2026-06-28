import { Response } from 'express';

/**
 * Standardized API response utilities
 * Use these helpers to ensure consistent response format across all controllers
 */

/**
 * Send a success response
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    ...(message && { message }),
    data,
  });
};

/**
 * Send an error response
 */
export const errorResponse = (
  res: Response,
  status: number,
  error: string,
  message?: string,
  details?: unknown
): Response => {
  const response: Record<string, unknown> = {
    success: false,
    error,
  };

  if (message) {
    response.message = message;
  }

  if (details) {
    response.details = details;
  }

  return res.status(status).json(response);
};

/**
 * Common error helpers
 */
export const notFoundResponse = (
  res: Response,
  resource: string = 'Resource'
): Response => {
  return errorResponse(res, 404, 'Not Found', `${resource} not found`);
};

export const validationErrorResponse = (
  res: Response,
  message: string,
  details?: unknown
): Response => {
  return errorResponse(res, 400, 'Validation Error', message, details);
};

export const unauthorizedResponse = (
  res: Response,
  message: string = 'Authentication required'
): Response => {
  return errorResponse(res, 401, 'Unauthorized', message);
};

export const forbiddenResponse = (
  res: Response,
  message: string = 'Access denied'
): Response => {
  return errorResponse(res, 403, 'Forbidden', message);
};

export const rateLimitResponse = (
  res: Response,
  message: string = 'Too many requests, please try again later'
): Response => {
  return errorResponse(res, 429, 'Too Many Requests', message, {
    retryAfter: 60,
  });
};

export const serverErrorResponse = (
  res: Response,
  message: string = 'Internal server error'
): Response => {
  return errorResponse(res, 500, 'Internal Server Error', message);
};
