import BookingNotification from '../models/bookingNotification.model';
import { NotificationQueue } from '../models/notificationQueue.model';
import User from '../models/user.model';
import { send as emailSend } from './email.service';
import { smsService } from './sms.service';
import { withRetry } from '../utils/retry.util';
import admin from 'firebase-admin';
import logger from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { createCircuitBreaker, CIRCUIT_NAMES } from './circuitBreaker.service';
import { cache } from '../config/redis';

// Circuit breaker for external notification services
const pushCircuitBreaker = createCircuitBreaker(CIRCUIT_NAMES.NOTIFICATION || 'notification', {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute before attempting reset
  halfOpenMaxAttempts: 2,
});

// ============================================
// Firebase Admin SDK Configuration
// ============================================
const initializeFirebaseAdmin = (): admin.app.App | null => {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!serviceAccountPath && !process.env.FIREBASE_SERVICE_ACCOUNT) {
    logger.info('Firebase Admin SDK not configured - push notifications will be skipped', {
      context: 'NotificationService',
      action: 'FIREBASE_NOT_CONFIGURED',
    });
    logger.info('Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON to enable', {
      context: 'NotificationService',
      action: 'FIREBASE_CONFIG_HINT',
    });
    return null;
  }

  try {
    // Initialize Firebase Admin with service account
    let app: admin.app.App;

    if (serviceAccountPath) {
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      return null;
    }

    logger.info('Firebase Admin SDK initialized successfully', {
      context: 'NotificationService',
      action: 'FIREBASE_INIT_SUCCESS',
    });
    return app;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', {
      context: 'NotificationService',
      action: 'FIREBASE_INIT_FAILED',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const firebaseApp = initializeFirebaseAdmin();

// ============================================
// Rate Limiting Configuration
// ============================================

// FIX: Use Redis for rate limiting instead of in-memory Map
// In-memory cache kept as fallback only
const userNotificationCache = new Map<string, number>();
const NOTIFICATION_COOLDOWN = 60000; // 1 minute cooldown between notifications per user

/**
 * Check if a notification can be sent to a user (rate limiting)
 * Returns true if user is not in cooldown period
 * FIX: Uses Redis for distributed rate limiting
 */
const canSendNotification = async (userId: string): Promise<boolean> => {
  const cacheKey = `notification:rate:${userId}`;

  // Try Redis first for distributed rate limiting
  try {
    const redisClient = (cache as any).client;
    if (redisClient) {
      const exists = await redisClient.exists(cacheKey);
      if (exists) {
        logger.debug('Notification rate limited (Redis)', {
          context: 'NotificationService',
          action: 'RATE_LIMITED',
          userId,
        });
        return false;
      }
      // Set rate limit key with expiration
      await redisClient.set(cacheKey, '1', 'EX', Math.ceil(NOTIFICATION_COOLDOWN / 1000));
      return true;
    }
  } catch (error) {
    logger.warn('Redis rate limit check failed, using in-memory fallback', {
      userId,
      error: (error as Error).message,
    });
  }

  // Fallback to in-memory cache
  const lastSent = userNotificationCache.get(userId) || 0;
  const now = Date.now();

  if (now - lastSent < NOTIFICATION_COOLDOWN) {
    logger.debug('Notification rate limited (memory)', {
      context: 'NotificationService',
      action: 'RATE_LIMITED',
      userId,
      remainingMs: Math.ceil((NOTIFICATION_COOLDOWN - (now - lastSent))),
    });
    return false;
  }

  userNotificationCache.set(userId, now);
  return true;
};

/**
 * Get remaining cooldown time for a user in milliseconds
 */
const getRemainingCooldown = async (userId: string): Promise<number> => {
  const cacheKey = `notification:rate:${userId}`;

  // Try Redis first
  try {
    const redisClient = (cache as any).client;
    if (redisClient) {
      const ttl = await redisClient.ttl(cacheKey);
      if (ttl > 0) {
        return ttl * 1000;
      }
    }
  } catch (error) {
    // Fallback to memory
  }

  const lastSent = userNotificationCache.get(userId) || 0;
  const elapsed = Date.now() - lastSent;
  return Math.max(0, NOTIFICATION_COOLDOWN - elapsed);
};

/**
 * Cleanup old entries from in-memory cache
 */
const cleanupRateLimitCache = () => {
  const now = Date.now();
  const maxAge = NOTIFICATION_COOLDOWN * 2; // Clean entries older than 2x cooldown

  for (const [userId, timestamp] of userNotificationCache.entries()) {
    if (now - timestamp > maxAge) {
      userNotificationCache.delete(userId);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitCache, 300000);

// ============================================
// Types
// ============================================

export type NotificationType =
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rejected'
  | 'booking_started'
  | 'booking_completed'
  | 'booking_reminder'
  | 'message_received'
  | 'review_received'
  | 'review_rejected'
  | 'promotion'
  | 'loyalty_update'
  | 'provider_approved'
  | 'provider_rejected'
  | 'provider_suspended'
  | 'provider_document_verified'
  | 'provider_document_rejected'
  | 'service_approved'
  | 'service_rejected'
  | 'service_updated'
  | 'new_provider_submission'
  | 'new_service_pending'
  | 'dispute_received'
  | 'dispute_created'
  | 'dispute_evidence_added'
  | 'dispute_assigned'
  | 'dispute_resolved'
  | 'withdrawal'
  | 'withdrawal_approved'
  | 'withdrawal_rejected';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface NotificationData {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  channels?: NotificationChannel[];
}

export interface EmailData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

// ============================================
// Notification Templates
// ============================================

const NOTIFICATION_TEMPLATES: Record<NotificationType, { customer: { title: string; message: string }; provider: { title: string; message: string } }> = {
  booking_request: {
    customer: {
      title: 'Booking Request Submitted',
      message: 'Your booking request has been submitted. You\'ll be notified once the provider responds.',
    },
    provider: {
      title: 'New Booking Request',
      message: 'You have a new booking request. Please review and respond.',
    },
  },
  booking_confirmed: {
    customer: {
      title: 'Booking Confirmed',
      message: 'Great! Your booking has been confirmed by the provider.',
    },
    provider: {
      title: 'Booking Accepted',
      message: 'You have successfully accepted the booking request.',
    },
  },
  booking_cancelled: {
    customer: {
      title: 'Booking Cancelled',
      message: 'Your booking has been cancelled. Refund will be processed if applicable.',
    },
    provider: {
      title: 'Booking Cancelled',
      message: 'Booking has been cancelled by the customer.',
    },
  },
  booking_rejected: {
    customer: {
      title: 'Booking Request Declined',
      message: 'Unfortunately, your booking request has been declined by the provider.',
    },
    provider: {
      title: 'Booking Rejected',
      message: 'You have declined the booking request.',
    },
  },
  booking_started: {
    customer: {
      title: 'Service Started',
      message: 'Your service has started. The provider should arrive shortly.',
    },
    provider: {
      title: 'Service Started',
      message: 'You have started the service.',
    },
  },
  booking_completed: {
    customer: {
      title: 'Service Completed',
      message: 'Your service has been completed. Please consider leaving a review.',
    },
    provider: {
      title: 'Service Completed',
      message: 'You have successfully completed the service.',
    },
  },
  booking_reminder: {
    customer: {
      title: 'Booking Reminder',
      message: 'You have a booking coming up soon. Don\'t forget!',
    },
    provider: {
      title: 'Booking Reminder',
      message: 'You have a booking scheduled. Please prepare.',
    },
  },
  message_received: {
    customer: {
      title: 'New Message',
      message: 'You have a new message about your booking.',
    },
    provider: {
      title: 'New Message',
      message: 'You have a new message about a booking.',
    },
  },
  review_received: {
    customer: {
      title: 'Thank You for Your Review!',
      message: 'Your review helps others make informed decisions.',
    },
    provider: {
      title: 'New Review Received',
      message: 'You have received a new review from a customer.',
    },
  },
  promotion: {
    customer: {
      title: 'Special Offer!',
      message: 'Check out our latest promotions and deals.',
    },
    provider: {
      title: 'Marketing Update',
      message: 'New marketing tools available for your business.',
    },
  },
  loyalty_update: {
    customer: {
      title: 'Loyalty Points Update',
      message: 'Your loyalty points have been updated.',
    },
    provider: {
      title: 'Loyalty Update',
      message: 'Your provider loyalty status has been updated.',
    },
  },
  // Provider operation notifications
  provider_approved: {
    customer: {
      title: 'Provider Account Approved',
      message: 'Your provider account has been approved. You can now start accepting bookings.',
    },
    provider: {
      title: 'Congratulations! Account Approved',
      message: 'Your account has been approved. You can now start accepting bookings and providing services.',
    },
  },
  provider_rejected: {
    customer: {
      title: 'Provider Application Rejected',
      message: 'Unfortunately, your provider application has been rejected.',
    },
    provider: {
      title: 'Application Rejected',
      message: 'Your provider application has been rejected. Please review the feedback and submit again.',
    },
  },
  provider_suspended: {
    customer: {
      title: 'Provider Account Suspended',
      message: 'This provider\'s account is currently suspended.',
    },
    provider: {
      title: 'Account Suspended',
      message: 'Your provider account has been suspended. Please contact support for more information.',
    },
  },
  provider_document_verified: {
    customer: {
      title: 'Document Verified',
      message: 'Your submitted document has been verified.',
    },
    provider: {
      title: 'Document Verified',
      message: 'Your submitted document has been successfully verified.',
    },
  },
  provider_document_rejected: {
    customer: {
      title: 'Document Rejected',
      message: 'Unfortunately, your submitted document has been rejected.',
    },
    provider: {
      title: 'Document Rejected',
      message: 'Your submitted document has been rejected. Please upload a valid document.',
    },
  },
  service_approved: {
    customer: {
      title: 'Service Now Available',
      message: 'A new service is now available from your favorite provider.',
    },
    provider: {
      title: 'Service Approved',
      message: 'Your service has been approved and is now live.',
    },
  },
  service_rejected: {
    customer: {
      title: 'Service Update',
      message: 'A service update has been made.',
    },
    provider: {
      title: 'Service Rejected',
      message: 'Your service has been rejected. Please review the feedback and make necessary changes.',
    },
  },
  new_provider_submission: {
    customer: {
      title: 'Submission Received',
      message: 'Your submission has been received.',
    },
    provider: {
      title: 'Submission Received',
      message: 'Your verification submission has been received and is under review.',
    },
  },
  new_service_pending: {
    customer: {
      title: 'Service Submitted',
      message: 'Your service has been submitted for review.',
    },
    provider: {
      title: 'Service Under Review',
      message: 'Your new service has been submitted and is pending review.',
    },
  },
  review_rejected: {
    customer: {
      title: 'Review Removed',
      message: 'A review on your profile has been removed for violating guidelines.',
    },
    provider: {
      title: 'Review Removed',
      message: 'A review has been removed for violating our guidelines.',
    },
  },
  dispute_received: {
    customer: {
      title: 'Dispute Filed',
      message: 'A dispute has been filed for your booking. You will be notified once our team reviews it.',
    },
    provider: {
      title: 'New Dispute',
      message: 'A dispute has been filed against your booking. Please check the details.',
    },
  },
  dispute_created: {
    customer: {
      title: 'Dispute Filed',
      message: 'A dispute has been filed for your booking. Our team will review it shortly.',
    },
    provider: {
      title: 'New Dispute',
      message: 'A new dispute has been filed against your booking. Please check the details.',
    },
  },
  dispute_resolved: {
    customer: {
      title: 'Dispute Resolved',
      message: 'Your dispute has been resolved. Check the resolution details.',
    },
    provider: {
      title: 'Dispute Resolved',
      message: 'A dispute has been resolved. Check the resolution details.',
    },
  },
  dispute_evidence_added: {
    customer: {
      title: 'Dispute Evidence Added',
      message: 'New evidence has been added to your dispute.',
    },
    provider: {
      title: 'Dispute Evidence Added',
      message: 'New evidence has been added to the dispute.',
    },
  },
  dispute_assigned: {
    customer: {
      title: 'Dispute Assigned',
      message: 'Your dispute has been assigned to a support agent.',
    },
    provider: {
      title: 'Dispute Assigned',
      message: 'A dispute has been assigned for review.',
    },
  },
  service_updated: {
    customer: {
      title: 'Service Updated',
      message: 'A service you booked has been updated.',
    },
    provider: {
      title: 'Service Updated',
      message: 'Your service listing has been updated.',
    },
  },
  withdrawal: {
    customer: {
      title: 'Withdrawal Processed',
      message: 'Your withdrawal request has been processed.',
    },
    provider: {
      title: 'Withdrawal Processed',
      message: 'Your withdrawal request is being processed.',
    },
  },
  withdrawal_approved: {
    customer: {
      title: 'Withdrawal Approved',
      message: 'Your withdrawal has been approved and is being processed.',
    },
    provider: {
      title: 'Withdrawal Approved',
      message: 'Your withdrawal request has been approved. Funds will be transferred within 2-3 business days.',
    },
  },
  withdrawal_rejected: {
    customer: {
      title: 'Withdrawal Rejected',
      message: 'Your withdrawal request has been rejected.',
    },
    provider: {
      title: 'Withdrawal Rejected',
      message: 'Your withdrawal request has been rejected. Please contact support for more details.',
    },
  },
};

// ============================================
// NotificationService Class
// ============================================

const MAX_NOTIFICATIONS_PER_USER = 100;

export class NotificationService {
  // ========================================
  // In-App Notifications
  // ========================================

  async createNotification(data: NotificationData): Promise<any> {
    // Check rate limit for this user
    if (!(await canSendNotification(data.recipientId))) {
      logger.debug('Skipping notification due to rate limit', {
        context: 'NotificationService',
        action: 'RATE_LIMITED',
        type: data.type,
        recipientId: data.recipientId,
      });
      return null;
    }

    const notification = new BookingNotification({
      recipientId: data.recipientId,
      type: data.type,
      title: data.title,
      message: data.message,
      actionText: data.actionText,
      actionUrl: data.actionUrl,
      metadata: data.metadata || {},
      channels: data.channels || ['in_app'],
    });

    await notification.save();

    // FIX: Mark in-app channel as sent after successful save
    await BookingNotification.findByIdAndUpdate(notification._id, {
      'channels.inApp.sent': true,
      'channels.inApp.sentAt': new Date(),
    });

    // Prune old notifications to maintain bounded storage
    await this.pruneOldNotifications(data.recipientId);

    return notification;
  }

  async createBookingNotification(
    bookingId: string,
    recipientId: string,
    notificationType: NotificationType,
    metadata: Record<string, any>
  ): Promise<any> {
    // Check rate limit for this user
    // FIX: Added await to properly wait for async rate limit check
    if (!await canSendNotification(recipientId)) {
      logger.debug('Skipping booking notification due to rate limit', {
        context: 'NotificationService',
        action: 'BOOKING_NOTIFICATION_RATE_LIMITED',
        notificationType,
        recipientId,
      });
      return null;
    }

    const template = NOTIFICATION_TEMPLATES[notificationType];

    // Determine recipient role from metadata
    const isProvider = metadata.providerName !== undefined;
    const roleTemplate = isProvider ? template.provider : template.customer;

    const notification = new BookingNotification({
      bookingId,
      recipientId,
      type: notificationType,
      title: roleTemplate.title,
      message: roleTemplate.message,
      metadata: this.formatMetadata(notificationType, metadata),
    });

    await notification.save();

    // FIX: Mark in-app channel as sent after successful save
    await BookingNotification.findByIdAndUpdate(notification._id, {
      'channels.inApp.sent': true,
      'channels.inApp.sentAt': new Date(),
    });

    // Prune old notifications to maintain bounded storage
    await this.pruneOldNotifications(recipientId);

    return notification;
  }

  async sendBookingNotifications(
    bookingId: string,
    customerId: string | null,
    providerId: string,
    notificationType: NotificationType,
    metadata: Record<string, any>
  ): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[notificationType];
    const notificationsToInsert: any[] = [];

    // Customer notification
    if (customerId) {
      notificationsToInsert.push({
        bookingId,
        recipientId: customerId,
        type: notificationType,
        title: template.customer.title,
        message: template.customer.message,
        metadata: this.formatMetadata(notificationType, { ...metadata, isProvider: false }),
        channels: ['in_app'],
      });
    }

    // Provider notification
    notificationsToInsert.push({
      bookingId,
      recipientId: providerId,
      type: notificationType,
      title: template.provider.title,
      message: template.provider.message,
      metadata: this.formatMetadata(notificationType, { ...metadata, isProvider: true }),
      channels: ['in_app'],
    });

    // Bulk insert all notifications at once
    if (notificationsToInsert.length > 0) {
      try {
        const insertedNotifications = await BookingNotification.insertMany(notificationsToInsert, { ordered: false });

        // FIX: Mark in-app channel as sent for all inserted notifications
        const insertedIds = insertedNotifications.map((n: any) => n._id);
        await BookingNotification.updateMany(
          { _id: { $in: insertedIds } },
          {
            $set: {
              'channels.inApp.sent': true,
              'channels.inApp.sentAt': new Date(),
            },
          }
        );
      } catch (error) {
        // FIX: Queue failed notifications for retry instead of silently swallowing errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Bulk notification insert failed, queueing for retry', {
          context: 'NotificationService',
          action: 'BULK_INSERT_FAILED_QUEUED',
          bookingId,
          recipientCount: notificationsToInsert.length,
          error: errorMessage,
        });

        // Queue each failed notification for retry
        await this.queueFailedNotifications(notificationsToInsert, errorMessage);
      }
    }

    // Prune old notifications for each recipient
    const recipientIds = notificationsToInsert.map(n => n.recipientId);
    await Promise.all(recipientIds.map(recipientId => this.pruneOldNotifications(recipientId)));
  }

  /**
   * Queue failed notifications for retry
   * FIX: Implements notification queue with retry instead of silently swallowing errors
   */
  private async queueFailedNotifications(
    notifications: Array<{
      recipientId: string;
      type: NotificationType;
      title: string;
      message: string;
      metadata?: Record<string, any>;
    }>,
    error: string
  ): Promise<void> {
    try {
      const queueEntries = notifications.map(notif => ({
        recipientId: notif.recipientId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        actionText: notif.metadata?.actionText,
        actionUrl: notif.metadata?.actionUrl,
        metadata: notif.metadata,
        channel: 'in_app' as const,
        error,
        attempts: 0,
        maxAttempts: 5,
        status: 'pending' as const,
        nextRetry: new Date(Date.now() + 1000) // Retry in 1 second initially
      }));

      await NotificationQueue.insertMany(queueEntries);

      logger.info('Failed notifications queued for retry', {
        context: 'NotificationService',
        action: 'NOTIFICATIONS_QUEUED',
        count: notifications.length
      });
    } catch (queueError) {
      // If queueing also fails, log the critical error but don't crash
      logger.error('CRITICAL: Failed to queue notifications for retry', {
        context: 'NotificationService',
        action: 'QUEUE_FAILED',
        originalError: error,
        queueError: queueError instanceof Error ? queueError.message : String(queueError),
        notifications: notifications.map(n => ({ recipientId: n.recipientId, type: n.type }))
      });
    }
  }

  /**
   * Process pending notifications in the queue
   * This method should be called by a job processor
   */
  async processNotificationQueue(batchSize: number = 100): Promise<{ processed: number; failed: number }> {
    const pendingNotifications = await NotificationQueue.find({
      status: 'pending',
      nextRetry: { $lte: new Date() }
    })
      .sort({ createdAt: 1 })
      .limit(batchSize);

    let processed = 0;
    let failed = 0;

    for (const queueEntry of pendingNotifications) {
      try {
        queueEntry.status = 'processing';
        queueEntry.attempts += 1;
        queueEntry.lastAttempt = new Date();
        await queueEntry.save();

        // Attempt to create the notification
        const notification = new BookingNotification({
          recipientId: queueEntry.recipientId,
          type: queueEntry.type as NotificationType,
          title: queueEntry.title,
          message: queueEntry.message,
          actionText: queueEntry.actionText,
          actionUrl: queueEntry.actionUrl,
          metadata: queueEntry.metadata || {},
          channels: [queueEntry.channel],
        });

        await notification.save();

        // Mark as completed
        queueEntry.status = 'completed';
        await queueEntry.save();

        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (queueEntry.attempts >= queueEntry.maxAttempts) {
          // Max retries exceeded, mark as failed
          queueEntry.status = 'failed';
          logger.error('Notification permanently failed after max retries', {
            context: 'NotificationService',
            action: 'NOTIFICATION_PERMANENTLY_FAILED',
            recipientId: queueEntry.recipientId,
            type: queueEntry.type,
            attempts: queueEntry.attempts
          });
        } else {
          // Schedule next retry
          queueEntry.status = 'pending';
          queueEntry.error = errorMessage;
          queueEntry.nextRetry = queueEntry.getNextRetryTime();

          logger.warn('Notification retry scheduled', {
            context: 'NotificationService',
            action: 'NOTIFICATION_RETRY_SCHEDULED',
            recipientId: queueEntry.recipientId,
            type: queueEntry.type,
            attempt: queueEntry.attempts,
            nextRetry: queueEntry.nextRetry
          });
        }

        await queueEntry.save();
        failed++;
      }
    }

    return { processed, failed };
  }

  // ========================================
  // Get User Notifications
  // ========================================

  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
    } = {}
  ): Promise<{
    notifications: any[];
    unreadCount: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const { page = 1, limit = 20, unreadOnly = false, type } = options;

    const query: any = { recipientId: userId };
    // FIX: Use correct field path for in-app read status (channels.inApp.read, not isRead)
    if (unreadOnly) query['channels.inApp.read'] = false;
    if (type) query.type = type;

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      BookingNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('bookingId', 'bookingNumber status'),
      BookingNotification.countDocuments(query),
      // FIX: Use correct field path for unread count query
      BookingNotification.countDocuments({ recipientId: userId, 'channels.inApp.read': false }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    // FIX: Use correct field path for marking in-app notification as read
    await BookingNotification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { $set: { 'channels.inApp.read': true, 'channels.inApp.readAt': new Date() } }
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    // FIX: Use correct field path for marking all in-app notifications as read
    await BookingNotification.updateMany(
      { recipientId: userId, 'channels.inApp.read': false },
      { $set: { 'channels.inApp.read': true, 'channels.inApp.readAt': new Date() } }
    );
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await BookingNotification.findOneAndDelete({ _id: notificationId, recipientId: userId });
  }

  async clearAllNotifications(userId: string): Promise<void> {
    await BookingNotification.deleteMany({ recipientId: userId });
  }

  /**
   * Prune old notifications to maintain bounded storage (max 100 per user)
   * Deletes oldest notifications first to stay under the limit
   */
  private async pruneOldNotifications(userId: string): Promise<void> {
    try {
      const count = await BookingNotification.countDocuments({ recipientId: userId });
      if (count > MAX_NOTIFICATIONS_PER_USER) {
        // Find notifications to delete (oldest ones beyond the limit)
        const notificationsToDelete = await BookingNotification.find({ recipientId: userId })
          .sort({ createdAt: 1 }) // Oldest first
          .skip(MAX_NOTIFICATIONS_PER_USER)
          .select('_id')
          .limit(count - MAX_NOTIFICATIONS_PER_USER);

        const idsToDelete = notificationsToDelete.map(n => n._id);
        await BookingNotification.deleteMany({ _id: { $in: idsToDelete } });
        logger.debug('Pruned old notifications', {
          context: 'NotificationService',
          action: 'PRUNE_OLD_NOTIFICATIONS',
          userId,
          prunedCount: idsToDelete.length,
        });
      }
    } catch (error) {
      logger.error('Failed to prune old notifications', {
        context: 'NotificationService',
        action: 'PRUNE_FAILED',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ========================================
  // Email Notifications
  // ========================================

  async sendEmail(data: EmailData, notificationType: NotificationType = 'promotion'): Promise<void> {
    // FIX: Check user email preferences before sending
    // Need to find user by email to check preferences
    const user = await User.findOne({ email: data.to });
    if (user && !(await this.shouldSendToChannel(user._id.toString(), 'email', notificationType))) {
      logger.debug('Email skipped - user opted out', {
        context: 'NotificationService',
        action: 'USER_OPTED_OUT_EMAIL',
        to: data.to,
        notificationType,
      });
      return;
    }

    const success = await emailSend(data.to, data.subject, data.template);
    if (!success) {
      logger.error('Failed to send email', {
        context: 'NotificationService',
        action: 'EMAIL_SEND_FAILED',
        to: data.to,
        subject: data.subject,
      });
    }
  }

  async sendBulkEmail(userIds: string[], data: Omit<EmailData, 'to'>): Promise<void> {
    const users = await User.find({ _id: { $in: userIds }, 'communicationPreferences.email.marketing': true });

    const promises = users.map(user =>
      this.sendEmail({
        ...data,
        to: user.email,
      }).catch(err => {
        logger.error('Failed to send bulk email', {
          context: 'NotificationService',
          action: 'BULK_EMAIL_FAILED',
          to: user.email,
          error: err instanceof Error ? err.message : String(err),
        });
      })
    );

    await Promise.allSettled(promises);
  }

  // ========================================
  // Push Notifications (FCM)
  // ========================================

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    notificationType: NotificationType = 'booking_reminder'
  ): Promise<boolean> {
    if (!firebaseApp) {
      logger.debug('Firebase not configured - skipping push', {
        context: 'NotificationService',
        action: 'FIREBASE_NOT_CONFIGURED',
        userId,
        title,
        body,
      });
      return false;
    }

    // FIX: Check user push preferences before sending
    if (!(await this.shouldSendToChannel(userId, 'push', notificationType))) {
      logger.debug('Push notification skipped - user opted out', {
        context: 'NotificationService',
        action: 'USER_OPTED_OUT_PUSH',
        userId,
        notificationType,
      });
      return false;
    }

    try {
      const result = await pushCircuitBreaker.execute(
        async () => {
          const retryResult = await withRetry(
            async () => {
              // Get user's device tokens from the database
              const user = await User.findById(userId).select('deviceTokens firstName');
              if (!user) {
                logger.warn('Push notification skipped - user not found', {
                  context: 'NotificationService',
                  action: 'USER_NOT_FOUND',
                  userId,
                });
                return false;
              }

              const activeTokens = user.deviceTokens?.filter((t: any) => t.isActive) || [];
              if (activeTokens.length === 0) {
                logger.debug('No active device tokens for user', {
                  context: 'NotificationService',
                  action: 'NO_TOKENS',
                  userId,
                });
                return false;
              }

              const messaging = admin.messaging(firebaseApp);
              const tokens = activeTokens.map((t: any) => t.token);

              // Send to all device tokens
              const response = await messaging.sendEachForMulticast({
                notification: {
                  title,
                  body,
                },
                data: {
                  ...data,
                  userId,
                  clickAction: data?.actionUrl || 'OPEN_APP',
                },
                tokens,
              });

              // Handle failures
              const failures = response.failureCount;
              if (failures > 0) {
                logger.debug('Push notification completed with failures', {
                  context: 'NotificationService',
                  action: 'PUSH_COMPLETED_WITH_FAILURES',
                  userId,
                  totalDevices: activeTokens.length,
                  failures,
                });
                response.responses.forEach((resp, idx) => {
                  if (!resp.success) {
                    const errorCode = resp.error?.code;
                    // Remove invalid tokens
                    if (errorCode === 'messaging/registration-token-not-registered' ||
                        errorCode === 'messaging/invalid-registration-token') {
                      user.deviceTokens?.splice(idx, 1);
                    }
                  }
                });
                await user.save();
              }

              logger.debug('Push notification sent successfully', {
                context: 'NotificationService',
                action: 'PUSH_SUCCESS',
                userId,
                successCount: response.successCount,
                totalDevices: activeTokens.length,
              });
              return response.successCount > 0;
            },
            { maxAttempts: 3, initialDelayMs: 1000 }
          );

          if (!retryResult.success) {
            throw retryResult.error || new Error('Push notification failed after retries');
          }
          return retryResult.result;
        },
        async () => {
          // Circuit breaker fallback: log for manual retry
          logger.warn('Push notification circuit breaker fallback', {
            context: 'NotificationService',
            action: 'PUSH_CIRCUIT_BREAKER_FALLBACK',
            userId,
            title,
          });
          return false;
        }
      );

      return result ?? false;
    } catch (error) {
      logger.error('Failed to send push notification via circuit breaker', {
        context: 'NotificationService',
        action: 'PUSH_CIRCUIT_BREAKER_ERROR',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendBulkPushNotification(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      userIds.map(userId => this.sendPushNotification(userId, title, body, data))
    );

    let sent = 0;
    let failed = 0;

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        sent++;
      } else {
        failed++;
      }
    });

    return { sent, failed };
  }

  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
    deviceId?: string
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    // Check if token already exists
    const existingTokenIndex = user.deviceTokens?.findIndex((t: any) => t.token === token);

    if (existingTokenIndex !== undefined && existingTokenIndex >= 0) {
      // Update existing token
      user.deviceTokens[existingTokenIndex].lastUsed = new Date();
      user.deviceTokens[existingTokenIndex].isActive = true;
    } else {
      // Add new token
      if (!user.deviceTokens) {
        user.deviceTokens = [];
      }
      user.deviceTokens.push({
        token,
        platform,
        deviceId,
        addedAt: new Date(),
        lastUsed: new Date(),
        isActive: true,
      });
    }

    await user.save();
  }

  /**
   * Remove a device token (e.g., on logout)
   */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $pull: { deviceTokens: { token } },
    });
  }

  // ========================================
  // SMS Notifications (Delegated to SmsService)
  // Note: SMS logic has been extracted to sms.service.ts for better separation of concerns
  // including delivery receipts, STOP/unsubscribe handling, and DLQ management
  // ========================================

  /**
   * Send SMS message
   * @deprecated Use smsService.send() directly for full functionality
   * Note: Preference checking is done in smsService.send() via checkSmsOptOut()
   * This wrapper adds explicit preference checking for better logging
   */
  async sendSms(
    phoneNumber: string,
    message: string,
    notificationType: NotificationType = 'booking_reminder'
  ): Promise<boolean> {
    // FIX: Check user SMS preferences before sending
    // Find user by phone to check preferences
    const cleanedPhone = phoneNumber.replace(/[^\d+]/g, '');
    const user = await User.findOne({ phone: cleanedPhone });
    if (user && !(await this.shouldSendToChannel(user._id.toString(), 'sms', notificationType))) {
      logger.debug('SMS skipped - user opted out', {
        context: 'NotificationService',
        action: 'USER_OPTED_OUT_SMS',
        phoneNumber: cleanedPhone.slice(-4).padStart(cleanedPhone.length, '*'),
        notificationType,
      });
      return false;
    }

    const result = await smsService.send(phoneNumber, message);
    return result.success;
  }

  /**
   * Send SMS notification for booking events
   * @deprecated Use smsService.sendBookingSms() directly for full functionality
   */
  async sendBookingSms(
    phoneNumber: string,
    bookingNumber: string,
    eventType: 'confirmed' | 'reminder' | 'cancelled' | 'completed'
  ): Promise<boolean> {
    return smsService.sendBookingSms(phoneNumber, bookingNumber, eventType);
  }

  /**
   * Send OTP via SMS for phone verification
   * @deprecated Use smsService.sendOtp() directly for full functionality
   */
  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    return smsService.sendOtp(phoneNumber, otp);
  }

  // ========================================
  // Scheduled Notifications
  // ========================================

  async scheduleBookingReminder(
    bookingId: string,
    _customerId: string,
    _providerId: string,
    reminderTime: Date,
    _metadata: Record<string, any>
  ): Promise<void> {
    // This would typically use a job queue like Bull/BullMQ
    // For now, just log the scheduled notification
    logger.info('Booking reminder scheduled', {
      context: 'NotificationService',
      action: 'REMINDER_SCHEDULED',
      bookingId,
      reminderTime: reminderTime.toISOString(),
    });

    // In production with BullMQ:
    // await reminderQueue.add(
    //   'booking-reminder',
    //   { bookingId, customerId, providerId, metadata },
    //   { runAt: reminderTime }
    // );
  }

  // ========================================
  // User Preference Checks
  // ========================================

  /**
   * Check if a notification should be sent via a specific channel based on user preferences
   * FIX: This method was not being called before - now integrated into all send methods
   */
  private async shouldSendToChannel(
    userId: string,
    channel: 'email' | 'sms' | 'push',
    notificationType: NotificationType
  ): Promise<boolean> {
    const user = await User.findById(userId).select('communicationPreferences');
    if (!user) {
      // If user not found, default to allowing notification
      return true;
    }

    const prefs = user.communicationPreferences;
    const channelPrefs = prefs?.[channel];

    // Default to allowing if no preferences set
    if (!channelPrefs) {
      return true;
    }

    // Map notification types to preference categories
    switch (notificationType) {
      case 'booking_request':
        // booking_request always allowed (core functionality)
        return true;

      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_rejected':
      case 'review_received':
        return channelPrefs.bookingUpdates ?? true;

      case 'booking_started':
      case 'booking_completed':
        return channelPrefs.bookingUpdates ?? true;

      case 'booking_reminder':
        return channelPrefs.reminders ?? true;

      case 'message_received':
        return (channelPrefs as any).newMessages ?? true;

      case 'promotion':
        return channelPrefs.promotions ?? false;

      case 'loyalty_update':
        return (channelPrefs as any).loyaltyUpdates ?? true;

      default:
        return true;
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  private formatMetadata(type: NotificationType, data: Record<string, any>): Record<string, any> {
    const formatted: Record<string, any> = {};

    switch (type) {
      case 'booking_request':
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_rejected':
      case 'booking_started':
      case 'booking_completed':
        formatted.bookingNumber = data.bookingNumber;
        formatted.serviceName = data.serviceName;
        formatted.scheduledDate = data.scheduledDate;
        formatted.totalAmount = data.totalAmount;
        formatted.currency = data.currency;
        if (data.providerName) formatted.providerName = data.providerName;
        if (data.customerName) formatted.customerName = data.customerName;
        break;

      case 'message_received':
        formatted.bookingNumber = data.bookingNumber;
        formatted.serviceName = data.serviceName;
        break;

      case 'review_received':
        formatted.rating = data.rating;
        formatted.review = data.review;
        formatted.providerName = data.providerName;
        break;

      default:
        Object.assign(formatted, data);
    }

    return formatted;
  }

  async getNotificationPreferences(userId: string): Promise<Record<NotificationType, boolean>> {
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    const prefs = user.communicationPreferences;

    return {
      booking_request: true,
      booking_confirmed: prefs.email?.bookingUpdates ?? true,
      booking_cancelled: prefs.email?.bookingUpdates ?? true,
      booking_rejected: prefs.email?.bookingUpdates ?? true,
      booking_started: prefs.push?.bookingUpdates ?? true,
      booking_completed: prefs.push?.bookingUpdates ?? true,
      booking_reminder: prefs.push?.reminders ?? true,
      message_received: prefs.push?.newMessages ?? true,
      review_received: prefs.email?.bookingUpdates ?? true,
      review_rejected: prefs.push?.bookingUpdates ?? true,
      promotion: prefs.email?.promotions ?? false,
      loyalty_update: true,
      provider_approved: prefs.push?.bookingUpdates ?? true,
      provider_rejected: prefs.push?.bookingUpdates ?? true,
      provider_suspended: prefs.push?.bookingUpdates ?? true,
      provider_document_verified: prefs.push?.bookingUpdates ?? true,
      provider_document_rejected: prefs.push?.bookingUpdates ?? true,
      service_approved: prefs.push?.bookingUpdates ?? true,
      service_rejected: prefs.push?.bookingUpdates ?? true,
      new_provider_submission: prefs.push?.bookingUpdates ?? true,
      new_service_pending: prefs.push?.bookingUpdates ?? true,
      dispute_received: prefs.push?.bookingUpdates ?? true,
      dispute_created: prefs.push?.bookingUpdates ?? true,
      dispute_resolved: prefs.push?.bookingUpdates ?? true,
      dispute_evidence_added: prefs.push?.bookingUpdates ?? true,
      dispute_assigned: prefs.push?.bookingUpdates ?? true,
      service_updated: prefs.push?.bookingUpdates ?? true,
      withdrawal: prefs.push?.bookingUpdates ?? true,
      withdrawal_approved: prefs.push?.bookingUpdates ?? true,
      withdrawal_rejected: prefs.push?.bookingUpdates ?? true,
    };
  }

  async updateNotificationPreferences(
    userId: string,
    updates: Partial<Record<NotificationType, boolean>>
  ): Promise<void> {
    if (!userId || !updates) {
      throw ApiError.badRequest('User ID and updates are required', [], ERROR_CODES.MISSING_REQUIRED_FIELD);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    // Map notification types to preference categories
    const preferenceUpdates: Record<string, any> = {};

    // Email preferences
    if ('promotion' in updates) {
      preferenceUpdates['communicationPreferences.email.promotions'] = updates.promotion;
    }
    if (updates.booking_request || updates.booking_confirmed || updates.booking_cancelled ||
        updates.booking_rejected || updates.review_received) {
      preferenceUpdates['communicationPreferences.email.bookingUpdates'] =
        updates.booking_confirmed ?? updates.booking_cancelled ?? true;
    }
    if (updates.booking_reminder) {
      preferenceUpdates['communicationPreferences.email.reminders'] = updates.booking_reminder;
    }
    if (updates.review_received) {
      preferenceUpdates['communicationPreferences.email.bookingUpdates'] = updates.review_received;
    }

    // SMS preferences
    if (updates.booking_confirmed || updates.booking_cancelled) {
      preferenceUpdates['communicationPreferences.sms.bookingUpdates'] =
        updates.booking_confirmed ?? updates.booking_cancelled ?? true;
    }
    if (updates.booking_reminder) {
      preferenceUpdates['communicationPreferences.sms.reminders'] = updates.booking_reminder;
    }
    if (updates.promotion) {
      preferenceUpdates['communicationPreferences.sms.promotions'] = updates.promotion;
    }

    // Push preferences
    if (updates.booking_started || updates.booking_completed) {
      preferenceUpdates['communicationPreferences.push.bookingUpdates'] =
        updates.booking_started ?? updates.booking_completed ?? true;
    }
    if (updates.booking_reminder) {
      preferenceUpdates['communicationPreferences.push.reminders'] = updates.booking_reminder;
    }
    if (updates.message_received) {
      preferenceUpdates['communicationPreferences.push.newMessages'] = updates.message_received;
    }
    if (updates.promotion) {
      preferenceUpdates['communicationPreferences.push.promotions'] = updates.promotion;
    }

    if (Object.keys(preferenceUpdates).length > 0) {
      await User.findByIdAndUpdate(userId, { $set: preferenceUpdates });
      logger.info('Updated notification preferences', {
        context: 'NotificationService',
        action: 'PREFERENCES_UPDATED',
        userId,
        changes: Object.keys(preferenceUpdates),
      });
    } else {
      logger.debug('No preference updates provided', {
        context: 'NotificationService',
        action: 'NO_PREFERENCE_UPDATES',
        userId,
      });
    }
  }

  /**
   * Get unsubscribe URL for email marketing
   * FIX: Now uses HMAC-signed tokens from email.service to prevent token forgery
   * Previous implementation used plain base64 encoding (security vulnerability)
   */
  async getUnsubscribeUrl(userId: string, emailType: 'marketing' | 'promotions' | 'newsletters' = 'marketing'): Promise<string> {
    // Import the secure implementation from email.service
    try {
      const { getUnsubscribeUrl: secureGetUnsubscribeUrl } = await import('./email.service');
      return secureGetUnsubscribeUrl(userId, emailType);
    } catch (importError) {
      // Fallback: generate unsubscribe URL directly if email service not available
      logger.warn('Email service not available for unsubscribe URL generation', {
        context: 'NotificationService',
        action: 'UNSUBSCRIBE_URL_FALLBACK',
        userId,
      });
      // Generate a basic token - note this should be enhanced with HMAC in production
      const crypto = require('crypto');
      const token = crypto.createHash('sha256')
        .update(`${userId}:${emailType}:${process.env.UNSUBSCRIBE_SECRET || 'default'}`)
        .digest('hex')
        .substring(0, 32);
      return `/api/auth/unsubscribe?userId=${userId}&token=${token}&type=${emailType}`;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export rate limiting utilities for external use
export { canSendNotification, getRemainingCooldown };
