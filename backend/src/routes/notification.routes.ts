import { Router, Request, Response } from 'express';
import User from '../models/user.model';
import authMiddleware from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';

const router = Router();

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
    throw new Error('User not found');
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
  const { notificationId } = req.params;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw new Error('User not found');
  }

  const notifications: Notification[] = (userDoc as any).notifications || [];
  const notification = notifications.find(n => n._id.toString() === notificationId);

  if (!notification) {
    throw new Error('Notification not found');
  }

  notification.isRead = true;
  notification.readAt = new Date();
  (userDoc as any).notifications = notifications;
  await userDoc.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: { notification },
  });
});

// Mark all as read
const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw new Error('User not found');
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
  const { notificationId } = req.params;

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw new Error('User not found');
  }

  const notifications: Notification[] = (userDoc as any).notifications || [];
  const index = notifications.findIndex(n => n._id.toString() === notificationId);

  if (index === -1) {
    throw new Error('Notification not found');
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
    throw new Error('User not found');
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

export default router;
