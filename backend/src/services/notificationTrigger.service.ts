/**
 * Notification Trigger Service
 * Handles triggering notifications on various events with multi-channel dispatch
 */

import { notificationService, NotificationType } from './notification.service';
import { whatsAppService } from './notifications/whatsapp.service';
import { webPushService } from './notifications/webpush.service';
import { telegramService } from './notifications/telegram.service';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import { cache } from '../config/redis';
import {
  renderNotification,
  getSupportedChannels,
  getNotificationPriority,
  NotificationEventType,
  TemplateVariables,
} from '../templates/notifications';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_NOTIFICATIONS_PER_WINDOW = 10;

// Channel types
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app' | 'whatsapp' | 'telegram';

interface TriggerResult {
  success: boolean;
  channels: {
    [K in NotificationChannel]?: {
      success: boolean;
      error?: string;
    };
  };
}

interface NotificationTriggerPayload {
  eventType: NotificationEventType;
  recipientId: string;
  variables: TemplateVariables;
  channels?: NotificationChannel[];
  priorityOverride?: 'low' | 'normal' | 'high' | 'urgent';
  bypassPreferences?: boolean;
}

/**
 * Check if user has opted into a specific channel
 */
async function isChannelEnabled(
  userId: string,
  channel: NotificationChannel,
  eventType: NotificationEventType
): Promise<boolean> {
  const cacheKey = `user:${userId}:channel:${channel}:${eventType}`;

  // Check cache first
  try {
    const cached = await (cache as any).get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }
  } catch (error) {
    // Continue to DB lookup
  }

  const user = await User.findById(userId).select('communicationPreferences whatsappOptIn telegramChatId');
  if (!user) return false;

  let enabled = true;

  switch (channel) {
    case 'email':
      enabled = user.communicationPreferences?.email?.marketing ?? true;
      break;
    case 'sms':
      enabled = user.communicationPreferences?.sms?.bookingUpdates ?? true;
      break;
    case 'push':
      enabled = user.communicationPreferences?.push?.bookingUpdates ?? true;
      break;
    case 'whatsapp':
      enabled = !!(user as any).whatsappOptIn?.optedIn;
      break;
    case 'telegram':
      enabled = !!(user as any).telegramChatId;
      break;
    case 'in_app':
      enabled = true; // Always enabled
      break;
  }

  // Cache the result for 5 minutes
  try {
    await (cache as any).set(cacheKey, enabled.toString(), 'EX', 300);
  } catch (error) {
    // Cache error is non-fatal
  }

  return enabled;
}

/**
 * Check if user is within quiet hours
 */
async function isInQuietHours(userId: string): Promise<boolean> {
  const { isPlatformQuietHours } = await import('./platformSettingsPolicy.service');
  if (isPlatformQuietHours()) {
    return true;
  }

  const user = await User.findById(userId).select('communicationPreferences.quietHours');
  if (!user?.communicationPreferences?.quietHours?.enabled) {
    return false;
  }

  const { startTime, endTime, timezone } = user.communicationPreferences.quietHours;
  if (!startTime || !endTime) return false;

  // Get current time in user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const currentTime = formatter.format(now);
  const currentMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1]);

  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Check rate limit for user
 */
async function checkRateLimit(userId: string): Promise<boolean> {
  const cacheKey = `ratelimit:notifications:${userId}`;

  try {
    const redisClient = (cache as any).client;
    if (redisClient) {
      const current = await redisClient.incr(cacheKey);
      if (current === 1) {
        await redisClient.expire(cacheKey, Math.ceil(RATE_LIMIT_WINDOW / 1000));
      }
      return current <= MAX_NOTIFICATIONS_PER_WINDOW;
    }
  } catch (error) {
    // Continue without rate limiting
  }

  return true;
}

/**
 * Determine user role from recipient ID
 */
async function getUserRole(recipientId: string): Promise<'customer' | 'provider'> {
  const user = await User.findById(recipientId).select('role');
  if (!user) return 'customer';

  const role = (user as any).role?.toLowerCase();
  if (role === 'provider' || role === 'professional') {
    return 'provider';
  }

  return 'customer';
}

