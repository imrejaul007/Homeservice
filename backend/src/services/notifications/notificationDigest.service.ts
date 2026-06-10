/**
 * Notification Digest Service
 * Handles bundling and scheduled sending of notifications
 *
 * Features:
 * - Bundle notifications
 * - Scheduled digest sending
 * - Preference-based grouping
 */

import mongoose from 'mongoose';
import BookingNotification from '../../models/bookingNotification.model';
import User from '../../models/user.model';
import DigestScheduleModel, { IDigestSchedule } from '../../models/digestSchedule.model';
import { notificationService } from '../notification.service';
import { whatsAppService } from './whatsapp.service';
import { telegramService } from './telegram.service';
import { webPushService } from './webpush.service';
import { smsService } from '../sms.service';
import emailService from '../email.service';
import logger from '../../utils/logger';
import { ApiError, ERROR_CODES } from '../../utils/ApiError';

// ============================================
// Types
// ============================================

export type DigestFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly';

export interface DigestPreferences {
  enabled: boolean;
  frequency: DigestFrequency;
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
    telegram: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;   // HH:mm format
    timezone: string;
  };
  types: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
    messages: boolean;
    system: boolean;
  };
  scheduledTime?: string; // For daily/weekly: HH:mm
  scheduledDays?: number[]; // For weekly: 0-6 (Sun-Sat)
}

export interface NotificationGroup {
  type: string;
  count: number;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: Date;
  }>;
}

export interface DigestContent {
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject: string;
  summary: string;
  groups: NotificationGroup[];
  totalCount: number;
  oldestNotification: Date;
  newestNotification: Date;
}

export interface DigestContactInfo {
  email?: string;
  phone?: string;
  whatsappOptedIn: boolean;
  pushSubscribed: boolean;
}

export interface DigestScheduleInfo {
  frequency: string;
  nextRun?: string;
  lastRun?: string;
}

export interface DigestPreferencesEnriched extends DigestPreferences {
  contactInfo: DigestContactInfo;
  schedule: DigestScheduleInfo;
}

// Re-export the type from the model for backward compatibility
export type { IDigestSchedule as DigestSchedule } from '../../models/digestSchedule.model';

// ============================================
// Constants
// ============================================

const DEFAULT_DIGEST_PREFERENCES: DigestPreferences = {
  enabled: true,
  frequency: 'daily',
  channels: {
    email: true,
    sms: false,
    push: true,
    whatsapp: false,
    telegram: false,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'Asia/Dubai',
  },
  types: {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    messages: true,
    system: true,
  },
  scheduledTime: '09:00',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get user's digest preferences
 */
async function getUserDigestPreferences(userId: string): Promise<DigestPreferences> {
  const user = await User.findById(userId).select('digestPreferences communicationPreferences');

  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }

  // Merge user preferences with defaults
  return {
    ...DEFAULT_DIGEST_PREFERENCES,
    ...(user.digestPreferences || {}),
    channels: {
      ...DEFAULT_DIGEST_PREFERENCES.channels,
      ...(user.digestPreferences?.channels || {}),
    },
    quietHours: {
      ...DEFAULT_DIGEST_PREFERENCES.quietHours,
      ...(user.digestPreferences?.quietHours || {}),
    },
    types: {
      ...DEFAULT_DIGEST_PREFERENCES.types,
      ...(user.digestPreferences?.types || {}),
    },
  };
}

/**
 * Check if current time is within quiet hours
 */
function isInQuietHours(quietHours: DigestPreferences['quietHours']): boolean {
  if (!quietHours.enabled) {
    return false;
  }

  const now = new Date();

  // Get current time in user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: quietHours.timezone,
  });

  const currentTime = formatter.format(now);
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);

  const [startHour, startMinute] = quietHours.startTime.split(':').map(Number);
  const [endHour, endMinute] = quietHours.endTime.split(':').map(Number);

  const currentTotal = currentHour * 60 + currentMinute;
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startTotal > endTotal) {
    return currentTotal >= startTotal || currentTotal < endTotal;
  }

  return currentTotal >= startTotal && currentTotal < endTotal;
}

/**
 * Filter notifications by type based on preferences
 */
