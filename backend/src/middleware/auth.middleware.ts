import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import User, { IUser, UserRole } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import {
  verifyToken,
  verifyRecoveryCode,
  decryptSecret,
  isValidTokenFormat,
  isValidRecoveryCodeFormat,
} from '../services/auth/2fa.service';
import { provideCsrfToken } from './csrf.middleware';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export interface JWTPayload {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  accountStatus: string;
  tokenVersion?: number;
  iat: number;
  exp: number;
}

// Core authentication middleware
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Extract token from Authorization header or cookies
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new ApiError(401, 'Access token is required for authentication');
    }

    // Verify and decode the token using ACCESS token secret
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JWTPayload;

    // Find user and check if still exists and active
    const user = await User.findById(decoded.id)
      .select('+password +tokenVersion +refreshTokens') // Include fields for security checks
      .populate('loyaltySystem.referredBy', 'firstName lastName email');

    if (!user) {
      throw new ApiError(401, 'User associated with this token no longer exists');
    }

    // Check token version for invalidation
    if (decoded.tokenVersion && decoded.tokenVersion !== (user.tokenVersion || 1)) {
      throw new ApiError(401, 'Token has been invalidated');
    }

    // Check if user account is active
    if (!user.isActive || user.isDeleted) {
      throw new ApiError(401, 'User account has been deactivated');
    }

    // Check if account is suspended
    if (user.accountStatus === 'suspended') {
      throw new ApiError(403, 'Account has been suspended. Please contact support');
    }

    // Check if account is locked due to failed login attempts
    if (user.isLocked()) {
      throw new ApiError(423, 'Account is temporarily locked due to too many failed login attempts');
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw new ApiError(401, 'Password was recently changed. Please login again');
    }

    // Update security tracking
    await user.updateSecurityInfo(req);

    // Attach user to request object (excluding sensitive fields)
    req.user = user;
    next();

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Invalid access token');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Access token has expired');
    }
    next(error);
  }
});

// Optional authentication middleware (doesn't throw error if no token)
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JWTPayload;
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive && !user.isDeleted && user.accountStatus !== 'suspended') {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Silently continue without user authentication
    next();
  }
});

// Role-based authorization middleware
export const requireRole = (allowedRoles: UserRole | UserRole[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  });
};

// Email verification requirement middleware
export const requireEmailVerified = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!req.user.isEmailVerified) {
    throw new ApiError(403, 'Email verification required to access this resource');
  }

  next();
});

// Account status verification middleware
export const requireAccountStatus = (requiredStatus: string | string[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const statuses = Array.isArray(requiredStatus) ? requiredStatus : [requiredStatus];
    
    if (!statuses.includes(req.user.accountStatus)) {
      throw new ApiError(403, `Account status must be one of: ${statuses.join(', ')}`);
    }

    next();
  });
};

// Resource ownership verification middleware
export const requireOwnership = (resourceUserField: string = 'userId') => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Get resource ID from params
    const resourceId = req.params.id;
    if (!resourceId) {
      throw new ApiError(400, 'Resource ID is required');
    }

    // For user resources, check if the user owns the resource
    if (resourceUserField === 'userId' && (req.user as any)._id.toString() !== resourceId) {
      throw new ApiError(403, 'Access denied. You can only access your own resources');
    }

    next();
  });
};

// Provider-specific middleware (requires provider role and profile completion)
export const requireProvider = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  if (req.user.role !== 'provider' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Provider access required');
  }

  // Check if provider profile exists and is complete (skip for admin)
  if (req.user.role === 'provider') {
    const ProviderProfile = require('../models/providerProfile.model').default;
    const providerProfile = await ProviderProfile.findOne({ userId: req.user._id });
    
    if (!providerProfile) {
      throw new ApiError(403, 'Provider profile setup required');
    }

    if (!providerProfile.isProfileComplete) {
      throw new ApiError(403, 'Please complete your provider profile setup');
    }

    if (providerProfile.verificationStatus.overall !== 'approved') {
      throw new ApiError(403, 'Provider verification required');
    }
  }

  next();
});

// Rate limiting configurations
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, _res: Response) => {
      throw new ApiError(429, message || 'Too many requests, please try again later');
    }
  });
};

// Specific rate limits for different endpoints
// SECURITY FIX: Reduced from 10000 to 5 attempts per minute to prevent brute force attacks
export const authRateLimit = createRateLimit(
  1 * 60 * 1000, // 1 minute
  5, // 5 attempts per minute - reasonable for login attempts
  'Too many authentication attempts, please try again in 1 minute'
);

export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again in 15 minutes'
);

export const strictRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 requests per hour
  'Rate limit exceeded for sensitive operations'
);

