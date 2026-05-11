import winston from 'winston';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Declare global correlation ID type
declare global {
  var correlationId: string | undefined;
}

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Sensitive fields to redact in logs
const sensitiveFields = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'refreshToken',
  'accessToken',
  'apiKey',
  'api_secret',
  'stripeSecret',
  'jwtSecret',
  'cardNumber',
  'cvv',
  'ssn',
];

// Redact sensitive data from objects
const redactSensitiveData = (obj: unknown): Record<string, unknown> => {
  if (!obj || typeof obj !== 'object') return {};

  const result: Record<string, unknown> = {};
  const entries = Object.entries(obj as Record<string, unknown>);

  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }

  return result;
};

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'home-service-api' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const correlationId = global.correlationId || 'N/A';
          const redactedMeta = redactSensitiveData(meta);
          const metaStr = Object.keys(redactedMeta).length > 0 ? ` ${JSON.stringify(redactedMeta)}` : '';
          return `${timestamp} [${level}] [${correlationId}] ${message}${metaStr}`;
        })
      ),
      handleExceptions: true
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      handleExceptions: true,
      maxsize: 5242880,
      maxFiles: 10,
      tailable: true
    }),

    // File transport for error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      handleExceptions: true,
      maxsize: 5242880,
      maxFiles: 10,
      tailable: true
    }),

    // File transport for payment logs
    new winston.transports.File({
      filename: path.join(logsDir, 'payment.log'),
      level: 'info',
      handleExceptions: true,
      maxsize: 5242880,
      maxFiles: 20,
      tailable: true
    }),
  ],
  exitOnError: false
});

// Helper to generate correlation ID
export const generateCorrelationId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Helper to set correlation ID globally
export const setCorrelationId = (id: string): void => {
  global.correlationId = id;
};

// Get current correlation ID
export const getCorrelationId = (): string => {
  return global.correlationId || 'N/A';
};

// Child logger with additional context
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

// Payment-specific logger
export const paymentLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'home-service-api', category: 'payment' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'payment.log'),
      maxsize: 5242880,
      maxFiles: 20,
      tailable: true
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} [${level}] [PAYMENT] ${message}`;
        })
      ),
    }),
  ],
});

// Create a stream for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

export default logger;
