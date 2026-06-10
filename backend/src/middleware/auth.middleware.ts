import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import User, { IUser, UserRole } from '../models/user.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { cache, cacheRedis, isRedisAvailable } from '../config/redis';
import { createAuditLog } from '../services/audit.service';
import {
  verifyToken,
  verifyRecoveryCode,
  decryptSecret,
  isValidTokenFormat,
  isValidRecoveryCodeFormat,
} from '../services/auth/2fa.service';
import { provideCsrfToken } from './csrf.middleware';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export interface JWTPayload {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  accountStatus: string;
  tokenVersion?: number;
  iat: number;
  exp: number;
}

// Session timeout configuration (in milliseconds)
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || String(30 * 24 * 60 * 60 * 1000)); // Default 30 days
const SESSION_REFRESH_THRESHOLD = parseInt(process.env.SESSION_REFRESH_THRESHOLD || String(5 * 60 * 1000)); // Refresh every 5 minutes of activity

// Core authentication middleware
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Extract token from Authorization header or cookies
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new ApiError(401, 'Access token is required for authentication');
    }

    // Verify and decode the token using ACCESS token secret
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JWTPayload;

    // Find user and check if still exists and active
    const user = await User.findById(decoded.id)
      .select('+password +tokenVersion +refreshTokens') // Include fields for security checks
      .populate('loyaltySystem.referredBy', 'firstName lastName email');

    if (!user) {
      throw new ApiError(401, 'User associated with this token no longer exists');
    }

    // Check token version for invalidation
    if (decoded.tokenVersion && decoded.tokenVersion !== (user.tokenVersion || 1)) {
      throw new ApiError(401, 'Token has been invalidated');
    }

    // Check if user account is active
    if (!user.isActive || user.isDeleted) {
      throw new ApiError(401, 'User account has been deactivated');
    }

    // Check if account is suspended
    if (user.accountStatus === 'suspended') {
      throw new ApiError(403, 'Account has been suspended. Please contact support');
    }

    // Check if account is locked due to failed login attempts
    if (user.isLocked()) {
      throw new ApiError(423, 'Account is temporarily locked due to too many failed login attempts');
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw new ApiError(401, 'Password was recently changed. Please login again');
    }

    // Session validation and refresh
    const sessionId = req.headers['x-session-id'] as string | undefined;

    // Validate session and check expiration
    if (sessionId) {
      const sessionValidation = await validateSessionWithTimeout(
        user._id.toString(),
        sessionId,
        token
      );

      if (sessionValidation.expired) {
        logger.warn('Session expired', {
          action: 'SESSION_EXPIRED',
          userId: user._id,
          sessionId,
          ip: req.ip,
        });
        throw new ApiError(401, 'Session has expired. Please login again.');
      }

      // Refresh session on activity if threshold is met
      if (sessionValidation.shouldRefresh) {
        await refreshSession(user._id.toString(), sessionId);
        logger.debug('Session refreshed on activity', {
          userId: user._id,
          sessionId,
        });
      }

      // Redis session validation if enabled
      if (process.env.REDIS_SESSION_ENABLED === 'true') {
        const sessionValid = await validateRedisSession(user._id.toString(), sessionId);
        if (!sessionValid) {
          logger.warn('Session validation failed in Redis - rejecting request', {
            userId: user._id,
            sessionId,
            ip: req.ip,
            action: 'SESSION_INVALID_REJECTED',
          });
          throw new ApiError(401, 'Session expired or invalid');
        }
      }
    }

    // Update security tracking
    await user.updateSecurityInfo(req);

    // Attach user to request object (excluding sensitive fields)
    req.user = user;
    next();

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Invalid access token');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Access token has expired');
    }
    next(error);
  }
});

/**
 * Validate session with timeout checking
 * Returns whether session is expired and if it should be refreshed
 */