function filterNotificationsByType(
  notifications: any[],
  types: DigestPreferences['types']
): any[] {
  return notifications.filter(notification => {
    const type = notification.type;

    if (types.bookingUpdates && [
      'booking_request',
      'booking_confirmed',
      'booking_cancelled',
      'booking_rejected',
      'booking_started',
      'booking_completed',
      'booking_updated',
      'schedule_changed',
    ].includes(type)) {
      return true;
    }

    if (types.reminders && type === 'booking_reminder') {
      return true;
    }

    if (types.promotions && [
      'promotion',
      'loyalty_update',
    ].includes(type)) {
      return true;
    }

    if (types.messages && type === 'message_received') {
      return true;
    }

    if (types.system && [
      'provider_approved',
      'provider_rejected',
      'provider_suspended',
      'provider_document_verified',
      'provider_document_rejected',
      'service_approved',
      'service_rejected',
      'dispute_received',
      'dispute_created',
      'dispute_resolved',
      'dispute_evidence_added',
      'dispute_assigned',
      'review_received',
      'review_request',
      'review_rejected',
      'payment_received',
      'withdrawal',
      'withdrawal_approved',
      'withdrawal_rejected',
    ].includes(type)) {
      return true;
    }

    return false;
  });
}

/**
 * Group notifications by type
 */
