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

const router = express.Router();

// Rate limiting removed for development

// ========================================
// Public Routes (No Authentication Required)
// ========================================

// Registration Routes
router.post('/register/customer',
  validateCustomerRegistration,
  authController.registerCustomer
);

router.post('/register/provider',
  ...validateProviderRegistrationWithoutFiles,
  handleFileUploadError,
  authController.registerProvider
);

// Login Route
router.post('/login',
  validateLogin,
  authController.login
);

// Password Reset Routes
router.post('/forgot-password',
  validateForgotPassword,
  authController.forgotPassword
);

router.post('/reset-password',
  validateResetPassword,
  authController.resetPassword
);

// Email Verification Routes
router.post('/verify-email',
  validateEmailVerification,
  authController.verifyEmail
);

router.post('/resend-verification',
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

// Admin User Creation
router.post('/register/admin',
  authMiddleware.authenticate,
  authMiddleware.requireRole('admin'),
  authMiddleware.auditLog('admin_user_creation'),
  validateCustomerRegistration, // Reuse customer schema (simpler for admin)
  authController.registerAdmin
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
router.post('/2fa/enable',
  authMiddleware.authenticate,
  authController.enable2FA
);

// Disable 2FA
router.post('/2fa/disable',
  authMiddleware.authenticate,
  authController.disable2FA
);

export default router;