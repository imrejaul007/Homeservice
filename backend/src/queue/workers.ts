import { Worker, Job } from 'bullmq';
import logger from '../utils/logger';
import emailService from '../services/email.service';
import { QUEUE_NAMES, areQueuesEnabled } from './index';
import dotenv from 'dotenv';
import path from 'path';

// Load env first
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Check if Redis is configured for workers
const isRedisConfigured = (): boolean => {
  return !!(process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_PORT));
};

// Parse REDIS_URL if provided
const getRedisConfig = () => {
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      return {
        host: url.hostname,
        port: parseInt(url.port || '12442'),
        password: url.password || undefined,
      };
    } catch {
      // Fall back to individual env vars
    }
  }
  return {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '12442'),
    password: process.env.REDIS_PASSWORD,
  };
};

const redisConfig = getRedisConfig();

// Common worker options with Redis connection - use URL for BullMQ v5
const workerOptions = {
  connection: {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    maxRetriesPerRequest: null,
  },
};

// ============================================
// Email Worker
// ============================================

interface EmailJobData {
  to: string;
  type: string;
  metadata?: Record<string, unknown>;
}

const emailProcessor = async (job: Job<EmailJobData>) => {
  const { to, type, metadata } = job.data;

  logger.info(`Processing email job: ${job.id}`, {
    jobId: job.id,
    type,
    to,
    action: 'EMAIL_JOB_STARTED',
  });

  try {
    const firstName = (metadata?.firstName as string) || 'Customer';
    const bookingDetails = metadata?.bookingDetails;

    switch (type) {
      case 'booking_confirmation':
        await emailService.sendBookingConfirmationEmail(to, firstName, bookingDetails);
        break;

      case 'booking_accepted':
        await emailService.sendBookingAcceptedEmail(to, firstName, bookingDetails);
        break;

      case 'booking_cancelled':
        await emailService.sendBookingCancelledEmail(to, firstName, bookingDetails);
        break;

      case 'booking_completed':
        await emailService.sendBookingCompletedEmail(to, firstName, bookingDetails);
        break;

      case 'booking_reminder':
        await emailService.sendBookingReminderEmail(to, firstName, bookingDetails);
        break;

      case 'booking_request':
        await emailService.sendBookingRequestEmail(to, firstName, bookingDetails);
        break;

      case 'password_reset':
        await emailService.sendPasswordResetEmail(to, firstName, metadata?.resetToken as string);
        break;

      case 'welcome':
        await emailService.sendWelcomeEmail(to, firstName, 'user');
        break;

      case 'verification':
        await emailService.sendVerificationEmail(to, firstName, metadata?.verificationToken as string);
        break;

      case 'provider_approved':
        await emailService.sendProviderApproval({
          email: to,
          firstName,
          businessName: (metadata?.businessName as string) || 'Your Business'
        });
        break;

      case 'provider_rejected':
        await emailService.sendProviderRejection({
          email: to,
          firstName,
          businessName: (metadata?.businessName as string) || 'Your Business'
        }, (metadata?.rejectionReason as string) || 'Not meeting requirements');
        break;

      case 'payment_received':
        // Payment received notification - log for now, can add email template later
        logger.info(`Payment received notification for ${to}: ${metadata?.amount}`);
        break;

      case 'payout_processed':
        // Payout processed notification - log for now, can add email template later
        logger.info(`Payout processed notification for ${to}: ${metadata?.amount}`);
        break;

      default:
        logger.warn(`Unknown email type: ${type}`, {
          type,
          action: 'UNKNOWN_EMAIL_TYPE',
        });
    }

    logger.info(`Email job completed: ${job.id}`, {
      jobId: job.id,
      type,
      action: 'EMAIL_JOB_COMPLETED',
    });

    return { success: true };
  } catch (error) {
    logger.error(`Email job failed: ${job.id}`, {
      jobId: job.id,
      type,
      error: (error as Error).message,
      action: 'EMAIL_JOB_FAILED',
    });
    throw error;
  }
};

// ============================================
// Notification Worker
// ============================================

interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