async function validateSessionWithTimeout(
  userId: string,
  sessionId: string,
  token: string
): Promise<{ expired: boolean; shouldRefresh: boolean }> {
  try {
    const user = await User.findOne({
      _id: userId,
      'sessions.sessionId': sessionId,
      'sessions.token': token,
    }).select('sessions');

    if (!user || !user.sessions || user.sessions.length === 0) {
      return { expired: true, shouldRefresh: false };
    }

    const session = user.sessions.find((s: any) => s.sessionId === sessionId);

    if (!session) {
      return { expired: true, shouldRefresh: false };
    }

    const now = new Date();

    // Check if session has expired
    if (session.expiresAt && new Date(session.expiresAt) < now) {
      // Remove expired session from MongoDB
      await User.updateOne(
        { _id: userId },
        { $pull: { sessions: { sessionId } } }
      );

      // FIX: Also remove from Redis to prevent stale session data
      try {
        if (cacheRedis && isRedisAvailable()) {
          await cacheRedis.del(`session:${sessionId}`);
        }
      } catch (redisError) {
        logger.warn('Failed to delete expired session from Redis', {
          userId,
          sessionId,
          error: redisError instanceof Error ? redisError.message : String(redisError),
        });
      }

      return { expired: true, shouldRefresh: false };
    }

    // Check if session should be refreshed based on activity
    const lastActive = new Date(session.lastActive);
    const timeSinceLastActivity = now.getTime() - lastActive.getTime();
    const shouldRefresh = timeSinceLastActivity >= SESSION_REFRESH_THRESHOLD;

    return { expired: false, shouldRefresh };
  } catch (error) {
    logger.error('Session validation error', {
      userId,
      sessionId,
      error: (error as Error).message,
    });
    // Fail closed: reject session on database errors to prevent auth bypass
    return { expired: true, shouldRefresh: false };
  }
}

/**
 * Refresh session on activity
 * Updates lastActive timestamp and extends expiry
 */
async function refreshSession(userId: string, sessionId: string): Promise<void> {
  try {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30); // Extend by 30 days

    // Update session in MongoDB
    await User.updateOne(
      { _id: userId, 'sessions.sessionId': sessionId },
      {
        $set: {
          'sessions.$.lastActive': new Date(),
          'sessions.$.expiresAt': newExpiry,
        },
      }
    );

    // Update Redis session TTL if available
    if (process.env.REDIS_SESSION_ENABLED === 'true') {
      try {
        await cache.set(
          `session:${sessionId}`,
          JSON.stringify({ userId, refreshedAt: new Date().toISOString() }),
          30 * 24 * 60 * 60 // 30 days
        );
      } catch (error) {
        logger.warn('Failed to refresh Redis session TTL', { sessionId, error: (error as Error).message });
      }
    }
  } catch (error) {
    logger.error('Failed to refresh session', {
      userId,
      sessionId,
      error: (error as Error).message,
    });
  }
}

/**
 * Redis Session Store Fallback
 * Validates session in Redis for fast lookup with MongoDB as source of truth
 */
async function validateRedisSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    const cachedSession = await cache.get(`session:${sessionId}`);
    if (!cachedSession) {
      // Session not in Redis - might be new or Redis was cleared
      // Fall back to MongoDB check
      return await validateMongoSession(userId, sessionId);
    }

    const sessionData = JSON.parse(cachedSession);
    if (sessionData.userId !== userId) {
      // Session doesn't belong to this user
      return false;
    }

    // Refresh TTL on successful validation - set with new TTL
    await cache.set(`session:${sessionId}`, JSON.stringify(sessionData), 30 * 24 * 60 * 60);

    return true;
  } catch (error) {
    // Redis unavailable - fall back to MongoDB
    logger.warn('Redis session validation failed, falling back to MongoDB', { error: (error as Error).message });
    return await validateMongoSession(userId, sessionId);
  }
}

/**
 * MongoDB Session Fallback Validation
 * Validates session exists in user's sessions array and hasn't expired
 */
async function validateMongoSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    const user = await User.findOne({
      _id: userId,
      'sessions.sessionId': sessionId,
    }).select('sessions');

    if (!user) {
      return false;
    }

    const session = user.sessions.find((s: any) => s.sessionId === sessionId);
    if (!session) {
      return false;
    }

    // Check if session has expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('MongoDB session validation error', { userId, sessionId, error: (error as Error).message });
    // SECURITY FIX: Fail closed on database errors - deny access by default
    // Only allow access if we can definitively verify the session is valid
    // This prevents unauthorized access when the database is experiencing issues
    return false;
  }
}

/**
 * Store session in Redis for fast lookup
 * Called after successful authentication
 */
export async function storeRedisSession(sessionId: string, userId: string): Promise<void> {
  try {
    await cache.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId,
        createdAt: new Date().toISOString(),
      }),
      30 * 24 * 60 * 60 // 30 days TTL
    );
  } catch (error) {
    // Non-fatal - MongoDB TTL will handle cleanup
    logger.warn('Failed to store session in Redis', { sessionId, userId, error: (error as Error).message });
  }
}

