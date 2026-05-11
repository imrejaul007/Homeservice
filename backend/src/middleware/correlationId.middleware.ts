import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId, setCorrelationId } from '../utils/logger';

/**
 * Middleware to add correlation ID to every request
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Check for existing correlation ID in request header or generate new one
  const correlationId = (req.headers['x-correlation-id'] as string) ||
                        (req.headers['x-request-id'] as string) ||
                        generateCorrelationId();

  // Set correlation ID globally for logging
  setCorrelationId(correlationId);

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', correlationId);

  // Add to request object for use in controllers
  (req as any).correlationId = correlationId;

  next();
};

export default correlationIdMiddleware;