const notificationProcessor = async (job: Job<NotificationJobData>) => {
  const { userId, type, title, message, data } = job.data;

  logger.info(`Processing notification job: ${job.id}`, {
    jobId: job.id,
    type,
    userId,
    action: 'NOTIFICATION_JOB_STARTED',
  });

  try {
    // Import notification service dynamically to avoid circular dependency
    const { notificationService } = await import('../services/notification.service');

    // Cast type to NotificationType - validation should happen at job creation
    const validTypes = ['booking_request', 'booking_confirmed', 'booking_cancelled', 'booking_rejected',
                        'booking_started', 'booking_completed', 'booking_reminder', 'message_received',
                        'review_received', 'promotion', 'loyalty_update'];
    const notificationType = validTypes.includes(type) ? type as any : 'promotion';

    await notificationService.createNotification({
      recipientId: userId,
      type: notificationType,
      title,
      message,
      metadata: data,
    });

    logger.info(`Notification job completed: ${job.id}`, {
      jobId: job.id,
      action: 'NOTIFICATION_JOB_COMPLETED',
    });

    return { success: true };
  } catch (error) {
    logger.error(`Notification job failed: ${job.id}`, {
      jobId: job.id,
      error: (error as Error).message,
      action: 'NOTIFICATION_JOB_FAILED',
    });
    throw error;
  }
};

// ============================================
// Loyalty Worker
// ============================================

interface LoyaltyJobData {
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

// Tier thresholds
type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

const TIER_THRESHOLDS = {
  bronze: { min: 0, max: 999 },
  silver: { min: 1000, max: 4999 },
  gold: { min: 5000, max: 9999 },
  platinum: { min: 10000, max: Infinity },
};

// Helper to determine tier based on total earned
const calculateTier = (totalEarned: number): LoyaltyTier => {
  if (totalEarned >= TIER_THRESHOLDS.platinum.min) return 'platinum';
  if (totalEarned >= TIER_THRESHOLDS.gold.min) return 'gold';
  if (totalEarned >= TIER_THRESHOLDS.silver.min) return 'silver';
  return 'bronze';
};

// Helper to check and upgrade tier
const checkAndUpgradeTier = async (userId: string): Promise<void> => {
  const User = (await import('../models/user.model')).default;
  const user = await User.findById(userId);
  if (!user) return;

  const currentTier = user.loyaltySystem?.tier || 'bronze';
  const totalEarned = user.loyaltySystem?.totalEarned || 0;
  const newTier = calculateTier(totalEarned);

  // Only upgrade, never downgrade
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
  if (tierOrder.indexOf(newTier) > tierOrder.indexOf(currentTier)) {
    user.loyaltySystem = user.loyaltySystem || {};
    user.loyaltySystem.tier = newTier;
    await user.save();
  }
};

const loyaltyProcessor = async (job: Job<LoyaltyJobData>) => {
  const { userId, action, metadata } = job.data;

  logger.info(`Processing loyalty job: ${job.id}`, {
    jobId: job.id,
    action,
    userId,
    stage: 'LOYALTY_JOB_STARTED',
  });

  try {
    const User = (await import('../models/user.model')).default;
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    switch (action) {
      case 'award_signup_bonus': {
        const SIGNUP_BONUS = 100;
        user.loyaltySystem = user.loyaltySystem || { coins: 0, totalEarned: 0, tier: 'bronze', points: 0, benefits: [] };
        user.loyaltySystem.coins += SIGNUP_BONUS;
        user.loyaltySystem.totalEarned += SIGNUP_BONUS;
        user.loyaltySystem.tier = calculateTier(user.loyaltySystem.totalEarned);
        await user.save();
        break;
      }

      case 'award_booking_points': {
        const amount = (metadata?.amount as number) || 0;
        const POINTS_PER_AED = 0.1; // 1 point per 10 AED
        const points = Math.floor(amount * POINTS_PER_AED);
        user.loyaltySystem = user.loyaltySystem || { coins: 0, totalEarned: 0, tier: 'bronze', points: 0, benefits: [] };
        user.loyaltySystem.coins += points;
        user.loyaltySystem.totalEarned += points;
        user.loyaltySystem.tier = calculateTier(user.loyaltySystem.totalEarned);
        await user.save();
        await checkAndUpgradeTier(userId);
        break;
      }

      case 'award_review_bonus': {
        const REVIEW_BONUS = 50;
        user.loyaltySystem = user.loyaltySystem || { coins: 0, totalEarned: 0, tier: 'bronze', points: 0, benefits: [] };
        user.loyaltySystem.coins += REVIEW_BONUS;
        user.loyaltySystem.totalEarned += REVIEW_BONUS;
        user.loyaltySystem.tier = calculateTier(user.loyaltySystem.totalEarned);
        await user.save();
        await checkAndUpgradeTier(userId);
        break;
      }

      case 'check_tier_upgrade':
        await checkAndUpgradeTier(userId);
        break;

      default:
        logger.warn(`Unknown loyalty action: ${action}`, { jobId: job.id });
    }

    logger.info(`Loyalty job completed: ${job.id}`, {
      jobId: job.id,
      action,
      stage: 'LOYALTY_JOB_COMPLETED',
    });

    return { success: true };
  } catch (error) {
    logger.error(`Loyalty job failed: ${job.id}`, {
      jobId: job.id,
      action,
      error: (error as Error).message,
      stage: 'LOYALTY_JOB_FAILED',
    });
    throw error;
  }
};

// ============================================
// Worker Registry
// ============================================

interface WorkerInstance {
  worker: Worker;
  name: string;
}

const workers: WorkerInstance[] = [];

// Initialize all workers
export const initializeWorkers = (): void => {
  if (!isRedisConfigured()) {
    logger.warn('Workers not initialized - Redis not configured', {
      action: 'WORKERS_DISABLED',
    });
    return;
  }

  logger.info('Initializing queue workers...', {
    action: 'WORKERS_INITIALIZING',
  });

  // Email Worker
  const emailWorker = new Worker(QUEUE_NAMES.EMAIL, emailProcessor, {
    ...workerOptions,
    concurrency: 5,
  });

  emailWorker.on('completed', (job) => {
    logger.debug(`Email job ${job.id} completed`, {
      jobId: job.id,
      action: 'EMAIL_WORKER_JOB_COMPLETED',
    });
  });

  emailWorker.on('failed', (job, err) => {
    logger.error(`Email job ${job?.id} failed`, {
      jobId: job?.id,
      error: err.message,
      action: 'EMAIL_WORKER_JOB_FAILED',
    });
  });

  workers.push({ worker: emailWorker, name: QUEUE_NAMES.EMAIL });

  // Notification Worker
  const notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATION, notificationProcessor, {
    ...workerOptions,
    concurrency: 10,
  });

