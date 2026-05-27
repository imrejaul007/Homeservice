import twilio, { Twilio } from 'twilio';
import BookingNotification from '../models/bookingNotification.model';
import User from '../models/user.model';
import { SmsDLQ } from '../models/smsDlq.model';
import { withRetry, retryConfigs, addToDeadLetterQueue } from '../utils/retry.util';
import logger from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/ApiError';

// ============================================
// Twilio Configuration
// ============================================

interface TwilioConfig {
  client: Twilio;
  phoneNumber: string;
}

const initializeTwilioClient = (): TwilioConfig | null => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    logger.info('Twilio SMS not configured - notifications will be skipped', {
      context: 'SmsService',
      action: 'TWILIO_NOT_CONFIGURED',
    });
    return null;
  }

  return {
    client: twilio(accountSid, authToken),
    phoneNumber,
  };
};

const twilioConfig = initializeTwilioClient();

// ============================================
// Types
// ============================================

export type SmsDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';

export interface SmsDeliveryReceipt {
  messageSid: string;
  messageStatus: SmsDeliveryStatus;
  to: string;
  from: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

export interface SmsMessage {
  to: string;
  body: string;
  messageSid?: string;
  status?: SmsDeliveryStatus;
  notificationId?: string;
}

// ============================================
// Dead Letter Queue Configuration (MongoDB-backed)
// ============================================

const SMS_RETRY_DELAY = 5 * 60 * 1000; // 5 minutes

/**
 * Mask phone number for logging (privacy)
 */
function maskPhoneNumber(phone: string): string {
  if (phone.length < 4) return '****';
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}

/**
 * Add failed SMS to MongoDB-backed Dead Letter Queue
 * FIX: Now persists to MongoDB instead of in-memory array
 * This ensures failed SMS messages are not lost on server restart
 */
const addSmsToDeadLetterQueue = async (
  phoneNumber: string,
  message: string,
  error: string,
  attempts: number,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    // Persist to MongoDB for durability
    await SmsDLQ.create({
      phoneNumber,
      message,
      error,
      attempts,
      lastAttempt: new Date(),
      createdAt: new Date(),
      metadata,
    });

    logger.warn('[SmsDeadLetterQueue] SMS message persisted to MongoDB DLQ', {
      phoneNumber: maskPhoneNumber(phoneNumber),
      error,
      attempts,
    });
  } catch (dbError) {
    // If MongoDB fails, log but don't throw - we don't want to mask the original error
    logger.error('[SmsDeadLetterQueue] Failed to persist to MongoDB DLQ', {
      phoneNumber: maskPhoneNumber(phoneNumber),
      dbError: dbError instanceof Error ? dbError.message : String(dbError),
    });
  }

  // Also add to the general retry.util DLQ for monitoring
  addToDeadLetterQueue('smsService.send', new Error(error), attempts, {
    phoneNumber,
    messageLength: message.length,
    ...metadata,
  });
};

// ============================================
// SMS Service Class
// ============================================

export class SmsService {
  // ========================================
  // Core SMS Sending
  // ========================================

  /**
   * Send an SMS message with retry logic
   */
  async send(phoneNumber: string, message: string, metadata?: Record<string, any>): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    if (!twilioConfig) {
      logger.debug('Twilio not configured - skipping SMS', {
        context: 'SmsService',
        action: 'TWILIO_NOT_CONFIGURED',
        phoneNumber: maskPhoneNumber(phoneNumber),
      });
      return { success: false, error: 'Twilio not configured' };
    }

    // Validate phone number format
    const cleanedPhone = this.cleanPhoneNumber(phoneNumber);
    if (!this.isValidPhoneNumber(cleanedPhone)) {
      logger.warn('Invalid phone number format', {
        context: 'SmsService',
        action: 'INVALID_PHONE',
        phoneNumber: maskPhoneNumber(phoneNumber),
      });
      return { success: false, error: 'Invalid phone number format' };
    }

    // Check if user has opted out of SMS
    const unsubscribed = await this.checkSmsOptOut(cleanedPhone);
    if (unsubscribed) {
      logger.debug('SMS skipped - user opted out', {
        context: 'SmsService',
        action: 'USER_OPTED_OUT',
        phoneNumber: maskPhoneNumber(phoneNumber),
      });
      return { success: false, error: 'User has opted out of SMS' };
    }

