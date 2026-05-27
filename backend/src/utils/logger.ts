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
  // Authentication & Authorization
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'jwtSecret',
  'jwtToken',
  'apiKey',
  'api_secret',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'sessionId',

  // Personal Identifiable Information (PII)
  'email',
  'phone',
  'phoneNumber',
  'phoneNumberVerified',
  'address',
  'coordinates',
  'location',
  'geoLocation',

  // Security & Recovery
  'pin',
  'otp',
  'totp',
  'recoveryCode',
  'backupCode',
  'twoFactorSecret',
  'resetToken',
  'verificationToken',

  // Payment & Financial
  'cardNumber',
  'cvv',
  'ssn',
  'bankAccount',
  'accountNumber',
  'routingNumber',
  'taxId',

  // Other
  'stripeSecret',
  'privateKey',
  'publicKey',
];

// Regex patterns for redacting sensitive data in strings
// Matches key=value patterns where key contains sensitive field names
const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Password patterns
  { pattern: /(?<![a-zA-Z0-9])(password)[\s:=]+["']?([^\s,"']{1,})/gi, replacement: '$1: [REDACTED]' },
  // Token patterns
  { pattern: /(?<![a-zA-Z0-9])(token)[\s:=]+["']?([^\s,"']{1,})/gi, replacement: '$1: [REDACTED]' },
  // Secret patterns
  { pattern: /(?<![a-zA-Z0-9])(secret|apiKey|api_key|apiSecret)[\s:=]+["']?([^\s,"']{1,})/gi, replacement: '$1: [REDACTED]' },
  // Key patterns
  { pattern: /(?<![a-zA-Z0-9])(key)[\s:=]+["']?([^\s,"']{1,})/gi, replacement: '$1: [REDACTED]' },
  // Card number patterns (matches 13-19 digit sequences)
  { pattern: /(?<!\d)(\d{13,19})(?!\d)/g, replacement: '[REDACTED_CARD]' },
  // CVV patterns (3-4 digit sequences after cvv keyword)
  { pattern: /(?<![a-zA-Z0-9])(cvv|cvc)[\s:=]+["']?(\d{3,4})/gi, replacement: '$1: [REDACTED]' },
  // Authorization header patterns
  { pattern: /(authorization)[\s:=]+["']?(Bearer\s+)?([^\s,"']{1,})/gi, replacement: '$1: [REDACTED]' },
  // Stripe keys
  { pattern: /(sk_live_|sk_test_|rk_live_|rk_test_)[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_STRIPE_KEY]' },
  // Generic sensitive value patterns (long alphanumeric strings that look like tokens)
  { pattern: /(?<![a-zA-Z0-9])([a-zA-Z0-9]{40,})(?![a-zA-Z0-9])/g, replacement: '[REDACTED_TOKEN]' },
];

/**
 * Redact sensitive data from a string using regex patterns
 */
const redactString = (input: string): string => {
  let result = input;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
};

// Redact sensitive data from objects
const redactSensitiveData = (obj: unknown, seen = new WeakSet()): Record<string, unknown> => {
  if (!obj || typeof obj !== 'object') return {};

  // Handle Error objects
  if (obj instanceof Error) {
    return {
      message: obj.message,
      name: obj.name,
      stack: obj.stack,
    };
  }

  // Prevent circular references
  if (seen.has(obj as object)) {
    return { _circular: true };
  }
  seen.add(obj as object);

  const result: Record<string, unknown> = {};
  const entries = Object.entries(obj as Record<string, unknown>);

  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactSensitiveData(value, seen);
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
          // Redact sensitive strings in the message itself
          const redactedMessage = redactString(message as string);
          const metaStr = Object.keys(redactedMeta).length > 0 ? ` ${JSON.stringify(redactedMeta)}` : '';
          return `${timestamp} [${level}] [${correlationId}] ${redactedMessage}${metaStr}`;
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