/**
 * Remove session from Redis (called on logout)
 */
export async function removeRedisSession(sessionId: string): Promise<void> {
  try {
    await cache.del(`session:${sessionId}`);
  } catch (error) {
    logger.warn('Failed to remove session from Redis', { sessionId, error: (error as Error).message });
  }
}

// Optional authentication middleware (doesn't throw error if no token)
// SECURITY FIX: Now performs all critical security checks that authenticate does
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JWTPayload;

      // Find user and check if still exists and active
      const user = await User.findById(decoded.id)
        .select('+password +tokenVersion +refreshTokens');

      if (!user) {
        // User no longer exists - silently continue without user
        return next();
      }

      // SECURITY FIX: Check token version for invalidation (e.g., password reset, logout)
      if (decoded.tokenVersion && decoded.tokenVersion !== (user.tokenVersion || 1)) {
        // Token has been invalidated - silently continue without user
        logger.debug('optionalAuth: token version mismatch, ignoring token');
        return next();
      }

      // SECURITY FIX: Check if user account is active
      if (!user.isActive || user.isDeleted) {
        // Account deactivated - silently continue without user
        return next();
      }

      // SECURITY FIX: Check if account is suspended
      if (user.accountStatus === 'suspended') {
        // Account suspended - silently continue without user
        logger.debug('optionalAuth: account suspended, ignoring token');
        return next();
      }

      // SECURITY FIX: Check if account is locked due to failed login attempts
      if (user.isLocked()) {
        // Account locked - silently continue without user
        logger.debug('optionalAuth: account locked, ignoring token');
        return next();
      }

      // SECURITY FIX: Check if password was changed after token was issued
      if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
        // Password changed - silently continue without user
        logger.debug('optionalAuth: password changed since token issued, ignoring token');
        return next();
      }

      // All security checks passed - attach user to request
      req.user = user;
    }

    next();
  } catch (error) {
    // Invalid token - silently continue without user authentication
    next();
  }
});

// Role-based authorization middleware
export const requireRole = (allowedRoles: UserRole | UserRole[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  });
};

// Email verification requirement middleware
export const requireEmailVerified = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!req.user.isEmailVerified) {
    throw new ApiError(403, 'Email verification required to access this resource');
  }

  next();
});

// Account status verification middleware
export const requireAccountStatus = (requiredStatus: string | string[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const statuses = Array.isArray(requiredStatus) ? requiredStatus : [requiredStatus];
    
    if (!statuses.includes(req.user.accountStatus)) {
      throw new ApiError(403, `Account status must be one of: ${statuses.join(', ')}`);
    }

    next();
  });
};

// Resource ownership verification middleware
export const requireOwnership = (resourceUserField: string = 'userId') => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Get resource ID from params
    const resourceId = req.params.id;
    if (!resourceId) {
      throw new ApiError(400, 'Resource ID is required');
    }

    // For user resources, check if the user owns the resource
    if (resourceUserField === 'userId' && req.user._id.toString() !== resourceId) {
      throw new ApiError(403, 'Access denied. You can only access your own resources');
    }

    next();
  });
};

// Provider account exists (role + profile) — for onboarding actions like creating services
export const requireProviderAccount = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
  }

  if (req.user.role !== 'provider' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Provider access required', [], ERROR_CODES.FORBIDDEN);
  }

  if (req.user.role === 'provider') {
    const ProviderProfile = require('../models/providerProfile.model').default;
    const providerProfile = await ProviderProfile.findOne({ userId: req.user._id });

    if (!providerProfile) {
      throw new ApiError(403, 'Provider profile setup required', [], ERROR_CODES.FORBIDDEN);
    }
  }

  next();
});

// Provider-specific middleware (requires profile completion and verification)
export const requireProvider = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
  }

  if (req.user.role !== 'provider' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Provider access required', [], ERROR_CODES.FORBIDDEN);
  }

  if (req.user.role === 'provider') {
    const ProviderProfile = require('../models/providerProfile.model').default;
    const providerProfile = await ProviderProfile.findOne({ userId: req.user._id });

    if (!providerProfile) {
      throw new ApiError(403, 'Provider profile setup required', [], ERROR_CODES.FORBIDDEN);
    }

    if (!providerProfile.isProfileComplete) {
      throw new ApiError(403, 'Please complete your provider profile setup', [], ERROR_CODES.FORBIDDEN);
    }

    if (providerProfile.verificationStatus.overall !== 'approved') {
      throw new ApiError(403, 'Provider verification required', [], ERROR_CODES.FORBIDDEN);
    }
  }

  next();
});