    const result = await withRetry(
      async () => {
        const twilioMessage = await twilioConfig.client.messages.create({
          body: message,
          from: twilioConfig.phoneNumber,
          to: cleanedPhone,
          // Enable delivery status callbacks
          statusCallback: `${process.env.API_BASE_URL || process.env.BASE_URL}/api/v1/webhooks/twilio/status`,
        });
        return twilioMessage.sid;
      },
      { ...retryConfigs.standard, maxAttempts: 3 }
    );

    if (!result.success) {
      logger.error('Failed to send SMS after retries', {
        context: 'SmsService',
        action: 'SMS_SEND_FAILED',
        phoneNumber: maskPhoneNumber(phoneNumber),
        attempts: result.attempts,
        error: result.error instanceof Error ? result.error.message : String(result.error),
      });

      // Add to MongoDB-backed DLQ for persistence
      await addSmsToDeadLetterQueue(
        phoneNumber,
        message,
        result.error instanceof Error ? result.error.message : String(result.error),
        result.attempts,
        metadata
      );

      return { success: false, error: result.error instanceof Error ? result.error.message : 'SMS send failed' };
    }

    logger.debug('SMS sent successfully', {
      context: 'SmsService',
      action: 'SMS_SUCCESS',
      phoneNumber: maskPhoneNumber(phoneNumber),
      messageSid: result.result,
    });

