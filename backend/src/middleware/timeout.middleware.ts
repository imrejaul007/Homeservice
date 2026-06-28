import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '../utils/ApiError';

/**
 * Request timeout middleware
 * Sets a timeout for requests and returns a 408 error if exceeded
 *
 * Use this middleware to prevent long-running requests from blocking resources
 * and to improve user experience with faster timeout feedback
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set server-side timeout
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request Timeout',
          code: 'REQUEST_TIMEOUT',
          message: 'The request took too long to process. Please try again or reduce the scope of your request.'
        });
      }
    });
    next();
  };
};
