import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { checkIndexHealth, createAllIndexes, getIndexSummary } from '../models/indexes';
import {
  getAdminStats,
  getPendingProviders,
  getProviderForVerification,
  approveProvider,
  rejectProvider,
  suspendProvider,
  reactivateProvider,
  searchProviders,
  batchProviderAction,
  getVerificationStats,
  getAllServices,
  getPendingServices,
  updateServiceStatus,
  adminDeleteService,
  getServiceStats,
  searchServices,
  getAllUsers,
  updateUserStatus,
  adminDeleteUser,
  getUserStats,
  getProvidersWithServices,
  batchServiceAction,
  getProviderServices,
  // Bookings Management
  getAllBookings,
  searchBookings,
  getBookingDetails,
  updateBookingStatus,
  getBookingStats,
  cancelBooking,
  batchRefund,
  getRefundAnalytics,
  reindexSearch,
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
  bulkModerateReviews,
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
  // Real-time metrics
  getRealtimeMetrics,
  // Provider Bookings
  getProviderBookings,
  // User-Provider Relationship
  getUserProviderRelationship,
} from '../controllers/admin.controller';
import { chatService } from '../services/chat.service';
import { notificationService } from '../services/notification.service';
import Message from '../models/message.model';
import ChatRoom from '../models/chatRoom.model';
import User from '../models/user.model';
import { getProviderEarnings } from '../controllers/earnings.controller';
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
import adminAnalyticsRoutes from './adminAnalytics.routes';

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

// Real-time metrics (must come before /:id routes)
router.get('/realtime-metrics', getRealtimeMetrics);

// Platform analytics aggregates
router.use('/analytics', adminAnalyticsRoutes);

// Provider verification routes
router.get('/providers/pending', getPendingProviders);
router.get('/providers/stats', getVerificationStats);
router.get('/providers/search', searchProviders);
router.get('/providers/:id', getProviderForVerification);
router.post('/providers/:id/approve', validateApproval, approveProvider);
router.post('/providers/:id/reject', validateRejection, rejectProvider);
router.post('/providers/:id/suspend', suspendProvider);
router.post('/providers/:id/reactivate', reactivateProvider);
router.post('/providers/batch', batchProviderAction);

// Provider Bookings Management
router.get('/providers/:id/bookings', getProviderBookings);

// Provider Earnings (Admin only)
router.get('/providers/:id/earnings', getProviderEarnings);

// ========================================
// User-Provider Relationship Routes
// ========================================

// Get comprehensive relationship data between a customer and provider
router.get('/relationships/user-provider', getUserProviderRelationship);

// ========================================
// Service Management Routes
// ========================================