// Rate limiting configurations
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, _res: Response) => {
      throw new ApiError(429, message || 'Too many requests, please try again later');
    }
  });
};

// Specific rate limits for different endpoints
// SECURITY FIX: Reduced from 10000 to 5 attempts per minute to prevent brute force attacks
export const authRateLimit = createRateLimit(
  1 * 60 * 1000, // 1 minute
  5, // 5 attempts per minute - reasonable for login attempts
  'Too many authentication attempts, please try again in 1 minute'
);

export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again in 15 minutes'
);

export const strictRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 requests per hour
  'Rate limit exceeded for sensitive operations'
);

// IP-based security middleware
export const checkSuspiciousActivity = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  // Issue #16: Add blocking mechanism for confirmed suspicious patterns
  // Patterns that indicate automated/suspicious access attempts
  const blockingPatterns: Array<{pattern: RegExp; severity: string}> = [
    { pattern: /^(python-requests|axios|node-fetch|curl|wget|okhttp|java|go-http|libwww|apache-httpclient)/i, severity: 'HIGH' },
    { pattern: /^(bot|crawler|spider|scraper|slurp|mediapartners|googlebot|bingbot|yandex|duckduckbot)/i, severity: 'HIGH' },
  ];

  // Patterns that indicate suspicious but may be legitimate (flag for review)
  const flagPatterns: RegExp[] = [
    /^(python|java|go|curl|wget|ruby|perl|php)/i,
    /proxy/i,
    /tor-exit/i,
  ];

  // Check for blocking patterns first (immediate block)
  const blockedPattern = blockingPatterns.find(({pattern}) => pattern.test(userAgent));
  if (blockedPattern) {
    logger.warn('Blocked suspicious request', {
      action: 'SUSPICIOUS_ACTIVITY_BLOCKED',
      severity: 'HIGH',
      ip: clientIP,
      userAgent: userAgent,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    // Return 403 Forbidden for confirmed suspicious patterns
    res.status(403).json({
      success: false,
      message: 'Access denied',
      code: 'SUSPICIOUS_ACTIVITY_BLOCKED',
    });
    return;
  }

  // Check for flag patterns (log and continue, but add to request for downstream use)
  const isFlagged = flagPatterns.some(pattern => pattern.test(userAgent));
  if (isFlagged) {
    logger.warn('Suspicious activity detected', {
      action: 'SUSPICIOUS_ACTIVITY_FLAGGED',
      severity: 'MEDIUM',
      ip: clientIP,
      userAgent: userAgent,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    // Add header to flag request for downstream processing
    req.headers['x-suspicious-flag'] = 'true';
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
});

// CSRF protection for state-changing operations
// Uses the dedicated csrf.middleware.ts implementation
// Alias for backward compatibility
export const csrfProtection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Skip for safe HTTP methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip for webhook endpoints (they use their own signature verification)
  if (req.path.includes('/webhook')) {
    return next();
  }

  // Skip for internal service-to-service calls
  if (req.headers['x-internal-service']) {
    return next();
  }

  // SECURITY FIX: Do NOT skip CSRF validation for Bearer token authenticated requests
  // Browser-based attacks (XSS, malicious iframes) can still make requests with Bearer tokens
  // CSRF tokens protect against cross-site request forgery regardless of auth method
  // Only skip for non-browser clients (mobile apps, API keys) identified by specific headers

  // Identify non-browser clients by User-Agent patterns
  const userAgent = req.get('User-Agent') || '';
  const isNonBrowserClient = (
    /^(curl|wget|postman|axios|node|python|java|ruby|go|http-client|okhttp|unirest|requests|httpx|rest-client|Apache-HttpClient|Google-HTTP|Jetty|Netty)/i.test(userAgent) ||
    req.headers['x-requested-with'] === 'XMLHttpRequest'
  );

  // Only skip CSRF for explicitly identified non-browser clients
  if (isNonBrowserClient) {
    return next();
  }

  // Use the dedicated CSRF middleware
  const { validateCsrfToken } = await import('./csrf.middleware');
  return validateCsrfToken(req, res, next);
});

// Deprecated: Use provideCsrfToken from csrf.middleware instead
export const getCsrfToken = (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    message: 'Use GET /api/auth/csrf-token to obtain CSRF token',
    code: 'DEPRECATED',
  });
};

