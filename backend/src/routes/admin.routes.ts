import express, { Request, Response } from 'express';
import {
  getAdminStats,
  getPendingProviders,
  getProviderForVerification,
  approveProvider,
  rejectProvider,
  getVerificationStats,
  createTestProvider,
  getAllServices,
  getPendingServices,
  updateServiceStatus,
  adminDeleteService,
  getServiceStats,
  getAllUsers,
  updateUserStatus,
  adminDeleteUser,
  getUserStats,
  getProvidersWithServices,
  batchServiceAction,
  getProviderServices,
  // Bookings Management
  getAllBookings,
  getBookingDetails,
  updateBookingStatus,
  getBookingStats,
  cancelBooking,
  // Categories Management
  getAllCategories,
  getCategoryDetails,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryFeatured,
  addSubcategory,
  getCategoryStats,
  // Review Moderation
  getReviewStats,
  getAllReviews,
  getPendingReviews,
  getFlaggedReviews,
  moderateReview,
  // Withdrawal Management
  getPendingWithdrawals,
  getWithdrawalStats,
  getWithdrawalDetails,
  approveWithdrawal,
  rejectWithdrawal,
  // Churn Management
  getChurnStats,
  getChurnAtRiskCustomers,
  getChurnOverview,
  getChurnSegments,
  refreshChurnCache,
  executeChurnRetentionAction,
} from '../controllers/admin.controller';
import { disputeService } from '../services/dispute.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import {
  enforceAdminIpAllowlist,
  enforcePlatformRequire2FA,
} from '../middleware/platformSettings.middleware';
import * as settingsService from '../services/settings.service';
import PlatformSettings from '../models/settings.model';
import Joi from 'joi';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

const router = express.Router();

// Validation schemas
const approveProviderSchema = Joi.object({
  notes: Joi.string().max(500).optional()
});

const rejectProviderSchema = Joi.object({
  reason: Joi.string().required().valid(
    'incomplete-documentation',
    'invalid-credentials',
    'business-verification-failed',
    'background-check-failed',
    'non-compliance',
    'other'
  ),
  notes: Joi.string().max(500).optional()
});

// Validation middleware
const validateApproval = (req: any, res: any, next: any) => {
  const { error } = approveProviderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

const validateRejection = (req: any, res: any, next: any) => {
  const { error } = rejectProviderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

// Validation schemas for service/booking status updates (must be before route usage)
const updateServiceStatusSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive', 'pending_review', 'rejected')
    .required()
    .messages({
      'any.only': 'Status must be one of: active, inactive, pending_review, rejected',
      'any.required': 'Status is required'
    }),
  reason: Joi.string()
    .when('status', {
      is: 'rejected',
      then: Joi.string().required().min(10).max(500).messages({
        'string.min': 'Rejection reason must be at least 10 characters',
        'string.max': 'Rejection reason cannot exceed 500 characters',
        'any.required': 'Rejection reason is required when rejecting a service'
      }),
      otherwise: Joi.string().max(500).optional()
    }),
  notes: Joi.string().max(1000).optional()
});

const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')
    .required()
    .messages({
      'any.only': 'Status must be one of: pending, confirmed, in_progress, completed, cancelled, no_show',
      'any.required': 'Status is required'
    }),
  reason: Joi.string().max(500).optional(),
  notes: Joi.string().max(1000).optional()
});

const validateServiceStatus = (req: any, res: any, next: any) => {
  const { error } = updateServiceStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

const validateBookingStatus = (req: any, res: any, next: any) => {
  const { error } = updateBookingStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

// All admin routes require authentication and rate limiting
router.use(authenticate);
router.use(requireRole('admin'));
router.use(enforceAdminIpAllowlist);
router.use(enforcePlatformRequire2FA);
router.use(adminLimiter); // Apply rate limiting to all admin routes

// Dashboard Stats
router.get('/stats', getAdminStats);

// Churn & retention (admin panel)
router.get('/churn/stats', getChurnStats);
router.get('/churn/at-risk', getChurnAtRiskCustomers);
router.get('/churn/overview', getChurnOverview);
router.get('/churn/segments', getChurnSegments);
router.post('/churn/refresh', refreshChurnCache);
router.post('/churn/execute/:userId', executeChurnRetentionAction);

// Provider verification routes
router.get('/providers/pending', getPendingProviders);
router.get('/providers/stats', getVerificationStats);
router.get('/providers/:id', getProviderForVerification);
router.post('/providers/:id/approve', validateApproval, approveProvider);
router.post('/providers/:id/reject', validateRejection, rejectProvider);

// Test routes
router.post('/test/create-provider', createTestProvider);

// ========================================
// Service Management Routes
// ========================================

router.get('/services', getAllServices);
router.get('/services/pending', getPendingServices);
router.get('/services/stats', getServiceStats);
router.patch('/services/:id/status', validateServiceStatus, updateServiceStatus);
router.delete('/services/:id', adminDeleteService);

// ========================================
// User Management Routes
// ========================================

// Explicit role validation middleware for user management operations
const requireAdminRole = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin role required for user management operations',
    });
  }
  next();
};

// Apply explicit role check to user management routes
router.get('/users', requireAdminRole, getAllUsers);
router.get('/users/stats', requireAdminRole, getUserStats);
router.patch('/users/:id/status', requireAdminRole, updateUserStatus);
router.delete('/users/:id', requireAdminRole, adminDeleteUser);

// ========================================
// Enhanced Provider-Service Management Routes
// ========================================

router.get('/providers-with-services', getProvidersWithServices);
router.get('/providers/:id/services', getProviderServices);
router.post('/services/batch-action', batchServiceAction);

// ========================================
// Bookings Management Routes
// ========================================

