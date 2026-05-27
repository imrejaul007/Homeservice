import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import { strictRateLimiter, perUserRateLimiter } from './rateLimiter';

// Re-export rate limiters for use in app.ts
export { strictRateLimiter, perUserRateLimiter };

export const securityMiddleware = [
  // Helmet security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),

  // CORS
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://nilin.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant',
      'X-Requested-With',
      'X-Correlation-ID',
      'x-correlation-id',
      'skipAuth',
      'skipauth',
      'x-csrf-token',
      'x-2fa-token',
      'stripe-signature',
    ],
  }),

  // Prevent HTTP parameter pollution
  hpp(),

  // Request size limit
  (req: Request, res: Response, next: NextFunction): void => {
    const size = parseInt(req.headers['content-length'] || '0');
    if (size > 10 * 1024 * 1024) { // 10MB
      res.status(413).json({ error: 'Payload too large' });
      return;
    }
    next();
  },

  // Threat detection placeholder
  (_req: Request, _res: Response, next: NextFunction) => next(),
];

// Apply rate limiters to specific routes
export const applyRateLimits = (app: any) => {
  app.use('/api/auth/*', strictRateLimiter);
  app.use('/api/', perUserRateLimiter);
};
