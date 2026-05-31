import { Router, Request, Response } from 'express';
import User from '../models/user.model';
import authMiddleware from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import { notificationAnalyticsService } from '../services/notificationAnalytics.service';
import { notificationService, NotificationType } from '../services/notification.service';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const registerDeviceSchema = Joi.object({
  deviceToken: Joi.string().required().min(1).messages({
    'string.empty': 'deviceToken is required',
    'any.required': 'deviceToken is required',
  }),
  platform: Joi.string().required().valid('ios', 'android', 'web').messages({
    'any.only': 'platform must be one of: ios, android, web',
    'any.required': 'platform is required',
  }),
});

const unregisterDeviceSchema = Joi.object({
  deviceToken: Joi.string().required().min(1).messages({
    'string.empty': 'deviceToken is required',
    'any.required': 'deviceToken is required',
  }),
});

const notificationIdParamSchema = Joi.object({
  notificationId: Joi.string().required().messages({
    'string.empty': 'Notification ID is required',
    'any.required': 'Notification ID is required',
  }),
});

const sendNotificationSchema = Joi.object({
  userId: Joi.string().required().messages({
    'string.empty': 'User ID is required',
    'any.required': 'User ID is required',
  }),
  type: Joi.string().valid(
    'booking_request', 'booking_confirmed', 'booking_cancelled', 'booking_rejected',
    'booking_started', 'booking_completed', 'booking_reminder', 'message_received',
    'review_received', 'review_rejected', 'promotion', 'loyalty_update',
    'provider_approved', 'provider_rejected', 'provider_suspended',
    'provider_document_verified', 'provider_document_rejected',
    'service_approved', 'service_rejected', 'service_updated',
    'new_provider_submission', 'new_service_pending',
    'dispute_received', 'dispute_created', 'dispute_evidence_added',
    'dispute_assigned', 'dispute_resolved', 'withdrawal',
    'withdrawal_approved', 'withdrawal_rejected'
  ).required().messages({
    'any.only': 'Invalid notification type',
    'any.required': 'Notification type is required',
  }),
  title: Joi.string().required().min(1).max(200).messages({
    'string.empty': 'Title is required',
    'any.required': 'Title is required',
    'string.max': 'Title must be 200 characters or less',
  }),
  message: Joi.string().required().min(1).max(1000).messages({
    'string.empty': 'Message is required',
    'any.required': 'Message is required',
    'string.max': 'Message must be 1000 characters or less',
  }),
  data: Joi.object().optional(),
  channels: Joi.array().items(Joi.string().valid('in_app', 'email', 'sms', 'push')).optional(),
});

// ============================================
// Validation Schemas
// ============================================

const updatePreferencesSchema = Joi.object({
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
  quietHours: Joi.object({
    enabled: Joi.boolean(),
    startTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).message('Invalid time format, use HH:mm'),
    endTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).message('Invalid time format, use HH:mm'),
    timezone: Joi.string(),
  }),
  language: Joi.string().valid('en', 'ar', 'fr', 'es', 'de', 'zh'),
  timezone: Joi.string(),
  currency: Joi.string().valid('AED', 'USD', 'EUR', 'GBP'),
});

// ============================================
// GET Notification Preferences
// ============================================

const getPreferences = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;
  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  return res.json({
    success: true,
    data: {
      email: userDoc.communicationPreferences.email,
      sms: userDoc.communicationPreferences.sms,
      push: userDoc.communicationPreferences.push,
      quietHours: userDoc.communicationPreferences.quietHours,
      language: userDoc.communicationPreferences.language,
      timezone: userDoc.communicationPreferences.timezone,
      currency: userDoc.communicationPreferences.currency,
    },
  });
});

// ============================================
// PATCH Notification Preferences
// ============================================

const updatePreferences = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;
  const { error, value } = updatePreferencesSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const userDoc = await User.findById(user._id);

  if (!userDoc) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  if (value.email) {
    userDoc.communicationPreferences.email = {
      ...userDoc.communicationPreferences.email,
      ...value.email,
    };
  }

  if (value.sms) {
    userDoc.communicationPreferences.sms = {
      ...userDoc.communicationPreferences.sms,
      ...value.sms,
    };
  }

  if (value.push) {
    userDoc.communicationPreferences.push = {
      ...userDoc.communicationPreferences.push,
      ...value.push,
    };
  }

  if (value.quietHours) {
    userDoc.communicationPreferences.quietHours = {
      ...userDoc.communicationPreferences.quietHours,
      ...value.quietHours,
    };
  }

  if (value.language) {
    userDoc.communicationPreferences.language = value.language;
  }

  if (value.timezone) {
    userDoc.communicationPreferences.timezone = value.timezone;
  }

  if (value.currency) {
    userDoc.communicationPreferences.currency = value.currency;
  }

  await userDoc.save({ validateBeforeSave: false });

  return res.json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: {
      email: userDoc.communicationPreferences.email,
      sms: userDoc.communicationPreferences.sms,
      push: userDoc.communicationPreferences.push,
      quietHours: userDoc.communicationPreferences.quietHours,
      language: userDoc.communicationPreferences.language,
      timezone: userDoc.communicationPreferences.timezone,
      currency: userDoc.communicationPreferences.currency,
    },
  });
});

