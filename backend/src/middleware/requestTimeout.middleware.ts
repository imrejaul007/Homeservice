/**
 * Request Timeout Middleware
 * Provides configurable request timeouts with proper error handling
 * and logging for the NILIN Platform
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

// Timeout configuration
interface TimeoutConfig {
  /** Default timeout in milliseconds */
  default: number;
  /** Timeout for read operations */
  read: number;
  /** Timeout for write operations */
  write: number;
  /** Timeout for critical endpoints (ms) */
  critical: number;
  /** Disable timeout for certain paths (health checks, etc.) */
  disabledPaths: RegExp[];
}

const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  default: 30000,        // 30 seconds
  read: 60000,          // 60 seconds for file uploads, etc.
  write: 30000,          // 30 seconds
  critical: 15000,       // 15 seconds for critical operations
  disabledPaths: [
    /^\/health/,
    /^\/metrics/,
    /^\/api-docs/,
    /^\/api\/test/,
  ],
};

/**
 * Check if timeout should be disabled for this path
 */
const shouldDisableTimeout = (path: string, config: TimeoutConfig): boolean => {
  return config.disabledPaths.some(pattern => pattern.test(path));
};

/**
 * Get timeout value based on request method and path
 */
const getTimeoutValue = (req: Request, config: TimeoutConfig): number => {
  const path = req.path || req.url;

  // Check if timeout is disabled for this path
  if (shouldDisableTimeout(path, config)) {
    return 0; // 0 means no timeout
  }

  // Method-specific timeouts
  if (req.method === 'GET') {
    return config.default;
  }

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return config.write;
  }

  if (req.method === 'DELETE') {
    return config.default;
  }

  return config.default;
};

/**
 * Error codes for different timeout scenarios
 */
const TIMEOUT_ERROR_CODES = {
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  SOCKET_HANGUP: 'SOCKET_HANGUP',
  SERVER_BUSY: 'SERVER_BUSY',
} as const;

/**
 * Request timeout middleware factory
 */
export const createRequestTimeout = (config: Partial<TimeoutConfig> = {}): RequestHandler => {
  const finalConfig: TimeoutConfig = {
    ...DEFAULT_TIMEOUT_CONFIG,
    ...config,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path || req.url;
    const timeoutMs = getTimeoutValue(req, finalConfig);

    // Skip timeout for disabled paths
    if (timeoutMs === 0) {
      return next();
    }

    // Set response timeout header
    res.setHeader('X-Response-Timeout', `${timeoutMs}ms`);

    // Set Express timeout (if available)
    if (typeof req.setTimeout === 'function') {
      req.setTimeout(timeoutMs, () => {
        logger.warn('Request timeout triggered', {
          path,
          method: req.method,
          timeout: timeoutMs,
          correlationId: (req as any).correlationId,
          ip: req.ip,
          action: 'REQUEST_TIMEOUT',
        });

        if (!res.headersSent) {
          res.status(504).json({
            success: false,
            message: 'The request took too long to process. Please try again.',
            code: ERROR_CODES.INTERNAL_ERROR,
            error: {
              type: TIMEOUT_ERROR_CODES.REQUEST_TIMEOUT,
              timeout: timeoutMs,
            },
          });
        }
      });
    }

    // Set server response timeout
    res.setTimeout(timeoutMs, () => {
      logger.warn('Response timeout triggered', {
        path,
        method: req.method,
        timeout: timeoutMs,
        correlationId: (req as any).correlationId,
        action: 'RESPONSE_TIMEOUT',
      });
    });

    // Track request start time
    const startTime = Date.now();

    // Override res.end to track actual response time
    const originalEnd = res.end;
    res.end = function(this: Response, ...args: any[]): Response {
      const responseTime = Date.now() - startTime;

      // Log slow requests
      if (responseTime > timeoutMs * 0.8) {
        logger.warn('Slow request detected', {
          path,
          method: req.method,
          responseTime,
          expectedTimeout: timeoutMs,
          correlationId: (req as any).correlationId,
          action: 'SLOW_REQUEST',
        });
      }

      // Log all requests in development
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Request completed', {
          path,
          method: req.method,
          responseTime,
          statusCode: res.statusCode,
          correlationId: (req as any).correlationId,
        });
      }

      return originalEnd.apply(this, args as any);
    } as typeof res.end;

    next();
  };
};

/**
 * High-priority timeout middleware for critical operations
 * Shorter timeout, faster failure response
 */
export const criticalRequestTimeout: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const timeoutMs = DEFAULT_TIMEOUT_CONFIG.critical;

  if (typeof req.setTimeout === 'function') {
    req.setTimeout(timeoutMs, () => {
      logger.warn('Critical request timeout triggered', {
        path: req.path,
        method: req.method,
        timeout: timeoutMs,
        action: 'CRITICAL_REQUEST_TIMEOUT',
      });

      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: 'Service temporarily unavailable. Please try again.',
          code: ERROR_CODES.INTERNAL_ERROR,
          error: {
            type: TIMEOUT_ERROR_CODES.SERVER_BUSY,
            retryAfter: 5,
          },
        });
      }
    });
  }

  res.setHeader('X-Response-Timeout', `${timeoutMs}ms`);
  next();
};

/**
 * Create a timeout error for manual throwing
 */
export const createTimeoutError = (
  message = 'The request took too long to process',
  timeout = DEFAULT_TIMEOUT_CONFIG.default
): ApiError => {
  return new ApiError(
    504,
    message,
    [],
    ERROR_CODES.INTERNAL_ERROR
  );
};

/**
 * Utility to wrap async handlers with timeout
 */
export const withTimeout = <T>(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_CONFIG.default
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      await Promise.race([
        handler(req, res, next),
        timeoutPromise,
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        logger.warn('Async operation timeout', {
          path: req.path,
          method: req.method,
          timeout: timeoutMs,
          action: 'ASYNC_TIMEOUT',
        });

        if (!res.headersSent) {
          res.status(504).json({
            success: false,
            message: 'The operation took too long to complete. Please try again.',
            code: ERROR_CODES.INTERNAL_ERROR,
            error: {
              type: TIMEOUT_ERROR_CODES.REQUEST_TIMEOUT,
              timeout: timeoutMs,
            },
          });
        }
      } else {
        next(error);
      }
    }
  };
};

// Export default instance
export const requestTimeout = createRequestTimeout();

export default {
  createRequestTimeout,
  criticalRequestTimeout,
  createTimeoutError,
  withTimeout,
  requestTimeout,
};
