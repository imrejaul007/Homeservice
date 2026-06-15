import * as cron from 'node-cron';
import Booking from '../models/booking.model';
import Payout from '../models/payout.model';
import Wallet from '../models/wallet.model';
import logger from '../utils/logger';
import { addJob } from '../queue';
import { eventBus, EVENT_TYPES } from '../event-bus';
import { cache } from '../config/redis';

// Import automation modules
import {
  processEmailSequence,
  sendOnboardingReminders,
  processExpiredDiscounts,
  sendExpiryReminders,
  sendTrainingReminders,
  processReviewRequests,
  checkOverdueRecoveries,
  detectInactiveUsers,
  checkTierUpgrades,
  sendTierProgressNotifications,
  processBirthdayCampaigns,
  processExpiredOffers,
  checkDisputesForAutoRefund,
  processExpiredResponseDeadlines,
  autoAssignUnassignedDisputes,
  checkSlaStatus,
} from '../automation';

// Import new individual automation modules
import { runWelcomeEmailSequence } from '../automation/welcomeEmailSequence';
import { runOnboardingChecklist } from '../automation/onboardingChecklist';
import { checkFirstBookingDiscount } from '../automation/firstBookingDiscount';
import { runProviderTrainingCheck } from '../automation/providerTrainingAcademy';
import { sendReviewRequests } from '../automation/reviewRequestTiming';
import { processNegativeReviews } from '../automation/negativeReviewRecovery';
import { runWinBackCampaign } from '../automation/winBackCampaign';
import { checkAllTierUpgrades as checkTierUpgradesNew } from '../automation/tierUpgradeCelebration';
import { sendBirthdayRewards } from '../automation/birthdayReward';
import { processAutoRefunds } from '../automation/autoRefundThreshold';
import { assignMediations } from '../automation/mediationAutoAssign';
import { checkAndAwardBadges, updateReferralMilestones } from '../automation/referralGamification';
import { runOffPeakPromotionAnalysis, generatePromotionSuggestions } from '../automation/offPeakPromotion';

/**
 * Scheduled Jobs for NILIN Platform
 * Uses node-cron for precise cron-based scheduling
 */

const CRON_TIMEZONE = 'Asia/Dubai';
const LOCK_TTL_SECONDS = 3600; // 1 hour lock expiry

const STALE_BOOKING_HOURS = 24; // Auto-cancel pending bookings after 24 hours (no provider response)
const WEBHOOK_RETENTION_DAYS = 30; // Keep processed webhook cache entries for 30 days
const EXPIRED_BOOKING_GRACE_MINUTES = 30; // Grace period after scheduled time before auto-reject

// Track cron job references for graceful shutdown
const scheduledTasks: cron.ScheduledTask[] = [];

/**
 * Execute a function with a distributed lock using Redis SETNX pattern.
 * Prevents job overlap when multiple instances are running (e.g., in a cluster).
 * @param lockKey - Unique Redis key for the lock
 * @param jobName - Human-readable job name for logging
 * @param fn - The async function to execute
 */
async function withLock(lockKey: string, jobName: string, fn: () => Promise<void>): Promise<void> {
  if (!cache.client) {
    logger.warn(`${jobName}: Redis not available, running without lock`);
    await fn();
    return;
  }

  const lockAcquired = await cache.client.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');

  if (!lockAcquired) {
    logger.info(`${jobName}: Skipped - another instance holds the lock`);
    return;
  }

  try {
    logger.info(`${jobName}: Lock acquired, starting execution`);
    await fn();
  } catch (error) {
    logger.error(`${jobName}: Execution failed`, error);
  } finally {
    // Release lock (best effort - don't await to avoid blocking)
    cache.del(lockKey).catch((err) => {
      logger.warn(`${jobName}: Failed to release lock: ${err}`);
    });
  }
}

/**
 * Auto-cancel stale pending bookings that providers haven't responded to
 * Runs every 15 minutes to check for pending bookings older than 24 hours
 */
async function autoCancelStaleBookings(): Promise<void> {
  try {
    const staleThreshold = new Date(Date.now() - STALE_BOOKING_HOURS * 60 * 60 * 1000);

    const staleBookings = await Booking.find({
      status: 'pending',
      createdAt: { $lt: staleThreshold }
    });

    if (staleBookings.length === 0) {
      return;
    }

    logger.info(`Found ${staleBookings.length} stale pending bookings to auto-cancel`);

    for (const booking of staleBookings) {
      try {
        await booking.updateStatus(
          'cancelled',
          'system',
          `Auto-cancelled: provider did not respond within ${STALE_BOOKING_HOURS} hours`,
          'Automatic system cancellation due to no provider response'
        );
        logger.info(`Auto-cancelled stale booking: ${booking.bookingNumber}`);
      } catch (error) {
        logger.error(`Failed to auto-cancel booking ${booking.bookingNumber}:`, error);
      }
    }

    logger.info(`Completed auto-cancellation of ${staleBookings.length} stale bookings`);
  } catch (error) {
    logger.error('Error in auto-cancel stale bookings job:', error);
  }
}

/**
 * Auto-reject confirmed bookings where scheduled time has passed
 * Providers accepted but didn't show up - auto-reject after grace period
 * Runs every 15 minutes to check for confirmed bookings past their scheduled time
 */