    return { success: true, messageSid: result.result };
  }

  /**
   * Send SMS and update notification record
   */
  async sendForNotification(
    notificationId: string,
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    const result = await this.send(phoneNumber, message, { notificationId });

    if (result.success && result.messageSid) {
      await this.updateNotificationSmsStatus(notificationId, {
        sent: true,
        sentAt: new Date(),
        messageId: result.messageSid,
        phoneNumber: this.cleanPhoneNumber(phoneNumber),
        deliveryStatus: 'pending',
      });
    } else {
      await this.updateNotificationSmsStatus(notificationId, {
        sent: false,
        errorMessage: result.error,
        deliveryStatus: 'failed',
      });
    }

    return result.success;
  }

  // ========================================
  // Booking SMS Templates
  // ========================================

  /**
   * Send booking-related SMS notification
   */
  async sendBookingSms(
    phoneNumber: string,
    bookingNumber: string,
    eventType: 'confirmed' | 'reminder' | 'cancelled' | 'completed' | 'started'
  ): Promise<boolean> {
    const messages: Record<string, string> = {
      confirmed: `Your booking ${bookingNumber} has been confirmed! View details in the app. Reply STOP to unsubscribe.`,
      reminder: `Reminder: Your booking ${bookingNumber} is coming up soon. See you there! Reply STOP to unsubscribe.`,
      cancelled: `Your booking ${bookingNumber} has been cancelled. Check the app for more details. Reply STOP to unsubscribe.`,
      completed: `Your booking ${bookingNumber} has been completed. Thank you for using our service! Reply STOP to unsubscribe.`,
      started: `Your booking ${bookingNumber} has started. Your service provider is on the way! Reply STOP to unsubscribe.`,
    };

    return (await this.send(phoneNumber, messages[eventType] || messages.confirmed)).success;
  }

  /**
   * Send OTP via SMS for phone verification
   */
  async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const message = `Your NILIN verification code is: ${otp}. This code expires in 10 minutes. Do not share this code with anyone.`;
    return (await this.send(phoneNumber, message)).success;
  }

  // ========================================
  // Delivery Receipt Handling
  // ========================================

  /**
   * Process Twilio delivery status callback
   */
  async handleDeliveryReceipt(receipt: SmsDeliveryReceipt): Promise<void> {
    logger.debug('Processing SMS delivery receipt', {
      context: 'SmsService',
      action: 'DELIVERY_RECEIPT',
      messageSid: receipt.messageSid,
      status: receipt.messageStatus,
    });

    // Find notification by message SID
    const notification = await BookingNotification.findOne({
      'channels.sms.messageId': receipt.messageSid,
    });

    if (!notification) {
      logger.warn('Notification not found for message SID', {
        context: 'SmsService',
        action: 'NOTIFICATION_NOT_FOUND',
        messageSid: receipt.messageSid,
      });
      return;
    }

    // Update delivery status based on Twilio status
    const deliveryStatus = this.mapTwilioStatus(receipt.messageStatus);

    await BookingNotification.findByIdAndUpdate(notification._id, {
      'channels.sms.deliveryStatus': deliveryStatus,
      ...(receipt.errorCode && { 'channels.sms.errorMessage': `${receipt.errorCode}: ${receipt.errorMessage || 'Unknown error'}` }),
    });

    // If delivered, update overall status
    if (deliveryStatus === 'delivered') {
      await BookingNotification.findByIdAndUpdate(notification._id, {
        status: 'delivered',
        deliveredAt: receipt.timestamp,
      });

      logger.info('SMS delivered successfully', {
        context: 'SmsService',
        action: 'SMS_DELIVERED',
        notificationId: notification._id.toString(),
        messageSid: receipt.messageSid,
      });
    } else if (deliveryStatus === 'failed' || deliveryStatus === 'undelivered') {
      // Schedule retry if eligible
      const canRetry = notification.canBeRetried();
      if (canRetry) {
        await notification.scheduleRetry();
        logger.info('SMS delivery failed, scheduled for retry', {
          context: 'SmsService',
          action: 'SMS_RETRY_SCHEDULED',
          notificationId: notification._id.toString(),
          nextRetryAt: notification.nextRetryAt,
        });
      } else {
        await BookingNotification.findByIdAndUpdate(notification._id, {
          status: 'failed',
          failureReason: `SMS delivery failed: ${receipt.errorMessage || receipt.errorCode || 'Unknown error'}`,
        });
      }
    }
  }

  /**
   * Map Twilio status to internal delivery status
   */
  private mapTwilioStatus(twilioStatus: SmsDeliveryStatus): 'pending' | 'delivered' | 'failed' | 'undelivered' {
    const statusMap: Record<SmsDeliveryStatus, 'pending' | 'delivered' | 'failed' | 'undelivered'> = {
      queued: 'pending',
      sent: 'pending',
      delivered: 'delivered',
      failed: 'failed',
      undelivered: 'undelivered',
    };
    return statusMap[twilioStatus] || 'pending';
  }

  // ========================================
  // STOP/Unsubscribe Handling
  // ========================================

  /**
   * Process incoming SMS (for keywords like STOP, START)
   */
  async handleIncomingMessage(
    from: string,
    body: string,
    messageSid: string
  ): Promise<{ processed: boolean; action?: string }> {
    const normalizedBody = body.trim().toUpperCase();
    const cleanedPhone = this.cleanPhoneNumber(from);

    logger.debug('Processing incoming SMS', {
      context: 'SmsService',
      action: 'INCOMING_SMS',
      from: maskPhoneNumber(cleanedPhone),
      body: normalizedBody,
    });

    // Handle STOP keyword
    if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END'].includes(normalizedBody)) {
      await this.optOutUser(cleanedPhone);
      return { processed: true, action: 'unsubscribed' };
    }

    // Handle START keyword (re-subscribe)
    if (['START', 'YES', 'UNSTOP'].includes(normalizedBody)) {
      await this.optInUser(cleanedPhone);
      return { processed: true, action: 'subscribed' };
    }

    // Handle HELP
    if (['HELP', 'INFO'].includes(normalizedBody)) {
      // Could send help message here
      return { processed: true, action: 'help_requested' };
    }

    return { processed: false };
  }

  /**
   * Opt out user from SMS marketing
   */
  async optOutUser(phoneNumber: string): Promise<void> {
    const cleanedPhone = this.cleanPhoneNumber(phoneNumber);

    const user = await User.findOne({ phone: cleanedPhone });
    if (!user) {
      logger.debug('User not found for SMS opt-out', {
        context: 'SmsService',
        action: 'OPT_OUT_USER_NOT_FOUND',
        phoneNumber: maskPhoneNumber(cleanedPhone),
      });
      return;
    }

    // Disable all SMS preferences
    user.communicationPreferences = user.communicationPreferences || {};
    user.communicationPreferences.sms = {
      bookingUpdates: false,
      reminders: false,
      promotions: false,
    };

    await user.save();

    logger.info('User opted out of SMS', {
      context: 'SmsService',
      action: 'SMS_OPT_OUT',
      userId: user._id.toString(),
      phoneNumber: maskPhoneNumber(cleanedPhone),
    });
  }

  /**
   * Opt in user to SMS marketing
   */
  async optInUser(phoneNumber: string): Promise<void> {
    const cleanedPhone = this.cleanPhoneNumber(phoneNumber);

    const user = await User.findOne({ phone: cleanedPhone });
    if (!user) {
      logger.debug('User not found for SMS opt-in', {
        context: 'SmsService',
        action: 'OPT_IN_USER_NOT_FOUND',
        phoneNumber: maskPhoneNumber(cleanedPhone),
      });
      return;
    }

    // Re-enable default SMS preferences
    user.communicationPreferences = user.communicationPreferences || {};
    user.communicationPreferences.sms = {
      bookingUpdates: true,
      reminders: true,
      promotions: false,
    };

    await user.save();

    logger.info('User opted in to SMS', {
      context: 'SmsService',
      action: 'SMS_OPT_IN',
      userId: user._id.toString(),
      phoneNumber: maskPhoneNumber(cleanedPhone),
    });
  }

  /**
   * Check if user has opted out of SMS
   */
  private async checkSmsOptOut(phoneNumber: string): Promise<boolean> {
    const cleanedPhone = this.cleanPhoneNumber(phoneNumber);

    const user = await User.findOne({ phone: cleanedPhone }).select('communicationPreferences');
    if (!user) {
      // If no user found, allow SMS (user may not be registered)
      return false;
    }

    const prefs = user.communicationPreferences?.sms;
    // Return true (opted out) if ANY marketing preference is disabled
    return prefs?.bookingUpdates === false || prefs?.promotions === false;
  }

  // ========================================
  // Dead Letter Queue Management (MongoDB-backed)
  // ========================================

  /**
   * Get SMS dead letter queue entries from MongoDB
   */
  async getDeadLetterQueue(limit: number = 100): Promise<any[]> {
    try {
      const entries = await SmsDLQ.find({ resolvedAt: null })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return entries;
    } catch (error) {
      logger.error('Failed to get SMS DLQ entries', {
        context: 'SmsService',
        action: 'DLQ_GET_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get DLQ statistics from MongoDB
   */
  async getDlqStats(): Promise<{
    totalEntries: number;
    recentEntries: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [totalEntries, recentEntries, oldest, newest] = await Promise.all([
        SmsDLQ.countDocuments({ resolvedAt: null }),
        SmsDLQ.countDocuments({ resolvedAt: null, createdAt: { $gt: oneHourAgo } }),
        SmsDLQ.findOne({ resolvedAt: null }).sort({ createdAt: 1 }).select('createdAt').lean(),
        SmsDLQ.findOne({ resolvedAt: null }).sort({ createdAt: -1 }).select('createdAt').lean(),
      ]);

      return {
        totalEntries,
        recentEntries,
        oldestEntry: oldest?.createdAt || null,
        newestEntry: newest?.createdAt || null,
      };
    } catch (error) {
      logger.error('Failed to get DLQ stats', {
        context: 'SmsService',
        action: 'DLQ_STATS_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalEntries: 0,
        recentEntries: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Retry failed SMS from DLQ
   */
  async retryFromDlq(entryId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const entry = await SmsDLQ.findById(entryId);
      if (!entry) {
        return { success: false, error: 'Entry not found in DLQ' };
      }

      const result = await this.send(entry.phoneNumber, entry.message, entry.metadata || undefined);

      if (result.success) {
        // Mark as resolved on success
        await SmsDLQ.findByIdAndUpdate(entryId, {
          resolvedAt: new Date(),
          resolution: 'automatic',
        });

        logger.info('SMS retried successfully from DLQ', {
          context: 'SmsService',
          action: 'DLQ_RETRY_SUCCESS',
          entryId,
          messageSid: result.messageSid,
        });

        return { success: true };
      }

      return { success: false, error: result.error };
    } catch (error) {
      logger.error('Failed to retry SMS from DLQ', {
        context: 'SmsService',
        action: 'DLQ_RETRY_ERROR',
        entryId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: 'Failed to retry SMS' };
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Clean phone number by removing non-digit characters
   */
  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  /**
   * Validate phone number format (basic E.164 validation)
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Basic validation: starts with + and has 10-15 digits
    const e164Pattern = /^\+?[1-9]\d{9,14}$/;
    return e164Pattern.test(phone);
  }

  /**
   * Update notification SMS channel status
   */
  private async updateNotificationSmsStatus(
    notificationId: string,
    updates: Partial<{
      sent: boolean;
      sentAt: Date;
      messageId: string;
      phoneNumber: string;
      errorMessage: string;
      deliveryStatus: 'pending' | 'delivered' | 'failed' | 'undelivered';
    }>
  ): Promise<void> {
    try {
      await BookingNotification.findByIdAndUpdate(notificationId, {
        $set: {
          'channels.sms': {
            ...updates,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update notification SMS status', {
        context: 'SmsService',
        action: 'UPDATE_NOTIFICATION_FAILED',
        notificationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const smsService = new SmsService();

// Export types for use in webhook handlers
export type { TwilioConfig };
export { SmsDLQ } from '../models/smsDlq.model';