// IP-based security middleware
export const checkSuspiciousActivity = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  // Log suspicious patterns (implement your logic here)
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));

  if (isSuspicious) {
    console.warn(`🚨 Suspicious activity detected - IP: ${clientIP}, User-Agent: ${userAgent}`);
    // You could implement additional logging, blocking, or CAPTCHA here
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
});

// CSRF protection for state-changing operations
// Uses the dedicated csrf.middleware.ts implementation
// Alias for backward compatibility
export const csrfProtection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Skip for safe HTTP methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip for API endpoints using JWT authentication
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return next();
  }

  // Skip for webhook endpoints (they use their own signature verification)
  if (req.path.includes('/webhook')) {
    return next();
  }

  // Skip for internal service-to-service calls
  if (req.headers['x-internal-service']) {
    return next();
  }

  // Use the dedicated CSRF middleware
  const { validateCsrfToken } = await import('./csrf.middleware');
  return validateCsrfToken(req, res, next);
});

// Deprecated: Use provideCsrfToken from csrf.middleware instead
export const getCsrfToken = (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    message: 'Use GET /api/auth/csrf-token to obtain CSRF token',
    code: 'DEPRECATED',
  });
};

// Audit logging middleware
export const auditLog = (action: string) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const auditData = {
      action,
      userId: req.user?._id,
      userRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date(),
      resource: req.originalUrl,
      method: req.method,
      body: req.method !== 'GET' ? req.body : undefined
    };

    // Log audit trail (implement your audit logging system)
    console.log('📝 Audit Log:', JSON.stringify(auditData, null, 2));

    // You could store this in a dedicated audit collection
    // await AuditLog.create(auditData);

    next();
  });
};

// Device tracking middleware
export const trackDevice = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (req.user) {
    const deviceFingerprint = {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      acceptLanguage: req.get('Accept-Language'),
      acceptEncoding: req.get('Accept-Encoding')
    };

    // Store device info for security monitoring
    // You could implement device tracking and alert on new devices
    (req.user as any).deviceFingerprint = deviceFingerprint;
  }

  next();
});

// Two-factor authentication middleware (complete implementation)
export const require2FA = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Check if 2FA is enabled for this user
  const twoFactorEnabled = req.user.twoFactor?.enabled === true;

  if (!twoFactorEnabled) {
    // 2FA not enabled, skip verification
    return next();
  }

  // Check for trusted device
  const deviceId = req.headers['x-device-id'] as string | undefined;
  const skipTrustedCheck = req.headers['x-skip-2fa-trusted'] === 'true';

  if (deviceId && !skipTrustedCheck) {
    const trustedDevice = req.user.twoFactor?.trustedDevices?.find(
      d => d.deviceId === deviceId
    );

    if (trustedDevice) {
      // Update last used timestamp
      trustedDevice.lastUsed = new Date();
      await req.user.save({ validateBeforeSave: false });

      logger.info('2FA bypass for trusted device', {
        userId: req.user._id,
        deviceId,
      });

      return next();
    }
  }

  // Get 2FA token from header
  const twoFactorToken = req.headers['x-2fa-token'] as string | undefined;

  if (!twoFactorToken) {
    throw new ApiError(403, 'Two-factor authentication required. Please provide your 2FA code.');
  }

  // Check if this is a recovery code
  if (isValidRecoveryCodeFormat(twoFactorToken)) {
    // Verify recovery code
    const userWithCodes = await User.findById(req.user._id).select('+twoFactor.recoveryCodes');

    if (!userWithCodes?.twoFactor?.recoveryCodes) {
      throw new ApiError(403, '2FA recovery codes not configured');
    }

    const isValidRecovery = await verifyRecoveryCode(
      userWithCodes.twoFactor.recoveryCodes,
      twoFactorToken
    );

    if (!isValidRecovery) {
      throw new ApiError(403, 'Invalid recovery code');
    }

    // Recovery code is valid, remove it from the list (one-time use)
    // SECURITY FIX: Rewrote async findIndex with proper async for loop
    // Bug: findIndex callback cannot be async - the Promise was never awaited!
    const normalizedToken = twoFactorToken.toUpperCase().replace(/[\s-]/g, '');
    let codeFound = false;

    for (let i = 0; i < userWithCodes.twoFactor.recoveryCodes.length; i++) {
      const isMatch = await bcrypt.compare(normalizedToken, userWithCodes.twoFactor.recoveryCodes[i]);
      if (isMatch) {
        userWithCodes.twoFactor.recoveryCodes.splice(i, 1);
        codeFound = true;
        break;
      }
    }

    if (codeFound) {
      await userWithCodes.save({ validateBeforeSave: false });
    }

    logger.info('2FA verified via recovery code', { userId: req.user._id });

    return next();
  }

  // Validate token format
  if (!isValidTokenFormat(twoFactorToken)) {
    throw new ApiError(400, 'Invalid 2FA token format. Must be a 6 or 8 digit number.');
  }

  // Decrypt and verify the secret
  const userWithSecret = await User.findById(req.user._id).select('+twoFactor.secret');

  if (!userWithSecret?.twoFactor?.secret) {
    throw new ApiError(403, '2FA secret not configured');
  }

  let decryptedSecret: string;
  try {
    decryptedSecret = decryptSecret(userWithSecret.twoFactor.secret);
  } catch (error) {
    logger.error('Failed to decrypt 2FA secret', { userId: req.user._id });
    throw new ApiError(500, '2FA verification failed. Please contact support.');
  }

  // Verify the TOTP token
  const isValidToken = verifyToken(decryptedSecret, twoFactorToken);

  if (!isValidToken) {
    throw new ApiError(403, 'Invalid 2FA code. Please try again or use a recovery code.');
  }

  // Update last verified timestamp
  userWithSecret.twoFactor.lastVerified = new Date();
  await userWithSecret.save({ validateBeforeSave: false });

  logger.info('2FA verified successfully', { userId: req.user._id });

  return next();
});

