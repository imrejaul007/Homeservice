import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import cluster from 'cluster';
import os from 'os';

import { stream } from './utils/logger';
import logger from './utils/logger';
import { APP_CONSTANTS } from './config/constants';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { correlationIdMiddleware } from './middleware/correlationId.middleware';
import { requestTimeout } from './middleware/timeout.middleware';
import {
  healthCheckHandler,
  livenessProbe,
  readinessProbe,
  circuitBreakerHeaders,
  resetCircuitBreakers,
} from './middleware/resilience.middleware';
import { securityMiddleware, applyRateLimits, strictRateLimiter, perUserRateLimiter } from './middleware/security.middleware';
import {
  sanitizeInput,
  blockAttackPatterns,
} from './middleware/security-validation.middleware';
import {
  initializeSentry,
  sentryRequestHandler,
  sentryErrorHandler,
} from './config/sentry';
import { checkRedisConnection } from './config/redis';
import { featureFlagsMiddleware } from './services/featureFlags.service';
import healthRoutes from './routes/health.routes';
import aiMonitoringRoutes from './routes/aiMonitoring.routes';
import errorTrackingRoutes from './routes/errorTracking.routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { initializeMonitoring, shutdownMonitoring } from './monitoring';

// FIX: Import and initialize workflows to connect them to the event bus
// These modules self-register their event listeners when imported
import './workflows/bookingWorkflow';
import './workflows/paymentWorkflow';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Initialize Sentry first
initializeSentry();

// Initialize monitoring system
initializeMonitoring();

// Perform security audit on startup
import securityValidator from './utils/securityValidator';
securityValidator.performSecurityAudit();

// Create Express application
const app: Application = express();

// Trust proxy
app.set('trust proxy', 1);

function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || [];
  const corsOrigins = process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN.trim()] : [];
  const isProduction = process.env.NODE_ENV === 'production';
  const localhostOrigins = isProduction
    ? []
    : ['http://localhost:3000', 'http://localhost:5173'];

  return [...new Set([...origins, ...corsOrigins, ...localhostOrigins])];
}

const allowedOrigins = getAllowedOrigins();

// CORS preflight handler - MUST be before any other middleware
app.use((req: any, res: any, next: any) => {
  // Always set CORS headers for ALL requests
  const origin = req.headers.origin;

  // Set origin dynamically (required for credentials)
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID, X-Tenant, X-Device-Fingerprint, X-Idempotency-Key, Idempotency-Key, idempotency-key, x-csrf-token, x-2fa-token, x-session-id, skipauth, cookies');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  next();
});

// Sentry request handler (must be early)
app.use(sentryRequestHandler);

// Add correlation ID to all requests
app.use(correlationIdMiddleware);

// API version header for all responses
app.use((req, res, next) => {
  res.setHeader('X-API-Version', process.env.API_VERSION || 'v1');
  next();
});

// Security middleware
app.use(securityMiddleware);

// CORS configuration
// NOTE: Custom CORS handler is implemented above using app.use() middleware
// The cors() package is not used to avoid conflicts with custom implementation
// const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
//   'http://localhost:3000',
//   'http://localhost:5173',
// ];
// app.use(cors(corsOptions));

// Compression middleware with optimized settings for production
// Supports gzip and brotli - client negotiates best format
// Note: brotli is automatically enabled when client sends Accept-Encoding: br
app.use(compression({
  // Custom filter to exclude already compressed or binary content
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Don't compress streaming responses or SSE
    if (res.locals?.noCompress) {
      return false;
    }
    // Use compression filter from compression module
    const fallback = compression.filter(req, res);
    return fallback;
  },
  level: parseInt(process.env.COMPRESSION_LEVEL || '6'), // 0-9, default 6
  threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'), // Only compress responses > 1KB
  chunkSize: 16 * 1024, // 16KB chunks
  windowBits: 15,
}));

// Add Vary header for proper caching with compression
app.use((req, res, next) => {
  // Add Vary header for Accept-Encoding to help caches
  if (req.headers['accept-encoding']?.includes('gzip') ||
      req.headers['accept-encoding']?.includes('br')) {
    res.setHeader('Vary', 'Accept-Encoding');
  }
  next();
});

