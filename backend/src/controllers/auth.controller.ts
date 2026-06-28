import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';
import Joi from 'joi';
import { CustomerRegistrationDTO, ProviderRegistrationDTO, AdminRegistrationDTO, ProfileUpdatesDTO } from '../dto/auth.dto';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import { hashRecoveryCodes } from '../services/auth/2fa.service';
import { twoFactorVerifyLimiter } from '../middleware/rateLimiter';
import { IUser } from '../models/user.model';
import {
  customerRegistrationSchema,
  providerRegistrationSchema,
  loginSchema,
  changePasswordSchema,
  resetPasswordSchema,
  emailVerificationSchema,
  resendVerificationSchema,
  passwordSchema,
} from '../validation/auth.validation';

// ============================================
// Cookie Options
// ============================================

const getCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge,
});

// ============================================
// Customer Registration
// ============================================

export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  // FIX: Allow unknown fields in request body to be consistent with middleware validation
  // This prevents errors when frontend sends extra fields or fields at wrong level
  const { error, value } = customerRegistrationSchema.validate(req.body, { allowUnknown: true });
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const dto: CustomerRegistrationDTO = value;
  const result = await authService.registerCustomer(dto);

  // Set refresh token as HTTP-only cookie
  if (result.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
  }

  // Set access token as HTTP-only cookie for web clients
  if (result.tokens?.accessToken) {
    setAuthCookie(res, result.tokens.accessToken);
  }

  // Publish user.registered event
  await eventBus.publish(EVENT_TYPES.USER_REGISTERED, {
    userId: result.user.id,
    email: value.email,
    role: 'customer',
    firstName: value.firstName,
    lastName: value.lastName,
    referralCode: value.referralCode,
  }, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    success: true,
    message: 'Customer registration successful! Welcome to the platform!',
    data: {
      user: result.user,
      tokens: result.tokens,
      requiresEmailVerification: result.requiresEmailVerification,
    },
  });
});

// ============================================
// Provider Registration
// ============================================

export const registerProvider = asyncHandler(async (req: Request, res: Response) => {
  // FIX: Allow unknown fields in request body to be consistent with middleware validation
  const { error, value } = providerRegistrationSchema.validate(req.body, { allowUnknown: true });
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const dto: ProviderRegistrationDTO = value;
  const result = await authService.registerProvider(dto);

  // Set refresh token as HTTP-only cookie
  if (result.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
  }

  // Set access token as HTTP-only cookie for web clients
  if (result.tokens?.accessToken) {
    setAuthCookie(res, result.tokens.accessToken);
  }

  // Publish user.registered event
  await eventBus.publish(EVENT_TYPES.USER_REGISTERED, {
    userId: result.user.id,
    email: value.email,
    role: 'provider',
    firstName: value.firstName,
    lastName: value.lastName,
    businessName: value.businessInfo?.businessName,
    services: value.services?.map((s: any) => s.name) || [],
  }, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    success: true,
    message: 'Provider registration successful! Welcome to our provider community!',
    data: {
      user: result.user,
      providerProfile: result.providerProfile,
      tokens: result.tokens,
      requiresEmailVerification: result.requiresEmailVerification,
      requiresProfileCompletion: !result.providerProfile?.isProfileComplete,
    },
  });
});

// ============================================
// Admin Registration
// ============================================

export const registerAdmin = asyncHandler(async (req: Request, res: Response) => {
  const adminSchema = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required(),
    password: passwordSchema,
    phone: Joi.string().allow('', null).optional(),
  });

  const { error, value } = adminSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const dto: AdminRegistrationDTO = value;
  const creatorId = (req.user as IUser)?._id?.toString();
  const result = await authService.registerAdmin(dto, creatorId);

  res.status(201).json({
    success: true,
    message: 'Admin account created successfully',
    data: {
      user: result.user,
    },
  });
});

// ============================================
// Login
// ============================================

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const acceptLanguage = req.headers['accept-language'];
  const rememberMe = value.rememberMe || false;
  const result = await authService.login(value.email, value.password, clientIP, rememberMe);

  if (result.requires2FA) {
    return res.json({
      success: true,
      message: 'Two-factor authentication required',
      data: {
        requires2FA: true,
        preAuthToken: result.preAuthToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
        },
        redirectUrl: result.redirectUrl,
      },
    });
  }

  if (!result.tokens) {
    throw new ApiError(500, 'Authentication failed');
  }

  const loginResponse = await finalizeLoginSession(req, res, result, rememberMe);
  return res.json(loginResponse);
});

