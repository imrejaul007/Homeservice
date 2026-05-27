import express from 'express';
import authController from '../controllers/auth.controller';
import authMiddleware from '../middleware/auth.middleware';
import {
  validateCustomerRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateEmailVerification,
  validateResendVerification,
  validateRefreshToken,
  validateProviderRegistrationWithoutFiles,
  validateProfileUpdateWithFiles,
  handleFileUploadError,
  uploadConfig
} from '../middleware/validation.middleware';
import { authLimiter, passwordResetLimiter, otpLimiter, twoFactorVerifyLimiter } from '../middleware/rateLimiter';
import { verifyCaptcha, getCaptchaSiteKey } from '../middleware/captcha.middleware';

const router = express.Router();

// ========================================
// Public Routes (No Authentication Required)
// ========================================

// CAPTCHA configuration endpoint (public - returns site key)
router.get('/captcha-config', getCaptchaSiteKey);

// Registration Routes
router.post('/register/customer',
  authLimiter,
  verifyCaptcha({ required: true, skipIfDisabled: true }),
  validateCustomerRegistration,
  authController.registerCustomer
);

router.post('/register/provider',
  authLimiter,
  verifyCaptcha({ required: true, skipIfDisabled: true }),
  ...validateProviderRegistrationWithoutFiles,
  handleFileUploadError,
  authController.registerProvider
);

// Login Route
router.post('/login',
  authLimiter,
  verifyCaptcha({ required: true, skipIfDisabled: true }),
  validateLogin,
  authController.login
);

// Password Reset Routes
router.post('/forgot-password',
  passwordResetLimiter,
  verifyCaptcha({ required: true, skipIfDisabled: true }),
  validateForgotPassword,
  authController.forgotPassword
);

router.post('/reset-password',
  passwordResetLimiter,
  verifyCaptcha({ required: true, skipIfDisabled: true }),
  validateResetPassword,
  authController.resetPassword
);

// Email Verification Routes
router.post('/verify-email',
  otpLimiter,
  verifyCaptcha({ required: false, skipIfDisabled: true }),
  validateEmailVerification,
  authController.verifyEmail
);

router.post('/resend-verification',
  otpLimiter,
  verifyCaptcha({ required: true, skipIfDisabled: true }),
  validateResendVerification,
  authController.resendVerificationEmail
);

// Token Management
router.post('/refresh-token',
  validateRefreshToken,
  authController.refreshToken
);

// CSRF Token - Get a new CSRF token for form submissions
router.get('/csrf-token',
  authMiddleware.provideCsrfToken
);

// ========================================
// Protected Routes (Authentication Required)
// ========================================

// Current User Management
router.get('/me',
  authMiddleware.authenticate,
  authController.getCurrentUser
);

router.patch('/me',
  authMiddleware.authenticate,
  ...validateProfileUpdateWithFiles,
  handleFileUploadError,
  authController.updateProfile
);

// Logout Routes - Use optional auth (logout should work even with expired tokens)
router.post('/logout',
  authMiddleware.optionalAuth,
  authController.logout
);

router.post('/logout-all',
  authMiddleware.optionalAuth,
  authController.logoutAll
);

// Login History
router.get('/login-history',
  authMiddleware.authenticate,
  authController.getLoginHistory
);

// ============================================
// Device Management Routes
// ============================================

// Get all devices for the current user
router.get('/devices',
  authMiddleware.authenticate,
  authController.getDevices
);

// Remove a specific device
router.delete('/devices/:fingerprint',
  authMiddleware.authenticate,
  authController.removeDevice
);

// Remove all devices except current session
router.delete('/devices',
  authMiddleware.authenticate,
  authController.removeAllDevices
);

// Trust a device (skip 2FA for this device)
router.post('/devices/:fingerprint/trust',
  authMiddleware.authenticate,
  authController.trustDevice
);

// Logout All Devices (keeps current session)
router.post('/logout-all-devices',
  authMiddleware.authenticate,
  authController.logoutAllDevices
);

// Change Password
router.post('/change-password',
  authMiddleware.authenticate,
  validateChangePassword,
  authController.changePassword
);

// Profile Image Upload
router.post('/profile-image',
  authMiddleware.authenticate,
  uploadConfig.profileUpdate,
  handleFileUploadError,
  authController.uploadProfileImage
);

// Export User Data
router.get('/export-data',
  authMiddleware.authenticate,
  authController.exportUserData
);

// Delete Account
router.delete('/account',
  authMiddleware.authenticate,
  authController.deleteAccount
);

// ========================================
// Admin Only Routes
// ========================================

import { requirePermission } from '../middleware/rbac.middleware';

// Admin User Creation - requires admin:all permission
router.post('/register/admin',
  authMiddleware.authenticate,
  authMiddleware.requireRole('admin'),
  requirePermission('admin:all'),
  authMiddleware.auditLog('admin_user_creation'),
  validateCustomerRegistration, // Reuse customer schema (simpler for admin)
  authController.registerAdmin
);

// ============================================
// Admin Invite Management Routes (Task #66 - SECURITY FIX)
// Uses crypto.randomBytes(32) instead of predictable tokens
// ============================================

// Generate admin invite token - requires admin role
router.post('/admin/invite',
  authMiddleware.authenticate,
  authMiddleware.requireRole('admin'),
  authController.generateAdminInvite
);

// Accept admin invite token - requires authentication
router.post('/admin/accept-invite',
  authMiddleware.authenticate,
  authController.acceptAdminInvite
);

// List pending admin invites - requires admin role
router.get('/admin/invites',
  authMiddleware.authenticate,
  authMiddleware.requireRole('admin'),
  authController.listAdminInvites
);

// Revoke admin invite token - requires admin role
router.delete('/admin/invites/:token',
  authMiddleware.authenticate,
  authMiddleware.requireRole('admin'),
  authController.revokeAdminInvite
);

// Health Check Route
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Authentication service is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ========================================
// Two-Factor Authentication Routes
// ========================================

// Get 2FA status
router.get('/2fa/status',
  authMiddleware.authenticate,
  authController.get2FAStatus
);

// Setup 2FA (get secret and QR code)
router.post('/2fa/setup',
  authMiddleware.authenticate,
  authController.setup2FA
);

// Enable 2FA (verify code first)
// SECURITY: Rate limited to prevent brute force attacks on TOTP codes
router.post('/2fa/enable',
  authMiddleware.authenticate,
  twoFactorVerifyLimiter,
  authController.enable2FA
);

// Disable 2FA
router.post('/2fa/disable',
  authMiddleware.authenticate,
  authController.disable2FA
);

export default router;