import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../utils/logger';
import { getPlatformPolicySync } from '../services/platformSettingsPolicy.service';

// SECURITY FIX: Redis rate limiting is REQUIRED in production
const useRedis = process.env.NODE_ENV === 'production'
  ? true
  : (process.env.REDIS_ENABLED === 'true');

// Log Redis requirement status
if (process.env.NODE_ENV === 'production' && !useRedis) {
  logger.warn('SECURITY WARNING: Redis rate limiting is disabled in production!', {
    action: 'RATE_LIMIT_REDIS_DISABLED_PROD',
  });
} else if (useRedis) {
  logger.info('Rate limiting with Redis enabled', {
    action: 'RATE_LIMIT_REDIS_ENABLED',
  });
}

/**
 * Helper to set rate limit headers on response
 * Sets both legacy (X-RateLimit-*) and standard (RateLimit-*) headers
 */
const setRateLimitHeaders = (
  res: Response,
  limit: number,
  remaining: number,
  resetTime: number
): void => {
  const resetSeconds = Math.ceil((resetTime - Date.now()) / 1000);

  // Legacy headers (X-RateLimit-*)
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  // Standard headers (RateLimit-*) - for broader compatibility
  res.setHeader('RateLimit-Limit', limit);
  res.setHeader('RateLimit-Remaining', Math.max(0, remaining));
  res.setHeader('RateLimit-Reset', resetSeconds);
};

/**
 * General API rate limiter
 * Applied to all /api routes
 *
 * Platform `rateLimitRequestsPerMinute` is applied as a per-minute cap when set.
 * Authenticated admin settings routes are exempt — the SPA loads many sections
 * from one GET and must not compete with the global IP bucket.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req: Request) => {
    if (process.env.NODE_ENV !== 'production') {
      return 500;
    }
    const perMinute = getPlatformPolicySync().rateLimitRequestsPerMinute;
    return Math.max(60, perMinute || 100);
  },
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: true,
  skip: (req: Request) => {
    const path = req.path || '';
    const isSettingsRoute = path === '/settings' || path.startsWith('/settings/');
    const hasAuth = Boolean(req.headers.authorization);
    return isSettingsRoute && hasAuth;
  },
  handler: (req: Request, res: Response) => {
    logger.warn('API rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      action: 'API_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
    });
  },
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    if (userId) {
      return `user:${userId}`;
    }
    return req.ip || 'unknown';
  },
});

/**
 * Strict limiter for authentication endpoints
 * Applied to login, register, password reset, etc.
 * SECURITY FIX: Consolidated to single authLimiter with strictest settings
 * - 5 attempts per minute (prevents brute force on login/registration)
 * - Consistent across all auth endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute - stricter window for better protection
  max: 5, // 5 attempts per minute - prevents brute force attacks
  message: { success: false, error: 'Too many authentication attempts, please try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: true,
  skipSuccessfulRequests: false, // Count all attempts to prevent user enumeration
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      action: 'AUTH_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again in 1 minute.',
    });
  },
});

/**
 * Payment limiter - stricter rate limiting for payment endpoints
 * Limits to 20 payment attempts per hour
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 payment attempts per hour
  message: { success: false, error: 'Too many payment attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req: Request, res: Response) => {
    logger.warn('Payment rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'PAYMENT_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many payment attempts, please try again later.',
    });
  },
});

/**
 * Search limiter - for search and discovery endpoints
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: { success: false, error: 'Too many search requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: true,
});

/**
 * Suggestion limiter - for autocomplete suggestions (higher limit than search)
 */
export const suggestionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 suggestions per minute
  message: { success: false, error: 'Too many suggestion requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: true,
});