export const verifyLogin2FA = asyncHandler(async (req: Request, res: Response) => {
  const { verifyLogin2FASchema } = await import('../validation/auth.validation');
  const { error, value } = verifyLogin2FASchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const result = await authService.verifyLogin2FA(value.preAuthToken, value.code, clientIP);

  if (!result.tokens) {
    throw new ApiError(500, 'Authentication failed');
  }

  const loginResponse = await finalizeLoginSession(req, res, result, false);
  return res.json(loginResponse);
});

async function finalizeLoginSession(
  req: Request,
  res: Response,
  result: Awaited<ReturnType<typeof authService.login>>,
  rememberMe: boolean
) {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const acceptLanguage = req.headers['accept-language'];

  // Parse user agent for device info
  const deviceInfo = parseUserAgent(userAgent);

  // Add session tracking with TTL and device fingerprinting
  const User = (await import('../models/user.model')).default;
  const crypto = (await import('crypto')).default;
  const userDoc = await User.findById(result.user.id);

  let isNewDevice = false;
  let isRecognizedDevice = true;
  let sessionId = '';

  if (userDoc && result.tokens) {
    // Import device fingerprinting function
    const { generateDeviceFingerprint } = await import('../services/auth.service');

    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(userAgent, clientIP, acceptLanguage);

    // Check if this is a recognized device
    const existingDevice = userDoc.deviceList?.find(
      (d: any) => d.fingerprint === deviceFingerprint
    );
    isNewDevice = !existingDevice;
    isRecognizedDevice = !!existingDevice;

    // Mark all existing sessions as not current
    userDoc.sessions = userDoc.sessions || [];
    userDoc.sessions.forEach(session => {
      session.isCurrent = false;
    });

    // Generate session ID and calculate expiry (30 days)
    sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Add new session with device fingerprint
    userDoc.sessions.push({
      sessionId,
      token: result.tokens.accessToken,
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ip: clientIP,
      userAgent: userAgent,
      lastActive: new Date(),
      createdAt: new Date(),
      expiresAt,
      isCurrent: true,
      deviceFingerprint, // Store device fingerprint
    });

    // Track device in device list
    if (!userDoc.deviceList) {
      userDoc.deviceList = [];
    }

    const deviceIndex = userDoc.deviceList.findIndex(
      (d: any) => d.fingerprint === deviceFingerprint
    );

    if (deviceIndex !== -1) {
      // Update existing device
      userDoc.deviceList[deviceIndex].lastActive = new Date();
      userDoc.deviceList[deviceIndex].lastIp = clientIP;
      userDoc.deviceList[deviceIndex].loginCount = (userDoc.deviceList[deviceIndex].loginCount || 1) + 1;
    } else {
      // Add new device
      userDoc.deviceList.push({
        fingerprint: deviceFingerprint,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        firstSeen: new Date(),
        lastActive: new Date(),
        lastIp: clientIP,
        loginCount: 1,
        isTrusted: false,
      });

      // Keep only last 20 devices
      if (userDoc.deviceList.length > 20) {
        userDoc.deviceList = userDoc.deviceList
          .sort((a: any, b: any) => b.lastActive.getTime() - a.lastActive.getTime())
          .slice(0, 20);
      }
    }

    // Keep only last 10 sessions, but ALWAYS preserve the newly created current session
    // FIX: Use the newly generated sessionId (not from headers) to preserve current session
    if (userDoc.sessions.length > 10) {
      const newSessionId = sessionId; // This is the newly created session

      // Keep new session + 9 most recent other sessions
      const otherSessions = userDoc.sessions
        .filter((s: any) => s.sessionId !== newSessionId)
        .sort((a: any, b: any) => b.lastActive.getTime() - a.lastActive.getTime())
        .slice(0, 9);

      // Find the new session (it was just added)
      const newSession = userDoc.sessions.find((s: any) => s.sessionId === newSessionId);

      if (newSession) {
        userDoc.sessions = [...otherSessions, newSession];
      } else {
        // Fallback: keep 10 most recent
        userDoc.sessions = userDoc.sessions
          .sort((a: any, b: any) => b.lastActive.getTime() - a.lastActive.getTime())
          .slice(0, 10);
      }
    }

    // CRITICAL FIX: Wrap session and device updates in transaction to prevent race conditions
    const mongoose = (await import('mongoose')).default;
    const mongooseSession = await mongoose.startSession();
    try {
      mongooseSession.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });
      await userDoc.save({ session: mongooseSession, validateBeforeSave: false });
      await mongooseSession.commitTransaction();
    } catch (error) {
      if (mongooseSession.inTransaction()) {
        await mongooseSession.abortTransaction();
      }
      logger.error('Session update transaction failed', {
        action: 'SESSION_UPDATE_TRANSACTION_FAILED',
        userId: result.user.id,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      mongooseSession.endSession();
    }

    // Log new device detection for security monitoring
    if (isNewDevice) {
      logger.info('New device detected during login', {
        action: 'NEW_DEVICE_LOGIN',
        userId: result.user.id,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ip: clientIP,
      });
    }
  }

  // Set refresh token as HTTP-only cookie
  // Cookie expiry: 30 days if rememberMe, 7 days otherwise
  const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  if (result.tokens?.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(cookieMaxAge));
  }

  // Set access token as HTTP-only cookie for web clients
  if (result.tokens?.accessToken) {
    setAuthCookie(res, result.tokens.accessToken);
  }

  return {
    success: true,
    message: 'Login successful',
    data: {
      user: result.user,
      ...result.roleSpecificData,
      tokens: result.tokens,
      sessionId: sessionId || undefined,
      redirectUrl: result.redirectUrl,
      requiresEmailVerification: result.requiresEmailVerification,
      deviceInfo: {
        isNewDevice,
        isRecognizedDevice,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
      },
    },
  };
}

