import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

/**
 * Enhanced Helmet configuration for production security
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      blockAllMixedContent: [],
      childSrc: ["'self'", 'https://js.stripe.com'],
      connectSrc: ["'self'", 'https://api.stripe.com', 'https://api.resend.com'],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      frameSrc: ["'self'", 'https://js.stripe.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      manifestSrc: ["'self'"],
      mediaSrc: ["'self'", 'https:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'sameorigin' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

/**
 * MongoDB Sanitization middleware
 */
export const mongoSanitizeConfig = mongoSanitize({
  onSanitize: (params: { key: string; req: Request }) => {
    logger.warn('Potential NoSQL injection attempt detected', {
      key: params.key,
      path: params.req.path,
      action: 'NOSQL_INJECTION_ATTEMPT',
    });
  },
});

/**
 * Per-user rate limiting (stricter for authenticated users)
 */
export const perUserRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { _id?: { toString: () => string } } }).user;
    return user?._id?.toString() || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userId: (req as Request & { user?: { _id?: { toString: () => string } } }).user?._id?.toString(),
      path: req.path,
      action: 'RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(15 * 60),
    });
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Strict rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      action: 'STRICT_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests to this endpoint. Please slow down.',
    });
  },
});

/**
 * Auth-specific rate limiter (login, register, password reset)
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      action: 'AUTH_RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json({
      success: false,
      message: 'Too many failed attempts. Please try again after an hour.',
    });
  },
});

/**
 * Upload size limit middleware
 */
export const uploadSizeLimit = (maxSizeMB: number = 5) => {
  const maxSize = maxSizeMB * 1024 * 1024;
  return (req: Request, _res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSize) {
      logger.warn('Upload size exceeded', {
        ip: req.ip,
        contentLength,
        maxSize,
        action: 'UPLOAD_SIZE_EXCEEDED',
      });
      return next(new ApiError(413, `Request body too large. Maximum size is ${maxSizeMB}MB`));
    }

    next();
  };
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(timeout, () => {
      logger.warn('Request timeout', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        action: 'REQUEST_TIMEOUT',
      });
      res.status(408).json({
        success: false,
        message: 'Request timeout. Please try again.',
      });
    });

    next();
  };
};

/**
 * Security headers middleware (additional to Helmet)
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

export default {
  helmetConfig,
  mongoSanitizeConfig,
  perUserRateLimiter,
  strictRateLimiter,
  authRateLimiter,
  uploadSizeLimit,
  requestTimeout,
  securityHeaders,
};