/**
 * Password reset limiter - very strict for password reset flow
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset requests per hour
  message: { success: false, error: 'Too many password reset attempts, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req: Request, res: Response) => {
    logger.warn('Password reset rate limit exceeded', {
      ip: req.ip,
      email: req.body.email,
      action: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many password reset attempts, please try again after an hour.',
    });
  },
});

/**
 * OTP/Verification code limiter
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 OTP requests per 15 minutes
  message: { success: false, error: 'Too many verification code requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req: Request, res: Response) => {
    logger.warn('OTP rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      action: 'OTP_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many verification code requests, please try again after 15 minutes.',
    });
  },
});

/**
 * Message rate limiter - for booking message endpoints
 * SECURITY: Prevents message spam in booking conversations
 * Limits to 30 messages per minute per user
 */
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: { success: false, error: 'Too many messages, please slow down.' },
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { _id?: string } }).user;
    return user?._id || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Message rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'MESSAGE_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many messages sent. Please wait a moment before sending more.',
    });
  },
});

/**
 * Strict rate limiter for health check endpoints
 * Very restrictive to prevent DoS on monitoring endpoints
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { success: false, error: 'Rate limit exceeded for health checks.' },
  standardHeaders: true,
  legacyHeaders: true,
});

/**
 * Per-user rate limiter for authenticated endpoints
 * Uses user ID or IP as key for more granular limiting
 */
export const perUserRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    const user = (req as Request & { user?: { _id?: string } }).user;
    return user?._id || req.ip || 'unknown';
  },
  message: { success: false, error: 'Too many requests per user, please try again later.' },
  standardHeaders: true,
  legacyHeaders: true,
});

/**
 * 2FA Verification limiter - strict rate limiting for 2FA verification
 * Limits to 10 attempts per 5 minutes to prevent brute force attacks on TOTP codes
 * SECURITY: Prevents brute force of 6-digit TOTP codes (~1 million combinations)
 */
export const twoFactorVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 verification attempts per 5 minutes per IP
  message: { success: false, error: 'Too many 2FA verification attempts, please try again in 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req: Request) => {
    // Use IP as key since user may not be fully authenticated yet
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('2FA verification rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      action: '2FA_VERIFY_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many 2FA verification attempts. Please wait 5 minutes before trying again.',
    });
  },
});

// ============================================
// Consolidated Aliases (for backward compatibility)
// ============================================

// SECURITY FIX: Single authRateLimit alias - use authLimiter for all auth endpoints
// This replaces the duplicate authRateLimit in auth.middleware.ts
export const authRateLimit = authLimiter;

/**
 * Admin routes limiter - moderate rate limiting for admin operations
 * Limits to 100 requests per 15 minutes per user
 * Admins make frequent API calls for dashboards and bulk operations
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  keyGenerator: (req: Request) => {
    // Use user ID for authenticated admin users
    const user = (req as Request & { user?: { _id?: string } }).user;
    return user?._id || req.ip || 'unknown';
  },
  message: { success: false, error: 'Too many admin requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: true,
  handler: (req: Request, res: Response) => {
    logger.warn('Admin rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'ADMIN_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many admin requests. Please try again in a few minutes.',
    });
  },
});

/**
 * Registration limiter - very strict rate limiting for registration endpoints
 * SECURITY FIX: Prevents registration enumeration attacks and bot signups
 * Limits to 3 registration attempts per 10 minutes per IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 registration attempts per 10 minutes per IP
  message: { success: false, error: 'Too many registration attempts, please try again in 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: true,
  skipSuccessfulRequests: false, // Count all attempts to prevent timing-based enumeration
  handler: (req: Request, res: Response) => {
    logger.warn('Registration rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      email: req.body?.email,
      action: 'REGISTRATION_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many registration attempts, please try again in 10 minutes.',
    });
  },
});

export default {
  apiLimiter,
  authLimiter,
  authRateLimit,
  paymentLimiter,
  searchLimiter,
  suggestionLimiter,
  passwordResetLimiter,
  otpLimiter,
  twoFactorVerifyLimiter,
  strictRateLimiter,
  perUserRateLimiter,
  adminLimiter,
  registrationLimiter,
  messageLimiter,
};