// Helper function to parse user agent
function parseUserAgent(userAgent: string): { device: string; browser: string; os: string } {
  let device = 'Unknown Device';
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
    device = 'Windows PC';
  } else if (userAgent.includes('Mac OS') || userAgent.includes('Macintosh')) {
    os = 'macOS';
    if (userAgent.includes('iPhone')) {
      os = 'iOS';
      device = 'iPhone';
    } else if (userAgent.includes('iPad')) {
      os = 'iPadOS';
      device = 'iPad';
    } else {
      device = 'Mac';
    }
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    device = 'Android Device';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
    device = 'Linux PC';
  }

  // Detect Browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }

  return { device, browser, os };
}

// ============================================
// Refresh Token
// ============================================

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: tokenFromBody } = req.body;
  const tokenFromCookie = req.cookies?.refreshToken;
  const refreshTokenValue = tokenFromBody || tokenFromCookie;

  if (!refreshTokenValue) {
    throw new ApiError(401, 'Refresh token is required');
  }

  // SECURITY FIX: If authenticated, validate token belongs to the user
  const authUser = req.user as any;
  if (authUser?._id) {
    // Verify the refresh token belongs to this user
    // This prevents using another user's refresh token
    const tokenPayload = (() => {
      try {
        const jwt = require('jsonwebtoken');
        return jwt.verify(tokenFromBody, process.env.JWT_REFRESH_SECRET);
      } catch {
        return null;
      }
    })();

    if (tokenPayload && tokenPayload.id !== authUser._id.toString()) {
      logger.warn('Refresh token user mismatch', {
        action: 'REFRESH_TOKEN_USER_MISMATCH',
        authenticatedUserId: authUser._id,
        tokenUserId: tokenPayload?.id,
      });
      throw new ApiError(403, 'Token does not belong to authenticated user');
    }
  }

  const result = await authService.refreshToken(refreshTokenValue);

  // Set new refresh token cookie
  res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      tokens: result.tokens,
      user: result.user,
    },
  });
});

