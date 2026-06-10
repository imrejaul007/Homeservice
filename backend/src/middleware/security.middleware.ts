import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { strictRateLimiter, perUserRateLimiter } from './rateLimiter';

// Re-export rate limiters for use in app.ts
export { strictRateLimiter, perUserRateLimiter };

/**
 * CSP configuration helpers
 * - CSP_IMG_DOMAINS: comma-separated trusted image domains (e.g., unsplash.com,cloudinary.com)
 * - CSP_CONNECT_APIS: comma-separated trusted API endpoints (e.g., https://api.openai.com)
 * Usage: CSP_IMG_DOMAINS=unsplash.com CSP_CONNECT_APIS=https://api.stripe.com,https://api.openai.com npm start
 */
const getImgSrcDomains = (): string[] => {
  const isDev = process.env.NODE_ENV === 'development';
  const env = process.env.CSP_IMG_DOMAINS || '';
  return isDev
    ? ["'self'", '*', 'data:', 'blob:', 'http://localhost:*']
    : ["'self'", 'data:', 'blob:', ...(env ? env.split(',').map(d => d.trim()) : [])];
};

const getConnectSrcDomains = (): string[] => {
  const isDev = process.env.NODE_ENV === 'development';
  // In development, allow all localhost connections
  const base = isDev
    ? ["'self'", '*', 'http://localhost:*', 'ws://localhost:*']
    : ["'self'", 'https://api.stripe.com'];
  const env = process.env.CSP_CONNECT_APIS || '';
  return [...base, ...(env ? env.split(',').map(d => d.trim()) : [])];
};

// Combined security middleware - single function to avoid header ordering issues
// Helmet and Permissions-Policy are applied atomically, then hpp runs separately
export const securityMiddleware = [
  (() => {
    const isDev = process.env.NODE_ENV === 'development';

    const helmetMiddleware = helmet({
      contentSecurityPolicy: {
        directives: {
          // In development, relax CSP restrictions
          defaultSrc: isDev ? ["'self'", '*'] : ["'self'"],
          scriptSrc: isDev ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"],
          styleSrc: isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
          imgSrc: isDev ? getImgSrcDomains().concat(['*', 'data:', 'blob:']) : getImgSrcDomains(),
          connectSrc: getConnectSrcDomains(),
          fontSrc: isDev ? ["'self'", '*'] : ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: isDev ? ['*'] : ["'none'"],
          baseUri: ["'self'"],
          formAction: isDev ? ["'self'", '*'] : ["'self'"],
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
    });

    // Wrap helmet to also set Permissions-Policy atomically in the same middleware
    return (req: Request, res: Response, next: NextFunction) => {
      helmetMiddleware(req, res, (err?: any) => {
        if (err) return next(err);
        // Set Permissions-Policy immediately after helmet completes
        // This ensures no other middleware can overwrite it
        res.setHeader(
          'Permissions-Policy',
          'accelerometer=(), camera=(), geolocation=self, gyroscope=(), magnetometer=(), microphone=self, payment=self, usb=()'
        );
        next();
      });
    };
  })(),

  // CORS is configured once in app.ts (avoid duplicate preflight handlers)

  // Prevent HTTP parameter pollution
  hpp(),

  // Request size limit — only validate when a body is declared via Content-Length
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const rawSize = req.headers['content-length'];

    // GET/HEAD and other bodyless requests omit Content-Length — that is valid
    if (!rawSize) {
      return next();
    }

    const size = Number(rawSize);

    if (Number.isNaN(size) || size < 0 || !Number.isInteger(size)) {
      res.status(400).json({ error: 'Invalid content-length' });
      return;
    }

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
