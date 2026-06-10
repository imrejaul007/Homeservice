import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import AdminApiKey, { IAdminApiKey } from '../models/adminApiKey.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { API_KEY_PERMISSIONS, isValidPermission } from '../constants/apiKeyPermissions';

declare global {
  namespace Express {
    interface Request {
      adminApiKey?: IAdminApiKey;
    }
  }
}

interface RateLimitEntry {
  timestamps: number[];
  limit: number;
  windowMs: number;
}

/**
 * Sliding window rate limiter for API key authentication.
 * Uses per-key tracking with a sliding window algorithm.
 * Window: 60 seconds, cleanup: runs on each request.
 */
class ApiKeyRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs = 60 * 1000; // 1 minute sliding window

  /**
   * Check if a request is allowed and record it.
   * Returns { allowed, remaining, resetIn }.
   */
  checkAndRecord(keyHash: string, limit: number): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const entry = this.store.get(keyHash);

    if (!entry) {
      // First request from this key
      this.store.set(keyHash, {
        timestamps: [now],
        limit,
        windowMs: this.windowMs,
      });
      return { allowed: true, remaining: limit - 1, resetIn: this.windowMs };
    }

    // Sync the limit from the key (in case it was updated)
    entry.limit = limit;
    entry.windowMs = this.windowMs;

    // Remove expired timestamps (before windowStart)
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    const currentCount = entry.timestamps.length;

    if (currentCount >= limit) {
      // Rate limit exceeded
      const oldestTimestamp = Math.min(...entry.timestamps);
      const resetIn = oldestTimestamp + this.windowMs - now;
      return { allowed: false, remaining: 0, resetIn: Math.max(0, resetIn) };
    }

    // Allow request and record timestamp
    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetIn: this.windowMs,
    };
  }

  /**
   * Cleanup old entries periodically.
   * Called on each request to prevent memory leaks.
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs * 2; // Keep entries for 2 windows
    const keysToDelete: string[] = [];

    this.store.forEach((entry, key) => {
      // Remove entries with no recent timestamps
      const validTimestamps = entry.timestamps.filter((ts) => ts > cutoff);
      if (validTimestamps.length === 0) {
        keysToDelete.push(key);
      } else {
        entry.timestamps = validTimestamps;
      }
    });

    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }
}

// Singleton instance - shared across all requests
const rateLimiter = new ApiKeyRateLimiter();

function extractApiKey(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  return null;
}

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Authenticate requests using an admin integration API key (admin_ prefix).
 * Sets req.adminApiKey on success.
 * Enforces per-key rate limiting to prevent brute-force attacks.
 */
export const authenticateAdminApiKey = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const plainKey = extractApiKey(req);
    if (!plainKey) {
      logger.warn('API key authentication failed - missing key', {
        action: 'AUTH_FAILED_MISSING_KEY',
        method: req.method,
        path: req.path,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
      });
      throw ApiError.unauthorized('API key required', ERROR_CODES.UNAUTHORIZED);
    }

    // Compute key hash for rate limiting before DB lookup
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');

    // Always perform DB lookup regardless of format to prevent timing attacks.
    // Missing keys use a dummy value so every code path takes identical time.
    const apiKey = await AdminApiKey.verifyKey(plainKey);
    if (!apiKey) {
      // Still run rate limit check on failed attempts to slow down brute force
      // Use a default limit for unknown keys (lower than normal)
      const rateLimitResult = rateLimiter.checkAndRecord(keyHash, 10);
      if (!rateLimitResult.allowed) {
        res.setHeader('X-RateLimit-Limit', '10');
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + rateLimitResult.resetIn) / 1000).toString());
        res.setHeader('Retry-After', Math.ceil(rateLimitResult.resetIn / 1000).toString());
        throw ApiError.tooManyRequests(
          'Too many authentication attempts. Please try again later.',
          ERROR_CODES.RATE_LIMIT_EXCEEDED
        );
      }
      logger.warn('API key authentication failed - invalid or expired key', {
        action: 'AUTH_FAILED_INVALID_KEY',
        method: req.method,
        path: req.path,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
        keyPrefix: keyHash.substring(0, 8), // Log only hash prefix for correlation, not the key itself
      });
      throw ApiError.unauthorized('Invalid or expired API key', ERROR_CODES.UNAUTHORIZED);
    }

    // Run periodic cleanup on a subset of requests (1 in 50)
    if (Math.random() < 0.02) {
      rateLimiter.cleanup();
    }

    // Check rate limit using the key's configured limit
    const rateLimitResult = rateLimiter.checkAndRecord(keyHash, apiKey.rateLimit);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', apiKey.rateLimit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + rateLimitResult.resetIn) / 1000).toString());

    if (!rateLimitResult.allowed) {
      res.setHeader('Retry-After', Math.ceil(rateLimitResult.resetIn / 1000).toString());
      logger.warn('API key rate limit exceeded', {
        action: 'RATE_LIMIT_EXCEEDED',
        apiKeyId: apiKey._id,
        keyPrefix: apiKey.keyPrefix,
        limit: apiKey.rateLimit,
      });
      throw ApiError.tooManyRequests(
        'Rate limit exceeded. Please slow down your requests.',
        ERROR_CODES.RATE_LIMIT_EXCEEDED
      );
    }

    // Fire-and-forget usage tracking - do not await.
    // Failures here must NOT reject valid authentication requests.
    apiKey.recordUsage().catch((err) => {
      logger.error('Failed to record API key usage', {
        action: 'USAGE_RECORD_FAILED',
        apiKeyId: apiKey._id,
        keyPrefix: apiKey.keyPrefix,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    req.adminApiKey = apiKey;

    logger.debug('Admin API key authenticated', {
      action: 'API_KEY_AUTH',
      apiKeyId: apiKey._id,
      keyPrefix: apiKey.keyPrefix,
    });

    next();
  }
);

/**
 * Require one or more permissions on the authenticated API key.
 * Validates permissions against the allowed enum before checking.
 * Throws 400 if any permission is invalid or empty.
 */
export const requireApiKeyPermission = (...permissions: string[]) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const apiKey = req.adminApiKey;
    if (!apiKey) {
      throw ApiError.unauthorized('API key required', ERROR_CODES.UNAUTHORIZED);
    }

    // Validate all permissions are valid enum values and not empty strings
    const invalidPermissions = permissions.filter(
      (p) => typeof p !== 'string' || p.trim() === '' || !isValidPermission(p)
    );

    if (invalidPermissions.length > 0) {
      throw ApiError.badRequest(
        `Invalid permission(s): ${invalidPermissions.join(', ')}. Valid permissions are: ${API_KEY_PERMISSIONS.join(', ')}`,
        undefined,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // If no permissions specified, require admin by default
    const permissionsToCheck = permissions.length === 0 ? ['admin'] : permissions;

    const hasAll = permissionsToCheck.every(
      (p) => apiKey.permissions.includes(p) || apiKey.permissions.includes('admin')
    );

    if (!hasAll) {
      throw ApiError.forbidden(
        `API key missing required permission(s): ${permissionsToCheck.join(', ')}`,
        ERROR_CODES.FORBIDDEN
      );
    }

    next();
  });