// ============================================
// Logout
// ============================================

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const authUser = req.user as any;
  const refreshToken = req.cookies?.refreshToken;
  const currentToken = req.headers.authorization?.replace('Bearer ', '');

  if (authUser?._id) {
    const User = (await import('../models/user.model')).default;
    const userDoc = await User.findById(authUser._id);

    if (userDoc) {
      // Remove the current session
      if (currentToken) {
        userDoc.sessions = userDoc.sessions.filter(s => s.token !== currentToken);
      }

      // Remove refresh token from list
      if (refreshToken) {
        userDoc.refreshTokens = userDoc.refreshTokens.filter(t => t !== refreshToken);
      }

      // Increment token version to invalidate any remaining access tokens
      userDoc.tokenVersion = (userDoc.tokenVersion || 1) + 1;

      await userDoc.save({ validateBeforeSave: false });

      // Also remove from Redis if available
      try {
        const sessionId = req.headers['x-session-id'];
        if (sessionId) {
          const { removeRedisSession } = await import('../middleware/auth.middleware');
          await removeRedisSession(sessionId as string);
        }
      } catch (error) {
        logger.warn('Failed to remove session from Redis', { error: (error as Error).message });
      }

      logger.info('User logged out', {
        action: 'USER_LOGOUT',
        userId: authUser._id.toString(),
      });
    }
  }

  res.clearCookie('refreshToken');
  clearAuthCookie(res);

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// ============================================
// Logout All Devices
// ============================================

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (user?._id) {
    const User = (await import('../models/user.model')).default;
    const userDoc = await User.findById(user._id);

    if (userDoc) {
      // Clear all sessions
      userDoc.sessions = [];
      userDoc.refreshTokens = [];
      userDoc.tokenVersion = (userDoc.tokenVersion || 1) + 1;

      await userDoc.save({ validateBeforeSave: false });

      // Clear all Redis sessions
      try {
        const { cache } = await import('../config/redis');
        const keys = await cache.client?.keys(`session:${user._id}:*`);
        if (keys && keys.length > 0) {
          await Promise.all(keys.map(key => cache.del(key)));
        }
      } catch (error) {
        logger.warn('Failed to clear sessions from Redis', { error: (error as Error).message });
      }

      logger.info('User logged out from all devices', {
        action: 'USER_LOGOUT_ALL_DEVICES',
        userId: user._id.toString(),
      });
    }
  }

  res.clearCookie('refreshToken');
  clearAuthCookie(res);

  res.json({
    success: true,
    message: 'Logged out from all devices successfully',
  });
});

// ============================================
// Get Current User
// ============================================

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await authService.getProfile(user._id.toString());

  res.json({
    success: true,
    data: result,
  });
});

// ============================================
// Forgot Password
// ============================================

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = Joi.object({ email: Joi.string().email().required() }).validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  await authService.forgotPassword(value.email);

  res.json({
    success: true,
    message: 'If an account with that email exists, we have sent a password reset link.',
  });
});

// ============================================
// Reset Password
// ============================================

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = resetPasswordSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const result = await authService.resetPassword(value.token, value.password);

  // Set refresh token cookie (if available in result)
  if ((result as any).refreshToken) {
    res.cookie('refreshToken', (result as any).refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
  }

  res.json({
    success: true,
    message: 'Password has been reset successfully',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

// ============================================
// Change Password
// ============================================

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const user = req.user as any;
  const result = await authService.changePassword(user._id.toString(), value.currentPassword, value.newPassword);

  res.json({
    success: true,
    message: 'Password changed successfully',
    data: {
      accessToken: result.accessToken,
    },
  });
});

// ============================================
// Verify Email
// ============================================

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = emailVerificationSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const result = await authService.verifyEmail(value.token);

  res.json({
    success: true,
    message: 'Email verified successfully! Welcome to our platform.',
    data: {
      user: result.user,
    },
  });
});

// ============================================
// Resend Verification Email
// ============================================

export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = resendVerificationSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  await authService.resendVerificationEmail(value.email);

  res.json({
    success: true,
    message: 'If an account with that email exists and is not verified, we have sent a verification email.',
  });
});

// ============================================
// Update Profile
// ============================================

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const updates: ProfileUpdatesDTO = req.body;

  const result = await authService.updateProfile(user._id.toString(), updates);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: result,
  });
});

// ============================================
// Email Unsubscribe (public)
// ============================================

export const processEmailUnsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    throw new ApiError(400, 'Unsubscribe token is required');
  }

  const { processUnsubscribeToken } = await import('../services/email.service');
  const result = await processUnsubscribeToken(token);

  if (!result.success) {
    throw new ApiError(400, result.error || 'Invalid unsubscribe token');
  }

  res.json({
    success: true,
    message: `You have been unsubscribed from ${result.emailType} emails`,
    data: {
      emailType: result.emailType,
    },
  });
});

