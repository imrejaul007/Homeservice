import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import { stream } from './utils/logger';
import { APP_CONSTANTS } from './config/constants';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { correlationIdMiddleware } from './middleware/correlationId.middleware';
import {
  helmetConfig,
  mongoSanitizeConfig,
  perUserRateLimiter,
  strictRateLimiter,
  securityHeaders,
  uploadSizeLimit,
} from './middleware/security.middleware';
import {
  sanitizeInput,
  blockAttackPatterns,
} from './middleware/security-validation.middleware';
import {
  initializeSentry,
  sentryRequestHandler,
  sentryErrorHandler,
} from './config/sentry';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Initialize Sentry first
initializeSentry();

// Perform security audit on startup
import securityValidator from './utils/securityValidator';
securityValidator.performSecurityAudit();

// Create Express application
const app: Application = express();

// Trust proxy
app.set('trust proxy', 1);

// Sentry request handler (must be early)
app.use(sentryRequestHandler);

// Add correlation ID to all requests
app.use(correlationIdMiddleware);

// Security middleware - Helmet with strict CSP
app.use(helmetConfig);

// Additional security headers
app.use(securityHeaders);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Correlation-ID',
    'skipAuth',
    'skipauth',
    'x-csrf-token',
    'x-2fa-token',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page',
    'X-Page-Size',
    'X-Correlation-ID',
  ],
  maxAge: 86400,
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request size validation middleware
app.use(uploadSizeLimit(5));

// MongoDB sanitization (enhanced)
app.use(mongoSanitizeConfig);

// Sanitize user input
app.use(sanitizeInput);

// Block common attack patterns
app.use(blockAttackPatterns);

// HTTP request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', { stream }));
} else {
  app.use(morgan('combined', { stream }));
}

// Global rate limiting for all API routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

app.use('/api', globalLimiter);

// Per-user rate limiting (stricter for authenticated users)
app.use('/api', perUserRateLimiter);

// Health check endpoint (with strict rate limiting)
app.get('/health', strictRateLimiter, (_req: Request, res: Response) => {
  res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
    status: 'healthy',
    service: APP_CONSTANTS.APP_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: APP_CONSTANTS.API_VERSION,
  });
});

// Readiness check (for Kubernetes/Load Balancers)
app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const dbState = mongoose.connection.readyState;
    const isConnected = dbState === 1;

    if (!isConnected) {
      res.status(503).json({
        status: 'unhealthy',
        ready: false,
        checks: {
          database: 'disconnected',
        },
      });
      return;
    }

    res.json({
      status: 'healthy',
      ready: true,
      checks: {
        database: 'connected',
      },
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      ready: false,
      error: 'Health check failed',
    });
  }
});

// Liveness check
app.get('/health/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoints
import { getMetrics, getPrometheusMetrics } from './utils/metrics';
app.get('/metrics', getMetrics);
app.get('/metrics/prometheus', getPrometheusMetrics);

// API test endpoint
app.get('/api/test', (_req: Request, res: Response) => {
  res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
    success: true,
    message: 'Backend API is connected and working!',
    timestamp: new Date().toISOString(),
    api_version: APP_CONSTANTS.API_VERSION,
  });
});

// API routes
app.use('/api', routes);

// Static files (for uploaded content in development)
if (process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(APP_CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: APP_CONSTANTS.ERROR_MESSAGES.NOT_FOUND,
  });
});

// Sentry error handler (must be before other error handlers)
app.use(sentryErrorHandler);

// Global error handler
app.use(errorHandler);

export default app;
