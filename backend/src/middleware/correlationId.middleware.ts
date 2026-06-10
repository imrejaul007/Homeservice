import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId, runWithCorrelationId } from '../utils/logger';

/** Maximum length for correlation IDs to prevent buffer overflow in logs */
const MAX_CORRELATION_ID_LENGTH = 128;

/** Regex for valid correlation ID: alphanumeric, hyphens, underscores only */
const VALID_CORRELATION_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Sanitize correlation ID to prevent log injection attacks.
 * - Strips ANSI escape codes and control characters
 * - Enforces length limit
 * - Only allows safe characters (alphanumeric, hyphen, underscore)
 */
function sanitizeCorrelationId(id: string): string {
  // Remove ANSI escape codes (ESC[... sequences)
  let sanitized = id.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  // Remove other control characters (excluding tab, newline in valid context)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Remove any remaining escape characters
  sanitized = sanitized.replace(/\x1b/g, '');
  // Trim and truncate to max length
  sanitized = sanitized.trim();
  if (sanitized.length > MAX_CORRELATION_ID_LENGTH) {
    sanitized = sanitized.substring(0, MAX_CORRELATION_ID_LENGTH);
  }
  return sanitized;
}

/**
 * Validate correlation ID format.
 * Returns the sanitized value if valid, null if invalid (should generate new).
 */
function validateCorrelationId(id: string): string | null {
  const sanitized = sanitizeCorrelationId(id);
  // Must be non-empty and match allowed characters
  if (sanitized.length > 0 && VALID_CORRELATION_ID_REGEX.test(sanitized)) {
    return sanitized;
  }
  return null;
}

/**
 * Middleware to add correlation ID to every request.
 * Uses AsyncLocalStorage via runWithCorrelationId to ensure proper isolation
 * between concurrent requests - each request gets its own correlation ID context.
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Try to use user-provided correlation ID, but validate and sanitize it
  const userProvidedId = (req.headers['x-correlation-id'] as string) ||
                         (req.headers['x-request-id'] as string);

  // Use validated ID if valid, otherwise generate a new one
  const correlationId = userProvidedId
    ? validateCorrelationId(userProvidedId) || generateCorrelationId()
    : generateCorrelationId();

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', correlationId);

  // Add to request object for use in controllers
  (req as any).correlationId = correlationId;

  // Wrap the remaining middleware/handlers in the correlation context.
  // This ensures all async operations (logging, database calls, etc.)
  // within this request will have the correct correlation ID,
  // isolated from other concurrent requests.
  runWithCorrelationId(correlationId, () => {
    next();
  });
};

export default correlationIdMiddleware;
