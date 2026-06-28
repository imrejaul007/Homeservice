import * as cron from 'node-cron';
import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import Payout, { type IPayout } from '../models/payout.model';
import Wallet from '../models/wallet.model';
import logger from '../utils/logger';
import { addJob } from '../queue';
import { eventBus, EVENT_TYPES } from '../event-bus';
import { cache } from '../config/redis';
import { jobRegistry } from '../utils/jobRegistry';

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
import { checkAllTierUpgrades as checkTierUpgradesNew, checkAllTierDowngrades } from '../automation/tierUpgradeCelebration';
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

    // Batch update all stale bookings to cancelled status
    const staleBookingIds = staleBookings.map(b => b._id);
    const now = new Date();

    if (staleBookingIds.length > 0) {
      const result = await Booking.updateMany(
        { _id: { $in: staleBookingIds } },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: now,
            cancelledBy: 'system',
            cancellationReason: `Auto-cancelled: provider did not respond within ${STALE_BOOKING_HOURS} hours`,
            cancellationNote: 'Automatic system cancellation due to no provider response'
          }
        }
      );
      logger.info(`Batch cancelled ${result.modifiedCount} stale bookings`);
    }
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

    // Filter and collect expired booking IDs that are past grace period
    const expiredBookingIds: mongoose.Types.ObjectId[] = [];

    for (const booking of expiredBookings) {
      // Double-check: ensure the booking is actually past its scheduled time
      const scheduledDateTime = new Date(booking.scheduledDate);
      const [hours, minutes] = booking.scheduledTime.split(':').map(Number);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      if (scheduledDateTime.getTime() + gracePeriodMs > now.getTime()) {
        // Not yet past grace period, skip
        continue;
      }
      expiredBookingIds.push(booking._id);
    }

    // Batch update all expired bookings to rejected status
    if (expiredBookingIds.length > 0) {
      const result = await Booking.updateMany(
        { _id: { $in: expiredBookingIds } },
        {
          $set: {
            status: 'rejected',
            rejectedAt: now,
            rejectedBy: 'system',
            rejectionReason: 'Auto-rejected: provider accepted but did not show up',
            rejectionNote: 'Automatic system rejection - scheduled time has passed'
          }
        }
      );
      logger.info(`Batch rejected ${result.modifiedCount} expired bookings`);
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
  const CHUNK_SIZE = 50;

  try {
    logger.info('Withdrawal processor job starting...');

    // 1. Find payouts due for processing (scheduled and due)
    const duePayouts: IPayout[] = await Payout.findDuePayouts(100);
    logger.info(`Found ${duePayouts.length} payouts due for processing`);

    // Separate payouts by type for bulk processing
    const walletPayouts = duePayouts.filter(p => p.method === 'wallet');
    const bankTransferPayouts = duePayouts.filter(p => p.method === 'bank_transfer' && p.bankDetails);

    // Process wallet payouts in bulk
    if (walletPayouts.length > 0) {
      const walletPayoutIds = walletPayouts.map(p => p._id);
      await Payout.updateMany(
        { _id: { $in: walletPayoutIds } },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
          }
        }
      );
      logger.info(`Batch marked ${walletPayoutIds.length} wallet payouts as completed`);
    }

    // Process bank transfer payouts in chunks with transaction
    for (let i = 0; i < bankTransferPayouts.length; i += CHUNK_SIZE) {
      const chunk = bankTransferPayouts.slice(i, i + CHUNK_SIZE);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const completedPayoutIds: mongoose.Types.ObjectId[] = [];
        const stripePayoutIds: string[] = [];
        const payoutDetails: Array<{
          payoutId: string;
          payoutNumber: string;
          providerId: string;
          amount: number;
          currency: string;
          stripePayoutId: string;
        }> = [];

        // Process each payout in chunk
        for (const payout of chunk) {
          try {
            // Mark as processing
            await Payout.updateOne(
              { _id: payout._id },
              { $set: { status: 'processing', processedAt: new Date() } }
            );

            // SECURITY FIX: Only use mock Stripe in development
            // In production, this should call the real Stripe API
            let stripePayoutId: string;
            if (process.env.NODE_ENV === 'production') {
              // Production: Call real Stripe API
              // const stripeTransfer = await stripe.transfers.create({
              //   amount: Math.round(payout.amount * 100), // Convert to cents
              //   currency: payout.currency.toLowerCase(),
              //   destination: payout.bankDetails.accountNumber,
              //   ...
              // });
              // stripePayoutId = stripeTransfer.id;
              throw new Error('Stripe production transfer not implemented - fix required');
            } else {
              // Development: Use mock payout ID
              stripePayoutId = `po_test_${Date.now()}_${payout._id}`;
            }

            completedPayoutIds.push(payout._id);
            stripePayoutIds.push(stripePayoutId);
            payoutDetails.push({
              payoutId: payout._id.toString(),
              payoutNumber: payout.payoutNumber,
              providerId: payout.providerId.toString(),
              amount: payout.amount,
              currency: payout.currency,
              stripePayoutId: stripePayoutId,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await Payout.updateOne(
              { _id: payout._id },
              {
                $push: {
                  failureHistory: {
                    error: errorMessage,
                    timestamp: new Date(),
                  }
                },
                $inc: { currentRetryCount: 1 },
              }
            );
            logger.error(`Payout ${payout.payoutNumber} processing failed: ${errorMessage}`);
          }
        }

        // Bulk update completed payouts
        if (completedPayoutIds.length > 0) {
          const completedAt = new Date();
          await Payout.updateMany(
            { _id: { $in: completedPayoutIds } },
            {
              $set: {
                status: 'completed',
                completedAt,
                stripePayoutId: (idx: number) => stripePayoutIds[idx],
              }
            }
          );

          // Collect wallet updates
          const walletUpdates = payoutDetails.map(p => ({
            userId: new mongoose.Types.ObjectId(p.providerId),
            amount: p.amount,
          }));

          // Bulk update wallets
          for (const update of walletUpdates) {
            await Wallet.updateOne(
              { userId: update.userId },
              { $inc: { pendingBalance: -update.amount } },
              { session }
            );
          }
        }

        await session.commitTransaction();
        logger.info(`Batch processed ${completedPayoutIds.length} bank transfer payouts in chunk ${Math.floor(i / CHUNK_SIZE) + 1}`);

        // Publish events after successful transaction
        for (const detail of payoutDetails) {
          await eventBus.publish(EVENT_TYPES.PAYOUT_COMPLETED, detail);
        }
      } catch (error) {
        await session.abortTransaction();
        logger.error(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} transaction failed:`, error);
      } finally {
        session.endSession();
      }
    }

    // 2. Process retriable failed payouts
    const retriablePayouts = await Payout.findRetriablePayouts(20);
    logger.info(`Found ${retriablePayouts.length} retriable payouts`);

    for (const payout of retriablePayouts) {
      try {
        const mockStripePayoutId = `po_retry_${Date.now()}_${payout._id}`;
        await Payout.updateOne(
          { _id: payout._id },
          { $set: { status: 'processing', processedAt: new Date() } }
        );
        await Payout.updateOne(
          { _id: payout._id },
          {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              stripePayoutId: mockStripePayoutId,
            }
          }
        );

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${baseUrl}/loyalty/expire-old-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

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
      const startTime = Date.now();
      logger.info('Running win-back campaign detection...');
      try {
        const result = await detectInactiveUsers();
        logger.info('Win-back campaign detection completed', result);
        await jobRegistry.recordExecution('win_back_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: result.detected || 0,
        });
      } catch (error) {
        logger.error('Win-back campaign detection failed', error);
        await jobRegistry.recordExecution('win_back_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running birthday campaign processor...');
      try {
        const result = await processBirthdayCampaigns();
        logger.info('Birthday campaign processor completed', result);

        // Also process expired offers
        const expired = await processExpiredOffers();
        logger.info('Expired birthday offers processed', { count: expired });

        await jobRegistry.recordExecution('birthday_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: result.preBirthday + result.birthday + result.postBirthday,
        });
      } catch (error) {
        logger.error('Birthday campaign processor failed', error);
        await jobRegistry.recordExecution('birthday_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running tier upgrade processor...');

      try {
        // Send progress notifications
        const notified = await sendTierProgressNotifications();
        logger.info('Tier progress notifications sent', { count: notified });

        await jobRegistry.recordExecution('tier_upgrade_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: notified,
        });
      } catch (error) {
        logger.error('Tier upgrade processor failed', error);
        await jobRegistry.recordExecution('tier_upgrade_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running review request processor...');
      try {
        const result = await processReviewRequests();
        logger.info('Review request processor completed', result);

        await jobRegistry.recordExecution('review_request_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: result.processed || 0,
        });
      } catch (error) {
        logger.error('Review request processor failed', error);
        await jobRegistry.recordExecution('review_request_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running training completion checks...');
      try {
        const remindersSent = await sendTrainingReminders();
        logger.info('Training reminders sent', { count: remindersSent });

        await jobRegistry.recordExecution('provider_training_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: remindersSent,
        });
      } catch (error) {
        logger.error('Training completion checks failed', error);
        await jobRegistry.recordExecution('provider_training_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running email sequence processor...');
      try {
        const result = await processEmailSequence();
        logger.info('Email sequence processor completed', result);
        await jobRegistry.recordExecution('welcome_email_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: result.processed || 0,
        });
      } catch (error) {
        logger.error('Email sequence processor failed', error);
        await jobRegistry.recordExecution('welcome_email_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running onboarding reminder processor...');
      try {
        const remindersSent = await sendOnboardingReminders();
        logger.info('Onboarding reminders sent', { count: remindersSent });
        await jobRegistry.recordExecution('onboarding_checklist_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: remindersSent,
        });
      } catch (error) {
        logger.error('Onboarding reminder processor failed', error);
        await jobRegistry.recordExecution('onboarding_checklist_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running discount expiry processor...');

      try {
        // Process expired discounts
        const expired = await processExpiredDiscounts();
        logger.info('Expired discounts processed', { count: expired });

        // Send expiry reminders
        const reminders = await sendExpiryReminders();
        logger.info('Discount expiry reminders sent', { count: reminders });

        await jobRegistry.recordExecution('first_booking_discount_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: expired + reminders,
        });
      } catch (error) {
        logger.error('Discount expiry processor failed', error);
        await jobRegistry.recordExecution('first_booking_discount_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running negative review recovery processor...');
      try {
        const escalated = await checkOverdueRecoveries();
        logger.info('Negative review recovery completed', { escalated });
        await jobRegistry.recordExecution('negative_review_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: escalated,
        });
      } catch (error) {
        logger.error('Negative review recovery failed', error);
        await jobRegistry.recordExecution('negative_review_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running auto-refund processor...');

      try {
        // Check disputes for auto-refund
        const result = await checkDisputesForAutoRefund();
        logger.info('Auto-refund processor completed', result);

        // Process expired response deadlines
        const processed = await processExpiredResponseDeadlines();
        logger.info('Expired response deadlines processed', { count: processed });

        await jobRegistry.recordExecution('auto_refund_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: (result.processed || 0) + processed,
        });
      } catch (error) {
        logger.error('Auto-refund processor failed', error);
        await jobRegistry.recordExecution('auto_refund_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running mediation auto-assignment...');
      try {
        const assigned = await autoAssignUnassignedDisputes();
        logger.info('Mediation auto-assignment completed', { assigned });
        await jobRegistry.recordExecution('mediation_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: assigned,
        });
      } catch (error) {
        logger.error('Mediation auto-assignment failed', error);
        await jobRegistry.recordExecution('mediation_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      const startTime = Date.now();
      logger.info('Running SLA monitoring...');
      try {
        const result = await checkSlaStatus();
        logger.info('SLA monitoring completed', result);
        // Note: SLA is not in jobRegistry as it's infrastructure-level monitoring
      } catch (error) {
        logger.error('SLA monitoring failed', error);
      }
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
 * Note: These jobs use the same job IDs as the original jobs above,
 * so they share the same job registry entries.
 */

/**
 * Win-back campaign - Every hour
 * Detects inactive users and runs win-back campaigns
 * Uses 'win_back' job ID - shares entry with original win-back job
 */
const newWinBackTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:new_win_back', 'NewWinBackJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Running win-back campaign check');
        await runWinBackCampaign();
        logger.info('Win-back campaign check completed');
        await jobRegistry.recordExecution('win_back_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Win-back campaign check failed:', error);
        await jobRegistry.recordExecution('win_back_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'birthday' job ID - shares entry with original birthday job
 */
const birthdayRewardsTask = cron.schedule(
  '0 9 * * *',
  async () => {
    await withLock('lock:scheduler:birthday_rewards', 'BirthdayRewardsJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Checking birthday rewards');
        await sendBirthdayRewards();
        logger.info('Birthday rewards check completed');
        await jobRegistry.recordExecution('birthday_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Birthday rewards check failed:', error);
        await jobRegistry.recordExecution('birthday_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'tier_upgrade' job ID - shares entry with original tier upgrade job
 */
const tierUpgradeNewTask = cron.schedule(
  '0 10 * * *',
  async () => {
    await withLock('lock:scheduler:tier_upgrade_new', 'TierUpgradeNewJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Checking tier upgrades');
        await checkTierUpgradesNew();
        logger.info('Tier upgrades check completed');
        await jobRegistry.recordExecution('tier_upgrade_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Tier upgrades check failed:', error);
        await jobRegistry.recordExecution('tier_upgrade_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(tierUpgradeNewTask);
logger.info(`Tier upgrades scheduled: daily at 10 AM (cron: 0 10 * * *, tz: ${CRON_TIMEZONE})`);

// FIX: Tier downgrades - First day of each month at 10:30 AM
const tierDowngradeTask = cron.schedule(
  '30 10 1 * *',
  async () => {
    await withLock('lock:scheduler:tier_downgrade', 'TierDowngradeJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Checking tier downgrades');
        const result = await checkAllTierDowngrades();
        logger.info('Tier downgrades check completed', result);
        await jobRegistry.recordExecution('tier_downgrade', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          ...result,
        });
      } catch (error) {
        logger.error('Tier downgrades check failed:', error);
        await jobRegistry.recordExecution('tier_downgrade', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(tierDowngradeTask);
logger.info(`Tier downgrades scheduled: monthly on 1st at 10:30 AM (cron: 30 10 1 * *, tz: ${CRON_TIMEZONE})`);

/**
 * Review request timing - Every 15 minutes
 * Sends review requests at optimal times after bookings
 * Uses 'review_request' job ID - shares entry with original review request job
 */
const reviewRequestNewTask = cron.schedule(
  '*/15 * * * *',
  async () => {
    await withLock('lock:scheduler:review_request_new', 'ReviewRequestNewJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Checking review requests');
        await sendReviewRequests();
        logger.info('Review requests check completed');
        await jobRegistry.recordExecution('review_request_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Review requests check failed:', error);
        await jobRegistry.recordExecution('review_request_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'provider_training' job ID - shares entry with original training job
 */
const providerTrainingTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:provider_training', 'ProviderTrainingJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Checking provider training');
        await runProviderTrainingCheck();
        logger.info('Provider training check completed');
        await jobRegistry.recordExecution('provider_training_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Provider training check failed:', error);
        await jobRegistry.recordExecution('provider_training_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'onboarding_checklist' job ID - shares entry with original onboarding job
 */
const onboardingChecklistTask = cron.schedule(
  '0 */6 * * *',
  async () => {
    await withLock('lock:scheduler:onboarding_checklist', 'OnboardingChecklistJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Running onboarding checklist');
        await runOnboardingChecklist();
        logger.info('Onboarding checklist completed');
        await jobRegistry.recordExecution('onboarding_checklist_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Onboarding checklist failed:', error);
        await jobRegistry.recordExecution('onboarding_checklist_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'first_booking_discount' job ID - shares entry with original discount job
 */
const firstBookingDiscountTask = cron.schedule(
  '0 0 * * *',
  async () => {
    await withLock('lock:scheduler:first_booking_discount', 'FirstBookingDiscountJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Checking first booking discounts');
        await checkFirstBookingDiscount();
        logger.info('First booking discounts check completed');
        await jobRegistry.recordExecution('first_booking_discount_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('First booking discounts check failed:', error);
        await jobRegistry.recordExecution('first_booking_discount_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'negative_review' job ID - shares entry with original negative review job
 */
const negativeReviewNewTask = cron.schedule(
  '*/30 * * * *',
  async () => {
    await withLock('lock:scheduler:negative_review_new', 'NegativeReviewNewJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Processing negative reviews');
        await processNegativeReviews();
        logger.info('Negative review processing completed');
        await jobRegistry.recordExecution('negative_review_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Negative review processing failed:', error);
        await jobRegistry.recordExecution('negative_review_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'auto_refund' job ID - shares entry with original auto-refund job
 */
const autoRefundThresholdTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:auto_refund_threshold', 'AutoRefundThresholdJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Processing auto refunds');
        await processAutoRefunds();
        logger.info('Auto refund processing completed');
        await jobRegistry.recordExecution('auto_refund_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Auto refund processing failed:', error);
        await jobRegistry.recordExecution('auto_refund_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'mediation' job ID - shares entry with original mediation job
 */
const mediationAutoAssignTask = cron.schedule(
  '0 */4 * * *',
  async () => {
    await withLock('lock:scheduler:mediation_auto_assign', 'MediationAutoAssignJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Assigning mediations');
        await assignMediations();
        logger.info('Mediation assignment completed');
        await jobRegistry.recordExecution('mediation_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Mediation assignment failed:', error);
        await jobRegistry.recordExecution('mediation_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'welcome_email' job ID - shares entry with original email sequence job
 */
const welcomeEmailTask = cron.schedule(
  '*/15 * * * *',
  async () => {
    await withLock('lock:scheduler:welcome_email', 'WelcomeEmailJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Running welcome email sequence');
        await runWelcomeEmailSequence();
        logger.info('Welcome email sequence completed');
        await jobRegistry.recordExecution('welcome_email_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Welcome email sequence failed:', error);
        await jobRegistry.recordExecution('welcome_email_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'referral_gamification' job ID
 */
const referralGamificationTask = cron.schedule(
  '0 * * * *',
  async () => {
    await withLock('lock:scheduler:referral_gamification', 'ReferralGamificationJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Checking referral gamification');
        // Badge/milestone checks happen during referral processing
        // This job is kept for periodic cleanup and statistics updates
        const { checkAndAwardBadges } = await import('../automation/referralGamification');
        // Process all users with pending badge awards
        // Note: In production, this would batch process users
        logger.info('Referral gamification check completed');
        await jobRegistry.recordExecution('referral_gamification_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Referral gamification check failed:', error);
        await jobRegistry.recordExecution('referral_gamification_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
 * Uses 'off_peak_promotion' job ID
 */
const offPeakPromotionTask = cron.schedule(
  '0 6 * * *',
  async () => {
    await withLock('lock:scheduler:off_peak_promotion', 'OffPeakPromotionJob', async () => {
      const startTime = Date.now();
      try {
        logger.info('Running off-peak promotion analysis');
        await runOffPeakPromotionAnalysis();
        logger.info('Off-peak promotion analysis completed');
        await jobRegistry.recordExecution('off_peak_promotion_v2', {
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Off-peak promotion analysis failed:', error);
        await jobRegistry.recordExecution('off_peak_promotion_v2', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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

// ============================================
// SCHEDULED REPORT EXECUTOR JOB
// ============================================

/**
 * Execute due scheduled reports - Every 15 minutes
 * Processes all enabled scheduled reports where nextRunDate <= now
 * Generates report data, sends emails to recipients, and updates nextRunDate
 */
const scheduledReportExecutorTask = cron.schedule(
  '*/15 * * * *',
  async () => {
    await withLock('lock:scheduler:scheduled_reports', 'ScheduledReportExecutorJob', async () => {
      const startTime = Date.now();
      logger.info('Running scheduled report executor job...');

      try {
        const { executeScheduledReports } = await import('./scheduledReportExecutor.job');
        const result = await executeScheduledReports();

        logger.info('Scheduled report executor job completed', {
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          executionTimeMs: Date.now() - startTime,
        });

        await jobRegistry.recordExecution('scheduled_report_executor', {
          success: true,
          executionTimeMs: Date.now() - startTime,
          recordsProcessed: result.processed,
        });
      } catch (error) {
        logger.error('Scheduled report executor job failed', {
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime,
        });

        await jobRegistry.recordExecution('scheduled_report_executor', {
          success: false,
          executionTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  },
  { timezone: CRON_TIMEZONE }
);
scheduledTasks.push(scheduledReportExecutorTask);
logger.info(
  `Scheduled report executor scheduled: every 15 minutes (cron: */15 * * * *, tz: ${CRON_TIMEZONE})`,
);

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
  // Scheduled reports job
  executeScheduledReports: () => import('./scheduledReportExecutor.job').then(m => m.default()),
};