// Audit logging middleware
export const auditLog = (action: string) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Store original send
    const originalSend = req.res?.send;

    // Hook into response finish event to capture final status
    req.res?.on('finish', async () => {
      const duration = Date.now() - startTime;
      const status = req.res?.statusCode || 500;

      try {
        // Create audit log entry
        await createAuditLog({
          userId: req.user?._id?.toString() || 'anonymous',
          action,
          resource: req.originalUrl,
          resourceId: req.params.id,
          details: {
            method: req.method,
            duration,
            statusCode: status,
            query: req.query,
            // Exclude sensitive body fields
            bodyFields: req.method !== 'GET' ? Object.keys(req.body || {}) : undefined
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          status: status < 400 ? 'success' : 'failure',
        });
      } catch (error) {
        logger.error('Failed to create audit log', { error: (error as Error).message, action });
      }
    });

    next();
  });
};

// Device tracking middleware
export const trackDevice = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (req.user) {
    const deviceFingerprint = {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      acceptLanguage: req.get('Accept-Language'),
      acceptEncoding: req.get('Accept-Encoding')
    };

    // Store device info for security monitoring
    // You could implement device tracking and alert on new devices
    // Type assertion to extended interface (non-persisted tracking data)
    const userWithDevice = req.user as IUser & { deviceFingerprint: typeof deviceFingerprint };
    userWithDevice.deviceFingerprint = deviceFingerprint;
  }

  next();
});