router.get('/services/search', searchServices);
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
router.get('/bookings/search', searchBookings);
router.get('/bookings/stats', getBookingStats);
router.get('/bookings/:id', getBookingDetails);
router.patch('/bookings/:id/status', validateBookingStatus, updateBookingStatus);
router.post('/bookings/:id/cancel', cancelBooking);
router.post('/bookings/batch-refund', batchRefund);
router.post('/bookings/:id/refund', asyncHandler(async (req: Request, res: Response) => {
  req.body = {
    ...req.body,
    reason: req.body?.reason || 'Admin-initiated refund',
    refundPolicy: req.body?.refundPolicy || 'full',
    bookingIds: [req.params.id],
  };
  return batchRefund(req, res, () => undefined);
}));
router.post('/bookings/export', asyncHandler(async (req: Request, res: Response) => {
  const Booking = (await import('../models/booking.model')).default;
  const {
    search,
    status,
    provider,
    customer,
    dateFrom,
    dateTo,
  } = req.body ?? {};

  const query: Record<string, unknown> = { isDeleted: { $ne: true } };

  if (search && typeof search === 'string') {
    query.$or = [
      { bookingNumber: { $regex: search, $options: 'i' } },
      { 'customerInfo.email': { $regex: search, $options: 'i' } },
      { 'customerInfo.firstName': { $regex: search, $options: 'i' } },
    ];
  }

  if (status && typeof status === 'string' && status !== 'all') {
    if (status === 'active') {
      query.status = { $in: ['pending', 'confirmed', 'in_progress'] };
    } else {
      query.status = status;
    }
  }

  if (provider && typeof provider === 'string') {
    query.providerId = provider;
  }

  if (customer && typeof customer === 'string') {
    query.customerId = customer;
  }

  if (dateFrom || dateTo) {
    query.scheduledDate = {};
    if (dateFrom) {
      (query.scheduledDate as Record<string, Date>).$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      (query.scheduledDate as Record<string, Date>).$lte = new Date(dateTo as string);
    }
  }

  const bookings = await Booking.find(query)
    .populate('customerId', 'firstName lastName email')
    .populate('providerId', 'firstName lastName email businessName')
    .populate('serviceId', 'name')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const headers = ['Booking Number', 'Status', 'Customer', 'Provider', 'Service', 'Scheduled Date', 'Amount', 'Currency'];
  const rows = bookings.map((booking) => {
    const customerUser = booking.customerId as { firstName?: string; lastName?: string; email?: string } | null;
    const providerUser = booking.providerId as { firstName?: string; lastName?: string; businessName?: string } | null;
    const service = booking.serviceId as { name?: string } | null;
    const customerName = customerUser
      ? `${customerUser.firstName ?? ''} ${customerUser.lastName ?? ''}`.trim() || customerUser.email
      : '';
    const providerName = providerUser?.businessName
      || `${providerUser?.firstName ?? ''} ${providerUser?.lastName ?? ''}`.trim();
    const amount = booking.pricing?.totalAmount ?? 0;
    const currency = booking.pricing?.currency ?? 'AED';

    return [
      booking.bookingNumber ?? booking._id,
      booking.status,
      customerName,
      providerName,
      service?.name ?? '',
      booking.scheduledDate ? new Date(booking.scheduledDate).toISOString() : '',
      amount,
      currency,
    ].map(escapeCsv).join(',');
  });

  const csv = [headers.map(escapeCsv).join(','), ...rows].join('\n');
  const filename = `bookings-export-${new Date().toISOString().split('T')[0]}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}));
router.get('/refunds/analytics', requireAdminRole, getRefundAnalytics);

// Search Management
router.post('/search/reindex', requireAdminRole, reindexSearch);

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
router.post('/reviews/bulk-moderate', bulkModerateReviews);

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

/**
 * @route   GET /api/admin/disputes/search
 * @desc    Search disputes by dispute number, customer name, or provider name
 * @access  Private (Admin only)
 * @query   q - Search query (min 2 characters)
 * @query   limit - Maximum results to return (default 10, max 20)
 */
router.get('/disputes/search', asyncHandler(async (req: Request, res: Response) => {
  const { q, limit } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw ApiError.badRequest('Search query must be at least 2 characters', [], 'VALIDATION_ERROR');
  }

  const maxLimit = Math.min(parseInt(limit as string) || 10, 20);
  const results = await disputeService.searchDisputes(q.trim(), maxLimit);

  res.json({
    success: true,
    data: {
      items: results,
      count: results.length,
    },
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

// ========================================
// Database Index Management Routes
// ========================================

/**
 * GET /api/admin/indexes/health
 * Check the health of database indexes
 * Returns missing or problematic indexes
 */
router.get('/indexes/health', asyncHandler(async (req: Request, res: Response) => {
  const health = await checkIndexHealth();

  res.json({
    success: true,
    data: {
      healthy: health.healthy,
      summary: health.summary,
      issues: health.issues.length > 0 ? health.issues : undefined,
      message: health.healthy
        ? 'All indexes are healthy'
        : `${health.issues.length} index issue(s) found`
    }
  });
}));

/**
 * GET /api/admin/indexes/summary
 * Get a summary of all configured indexes
 * Useful for documentation and debugging
 */
router.get('/indexes/summary', asyncHandler(async (req: Request, res: Response) => {
  const summary = getIndexSummary();

  res.json({
    success: true,
    data: summary.map(model => ({
      modelName: model.modelName,
      collectionName: model.collectionName,
      indexCount: model.indexes.length,
      indexes: model.indexes.map(idx => ({
        type: idx.type,
        description: idx.description,
        key: idx.key,
        options: idx.options
      }))
    }))
  });
}));

/**
 * POST /api/admin/indexes/recreate
 * Force recreation of all indexes (admin only)
 * Use with caution - can be slow on large collections
 */
router.post('/indexes/recreate', asyncHandler(async (req: Request, res: Response) => {
  // Only allow in non-production environments or with explicit confirmation
  if (process.env.NODE_ENV === 'production' && !req.body.confirm) {
    throw new ApiError(
      400,
      'Index recreation requires explicit confirmation in production',
      [],
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const results = await createAllIndexes({ verbose: true });

  res.json({
    success: true,
    data: {
      message: 'Index recreation completed',
      results: results.models,
      summary: {
        totalCreated: results.totalCreated,
        totalSkipped: results.totalSkipped,
        totalErrors: results.totalErrors
      }
    }
  });
}));

// ========================================
// Admin-to-Provider Messaging Routes
// ========================================

/**
 * Validation schema for sending admin message to provider
 */
const adminMessageSchema = Joi.object({
  message: Joi.string().required().min(1).max(5000).messages({
    'string.empty': 'Message content is required',
    'any.required': 'Message content is required',
    'string.min': 'Message must be at least 1 character',
    'string.max': 'Message cannot exceed 5000 characters'
  }),
  type: Joi.string().valid('warning', 'info', 'urgent').default('info').messages({
    'any.only': 'Message type must be one of: warning, info, urgent'
  }),
  attachments: Joi.array().items(
    Joi.object({
      url: Joi.string().required(),
      filename: Joi.string().required(),
      mimeType: Joi.string().required(),
      size: Joi.number().positive().required(),
      thumbnailUrl: Joi.string().optional()
    })
  ).max(10).optional()
});

/**
 * Validation schema for fetching provider messages
 */
const providerMessagesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  includeDeleted: Joi.boolean().default(false)
});

/**
 * POST /api/admin/providers/:id/message
 * Send a message from admin to a provider
 * Creates or uses existing conversation between admin and provider
 */
router.post(
  '/providers/:id/message',
  asyncHandler(async (req: Request, res: Response) => {
    const adminUser = (req as any).user;
    const providerId = req.params.id;

    // Validate provider ID
    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Valid provider ID is required', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify provider exists and has 'provider' role
    const provider = await User.findById(providerId);
    if (!provider) {
      throw ApiError.notFound('Provider not found', ERROR_CODES.NOT_FOUND);
    }
    if (provider.role !== 'provider') {
      throw ApiError.badRequest('Target user is not a provider', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Validate message body
    const { error, value } = adminMessageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      throw ApiError.badRequest(
        error.details.map(d => d.message).join('; '),
        error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Find or create direct chat room between admin and provider
    const chatRoom = await ChatRoom.findOrCreateDirectChat(
      new mongoose.Types.ObjectId(adminUser._id.toString()),
      new mongoose.Types.ObjectId(providerId)
    );

    // Create message with system-style metadata for admin messages
    const message = new Message({
      chatRoomId: chatRoom._id,
      senderId: new mongoose.Types.ObjectId(adminUser._id.toString()),
      receiverId: new mongoose.Types.ObjectId(providerId),
      content: value.message,
      type: 'text',
      status: 'sent',
      attachments: value.attachments,
      metadata: {
        isAdminMessage: true,
        adminMessageType: value.type,
        deviceType: req.headers['x-device-type'] as 'mobile' | 'desktop' | 'tablet' | undefined,
        userAgent: req.headers['user-agent']
      }
    });

    await message.save();

    // Update chat room with last message
    await ChatRoom.updateLastMessage(
      chatRoom._id.toString(),
      message._id as mongoose.Types.ObjectId,
      value.message.substring(0, 100)
    );

    // Increment unread count for provider
    await chatRoom.incrementUnreadCount(new mongoose.Types.ObjectId(providerId));

    // Emit socket event for real-time delivery
    const { getSocketServer } = await import('../socket');
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitToChatRoom(chatRoom._id.toString(), 'message:new', {
        messageId: message._id.toString(),
        chatRoomId: chatRoom._id.toString(),
        senderId: adminUser._id.toString(),
        receiverId: providerId,
        content: value.message,
        type: 'text',
        attachments: value.attachments,
        status: 'sent',
        metadata: message.metadata,
        createdAt: message.createdAt
      });
    }

    // Send notification to provider
    const adminName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Admin';
    const notificationTitle = value.type === 'urgent' ? 'Urgent Message from Admin' :
                             value.type === 'warning' ? 'Warning from Admin' :
                             'Message from Admin';

    await notificationService.createInAppNotification({
      recipientId: providerId,
      type: 'message_received',
      title: notificationTitle,
      message: `${adminName}: ${value.message.substring(0, 100)}${value.message.length > 100 ? '...' : ''}`,
      actionText: 'View Message',
      actionUrl: '/provider/messages',
      metadata: {
        chatRoomId: chatRoom._id.toString(),
        senderId: adminUser._id.toString(),
        messageId: message._id.toString(),
        isAdminMessage: true,
        adminMessageType: value.type
      }
    });

    logger.info('Admin message sent to provider', {
      context: 'AdminRoutes',
      action: 'ADMIN_SEND_MESSAGE',
      adminId: adminUser._id.toString(),
      providerId,
      messageId: message._id.toString(),
      chatRoomId: chatRoom._id.toString(),
      messageType: value.type
    });

    res.status(201).json({
      success: true,
      data: {
        conversationId: chatRoom._id.toString(),
        messageId: message._id.toString()
      }
    });
  })
);

/**
 * GET /api/admin/providers/:id/messages
 * Get message history between admin and provider
 * Includes pagination support
 */
router.get(
  '/providers/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const adminUser = (req as any).user;
    const providerId = req.params.id;

    // Validate provider ID
    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Valid provider ID is required', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify provider exists
    const provider = await User.findById(providerId);
    if (!provider) {
      throw ApiError.notFound('Provider not found', ERROR_CODES.NOT_FOUND);
    }

    // Validate query params
    const { error, value } = providerMessagesQuerySchema.validate(req.query, {
      stripUnknown: true
    });
    if (error) {
      throw ApiError.badRequest(
        error.details.map(d => d.message).join('; '),
        error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const { page, limit, includeDeleted } = value;
    const skip = (page - 1) * limit;

    // Find the direct chat room between admin and provider
    const chatRoom = await ChatRoom.findOne({
      type: 'direct',
      'participants.userId': { $all: [
        new mongoose.Types.ObjectId(adminUser._id.toString()),
        new mongoose.Types.ObjectId(providerId)
      ]},
      status: { $ne: 'blocked' },
      isDeleted: false
    });

    // Build query for messages
    const messageQuery: Record<string, unknown> = {};

    if (chatRoom) {
      messageQuery.chatRoomId = chatRoom._id;
    } else {
      // No conversation exists - return empty results
      res.json({
        success: true,
        data: {
          items: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
            hasNext: false,
            hasPrev: false,
            nextPage: null,
            prevPage: null
          }
        }
      });
      return;
    }

    if (!includeDeleted) {
      messageQuery.isDeleted = false;
    }

    // Get total count for pagination
    const total = await Message.countDocuments(messageQuery);
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // Fetch messages with pagination
    const messages = await Message.find(messageQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'firstName lastName avatar role')
      .populate('receiverId', 'firstName lastName avatar role')
      .lean();

    // Reverse to show oldest first
    const messagesReversed = messages.reverse();

    logger.info('Admin fetched provider messages', {
      context: 'AdminRoutes',
      action: 'ADMIN_GET_MESSAGES',
      adminId: adminUser._id.toString(),
      providerId,
      chatRoomId: chatRoom._id.toString(),
      messageCount: messages.length,
      page
    });

    res.json({
      success: true,
      data: {
        items: messagesReversed,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
          hasNext,
          hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null
        }
      }
    });
  })
);

/**
 * GET /api/admin/providers/:id/conversation
 * Get conversation details between admin and provider
 */
router.get(
  '/providers/:id/conversation',
  asyncHandler(async (req: Request, res: Response) => {
    const adminUser = (req as any).user;
    const providerId = req.params.id;

    // Validate provider ID
    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Valid provider ID is required', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Find the direct chat room between admin and provider
    const chatRoom = await ChatRoom.findOne({
      type: 'direct',
      'participants.userId': { $all: [
        new mongoose.Types.ObjectId(adminUser._id.toString()),
        new mongoose.Types.ObjectId(providerId)
      ]},
      status: { $ne: 'blocked' },
      isDeleted: false
    })
      .populate('participants.userId', 'firstName lastName avatar role email phone');

    if (!chatRoom) {
      throw ApiError.notFound('No conversation found with this provider', ERROR_CODES.NOT_FOUND);
    }

    // Get unread count for admin in this conversation
    const unreadCount = await Message.countDocuments({
      chatRoomId: chatRoom._id,
      receiverId: adminUser._id,
      senderId: new mongoose.Types.ObjectId(providerId),
      status: { $ne: 'read' },
      isDeleted: false
    });

    // Get last message
    const lastMessage = await Message.findOne({
      chatRoomId: chatRoom._id,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .populate('senderId', 'firstName lastName avatar role')
      .lean();

    res.json({
      success: true,
      data: {
        conversationId: chatRoom._id.toString(),
        provider: {
          _id: providerId,
          firstName: (chatRoom.participants.find(
            (p: any) => p.userId._id.toString() === providerId
          )?.userId as any)?.firstName,
          lastName: (chatRoom.participants.find(
            (p: any) => p.userId._id.toString() === providerId
          )?.userId as any)?.lastName,
          avatar: (chatRoom.participants.find(
            (p: any) => p.userId._id.toString() === providerId
          )?.userId as any)?.avatar,
          email: (chatRoom.participants.find(
            (p: any) => p.userId._id.toString() === providerId
          )?.userId as any)?.email,
          phone: (chatRoom.participants.find(
            (p: any) => p.userId._id.toString() === providerId
          )?.userId as any)?.phone
        },
        status: chatRoom.status,
        unreadCount,
        lastMessage: lastMessage ? {
          _id: lastMessage._id,
          content: lastMessage.content,
          type: lastMessage.type,
          senderId: lastMessage.senderId,
          createdAt: lastMessage.createdAt
        } : null,
        createdAt: chatRoom.createdAt,
        updatedAt: chatRoom.updatedAt
      }
    });
  })
);

// ============================================
// Custom Report Routes
// ============================================
import {
  generateCustomReport,
  getReportTemplates,
  createReportTemplate,
  getReportTemplateById,
  updateReportTemplate,
  deleteReportTemplate,
  getScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  toggleScheduledReport,
} from '../controllers/report.controller';

// Custom report generation
router.post('/reports/generate', authenticate, requireRole('admin'), adminLimiter, generateCustomReport);

// Report templates
router.get('/reports/templates', authenticate, requireRole('admin'), getReportTemplates);
router.post('/reports/templates', authenticate, requireRole('admin'), createReportTemplate);
router.get('/reports/templates/:id', authenticate, requireRole('admin'), getReportTemplateById);
router.patch('/reports/templates/:id', authenticate, requireRole('admin'), updateReportTemplate);
router.delete('/reports/templates/:id', authenticate, requireRole('admin'), deleteReportTemplate);

// Scheduled reports
router.get('/reports/scheduled', authenticate, requireRole('admin'), getScheduledReports);
router.post('/reports/scheduled', authenticate, requireRole('admin'), createScheduledReport);
router.patch('/reports/scheduled/:id', authenticate, requireRole('admin'), updateScheduledReport);
router.delete('/reports/scheduled/:id', authenticate, requireRole('admin'), deleteScheduledReport);
router.post('/reports/scheduled/:id/toggle', authenticate, requireRole('admin'), toggleScheduledReport);

export default router;