// ============================================
// Upload Profile Image
// ============================================

export const uploadProfileImage = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const file = files?.avatar?.[0];

  if (!file) {
    throw new ApiError(400, 'No image file provided');
  }

  const result = await authService.uploadProfileImage(user._id.toString(), file);

  res.json({
    success: true,
    message: 'Profile image uploaded successfully',
    data: result,
  });
});

// ============================================
// Export User Data
// ============================================

export const exportUserData = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await authService.exportUserData(user._id.toString());

  res.json({
    success: true,
    message: 'User data exported successfully',
    data: result,
  });
});

// ============================================
// Delete Account
// ============================================

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { password } = req.body;

  if (!password) {
    throw new ApiError(400, 'Password is required to delete your account');
  }

  const result = await authService.deleteAccount(user._id.toString(), password);

  res.clearCookie('refreshToken');
  clearAuthCookie(res);

  res.json({
    success: true,
    message: result.message,
  });
});

// ============================================
// Get Login History
// ============================================

export const getLoginHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  // FIX: Pagination DoS Prevention - Enforce maximum limits on pagination parameters
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 100); // Max 100

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id).select('sessions');

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Return sessions without the actual tokens for security
  const allSessions = (userDoc.sessions || []).map(session => ({
    device: session.device,
    browser: session.browser,
    os: session.os,
    ip: session.ip,
    location: session.location,
    lastActive: session.lastActive,
    createdAt: session.createdAt,
    isCurrent: session.isCurrent,
  }));

  // FIX: Sort by lastActive descending with null safety
  allSessions.sort((a, b) => {
    const aTime = a?.lastActive ? new Date(a.lastActive).getTime() : 0;
    const bTime = b?.lastActive ? new Date(b.lastActive).getTime() : 0;
    return bTime - aTime;
  });

  // FIX: Apply pagination to prevent returning too many sessions
  const total = allSessions.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const sessions = allSessions.slice(offset, offset + limit);

  res.json({
    success: true,
    data: {
      sessions,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});

// ============================================
// Device Management
// ============================================

/**
 * Get all devices for the current user
 * GET /api/auth/devices
 */
export const getDevices = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id).select('deviceList sessions');

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  const currentSessionId = req.headers['x-session-id'] as string;

  // Combine device info with session data
  const devices = (userDoc.deviceList || []).map((device: any) => {
    // Find if this device has an active session
    const activeSession = (userDoc.sessions || []).find(
      (s: any) => s.deviceFingerprint === device.fingerprint && s.isCurrent
    );

    return {
      fingerprint: device.fingerprint.substring(0, 8) + '...', // Masked for security
      device: device.device,
      browser: device.browser,
      os: device.os,
      firstSeen: device.firstSeen,
      lastActive: device.lastActive,
      loginCount: device.loginCount,
      isTrusted: device.isTrusted,
      isCurrent: !!activeSession,
    };
  });

  // Sort by last active
  devices.sort((a: any, b: any) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

  res.json({
    success: true,
    data: {
      devices,
      total: devices.length,
    },
  });
});

/**
 * Remove a device from user's device list
 * DELETE /api/auth/devices/:fingerprint
 */
export const removeDevice = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { fingerprint } = req.params;

  if (!fingerprint) {
    throw new ApiError(400, 'Device fingerprint is required');
  }

  // Full fingerprint from session header (client sends it)
  const fullFingerprint = req.headers['x-device-fingerprint'] as string;

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Find device by partial fingerprint match
  const device = (userDoc.deviceList || []).find(
    (d: any) => d.fingerprint.startsWith(fingerprint.replace('...', ''))
  );

  if (!device) {
    throw new ApiError(404, 'Device not found');
  }

  const deviceFingerprint = device.fingerprint;

  // Remove device from deviceList (with null check)
  userDoc.deviceList = (userDoc.deviceList || []).filter(
    (d: any) => d.fingerprint !== deviceFingerprint
  );

  // Also invalidate any sessions with this device fingerprint
  userDoc.sessions = (userDoc.sessions || []).filter(
    (s: any) => s.deviceFingerprint !== deviceFingerprint
  );

  await userDoc.save({ validateBeforeSave: false });

  logger.info('Device removed from user account', {
    action: 'DEVICE_REMOVED',
    userId: user._id,
    device: device.device,
  });

  res.json({
    success: true,
    message: 'Device removed successfully',
  });
});

