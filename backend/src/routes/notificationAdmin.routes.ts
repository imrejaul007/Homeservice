import { Router, Request, Response } from 'express';
import User from '../models/user.model';
import BookingNotification from '../models/bookingNotification.model';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

const router = Router();

// Apply rate limiting to all notification admin routes
router.use(adminLimiter);

// ============================================
// Validation Schemas
// ============================================

const broadcastSchema = Joi.object({
  type: Joi.string().required().valid('all', 'providers', 'customers'),
  channels: Joi.array()
    .items(Joi.string().valid('in_app', 'email', 'push', 'sms'))
    .min(1)
    .required(),
  title: Joi.string().required().min(1).max(200),
  message: Joi.string().required().min(1).max(2000),
  data: Joi.object().optional(),
  scheduledAt: Joi.date().iso().greater('now').optional(),
});

const broadcastHistoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid('all', 'providers', 'customers').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

// ============================================
// Broadcast Notification
// ============================================

interface BroadcastPayload {
  type: 'all' | 'providers' | 'customers';
  channels: string[];
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

interface BroadcastRecord {
  _id: string;
  type: string;
  channels: string[];
  title: string;
  message: string;
  data?: Record<string, unknown>;
  sentCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: Date;
  scheduledAt?: Date;
  sentAt?: Date;
}

// In-memory broadcast history (in production, this should be stored in a database)
const broadcastHistory: BroadcastRecord[] = [];

/**
 * POST /api/admin/notifications/broadcast
 * Broadcast a notification to all users, providers, or customers
 */
export const broadcastNotification = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = broadcastSchema.validate(req.body);

  if (error) {
    throw ApiError.badRequest(
      error.details[0].message,
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const payload = value as BroadcastPayload;
  const adminUser = (req as any).user;

  // Build user query based on type
  const userQuery: Record<string, unknown> = {
    isActive: true,
    isDeleted: false,
    accountStatus: 'active',
  };

  if (payload.type === 'providers') {
    userQuery.role = 'provider';
  } else if (payload.type === 'customers') {
    userQuery.role = 'customer';
  }

  // Get users to notify
  const users = await User.find(userQuery)
    .select('_id email deviceTokens communicationPreferences role')
    .limit(10000); // Limit for performance

  if (users.length === 0) {
    throw ApiError.badRequest('No users found matching the criteria');
  }

  // Process notifications
  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      // In-app notification
      if (payload.channels.includes('in_app')) {
        user.notifications = user.notifications || [];
        user.notifications.push({
          _id: new (require('mongoose').Types.ObjectId)(),
          type: 'system' as const,
          title: payload.title,
          message: payload.message,
          isRead: false,
          data: payload.data,
          createdAt: new Date(),
        });

        // Keep only last 100 notifications per user
        if (user.notifications.length > 100) {
          user.notifications = user.notifications.slice(-100);
        }
      }

      // Email notification (would integrate with email service in production)
      if (payload.channels.includes('email')) {
        const emailPrefs = user.communicationPreferences?.email;
        if (emailPrefs?.marketing || emailPrefs?.promotions) {
          // In production: await sendEmail(user.email, payload.title, payload.message);
          logger.debug('Email notification queued', {
            userId: user._id,
            email: user.email,
            title: payload.title,
          });
        }
      }

      // Push notification (would integrate with FCM/APNS in production)
      if (payload.channels.includes('push')) {
        const pushPrefs = user.communicationPreferences?.push;
        if (pushPrefs?.promotions || pushPrefs?.bookingUpdates) {
          // In production: await sendPushNotification(user.deviceTokens, payload.title, payload.message);
          logger.debug('Push notification queued', {
            userId: user._id,
            deviceTokens: user.deviceTokens?.length || 0,
            title: payload.title,
          });
        }
      }

      // SMS notification (would integrate with Twilio in production)
      if (payload.channels.includes('sms')) {
        const smsPrefs = user.communicationPreferences?.sms;
        if (smsPrefs?.promotions) {
          // In production: await sendSMS(user.phone, payload.message);
          logger.debug('SMS notification queued', {
            userId: user._id,
            hasPhone: !!user.phone,
          });
        }
      }

      await user.save({ validateBeforeSave: false });
      sentCount++;
    } catch (err) {
      failedCount++;
      errors.push(`User ${user._id}: ${(err as Error).message}`);
      logger.error('Failed to send notification to user', {
        userId: user._id,
        error: (err as Error).message,
      });
    }
  }