function groupNotifications(notifications: any[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();

  for (const notification of notifications) {
    const existing = groups.get(notification.type);

    if (existing) {
      existing.count++;
      existing.notifications.push({
        id: notification._id.toString(),
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
      });
    } else {
      groups.set(notification.type, {
        type: notification.type,
        count: 1,
        notifications: [{
          id: notification._id.toString(),
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt,
        }],
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Get current date/time parts in a specific timezone
 */
function getZonedParts(date: Date, timezone: string): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * Calculate next digest run time based on frequency (timezone-aware)
 */
function calculateNextRun(
  frequency: DigestFrequency,
  preferences: DigestPreferences,
  timezone: string = preferences.quietHours?.timezone || 'Asia/Dubai'
): Date {
  const now = new Date();

  switch (frequency) {
    case 'realtime':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);

    case 'hourly': {
      const zoned = getZonedParts(now, timezone);
      const next = new Date(now);
      const msUntilNextHour = ((60 - zoned.minute) % 60 || 60) * 60 * 1000;
      return new Date(next.getTime() + msUntilNextHour);
    }

    case 'daily': {
      const [scheduledHour, scheduledMinute] = (preferences.scheduledTime || '09:00').split(':').map(Number);
      const zoned = getZonedParts(now, timezone);
      const currentTotal = zoned.hour * 60 + zoned.minute;
      const scheduledTotal = scheduledHour * 60 + scheduledMinute;
      let daysToAdd = currentTotal >= scheduledTotal ? 1 : 0;
      const target = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      const targetZoned = getZonedParts(target, timezone);
      const offsetMs = ((scheduledHour - targetZoned.hour) * 60 + (scheduledMinute - targetZoned.minute)) * 60 * 1000;
      return new Date(target.getTime() + offsetMs);
    }

    case 'weekly': {
      const [wHour, wMinute] = (preferences.scheduledTime || '09:00').split(':').map(Number);
      const scheduledDays = (preferences.scheduledDays?.length ? preferences.scheduledDays : [1]).sort((a, b) => a - b);
      const zoned = getZonedParts(now, timezone);
      const currentTotal = zoned.hour * 60 + zoned.minute;
      const scheduledTotal = wHour * 60 + wMinute;

      for (let offset = 0; offset < 8; offset++) {
        const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
        const candidateZoned = getZonedParts(candidate, timezone);
        if (!scheduledDays.includes(candidateZoned.weekday)) continue;
        if (offset === 0 && currentTotal >= scheduledTotal) continue;
        const offsetMs = ((wHour - candidateZoned.hour) * 60 + (wMinute - candidateZoned.minute)) * 60 * 1000;
        return new Date(candidate.getTime() + offsetMs);
      }

      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    default:
      return now;
  }
}

/**
 * Sync digest type toggles into communicationPreferences for realtime alignment
 */
function syncCommunicationPreferences(
  user: InstanceType<typeof User>,
  types?: Partial<DigestPreferences['types']>
): void {
  if (!types) return;

  user.communicationPreferences = user.communicationPreferences || {} as any;

  if (types.bookingUpdates !== undefined) {
    user.communicationPreferences.email = {
      ...user.communicationPreferences.email,
      bookingUpdates: types.bookingUpdates,
    };
    user.communicationPreferences.sms = {
      ...user.communicationPreferences.sms,
      bookingUpdates: types.bookingUpdates,
    };
    user.communicationPreferences.push = {
      ...user.communicationPreferences.push,
      bookingUpdates: types.bookingUpdates,
    };
  }

  if (types.reminders !== undefined) {
    user.communicationPreferences.email = {
      ...user.communicationPreferences.email,
      reminders: types.reminders,
    };
    user.communicationPreferences.sms = {
      ...user.communicationPreferences.sms,
      reminders: types.reminders,
    };
    user.communicationPreferences.push = {
      ...user.communicationPreferences.push,
      reminders: types.reminders,
    };
  }

  if (types.messages !== undefined) {
    user.communicationPreferences.push = {
      ...user.communicationPreferences.push,
      newMessages: types.messages,
    };
    (user.communicationPreferences.sms as { newMessages?: boolean }).newMessages = types.messages;
  }

  if (types.promotions !== undefined) {
    user.communicationPreferences.email = {
      ...user.communicationPreferences.email,
      promotions: types.promotions,
    };
    user.communicationPreferences.sms = {
      ...user.communicationPreferences.sms,
      promotions: types.promotions,
    };
    user.communicationPreferences.push = {
      ...user.communicationPreferences.push,
      promotions: types.promotions,
    };
  }
}

/**
 * Format notification type for display
 */
function formatNotificationType(type: string): string {
  const typeLabels: Record<string, string> = {
    booking_request: 'Booking Requests',
    booking_confirmed: 'Confirmed Bookings',
    booking_cancelled: 'Cancelled Bookings',
    booking_rejected: 'Rejected Bookings',
    booking_started: 'Started Services',
    booking_completed: 'Completed Services',
    booking_reminder: 'Reminders',
    message_received: 'Messages',
    promotion: 'Promotions',
    loyalty_update: 'Loyalty Updates',
    provider_approved: 'Provider Approvals',
    provider_rejected: 'Provider Rejections',
    provider_suspended: 'Provider Suspensions',
    provider_document_verified: 'Verified Documents',
    provider_document_rejected: 'Rejected Documents',
    service_approved: 'Approved Services',
    service_rejected: 'Rejected Services',
    dispute_received: 'Dispute Notifications',
    dispute_created: 'New Disputes',
    dispute_resolved: 'Resolved Disputes',
  };

  return typeLabels[type] || type.split('_').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

// ============================================
// Notification Digest Service Class
// ============================================

export class NotificationDigestService {
  /**
   * Build contact info for digest UI
   */
  private async buildContactInfo(userId: string): Promise<DigestContactInfo> {
    const user = await User.findById(userId).select('email phone communicationPreferences.whatsapp pushSubscriptions');
    if (!user) {
      return { whatsappOptedIn: false, pushSubscribed: false };
    }

    const subscriptions = await webPushService.getUserSubscriptions(userId);

    return {
      email: user.email,
      phone: user.phone,
      whatsappOptedIn: user.communicationPreferences?.whatsapp?.enabled ?? false,
      pushSubscribed: subscriptions.length > 0,
    };
  }

  /**
   * Build schedule info for digest UI
   */
  private async buildScheduleInfo(userId: string): Promise<DigestScheduleInfo> {
    const schedule = await DigestScheduleModel.findByUserId(userId);
    return {
      frequency: schedule?.frequency || 'daily',
      nextRun: schedule?.nextRun?.toISOString(),
      lastRun: schedule?.lastRun?.toISOString(),
    };
  }

  /**
   * Initialize digest preferences and schedule for a new user
   */
  async initializeForUser(userId: string, timezone: string = 'Asia/Dubai'): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    if (!user.digestPreferences) {
      user.digestPreferences = {
        ...DEFAULT_DIGEST_PREFERENCES,
        quietHours: {
          ...DEFAULT_DIGEST_PREFERENCES.quietHours,
          timezone,
        },
      };
      await user.save();
    }

    const existing = await DigestScheduleModel.findByUserId(userId);
    if (!existing) {
      await this.updateDigestSchedule(userId);
    }
  }

  /**
   * Check if external delivery should be deferred to digest batch
   */
  async shouldDeferExternalDelivery(userId: string, notificationType: string): Promise<boolean> {
    const preferences = await getUserDigestPreferences(userId);
    if (!preferences.enabled || preferences.frequency === 'realtime') {
      return false;
    }

    const matches = filterNotificationsByType([{ type: notificationType }], preferences.types);
    return matches.length > 0;
  }

  /**
   * Get user's digest preferences with contact and schedule info
   */
  async getPreferences(userId: string): Promise<DigestPreferencesEnriched> {
    const [preferences, contactInfo, schedule] = await Promise.all([
      getUserDigestPreferences(userId),
      this.buildContactInfo(userId),
      this.buildScheduleInfo(userId),
    ]);

    return { ...preferences, contactInfo, schedule };
  }

  /**
   * Update user's digest preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<DigestPreferences>
  ): Promise<DigestPreferencesEnriched> {
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    const mergedChannels = {
      ...(user.digestPreferences?.channels ?? DEFAULT_DIGEST_PREFERENCES.channels),
      ...(updates.channels ?? {}),
    };

    if (mergedChannels.sms && !user.phone) {
      throw ApiError.badRequest(
        'A phone number is required for SMS digest notifications. Add your phone in Profile settings.',
        [],
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (mergedChannels.whatsapp) {
      if (!user.phone) {
        throw ApiError.badRequest(
          'A phone number is required for WhatsApp digest notifications. Add your phone in Profile settings.',
          [],
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      if (!user.communicationPreferences?.whatsapp?.enabled) {
        throw ApiError.badRequest(
          'WhatsApp notifications must be enabled before using the WhatsApp digest channel.',
          [],
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    if (mergedChannels.push) {
      const subscriptions = await webPushService.getUserSubscriptions(userId);
      if (subscriptions.length === 0) {
        throw ApiError.badRequest(
          'Push notifications require a browser subscription. Enable push notifications first.',
          [],
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    user.digestPreferences = {
      ...(user.digestPreferences ?? DEFAULT_DIGEST_PREFERENCES),
      ...updates,
      channels: mergedChannels,
    };

    if (updates.quietHours) {
      user.digestPreferences.quietHours = {
        ...(user.digestPreferences.quietHours ?? DEFAULT_DIGEST_PREFERENCES.quietHours),
        ...updates.quietHours,
      };
    }

    if (updates.types) {
      user.digestPreferences.types = {
        ...(user.digestPreferences.types ?? DEFAULT_DIGEST_PREFERENCES.types),
        ...updates.types,
      };
      syncCommunicationPreferences(user, updates.types);
    }

    await user.save();

    const scheduleFieldsChanged =
      updates.enabled !== undefined ||
      updates.frequency !== undefined ||
      updates.scheduledTime !== undefined ||
      updates.scheduledDays !== undefined ||
      updates.quietHours?.timezone !== undefined;

    if (scheduleFieldsChanged) {
      if (updates.enabled === false) {
        await this.cancelDigestSchedule(userId);
      } else {
        await this.updateDigestSchedule(userId);
      }
    }

    logger.info('Digest preferences updated', {
      context: 'NotificationDigestService',
      action: 'PREFERENCES_UPDATED',
      userId,
      updates: Object.keys(updates),
    });

    return this.getPreferences(userId);
  }

  /**
   * Get pending digest notifications for a user
   */
  async getPendingDigestNotifications(
    userId: string,
    options?: {
      since?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    const preferences = await this.getPreferences(userId);

    // Get notifications since last digest or last 24 hours
    const since = options?.since || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const limit = options?.limit || 50;

    // Fetch notifications that haven't been included in a digest
    const notifications = await BookingNotification.find({
      recipientId: userId,
      createdAt: { $gte: since },
      includedInDigest: { $ne: true },
      'channels.inApp.read': false, // Only unread
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Filter by type preferences
    const filteredNotifications = filterNotificationsByType(notifications, preferences.types);

    return filteredNotifications;
  }

  /**
   * Create digest content for a user
   */
  async createDigestContent(
    userId: string,
    notifications: any[]
  ): Promise<DigestContent | null> {
    if (notifications.length === 0) {
      return null;
    }

    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    const groups = groupNotifications(notifications);
    const totalCount = notifications.length;
    const oldestNotification = notifications[notifications.length - 1].createdAt;
    const newestNotification = notifications[0].createdAt;

    // Generate subject line
    let subject: string;
    if (totalCount === 1) {
      subject = `1 notification from NILIN`;
    } else {
      subject = `${totalCount} notifications from NILIN`;
    }

    // Generate summary
    const summaryParts = groups.slice(0, 3).map(group =>
      `${group.count} ${formatNotificationType(group.type)}`
    );
    const summary = summaryParts.join(', ');

    return {
      recipientId: userId,
      recipientEmail: user.email,
      recipientPhone: user.phone,
      subject,
      summary,
      groups,
      totalCount,
      oldestNotification,
      newestNotification,
    };
  }

  /**
   * Send digest to a user via preferred channels
   */
  async sendDigest(
    userId: string,
    digest: DigestContent,
    options?: {
      forceChannels?: Array<'email' | 'sms' | 'push' | 'whatsapp' | 'telegram'>;
    }
  ): Promise<{ sent: number; failed: number; channels: Record<string, boolean> }> {
    const preferences = await getUserDigestPreferences(userId);

    if (!preferences.enabled) {
      logger.debug('Digest disabled for user', {
        context: 'NotificationDigestService',
        action: 'DIGEST_DISABLED',
        userId,
      });
      return { sent: 0, failed: 0, channels: {} };
    }

    // Check quiet hours
    if (isInQuietHours(preferences.quietHours)) {
      logger.debug('Skipping digest - quiet hours', {
        context: 'NotificationDigestService',
        action: 'QUIET_HOURS',
        userId,
      });
      return { sent: 0, failed: 0, channels: {} };
    }

    const channels = options?.forceChannels || Object.entries(preferences.channels)
      .filter(([_, enabled]) => enabled)
      .map(([channel]) => channel as keyof typeof preferences.channels);

    const results: Record<string, boolean> = {};
    let sent = 0;
    let failed = 0;

    for (const channel of channels) {
      try {
        const result = await this.sendDigestViaChannel(channel, userId, digest);
        results[channel] = result;
        if (result) sent++;
        else failed++;
      } catch (error) {
        logger.error('Failed to send digest via channel', {
          context: 'NotificationDigestService',
          action: 'DIGEST_SEND_ERROR',
          userId,
          channel,
          error: (error as Error).message,
        });
        results[channel] = false;
        failed++;
      }
    }

    if (sent > 0) {
      const notificationIds = digest.groups.flatMap(g =>
        g.notifications.map(n => n.id)
      );
      await BookingNotification.updateMany(
        { _id: { $in: notificationIds } },
        { $set: { includedInDigest: true, lastDigestAt: new Date() } }
      );
    }

    return { sent, failed, channels: results };
  }

  /**
   * Send digest via specific channel
   */
  private async sendDigestViaChannel(
    channel: string,
    userId: string,
    digest: DigestContent
  ): Promise<boolean> {
    const user = await User.findById(userId).select('email phone communicationPreferences.whatsapp pushSubscriptions');
    if (!user) return false;

    switch (channel) {
      case 'email':
        if (!user.email) return false;
        return this.sendDigestEmail(digest);

      case 'sms':
        if (!user.phone) return false;
        return this.sendDigestSms(digest);

      case 'push': {
        const subscriptions = await webPushService.getUserSubscriptions(userId);
        if (subscriptions.length === 0) return false;
        return this.sendDigestPush(userId, digest);
      }

      case 'whatsapp':
        if (!user.phone || !user.communicationPreferences?.whatsapp?.enabled) return false;
        return this.sendDigestWhatsApp(digest);

      case 'telegram':
        return this.sendDigestTelegram(userId, digest);

      default:
        return false;
    }
  }

  /**
   * Send digest via email
   */
  private async sendDigestEmail(digest: DigestContent): Promise<boolean> {
    if (!digest.recipientEmail) {
      return false;
    }

    // Build HTML email content
    const htmlContent = this.buildDigestEmailHtml(digest);

    try {
      await emailService.sendEmail(
        digest.recipientEmail,
        digest.subject,
        htmlContent
      );
      return true;
    } catch (error) {
      logger.error('Failed to send digest email', {
        context: 'NotificationDigestService',
        action: 'EMAIL_DIGEST_ERROR',
        recipientId: digest.recipientId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Build HTML content for digest email
   */
  private buildDigestEmailHtml(digest: DigestContent): string {
    const groupsHtml = digest.groups.map(group => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <strong>${formatNotificationType(group.type)}</strong>
          <span style="color: #888; margin-left: 8px;">(${group.count})</span>
        </td>
      </tr>
      ${group.notifications.slice(0, 3).map(n => `
        <tr>
          <td style="padding: 8px 12px 12px 24px; color: #666; font-size: 14px;">
            ${this.escapeHtml(n.title)}
            <br/>
            <span style="color: #999;">${this.escapeHtml(n.message.substring(0, 100))}${n.message.length > 100 ? '...' : ''}</span>
          </td>
        </tr>
      `).join('')}
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(digest.subject)}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="background: linear-gradient(135deg, #E8B4A8 0%, #D4A5A5 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">NILIN Notifications</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">
            You have ${digest.totalCount} new notification${digest.totalCount > 1 ? 's' : ''}
          </p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px; padding: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            ${groupsHtml}
          </table>

          <div style="margin-top: 24px; text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://nilin.com'}/notifications"
               style="display: inline-block; background: #E8B4A8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
              View All in App
            </a>
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
            <p style="margin: 0;">
              You're receiving this because you enabled notification digests.<br/>
              <a href="${process.env.FRONTEND_URL || 'https://nilin.com'}/settings/notifications" style="color: #E8B4A8;">
                Manage preferences
              </a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Send digest via SMS
   */
  private async sendDigestSms(digest: DigestContent): Promise<boolean> {
    if (!digest.recipientPhone) {
      return false;
    }

    const message = `NILIN: You have ${digest.totalCount} new notification${digest.totalCount > 1 ? 's' : ''}. ${digest.summary}. Check the app for details.`;

    try {
      await smsService.send(digest.recipientPhone, message);
      return true;
    } catch (error) {
      logger.error('Failed to send digest SMS', {
        context: 'NotificationDigestService',
        action: 'SMS_DIGEST_ERROR',
        recipientId: digest.recipientId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Send digest via push notification
   */
  private async sendDigestPush(userId: string, digest: DigestContent): Promise<boolean> {
    try {
      const result = await webPushService.sendPushNotification(userId, {
        title: digest.subject,
        body: digest.summary,
        tag: 'notification-digest',
        requireInteraction: true,
        data: {
          type: 'digest',
          totalCount: digest.totalCount,
          groups: digest.groups.map(g => ({ type: g.type, count: g.count })),
        },
      });
      return result.success;
    } catch (error) {
      logger.error('Failed to send digest push', {
        context: 'NotificationDigestService',
        action: 'PUSH_DIGEST_ERROR',
        recipientId: userId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Send digest via WhatsApp
   */
  private async sendDigestWhatsApp(digest: DigestContent): Promise<boolean> {
    if (!digest.recipientPhone) {
      return false;
    }

    const message = `NILIN Notifications\n\n` +
      `You have ${digest.totalCount} new notification${digest.totalCount > 1 ? 's' : ''}:\n\n` +
      digest.groups.map(g => `• ${g.count}x ${formatNotificationType(g.type)}`).join('\n') +
      `\n\nCheck the app for details.`;

    try {
      const result = await whatsAppService.sendTextMessage(
        digest.recipientPhone,
        message,
        { userId: digest.recipientId }
      );
      return result.success;
    } catch (error) {
      logger.error('Failed to send digest WhatsApp', {
        context: 'NotificationDigestService',
        action: 'WHATSAPP_DIGEST_ERROR',
        recipientId: digest.recipientId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Send digest via Telegram
   */
  private async sendDigestTelegram(userId: string, digest: DigestContent): Promise<boolean> {
    const user = await User.findById(userId).select('telegramChatId');
    if (!user?.telegramChatId) {
      return false;
    }

    const groupsText = digest.groups.map(g =>
      `• ${g.count}x ${formatNotificationType(g.type)}`
    ).join('\n');

    try {
      const result = await telegramService.sendMessage(
        user.telegramChatId,
        `🔔 *NILIN Notifications*\n\n` +
        `You have ${digest.totalCount} new notification${digest.totalCount > 1 ? 's' : ''}:\n\n` +
        groupsText +
        `\n\n_Check the app for details._`,
        { parseMode: 'Markdown' }
      );
      return result.success;
    } catch (error) {
      logger.error('Failed to send digest Telegram', {
        context: 'NotificationDigestService',
        action: 'TELEGRAM_DIGEST_ERROR',
        recipientId: userId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // ========================================
  // Scheduled Digest Processing
  // ========================================

  /**
   * Update digest schedule for a user (persists to MongoDB)
   */
  async updateDigestSchedule(userId: string): Promise<IDigestSchedule> {
    const user = await User.findById(userId).select('communicationPreferences.timezone digestPreferences');
    const preferences = await getUserDigestPreferences(userId);
    const timezone = user?.communicationPreferences?.timezone
      || preferences.quietHours?.timezone
      || 'Asia/Dubai';
    const nextRun = calculateNextRun(preferences.frequency, preferences, timezone);

    const schedule = await DigestScheduleModel.upsertSchedule(userId, {
      frequency: preferences.frequency,
      nextRun,
      enabled: preferences.enabled,
    });

    logger.debug('Digest schedule updated', {
      context: 'NotificationDigestService',
      action: 'SCHEDULE_UPDATED',
      userId,
      frequency: preferences.frequency,
      nextRun: nextRun.toISOString(),
    });

    return schedule;
  }

  /**
   * Get digest schedule for a user
   */
  async getDigestSchedule(userId: string): Promise<IDigestSchedule | null> {
    return DigestScheduleModel.findByUserId(userId);
  }

  /**
   * Process due digests (for cron job)
   */
  async processDueDigests(batchSize: number = 100): Promise<{ processed: number; sent: number; failed: number }> {
    const now = new Date();

    // Get due schedules from MongoDB
    const dueSchedules = await DigestScheduleModel.findDueSchedules(batchSize);

    let processed = 0;
    let totalSent = 0;
    let totalFailed = 0;

    for (const schedule of dueSchedules) {
      try {
        const userId = schedule.userId.toString();
        const user = await User.findById(userId).select('communicationPreferences.timezone');
        const preferences = await getUserDigestPreferences(userId);
        const timezone = user?.communicationPreferences?.timezone
          || preferences.quietHours?.timezone
          || 'Asia/Dubai';

        if (!preferences.enabled || preferences.frequency === 'realtime') {
          await DigestScheduleModel.upsertSchedule(userId, {
            frequency: preferences.frequency,
            nextRun: calculateNextRun(preferences.frequency, preferences, timezone),
            lastRun: now,
            enabled: preferences.enabled,
          });
          processed++;
          continue;
        }

        const notifications = await this.getPendingDigestNotifications(userId);

        if (notifications.length === 0) {
          await DigestScheduleModel.upsertSchedule(userId, {
            frequency: preferences.frequency,
            nextRun: calculateNextRun(preferences.frequency, preferences, timezone),
            lastRun: now,
          });
          processed++;
          continue;
        }

        const digest = await this.createDigestContent(userId, notifications);
        if (digest) {
          const result = await this.sendDigest(userId, digest);

          await DigestScheduleModel.upsertSchedule(userId, {
            frequency: preferences.frequency,
            nextRun: calculateNextRun(preferences.frequency, preferences, timezone),
            lastRun: now,
          });

          totalSent += result.sent;
          totalFailed += result.failed;
        }

        processed++;
      } catch (error) {
        logger.error('Failed to process digest for user', {
          context: 'NotificationDigestService',
          action: 'PROCESS_DIGEST_ERROR',
          userId: schedule.userId.toString(),
          error: (error as Error).message,
        });
        totalFailed++;
        processed++;
      }
    }

    logger.info('Processed due digests', {
      context: 'NotificationDigestService',
      action: 'DIGESTS_PROCESSED',
      processed,
      sent: totalSent,
      failed: totalFailed,
    });

    return { processed, sent: totalSent, failed: totalFailed };
  }

  /**
   * Cancel digest schedule for a user
   */
  async cancelDigestSchedule(userId: string): Promise<void> {
    await DigestScheduleModel.upsertSchedule(userId, {
      enabled: false,
    });
  }

  /**
   * Get digest statistics
   */
  async getDigestStats(): Promise<{
    totalScheduled: number;
    enabledCount: number;
    realtimeCount: number;
    hourlyCount: number;
    dailyCount: number;
    weeklyCount: number;
    dueNow: number;
  }> {
    return DigestScheduleModel.getStats();
  }
}

// Export singleton instance
export const notificationDigestService = new NotificationDigestService();

