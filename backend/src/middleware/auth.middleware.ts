import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User, { IUser, UserRole } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload;
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

// Specific rate limits for different endpoints (disabled for testing)
export const authRateLimit = createRateLimit(
  1 * 60 * 1000, // 1 minute
  10000, // 10000 attempts per window (essentially unlimited)
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
export const csrfProtection = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'] || req.body.csrfToken;
    
    if (!csrfToken) {
      throw new ApiError(403, 'CSRF token is required');
    }

    // Verify CSRF token (implement your CSRF token validation logic)
    // This is a simplified example - use a proper CSRF library in production
    const expectedToken = (req as any).session?.csrfToken;
    if (csrfToken !== expectedToken) {
      throw new ApiError(403, 'Invalid CSRF token');
    }
  }

  next();
});

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

// Two-factor authentication middleware (placeholder for future implementation)
export const require2FA = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  // Check if 2FA is enabled and required for this user/action
  const requires2FA = req.user.role === 'admin' || req.user.corporateInfo;
  
  if (requires2FA) {
    const twoFactorToken = req.headers['x-2fa-token'];
    
    if (!twoFactorToken) {
      throw new ApiError(403, 'Two-factor authentication required');
    }

    // Verify 2FA token (implement your 2FA logic)
    // This would integrate with services like Google Authenticator, SMS, etc.
    // const isValid2FA = await verify2FAToken(req.user._id, twoFactorToken);
    // if (!isValid2FA) {
    //   throw new ApiError(403, 'Invalid two-factor authentication token');
    // }
  }

  next();
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
  auditLog,
  trackDevice,
  require2FA
};