// Middleware to skip 2FA for specific routes or conditions
export const skip2FAIfTrusted = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  // Check if this is a trusted device request
  const deviceId = req.headers['x-device-id'] as string | undefined;

  if (!deviceId) {
    return next();
  }

  // Mark that we're skipping 2FA for this request
  (req as any).skip2FAForTrustedDevice = true;

  return next();
});

// Middleware to enable 2FA for a user (setup flow)
export const setup2FA = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const { enable } = req.body;

  if (enable === true && !req.user.twoFactor?.enabled) {
    // Enable 2FA - user must provide valid token first
    const twoFactorToken = req.headers['x-2fa-token'] as string;

    if (!twoFactorToken) {
      throw new ApiError(400, '2FA token required to enable 2FA');
    }

    // Verify the token before enabling
    const userWithSecret = await User.findById(req.user._id).select('+twoFactor.secret');

    if (userWithSecret?.twoFactor?.secret) {
      let decryptedSecret: string;
      try {
        decryptedSecret = decryptSecret(userWithSecret.twoFactor.secret);
      } catch {
        throw new ApiError(500, '2FA setup failed');
      }

      if (!verifyToken(decryptedSecret, twoFactorToken)) {
        throw new ApiError(400, 'Invalid 2FA code');
      }
    }
  }

  return next();
});

// Middleware to add trusted device after successful 2FA
export const addTrustedDevice = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  const deviceId = req.headers['x-device-id'] as string | undefined;
  const deviceName = req.headers['x-device-name'] as string | undefined;
  const trustDevice = req.headers['x-trust-device'] === 'true';

  if (!deviceId || !trustDevice) {
    return next();
  }

  // Check if device already trusted
  const existingDevice = req.user.twoFactor?.trustedDevices?.find(d => d.deviceId === deviceId);

  if (!existingDevice) {
    // Add new trusted device
    if (!req.user.twoFactor) {
      req.user.twoFactor = {
        enabled: true,
        backupEnabled: true,
        trustedDevices: [],
      };
    }

    if (!req.user.twoFactor.trustedDevices) {
      req.user.twoFactor.trustedDevices = [];
    }

    req.user.twoFactor.trustedDevices.push({
      deviceId,
      deviceName: deviceName || 'Unknown Device',
      addedAt: new Date(),
      lastUsed: new Date(),
    });

    await req.user.save({ validateBeforeSave: false });

    logger.info('New device added to trusted devices', {
      userId: req.user._id,
      deviceId,
      deviceName,
    });
  } else {
    // Update last used
    existingDevice.lastUsed = new Date();
    await req.user.save({ validateBeforeSave: false });
  }

  return next();
});

// Middleware to remove trusted device
export const removeTrustedDevice = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  const deviceId = req.params.deviceId;

  if (!deviceId) {
    return next();
  }

  if (req.user.twoFactor?.trustedDevices) {
    const deviceIndex = req.user.twoFactor.trustedDevices.findIndex(d => d.deviceId === deviceId);

    if (deviceIndex !== -1) {
      req.user.twoFactor.trustedDevices.splice(deviceIndex, 1);
      await req.user.save({ validateBeforeSave: false });

      logger.info('Device removed from trusted devices', {
        userId: req.user._id,
        deviceId,
      });
    }
  }

  return next();
});

export default {
  authenticate,
  optionalAuth,
  requireRole,
  requireEmailVerified,
  requireAccountStatus,
  requireOwnership,
  requireProvider,
  authRateLimit,
  generalRateLimit,
  strictRateLimit,
  checkSuspiciousActivity,
  csrfProtection,
  provideCsrfToken,
  auditLog,
  trackDevice,
  require2FA,
  skip2FAIfTrusted,
  setup2FA,
  addTrustedDevice,
  removeTrustedDevice,
};