  // Create booking notification record for analytics
  const broadcastRecord: BroadcastRecord = {
    _id: new (require('mongoose').Types.ObjectId)().toString(),
    type: payload.type,
    channels: payload.channels,
    title: payload.title,
    message: payload.message,
    data: payload.data,
    sentCount,
    failedCount,
    createdBy: adminUser._id.toString(),
    createdAt: new Date(),
    scheduledAt: value.scheduledAt,
    sentAt: new Date(),
  };

  broadcastHistory.unshift(broadcastRecord);

  // Keep only last 1000 broadcasts in memory
  if (broadcastHistory.length > 1000) {
    broadcastHistory.pop();
  }

  logger.info('Broadcast notification sent', {
    action: 'NOTIFICATION_BROADCAST',
    type: payload.type,
    channels: payload.channels,
    sentCount,
    failedCount,
    totalUsers: users.length,
    sentBy: adminUser._id,
  });

  res.status(201).json({
    success: true,
    message: 'Broadcast notification sent successfully',
    data: {
      broadcastId: broadcastRecord._id,
      totalUsers: users.length,
      sentCount,
      failedCount,
      errors: errors.slice(0, 10), // Return first 10 errors
    },
  });
});

/**
 * GET /api/admin/notifications/history
 * Get broadcast notification history
 */
export const getBroadcastHistory = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = broadcastHistoryQuerySchema.validate(req.query);

  if (error) {
    throw ApiError.badRequest(
      error.details[0].message,
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  let filteredHistory = [...broadcastHistory];

  // Filter by type
  if (value.type) {
    filteredHistory = filteredHistory.filter(h => h.type === value.type);
  }

  // Filter by date range
  if (value.startDate) {
    filteredHistory = filteredHistory.filter(
      h => new Date(h.createdAt) >= new Date(value.startDate!)
    );
  }
  if (value.endDate) {
    filteredHistory = filteredHistory.filter(
      h => new Date(h.createdAt) <= new Date(value.endDate!)
    );
  }

  // Sort by createdAt descending
  filteredHistory.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Pagination
  const page = value.page || 1;
  const limit = value.limit || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: {
      broadcasts: paginatedHistory,
      pagination: {
        page,
        limit,
        total: filteredHistory.length,
        pages: Math.ceil(filteredHistory.length / limit),
      },
    },
  });
});

/**
 * GET /api/admin/notifications/stats
 * Get notification broadcast statistics
 */
export const getBroadcastStats = asyncHandler(async (req: Request, res: Response) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentBroadcasts = broadcastHistory.filter(
    h => new Date(h.createdAt) >= thirtyDaysAgo
  );

  const totalSent = recentBroadcasts.reduce((sum, b) => sum + b.sentCount, 0);
  const totalFailed = recentBroadcasts.reduce((sum, b) => sum + b.failedCount, 0);
  const byType = {
    all: recentBroadcasts.filter(b => b.type === 'all').length,
    providers: recentBroadcasts.filter(b => b.type === 'providers').length,
    customers: recentBroadcasts.filter(b => b.type === 'customers').length,
  };

  res.json({
    success: true,
    data: {
      last30Days: {
        totalBroadcasts: recentBroadcasts.length,
        totalSent,
        totalFailed,
        byType,
      },
      total: {
        totalBroadcasts: broadcastHistory.length,
      },
    },
  });
});

// ============================================
// Routes
// ============================================

// All admin notification routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

/**
 * POST /api/admin/notifications/broadcast
 * Broadcast a notification
 */
router.post('/broadcast', broadcastNotification);

/**
 * GET /api/admin/notifications/history
 * Get broadcast notification history
 */
router.get('/history', getBroadcastHistory);

/**
 * GET /api/admin/notifications/stats
 * Get broadcast notification statistics
 */
router.get('/stats', getBroadcastStats);

export default router;
