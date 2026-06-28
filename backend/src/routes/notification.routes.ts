import { Router, Request, Response } from 'express';
import User from '../models/user.model';
import BookingNotification from '../models/bookingNotification.model';
import authMiddleware from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';
import { escapeHtml } from '../utils/security';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import { notificationAnalyticsService } from '../services/notificationAnalytics.service';
import { notificationService, NotificationType } from '../services/notification.service';
import { formatNotificationForApi, normalizeBackendNotificationType, type NotificationCategory } from '../utils/notificationHelpers';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const registerDeviceSchema = Joi.object({
  deviceToken: Joi.string().min(1),
  token: Joi.string().min(1),
  platform: Joi.string().required().valid('ios', 'android', 'web').messages({
    'any.only': 'platform must be one of: ios, android, web',
    'any.required': 'platform is required',
  }),
}).or('deviceToken', 'token').messages({
  'object.missing': 'deviceToken or token is required',
});

const unregisterDeviceSchema = Joi.object({
  deviceToken: Joi.string().required().min(1).messages({
    'string.empty': 'deviceToken is required',
    'any.required': 'deviceToken is required',
  }),
});

const notificationIdParamSchema = Joi.object({
  notificationId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.empty': 'Notification ID is required',
    'any.required': 'Notification ID is required',
    'string.pattern.base': 'Invalid notification ID format',
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
    reviews: Joi.boolean(),
    paymentUpdates: Joi.boolean(),
    loyaltyUpdates: Joi.boolean(),
  }),
  sms: Joi.object({
    bookingUpdates: Joi.boolean(),
    reminders: Joi.boolean(),
    promotions: Joi.boolean(),
    newMessages: Joi.boolean(),
  }),
  push: Joi.object({
    bookingUpdates: Joi.boolean(),
    reminders: Joi.boolean(),
    newMessages: Joi.boolean(),
    promotions: Joi.boolean(),
    marketing: Joi.boolean(),
  }),
  quietHours: Joi.object({
    enabled: Joi.boolean(),
    startTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).message('Invalid time format, use HH:mm'),
    endTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).message('Invalid time format, use HH:mm'),
    timezone: Joi.string(),
  }),
  language: Joi.string().valid('en', 'ar', 'fr', 'es', 'de', 'zh'),
  timezone: Joi.string().valid(
    'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Europe/London',
    'America/New_York', 'America/Los_Angeles', 'UTC'
  ),
  currency: Joi.string().valid('AED', 'USD', 'EUR', 'GBP'),
}).min(1);

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

  const prefs = userDoc.communicationPreferences ?? {};

  return res.json({
    success: true,
    data: {
      email: prefs.email ?? {},
      sms: prefs.sms ?? {},
      push: prefs.push ?? {},
      quietHours: prefs.quietHours ?? { enabled: false, startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      language: prefs.language ?? 'en',
      timezone: prefs.timezone ?? 'Asia/Dubai',
      currency: prefs.currency ?? 'AED',
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

  const { bustUserChannelCache } = await import('../services/notificationTrigger.service');
  await bustUserChannelCache(user._id.toString());

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
  id: string; // Maps _id to id for frontend compatibility
  type: 'booking' | 'payment' | 'review' | 'system' | 'promotion' | 'message';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
}

// Get notifications (unified BookingNotification store)
const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { page = '1', limit = '20', unreadOnly, type } = req.query;

  await notificationService.migrateLegacyNotifications(user._id.toString());

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit as string, 10) || 20), 100);

  // Normalize type filter for query building
  let typeFilter: NotificationCategory | undefined;
  if (type && typeof type === 'string') {
    typeFilter = normalizeBackendNotificationType(type);
  }

  const result = await notificationService.getUserNotifications(user._id.toString(), {
    page: pageNum,
    limit: limitNum,
    unreadOnly: unreadOnly === 'true',
    type: typeFilter,
  });

  res.json({
    success: true,
    data: {
      notifications: result.notifications.map(formatNotificationForApi),
      total: result.pagination.total,
      unreadCount: result.unreadCount,
      page: result.pagination.page,
      pages: result.pagination.pages,
    },
  });
});

// Get unread count
const getUnreadCount = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;

  await notificationService.migrateLegacyNotifications(user._id.toString());
  const result = await notificationService.getUserNotifications(user._id.toString(), {
    page: 1,
    limit: 1,
  });

  return res.json({
    success: true,
    data: { count: result.unreadCount },
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

  const existing = await BookingNotification.findOne({
    _id: notificationId,
    recipientId: user._id,
  });

  if (!existing) {
    throw ApiError.notFound('Notification not found', ERROR_CODES.NOT_FOUND);
  }

  await notificationService.markAsRead(notificationId, user._id.toString());

  const updated = await BookingNotification.findById(notificationId);
  res.json({
    success: true,
    message: 'Notification marked as read',
    data: { notification: formatNotificationForApi(updated) },
  });
});