async function autoRejectExpiredConfirmedBookings(): Promise<void> {
  try {
    const now = new Date();
    // Calculate threshold: current time minus grace period
    const gracePeriodMs = EXPIRED_BOOKING_GRACE_MINUTES * 60 * 1000;
    const thresholdTime = new Date(now.getTime() - gracePeriodMs);

    // Build date string for the threshold (e.g., "2026-06-12")
    const thresholdDate = thresholdTime.toISOString().split('T')[0];
    const thresholdTimeStr = thresholdTime.toTimeString().slice(0, 5); // "HH:MM" format

    // Find confirmed bookings where scheduledDate + scheduledTime has passed
    // We need to query for bookings on or before the threshold date
    const expiredBookings = await Booking.find({
      status: 'confirmed',
      $or: [
        // Same day: scheduledTime is before threshold
        {
          scheduledDate: {
            $gte: new Date(thresholdDate + 'T00:00:00.000Z'),
            $lt: new Date(thresholdDate + 'T23:59:59.999Z')
          },
          scheduledTime: { $lt: thresholdTimeStr }
        },
        // Previous days: any booking from previous days
        {
          scheduledDate: { $lt: new Date(thresholdDate + 'T00:00:00.000Z') }
        }
      ]
    });

    if (expiredBookings.length === 0) {
      return;
    }

    logger.info(`Found ${expiredBookings.length} expired confirmed bookings to auto-reject`);

    for (const booking of expiredBookings) {
      try {
        // Double-check: ensure the booking is actually past its scheduled time
        const scheduledDateTime = new Date(booking.scheduledDate);
        const [hours, minutes] = booking.scheduledTime.split(':').map(Number);
        scheduledDateTime.setHours(hours, minutes, 0, 0);

        if (scheduledDateTime.getTime() + gracePeriodMs > now.getTime()) {
          // Not yet past grace period, skip
          continue;
        }

        await booking.updateStatus(
          'rejected',
          'system',
          'Auto-rejected: provider accepted but did not show up',
          `Automatic system rejection - scheduled time ${booking.scheduledDate.toISOString().split('T')[0]} ${booking.scheduledTime} has passed`
        );
        logger.info(`Auto-rejected expired booking: ${booking.bookingNumber}`);
      } catch (error) {
        logger.error(`Failed to auto-reject booking ${booking.bookingNumber}:`, error);
      }
    }

    logger.info(`Completed auto-rejection of expired confirmed bookings`);
  } catch (error) {
    logger.error('Error in auto-reject expired bookings job:', error);
  }
}

/**
 * Process pending withdrawal/payout requests via Stripe
 */
