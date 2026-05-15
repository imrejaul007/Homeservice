import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { Queue } from 'bullmq';

/**
 * Scheduled Jobs for NILIN Platform
 * Uses simple interval-based scheduling (can be upgraded to node-cron)
 */

const STALE_BOOKING_HOURS = 48; // Auto-cancel pending bookings after 48 hours

/**
 * Auto-cancel stale pending bookings that providers haven't responded to
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
          'Auto-cancelled: provider did not respond within 48 hours',
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
 * Process pending withdrawal requests
 */
async function processPendingWithdrawals(): Promise<void> {
  try {
    // This would process pending withdrawals from wallet
    // For now, just log that it's running
    logger.info('Withdrawal processor job running...');

    // TODO: Implement withdrawal processing:
    // 1. Find withdrawals with status 'pending'
    // 2. Process through Stripe transfers
    // 3. Update status to 'processing' then 'completed'
    // 4. Send notifications
  } catch (error) {
    logger.error('Error in withdrawal processor job:', error);
  }
}

/**
 * Send booking reminders (24h and 2h before appointment)
 */
async function sendBookingReminders(): Promise<void> {
  try {
    const now = new Date();

    // Reminders to send
    const reminderWindows = [
      { hours: 24, label: '24-hour' },
      { hours: 2, label: '2-hour' }
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

        for (const booking of bookingsToRemind) {
          // TODO: Trigger notification event
          // eventBus.publish(EVENT_TYPES.BOOKING_REMINDER, {
          //   bookingId: booking._id,
          //   customerId: booking.customerId,
          //   providerId: booking.providerId,
          //   reminderType: window.label,
          //   scheduledDate: booking.scheduledDate
          // });
        }
      }
    }
  } catch (error) {
    logger.error('Error in booking reminders job:', error);
  }
}

/**
 * Clean up expired webhook events
 */
async function cleanupExpiredWebhooks(): Promise<void> {
  try {
    // This would clean up old webhook events if using a TTL collection
    // For now, just log
    logger.info('Webhook cleanup job running...');
  } catch (error) {
    logger.error('Error in webhook cleanup job:', error);
  }
}

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduledJobs(): void {
  logger.info('Initializing scheduled jobs...');

  // Auto-cancel stale bookings - every hour
  const staleBookingInterval = 60 * 60 * 1000; // 1 hour
  setInterval(autoCancelStaleBookings, staleBookingInterval);
  logger.info(`Stale booking auto-cancel scheduled: every ${staleBookingInterval / 60000} minutes`);

  // Process withdrawals - every 15 minutes
  const withdrawalInterval = 15 * 60 * 1000; // 15 minutes
  setInterval(processPendingWithdrawals, withdrawalInterval);
  logger.info(`Withdrawal processor scheduled: every ${withdrawalInterval / 60000} minutes`);

  // Send reminders - every 30 minutes
  const reminderInterval = 30 * 60 * 1000; // 30 minutes
  setInterval(sendBookingReminders, reminderInterval);
  logger.info(`Booking reminders scheduled: every ${reminderInterval / 60000} minutes`);

  // Cleanup - every 6 hours
  const cleanupInterval = 6 * 60 * 60 * 1000; // 6 hours
  setInterval(cleanupExpiredWebhooks, cleanupInterval);
  logger.info(`Webhook cleanup scheduled: every ${cleanupInterval / 3600000} hours`);

  // Run stale booking check immediately on startup (after a short delay)
  setTimeout(autoCancelStaleBookings, 30000); // 30 second delay

  logger.info('All scheduled jobs initialized');
}

export default {
  initializeScheduledJobs,
  autoCancelStaleBookings,
  processPendingWithdrawals,
  sendBookingReminders,
  cleanupExpiredWebhooks
};
