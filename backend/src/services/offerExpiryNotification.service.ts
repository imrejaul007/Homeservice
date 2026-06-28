import Coupon from '../models/coupon.model';
import { OfferClaim } from '../models/offerClaim.model';
import User from '../models/user.model';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import { sendEmail } from './email.service';
import { notificationService } from './notification.service';
import {
  renderOfferExpiryReminderEmail,
  renderOfferExpiredEmail,
  renderOfferReminderUnusedEmail,
  renderAdminOfferExpiryAlertEmail,
  OfferExpiryTemplateData
} from '../templates/notifications/offerExpiry';
import {
  offerExpiryReminderPush,
  offerUnusedReminderPush,
  offerExpiredPush,
  adminOfferExpiryAlertPush,
  getActivePushTokens,
  hasActivePushTokens
} from '../templates/notifications/offerExpiryPush';

// FIX: Notification types for offer expiry
export type OfferNotificationType =
  | 'offer_expiry_reminder'
  | 'offer_expired'
  | 'offer_unused_reminder'
  | 'offer_claimed';

interface OfferNotificationData {
  userId: string;
  type: OfferNotificationType;
  title: string;
  message: string;
  offerCode: string;
  couponId: string;
  expiresAt?: Date;
  discountAmount?: number;
}

/**
 * Offer Expiry Notification Service
 * Handles notifications for offers expiring soon and expired claims
 * Supports both email and push notification channels
 */