// Two-factor authentication middleware (complete implementation)
export const require2FA = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Check if 2FA is enabled for this user
  const twoFactorEnabled = req.user.twoFactor?.enabled === true;

  if (!twoFactorEnabled) {
    // 2FA not enabled, skip verification
    return next();
  }

  // Check for trusted device
  const deviceId = req.headers['x-device-id'] as string | undefined;

  if (deviceId) {
    const trustedDevice = req.user.twoFactor?.trustedDevices?.find(
      d => d.deviceId === deviceId
    );

    if (trustedDevice) {
      // Update last used timestamp
      trustedDevice.lastUsed = new Date();
      await req.user.save({ validateBeforeSave: false });

      logger.info('2FA bypass for trusted device', {
        userId: req.user._id,
        deviceId,
      });

      return next();
    }
  }

  // Get 2FA token from header
  const twoFactorToken = req.headers['x-2fa-token'] as string | undefined;

  if (!twoFactorToken) {
    throw new ApiError(403, 'Two-factor authentication required. Please provide your 2FA code.');
  }

  // Check if this is a recovery code
  if (isValidRecoveryCodeFormat(twoFactorToken)) {
    // Fetch user with recovery codes
    const userWithCodes = await User.findById(req.user._id).select('+twoFactor.recoveryCodes');

    if (!userWithCodes?.twoFactor?.recoveryCodes || userWithCodes.twoFactor.recoveryCodes.length === 0) {
      throw new ApiError(403, '2FA recovery codes not configured or exhausted');
    }

    // First verify the code exists
    const normalizedToken = twoFactorToken.toUpperCase().replace(/[\s-]/g, '');
    let codeFound = false;

    for (const hashedCode of userWithCodes.twoFactor.recoveryCodes) {
      const isMatch = await bcrypt.compare(normalizedToken, hashedCode);
      if (isMatch) {
        codeFound = true;
        break;
      }
    }

    if (!codeFound) {
      throw new ApiError(403, 'Invalid recovery code');
    }

    // Race condition fix: Use atomic findOneAndUpdate with optimistic locking.
    // This ensures only ONE concurrent request can consume a given recovery code.
    // The update succeeds only if the specific hashed code is still present.
    const currentVersion = userWithCodes.twoFactor.recoveryCodesVersion || 0;
    const newVersion = currentVersion + 1;

    // Build filter: must match user AND the code must still exist in array
    // This prevents race conditions where two concurrent requests both think
    // they have a valid code - only the first to complete the atomic update wins
    const atomicFilter: any = {
      _id: req.user._id,
      'twoFactor.recoveryCodes': { $exists: true, $ne: [] },
    };

    // Include the matched code in the filter to make it truly atomic per-code
    for (const hashedCode of userWithCodes.twoFactor.recoveryCodes) {
      const isMatch = await bcrypt.compare(normalizedToken, hashedCode);
      if (isMatch) {
        atomicFilter['twoFactor.recoveryCodes'] = hashedCode;
        break;
      }
    }

    const atomicUpdate: any = {
      $pull: { 'twoFactor.recoveryCodes': atomicFilter['twoFactor.recoveryCodes'] },
      $set: { 'twoFactor.recoveryCodesVersion': newVersion },
    };

    const updateResult = await User.findOneAndUpdate(
      atomicFilter,
      atomicUpdate,
      { new: true }
    );

    if (!updateResult) {
      // Atomic update failed - code was already consumed by a concurrent request
      logger.warn('2FA recovery code race condition prevented', {
        userId: req.user._id,
        action: 'RACE_CONDITION_BLOCKED',
      });
      throw new ApiError(403, 'Recovery code already used or invalid');
    }

    // Update succeeded - code was atomically consumed
    const codesRemaining = (updateResult.twoFactor as any)?.recoveryCodes?.length ?? 0;

    // Warn when codes < 3 remaining
    if (codesRemaining > 0 && codesRemaining < 3) {
      logger.warn('2FA recovery codes running low', {
        userId: req.user._id,
        codesRemaining,
        warning: 'User should generate new recovery codes',
        action: 'LOW_RECOVERY_CODES',
      });
    }

    // When all codes exhausted, set needsReenrollment flag
    if (codesRemaining === 0) {
      logger.error('SECURITY_ALERT: All 2FA recovery codes exhausted', {
        userId: req.user._id,
        email: updateResult.email,
        action: 'ALL_RECOVERY_CODES_EXHAUSTED',
        requiresReenrollment: true,
      });

      await User.updateOne(
        { _id: req.user._id },
        { $set: { 'twoFactor.needsReenrollment': true } }
      );
    }

    logger.info('2FA verified via recovery code (atomic)', { userId: req.user._id, codesRemaining });

    return next();
  }

  // Validate token format
  if (!isValidTokenFormat(twoFactorToken)) {
    throw new ApiError(400, 'Invalid 2FA token format. Must be a 6 or 8 digit number.');
  }

  // Decrypt and verify the secret
  const userWithSecret = await User.findById(req.user._id).select('+twoFactor.secret');

  if (!userWithSecret?.twoFactor?.secret) {
    throw new ApiError(403, '2FA secret not configured');
  }

  let decryptedSecret: string;
  try {
    decryptedSecret = decryptSecret(userWithSecret.twoFactor.secret);
  } catch (error) {
    logger.error('Failed to decrypt 2FA secret', { userId: req.user._id });
    throw new ApiError(500, '2FA verification failed. Please contact support.');
  }

  // Verify the TOTP token
  const isValidToken = verifyToken(decryptedSecret, twoFactorToken);

  if (!isValidToken) {
    throw new ApiError(403, 'Invalid 2FA code. Please try again or use a recovery code.');
  }

  // Update last verified timestamp
  userWithSecret.twoFactor.lastVerified = new Date();
  await userWithSecret.save({ validateBeforeSave: false });

  logger.info('2FA verified successfully', { userId: req.user._id });

  return next();
});

// Middleware to skip 2FA for specific routes or conditions
export const skip2FAIfTrusted = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  // Check if this is a trusted device request
  const deviceId = req.headers['x-device-id'] as string | undefined;

  if (!deviceId) {
    return next();
  }

  // Mark that we're skipping 2FA for this request
  (req as any).skip2FAForTrustedDevice = true;

  return next();
});

// Middleware to enable 2FA for a user (setup flow)
export const setup2FA = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const { enable } = req.body;

  if (enable === true && !req.user.twoFactor?.enabled) {
    // Enable 2FA - user must provide valid token first
    const twoFactorToken = req.headers['x-2fa-token'] as string;

    if (!twoFactorToken) {
      throw new ApiError(400, '2FA token required to enable 2FA');
    }

    // Verify the token before enabling
    const userWithSecret = await User.findById(req.user._id).select('+twoFactor.secret');

    if (userWithSecret?.twoFactor?.secret) {
      let decryptedSecret: string;
      try {
        decryptedSecret = decryptSecret(userWithSecret.twoFactor.secret);
      } catch {
        throw new ApiError(500, '2FA setup failed');
      }

      if (!verifyToken(decryptedSecret, twoFactorToken)) {
        throw new ApiError(400, 'Invalid 2FA code');
      }
    }
  }

  return next();
});

