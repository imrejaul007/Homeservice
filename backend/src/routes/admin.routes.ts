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
  getChurnStats
} from '../controllers/admin.controller';
import { disputeService } from '../services/dispute.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
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

// All admin routes require authentication and rate limiting
router.use(authenticate);
router.use(requireRole('admin'));
router.use(adminLimiter); // Apply rate limiting to all admin routes

// Dashboard Stats
router.get('/stats', getAdminStats);

// Churn Stats
router.get('/churn/stats', getChurnStats);

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
router.patch('/services/:id/status', updateServiceStatus);
router.delete('/services/:id', adminDeleteService);

// ========================================
// User Management Routes
// ========================================

router.get('/users', getAllUsers);
router.get('/users/stats', getUserStats);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', adminDeleteUser);

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
router.patch('/bookings/:id/status', updateBookingStatus);
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

  res.json({
    success: true,
    data: {
      maintenanceMode: settings.maintenanceMode || false,
      message: settings.maintenanceMessage || 'The platform is currently under maintenance.',
      estimatedDuration: settings.maintenanceEstimatedDuration || null,
      updatedAt: settings.maintenanceUpdatedAt || null,
      updatedBy: settings.maintenanceUpdatedBy || null,
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

  const settings = await PlatformSettings.findOne();

  if (!settings) {
    throw ApiError.notFound('Settings not found', ERROR_CODES.NOT_FOUND);
  }

  const adminUser = (req as any).user;

  settings.maintenanceMode = value.enabled;
  settings.maintenanceMessage = value.message || 'The platform is currently under maintenance. Please try again later.';
  settings.maintenanceEstimatedDuration = value.estimatedDuration || null;
  settings.maintenanceUpdatedAt = new Date();
  settings.maintenanceUpdatedBy = adminUser._id;

  await settings.save();

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

// GET /api/admin/withdrawals - List all withdrawals with filters
router.get('/withdrawals', getPendingWithdrawals);

// GET /api/admin/withdrawals/stats - Get withdrawal statistics
router.get('/withdrawals/stats', getWithdrawalStats);

// GET /api/admin/withdrawals/:id - Get withdrawal details
router.get('/withdrawals/:id', getWithdrawalDetails);

// POST /api/admin/withdrawals/:id/approve - Approve a withdrawal
router.post('/withdrawals/:id/approve', approveWithdrawal);

// POST /api/admin/withdrawals/:id/reject - Reject a withdrawal
router.post('/withdrawals/:id/reject', validateWithdrawalRejection, rejectWithdrawal);

export default router;