/**
 * Get user preferences for channels
 */
async function getUserChannels(
  userId: string,
  eventType: NotificationEventType
): Promise<NotificationChannel[]> {
  const supportedChannels = getSupportedChannels(eventType);
  const enabledChannels: NotificationChannel[] = [];

  for (const channel of supportedChannels) {
    if (await isChannelEnabled(userId, channel, eventType)) {
      enabledChannels.push(channel);
    }
  }

  return enabledChannels;
}

export class NotificationTriggerService {
  /**
   * Trigger a notification event
   */
  async trigger(payload: NotificationTriggerPayload): Promise<TriggerResult> {
    const {
      eventType,
      recipientId,
      variables,
      channels,
      priorityOverride,
      bypassPreferences,
    } = payload;

    const result: TriggerResult = {
      success: true,
      channels: {},
    };

    // Validate recipient exists
    const user = await User.findById(recipientId);
    if (!user) {
      throw ApiError.notFound('Recipient not found', ERROR_CODES.USER_NOT_FOUND);
    }

    // Check rate limit
    if (!bypassPreferences && !(await checkRateLimit(recipientId))) {
      logger.warn('Notification rate limited', {
        context: 'NotificationTrigger',
        action: 'RATE_LIMITED',
        recipientId,
        eventType,
      });

      // Queue for later
      await this.queueNotification(payload);
      return {
        success: false,
        channels: { in_app: { success: false, error: 'Rate limited' } },
      };
    }

    // Check quiet hours for non-urgent notifications
    const priority = priorityOverride || getNotificationPriority(eventType);
    if (priority !== 'urgent' && !bypassPreferences && await isInQuietHours(recipientId)) {
      // Queue for after quiet hours
      await this.queueNotification(payload);
      logger.debug('Notification queued for after quiet hours', {
        context: 'NotificationTrigger',
        action: 'QUIET_HOURS',
        recipientId,
        eventType,
      });
      return {
        success: false,
        channels: { in_app: { success: false, error: 'Queued for quiet hours' } },
      };
    }

    // Determine channels to use
    const channelsToUse = channels || await getUserChannels(recipientId, eventType);
    const userRole = await getUserRole(recipientId);

    // Render notification content for each channel
    for (const channel of channelsToUse) {
      if (channel === 'in_app') {
        try {
          await this.sendInAppNotification(recipientId, eventType, userRole, variables);
          result.channels.in_app = { success: true };
        } catch (error) {
          result.channels.in_app = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          result.success = false;
        }
      } else if (channel === 'email') {
        try {
          await this.sendEmailNotification(recipientId, eventType, userRole, variables);
          result.channels.email = { success: true };
        } catch (error) {
          result.channels.email = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      } else if (channel === 'sms') {
        try {
          await this.sendSmsNotification(recipientId, eventType, userRole, variables);
          result.channels.sms = { success: true };
        } catch (error) {
          result.channels.sms = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      } else if (channel === 'push') {
        try {
          await this.sendPushNotification(recipientId, eventType, userRole, variables);
          result.channels.push = { success: true };
        } catch (error) {
          result.channels.push = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      } else if (channel === 'whatsapp') {
        try {
          await this.sendWhatsAppNotification(recipientId, eventType, userRole, variables);
          result.channels.whatsapp = { success: true };
        } catch (error) {
          result.channels.whatsapp = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      } else if (channel === 'telegram') {
        try {
          await this.sendTelegramNotification(recipientId, eventType, userRole, variables);
          result.channels.telegram = { success: true };
        } catch (error) {
          result.channels.telegram = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    }

    logger.info('Notification triggered', {
      context: 'NotificationTrigger',
      action: 'TRIGGERED',
      eventType,
      recipientId,
      channels: Object.keys(result.channels),
      success: result.success,
    });

    return result;
  }

  /**
   * Trigger notification to multiple recipients
   */
  async triggerBulk(
    payloads: NotificationTriggerPayload[]
  ): Promise<Map<string, TriggerResult>> {
    const results = new Map<string, TriggerResult>();

    // Process in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 5;
    for (let i = 0; i < payloads.length; i += CONCURRENCY_LIMIT) {
      const batch = payloads.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map((payload) =>
          this.trigger(payload).catch((error) => ({
            success: false,
            channels: {},
            error: error instanceof Error ? error.message : 'Unknown error',
          }))
        )
      );

      batch.forEach((payload, index) => {
        results.set(payload.recipientId, batchResults[index] as TriggerResult);
      });
    }

    return results;
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    userId: string,
    eventType: NotificationEventType,
    role: 'customer' | 'provider',
    variables: TemplateVariables
  ): Promise<void> {
    const rendered = renderNotification(eventType, role, 'in_app', variables);
    if (!rendered) return;

    await notificationService.createNotification({
      recipientId: userId,
      type: this.mapEventToType(eventType),
      title: rendered.title,
      message: rendered.body,
      actionText: rendered.actionText,
      actionUrl: rendered.actionUrl,
      metadata: variables,
      channels: ['in_app'],
    });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    userId: string,
    eventType: NotificationEventType,
    role: 'customer' | 'provider',
    variables: TemplateVariables
  ): Promise<void> {
    const user = await User.findById(userId).select('email');
    if (!user?.email) return;

    const rendered = renderNotification(eventType, role, 'email', variables);
    if (!rendered) return;

    await notificationService.sendEmail({
      to: user.email,
      subject: rendered.subject || rendered.title,
      template: eventType,
      data: variables,
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(
    userId: string,
    eventType: NotificationEventType,
    role: 'customer' | 'provider',
    variables: TemplateVariables
  ): Promise<void> {
    const user = await User.findById(userId).select('phone');
    if (!user?.phone) return;

    const rendered = renderNotification(eventType, role, 'sms', variables);
    if (!rendered) return;

    await notificationService.sendSms(
      user.phone,
      rendered.body,
      this.mapEventToType(eventType)
    );
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    userId: string,
    eventType: NotificationEventType,
    role: 'customer' | 'provider',
    variables: TemplateVariables
  ): Promise<void> {
    const rendered = renderNotification(eventType, role, 'push', variables);
    if (!rendered) return;

    await webPushService.sendPushNotification(userId, {
      title: rendered.title,
      body: rendered.body,
      data: {
        url: rendered.actionUrl,
        eventType,
        ...variables,
      },
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: eventType,
    });
  }

  /**
   * Send WhatsApp notification
   */
  private async sendWhatsAppNotification(
    userId: string,
    eventType: NotificationEventType,
    role: 'customer' | 'provider',
    variables: TemplateVariables
  ): Promise<void> {
    const user = await User.findById(userId).select('phone whatsappOptIn');
    if (!user?.phone || !(user as any).whatsappOptIn?.optedIn) return;

    const rendered = renderNotification(eventType, role, 'whatsapp', variables);
    if (!rendered) return;

    await whatsAppService.sendTextMessage(user.phone, rendered.body);
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegramNotification(
    userId: string,
    eventType: NotificationEventType,
    role: 'customer' | 'provider',
    variables: TemplateVariables
  ): Promise<void> {
    const user = await User.findById(userId).select('telegramChatId');
    if (!user?.telegramChatId) return;

    const rendered = renderNotification(eventType, role, 'in_app', variables);
    if (!rendered) return;

    await telegramService.sendMessage(
      user.telegramChatId,
      `*${rendered.title}*\n\n${rendered.body}`,
      { parseMode: 'Markdown' }
    );
  }

  /**
   * Queue notification for later delivery
   */
  private async queueNotification(payload: NotificationTriggerPayload): Promise<void> {
    // Store in a queue collection for processing later
    const { NotificationQueue } = await import('../models/notificationQueue.model');

    const queueEntry = new NotificationQueue({
      recipientId: payload.recipientId,
      eventType: payload.eventType,
      variables: payload.variables,
      channels: payload.channels,
      priority: payload.priorityOverride,
      scheduledFor: this.calculateNextDeliveryTime(payload.recipientId),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
    });

    await queueEntry.save();
  }

  /**
   * Calculate next delivery time (after quiet hours)
   */
  private async calculateNextDeliveryTime(userId: string): Promise<Date> {
    const user = await User.findById(userId).select('communicationPreferences.quietHours');
    if (!user?.communicationPreferences?.quietHours?.enabled) {
      return new Date();
    }

    const { endTime, timezone } = user.communicationPreferences.quietHours;
    if (!endTime) {
      return new Date();
    }

    // Calculate next delivery time
    const now = new Date();
    const [hours, minutes] = endTime.split(':').map(Number);

    const nextDelivery = new Date(now);
    nextDelivery.setHours(hours, minutes, 0, 0);

    // If end time has passed today, schedule for tomorrow
    if (nextDelivery <= now) {
      nextDelivery.setDate(nextDelivery.getDate() + 1);
    }

    return nextDelivery;
  }

  /**
   * Map event type to notification type
   */
  private mapEventToType(eventType: NotificationEventType): NotificationType {
    const mapping: Record<NotificationEventType, NotificationType> = {
      booking_confirmed: 'booking_confirmed',
      booking_reminder: 'booking_reminder',
      booking_cancelled: 'booking_cancelled',
      booking_completed: 'booking_completed',
      payment_received: 'booking_completed', // Fallback
      refund_processed: 'booking_cancelled', // Fallback
      review_submitted: 'review_received',
      dispute_opened: 'dispute_received',
      dispute_resolved: 'dispute_resolved',
      payout_approved: 'withdrawal_approved',
      provider_approved: 'provider_approved',
      provider_rejected: 'provider_rejected',
      loyalty_tier_upgrade: 'loyalty_update',
      welcome: 'promotion',
      birthday: 'promotion',
    };

    return mapping[eventType] || 'promotion';
  }

  // ========================================
  // Event-specific trigger methods
  // ========================================

  /**
   * Trigger booking confirmation
   */
  async triggerBookingConfirmed(
    bookingId: string,
    customerId: string,
    providerId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    // Customer notification
    await this.trigger({
      eventType: 'booking_confirmed',
      recipientId: customerId,
      variables: {
        customerName: metadata.customerName,
        providerName: metadata.providerName,
        serviceName: metadata.serviceName,
        bookingId: bookingId,
        bookingNumber: metadata.bookingNumber,
        scheduledDate: metadata.scheduledDate,
        scheduledTime: metadata.scheduledTime,
        totalAmount: metadata.totalAmount,
        currency: metadata.currency || 'AED',
        ...metadata,
      },
    });

    // Provider notification
    await this.trigger({
      eventType: 'booking_confirmed',
      recipientId: providerId,
      variables: {
        providerName: metadata.providerName,
        customerName: metadata.customerName,
        serviceName: metadata.serviceName,
        bookingId: bookingId,
        bookingNumber: metadata.bookingNumber,
        scheduledDate: metadata.scheduledDate,
        scheduledTime: metadata.scheduledTime,
        providerEarnings: metadata.providerEarnings,
        currency: metadata.currency || 'AED',
        ...metadata,
      },
    });
  }

  /**
   * Trigger booking reminder
   */
  async triggerBookingReminder(
    bookingId: string,
    customerId: string,
    providerId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    // Customer reminder
    await this.trigger({
      eventType: 'booking_reminder',
      recipientId: customerId,
      variables: {
        customerName: metadata.customerName,
        providerName: metadata.providerName,
        serviceName: metadata.serviceName,
        bookingId: bookingId,
        bookingNumber: metadata.bookingNumber,
        scheduledDate: metadata.scheduledDate,
        scheduledTime: metadata.scheduledTime,
        serviceAddress: metadata.serviceAddress,
        providerPhone: metadata.providerPhone,
        currency: metadata.currency || 'AED',
      },
      priorityOverride: 'high',
    });

    // Provider reminder
    await this.trigger({
      eventType: 'booking_reminder',
      recipientId: providerId,
      variables: {
        providerName: metadata.providerName,
        customerName: metadata.customerName,
        serviceName: metadata.serviceName,
        bookingId: bookingId,
        bookingNumber: metadata.bookingNumber,
        scheduledDate: metadata.scheduledDate,
        scheduledTime: metadata.scheduledTime,
        serviceAddress: metadata.serviceAddress,
        providerEarnings: metadata.providerEarnings,
        currency: metadata.currency || 'AED',
      },
      priorityOverride: 'high',
    });
  }

  /**
   * Trigger payment received
   */
  async triggerPaymentReceived(
    customerId: string,
    transactionId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.trigger({
      eventType: 'payment_received',
      recipientId: customerId,
      variables: {
        customerName: metadata.customerName,
        transactionId,
        amount: metadata.amount,
        currency: metadata.currency || 'AED',
        paymentMethod: metadata.paymentMethod,
        paymentDate: new Date(),
        bookingNumber: metadata.bookingNumber,
        serviceName: metadata.serviceName,
        receiptUrl: metadata.receiptUrl,
      },
    });
  }

  /**
   * Trigger refund processed
   */
  async triggerRefundProcessed(
    customerId: string,
    refundId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.trigger({
      eventType: 'refund_processed',
      recipientId: customerId,
      variables: {
        customerName: metadata.customerName,
        refundId,
        bookingNumber: metadata.bookingNumber,
        refundAmount: metadata.refundAmount,
        refundMethod: metadata.refundMethod,
        refundReason: metadata.refundReason,
        processedDate: new Date(),
        estimatedArrival: metadata.estimatedArrival,
        pointsReturned: metadata.pointsReturned,
        currency: metadata.currency || 'AED',
      },
    });
  }

  /**
   * Trigger provider approved
   */
  async triggerProviderApproved(
    providerId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.trigger({
      eventType: 'provider_approved',
      recipientId: providerId,
      variables: {
        providerName: metadata.providerName,
        providerGuideUrl: process.env.PROVIDER_GUIDE_URL || 'https://nilin.app/provider/guide',
        videoTutorialsUrl: process.env.VIDEO_TUTORIALS_URL || 'https://nilin.app/tutorials',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@nilin.app',
      },
      priorityOverride: 'urgent',
    });
  }

  /**
   * Trigger provider rejected
   */
  async triggerProviderRejected(
    providerId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.trigger({
      eventType: 'provider_rejected',
      recipientId: providerId,
      variables: {
        providerName: metadata.providerName,
        submittedDate: metadata.submittedDate,
        reviewedDate: new Date(),
        rejectionReason: metadata.rejectionReason,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@nilin.app',
      },
    });
  }

  /**
   * Trigger welcome notification
   */
  async triggerWelcome(
    userId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.trigger({
      eventType: 'welcome',
      recipientId: userId,
      variables: {
        userName: metadata.userName,
        referralCode: metadata.referralCode,
        welcomeBonus: metadata.welcomeBonus || 100,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@nilin.app',
      },
    });
  }

  /**
   * Trigger birthday notification
   */
  async triggerBirthday(
    userId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.trigger({
      eventType: 'birthday',
      recipientId: userId,
      variables: {
        userName: metadata.userName,
        birthdayPerks: metadata.birthdayPerks || 'special discounts and bonus points',
        discountCode: metadata.discountCode,
        discountPercentage: metadata.discountPercentage || 20,
        bonusPoints: metadata.bonusPoints || 200,
        validDays: metadata.validDays || 7,
        expiryDate: metadata.expiryDate,
        bonusEarnings: metadata.bonusEarnings || 10,
        appLink: process.env.APP_URL || 'https://nilin.app',
      },
    });
  }
}

// Export singleton instance
export const notificationTriggerService = new NotificationTriggerService();