// Connection keep-alive optimizations
app.use((_req, res, next) => {
  // Enable keep-alive for persistent connections
  res.setHeader('Connection', 'keep-alive');

  // Set Keep-Alive timeout on server
  res.setTimeout(parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000'), () => {
    // Handle timeout if needed
  });

  next();
});

// Trust proxy for proper IP detection behind load balancers
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_COUNT || '1'));
app.set('trust proxy', 'loopback');

// Body parsing middleware with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request timeout middleware (30 seconds default) - AFTER body parsing for retry support
app.use(requestTimeout(30000));

// Request size validation middleware
app.use((req, _res, next) => {
  const size = parseInt(req.headers['content-length'] || '0');
  if (size > 5 * 1024 * 1024) {
    req.headers['x-request-rejected'] = 'size-limit';
  }
  next();
});

// MongoDB sanitization (enhanced)
import mongoSanitize from 'express-mongo-sanitize';
app.use(mongoSanitize());

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

// Global rate limiting for all API routes (relaxed in development)
const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10_000 : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'),
  skip: () => isDev && process.env.DISABLE_DEV_RATE_LIMIT === 'true',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

if (!isTest) {
  app.use('/api', globalLimiter);
}

// Per-user rate limiting (stricter for authenticated users)
if (!isTest) {
  app.use('/api', perUserRateLimiter);
}

// Health routes (no rate limiting for basic checks)
app.use('/', healthRoutes);

// AI Monitoring routes
app.use('/', aiMonitoringRoutes);

// Frontend error tracking routes
app.use('/', errorTrackingRoutes);

// Health check endpoint (with strict rate limiting for detailed checks)
app.get('/api/health', strictRateLimiter, (_req: Request, res: Response) => {
  res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
    status: 'healthy',
    service: APP_CONSTANTS.APP_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: APP_CONSTANTS.API_VERSION,
  });
});

// Comprehensive resilience health check endpoints (no rate limiting)
app.get('/health', healthCheckHandler);
app.get('/health/live', livenessProbe);
app.get('/health/ready', readinessProbe);

// Circuit breaker management endpoint
app.post('/health/circuits/reset', resetCircuitBreakers);

// Apply circuit breaker headers to all API responses
app.use('/api', circuitBreakerHeaders);

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

// Maintenance mode check (after health checks, before routes)
import { checkMaintenanceMode } from './middleware/maintenance.middleware';
app.use(checkMaintenanceMode);

// Feature flags middleware
app.use(featureFlagsMiddleware);

// Tenant isolation middleware - MUST be before routes to add tenantId to all requests
import { tenantMiddleware } from './middleware/tenant.middleware';
app.use(tenantMiddleware);

// API routes
app.use('/api', routes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Static files (for uploaded content in development)
if (process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// Production static file serving with aggressive caching
if (process.env.NODE_ENV === 'production') {
  // Cache control for static assets
  app.use('/static', express.static(path.join(__dirname, '../dist/client'), {
    maxAge: '1y', // Cache for 1 year
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
      // Add cache busting headers
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));

  // Cache control for uploads (shorter TTL)
  app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    maxAge: '7d', // Cache for 7 days
    etag: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    },
  }));
}

// Production cluster support
if (process.env.NODE_ENV === 'production' && process.env.CLUSTER_MODE === 'true') {
  const numCPUs = os.cpus().length;

  if (cluster.isMaster) {
    logger.info(`Master process ${process.pid} is running`);
    logger.info(`Starting ${numCPUs} worker processes...`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    // Handle worker exits
    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`);
      cluster.fork();
    });

    // Handle worker online
    cluster.on('online', (worker) => {
      logger.info(`Worker ${worker.process.pid} is online`);
    });
  } else {
    // Workers share the TCP connection
    logger.info(`Worker ${process.pid} started`);
  }
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Closing HTTP server...');
  shutdownMonitoring();

  // Stop accepting new connections
  // Existing connections will be handled until they complete

  setTimeout(() => {
    logger.info('Shutdown complete');
    process.exit(0);
  }, parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '10000'));
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received. Closing HTTP server...');
  shutdownMonitoring();

  setTimeout(() => {
    logger.info('Shutdown complete');
    process.exit(0);
  }, parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '10000'));
});

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