/**
 * Remove all devices except current session
 * DELETE /api/auth/devices
 */
export const removeAllDevices = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const currentToken = req.headers.authorization?.replace('Bearer ', '');

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Find current session's device fingerprint
  const currentSession = userDoc.sessions.find(
    (s: any) => s.token === currentToken
  );
  const currentFingerprint = currentSession?.deviceFingerprint;

  // Keep only the current device in deviceList
  if (currentFingerprint) {
    userDoc.deviceList = (userDoc.deviceList || []).filter(
      (d: any) => d.fingerprint === currentFingerprint
    );
  } else {
    userDoc.deviceList = [];
  }

  // Clear all sessions except current
  userDoc.sessions = userDoc.sessions.filter((s: any) => s.token === currentToken);

  // Increment token version to invalidate all other tokens
  userDoc.tokenVersion = (userDoc.tokenVersion || 1) + 1;
  userDoc.refreshTokens = [];

  await userDoc.save({ validateBeforeSave: false });

  logger.info('All devices except current removed', {
    action: 'ALL_DEVICES_REMOVED_EXCEPT_CURRENT',
    userId: user._id,
  });

  res.json({
    success: true,
    message: 'All other devices have been removed',
  });
});

/**
 * Trust a device (skip 2FA for this device)
 * POST /api/auth/devices/:fingerprint/trust
 */
export const trustDevice = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { fingerprint } = req.params;

  if (!fingerprint) {
    throw new ApiError(400, 'Device fingerprint is required');
  }

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Find device by partial fingerprint match
  const device = (userDoc.deviceList || []).find(
    (d: any) => d.fingerprint.startsWith(fingerprint.replace('...', ''))
  );

  if (!device) {
    throw new ApiError(404, 'Device not found');
  }

  device.isTrusted = true;
  device.trustedAt = new Date();
  await userDoc.save({ validateBeforeSave: false });

  logger.info('Device marked as trusted', {
    action: 'DEVICE_TRUSTED',
    userId: user._id,
    device: device.device,
  });

  res.json({
    success: true,
    message: 'Device marked as trusted',
  });
});

// ============================================
// Logout All Devices
// ============================================

export const logoutAllDevices = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const currentToken = req.headers.authorization?.replace('Bearer ', '');

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Clear all refresh tokens
  await userDoc.updateOne({
    refreshTokens: [],
    tokenVersion: (userDoc.tokenVersion || 1) + 1,
    // Keep current session but mark others as not current
    $set: {
      'sessions.$[].isCurrent': false,
    },
  });

  // Find current session and mark it as current
  if (currentToken) {
    await userDoc.updateOne(
      { 'sessions.token': currentToken },
      { $set: { 'sessions.$.isCurrent': true, 'sessions.$.lastActive': new Date() } }
    );
  }

  res.clearCookie('refreshToken');
  clearAuthCookie(res);

  res.json({
    success: true,
    message: 'Logged out from all other devices. Current session preserved.',
  });
});

// ============================================
// Two-Factor Authentication
// ============================================

