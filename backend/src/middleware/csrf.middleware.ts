import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { CookieOptions } from 'express';
import logger from '../utils/logger';
import { cache, isRedisAvailable } from '../config/redis';

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters
const CSRF_TOKEN_EXPIRY_HOURS = 24;

// In-memory token store for fallback when Redis is unavailable
interface CSRFTokenEntry {
  token: string;
  userId: string;
  createdAt: Date;
  lastUsedAt: Date;
  rotated: boolean;
}

// In-memory fallback for single-instance deployments without Redis
const memoryTokenStore = new Map<string, CSRFTokenEntry>();

// Environment-based configuration
const getConfig = () => ({
  tokenLength: parseInt(process.env.CSRF_TOKEN_LENGTH || String(CSRF_TOKEN_LENGTH)),
  tokenExpiryHours: parseInt(process.env.CSRF_TOKEN_EXPIRY_HOURS || String(CSRF_TOKEN_EXPIRY_HOURS)),
  cookieName: process.env.CSRF_COOKIE_NAME || 'csrf_token',
  headerName: process.env.CSRF_HEADER_NAME || 'x-csrf-token',
  sameSite: (process.env.CSRF_SAME_SITE || 'strict') as 'strict' | 'lax' | 'none',
  secure: process.env.NODE_ENV === 'production',
  rotateOnAuth: process.env.CSRF_ROTATE_ON_AUTH !== 'false', // Default true
});

// ============================================
// Redis-based CSRF Token Storage
// ============================================

const CSRF_KEY_PREFIX = 'csrf:';

/**
 * Store CSRF token in Redis with TTL
 * Falls back to memory store if Redis is unavailable
 */
async function storeToken(key: string, entry: CSRFTokenEntry, ttlMs: number): Promise<void> {
  if (isRedisAvailable()) {
    try {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await cache.set(
        `${CSRF_KEY_PREFIX}${key}`,
        JSON.stringify({
          token: entry.token,
          userId: entry.userId,
          createdAt: entry.createdAt.toISOString(),
          lastUsedAt: entry.lastUsedAt.toISOString(),
          rotated: entry.rotated,
        }),
        ttlSeconds
      );
      return;
    } catch (err) {
      logger.warn('Redis CSRF store failed, using memory fallback', {
        error: (err as Error).message,
        action: 'CSRF_REDIS_STORE_FAILED',
      });
    }
  }
  // Fallback to memory
  memoryTokenStore.set(key, entry);
}

/**
 * Retrieve CSRF token from Redis
 * Falls back to memory store if Redis is unavailable
 */
async function getToken(key: string): Promise<CSRFTokenEntry | null> {
  if (isRedisAvailable()) {
    try {
      const data = await cache.get(`${CSRF_KEY_PREFIX}${key}`);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          token: parsed.token,
          userId: parsed.userId,
          createdAt: new Date(parsed.createdAt),
          lastUsedAt: new Date(parsed.lastUsedAt),
          rotated: parsed.rotated,
        };
      }
      return null;
    } catch (err) {
      logger.warn('Redis CSRF get failed, using memory fallback', {
        error: (err as Error).message,
        action: 'CSRF_REDIS_GET_FAILED',
      });
    }
  }
  // Fallback to memory
  return memoryTokenStore.get(key) || null;
}

/**
 * Delete CSRF token from Redis
 * Falls back to memory store if Redis is unavailable
 */
async function deleteToken(key: string): Promise<void> {
  if (isRedisAvailable()) {
    try {
      await cache.del(`${CSRF_KEY_PREFIX}${key}`);
      return;
    } catch (err) {
      logger.warn('Redis CSRF delete failed', {
        error: (err as Error).message,
        action: 'CSRF_REDIS_DELETE_FAILED',
      });
    }
  }
  // Fallback to memory
  memoryTokenStore.delete(key);
}

/**
 * Generate a cryptographically secure CSRF token
 * Uses crypto.randomBytes for secure random generation
 */
export function generateCsrfToken(req: Request, res: Response): string {
  const config = getConfig();

  // Generate random bytes and convert to hex
  const randomBytes = crypto.randomBytes(config.tokenLength);
  const token = randomBytes.toString('hex');

  // Get user ID if authenticated, otherwise use session/IP fingerprint
  const userId = getUserIdentifier(req);

  // Create token entry
  const tokenEntry: CSRFTokenEntry = {
    token,
    userId,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    rotated: false,
  };

  // Store token with expiry
  const expiryTime = config.tokenExpiryHours * 60 * 60 * 1000;
  const storeKey = generateStoreKey(req, token);

  // Store asynchronously (don't block response)
  storeToken(storeKey, tokenEntry, expiryTime).catch(err => {
    logger.error('Failed to store CSRF token', { error: (err as Error).message });
  });

  // Set CSRF cookie
  const cookieOptions = csrfCookieOptions();
  res.cookie(config.cookieName, token, {
    ...cookieOptions,
    maxAge: expiryTime,
  });

  logger.debug('CSRF token generated', {
    userId,
    expiresIn: `${config.tokenExpiryHours}h`,
    storage: isRedisAvailable() ? 'redis' : 'memory',
  });

  return token;
}

