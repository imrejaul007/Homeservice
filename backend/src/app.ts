import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import { stream } from './utils/logger';
import { APP_CONSTANTS } from './config/constants';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Perform security audit on startup
import securityValidator from './utils/securityValidator';
securityValidator.performSecurityAudit();

// Create Express application
const app: Application = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - Allow all origins in development
const corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'skipAuth', // Allow skipAuth header for AuthService
    'skipauth', // Allow lowercase variant
    'x-csrf-token', // Allow CSRF token header
    'x-2fa-token' // Allow 2FA token header
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Page-Size'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB sanitization
app.use(mongoSanitize());

// HTTP request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', { stream }));
} else {
  app.use(morgan('combined', { stream }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
    status: 'healthy',
    service: APP_CONSTANTS.APP_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: APP_CONSTANTS.API_VERSION
  });
});

// API test endpoint
app.get('/api/test', (_req: Request, res: Response) => {
  res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
    success: true,
    message: 'Backend API is connected and working!',
    timestamp: new Date().toISOString(),
    api_version: APP_CONSTANTS.API_VERSION
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
    error: APP_CONSTANTS.ERROR_MESSAGES.NOT_FOUND
  });
});

// Global error handler
app.use(errorHandler);

export default app;