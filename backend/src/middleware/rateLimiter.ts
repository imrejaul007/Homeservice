import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response } from 'express';
import logger from '../utils/logger';
import { getPlatformPolicySync } from '../services/platformSettingsPolicy.service';
import { redis, isRedisAvailable } from '../config/redis';

const isProduction = process.env.NODE_ENV === 'production';

// Redis-backed limits only in production — dev uses in-memory so HMR/restarts reset buckets
const useRedis = isProduction;

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
 * Create Redis store for rate limiting
 * Falls back to undefined (in-memory) if Redis is not available
 */
const createRedisStore = (): InstanceType<typeof RedisStore> | undefined => {
  if (!useRedis || !redis || !isRedisAvailable()) {
    logger.debug('Using in-memory store for rate limiting', {
      action: 'RATE_LIMIT_MEMORY_STORE',
    });
    return undefined;
  }

  try {
    // Create Redis store with ioredis client
    const redisClient = redis;
    const store = new RedisStore({
      sendCommand: async (...args: string[]): Promise<boolean | number | string | Array<boolean | number | string>> => {
        // Use ioredis's call method with spread args, all args must be strings
        const result = await (redisClient as { call: (cmd: string, ...args: string[]) => Promise<unknown> }).call(args[0], ...args.slice(1));
        return result as boolean | number | string | Array<boolean | number | string>;
      },
      prefix: 'rl:',
    });

    logger.info('Redis store configured for rate limiting', {
      action: 'RATE_LIMIT_REDIS_STORE_CREATED',
    });

    return store;
  } catch (error) {
    logger.warn('Failed to create Redis store for rate limiting, falling back to memory', {
      action: 'RATE_LIMIT_REDIS_STORE_FAILED',
      error: (error as Error).message,
    });
    return undefined;
  }
};

// Create the Redis store once at module load time
const redisStore = createRedisStore();

// Base options shared by all rate limiters
const baseRateLimitOptions = {
  standardHeaders: true,
  legacyHeaders: true,
  store: redisStore,
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
  ...baseRateLimitOptions,
  windowMs: 60 * 1000,
  max: (req: Request) => {
    if (process.env.NODE_ENV !== 'production') {
      return 500;
    }
    try {
      const policy = getPlatformPolicySync();
      const perMinute = policy.rateLimitRequestsPerMinute;
      return Math.max(60, perMinute || 100);
    } catch (error) {
      logger.error('Failed to get platform policy for rate limiting, using fallback', {
        action: 'RATE_LIMIT_POLICY_FALLBACK',
        error: (error as Error).message,
      });
      return 100; // Safe fallback - allows reasonable requests per minute
    }
  },
  message: { success: false, error: 'Too many requests, please try again later.' },
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
    const userId = (req as Request & { user?: { _id?: string } }).user?._id;
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
  ...baseRateLimitOptions,
  windowMs: 60 * 1000, // 1 minute - stricter window for better protection
  max: isProduction ? 5 : 100, // Relaxed in dev for SPA boot + StrictMode double-mounts
  message: { success: false, error: 'Too many authentication attempts, please try again in 1 minute.' },
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
  ...baseRateLimitOptions,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 payment attempts per hour
  message: { success: false, error: 'Too many payment attempts, please try again later.' },
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
  ...baseRateLimitOptions,
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: { success: false, error: 'Too many search requests, please slow down.' },
});

/**
 * Suggestion limiter - for autocomplete suggestions (higher limit than search)
 */
export const suggestionLimiter = rateLimit({
  ...baseRateLimitOptions,
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 suggestions per minute
  message: { success: false, error: 'Too many suggestion requests, please try again later.' },
});

/**
 * Password reset limiter - very strict for password reset flow
 */
export const passwordResetLimiter = rateLimit({
  ...baseRateLimitOptions,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset requests per hour
  message: { success: false, error: 'Too many password reset attempts, please try again after an hour.' },
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
  ...baseRateLimitOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 OTP requests per 15 minutes
  message: { success: false, error: 'Too many verification code requests, please try again later.' },
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
  ...baseRateLimitOptions,
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: { success: false, error: 'Too many messages, please slow down.' },
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
  ...baseRateLimitOptions,
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { success: false, error: 'Rate limit exceeded for health checks.' },
});