/**
 * Validate CSRF token from request
 * Checks both header and body sources
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();

  // Only validate state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip for safe paths (health checks, etc.)
  const safePaths = ['/health', '/health/ready', '/health/live', '/metrics', '/api/test'];
  if (safePaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Extract token from header or body
  const tokenFromHeader = req.headers[config.headerName.toLowerCase()] as string | undefined;
  const tokenFromBody = req.body?._csrf || req.body?.csrfToken;
  const token = tokenFromHeader || tokenFromBody;

  if (!token) {
    logger.warn('CSRF validation failed: No token provided', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      message: 'CSRF token is required',
      code: 'CSRF_TOKEN_MISSING',
    });
    return;
  }

  // Validate token format (must be hex string of correct length)
  if (!isValidTokenFormat(token)) {
    logger.warn('CSRF validation failed: Invalid token format', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      message: 'Invalid CSRF token format',
      code: 'CSRF_TOKEN_INVALID',
    });
    return;
  }

  // Validate token exists and matches user
  const storeKey = generateStoreKey(req, token);

  // Use synchronous validation with memory fallback for middleware
  // For production with Redis, validation happens in the async wrapper below
  validateTokenAsync(req, res, next, storeKey, token);
}

/**
 * Async token validation with Redis support
 */
async function validateTokenAsync(
  req: Request,
  res: Response,
  next: NextFunction,
  storeKey: string,
  token: string
): Promise<void> {
  const config = getConfig();
  const tokenEntry = await getToken(storeKey);

  if (!tokenEntry) {
    logger.warn('CSRF validation failed: Token not found', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      message: 'CSRF token is invalid or expired',
      code: 'CSRF_TOKEN_INVALID',
    });
    return;
  }

  // Check token expiry
  const configExpiry = config.tokenExpiryHours * 60 * 60 * 1000;
  if (Date.now() - tokenEntry.createdAt.getTime() > configExpiry) {
    await deleteToken(storeKey);
    logger.warn('CSRF validation failed: Token expired', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      message: 'CSRF token has expired',
      code: 'CSRF_TOKEN_EXPIRED',
    });
    return;
  }

  // Verify user identifier matches (prevent token hijacking across users)
  const currentUserId = getUserIdentifier(req);
  if (tokenEntry.userId !== currentUserId) {
    await deleteToken(storeKey);
    logger.warn('CSRF validation failed: User mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      expectedUser: tokenEntry.userId,
      actualUser: currentUserId,
    });
    res.status(403).json({
      success: false,
      message: 'CSRF token is invalid',
      code: 'CSRF_TOKEN_INVALID',
    });
    return;
  }

  // Update last used timestamp
  tokenEntry.lastUsedAt = new Date();

  // Rotate token on authenticated requests if enabled
  if (config.rotateOnAuth && req.user && !tokenEntry.rotated) {
    await rotateCsrfToken(req, res, storeKey, tokenEntry);
  } else {
    // Re-store the updated entry
    const expiryTime = config.tokenExpiryHours * 60 * 60 * 1000;
    await storeToken(storeKey, tokenEntry, expiryTime);
  }

  logger.debug('CSRF validation successful', {
    path: req.path,
    method: req.method,
    userId: currentUserId,
    storage: isRedisAvailable() ? 'redis' : 'memory',
  });

  // Attach validated token to request for downstream use
  (req as any).csrfToken = token;

  return next();
}

/**
 * CSRF cookie configuration options
 * Uses httpOnly and SameSite for security
 */
export function csrfCookieOptions(): CookieOptions {
  const config = getConfig();

  const options: CookieOptions = {
    httpOnly: true, // Not accessible to JavaScript
    secure: config.secure, // HTTPS only in production
    sameSite: config.sameSite, // SameSite=Strict for maximum protection
    path: '/',
  };

  // Add domain in production if specified
  if (process.env.CSRF_COOKIE_DOMAIN) {
    options.domain = process.env.CSRF_COOKIE_DOMAIN;
  }

  return options;
}

/**
 * Validate Origin/Referer headers for CSRF protection
 * Should be used alongside token validation
 */
export function validateOriginHeader(req: Request, res: Response, next: NextFunction): void {
  // Only validate state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip for safe paths
  const safePaths = ['/health', '/health/ready', '/health/live', '/metrics', '/api/test'];
  if (safePaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;
  const host = req.headers.host as string | undefined;

  // Allow requests with no origin (mobile apps, curl, same-site requests)
  if (!origin && !referer) {
    if (req.get('Referer') === undefined && !origin) {
      // No origin info at all - could be a CSRF attack or a browser issue
      logger.warn('CSRF origin check: No origin or referer header', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        host,
      });
    }
    return next();
  }

  // Validate origin matches expected origin
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (requestOrigin && allowedOrigins.length > 0 && !allowedOrigins.includes(requestOrigin)) {
    logger.warn('CSRF origin validation failed: Origin mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      expectedOrigins: allowedOrigins,
      actualOrigin: requestOrigin,
    });
    res.status(403).json({
      success: false,
      message: 'Invalid request origin',
      code: 'INVALID_ORIGIN',
    });
    return;
  }

  return next();
}