router.get('/bookings', getAllBookings);
router.get('/bookings/stats', getBookingStats);
router.get('/bookings/:id', getBookingDetails);
router.patch('/bookings/:id/status', validateBookingStatus, updateBookingStatus);
router.post('/bookings/:id/cancel', cancelBooking);

// ========================================
// Categories Management Routes
// ========================================

router.get('/categories', getAllCategories);
router.get('/categories/stats', getCategoryStats);
router.get('/categories/:id', getCategoryDetails);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);
router.post('/categories/:id/featured', toggleCategoryFeatured);
router.post('/categories/:id/subcategories', addSubcategory);

// ========================================
// Maintenance Mode Routes
// ========================================

const maintenanceSchema = Joi.object({
  enabled: Joi.boolean().required(),
  message: Joi.string().max(500).optional(),
  estimatedDuration: Joi.string().max(100).optional(),
});

// GET /api/admin/maintenance - Get current maintenance mode status
router.get('/maintenance', asyncHandler(async (req: Request, res: Response) => {
  const settings = await PlatformSettings.getSettings();
  let updatedByName: string | null = null;

  if (settings.maintenanceUpdatedBy) {
    const User = (await import('../models/user.model')).default;
    const admin = await User.findById(settings.maintenanceUpdatedBy).select('firstName lastName email');
    if (admin) {
      updatedByName = `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email;
    }
  }

  res.json({
    success: true,
    data: {
      maintenanceMode: settings.maintenanceMode || false,
      message: settings.maintenanceMessage || 'The platform is currently under maintenance.',
      estimatedDuration: settings.maintenanceEstimatedDuration || null,
      updatedAt: settings.maintenanceUpdatedAt || null,
      updatedBy: settings.maintenanceUpdatedBy || null,
      updatedByName,
    },
  });
}));

// PUT /api/admin/maintenance - Toggle maintenance mode
router.put('/maintenance', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = maintenanceSchema.validate(req.body);

  if (error) {
    throw ApiError.badRequest(
      error.details[0].message,
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const adminUser = (req as any).user;

  const settings = await settingsService.updateSettings(
    {
      maintenanceMode: value.enabled,
      maintenanceMessage:
        value.message || 'The platform is currently under maintenance. Please try again later.',
      maintenanceEstimatedDuration: value.estimatedDuration || '',
    },
    adminUser._id?.toString(),
    'Maintenance mode updated via admin console'
  );

  logger.info('Maintenance mode updated', {
    action: 'MAINTENANCE_MODE_UPDATED',
    enabled: value.enabled,
    message: value.message,
    updatedBy: adminUser._id,
    email: adminUser.email,
  });

  res.json({
    success: true,
    message: `Maintenance mode ${value.enabled ? 'enabled' : 'disabled'} successfully`,
    data: {
      maintenanceMode: settings.maintenanceMode,
      message: settings.maintenanceMessage,
      estimatedDuration: settings.maintenanceEstimatedDuration,
      updatedAt: settings.maintenanceUpdatedAt,
    },
  });
}));

// ========================================
// Review Moderation Routes
// ========================================

// GET /api/admin/reviews - List all reviews with filters
router.get('/reviews', getAllReviews);

// GET /api/admin/reviews/stats - Get review statistics
router.get('/reviews/stats', getReviewStats);

router.get('/reviews/pending', getPendingReviews);
router.get('/reviews/flagged', getFlaggedReviews);
router.patch('/reviews/:id/moderate', moderateReview);

// ========================================
// Disputes Management Routes (Alias for /api/disputes)
// ========================================

router.get('/disputes', asyncHandler(async (req: Request, res: Response) => {
  const filters = {
    status: req.query.status as any,
    category: req.query.category as string,
    priority: req.query.priority as string,
    assignedTo: req.query.assignedTo as string,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    search: req.query.search as string,
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
  };

  const result = await disputeService.listDisputes(filters);

  res.json({
    success: true,
    data: result.disputes,
    pagination: result.pagination,
  });
}));

router.get('/disputes/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await disputeService.getDisputeStats(
    req.query.startDate as string,
    req.query.endDate as string
  );

  res.json({
    success: true,
    data: stats,
  });
}));

// ========================================
// Withdrawal Management Routes
// ========================================

// Validation schemas for withdrawal operations
const rejectWithdrawalSchema = Joi.object({
  reason: Joi.string().required().min(10).max(500).messages({
    'string.min': 'Rejection reason must be at least 10 characters',
    'string.max': 'Rejection reason cannot exceed 500 characters',
    'any.required': 'Rejection reason is required'
  })
});

const approveWithdrawalSchema = Joi.object({
  notes: Joi.string().max(500).optional(),
});

// Validation middleware for withdrawal rejection
const validateWithdrawalRejection = (req: any, res: any, next: any) => {
  const { error } = rejectWithdrawalSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

// Validation middleware for withdrawal approval
const validateWithdrawalApproval = (req: any, res: any, next: any) => {
  const { error } = approveWithdrawalSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  next();
};

// GET /api/admin/withdrawals - List all withdrawals with filters
router.get('/withdrawals', getPendingWithdrawals);

// GET /api/admin/withdrawals/stats - Get withdrawal statistics
router.get('/withdrawals/stats', getWithdrawalStats);

// GET /api/admin/withdrawals/:id - Get withdrawal details
router.get('/withdrawals/:id', getWithdrawalDetails);

// POST /api/admin/withdrawals/:id/approve - Approve a withdrawal
router.post('/withdrawals/:id/approve', validateWithdrawalApproval, approveWithdrawal);

// POST /api/admin/withdrawals/:id/reject - Reject a withdrawal
router.post('/withdrawals/:id/reject', validateWithdrawalRejection, rejectWithdrawal);

export default router;