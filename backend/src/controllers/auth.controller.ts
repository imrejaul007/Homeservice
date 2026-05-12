import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';
import Joi from 'joi';
import { CustomerRegistrationDTO, ProviderRegistrationDTO, AdminRegistrationDTO, ProfileUpdatesDTO } from '../dto/auth.dto';

// ============================================
// Validation Schemas
// ============================================

const customerRegistrationSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string(),
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
});

const providerRegistrationSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
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
  newPassword: Joi.string().min(8).required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
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
    password: Joi.string().min(8).required(),
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
  const rememberMe = value.rememberMe || false;
  const result = await authService.login(value.email, value.password, clientIP, rememberMe);

  // Set refresh token as HTTP-only cookie
  // Cookie expiry: 30 days if rememberMe, 7 days otherwise
  const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  if (result.tokens.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(cookieMaxAge));
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
    },
  });
});

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

  if (user?._id) {
    await authService.logout(user._id.toString(), refreshToken);
  }

  res.clearCookie('refreshToken');

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
    await authService.logoutAll(user._id.toString());
  }

  res.clearCookie('refreshToken');

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
};
