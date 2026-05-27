import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { v4 as uuid } from 'uuid';

// Sensitive fields to redact from audit logs (matches logger.ts)
const sensitiveFields = [
  'password', 'token', 'accessToken', 'refreshToken', 'jwtSecret', 'apiKey',
  'api_secret', 'secret', 'authorization', 'cookie', 'sessionId', 'email',
  'phone', 'phoneNumber', 'address', 'coordinates', 'location', 'pin', 'otp',
  'totp', 'recoveryCode', 'backupCode', 'twoFactorSecret', 'resetToken',
  'verificationToken', 'cardNumber', 'cvv', 'ssn', 'bankAccount',
  'accountNumber', 'routingNumber', 'taxId'
];

interface AuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  ip: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userAgent: string;
  params?: any;
  query?: any;
  error?: string;
}

/**
 * Redact sensitive fields from an object for audit logging
 */
const redactSensitiveFields = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;

  const result: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveFields(value);
    } else {
      result[key] = value;
    }
  }

  return result;
};

export const auditLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = uuid();

  // Attach request ID
  req.headers['x-request-id'] = requestId;

  // Hook into response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;

    const auditLog: AuditLog = {
      id: requestId,
      timestamp: new Date(),
      userId: (req.user as any)?._id?.toString(),
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent') || 'unknown',
      params: req.params,
      query: redactSensitiveFields(req.query),
      error: res.statusCode >= 400 ? res.locals.error?.message : undefined,
    };

    // Determine audit category
    const isAuthRequest = req.path.includes('/auth');
    const isAdminRequest = req.path.startsWith('/api/admin');
    const isPasswordReset = req.path.includes('reset-password') || req.path.includes('forgot-password');
    const isFailedRequest = res.statusCode >= 400;

    // Log security-relevant requests
    if (isAuthRequest || isFailedRequest) {
      const auditEntry = {
        ...auditLog,
        action: `${req.method} ${req.path}`,
        category: isAuthRequest ? 'AUTH' : 'REQUEST_FAILURE',
      };

      // Add body info for auth requests (redacted)
      if (isAuthRequest && req.method !== 'GET') {
        (auditEntry as any).bodyFields = Object.keys(redactSensitiveFields(req.body || {}));
      }

      // Log failed auth attempts specifically
      if (isAuthRequest && isFailedRequest) {
        logger.warn('SECURITY_AUDIT: Authentication event', auditEntry);
      } else {
        logger.info('Audit', auditEntry);
      }
    }

    // Log all admin actions with enhanced details
    if (isAdminRequest) {
      logger.info('ADMIN_AUDIT', {
        ...auditLog,
        action: `${req.method} ${req.path}`,
        adminId: (req.user as any)?._id,
        adminEmail: (req.user as any)?.email,
        targetResource: req.params.id,
        bodyFields: req.method !== 'GET' ? Object.keys(redactSensitiveFields(req.body || {})) : undefined,
        category: 'ADMIN_ACTION',
      });
    }

    // Log password reset requests
    if (isPasswordReset) {
      logger.info('SECURITY_AUDIT: Password reset event', {
        ...auditLog,
        action: `${req.method} ${req.path}`,
        category: 'PASSWORD_RESET',
      });
    }
  });

  next();
};