export class OfferExpiryNotificationService {
  /**
   * Send notifications for offers expiring in 1-3 days
   * Run this daily via scheduled job
   */
  async notifyExpiringOffers(): Promise<void> {
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      // Find offers expiring in 1-3 days
      const expiringOffers = await Coupon.find({
        isActive: true,
        validUntil: {
          $gte: tomorrow,
          $lte: threeDaysFromNow
        }
      }).lean();

      logger.info('Checking for expiring offers', { count: expiringOffers.length });

      // Track admin alerts
      const adminAlerts: Array<{
        offersCount: number;
        totalRemainingUses: number;
        offersSummary: string[];
      }> = [];

      for (const offer of expiringOffers) {
        // Find all users with active claims for this offer
        const claims = await OfferClaim.find({
          offerId: offer._id,
          status: 'claimed',
          expiresAt: { $gt: new Date() }
        }).populate('userId', 'email firstName communicationPreferences deviceTokens').lean();

        for (const claim of claims) {
          const user = claim.userId as any;
          if (!user?._id) continue;

          const discountText = offer.type === 'percentage'
            ? `${offer.value}% off`
            : `AED ${offer.value} off`;

          const daysUntilExpiry = Math.ceil(
            (new Date(claim.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          logger.info('Sending expiry notification', {
            userId: user._id?.toString(),
            offerId: offer._id.toString(),
            couponCode: claim.couponCode,
            daysUntilExpiry
          });

          // Send email if opted in
          const wantsEmail = user.communicationPreferences?.email?.promotions !== false;
          if (wantsEmail && user.email) {
            await this.sendExpiryEmail({
              to: user.email,
              firstName: user.firstName,
              offerCode: claim.couponCode,
              offerTitle: offer.displayTitle || offer.title,
              discountText,
              expiresAt: claim.expiresAt,
              daysUntilExpiry
            });
          }

          // Send push notification if opted in and has device tokens
          const wantsPush = user.communicationPreferences?.push?.promotions !== false;
          const activeTokens = getActivePushTokens(user.deviceTokens);

          if (wantsPush && activeTokens.length > 0) {
            await this.sendExpiryPushNotification({
              userId: user._id.toString(),
              firstName: user.firstName,
              offerCode: claim.couponCode,
              offerTitle: offer.displayTitle || offer.title,
              discountText,
              daysRemaining: daysUntilExpiry,
              deviceTokens: activeTokens
            });
          }

          // FIX: Send in-app notification if opted in
          const wantsInApp = user.communicationPreferences?.inApp?.promotions !== false;
          if (wantsInApp) {
            await this.sendInAppNotification({
              userId: user._id.toString(),
              type: 'offer_expiry_reminder',
              title: 'Your offer expires soon! ⏰',
              message: `Use code ${claim.couponCode} for ${discountText} - expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`,
              offerCode: claim.couponCode,
              couponId: offer._id.toString(),
              expiresAt: claim.expiresAt,
              discountAmount: offer.value,
            });
          }
        }

        // Track for admin alert if high-value offer
        const remainingUses = offer.maxUses ? (offer.maxUses - (offer.currentUses || 0)) : 0;
        if (remainingUses > 10 && offer.value && (offer.value >= 20 || offer.type === 'percentage')) {
          adminAlerts.push({
            offersCount: 1,
            totalRemainingUses: remainingUses,
            offersSummary: [`${offer.code}: ${offer.displayTitle || offer.title} - ${remainingUses} uses remaining`]
          });
        }
      }

      // Send admin alert for all high-value expiring offers
      if (adminAlerts.length > 0) {
        const totalOffers = adminAlerts.reduce((sum, a) => sum + a.offersCount, 0);
        const totalUses = adminAlerts.reduce((sum, a) => sum + a.totalRemainingUses, 0);
        const allSummary = adminAlerts.flatMap(a => a.offersSummary);

        await this.sendAdminOfferExpiryAlert({
          offersCount: totalOffers,
          totalRemainingUses: totalUses,
          offersSummary: allSummary
        });
      }

      logger.info('Completed expiry notification job');
    } catch (error) {
      logger.error('Failed to send expiry notifications', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send notification when a claimed offer expires
   */
  async notifyClaimExpired(userId: string, couponCode: string): Promise<void> {
    try {
      const user = await User.findById(userId)
        .select('email firstName communicationPreferences deviceTokens')
        .lean();

      if (!user?._id) return;

      // Send email if opted in
      const wantsEmail = user.communicationPreferences?.email?.promotions !== false;
      if (wantsEmail && user.email) {
        logger.info('Sending expired claim notification', {
          userId,
          couponCode
        });

        await this.sendExpiredEmail({
          to: user.email,
          firstName: user.firstName,
          offerCode: couponCode
        });
      }

      // Send push notification if opted in and has device tokens
      const wantsPush = user.communicationPreferences?.push?.promotions !== false;
      const activeTokens = getActivePushTokens(user.deviceTokens as any);

      if (wantsPush && activeTokens.length > 0) {
        await this.sendExpiredPushNotification({
          userId: user._id.toString(),
          firstName: user.firstName,
          offerCode: couponCode,
          deviceTokens: activeTokens
        });
      }
    } catch (error) {
      logger.error('Failed to send expired claim notification', {
        userId,
        couponCode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send unused claim reminder (after 7 days of claiming)
   * Run this weekly via scheduled job
   */
  async notifyUnusedClaims(): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find claims that are still active after 7 days
      const unusedClaims = await OfferClaim.find({
        status: 'claimed',
        createdAt: { $lte: sevenDaysAgo },
        expiresAt: { $gt: new Date() }
      }).populate('userId', 'email firstName communicationPreferences deviceTokens').lean();

      logger.info('Checking for unused claims', { count: unusedClaims.length });

      for (const claim of unusedClaims) {
        const user = claim.userId as any;
        if (!user?._id) continue;

        const daysUntilExpiry = Math.ceil(
          (new Date(claim.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        // Only send if more than 3 days remaining
        if (daysUntilExpiry <= 3) continue;

        // Check if we already sent a reminder recently
        const lastReminder = (claim as any).lastReminderSentAt;
        if (lastReminder) {
          const daysSinceReminder = Math.floor(
            (Date.now() - new Date(lastReminder).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceReminder < 3) continue; // Only remind every 3 days
        }

        logger.info('Sending unused claim reminder', {
          userId: user._id?.toString(),
          couponCode: claim.couponCode,
          daysUntilExpiry
        });

        // Send email if opted in
        const wantsEmail = user.communicationPreferences?.email?.promotions !== false;
        if (wantsEmail && user.email) {
          await this.sendUnusedReminderEmail({
            to: user.email,
            firstName: user.firstName,
            offerCode: claim.couponCode,
            offerTitle: (claim as any).offerTitle || 'your offer',
            daysUntilExpiry
          });
        }

        // Send push notification if opted in and has device tokens
        const wantsPush = user.communicationPreferences?.push?.promotions !== false;
        const activeTokens = getActivePushTokens(user.deviceTokens as any);

        if (wantsPush && activeTokens.length > 0) {
          await this.sendUnusedPushNotification({
            userId: user._id.toString(),
            firstName: user.firstName,
            offerCode: claim.couponCode,
            offerTitle: (claim as any).offerTitle,
            daysUntilExpiry,
            deviceTokens: activeTokens
          });
        }

        // Update last reminder timestamp
        await OfferClaim.findByIdAndUpdate(claim._id, {
          lastReminderSentAt: new Date()
        });
      }

      logger.info('Completed unused claims notification job');
    } catch (error) {
      logger.error('Failed to send unused claims notifications', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Mark expired claims and send notifications
   * Run this daily to clean up expired claims
   */
  async processExpiredClaims(): Promise<void> {
    try {
      // Find claims that have expired but are still marked as 'claimed'
      const expiredClaims = await OfferClaim.find({
        status: 'claimed',
        expiresAt: { $lt: new Date() }
      }).populate('userId', 'email firstName communicationPreferences deviceTokens').lean();

      logger.info('Processing expired claims', { count: expiredClaims.length });

      if (expiredClaims.length === 0) {
        return;
      }

      const expiredClaimIds = expiredClaims.map(claim => claim._id);

      // Bulk update expired claims
      await OfferClaim.updateMany(
        { _id: { $in: expiredClaimIds }, status: 'claimed' },
        { $set: { status: 'expired' } }
      );

      // Send notifications for each expired claim
      for (const claim of expiredClaims) {
        const user = claim.userId as any;
        if (user?._id) {
          await this.notifyClaimExpired(user._id.toString(), claim.couponCode);
        }
      }

      logger.info('Completed expired claims processing');
    } catch (error) {
      logger.error('Failed to process expired claims', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ========================================
  // Email Sending Methods
  // ========================================

  /**
   * Send expiry warning email
   */
  private async sendExpiryEmail(params: {
    to: string;
    firstName: string;
    offerCode: string;
    offerTitle: string;
    discountText: string;
    expiresAt: Date;
    daysUntilExpiry: number;
  }): Promise<void> {
    try {
      const emailContent = renderOfferExpiryReminderEmail({
        firstName: params.firstName,
        offerCode: params.offerCode,
        offerTitle: params.offerTitle,
        discountText: params.discountText,
        expiresAt: params.expiresAt,
        daysRemaining: params.daysUntilExpiry,
        ctaUrl: 'https://nilin.app/book'
      });

      await notificationService.sendEmail({
        to: params.to,
        subject: emailContent.subject,
        template: emailContent.html,
        data: { title: emailContent.subject, message: emailContent.text }
      });

      logger.info('Expiry reminder email sent', {
        to: params.to,
        offerCode: params.offerCode
      });
    } catch (error) {
      logger.error('Failed to send expiry reminder email', {
        to: params.to,
        offerCode: params.offerCode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send expired offer email
   */
  private async sendExpiredEmail(params: {
    to: string;
    firstName: string;
    offerCode: string;
  }): Promise<void> {
    try {
      const emailContent = renderOfferExpiredEmail({
        firstName: params.firstName,
        offerCode: params.offerCode,
        ctaUrl: 'https://nilin.app/offers'
      });

      await notificationService.sendEmail({
        to: params.to,
        subject: emailContent.subject,
        template: emailContent.html,
        data: { title: emailContent.subject, message: emailContent.text }
      });

      logger.info('Expired email sent', {
        to: params.to,
        offerCode: params.offerCode
      });
    } catch (error) {
      logger.error('Failed to send expired email', {
        to: params.to,
        offerCode: params.offerCode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send unused offer reminder email
   */
  private async sendUnusedReminderEmail(params: {
    to: string;
    firstName: string;
    offerCode: string;
    offerTitle: string;
    daysUntilExpiry: number;
  }): Promise<void> {
    try {
      const emailContent = renderOfferReminderUnusedEmail({
        firstName: params.firstName,
        offerCode: params.offerCode,
        offerTitle: params.offerTitle,
        daysUntilExpiry: params.daysUntilExpiry,
        ctaUrl: 'https://nilin.app/book'
      });

      await notificationService.sendEmail({
        to: params.to,
        subject: emailContent.subject,
        template: emailContent.html,
        data: { title: emailContent.subject, message: emailContent.text }
      });

      logger.info('Unused reminder email sent', {
        to: params.to,
        offerCode: params.offerCode
      });
    } catch (error) {
      logger.error('Failed to send unused reminder email', {
        to: params.to,
        offerCode: params.offerCode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send admin offer expiry alert email
   */
  private async sendAdminOfferExpiryAlertEmail(params: {
    offersCount: number;
    totalRemainingUses: number;
    offersSummary: string[];
  }): Promise<void> {
    try {
      const emailContent = renderAdminOfferExpiryAlertEmail({
        offerCode: 'ADMIN_ALERT',
        offers: params.offersSummary.map(s => ({
          code: s.split(':')[0],
          title: s.split(':')[1]?.trim() || 'N/A',
          remainingUses: 0,
          daysUntilExpiry: 3
        })),
        summary: {
          totalOffers: params.offersCount,
          totalRemainingUses: params.totalRemainingUses
        },
        ctaUrl: 'https://nilin.app/admin/offers'
      });

      // Find admin users
      const admins = await User.find({ role: 'admin', isActive: true }).select('email').lean();

      for (const admin of admins) {
        if (admin.email) {
          await notificationService.sendEmail({
            to: admin.email,
            subject: emailContent.subject,
            template: emailContent.html,
            data: { title: emailContent.subject, message: emailContent.text }
          });
        }
      }

      logger.info('Admin offer expiry alert email sent', {
        adminCount: admins.length,
        offersCount: params.offersCount
      });
    } catch (error) {
      logger.error('Failed to send admin alert email', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ========================================
  // Push Notification Methods
  // ========================================

  /**
   * Send expiry reminder push notification
   */
  private async sendExpiryPushNotification(params: {
    userId: string;
    firstName?: string;
    offerCode: string;
    offerTitle?: string;
    discountText?: string;
    daysRemaining: number;
    deviceTokens: string[];
  }): Promise<void> {
    try {
      const payload = offerExpiryReminderPush({
        firstName: params.firstName,
        offerCode: params.offerCode,
        offerTitle: params.offerTitle,
        discountText: params.discountText,
        daysRemaining: params.daysRemaining,
        ctaUrl: '/book'
      });

      // Send to all device tokens
      for (const token of params.deviceTokens) {
        const result = await notificationService.sendPushNotification(
          params.userId,
          payload.title,
          payload.body,
          payload.data
        );

        if (result) {
          logger.debug('Expiry reminder push sent', {
            userId: params.userId,
            offerCode: params.offerCode,
            tokenPrefix: token.substring(0, 8)
          });
        }
      }

      logger.info('Expiry reminder push notification processed', {
        userId: params.userId,
        offerCode: params.offerCode,
        tokensCount: params.deviceTokens.length
      });
    } catch (error) {
      logger.error('Failed to send expiry push notification', {
        userId: params.userId,
        offerCode: params.offerCode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * FIX: Send in-app notification for offer expiry
   * Uses the notification service to create an in-app notification
   */
  private async sendInAppNotification(data: OfferNotificationData): Promise<void> {
    try {
      await notificationService.createNotification({
        recipientId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: {
          offerCode: data.offerCode,
          couponId: data.couponId,
          expiresAt: data.expiresAt?.toISOString(),
          discountAmount: data.discountAmount,
        },
        channels: ['in_app'],
      });

      logger.debug('In-app notification sent for offer', {
        userId: data.userId,
        offerCode: data.offerCode,
        type: data.type,
      });
    } catch (error) {
      logger.error('Failed to send in-app notification', {
        userId: data.userId,
        offerCode: data.offerCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send expired offer push notification
   */
  private async sendExpiredPushNotification(params: {
    userId: string;
    firstName?: string;
    offerCode: string;
    offerTitle?: string;
    deviceTokens: string[];
  }): Promise<void> {
    try {
      const payload = offerExpiredPush({
        firstName: params.firstName,
        offerCode: params.offerCode,
        offerTitle: params.offerTitle,
        ctaUrl: '/offers'
      });

      // Send to all device tokens
      for (const token of params.deviceTokens) {
        await notificationService.sendPushNotification(
          params.userId,
          payload.title,
          payload.body,
          payload.data
        );
      }

      logger.info('Expired push notification processed', {
        userId: params.userId,
        offerCode: params.offerCode,
        tokensCount: params.deviceTokens.length
      });
    } catch (error) {
      logger.error('Failed to send expired push notification', {
        userId: params.userId,
        offerCode: params.offerCode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send unused offer reminder push notification
   */
  private async sendUnusedPushNotification(params: {
    userId: string;
    firstName?: string;
    offerCode: string;
    offerTitle?: string;
    daysUntilExpiry: number;
    deviceTokens: string[];
  }): Promise<void> {
    try {
      const payload = offerUnusedReminderPush({
        firstName: params.firstName,
        offerCode: params.offerCode,
        offerTitle: params.offerTitle,
        daysUntilExpiry: params.daysUntilExpiry,
        ctaUrl: '/book'
      });

      // Send to all device tokens
      for (const token of params.deviceTokens) {
        await notificationService.sendPushNotification(
          params.userId,
          payload.title,
          payload.body,
          payload.data
        );
      }

      logger.info('Unused reminder push notification processed', {
        userId: params.userId,
        offerCode: params.offerCode,
        tokensCount: params.deviceTokens.length
      });
    } catch (error) {
      logger.error('Failed to send unused push notification', {
        userId: params.userId,
        offerCode: params.offerCode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send admin offer expiry alert push notification
   */
  private async sendAdminOfferExpiryAlert(params: {
    offersCount: number;
    totalRemainingUses: number;
    offersSummary: string[];
  }): Promise<void> {
    try {
      // Find admin users with push tokens
      const admins = await User.find({
        role: 'admin',
        isActive: true,
        'deviceTokens.isActive': true
      }).select('email deviceTokens').lean();

      const payload = adminOfferExpiryAlertPush({
        offersCount: params.offersCount,
        totalRemainingUses: params.totalRemainingUses,
        offersSummary: params.offersSummary,
        ctaUrl: '/admin/offers'
      });

      for (const admin of admins) {
        const activeTokens = getActivePushTokens(admin.deviceTokens as any);

        for (const token of activeTokens) {
          await notificationService.sendPushNotification(
            admin._id.toString(),
            payload.title,
            payload.body,
            payload.data
          );
        }
      }

      logger.info('Admin offer expiry alert push sent', {
        adminCount: admins.length,
        offersCount: params.offersCount
      });

      // Also send email to admins
      await this.sendAdminOfferExpiryAlertEmail(params);
    } catch (error) {
      logger.error('Failed to send admin push alert', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const offerExpiryNotificationService = new OfferExpiryNotificationService();
export default offerExpiryNotificationService;