// Middleware to add trusted device after successful 2FA
export const addTrustedDevice = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  const deviceId = req.headers['x-device-id'] as string | undefined;
  const deviceName = req.headers['x-device-name'] as string | undefined;
  const trustDevice = req.headers['x-trust-device'] === 'true';

  if (!deviceId || !trustDevice) {
    return next();
  }

  // Check if device already trusted
  const existingDevice = req.user.twoFactor?.trustedDevices?.find(d => d.deviceId === deviceId);

  if (!existingDevice) {
    // Add new trusted device
    if (!req.user.twoFactor) {
      req.user.twoFactor = {
        enabled: true,
        backupEnabled: true,
        trustedDevices: [],
      };
    }

    if (!req.user.twoFactor.trustedDevices) {
      req.user.twoFactor.trustedDevices = [];
    }

    req.user.twoFactor.trustedDevices.push({
      deviceId,
      deviceName: deviceName || 'Unknown Device',
      addedAt: new Date(),
      lastUsed: new Date(),
    });

    await req.user.save({ validateBeforeSave: false });

    logger.info('New device added to trusted devices', {
      userId: req.user._id,
      deviceId,
      deviceName,
    });
  } else {
    // Update last used
    existingDevice.lastUsed = new Date();
    await req.user.save({ validateBeforeSave: false });
  }

  return next();
});

// Middleware to remove trusted device
export const removeTrustedDevice = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  const deviceId = req.params.deviceId;

  if (!deviceId) {
    return next();
  }

  if (req.user.twoFactor?.trustedDevices) {
    const deviceIndex = req.user.twoFactor.trustedDevices.findIndex(d => d.deviceId === deviceId);

    if (deviceIndex !== -1) {
      req.user.twoFactor.trustedDevices.splice(deviceIndex, 1);
      await req.user.save({ validateBeforeSave: false });

      logger.info('Device removed from trusted devices', {
        userId: req.user._id,
        deviceId,
      });
    }
  }

  return next();
});

// ============================================
// 2FA Enforcement for Sensitive Operations
// ============================================

/**
 * Payment threshold for requiring 2FA
 * Amounts above this threshold will require 2FA verification
 */
const PAYMENT_2FA_THRESHOLD = parseFloat(process.env.PAYMENT_2FA_THRESHOLD || '100'); // Default 100 AED

/**
 * Require 2FA for high-value payments
 * Use this middleware for payment endpoints that exceed the threshold
 */
export const require2FAForPayment = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Check if 2FA is enabled for this user
  const twoFactorEnabled = req.user.twoFactor?.enabled === true;

  if (!twoFactorEnabled) {
    // 2FA not enabled, skip verification
    return next();
  }

  // Get payment amount from request
  const amount = parseFloat(req.body.amount || req.body.totalAmount || req.body.price || '0');

  // If amount exceeds threshold, require 2FA
  if (amount >= PAYMENT_2FA_THRESHOLD) {
    logger.info('High-value payment detected, requiring 2FA', {
      action: 'PAYMENT_2FA_REQUIRED',
      userId: req.user._id,
      amount,
      threshold: PAYMENT_2FA_THRESHOLD,
    });

    // Use the require2FA middleware logic
    return require2FA(req, _res, next);
  }

  return next();
});

/**
 * Require 2FA for any payment (regardless of amount)
 * Use this for critical payment operations like withdrawals
 */
export const require2FAForAnyPayment = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Check if 2FA is enabled for this user
  const twoFactorEnabled = req.user.twoFactor?.enabled === true;

  if (!twoFactorEnabled) {
    // 2FA not enabled, skip verification
    return next();
  }

  logger.info('Payment operation requiring 2FA', {
    action: 'PAYMENT_OPERATION_2FA_REQUIRED',
    userId: req.user._id,
    endpoint: req.path,
    method: req.method,
  });

  // Use the require2FA middleware logic
  return require2FA(req, _res, next);
});

/**
 * Require 2FA for profile changes
 * Use this middleware for sensitive profile operations
 */