// Mark all as read
const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  await notificationService.markAllAsRead(user._id.toString());

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

  const existing = await BookingNotification.findOne({
    _id: notificationId,
    recipientId: user._id,
  });

  if (!existing) {
    throw ApiError.notFound('Notification not found', ERROR_CODES.NOT_FOUND);
  }

  await notificationService.deleteNotification(notificationId, user._id.toString());

  res.json({
    success: true,
    message: 'Notification deleted',
  });
});

// Delete all read notifications
const deleteAllRead = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const deletedCount = await notificationService.deleteReadNotifications(user._id.toString());

  res.json({
    success: true,
    message: 'All read notifications deleted',
    data: { deletedCount },
  });
});

// ============================================
// Analytics
// ============================================

// Track delivery
const trackDelivery = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { notificationId, channel } = req.body;

  // FIX: IDOR protection - verify notification belongs to authenticated user
  const notification = await BookingNotification.findOne({
    _id: notificationId,
    recipientId: user._id,
  });

  if (!notification) {
    throw ApiError.notFound('Notification not found', ERROR_CODES.NOT_FOUND);
  }

  try {
    await notificationAnalyticsService.trackDelivery(
      notificationId,
      user._id,
      channel || 'in_app',
      true
    );
  } catch (error: any) {
    // Handle rate limit errors
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: error.message,
        retryAfter: 60,
      });
    }
    throw error;
  }

  return res.json({
    success: true,
    message: 'Delivery tracked',
  });
});

// Track click
const trackClick = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { notificationId, channel } = req.body;

  // FIX: IDOR protection - verify notification belongs to authenticated user
  const notification = await BookingNotification.findOne({
    _id: notificationId,
    recipientId: user._id,
  });

  if (!notification) {
    throw ApiError.notFound('Notification not found', ERROR_CODES.NOT_FOUND);
  }

  try {
    await notificationAnalyticsService.trackClick(
      notificationId,
      user._id,
      channel || 'in_app'
    );
  } catch (error: any) {
    // Handle rate limit errors
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: error.message,
        retryAfter: 60,
      });
    }
    throw error;
  }

  return res.json({
    success: true,
    message: 'Click tracked',
  });
});

// Track view
const trackView = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { notificationId, channel } = req.body;

  // FIX: IDOR protection - verify notification belongs to authenticated user
  const notification = await BookingNotification.findOne({
    _id: notificationId,
    recipientId: user._id,
  });

  if (!notification) {
    throw ApiError.notFound('Notification not found', ERROR_CODES.NOT_FOUND);
  }

  try {
    await notificationAnalyticsService.trackView(
      notificationId,
      user._id,
      channel || 'in_app'
    );
  } catch (error: any) {
    // Handle rate limit errors
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: error.message,
        retryAfter: 60,
      });
    }
    throw error;
  }

  return res.json({
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

  const deviceToken = value.deviceToken || value.token;
  const { platform } = value;
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

  // Sanitize title and message to prevent XSS attacks
  const sanitizedTitle = escapeHtml(String(title).trim());
  const sanitizedMessage = escapeHtml(String(message).trim());

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
    title: sanitizedTitle,
    message: sanitizedMessage,
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

router.put('/preferences',
  authMiddleware.authenticate,
  updatePreferences
);

// Notification routes
router.get('/',
  authMiddleware.authenticate,
  getNotifications
);

// Send notification endpoint (admin only - IDOR protection)
router.post('/send',
  authMiddleware.authenticate,
  authMiddleware.requireRole('admin'),
  sendNotification
);

router.get('/unread-count',
  authMiddleware.authenticate,
  getUnreadCount
);

// ============================================
// ROUTES WITH :notificationId - Specific routes BEFORE parameterized /:notificationId
// ============================================

router.patch('/:notificationId/read',
  authMiddleware.authenticate,
  markAsRead
);

router.delete('/:notificationId',
  authMiddleware.authenticate,
  deleteNotification
);

router.post('/mark-all-read',
  authMiddleware.authenticate,
  markAllAsRead
);

router.delete('/read',
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

// ============================================
// Digest Routes
// ============================================

// Get digest preferences
router.get('/digest/preferences',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { notificationDigestService } = await import('../services/notifications/notificationDigest.service');

    const preferences = await notificationDigestService.getPreferences(user._id);

    res.json({
      success: true,
      data: preferences,
    });
  })
);

const digestPreferencesSchema = Joi.object({
  enabled: Joi.boolean(),
  frequency: Joi.string().valid('realtime', 'hourly', 'daily', 'weekly'),
  scheduledTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  scheduledDays: Joi.array().items(Joi.number().min(0).max(6)),
  channels: Joi.object({
    email: Joi.boolean(),
    sms: Joi.boolean(),
    push: Joi.boolean(),
    whatsapp: Joi.boolean(),
    telegram: Joi.boolean(),
  }),
  types: Joi.object({
    bookingUpdates: Joi.boolean(),
    reminders: Joi.boolean(),
    promotions: Joi.boolean(),
    messages: Joi.boolean(),
    system: Joi.boolean(),
  }),
  quietHours: Joi.object({
    enabled: Joi.boolean(),
    startTime: Joi.string(),
    endTime: Joi.string(),
    timezone: Joi.string(),
  }),
});

// Update digest preferences
router.patch('/digest/preferences',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { error, value } = digestPreferencesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { notificationDigestService } = await import('../services/notifications/notificationDigest.service');

    const updatedPreferences = await notificationDigestService.updatePreferences(user._id, value);

    return res.json({
      success: true,
      message: 'Digest preferences updated successfully',
      data: updatedPreferences,
    });
  })
);