// ============================================
// Notification List & Management (stored in User model)
// ============================================

interface Notification {
  _id: string;
  type: 'booking' | 'payment' | 'review' | 'system' | 'promotion';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
}

// Get notifications
const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { page = '1', limit = '20', unreadOnly } = req.query;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  let notifications: Notification[] = (userDoc as any).notifications || [];

  // Filter unread only if requested
  if (unreadOnly === 'true') {
    notifications = notifications.filter(n => !n.isRead);
  }

  // Sort by createdAt descending
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;

  const paginatedNotifications = notifications.slice(startIndex, endIndex);

  // Count unread
  const unreadCount = (userDoc as any).notifications?.filter((n: Notification) => !n.isRead).length || 0;

  res.json({
    success: true,
    data: {
      notifications: paginatedNotifications,
      total: notifications.length,
      unreadCount,
      page: pageNum,
      pages: Math.ceil(notifications.length / limitNum),
    },
  });
});

// Get unread count
const getUnreadCount = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    return res.json({ success: true, data: { count: 0 } });
  }

  const notifications: Notification[] = (userDoc as any).notifications || [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return res.json({
    success: true,
    data: { count: unreadCount },
  });
});

// Mark notification as read
const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { error, value } = notificationIdParamSchema.validate(req.params);
  if (error) {
    throw ApiError.badRequest(error.message, [], ERROR_CODES.VALIDATION_ERROR);
  }
  const { notificationId } = value;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const notifications: Notification[] = (userDoc as any).notifications || [];
  const notificationIndex = notifications.findIndex(n => n._id.toString() === notificationId);

  if (notificationIndex === -1) {
    throw ApiError.notFound('Notification not found', ERROR_CODES.NOT_FOUND);
  }

  // FIX: Update the notification in place and save
  notifications[notificationIndex].isRead = true;
  notifications[notificationIndex].readAt = new Date();
  (userDoc as any).notifications = notifications;
  await userDoc.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: { notification: notifications[notificationIndex] },
  });
});

// Mark all as read
const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const notifications: Notification[] = (userDoc as any).notifications || [];
  const now = new Date();

  notifications.forEach(n => {
    if (!n.isRead) {
      n.isRead = true;
      n.readAt = now;
    }
  });

  (userDoc as any).notifications = notifications;
  await userDoc.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
});

// Delete notification
const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { error, value } = notificationIdParamSchema.validate(req.params);
  if (error) {
    throw ApiError.badRequest(error.message, [], ERROR_CODES.VALIDATION_ERROR);
  }
  const { notificationId } = value;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const notifications: Notification[] = (userDoc as any).notifications || [];
  const index = notifications.findIndex(n => n._id.toString() === notificationId);

  if (index === -1) {
    throw ApiError.notFound('Notification not found', ERROR_CODES.NOT_FOUND);
  }

  notifications.splice(index, 1);
  (userDoc as any).notifications = notifications;
  await userDoc.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'Notification deleted',
  });
});

// Delete all read notifications
const deleteAllRead = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const notifications: Notification[] = (userDoc as any).notifications || [];
  const unreadNotifications = notifications.filter(n => !n.isRead);

  (userDoc as any).notifications = unreadNotifications;
  await userDoc.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'All read notifications deleted',
  });
});

// ============================================
// Analytics
// ============================================

// Track delivery
const trackDelivery = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { notificationId, channel } = req.body;

  await notificationAnalyticsService.trackDelivery(
    notificationId,
    user._id,
    channel || 'in_app',
    true
  );

  res.json({
    success: true,
    message: 'Delivery tracked',
  });
});

// Track click
const trackClick = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { notificationId, channel } = req.body;

  await notificationAnalyticsService.trackClick(
    notificationId,
    user._id,
    channel || 'in_app'
  );

  res.json({
    success: true,
    message: 'Click tracked',
  });
});