  notificationWorker.on('completed', (job) => {
    logger.debug(`Notification job ${job.id} completed`);
  });

  notificationWorker.on('failed', (job, err) => {
    logger.error(`Notification job ${job?.id} failed`, {
      error: err.message,
    });
  });

  workers.push({ worker: notificationWorker, name: QUEUE_NAMES.NOTIFICATION });

  // Loyalty Worker
  const loyaltyWorker = new Worker(QUEUE_NAMES.LOYALTY, loyaltyProcessor, {
    ...workerOptions,
    concurrency: 5,
  });

  loyaltyWorker.on('completed', (job) => {
    logger.debug(`Loyalty job ${job.id} completed`);
  });

  loyaltyWorker.on('failed', (job, err) => {
    logger.error(`Loyalty job ${job?.id} failed`, {
      error: err.message,
    });
  });

  workers.push({ worker: loyaltyWorker, name: QUEUE_NAMES.LOYALTY });

  logger.info('Queue workers initialized', {
    count: workers.length,
    action: 'WORKERS_INITIALIZED',
  });
};

// Graceful shutdown
export const shutdownWorkers = async (): Promise<void> => {
  logger.info('Shutting down queue workers...', {
    action: 'WORKERS_SHUTTING_DOWN',
  });

  const shutdownPromises = workers.map(({ worker, name }) =>
    worker.close().then(() => {
      logger.info(`Worker closed: ${name}`, {
        worker: name,
        action: 'WORKER_CLOSED',
      });
    }).catch((error) => {
      logger.error(`Failed to close worker ${name}`, {
        worker: name,
        error: error.message,
      });
    })
  );

  await Promise.allSettled(shutdownPromises);

  logger.info('All queue workers shut down', {
    action: 'WORKERS_SHUTDOWN_COMPLETE',
  });
};

// Get worker status
export const getWorkerStatus = (): Array<{ name: string; status: string }> => {
  return workers.map(({ name, worker }) => ({
    name,
    status: worker.isRunning() ? 'running' : 'stopped',
  }));
};

export default {
  initializeWorkers,
  shutdownWorkers,
  getWorkerStatus,
};
