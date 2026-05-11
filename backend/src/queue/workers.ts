import { Worker, Job } from 'bullmq';
import { queueRedis } from '../config/redis';
import logger from '../utils/logger';
import emailService from '../services/email.service';
import { QUEUE_NAMES } from './index';

// Email job data interface
interface EmailJobData {
  to: string;
  type: string;
  metadata?: Record<string, unknown>;
}

// Create email worker
const createEmailWorker = (): Worker => {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
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

          case 'booking_rejected':
            await emailService.sendBookingRejectedEmail(to, firstName, bookingDetails);
            break;

          case 'booking_completed':
            await emailService.sendBookingCompletedEmail(to, firstName, bookingDetails);
            break;

          case 'booking_request':
            await emailService.sendBookingRequestEmail(to, firstName, bookingDetails);
            break;

          case 'new_booking_request':
            await emailService.sendNewBookingRequestEmail(to, firstName, bookingDetails);
            break;

          case 'booking_reminder':
            await emailService.sendBookingReminderEmail(to, firstName, bookingDetails);
            break;

          case 'verification':
            await emailService.sendVerificationEmail(to, firstName, (metadata?.token as string) || '');
            break;

          case 'password_reset':
            await emailService.sendPasswordResetEmail(to, firstName, (metadata?.token as string) || '');
            break;

          case 'welcome':
            await emailService.sendWelcomeEmail(to, firstName, (metadata?.role as string) || 'User');
            break;

          case 'loyalty_points':
            await emailService.sendLoyaltyPointsEmail(
              to,
              firstName,
              (metadata?.pointsEarned as number) || 0,
              (metadata?.totalPoints as number) || 0,
              (metadata?.reason as string) || 'Points earned'
            );
            break;

          default:
            logger.warn(`Unknown email type: ${type}`);
            break;
        }

        logger.info(`Email job completed: ${job.id}`, {
          jobId: job.id,
          type,
          to,
          action: 'EMAIL_JOB_COMPLETED',
        });

        return { success: true, to, type };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Email job failed: ${job.id}`, {
          jobId: job.id,
          type,
          to,
          error: errorMessage,
          action: 'EMAIL_JOB_FAILED',
        });

        throw error;
      }
    },
    {
      connection: queueRedis,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Email worker job completed: ${job.id}`, {
      jobId: job.id,
      action: 'WORKER_JOB_COMPLETED',
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Email worker job failed: ${job?.id}`, {
      jobId: job?.id,
      error: err.message,
      action: 'WORKER_JOB_FAILED',
    });
  });

  worker.on('error', (err) => {
    logger.error('Email worker error', {
      error: err.message,
      action: 'WORKER_ERROR',
    });
  });

  return worker;
};

// Notification job data interface
interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// Create notification worker
const createNotificationWorker = (): Worker => {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<NotificationJobData>) => {
      const { userId, type, title, message, data } = job.data;

      logger.info(`Processing notification job: ${job.id}`, {
        jobId: job.id,
        userId,
        type,
        action: 'NOTIFICATION_JOB_STARTED',
      });

      try {
        const { getSocketServer } = await import('../socket');
        const socketServer = getSocketServer();

        if (socketServer) {
          socketServer.emitNotification({
            id: job.id || `notif-${Date.now()}`,
            type: type as any,
            title,
            message,
            data,
            userId,
            timestamp: new Date(),
            read: false,
          });
        }

        logger.info(`Notification job completed: ${job.id}`, {
          jobId: job.id,
          userId,
          type,
          action: 'NOTIFICATION_JOB_COMPLETED',
        });

        return { success: true, userId, type };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Notification job failed: ${job.id}`, {
          jobId: job?.id,
          userId,
          error: errorMessage,
          action: 'NOTIFICATION_JOB_FAILED',
        });

        throw error;
      }
    },
    {
      connection: queueRedis,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Notification worker job completed: ${job.id}`, {
      jobId: job.id,
      action: 'WORKER_JOB_COMPLETED',
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Notification worker job failed: ${job?.id}`, {
      jobId: job?.id,
      error: err.message,
      action: 'WORKER_JOB_FAILED',
    });
  });

  return worker;
};

// Export workers
export const emailWorker = createEmailWorker();
export const notificationWorker = createNotificationWorker();

// Close all workers
export const closeAllWorkers = async (): Promise<void> => {
  logger.info('Closing queue workers...');

  await Promise.all([
    emailWorker.close(),
    notificationWorker.close(),
  ]);

  logger.info('All queue workers closed');
};

export default {
  emailWorker,
  notificationWorker,
  closeAllWorkers,
};
