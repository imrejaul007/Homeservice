import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/user.model';
import BookingNotification from '../models/bookingNotification.model';
import BroadcastLog from '../models/broadcastLog.model';
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

// Interface for API response transformation
interface BroadcastResponse {
  _id: string;
  type: string;
  channels: string[];
  title: string;
  message: string;
  data?: Record<string, unknown>;
  sentCount: number;
  failedCount: number;
  totalUsers: number;
  createdBy: string;
  createdAt: Date;
  scheduledAt?: Date;
  sentAt?: Date;
}

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

  // Process notifications using batch operations for better performance
  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  const timestamp = new Date();

  // Build bulk operations for in-app notifications
  if (payload.channels.includes('in_app')) {
    const bulkOps = users.map(user => ({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $push: {
            notifications: {
              $each: [{
                _id: new mongoose.Types.ObjectId(),
                type: 'system' as const,
                title: payload.title,
                message: payload.message,
                isRead: false,
                data: payload.data,
                createdAt: timestamp,
              }],
              $slice: -100, // Keep only last 100 notifications
            },
          },
        },
      },
    }));

    try {
      const bulkResult = await User.bulkWrite(bulkOps, { ordered: false });
      sentCount += bulkResult.modifiedCount;
      failedCount += users.length - bulkResult.modifiedCount;
    } catch (bulkErr) {
      // bulkWrite with ordered:false continues on errors, collect partial results
      const bulkError = bulkErr as any;
      if (bulkError.result?.writeErrors) {
        failedCount += bulkError.result.writeErrors.length;
        bulkError.result.writeErrors.forEach((writeError: any) => {
          errors.push(`User ${writeError.err.op.filter._id}: ${writeError.err.errmsg}`);
        });
      }
      sentCount = users.length - failedCount;
    }
  }

  // Process other notification channels in parallel batches
  const otherChannels = payload.channels.filter(ch => ch !== 'in_app');
  if (otherChannels.length > 0) {
    const BATCH_SIZE = 50;
    const userBatches: typeof users[] = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      userBatches.push(users.slice(i, i + BATCH_SIZE));
    }

    await Promise.all(
      userBatches.map(batch =>
        processBatch(batch, otherChannels, errors)
      )
    );

    // Count successful sends for other channels
    sentCount += users.length;
  }

  async function processBatch(batch: typeof users, channels: string[], errorList: string[]) {
    await Promise.all(
      batch.map(async (user) => {
        try {
          // Email notification (would integrate with email service in production)
          if (channels.includes('email')) {
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
          if (channels.includes('push')) {
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
          if (channels.includes('sms')) {
            const smsPrefs = user.communicationPreferences?.sms;
            if (smsPrefs?.promotions) {
              // In production: await sendSMS(user.phone, payload.message);
              logger.debug('SMS notification queued', {
                userId: user._id,
                hasPhone: !!user.phone,
              });
            }
          }
        } catch (err) {
          errorList.push(`User ${user._id}: ${(err as Error).message}`);
          logger.error('Failed to process notification channel', {
            userId: user._id,
            error: (err as Error).message,
          });
        }
      })
    );
  }

  // Persist broadcast record to MongoDB
  const broadcastLog = new BroadcastLog({
    _id: new mongoose.Types.ObjectId(),
    type: payload.type,
    channels: payload.channels,
    title: payload.title,
    message: payload.message,
    data: payload.data,
    sentCount,
    failedCount,
    totalUsers: users.length,
    createdBy: adminUser._id,
    scheduledAt: value.scheduledAt,
    sentAt: new Date(),
  });

  await broadcastLog.save();

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
      broadcastId: broadcastLog._id.toString(),
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

  const page = value.page || 1;
  const limit = value.limit || 20;
  const skip = (page - 1) * limit;

  // Build MongoDB query
  const query: Record<string, unknown> = {};

  // Filter by type
  if (value.type) {
    query.type = value.type;
  }

  // Filter by date range
  if (value.startDate || value.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (value.startDate) {
      dateFilter.$gte = new Date(value.startDate);
    }
    if (value.endDate) {
      dateFilter.$lte = new Date(value.endDate);
    }
    query.createdAt = dateFilter;
  }

  // Execute query with pagination
  const [broadcasts, totalCount] = await Promise.all([
    BroadcastLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BroadcastLog.countDocuments(query)
  ]);

  // Transform to API response format
  const transformedBroadcasts: BroadcastResponse[] = broadcasts.map(b => ({
    _id: b._id.toString(),
    type: b.type,
    channels: b.channels,
    title: b.title,
    message: b.message,
    data: b.data as Record<string, unknown> | undefined,
    sentCount: b.sentCount,
    failedCount: b.failedCount,
    totalUsers: b.totalUsers,
    createdBy: b.createdBy.toString(),
    createdAt: b.createdAt,
    scheduledAt: b.scheduledAt,
    sentAt: b.sentAt,
  }));

  res.json({
    success: true,
    data: {
      broadcasts: transformedBroadcasts,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
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

  // Get stats from MongoDB
  const [last30DaysStats, totalCount] = await Promise.all([
    BroadcastLog.getStats(thirtyDaysAgo, new Date()),
    BroadcastLog.countDocuments()
  ]);

  res.json({
    success: true,
    data: {
      last30Days: {
        totalBroadcasts: last30DaysStats.totalBroadcasts,
        totalSent: last30DaysStats.totalSent,
        totalFailed: last30DaysStats.totalFailed,
        byType: last30DaysStats.byType,
      },
      total: {
        totalBroadcasts: totalCount,
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