// Setup 2FA - Generate secret and QR code
export const setup2FA = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const crypto = await import('crypto');

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Generate a new secret
  const secret = crypto.randomBytes(20).toString('hex');
  const secretBase32 = Buffer.from(secret, 'hex').toString('base64').replace(/=/g, '');

  // Generate OTPAuth URL for QR code
  const otpauthUrl = `otpauth://totp/NILIN:${userDoc.email}?secret=${secretBase32}&issuer=NILIN&algorithm=SHA1&digits=6&period=30`;

  // In production, encrypt the secret before storing
  // For now, store it (in production, encrypt this)
  userDoc.twoFactor = userDoc.twoFactor || { enabled: false, backupEnabled: true };
  userDoc.twoFactor.secret = secretBase32;

  // Generate recovery codes
  const recoveryCodes: string[] = [];
  for (let i = 0; i < 8; i++) {
    recoveryCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }

  // SECURITY FIX: Hash recovery codes before storing (prevents exposure if DB is compromised)
  const hashedCodes = await hashRecoveryCodes(recoveryCodes);
  userDoc.twoFactor.recoveryCodes = hashedCodes;

  await userDoc.save({ validateBeforeSave: false });

  res.json({
    success: true,
    data: {
      secret: secretBase32,
      otpauthUrl,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`,
      recoveryCodes,
    },
  });
});

// Verify 2FA code and enable
export const enable2FA = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { code } = req.body;

  if (!code) {
    throw new ApiError(400, 'Verification code is required');
  }

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id);

  if (!userDoc || !userDoc.twoFactor?.secret) {
    throw new ApiError(400, 'Please setup 2FA first');
  }

  // SECURITY FIX: Verify the TOTP code using proper speakeasy validation
  // Import the 2FA service for proper token verification
  const { verifyToken } = await import('../services/auth/2fa.service');
  const isValidCode = verifyToken(userDoc.twoFactor.secret, code);

  if (!isValidCode) {
    throw new ApiError(400, 'Invalid verification code');
  }

  userDoc.twoFactor.enabled = true;
  userDoc.twoFactor.lastVerified = new Date();
  await userDoc.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'Two-factor authentication enabled successfully',
  });
});

// Disable 2FA
export const disable2FA = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { code, password } = req.body;

  if (!code || !password) {
    throw new ApiError(400, 'Verification code and password are required');
  }

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id);

  if (!userDoc || !userDoc.twoFactor?.enabled) {
    throw new ApiError(400, '2FA is not enabled');
  }

  // Verify password
  const isMatch = await userDoc.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid password');
  }

  userDoc.twoFactor.enabled = false;
  userDoc.twoFactor.secret = undefined;
  userDoc.twoFactor.recoveryCodes = undefined;
  await userDoc.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'Two-factor authentication disabled',
  });
});

// Get 2FA status
export const get2FAStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  const twoFactor = userDoc.twoFactor || { enabled: false, backupEnabled: true };

  res.json({
    success: true,
    data: {
      enabled: twoFactor.enabled,
      backupEnabled: twoFactor.backupEnabled,
      hasRecoveryCodes: !!(twoFactor.recoveryCodes && twoFactor.recoveryCodes.length > 0),
      lastVerified: twoFactor.lastVerified,
    },
  });
});

// ============================================
// Admin Invite Management (Task #66)
// ============================================

/**
 * Generate an admin invite token
 * POST /api/auth/admin/invite
 * SECURITY FIX: Uses crypto.randomBytes(32) instead of predictable tokens
 * SECURITY FIX: Token is NOT returned in API response - must be sent via email
 */
export const generateAdminInvite = asyncHandler(async (req: Request, res: Response) => {
  const { email, expiresInDays } = req.body;
  const adminUser = req.user as any;

  if (!email || !email.includes('@')) {
    throw new ApiError(400, 'Valid email is required');
  }

  const { AdminInviteService } = await import('../services/adminInvite.service');
  const { token, expiresAt, inviteId } = await AdminInviteService.generateInviteToken(
    adminUser._id.toString(),
    email,
    expiresInDays || 7
  );

  // SECURITY FIX: Do NOT return the token in the API response
  // The token must be sent via email to the invitee only
  // Return only the inviteId for tracking/revocation purposes
  res.status(201).json({
    success: true,
    message: 'Admin invite generated. The invite link has been sent to the email address.',
    data: {
      inviteId,
      email,
      expiresAt: expiresAt.toISOString(),
      // NOTE: The actual invite token is sent via email, not returned here
      // Frontend should use inviteId to check invite status
      _security: 'Token sent via email. Do not expose tokens in API responses.'
    }
  });
});

/**
 * Accept an admin invite token and create admin account
 * POST /api/auth/admin/accept-invite
 * SECURITY FIX: Validates token securely and prevents reuse
 * FIX: Verify invite token was intended for the accepting user before upgrading role
 */
export const acceptAdminInvite = asyncHandler(async (req: Request, res: Response) => {
  const { token, firstName, lastName, password, phone } = req.body;
  const adminUser = req.user as any;

  // Validate required fields
  const schema = Joi.object({
    token: Joi.string().required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    password: passwordSchema,
    phone: Joi.string().allow('', null).optional(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  // SECURITY FIX: Prevent already-admin users from misusing invite tokens
  if (adminUser.role === 'admin') {
    throw new ApiError(400, 'You are already an admin');
  }

  // SECURITY FIX: Prevent suspended/deactivated users from accepting invites
  if (adminUser.accountStatus === 'suspended' || adminUser.accountStatus === 'deactivated') {
    throw new ApiError(403, 'Your account is not active. Please contact support.');
  }

  const { AdminInviteService } = await import('../services/adminInvite.service');

  // Verify and consume the token
  // FIX: The service already validates email matches, but we add explicit verification here
  const invite = await AdminInviteService.verifyAndConsumeToken(
    value.token,
    adminUser._id.toString()
  );

  // SECURITY FIX: Double-verify the invite was intended for this user
  // This prevents any race conditions or edge cases in the token validation
  if (!invite || !invite.email) {
    throw new ApiError(400, 'Invalid invite token');
  }

  // Verify email matches explicitly (defense in depth)
  const acceptingUserEmail = adminUser.email.toLowerCase();
  const invitedEmail = invite.email.toLowerCase();

  if (acceptingUserEmail !== invitedEmail) {
    logger.warn('Admin invite acceptance rejected - email mismatch', {
      action: 'ADMIN_INVITE_EMAIL_MISMATCH_DEFENSE',
      userId: adminUser._id.toString(),
      userEmail: acceptingUserEmail,
      invitedEmail: invitedEmail,
    });
    throw new ApiError(403, 'This invite was not intended for your account');
  }

  // SECURITY FIX: Only allow upgrade to admin, not other roles
  const allowedRoles = ['customer', 'provider'];
  if (!allowedRoles.includes(adminUser.role)) {
    throw new ApiError(400, 'Invalid current role for admin invite acceptance');
  }

  // Update user to admin role - explicitly set to 'admin' to prevent any role manipulation
  adminUser.role = 'admin';
  adminUser.firstName = value.firstName;
  adminUser.lastName = value.lastName;
  adminUser.phone = value.phone || adminUser.phone;
  adminUser.isEmailVerified = true;
  adminUser.accountStatus = 'active';
  adminUser.adminInviteAcceptedAt = new Date();
  await adminUser.save({ validateBeforeSave: false });

  logger.info('Admin invite accepted', {
    action: 'ADMIN_INVITE_ACCEPTED',
    userId: adminUser._id,
    email: invite.email,
    invitedBy: invite.createdBy
  });

  res.json({
    success: true,
    message: 'Admin account created successfully',
    data: {
      user: {
        id: adminUser._id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role
      }
    }
  });
});

/**
 * List pending admin invites (admin only)
 * GET /api/auth/admin/invites
 */
export const listAdminInvites = asyncHandler(async (req: Request, res: Response) => {
  const adminUser = req.user as any;

  const { AdminInviteService } = await import('../services/adminInvite.service');
  const invites = await AdminInviteService.listPendingInvites(adminUser._id.toString());

  res.json({
    success: true,
    data: { invites }
  });
});

/**
 * Revoke an admin invite token
 * DELETE /api/auth/admin/invites/:token
 */
export const revokeAdminInvite = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const adminUser = req.user as any;

  if (!token) {
    throw new ApiError(400, 'Token is required');
  }

  const { AdminInviteService } = await import('../services/adminInvite.service');
  await AdminInviteService.revokeToken(token, adminUser._id.toString());

  res.json({
    success: true,
    message: 'Admin invite revoked successfully'
  });
});

// ============================================
// Export
// ============================================

export default {
  registerCustomer,
  registerProvider,
  registerAdmin,
  login,
  verifyLogin2FA,
  refreshToken,
  logout,
  logoutAll,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerificationEmail,
  updateProfile,
  uploadProfileImage,
  processEmailUnsubscribe,
  exportUserData,
  deleteAccount,
  getLoginHistory,
  getDevices,
  removeDevice,
  removeAllDevices,
  trustDevice,
  logoutAllDevices,
  setup2FA,
  enable2FA,
  disable2FA,
  get2FAStatus,
  generateAdminInvite,
  acceptAdminInvite,
  listAdminInvites,
  revokeAdminInvite,
};