export const require2FAForProfileChange = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Check if 2FA is enabled for this user
  const twoFactorEnabled = req.user.twoFactor?.enabled === true;

  if (!twoFactorEnabled) {
    // 2FA not enabled, skip verification
    return next();
  }

  // List of sensitive profile fields that require 2FA
  const sensitiveFields = [
    'email', 'phone', 'password', 'address',
    'bankAccount', 'paymentMethod', 'twoFactor',
    'dateOfBirth', 'firstName', 'lastName',
  ];

  const requestFields = Object.keys(req.body || {});
  const hasSensitiveField = requestFields.some(field =>
    sensitiveFields.some(sensitive => field.toLowerCase().includes(sensitive.toLowerCase()))
  );

  if (hasSensitiveField) {
    logger.info('Sensitive profile change requiring 2FA', {
      action: 'PROFILE_CHANGE_2FA_REQUIRED',
      userId: req.user._id,
      fields: requestFields.filter(f =>
        sensitiveFields.some(s => f.toLowerCase().includes(s.toLowerCase()))
      ),
    });

    // Use the require2FA middleware logic
    return require2FA(req, _res, next);
  }

  return next();
});

/**
 * Require 2FA for withdrawal requests
 * Always require 2FA for withdrawals regardless of amount
 */
export const require2FAForWithdrawal = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Check if 2FA is enabled for this user
  const twoFactorEnabled = req.user.twoFactor?.enabled === true;

  if (!twoFactorEnabled) {
    // 2FA not enabled, skip verification but log warning
    logger.warn('Withdrawal request without 2FA enabled', {
      action: 'WITHDRAWAL_NO_2FA',
      userId: req.user._id,
      endpoint: req.path,
    });
    return next();
  }

  logger.info('Withdrawal request requiring 2FA', {
    action: 'WITHDRAWAL_2FA_REQUIRED',
    userId: req.user._id,
    endpoint: req.path,
  });

  // Use the require2FA middleware logic
  return require2FA(req, _res, next);
});

/**
 * Require 2FA for provider earnings withdrawal
 * Always require 2FA for provider payout requests
 */
export const require2FAForProviderWithdrawal = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Only applies to providers
  if (req.user.role !== 'provider' && req.user.role !== 'admin') {
    return next();
  }

  // Check if 2FA is enabled for this user
  const twoFactorEnabled = req.user.twoFactor?.enabled === true;

  if (!twoFactorEnabled) {
    // 2FA not enabled, skip verification but log warning
    logger.warn('Provider withdrawal request without 2FA enabled', {
      action: 'PROVIDER_WITHDRAWAL_NO_2FA',
      userId: req.user._id,
      endpoint: req.path,
    });
    return next();
  }

  logger.info('Provider withdrawal request requiring 2FA', {
    action: 'PROVIDER_WITHDRAWAL_2FA_REQUIRED',
    userId: req.user._id,
    endpoint: req.path,
  });

  // Use the require2FA middleware logic
  return require2FA(req, _res, next);
});

/**
 * Check if device is trusted (helper for 2FA trusted device validation)
 * SECURITY FIX: Removed x-skip-2fa-trusted bypass header
 */
async function isTrustedDevice(req: Request): Promise<boolean> {
  const deviceId = req.headers['x-device-id'] as string | undefined;

  if (!deviceId) {
    return false;
  }

  const trustedDevice = req.user?.twoFactor?.trustedDevices?.find(
    d => d.deviceId === deviceId
  );

  return !!trustedDevice;
}

// ============================================
// HTTP-Only Cookie Authentication Helpers
// ============================================

/**
 * Cookie options for HTTP-only access token
 */
export const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 3600000, // 1 hour
});

/**
 * Set HTTP-only access token cookie for web clients
 * Call this after successful authentication/login
 */
export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie('accessToken', token, getAccessTokenCookieOptions());
};

/**
 * Clear the access token cookie (logout)
 */
export const clearAuthCookie = (res: Response): void => {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};

/**
 * Logout handler - clears auth cookies
 */
export const logout = (req: Request, res: Response) => {
  clearAuthCookie(res);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

export default {
  authenticate,
  optionalAuth,
  requireRole,
  requireEmailVerified,
  requireAccountStatus,
  requireOwnership,
  requireProvider,
  requireProviderAccount,
  authRateLimit,
  generalRateLimit,
  strictRateLimit,
  checkSuspiciousActivity,
  csrfProtection,
  provideCsrfToken,
  auditLog,
  trackDevice,
  require2FA,
  skip2FAIfTrusted,
  setup2FA,
  addTrustedDevice,
  removeTrustedDevice,
  setAuthCookie,
  clearAuthCookie,
  logout,
  storeRedisSession,
  removeRedisSession,
  // 2FA Enforcement for Sensitive Operations
  require2FAForPayment,
  require2FAForAnyPayment,
  require2FAForProfileChange,
  require2FAForWithdrawal,
  require2FAForProviderWithdrawal,
};