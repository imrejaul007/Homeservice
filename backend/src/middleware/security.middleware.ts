import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
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
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    originAgentCluster: true,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  }),

  // Custom Permissions-Policy header (using res.setHeader since helmet may not support it directly)
  (_req: Request, res: Response, next: NextFunction) => {
    // Restrict sensitive browser features - only enable for self/origin
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=self, gyroscope=(), magnetometer=(), microphone=self, payment=self, usb=()'
    );
    next();
  },

  // CORS is configured once in app.ts (avoid duplicate preflight handlers)

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