/**
 * Per-user rate limiter for authenticated endpoints
 * Uses user ID or IP as key for more granular limiting
 */
export const perUserRateLimiter = rateLimit({
  ...baseRateLimitOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 200 : 10_000, // SPA boot fires many parallel reads in dev
  skip: () => !isProduction, // Global limiter is enough locally; avoids 429 on refresh
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    const user = (req as Request & { user?: { _id?: string } }).user;
    return user?._id || req.ip || 'unknown';
  },
  message: { success: false, error: 'Too many requests per user, please try again later.' },
});

/**
 * 2FA Verification limiter - strict rate limiting for 2FA verification
 * Limits to 10 attempts per 5 minutes to prevent brute force attacks on TOTP codes
 * SECURITY: Prevents brute force of 6-digit TOTP codes (~1 million combinations)
 */
export const twoFactorVerifyLimiter = rateLimit({
  ...baseRateLimitOptions,
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 verification attempts per 5 minutes per IP
  message: { success: false, error: 'Too many 2FA verification attempts, please try again in 5 minutes.' },
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
  ...baseRateLimitOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  keyGenerator: (req: Request) => {
    // Use user ID for authenticated admin users
    const user = (req as Request & { user?: { _id?: string } }).user;
    return user?._id || req.ip || 'unknown';
  },
  message: { success: false, error: 'Too many admin requests, please try again later.' },
  handler: (req: Request, res: Response) => {
    logger.warn('Admin rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'ADMIN_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many admin requests. Please wait a few minutes.',
    });
  },
});

/**
 * Registration limiter - very strict rate limiting for registration endpoints
 * SECURITY FIX: Prevents registration enumeration attacks and bot signups
 * Limits to 3 registration attempts per 10 minutes per IP
 */
/**
 * Contact form limiter — prevents spam and abuse on public contact submissions
 * Limits to 5 submissions per hour per IP
 */
export const contactFormLimiter = rateLimit({
  ...baseRateLimitOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many contact form submissions. Please try again later or call us directly.' },
  handler: (req: Request, res: Response) => {
    logger.warn('Contact form rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      action: 'CONTACT_FORM_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many contact form submissions. Please try again later or call us directly.',
    });
  },
});

export const registrationLimiter = rateLimit({
  ...baseRateLimitOptions,
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 registration attempts per 10 minutes per IP
  message: { success: false, error: 'Too many registration attempts, please try again in 10 minutes.' },
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

/**
 * Offer claim limiter - for claiming special offers
 * Prevents abuse and race conditions on claim endpoint
 * FIX: Reduced from 10 to 5 claims per minute per user for better abuse prevention
 */
export const offerClaimLimiter = rateLimit({
  ...baseRateLimitOptions,
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Reduced from 10 to 5 claim attempts per minute
  message: { success: false, error: 'Too many offer claim attempts, please try again later.' },
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { _id?: string } }).user;
    return user?._id || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Offer claim rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'OFFER_CLAIM_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many offer claim attempts. Please wait a moment before trying again.',
    });
  },
});

/**
 * Offer validation limiter - for validating promo codes
 * Prevents coupon code brute-forcing attacks
 * SECURITY FIX (SEC-001): Configurable via environment variable
 * After consecutive failures, blocks for time window
 */
export const offerValidateLimiter = rateLimit({
  ...baseRateLimitOptions,
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.OFFER_VALIDATE_RATE_LIMIT || '10'), // Default 10/min, configurable
  message: { success: false, error: 'Too many promo code validation attempts, please slow down.' },
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { _id?: string } }).user;
    // Use IP as fallback if user not authenticated (for guest validation attempts)
    return user?._id || req.ip || 'unknown';
  },
  // After consecutive failures, block for time window
  skipSuccessfulRequests: false, // Count all attempts including failures
  handler: (req: Request, res: Response) => {
    logger.warn('Offer validation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: (req as Request & { user?: { _id?: string } }).user?._id,
      action: 'OFFER_VALIDATE_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      error: 'Too many promo code validation attempts. Please wait a moment.',
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
  contactFormLimiter,
  messageLimiter,
  offerClaimLimiter,
  offerValidateLimiter,
};