/**
 * Get list of allowed origins from environment
 */
function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  const corsOrigins = process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : [];

  return [...new Set([...origins, ...corsOrigins, 'http://localhost:3000', 'http://localhost:5173'])];
}

/**
 * Rotate CSRF token after successful validation
 * Creates a new token and invalidates the old one
 */
async function rotateCsrfToken(
  req: Request,
  res: Response,
  oldStoreKey: string,
  oldEntry: CSRFTokenEntry
): Promise<void> {
  const config = getConfig();

  // Generate new token
  const newToken = crypto.randomBytes(config.tokenLength).toString('hex');
  const userId = getUserIdentifier(req);

  // Create new token entry
  const newEntry: CSRFTokenEntry = {
    token: newToken,
    userId,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    rotated: false,
  };

  // Store new token
  const newStoreKey = generateStoreKey(req, newToken);
  const expiryTime = config.tokenExpiryHours * 60 * 60 * 1000;
  await storeToken(newStoreKey, newEntry, expiryTime);

  // Set new cookie
  res.cookie(config.cookieName, newToken, {
    ...csrfCookieOptions(),
    maxAge: expiryTime,
  });

  // Mark old entry as rotated and schedule deletion
  oldEntry.rotated = true;

  // Remove old token after short grace period (5 minutes)
  setTimeout(async () => {
    await deleteToken(oldStoreKey);
  }, 5 * 60 * 1000);

  logger.debug('CSRF token rotated', {
    userId,
    storage: isRedisAvailable() ? 'redis' : 'memory',
  });
}

/**
 * Generate a unique store key for the token
 * Combines token with user identifier for extra security
 */
function generateStoreKey(req: Request, token: string): string {
  const userId = getUserIdentifier(req);
  return crypto.createHash('sha256').update(`${userId}:${token}`).digest('hex');
}

/**
 * Get user identifier from request
 * Uses user ID if authenticated, otherwise generates fingerprint from IP and user agent
 */
function getUserIdentifier(req: Request): string {
  if (req.user?._id) {
    return `user:${req.user._id.toString()}`;
  }

  // Fallback to IP + User Agent fingerprint
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const fingerprint = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16);

  return `anon:${fingerprint}`;
}

/**
 * Validate token format
 * Must be a hex string of correct length
 */
function isValidTokenFormat(token: string): boolean {
  const config = getConfig();
  const expectedLength = config.tokenLength * 2; // hex string is 2x the byte length

  if (!token || typeof token !== 'string') {
    return false;
  }

  // Check length
  if (token.length !== expectedLength) {
    return false;
  }

  // Check hex format
  if (!/^[a-f0-9]+$/i.test(token)) {
    return false;
  }

  return true;
}

/**
 * Cleanup expired tokens from memory store
 * Should be called periodically to prevent memory leaks
 * Note: Redis handles TTL automatically
 */
export function cleanupExpiredTokens(): void {
  // Only clean memory store if Redis is not available
  if (isRedisAvailable()) {
    return; // Redis handles expiration via TTL
  }

  const config = getConfig();
  const expiryTime = config.tokenExpiryHours * 60 * 60 * 1000;
  const now = Date.now();

  let cleanedCount = 0;

  for (const [key, entry] of memoryTokenStore.entries()) {
    if (now - entry.createdAt.getTime() > expiryTime) {
      memoryTokenStore.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} expired CSRF tokens from memory`);
  }
}

// Start periodic cleanup for memory store fallback
if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupExpiredTokens, 60 * 60 * 1000); // Every hour
}

/**
 * Express middleware chain for CSRF protection
 * Combines token validation with origin checking
 */
export const csrfMiddleware = [
  validateOriginHeader,
  validateCsrfToken,
];

/**
 * Get current CSRF token from request cookies
 */
export function getCsrfTokenFromRequest(req: Request): string | undefined {
  const config = getConfig();
  return req.cookies?.[config.cookieName];
}

/**
 * Middleware to provide CSRF token to client
 * Typically called on GET requests to /csrf-token endpoint
 */
export const provideCsrfToken = (req: Request, res: Response): void => {
  const token = generateCsrfToken(req, res);
  res.json({
    success: true,
    csrfToken: token,
  });
};

export default {
  generateCsrfToken,
  validateCsrfToken,
  validateOriginHeader,
  csrfCookieOptions,
  csrfMiddleware,
  provideCsrfToken,
  getCsrfTokenFromRequest,
  cleanupExpiredTokens,
};
