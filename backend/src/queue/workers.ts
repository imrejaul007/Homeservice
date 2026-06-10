import { Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import emailService from '../services/email.service';
import { QUEUE_NAMES, areQueuesEnabled, getQueue, storeFailedJob } from './index';
import { queueResilience } from '../services/queueResilience.service';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import User from '../models/user.model';
import { REFERRAL_REWARDS } from '../config/constants';
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
  const startTime = Date.now();

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

      case 'contact_acknowledgement':
      case 'contact_team_notification':
        await emailService.sendEmail(
          to,
          (metadata?.subject as string) || 'NILIN Support',
          (metadata?.html as string) || '',
          metadata?.text as string | undefined
        );
        break;

      default:
        logger.warn(`Unknown email type: ${type}`, {
          type,
          action: 'UNKNOWN_EMAIL_TYPE',
        });
    }

    // Record processing time for monitoring
    const processingTime = Date.now() - startTime;
    queueResilience.recordProcessingTime(QUEUE_NAMES.EMAIL, processingTime);

    logger.info(`Email job completed: ${job.id}`, {
      jobId: job.id,
      type,
      processingTime,
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
  const startTime = Date.now();

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

    // Record processing time for monitoring
    const processingTime = Date.now() - startTime;
    queueResilience.recordProcessingTime(QUEUE_NAMES.NOTIFICATION, processingTime);

    logger.info(`Notification job completed: ${job.id}`, {
      jobId: job.id,
      processingTime,
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
  const { userId } = job.data;
  // Producers pass action as job name; normalize metadata from top-level fields
  const action = job.data.action || job.name;
  const metadata: Record<string, unknown> = {
    ...(job.data.metadata || {}),
    ...('amount' in job.data ? { amount: (job.data as any).amount } : {}),
    ...('relatedBooking' in job.data ? { relatedBooking: (job.data as any).relatedBooking } : {}),
    ...('description' in job.data ? { description: (job.data as any).description } : {}),
  };
  const startTime = Date.now();

  logger.info(`Processing loyalty job: ${job.id}`, {
    jobId: job.id,
    action,
    userId,
    stage: 'LOYALTY_JOB_STARTED',
  });

  // Actions that award coins need transaction and idempotency tracking
  const coinAwardActions = ['award_signup_bonus', 'award_booking_points', 'award_review_bonus', 'award_first_booking_bonus'];
  const needsTransaction = coinAwardActions.includes(action);

  try {
    const User = (await import('../models/user.model')).default;

    // For coin award actions, use transaction to prevent race conditions
    if (needsTransaction && mongoose.connection.readyState === 1) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        const user = await User.findById(userId).session(session);
        if (!user) {
          throw ApiError.notFound(`User not found: ${userId}`, ERROR_CODES.USER_NOT_FOUND);
        }

        // Initialize processedJobIds array if it doesn't exist (for existing users)
        if (!user.loyaltySystem.processedJobIds) {
          user.loyaltySystem.processedJobIds = [];
        }

        // Idempotency check: skip if this job was already processed
        if (job.id && user.loyaltySystem.processedJobIds.includes(job.id)) {
          await session.abortTransaction();
          logger.info(`Loyalty job already processed, skipping: ${job.id}`, {
            jobId: job.id,
            action,
            userId,
            stage: 'LOYALTY_JOB_SKIPPED_DUPLICATE',
          });
          return { success: true, skipped: true, reason: 'already_processed' };
        }

        await processLoyaltyAction(user, action, metadata, job.id);

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      // Fallback for non-transactional actions or when MongoDB is unavailable
      const user = await User.findById(userId);
      if (!user) {
        throw ApiError.notFound(`User not found: ${userId}`, ERROR_CODES.USER_NOT_FOUND);
      }

      // Initialize processedJobIds array if it doesn't exist (for existing users)
      if (!user.loyaltySystem.processedJobIds) {
        user.loyaltySystem.processedJobIds = [];
      }

      // Idempotency check: skip if this job was already processed
      if (job.id && user.loyaltySystem.processedJobIds.includes(job.id)) {
        logger.info(`Loyalty job already processed, skipping: ${job.id}`, {
          jobId: job.id,
          action,
          userId,
          stage: 'LOYALTY_JOB_SKIPPED_DUPLICATE',
        });
        return { success: true, skipped: true, reason: 'already_processed' };
      }

      await processLoyaltyAction(user, action, metadata, job.id);
    }

    // Record processing time for monitoring
    const processingTime = Date.now() - startTime;
    queueResilience.recordProcessingTime(QUEUE_NAMES.LOYALTY, processingTime);

    logger.info(`Loyalty job completed: ${job.id}`, {
      jobId: job.id,
      action,
      processingTime,
      needsIdempotency: needsTransaction,
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

    // Store failed job in the FailedJob collection for later retry
    await storeFailedJob(
      job.id || 'unknown',
      QUEUE_NAMES.LOYALTY,
      `loyalty:${action}`,
      job.data,
      (error as Error).message,
      job.attemptsMade || 0
    );

    throw error;
  }
};

const MAX_PROCESSED_JOB_IDS = 500;

function trackProcessedJobId(loyaltySystem: { processedJobIds?: string[] }, jobId: string | undefined): void {
  if (!jobId) return;
  loyaltySystem.processedJobIds = loyaltySystem.processedJobIds || [];
  loyaltySystem.processedJobIds.push(jobId);
  if (loyaltySystem.processedJobIds.length > MAX_PROCESSED_JOB_IDS) {
    loyaltySystem.processedJobIds = loyaltySystem.processedJobIds.slice(-MAX_PROCESSED_JOB_IDS);
  }
}

/**
 * Process a loyalty action (helper function to avoid code duplication in transaction)
 */
async function processLoyaltyAction(user: any, action: string, metadata: any, jobId: string | undefined): Promise<void> {
  switch (action) {
    case 'award_signup_bonus': {
      const SIGNUP_BONUS = 100;
      user.loyaltySystem = user.loyaltySystem || {
        coins: 0,
        totalEarned: 0,
        tier: 'bronze',
        points: 0,
        benefits: [],
        processedJobIds: []
      };
      user.loyaltySystem.coins += SIGNUP_BONUS;
      user.loyaltySystem.totalEarned += SIGNUP_BONUS;
      user.loyaltySystem.tier = calculateTier(user.loyaltySystem.totalEarned);
      trackProcessedJobId(user.loyaltySystem, jobId);
      await user.save();
      await checkAndUpgradeTier(user._id.toString());
      break;
    }

    case 'award_booking_points': {
      // Producers pass pre-computed points (floor(bookingAmount / 10)) as amount
      const basePoints = (metadata?.amount as number) || 0;

      // Tier multipliers for booking points
      const TIER_MULTIPLIERS: Record<string, number> = {
        bronze: 1,
        silver: 1.5,
        gold: 2,
        platinum: 3
      };

      // Get user's current tier before updating
      const currentTier = user.loyaltySystem?.tier || 'bronze';
      const tierMultiplier = TIER_MULTIPLIERS[currentTier] || 1;

      const points = Math.floor(basePoints * tierMultiplier);
      user.loyaltySystem = user.loyaltySystem || {
        coins: 0,
        totalEarned: 0,
        tier: 'bronze',
        points: 0,
        benefits: [],
        processedJobIds: []
      };
      user.loyaltySystem.coins += points;
      user.loyaltySystem.totalEarned += points;
      user.loyaltySystem.tier = calculateTier(user.loyaltySystem.totalEarned);
      trackProcessedJobId(user.loyaltySystem, jobId);
      await user.save();
      await checkAndUpgradeTier(user._id.toString());
      break;
    }

    case 'award_review_bonus': {
      const REVIEW_BONUS = 50;
      user.loyaltySystem = user.loyaltySystem || {
        coins: 0,
        totalEarned: 0,
        tier: 'bronze',
        points: 0,
        benefits: [],
        processedJobIds: []
      };
      user.loyaltySystem.coins += REVIEW_BONUS;
      user.loyaltySystem.totalEarned += REVIEW_BONUS;
      user.loyaltySystem.tier = calculateTier(user.loyaltySystem.totalEarned);
      trackProcessedJobId(user.loyaltySystem, jobId);
      await user.save();
      await checkAndUpgradeTier(user._id.toString());
      break;
    }

    case 'award_first_booking_bonus': {
      const FIRST_BOOKING_BONUS = 100;

      // Initialize loyalty system if needed
      user.loyaltySystem = user.loyaltySystem || {
        coins: 0,
        totalEarned: 0,
        tier: 'bronze',
        points: 0,
        benefits: [],
        processedJobIds: [],
        pendingRewards: []
      };

      // Initialize pendingRewards array if needed
      if (!user.loyaltySystem.pendingRewards) {
        user.loyaltySystem.pendingRewards = [];
      }

      // Process pending rewards (welcome bonus, referral bonus)
      const pendingRewards = user.loyaltySystem.pendingRewards || [];
      let totalPendingAwarded = 0;
      const awardedRewards: string[] = [];

      for (const reward of pendingRewards) {
        if (reward.status === 'pending') {
          user.loyaltySystem.coins += reward.amount;
          user.loyaltySystem.totalEarned += reward.amount;
          reward.status = 'awarded';
          reward.awardedAt = new Date();
          totalPendingAwarded += reward.amount;
          awardedRewards.push(`${reward.type}: ${reward.amount}`);

          // Award referrer bonus if this was a referral
          if (reward.referrerId && reward.type === 'referral_bonus') {
            const referrer = await User.findById(reward.referrerId);
            if (referrer) {
              const REFERRER_BONUS = REFERRAL_REWARDS.REFERRER_REWARD;
              referrer.loyaltySystem = referrer.loyaltySystem || {
                coins: 0,
                totalEarned: 0,
                tier: 'bronze',
                points: 0,
                benefits: [],
                processedJobIds: []
              };
              referrer.loyaltySystem.coins += REFERRER_BONUS;
              referrer.loyaltySystem.totalEarned += REFERRER_BONUS;
              referrer.loyaltySystem.tier = calculateTier(referrer.loyaltySystem.totalEarned);
              await referrer.save();

              logger.info('Referrer bonus awarded for successful referral', {
                referrerId: reward.referrerId,
                refereeId: user._id.toString(),
                bonusAmount: REFERRER_BONUS,
              });
            }
          }
        }
      }

      // Award the first booking bonus as well
      if (!user.loyaltySystem.firstBookingAwarded) {
        user.loyaltySystem.coins += FIRST_BOOKING_BONUS;
        user.loyaltySystem.totalEarned += FIRST_BOOKING_BONUS;
        user.loyaltySystem.firstBookingAwarded = true;
        totalPendingAwarded += FIRST_BOOKING_BONUS;
        awardedRewards.push(`first_booking_bonus: ${FIRST_BOOKING_BONUS}`);
      }

      user.loyaltySystem.tier = calculateTier(user.loyaltySystem.totalEarned);

      trackProcessedJobId(user.loyaltySystem, jobId);
      await user.save();
      await checkAndUpgradeTier(user._id.toString());

      logger.info(`First booking rewards awarded: ${totalPendingAwarded} points`, {
        userId: user._id.toString(),
        jobId,
        bonusAmount: totalPendingAwarded,
        rewards: awardedRewards,
        stage: 'FIRST_BOOKING_REWARDS_AWARDED',
      });
      break;
    }

    case 'check_tier_upgrade':
      // Tier check doesn't award coins, no idempotency needed
      await checkAndUpgradeTier(user._id.toString());
      break;

    default:
      logger.warn(`Unknown loyalty action: ${action}`, { jobId });
  }
}

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

  emailWorker.on('failed', async (job, err) => {
    logger.error(`Email job ${job?.id} failed`, {
      jobId: job?.id,
      error: err.message,
      action: 'EMAIL_WORKER_JOB_FAILED',
    });

    // Store failed job in the FailedJob collection for later retry
    if (job) {
      await storeFailedJob(
        job.id || 'unknown',
        QUEUE_NAMES.EMAIL,
        job.name,
        job.data,
        err.message,
        job.attemptsMade || 0
      );
    }
  });

  workers.push({ worker: emailWorker, name: QUEUE_NAMES.EMAIL });

  // Register email queue with resilience service
  queueResilience.registerQueue(emailWorker as any, {
    name: QUEUE_NAMES.EMAIL,
    maxRetries: 5,
    backoffType: 'exponential',
    backoffDelay: 5000,
    maxBackoffDelay: 300000,
    alertThreshold: 100,
    criticalThreshold: 500,
  });

  // Notification Worker
  const notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATION, notificationProcessor, {
    ...workerOptions,
    concurrency: 10,
  });

  notificationWorker.on('completed', (job) => {
    logger.debug(`Notification job ${job.id} completed`);
  });

  notificationWorker.on('failed', async (job, err) => {
    logger.error(`Notification job ${job?.id} failed`, {
      jobId: job?.id,
      error: err.message,
      action: 'NOTIFICATION_WORKER_JOB_FAILED',
    });

    // Store failed job in the FailedJob collection for later retry
    if (job) {
      await storeFailedJob(
        job.id || 'unknown',
        QUEUE_NAMES.NOTIFICATION,
        job.name,
        job.data,
        err.message,
        job.attemptsMade || 0
      );
    }
  });

  workers.push({ worker: notificationWorker, name: QUEUE_NAMES.NOTIFICATION });

  // Register notification queue with resilience service
  queueResilience.registerQueue(notificationWorker as any, {
    name: QUEUE_NAMES.NOTIFICATION,
    maxRetries: 3,
    backoffType: 'exponential',
    backoffDelay: 2000,
    maxBackoffDelay: 60000,
    alertThreshold: 200,
    criticalThreshold: 1000,
  });

  // Loyalty Worker
  const loyaltyWorker = new Worker(QUEUE_NAMES.LOYALTY, loyaltyProcessor, {
    ...workerOptions,
    concurrency: 5,
  });

  loyaltyWorker.on('completed', (job) => {
    logger.debug(`Loyalty job ${job.id} completed`);
  });

  loyaltyWorker.on('failed', async (job, err) => {
    logger.error(`Loyalty job ${job?.id} failed`, {
      jobId: job?.id,
      error: err.message,
      action: 'LOYALTY_WORKER_JOB_FAILED',
    });

    // Store failed job in the FailedJob collection for later retry
    if (job) {
      await storeFailedJob(
        job.id || 'unknown',
        QUEUE_NAMES.LOYALTY,
        job.name,
        job.data,
        err.message,
        job.attemptsMade || 0
      );
    }
  });

  workers.push({ worker: loyaltyWorker, name: QUEUE_NAMES.LOYALTY });

  // Register loyalty queue with resilience service
  queueResilience.registerQueue(loyaltyWorker as any, {
    name: QUEUE_NAMES.LOYALTY,
    maxRetries: 2,
    backoffType: 'fixed',
    backoffDelay: 1000,
    maxBackoffDelay: 10000,
    alertThreshold: 50,
    criticalThreshold: 200,
  });

  logger.info('Queue workers initialized', {
    count: workers.length,
    action: 'WORKERS_INITIALIZED',
  });

  // ============================================
  // Worker Health Monitoring
  // ============================================
  // Periodic queue depth logging for monitoring
  setInterval(async () => {
    for (const queueName of Object.values(QUEUE_NAMES)) {
      const queue = getQueue(queueName);
      if (queue) {
        try {
          const jobCounts = await queue.getJobCounts();
          logger.info('Queue depth', {
            queue: queueName,
            waiting: jobCounts.waiting,
            active: jobCounts.active,
            completed: jobCounts.completed,
            failed: jobCounts.failed,
            action: 'QUEUE_DEPTH_LOG',
          });

          // Alert on high queue depth
          const alertThreshold = 100;
          const criticalThreshold = 500;
          if (jobCounts.waiting >= criticalThreshold) {
            logger.error('CRITICAL: Queue depth exceeded critical threshold', {
              queue: queueName,
              waiting: jobCounts.waiting,
              threshold: criticalThreshold,
              action: 'QUEUE_DEPTH_CRITICAL',
            });
          } else if (jobCounts.waiting >= alertThreshold) {
            logger.warn('Queue depth exceeded alert threshold', {
              queue: queueName,
              waiting: jobCounts.waiting,
              threshold: alertThreshold,
              action: 'QUEUE_DEPTH_WARNING',
            });
          }
        } catch (error) {
          logger.error(`Failed to get job counts for queue ${queueName}`, {
            queue: queueName,
            error: (error as Error).message,
          });
        }
      }
    }
  }, 60000); // Log every minute
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
