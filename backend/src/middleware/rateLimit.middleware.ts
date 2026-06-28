/**
 * Rate Limit Middleware
 * Provides configurable rate limiting with Redis support
 * Handles rate limit exceeded scenarios with proper error responses
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import logger from '../utils/logger';
import { redis, isRedisAvailable } from '../config/redis';
import { apiRateLimit } from '../utils/apiResponse';

const isProduction = process.env.NODE_ENV === 'production';

// Use Redis-backed limits in production for distributed rate limiting
const useRedis = isProduction;

/**
 * Create Redis store for rate limiting
 * Falls back to in-memory store if Redis is unavailable
 */
const createRedisStore = (): InstanceType<typeof RedisStore> | undefined => {
  if (!useRedis || !redis || !isRedisAvailable()) {
    logger.debug('Using in-memory store for rate limiting');
    return undefined;
  }

  try {
    const redisClient = redis;
    const store = new RedisStore({
      sendCommand: async (...args: string[]): Promise<boolean | number | string | Array<boolean | number | string>> => {
        const result = await (redisClient as { call: (cmd: string, ...args: string[]) => Promise<unknown> }).call(args[0], ...args.slice(1));
        return result as boolean | number | string | Array<boolean | number | string>;
      },
      prefix: 'rl:',
    });
    return store;
  } catch (error) {
    logger.warn('Failed to create Redis store for rate limiting', {
      error: (error as Error).message,
    });
    return undefined;
  }
};

const redisStore = createRedisStore();

// Base options shared by all rate limiters
const baseRateLimitOptions = {
  standardHeaders: true,
  legacyHeaders: true,
  store: redisStore,
};

/**
 * Generic rate limit middleware factory
 * @param options - Rate limit configuration
 * @param options.windowMs - Time window in milliseconds
 * @param options.max - Maximum requests per window
 * @param options.message - Custom error message
 * @param options.keyGenerator - Custom key generator function
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    ...baseRateLimitOptions,
    windowMs: options.windowMs,
    max: options.max,
    message: { success: false, error: options.message || 'Too many requests, please try again later.' },
    keyGenerator: options.keyGenerator || ((req: Request) => {
      const userId = (req as Request & { user?: { _id?: string } }).user?._id;
      return userId || req.ip || 'unknown';
    }),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userId: (req as Request & { user?: { _id?: string } }).user?._id,
        action: 'RATE_LIMIT_EXCEEDED',
      });
      apiRateLimit(res, options.message || 'Too many requests, please try again later.');
    },
  });
};

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login/registration
 * 5 attempts per minute
 */
export const authRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: isProduction ? 5 : 100,
  message: 'Too many authentication attempts, please try again in 1 minute.',
  skipSuccessfulRequests: false,
});

/**
 * API rate limiter for general endpoints
 * 100 requests per minute (adjustable via platform settings)
 */
export const apiRequestRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: isProduction ? 100 : 500,
  message: 'Too many API requests, please slow down.',
  skipSuccessfulRequests: false,
});

/**
 * Payment rate limiter
 * 20 payment attempts per hour
 */
export const paymentRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many payment attempts, please try again later.',
});

/**
 * Search rate limiter
 * 30 searches per minute
 */
export const searchRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many search requests, please slow down.',
});

/**
 * Registration rate limiter
 * 3 registrations per 10 minutes per IP
 */
export const registrationRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: 'Too many registration attempts, please try again in 10 minutes.',
  skipSuccessfulRequests: false,
});

/**
 * Password reset rate limiter
 * 5 reset attempts per hour
 */
export const passwordResetRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many password reset attempts, please try again after an hour.',
});

/**
 * 2FA verification rate limiter
 * 10 verification attempts per 5 minutes
 */
export const twoFactorRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many 2FA verification attempts, please try again in 5 minutes.',
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

/**
 * Contact form rate limiter
 * 5 submissions per hour per IP
 */
export const contactFormRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many contact form submissions, please try again later.',
});

/**
 * Message rate limiter
 * 30 messages per minute per user
 */
export const messageRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many messages sent, please slow down.',
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { _id?: string } }).user;
    return user?._id || req.ip || 'unknown';
  },
});

/**
 * Admin routes rate limiter
 * 100 requests per 15 minutes
 */
export const adminRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many admin requests, please try again later.',
});

/**
 * Offer validation rate limiter
 * Prevents coupon code brute-forcing
 */
export const offerValidateRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.OFFER_VALIDATE_RATE_LIMIT || '10'),
  message: 'Too many promo code validation attempts, please slow down.',
});

/**
 * Per-user rate limiter for authenticated endpoints
 */
export const perUserRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 200 : 10000,
  message: 'Too many requests per user, please try again later.',
  skipSuccessfulRequests: true,
});

/**
 * Public booking track rate limiter
 * Prevents enumeration of booking numbers
 */
export const publicBookingTrackRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: isProduction ? 20 : 100,
  message: 'Too many tracking requests, please try again later.',
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

/**
 * Guest booking creation rate limiter
 */
export const guestBookingRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: isProduction ? 10 : 50,
  message: 'Too many guest booking attempts, please try again later.',
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

// Export all rate limiters
export default {
  createRateLimiter,
  authRateLimit,
  apiRequestRateLimit,
  paymentRateLimit,
  searchRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  twoFactorRateLimit,
  contactFormRateLimit,
  messageRateLimit,
  adminRateLimit,
  offerValidateRateLimit,
  perUserRateLimit,
  publicBookingTrackRateLimit,
  guestBookingRateLimit,
};
