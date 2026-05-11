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
  handleFileUploadError
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

// Change Password
router.post('/change-password',
  authMiddleware.authenticate,
  validateChangePassword,
  authController.changePassword
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

export default router;