// Get digest schedule
router.get('/digest/schedule',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { notificationDigestService } = await import('../services/notifications/notificationDigest.service');

    const schedule = await notificationDigestService.getDigestSchedule(user._id);

    res.json({
      success: true,
      data: {
        frequency: schedule?.frequency || 'daily',
        nextRun: schedule?.nextRun?.toISOString(),
        lastRun: schedule?.lastRun?.toISOString(),
      },
    });
  })
);

// ============================================
// WhatsApp Routes
// ============================================

// Get WhatsApp status
router.get('/whatsapp/status',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { whatsAppService } = await import('../services/notifications/whatsapp.service');

    if (!whatsAppService.isConfigured()) {
      res.json({
        success: true,
        data: { enabled: false, configured: false },
      });
      return;
    }

    const status = await whatsAppService.getOptInStatus(user._id.toString());

    res.json({
      success: true,
      data: {
        enabled: status.enabled,
        optedOutAt: status.optedOutAt?.toISOString(),
        optedInAt: status.optedInAt?.toISOString(),
      },
    });
  })
);

// Enable WhatsApp notifications
router.post('/whatsapp/enable',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { whatsAppService } = await import('../services/notifications/whatsapp.service');

    if (!whatsAppService.isConfigured()) {
      res.status(503).json({
        success: false,
        message: 'WhatsApp integration is not configured',
      });
      return;
    }

    await whatsAppService.setOptInStatus(user._id.toString(), true);

    res.json({
      success: true,
      message: 'WhatsApp notifications enabled successfully',
    });
  })
);

// Disable WhatsApp notifications
router.post('/whatsapp/disable',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { whatsAppService } = await import('../services/notifications/whatsapp.service');

    await whatsAppService.setOptInStatus(user._id.toString(), false);

    res.json({
      success: true,
      message: 'WhatsApp notifications disabled successfully',
    });
  })
);

// ============================================
// Telegram Routes
// ============================================

// Get Telegram status
router.get('/telegram/status',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const userDoc = await User.findById(user._id);

    res.json({
      success: true,
      data: {
        linked: !!userDoc?.telegramChatId,
        enabled: !!userDoc?.telegramChatId,
        username: userDoc?.telegramUsername,
      },
    });
  })
);

// Get Telegram deep link
router.get('/telegram/link',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { telegramService } = await import('../services/notifications/telegram.service');

    if (!telegramService.isConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Telegram integration is not configured',
      });
      return;
    }

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
    if (!botUsername) {
      res.status(503).json({
        success: false,
        message: 'TELEGRAM_BOT_USERNAME is not configured',
      });
      return;
    }
    const link = `https://t.me/${botUsername.replace('@', '')}?start=${user._id.toString()}`;

    res.json({
      success: true,
      data: { link },
    });
  })
);

// Unlink Telegram
router.post('/telegram/unlink',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const userDoc = await User.findById(user._id);

    if (userDoc) {
      userDoc.telegramChatId = undefined;
      userDoc.telegramUsername = undefined;
      await userDoc.save();
    }

    res.json({
      success: true,
      message: 'Telegram account unlinked successfully',
    });
  })
);

// ============================================
// Web Push Routes
// ============================================

// Get Web Push public key
router.get('/push/key',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { webPushService } = await import('../services/notifications/webpush.service');
    const publicKey = webPushService.getPublicKey();

    res.json({
      success: true,
      data: { publicKey },
    });
  })
);

// Subscribe to push notifications
router.post('/push/subscribe',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { webPushService } = await import('../services/notifications/webpush.service');

    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      res.status(400).json({
        success: false,
        message: 'Invalid subscription data',
      });
      return;
    }

    const result = await webPushService.saveSubscription(user._id.toString(), subscription);

    res.json({
      success: result.success,
      message: result.success ? 'Push subscription successful' : result.error,
    });
  })
);

// Unsubscribe from push notifications
router.post('/push/unsubscribe',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { webPushService } = await import('../services/notifications/webpush.service');

    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({
        success: false,
        message: 'Endpoint is required',
      });
      return;
    }

    const result = await webPushService.removeSubscription(user._id.toString(), endpoint);

    res.json({
      success: result.success,
      message: result.success ? 'Push unsubscription successful' : result.error,
    });
  })
);

// Get push subscription status
router.get('/push/status',
  authMiddleware.authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const { webPushService } = await import('../services/notifications/webpush.service');

    const subscriptions = await webPushService.getUserSubscriptions(user._id.toString());

    res.json({
      success: true,
      data: {
        subscribed: subscriptions.length > 0,
        subscriptions: subscriptions.map((sub: any) => ({
          endpoint: sub.endpoint,
          createdAt: sub.createdAt?.toISOString(),
        })),
      },
    });
  })
);

export default router;