// Track view
const trackView = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { notificationId, channel } = req.body;

  await notificationAnalyticsService.trackView(
    notificationId,
    user._id,
    channel || 'in_app'
  );

  res.json({
    success: true,
    message: 'View tracked',
  });
});

// Get analytics summary
const getAnalyticsSummary = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const analytics = await notificationAnalyticsService.getUserAnalytics(user._id);

  res.json({
    success: true,
    data: {
      totalSent: analytics.totalSent,
      totalDelivered: analytics.totalDelivered,
      totalClicked: analytics.totalClicked,
      clickThroughRate: analytics.clickThroughRate,
      byChannel: {
        in_app: analytics.byChannel.in_app,
        email: analytics.byChannel.email,
        sms: analytics.byChannel.sms,
        push: analytics.byChannel.push,
      },
      byType: analytics.byType,
    },
  });
});

// ============================================
// Device Registration
// ============================================

const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = registerDeviceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const { deviceToken, platform } = value;
  const userId = (req as any).user._id;

  const userDoc = await User.findById(userId);
  if (!userDoc) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Initialize deviceTokens array if it doesn't exist
  if (!userDoc.deviceTokens) {
    userDoc.deviceTokens = [];
  }

  // Check if token already exists and update, otherwise add
  const existingTokenIndex = userDoc.deviceTokens.findIndex(
    (dt: any) => dt.token === deviceToken
  );

  if (existingTokenIndex !== -1) {
    // Update existing token
    userDoc.deviceTokens[existingTokenIndex].platform = platform.toLowerCase();
    userDoc.deviceTokens[existingTokenIndex].addedAt = new Date();
  } else {
    // Add new token
    userDoc.deviceTokens.push({
      token: deviceToken,
      platform: platform.toLowerCase(),
      addedAt: new Date(),
      isActive: true,
    });
  }

  await userDoc.save({ validateBeforeSave: false });

  return res.json({
    success: true,
    message: 'Device registered successfully',
  });
});

// Unregister device
const unregisterDevice = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = unregisterDeviceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  const { deviceToken } = value;
  const userId = (req as any).user._id;

  const userDoc = await User.findById(userId);
  if (!userDoc) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  if (userDoc.deviceTokens) {
    userDoc.deviceTokens = userDoc.deviceTokens.filter(
      (dt: any) => dt.token !== deviceToken
    );
    await userDoc.save({ validateBeforeSave: false });
  }

  return res.json({
    success: true,
    message: 'Device unregistered successfully',
  });
});

// ============================================
// Send Notification Endpoint
// ============================================

const sendNotification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { error, value } = sendNotificationSchema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
    return;
  }

  const { userId, type, title, message, data, channels } = value;

  // Verify target user exists
  const targetUser = await User.findById(userId);
  if (!targetUser) {
    res.status(404).json({
      success: false,
      message: 'User not found',
    });
    return;
  }

  // Send the notification
  await notificationService.createNotification({
    recipientId: userId,
    type: type as NotificationType,
    title,
    message,
    metadata: data,
    channels: channels as any,
  });

  res.json({
    success: true,
    message: 'Notification sent successfully',
  });
});

// ============================================
// Routes
// ============================================

// Preferences routes
router.get('/preferences',
  authMiddleware.authenticate,
  getPreferences
);

router.patch('/preferences',
  authMiddleware.authenticate,
  updatePreferences
);

// Notification routes
router.get('/',
  authMiddleware.authenticate,
  getNotifications
);

// Send notification endpoint (admin/provider only)
router.post('/send',
  authMiddleware.authenticate,
  sendNotification
);

router.get('/unread-count',
  authMiddleware.authenticate,
  getUnreadCount
);

router.patch('/:notificationId/read',
  authMiddleware.authenticate,
  markAsRead
);

router.post('/mark-all-read',
  authMiddleware.authenticate,
  markAllAsRead
);

router.delete('/:notificationId',
  authMiddleware.authenticate,
  deleteNotification
);

router.delete('/read/all',
  authMiddleware.authenticate,
  deleteAllRead
);

// Device registration routes
router.post('/register-device',
  authMiddleware.authenticate,
  registerDevice
);

router.post('/unregister-device',
  authMiddleware.authenticate,
  unregisterDevice
);

// Analytics routes
router.post('/analytics/delivery',
  authMiddleware.authenticate,
  trackDelivery
);

router.post('/analytics/click',
  authMiddleware.authenticate,
  trackClick
);

router.post('/analytics/view',
  authMiddleware.authenticate,
  trackView
);

router.get('/analytics/summary',
  authMiddleware.authenticate,
  getAnalyticsSummary
);

export default router;