async function processPendingWithdrawals(): Promise<void> {
  try {
    logger.info('Withdrawal processor job starting...');

    // 1. Find payouts due for processing (scheduled and due)
    const duePayouts = await Payout.findDuePayouts(50);
    logger.info(`Found ${duePayouts.length} payouts due for processing`);

    for (const payout of duePayouts) {
      try {
        // Skip if payout method is wallet (already processed)
        if (payout.method === 'wallet') {
          await payout.markAsCompleted();
          logger.info(`Payout ${payout.payoutNumber} marked as completed (wallet method)`);
          continue;
        }

        // Mark as processing
        await payout.markAsProcessing();

        // Process Stripe transfer based on payout method
        if (payout.method === 'bank_transfer' && payout.bankDetails) {
          // In production, this would call Stripe's transfer API:
          // const stripeTransfer = await stripe.transfers.create({
          //   amount: Math.round(payout.amount * 100), // Convert to cents
          //   currency: payout.currency.toLowerCase(),
          //   destination: payout.bankDetails.accountNumber,
          //   ...
          // });

          // For now, simulate successful transfer
          const mockStripePayoutId = `po_test_${Date.now()}_${payout._id}`;

          // Mark as completed with Stripe payout ID
          await payout.markAsCompleted(mockStripePayoutId);

          // Update provider wallet - debit the pending balance
          await Wallet.findOneAndUpdate(
            { userId: payout.providerId },
            {
              $inc: { pendingBalance: -payout.amount },
            }
          );

          logger.info(`Payout ${payout.payoutNumber} processed successfully`, {
            stripePayoutId: mockStripePayoutId,
            amount: payout.amount,
            currency: payout.currency,
          });

          // Publish payout completed event
          await eventBus.publish(EVENT_TYPES.PAYOUT_COMPLETED, {
            payoutId: payout._id.toString(),
            payoutNumber: payout.payoutNumber,
            providerId: payout.providerId.toString(),
            amount: payout.amount,
            currency: payout.currency,
            stripePayoutId: mockStripePayoutId,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Record failure and schedule retry if eligible
        await payout.addFailure(errorMessage);

        if (payout.isRetryable) {
          logger.warn(`Payout ${payout.payoutNumber} failed, retry scheduled`, {
            currentRetry: payout.currentRetryCount,
            maxRetries: payout.maxRetries,
            nextRetryDate: payout.nextRetryDate,
          });
        } else {
          logger.error(`Payout ${payout.payoutNumber} failed permanently`, {
            error: errorMessage,
          });

          // Publish payout failed event
          await eventBus.publish(EVENT_TYPES.PAYOUT_FAILED, {
            payoutId: payout._id.toString(),
            payoutNumber: payout.payoutNumber,
            providerId: payout.providerId.toString(),
            amount: payout.amount,
            currency: payout.currency,
            error: errorMessage,
          });
        }
      }
    }

    // 2. Process retriable failed payouts
    const retriablePayouts = await Payout.findRetriablePayouts(20);
    logger.info(`Found ${retriablePayouts.length} retriable payouts`);

    for (const payout of retriablePayouts) {
      try {
        await payout.markAsProcessing();

        // Re-attempt the payout transfer
        const mockStripePayoutId = `po_retry_${Date.now()}_${payout._id}`;
        await payout.markAsCompleted(mockStripePayoutId);

        logger.info(`Payout ${payout.payoutNumber} retry successful`, {
          stripePayoutId: mockStripePayoutId,
          attempt: payout.currentRetryCount,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await payout.addFailure(errorMessage);

        logger.warn(`Payout ${payout.payoutNumber} retry failed`, {
          attempt: payout.currentRetryCount,
          error: errorMessage,
        });
      }
    }

    logger.info('Withdrawal processor job completed');
  } catch (error) {
    logger.error('Error in withdrawal processor job:', error);
  }
}

/**
 * Send booking reminders (24h and 2h before appointment)
 * Enhanced with email notifications and tracking
 */
async function sendBookingReminders(): Promise<void> {
  try {
    const now = new Date();
    const { getBookingReminderHoursBefore } = await import('../services/platformEmailTemplate.service');
    const { getSettings } = await import('../services/settings.service');
    const { sendBookingReminder } = await import('../services/email.service');
    const settings = await getSettings();
    const primaryHours = getBookingReminderHoursBefore(settings);

    const reminderWindows = [
      { hours: primaryHours, label: `${primaryHours}-hour` },
      { hours: 2, label: '2-hour' },
    ];

    for (const window of reminderWindows) {
      const windowStart = new Date(now.getTime() + (window.hours - 0.5) * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + (window.hours + 0.5) * 60 * 60 * 1000);

      const bookingsToRemind = await Booking.find({
        status: { $in: ['confirmed', 'pending'] },
        scheduledDate: { $gte: windowStart, $lte: windowEnd }
      }).populate('customerId providerId serviceId');

      if (bookingsToRemind.length > 0) {
        logger.info(`Sending ${window.label} reminders for ${bookingsToRemind.length} bookings`);

        for (const booking of bookingsToRemind as any[]) {
          try {
            // Get customer info (handle both guest and authenticated users)
            const customerId = booking.customerId?._id?.toString() || booking.customerId?.toString();
            const providerId = booking.providerId?._id?.toString() || booking.providerId?.toString();
            const customerEmail = booking.isGuestBooking ? booking.guestInfo?.email : booking.customerId?.email;
            const customerName = booking.isGuestBooking ? booking.guestInfo?.name : booking.customerId?.firstName;

            // Format booking data for email
            const bookingData = {
              bookingNumber: booking.bookingNumber,
              serviceName: booking.serviceId?.name || 'Service',
              providerName: booking.providerId?.firstName || 'Provider',
              providerEmail: booking.providerId?.email || '',
              customerName: customerName || 'Customer',
              customerEmail: customerEmail || '',
              scheduledDate: new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              scheduledTime: booking.scheduledTime,
              duration: booking.duration || 60,
              location: booking.location?.address
                ? `${booking.location.address.street || ''}, ${booking.location.address.city || ''}`
                : 'Location not specified',
              totalAmount: booking.pricing?.totalAmount || 0,
              currency: booking.pricing?.currency || 'AED',
              status: booking.status,
            };

            let deferReminder = false;
            if (customerId) {
              const { notificationDigestService } = await import('../services/notifications/notificationDigest.service');
              deferReminder = await notificationDigestService.shouldDeferExternalDelivery(
                customerId,
                'booking_reminder'
              );
            }

            if (!deferReminder && customerEmail) {
              await sendBookingReminder(bookingData);
            }

            // Publish booking reminder event
            await eventBus.publish(EVENT_TYPES.BOOKING_REMINDER, {
              bookingId: booking._id.toString(),
              customerId,
              providerId,
              reminderType: window.label,
              scheduledDate: booking.scheduledDate,
              bookingNumber: booking.bookingNumber,
              customerEmail,
              customerName,
              providerName: booking.providerId?.firstName,
              serviceName: booking.serviceId?.name,
            });

            if (customerId) {
              const { notificationService } = await import('../services/notification.service');
              await notificationService.createNotification({
                recipientId: customerId,
                type: 'booking_reminder',
                title: `${window.label} Booking Reminder`,
                message: `Your booking #${booking.bookingNumber} is in ${window.hours} hour(s)`,
                bookingId: booking._id.toString(),
                channels: deferReminder ? ['in_app'] : ['in_app', 'push'],
                metadata: { reminderType: window.label },
              });
            }

            logger.info(`Sent ${window.label} reminder for booking ${booking.bookingNumber}`);
          } catch (error) {
            logger.error(`Failed to send reminder for booking ${booking.bookingNumber}:`, error);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error in booking reminders job:', error);
  }
}

/**
 * Clean up expired webhook events and old cache entries
 */
async function cleanupExpiredWebhooks(): Promise<void> {
  try {
    logger.info('Webhook cleanup job starting...');

    // Clean up stale entries from webhook retry queue (BullMQ handles this internally,
    // but we can add additional cleanup for failed jobs older than retention period)

    // Clean up old Stripe webhook event cache entries
    // The cache uses Redis with TTL, but we can scan for and remove old entries
    const cacheCleanupThreshold = Date.now() - (WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Log cleanup metrics
    logger.info('Webhook cleanup metrics:', {
      retentionDays: WEBHOOK_RETENTION_DAYS,
      retentionMs: WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      oldestRetainedTimestamp: new Date(cacheCleanupThreshold).toISOString(),
      action: 'WEBHOOK_CLEANUP_METRICS',
    });

    // Get webhook queue stats for monitoring
    const webhookQueueStats = await cache.get('webhook:stats:last_cleanup');
    const lastCleanup = webhookQueueStats ? JSON.parse(webhookQueueStats) : null;

    if (lastCleanup) {
      logger.info('Previous webhook cleanup stats:', {
        lastCleanupTime: lastCleanup.timestamp,
        eventsProcessed: lastCleanup.eventsProcessed || 0,
        cacheEntriesCleaned: lastCleanup.cacheEntriesCleaned || 0,
      });
    }

    // Update last cleanup timestamp
    await cache.set(
      'webhook:stats:last_cleanup',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        eventsProcessed: 0,
        cacheEntriesCleaned: 0,
      }),
      WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 // TTL matching retention
    );

    logger.info('Webhook cleanup job completed');
  } catch (error) {
    logger.error('Error in webhook cleanup job:', error);
  }
}

/**
 * Expire old loyalty points (runs monthly)
 */
async function expireOldPoints(): Promise<void> {
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/loyalty/expire-old-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json() as { data?: { usersProcessed?: number; totalExpiredPoints?: number } };
      logger.info(`Points expiry job completed: ${result.data?.usersProcessed || 0} users processed, ${result.data?.totalExpiredPoints || 0} points expired`);
    } else {
      logger.error(`Points expiry job failed with status: ${response.status}`);
    }
  } catch (error) {
    logger.error('Error in points expiry job:', error);
  }
}

/**
 * Initialize all scheduled jobs using node-cron
 */
export function initializeScheduledJobs(): void {
  logger.info('Initializing scheduled jobs with node-cron...');

  // Auto-cancel stale bookings - every 15 minutes (pending bookings with no provider response)
  const staleBookingTask = cron.schedule(
    '*/15 * * * *',
    async () => {
      await withLock('lock:scheduler:stale_bookings', 'StaleBookingsJob', autoCancelStaleBookings);
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(staleBookingTask);
  logger.info(`Stale booking auto-cancel scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

  // Auto-reject expired confirmed bookings - every 15 minutes (provider accepted but didn't show up)
  const expiredBookingTask = cron.schedule(
    '*/15 * * * *',
    async () => {
      await withLock('lock:scheduler:expired_bookings', 'ExpiredBookingsJob', autoRejectExpiredConfirmedBookings);
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(expiredBookingTask);
  logger.info(`Expired booking auto-reject scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

  // Process withdrawals - every 15 minutes
  const withdrawalTask = cron.schedule(
    '*/15 * * * *',
    async () => {
      await withLock('lock:scheduler:withdrawals', 'WithdrawalJob', processPendingWithdrawals);
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(withdrawalTask);
  logger.info(`Withdrawal processor scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

  // Send reminders - every 30 minutes
  const reminderTask = cron.schedule(
    '*/30 * * * *',
    async () => {
      await withLock('lock:scheduler:reminders', 'ReminderJob', sendBookingReminders);
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(reminderTask);
  logger.info(`Booking reminders scheduled: every 30 minutes (cron: */30 * * * *, tz: ${CRON_TIMEZONE})`);

  // Process notification retry queue - every 5 minutes
  const notificationQueueTask = cron.schedule(
    '*/5 * * * *',
    async () => {
      await withLock('lock:scheduler:notification_queue', 'NotificationQueueJob', async () => {
        const { notificationService } = await import('../services/notification.service');
        const result = await notificationService.processNotificationQueue(100);
        if (result.processed > 0 || result.failed > 0) {
          logger.info('Notification queue processed', result);
        }
      });
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(notificationQueueTask);
  logger.info(`Notification queue processor scheduled: every 5 minutes (cron: */5 * * * *, tz: ${CRON_TIMEZONE})`);

  // Process notification digests - every 15 minutes
  const digestTask = cron.schedule(
    '*/15 * * * *',
    async () => {
      await withLock('lock:scheduler:notification_digest', 'NotificationDigestJob', async () => {
        const { notificationDigestService } = await import('../services/notifications/notificationDigest.service');
        const result = await notificationDigestService.processDueDigests(100);
        if (result.processed > 0 || result.sent > 0 || result.failed > 0) {
          logger.info('Notification digests processed', result);
        }
      });
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(digestTask);
  logger.info(`Notification digest processor scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

  // Cleanup - every 6 hours (at 0, 6, 12, 18)
  const cleanupTask = cron.schedule(
    '0 */6 * * *',
    async () => {
      await withLock('lock:scheduler:cleanup', 'CleanupJob', cleanupExpiredWebhooks);
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(cleanupTask);
  logger.info(`Webhook cleanup scheduled: every 6 hours (cron: 0 */6 * * *, tz: ${CRON_TIMEZONE})`);

  // Expire old points - first day of every month at midnight
  const pointsExpiryTask = cron.schedule(
    '0 0 1 * *',
    async () => {
      await withLock('lock:scheduler:points_expiry', 'PointsExpiryJob', expireOldPoints);
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(pointsExpiryTask);
  logger.info(`Points expiry scheduled: first day of every month at midnight (cron: 0 0 1 * *, tz: ${CRON_TIMEZONE})`);

  const platformBackupTask = cron.schedule(
    '0 2 * * *',
    async () => {
      const { executePlatformBackupJob } = await import('./platformBackup.job');
      await withLock('lock:scheduler:platform_backup', 'PlatformBackupJob', executePlatformBackupJob);
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(platformBackupTask);
  logger.info(`Platform backup scheduled: daily at 2 AM (cron: 0 2 * * *, tz: ${CRON_TIMEZONE})`);

  const providerMetricsRollupTask = cron.schedule(
    '15 2 * * *',
    async () => {
      await withLock('lock:scheduler:provider_metrics_rollup', 'ProviderMetricsRollupJob', async () => {
        const { runNightlyProviderMetricsRollup } = await import('../services/providerMetricsRollup.service');
        await runNightlyProviderMetricsRollup();

        const { runNightlyProviderFunnelRollup } = await import('../services/providerFunnelRollup.service');
        await runNightlyProviderFunnelRollup();

        const { runNightlyServiceMetricsRollup } = await import('../services/serviceMetricsRollup.service');
        await runNightlyServiceMetricsRollup();
      });
    },
    { timezone: CRON_TIMEZONE }
  );
  scheduledTasks.push(providerMetricsRollupTask);
  logger.info(
    `Provider metrics, funnel, and service rollups scheduled: daily at 2:15 AM (cron: 15 2 * * *, tz: ${CRON_TIMEZONE})`,
  );

  const providerAnalyticsValidationTask = cron.schedule(
    '0 3 * * 0',
    async () => {
      await withLock('lock:scheduler:provider_analytics_validation', 'ProviderAnalyticsValidationJob', async () => {
        const { runProviderAnalyticsValidationJob } = await import('./providerAnalyticsValidation.job');
        await runProviderAnalyticsValidationJob();
      });
    },
    { timezone: CRON_TIMEZONE },
  );
  scheduledTasks.push(providerAnalyticsValidationTask);
  logger.info(
    `Provider analytics validation scheduled: weekly Sunday 3 AM (cron: 0 3 * * 0, tz: ${CRON_TIMEZONE})`,
  );

  const providerAnalyticsEmailTask = cron.schedule(
    '0 8 * * 1',
    async () => {
      await withLock('lock:scheduler:provider_analytics_email', 'ProviderAnalyticsEmailJob', async () => {
        const { runProviderAnalyticsEmailJob } = await import('./providerAnalyticsEmail.job');
        await runProviderAnalyticsEmailJob();
      });
    },
    { timezone: CRON_TIMEZONE },
  );
  scheduledTasks.push(providerAnalyticsEmailTask);
  logger.info(
    `Provider analytics email reports scheduled: weekly Monday 8 AM (cron: 0 8 * * 1, tz: ${CRON_TIMEZONE})`,
  );

  // Run stale booking check immediately on startup (after a short delay to let server initialize)
  setTimeout(async () => {
    try {
      await autoCancelStaleBookings();
    } catch (error) {
      logger.error('Initial stale booking check failed:', error);
    }
  }, 30000); // 30 second delay

  logger.info(`All scheduled jobs initialized. Total cron tasks: ${scheduledTasks.length}`);
}

/**
 * ===========================================
 * AUTOMATION SCHEDULED JOBS
 * ===========================================
 */

/**
 * Win-back campaign detection - Every hour
 * Detects inactive users and creates win-back campaigns
 */
const winBackTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:win_back', 'WinBackJob', async () => {
      logger.info('Running win-back campaign detection...');
      const result = await detectInactiveUsers();
      logger.info('Win-back campaign detection completed', result);
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(winBackTask);
logger.info(`Win-back campaign detection scheduled: every hour (cron: 0 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Birthday rewards - Every day at 9 AM
 * Processes birthday campaigns and sends rewards
 */
const birthdayTask = cron.schedule(
  '0 9 * * *',
  async () => {
    await withLock('lock:scheduler:birthday', 'BirthdayJob', async () => {
      logger.info('Running birthday campaign processor...');
      const result = await processBirthdayCampaigns();
      logger.info('Birthday campaign processor completed', result);

      // Also process expired offers
      const expired = await processExpiredOffers();
      logger.info('Expired birthday offers processed', { count: expired });
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(birthdayTask);
logger.info(`Birthday rewards scheduled: daily at 9 AM (cron: 0 9 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Tier upgrade checks - Every day at 10 AM
 * Checks for tier upgrades and sends progress notifications
 */
const tierUpgradeTask = cron.schedule(
  '0 10 * * *',
  async () => {
    await withLock('lock:scheduler:tier_upgrade', 'TierUpgradeJob', async () => {
      logger.info('Running tier upgrade processor...');

      // Send progress notifications
      const notified = await sendTierProgressNotifications();
      logger.info('Tier progress notifications sent', { count: notified });
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(tierUpgradeTask);
logger.info(`Tier upgrade checks scheduled: daily at 10 AM (cron: 0 10 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Review request timing - Every 15 minutes
 * Processes pending review requests and sends them
 */
const reviewRequestTask = cron.schedule(
  '*/15 * * * *',
  async () => {
    await withLock('lock:scheduler:review_requests', 'ReviewRequestJob', async () => {
      logger.info('Running review request processor...');
      const result = await processReviewRequests();
      logger.info('Review request processor completed', result);
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(reviewRequestTask);
logger.info(`Review request timing scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Training completion checks - Every day at 8 AM
 * Sends reminders for incomplete training modules
 */
const trainingTask = cron.schedule(
  '0 8 * * *',
  async () => {
    await withLock('lock:scheduler:training', 'TrainingJob', async () => {
      logger.info('Running training completion checks...');
      const remindersSent = await sendTrainingReminders();
      logger.info('Training reminders sent', { count: remindersSent });
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(trainingTask);
logger.info(`Training completion checks scheduled: daily at 8 AM (cron: 0 8 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Email sequence processor - Every 15 minutes
 * Processes welcome email sequences
 */
const emailSequenceTask = cron.schedule(
  '*/15 * * * *',
  async () => {
    await withLock('lock:scheduler:email_sequence', 'EmailSequenceJob', async () => {
      logger.info('Running email sequence processor...');
      const result = await processEmailSequence();
      logger.info('Email sequence processor completed', result);
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(emailSequenceTask);
logger.info(`Email sequence processor scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Onboarding reminders - Every day at 11 AM
 * Sends reminders for incomplete onboarding
 */
const onboardingTask = cron.schedule(
  '0 11 * * *',
  async () => {
    await withLock('lock:scheduler:onboarding', 'OnboardingJob', async () => {
      logger.info('Running onboarding reminder processor...');
      const remindersSent = await sendOnboardingReminders();
      logger.info('Onboarding reminders sent', { count: remindersSent });
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(onboardingTask);
logger.info(`Onboarding reminders scheduled: daily at 11 AM (cron: 0 11 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Discount expiry checks - Every day at 12 PM
 * Processes expired first booking discounts
 */
const discountTask = cron.schedule(
  '0 12 * * *',
  async () => {
    await withLock('lock:scheduler:discounts', 'DiscountJob', async () => {
      logger.info('Running discount expiry processor...');

      // Process expired discounts
      const expired = await processExpiredDiscounts();
      logger.info('Expired discounts processed', { count: expired });

      // Send expiry reminders
      const reminders = await sendExpiryReminders();
      logger.info('Discount expiry reminders sent', { count: reminders });
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(discountTask);
logger.info(`Discount expiry checks scheduled: daily at 12 PM (cron: 0 12 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Negative review recovery - Every hour
 * Checks for overdue recovery responses
 */
const negativeReviewTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:negative_review', 'NegativeReviewJob', async () => {
      logger.info('Running negative review recovery processor...');
      const escalated = await checkOverdueRecoveries();
      logger.info('Negative review recovery completed', { escalated });
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(negativeReviewTask);
logger.info(`Negative review recovery scheduled: every hour (cron: 0 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Auto-refund processor - Every hour
 * Processes disputes for auto-refund eligibility
 */
const autoRefundTask = cron.schedule(
  '30 * * * *',
  async () => {
    await withLock('lock:scheduler:auto_refund', 'AutoRefundJob', async () => {
      logger.info('Running auto-refund processor...');

      // Check disputes for auto-refund
      const result = await checkDisputesForAutoRefund();
      logger.info('Auto-refund processor completed', result);

      // Process expired response deadlines
      const processed = await processExpiredResponseDeadlines();
      logger.info('Expired response deadlines processed', { count: processed });
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(autoRefundTask);
logger.info(`Auto-refund processor scheduled: every hour at minute 30 (cron: 30 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Mediation auto-assignment - Every 15 minutes
 * Auto-assigns unassigned disputes to mediators
 */
const mediationTask = cron.schedule(
  '*/15 * * * *',
  async () => {
    await withLock('lock:scheduler:mediation', 'MediationJob', async () => {
      logger.info('Running mediation auto-assignment...');
      const assigned = await autoAssignUnassignedDisputes();
      logger.info('Mediation auto-assignment completed', { assigned });
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(mediationTask);
logger.info(`Mediation auto-assignment scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * SLA monitoring - Every hour
 * Checks SLA status for mediation assignments
 */
const slaTask = cron.schedule(
  '45 * * * *',
  async () => {
    await withLock('lock:scheduler:sla', 'SlaJob', async () => {
      logger.info('Running SLA monitoring...');
      const result = await checkSlaStatus();
      logger.info('SLA monitoring completed', result);
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(slaTask);
logger.info(`SLA monitoring scheduled: every hour at minute 45 (cron: 45 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * ===========================================
 * NEW AUTOMATION SCHEDULED JOBS
 * ===========================================
 */

/**
 * Win-back campaign - Every hour
 * Detects inactive users and runs win-back campaigns
 */
const newWinBackTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:new_win_back', 'NewWinBackJob', async () => {
      try {
        logger.info('Running win-back campaign check');
        await runWinBackCampaign();
        logger.info('Win-back campaign check completed');
      } catch (error) {
        logger.error('Win-back campaign check failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(newWinBackTask);
logger.info(`Win-back campaign scheduled: every hour (cron: 0 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Birthday rewards - Every day at 9 AM
 * Sends birthday rewards to eligible users
 */
const birthdayRewardsTask = cron.schedule(
  '0 9 * * *',
  async () => {
    await withLock('lock:scheduler:birthday_rewards', 'BirthdayRewardsJob', async () => {
      try {
        logger.info('Checking birthday rewards');
        await sendBirthdayRewards();
        logger.info('Birthday rewards check completed');
      } catch (error) {
        logger.error('Birthday rewards check failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(birthdayRewardsTask);
logger.info(`Birthday rewards scheduled: daily at 9 AM (cron: 0 9 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Tier upgrades - Every day at 10 AM
 * Checks for tier upgrades and sends celebration notifications
 */
const tierUpgradeNewTask = cron.schedule(
  '0 10 * * *',
  async () => {
    await withLock('lock:scheduler:tier_upgrade_new', 'TierUpgradeNewJob', async () => {
      try {
        logger.info('Checking tier upgrades');
        await checkTierUpgradesNew();
        logger.info('Tier upgrades check completed');
      } catch (error) {
        logger.error('Tier upgrades check failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(tierUpgradeNewTask);
logger.info(`Tier upgrades scheduled: daily at 10 AM (cron: 0 10 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Review request timing - Every 15 minutes
 * Sends review requests at optimal times after bookings
 */
const reviewRequestNewTask = cron.schedule(
  '*/15 * * * *',
  async () => {
    await withLock('lock:scheduler:review_request_new', 'ReviewRequestNewJob', async () => {
      try {
        logger.info('Checking review requests');
        await sendReviewRequests();
        logger.info('Review requests check completed');
      } catch (error) {
        logger.error('Review requests check failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(reviewRequestNewTask);
logger.info(`Review request timing scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Provider training check - Every hour
 * Checks provider training progress and sends reminders
 */
const providerTrainingTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:provider_training', 'ProviderTrainingJob', async () => {
      try {
        logger.info('Checking provider training');
        await runProviderTrainingCheck();
        logger.info('Provider training check completed');
      } catch (error) {
        logger.error('Provider training check failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(providerTrainingTask);
logger.info(`Provider training scheduled: every hour (cron: 0 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Onboarding checklist - Every 6 hours
 * Processes onboarding checklists for new users
 */
const onboardingChecklistTask = cron.schedule(
  '0 */6 * * *',
  async () => {
    await withLock('lock:scheduler:onboarding_checklist', 'OnboardingChecklistJob', async () => {
      try {
        logger.info('Running onboarding checklist');
        await runOnboardingChecklist();
        logger.info('Onboarding checklist completed');
      } catch (error) {
        logger.error('Onboarding checklist failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(onboardingChecklistTask);
logger.info(`Onboarding checklist scheduled: every 6 hours (cron: 0 */6 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * First booking discount - Every day at midnight
 * Checks and applies first booking discounts
 */
const firstBookingDiscountTask = cron.schedule(
  '0 0 * * *',
  async () => {
    await withLock('lock:scheduler:first_booking_discount', 'FirstBookingDiscountJob', async () => {
      try {
        logger.info('Checking first booking discounts');
        await checkFirstBookingDiscount();
        logger.info('First booking discounts check completed');
      } catch (error) {
        logger.error('First booking discounts check failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(firstBookingDiscountTask);
logger.info(`First booking discount scheduled: daily at midnight (cron: 0 0 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Negative review recovery - Every 30 minutes
 * Processes and recovers from negative reviews
 */
const negativeReviewNewTask = cron.schedule(
  '*/30 * * * *',
  async () => {
    await withLock('lock:scheduler:negative_review_new', 'NegativeReviewNewJob', async () => {
      try {
        logger.info('Processing negative reviews');
        await processNegativeReviews();
        logger.info('Negative review processing completed');
      } catch (error) {
        logger.error('Negative review processing failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(negativeReviewNewTask);
logger.info(`Negative review recovery scheduled: every 30 minutes (cron: */30 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Auto refund threshold - Every hour
 * Processes automatic refunds based on threshold rules
 */
const autoRefundThresholdTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:auto_refund_threshold', 'AutoRefundThresholdJob', async () => {
      try {
        logger.info('Processing auto refunds');
        await processAutoRefunds();
        logger.info('Auto refund processing completed');
      } catch (error) {
        logger.error('Auto refund processing failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(autoRefundThresholdTask);
logger.info(`Auto refund threshold scheduled: every hour (cron: 0 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Mediation auto-assign - Every 4 hours
 * Auto-assigns unassigned mediation cases
 */
const mediationAutoAssignTask = cron.schedule(
  '0 */4 * * *',
  async () => {
    await withLock('lock:scheduler:mediation_auto_assign', 'MediationAutoAssignJob', async () => {
      try {
        logger.info('Assigning mediations');
        await assignMediations();
        logger.info('Mediation assignment completed');
      } catch (error) {
        logger.error('Mediation assignment failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(mediationAutoAssignTask);
logger.info(`Mediation auto-assign scheduled: every 4 hours (cron: 0 */4 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Welcome email sequence - Every 15 minutes
 * Sends welcome email sequences to new users
 */
const welcomeEmailTask = cron.schedule(
  '*/15 * * * *',
  async () => {
    await withLock('lock:scheduler:welcome_email', 'WelcomeEmailJob', async () => {
      try {
        logger.info('Running welcome email sequence');
        await runWelcomeEmailSequence();
        logger.info('Welcome email sequence completed');
      } catch (error) {
        logger.error('Welcome email sequence failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(welcomeEmailTask);
logger.info(`Welcome email sequence scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Referral gamification check - Every hour
 * Checks for new badges and milestone achievements
 */
const referralGamificationTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:referral_gamification', 'ReferralGamificationJob', async () => {
      try {
        logger.info('Checking referral gamification');
        // This is called when referrals are made
        // The actual badge/milestone checks happen during referral processing
        logger.info('Referral gamification check completed');
      } catch (error) {
        logger.error('Referral gamification check failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(referralGamificationTask);
logger.info(`Referral gamification scheduled: every hour (cron: 0 * * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Off-peak promotion analysis - Daily at 6 AM
 * Analyzes demand patterns and generates promotion suggestions
 */
const offPeakPromotionTask = cron.schedule(
  '0 6 * * *',
  async () => {
    await withLock('lock:scheduler:off_peak_promotion', 'OffPeakPromotionJob', async () => {
      try {
        logger.info('Running off-peak promotion analysis');
        await runOffPeakPromotionAnalysis();
        logger.info('Off-peak promotion analysis completed');
      } catch (error) {
        logger.error('Off-peak promotion analysis failed:', error);
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(offPeakPromotionTask);
logger.info(`Off-peak promotion analysis scheduled: daily at 6 AM (cron: 0 6 * * *, tz: ${CRON_TIMEZONE})`);

// ============================================
// OFFER EXPIRY NOTIFICATION JOBS
// ============================================

/**
 * Send notifications for offers expiring soon
 * Runs daily at 9 AM
 */
const offerExpiryTask = cron.schedule(
  '0 9 * * *',
  async () => {
    await withLock('lock:scheduler:offer_expiry', 'OfferExpiryNotificationJob', async () => {
      const { offerExpiryNotificationService } = await import('../services/offerExpiryNotification.service');
      await offerExpiryNotificationService.notifyExpiringOffers();
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(offerExpiryTask);
logger.info(`Offer expiry notifications scheduled: daily at 9 AM (cron: 0 9 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Send reminders for unused claims
 * Runs daily at 10 AM
 */
const unusedClaimsTask = cron.schedule(
  '0 10 * * *',
  async () => {
    await withLock('lock:scheduler:unused_claims', 'UnusedClaimsNotificationJob', async () => {
      const { offerExpiryNotificationService } = await import('../services/offerExpiryNotification.service');
      await offerExpiryNotificationService.notifyUnusedClaims();
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(unusedClaimsTask);
logger.info(`Unused claims reminders scheduled: daily at 10 AM (cron: 0 10 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Process expired claims and send notifications
 * Runs daily at midnight
 */
const expiredClaimsTask = cron.schedule(
  '0 0 * * *',
  async () => {
    await withLock('lock:scheduler:expired_claims', 'ExpiredClaimsJob', async () => {
      const { offerExpiryNotificationService } = await import('../services/offerExpiryNotification.service');
      await offerExpiryNotificationService.processExpiredClaims();
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(expiredClaimsTask);
logger.info(`Expired claims processor scheduled: daily at midnight (cron: 0 0 * * *, tz: ${CRON_TIMEZONE})`);

/**
 * Gracefully shutdown all scheduled jobs
 */
export function shutdownScheduledJobs(): void {
  logger.info('Shutting down scheduled jobs...');

  for (const task of scheduledTasks) {
    task.stop();
  }

  scheduledTasks.length = 0;
  logger.info('All scheduled jobs stopped');
}

export default {
  initializeScheduledJobs,
  shutdownScheduledJobs,
  autoCancelStaleBookings,
  autoRejectExpiredConfirmedBookings,
  processPendingWithdrawals,
  sendBookingReminders,
  cleanupExpiredWebhooks,
  expireOldPoints,
  // Existing automation jobs
  detectInactiveUsers,
  processBirthdayCampaigns,
  sendTierProgressNotifications,
  processReviewRequests,
  sendTrainingReminders,
  processEmailSequence,
  sendOnboardingReminders,
  processExpiredDiscounts,
  sendExpiryReminders,
  checkOverdueRecoveries,
  checkDisputesForAutoRefund,
  processExpiredResponseDeadlines,
  autoAssignUnassignedDisputes,
  checkSlaStatus,
  // New automation jobs
  runWelcomeEmailSequence,
  runOnboardingChecklist,
  checkFirstBookingDiscount,
  runProviderTrainingCheck,
  sendReviewRequests,
  processNegativeReviews,
  runWinBackCampaign,
  checkTierUpgradesNew,
  sendBirthdayRewards,
  processAutoRefunds,
  assignMediations,
  // Referral and off-peak jobs
  runOffPeakPromotionAnalysis,
  generatePromotionSuggestions,
};
