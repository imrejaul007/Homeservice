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

// ============================================
// Validation Schemas
// ============================================

// Password complexity pattern: uppercase, lowercase, number, special char
const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

const customerRegistrationSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(12).pattern(PASSWORD_COMPLEXITY).required().messages({
    'string.min': 'Password must be at least 12 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  }),
  phone: Joi.string().pattern(/^[\+]?[(]?[\d\s\-\(\)]{10,}$/).required(),
  dateOfBirth: Joi.string(),
  gender: Joi.string(),
  address: Joi.object({
    street: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    zipCode: Joi.string(),
    country: Joi.string(),
    coordinates: Joi.object({
      lat: Joi.number(),
      lng: Joi.number(),
    }),
  }),
  communicationPreferences: Joi.object({
    email: Joi.object({
      marketing: Joi.boolean(),
      bookingUpdates: Joi.boolean(),
      reminders: Joi.boolean(),
      newsletters: Joi.boolean(),
      promotions: Joi.boolean(),
    }),
    sms: Joi.object({
      bookingUpdates: Joi.boolean(),
      reminders: Joi.boolean(),
      promotions: Joi.boolean(),
    }),
    push: Joi.object({
      bookingUpdates: Joi.boolean(),
      reminders: Joi.boolean(),
      newMessages: Joi.boolean(),
      promotions: Joi.boolean(),
    }),
    language: Joi.string(),
    timezone: Joi.string(),
    currency: Joi.string(),
  }),
  referralCode: Joi.string(),
  agreeToTerms: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required(),
  agreeToPrivacy: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required(),
});

const providerRegistrationSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(12).pattern(PASSWORD_COMPLEXITY).required().messages({
    'string.min': 'Password must be at least 12 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  }),
  phone: Joi.string(),
  dateOfBirth: Joi.string(),
  businessInfo: Joi.object({
    businessName: Joi.string().required(),
    businessType: Joi.string(),
    description: Joi.string(),
    tagline: Joi.string(),
    website: Joi.string(),
    establishedDate: Joi.string(),
    serviceRadius: Joi.number(),
  }).required(),
  locationInfo: Joi.object({
    primaryAddress: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      zipCode: Joi.string(),
      country: Joi.string(),
      coordinates: Joi.object({
        lat: Joi.number(),
        lng: Joi.number(),
      }),
    }).required(),
    mobileService: Joi.boolean(),
    hasFixedLocation: Joi.boolean(),
  }).required(),
  services: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      category: Joi.string().required(),
      subcategory: Joi.string(),
      description: Joi.string(),
      duration: Joi.number().required(),
      price: Joi.object({
        amount: Joi.number().required(),
        currency: Joi.string(),
        type: Joi.string(),
      }).required(),
      tags: Joi.array().items(Joi.string()),
    })
  ).min(1).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().default(false),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(12).pattern(PASSWORD_COMPLEXITY).required().messages({
    'string.min': 'Password must be at least 12 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(12).pattern(PASSWORD_COMPLEXITY).required().messages({
    'string.min': 'Password must be at least 12 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  }),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

const resendVerificationSchema = Joi.object({
  email: Joi.string().email().required(),
});

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
  const { error, value } = customerRegistrationSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const dto: CustomerRegistrationDTO = value;
  const result = await authService.registerCustomer(dto);

  // Set refresh token as HTTP-only cookie
  if (result.tokens.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
  }

  // Set access token as HTTP-only cookie for web clients
  if (result.tokens.accessToken) {
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
  const { error, value } = providerRegistrationSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const dto: ProviderRegistrationDTO = value;
  const result = await authService.registerProvider(dto);

  // Set refresh token as HTTP-only cookie
  if (result.tokens.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
  }

  // Set access token as HTTP-only cookie for web clients
  if (result.tokens.accessToken) {
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
    password: Joi.string().min(12).pattern(PASSWORD_COMPLEXITY).required().messages({
      'string.min': 'Password must be at least 12 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
    phone: Joi.string(),
  });

  const { error, value } = adminSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const dto: AdminRegistrationDTO = value;
  const creatorId = (req.user as any)?._id;
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

  // Parse user agent for device info
  const deviceInfo = parseUserAgent(userAgent);

  // Add session tracking with TTL and device fingerprinting
  const User = (await import('../models/user.model')).default;
  const crypto = (await import('crypto')).default;
  const userDoc = await User.findById(result.user.id);

  let isNewDevice = false;
  let isRecognizedDevice = true;

  if (userDoc) {
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
    const sessionId = crypto.randomBytes(32).toString('hex');
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

    // Keep only last 10 sessions
    if (userDoc.sessions.length > 10) {
      userDoc.sessions = userDoc.sessions.slice(-10);
    }

    await userDoc.save({ validateBeforeSave: false });

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
  if (result.tokens.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(cookieMaxAge));
  }

  // Set access token as HTTP-only cookie for web clients
  if (result.tokens.accessToken) {
    setAuthCookie(res, result.tokens.accessToken);
  }

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: result.user,
      ...result.roleSpecificData,
      tokens: result.tokens,
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
  });
});

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
  const user = req.user as any;
  const refreshToken = req.cookies?.refreshToken;
  const currentToken = req.headers.authorization?.replace('Bearer ', '');

  if (user?._id) {
    const User = (await import('../models/user.model')).default;
    const userDoc = await User.findById(user._id);

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
        userId: user._id.toString(),
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

  // Set refresh token cookie
  res.cookie('refreshToken', result.accessToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));

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
  const { error, value } = verifyEmailSchema.validate(req.body);
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
// Upload Profile Image
// ============================================

export const uploadProfileImage = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const file = req.file;

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

  const User = (await import('../models/user.model')).default;
  const userDoc = await User.findById(user._id).select('sessions');

  if (!userDoc) {
    throw new ApiError(404, 'User not found');
  }

  // Return sessions without the actual tokens for security
  const sessions = (userDoc.sessions || []).map(session => ({
    device: session.device,
    browser: session.browser,
    os: session.os,
    ip: session.ip,
    location: session.location,
    lastActive: session.lastActive,
    createdAt: session.createdAt,
    isCurrent: session.isCurrent,
  }));

  // Sort by lastActive descending
  sessions.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

  res.json({
    success: true,
    data: {
      sessions,
      total: sessions.length,
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
 */
export const acceptAdminInvite = asyncHandler(async (req: Request, res: Response) => {
  const { token, firstName, lastName, password, phone } = req.body;
  const adminUser = req.user as any;

  // Validate required fields
  const schema = Joi.object({
    token: Joi.string().required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    password: Joi.string().min(12).pattern(PASSWORD_COMPLEXITY).required().messages({
      'string.min': 'Password must be at least 12 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
    phone: Joi.string().allow(''),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { AdminInviteService } = await import('../services/adminInvite.service');

  // Verify and consume the token
  const invite = await AdminInviteService.verifyAndConsumeToken(
    value.token,
    adminUser._id.toString()
  );

  // Update user to admin role
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
