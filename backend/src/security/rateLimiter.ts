import rateLimit from 'express-rate-limit';

export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}) => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: true,
    skip: (req) => {
      // Skip health checks
      return req.path === '/health' || req.path === '/health/live';
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
};

// Pre-configured limiters
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  keyPrefix: 'rl:auth',
});

export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyPrefix: 'rl:api',
});

export const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: 'rl:search',
});

export const paymentLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'rl:payment',
});
