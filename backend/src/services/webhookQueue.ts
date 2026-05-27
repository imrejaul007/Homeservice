import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import Stripe from 'stripe';
import { queueRedis, isRedisAvailable } from '../config/redis';
import logger, { paymentLogger } from '../utils/logger';
import { handleWebhookEvent } from './payment.service';

/**
 * Webhook retry job data structure
 */
interface WebhookRetryJob {
  eventId: string;
  eventType: string;
  payload: Stripe.Event;
  attempts: number;
  originalTimestamp: number;
}

/**
 * Queue name constant
 */
const WEBHOOK_RETRY_QUEUE = 'webhook-retry';

/**
 * Check if BullMQ/Redis is available for queue operations
 */
const isQueueAvailable = (): boolean => {
  return isRedisAvailable() && queueRedis !== null;
};

/**
 * Get Redis connection options for BullMQ
 * Handles version mismatch between ioredis packages
 */
const getRedisConnection = (): ConnectionOptions | null => {
  if (!isQueueAvailable() || !queueRedis) {
    return null;
  }
  // Cast to any to handle ioredis version mismatch between packages
  return queueRedis as unknown as ConnectionOptions;
};

/**
 * Create the webhook retry queue
 * Uses the existing queueRedis connection from config
 */
let webhookRetryQueue: Queue<WebhookRetryJob> | null = null;

const getWebhookRetryQueue = (): Queue<WebhookRetryJob> | null => {
  if (!isQueueAvailable()) {
    return null;
  }

  if (!webhookRetryQueue) {
    const connection = getRedisConnection();
    if (!connection) {
      return null;
    }

    webhookRetryQueue = new Queue<WebhookRetryJob>(WEBHOOK_RETRY_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000, // Start at 1 second, then 2s, 4s, 8s, 16s
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs for debugging
        },
      },
    });

    logger.info('Webhook retry queue initialized', {
      queue: WEBHOOK_RETRY_QUEUE,
      action: 'QUEUE_CREATED',
    });
  }

  return webhookRetryQueue;
};

/**
 * Start the webhook retry worker
 * This worker processes jobs from the retry queue
 */
let webhookWorker: Worker<WebhookRetryJob> | null = null;

export const startWebhookWorker = (): Worker<WebhookRetryJob> | null => {
  if (!isQueueAvailable()) {
    logger.warn('Cannot start webhook worker: Redis queue not available', {
      action: 'WORKER_NOT_STARTED',
    });
    return null;
  }

  if (webhookWorker) {
    logger.warn('Webhook worker already running', {
      action: 'WORKER_ALREADY_RUNNING',
    });
    return webhookWorker;
  }

  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  webhookWorker = new Worker<WebhookRetryJob>(
    WEBHOOK_RETRY_QUEUE,
    async (job: Job<WebhookRetryJob>) => {
      const { eventId, eventType, payload, attempts } = job.data;

      paymentLogger.info(`Processing webhook retry`, {
        eventId,
        eventType,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts || 5,
      });

      try {
        // Process the webhook event
        const result = await handleWebhookEvent(payload);

        paymentLogger.info(`Webhook retry succeeded`, {
          eventId,
          eventType,
          attempt: job.attemptsMade + 1,
          result: result.message,
        });

        return result;
      } catch (error: any) {
        paymentLogger.warn(`Webhook retry failed, will retry`, {
          eventId,
          eventType,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts || 5,
          error: error.message,
        });

        // Re-throw to trigger BullMQ retry
        throw error;
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 webhooks concurrently
      limiter: {
        max: 100, // Max 100 jobs per second
        duration: 1000,
      },
    }
  );

  // Worker event handlers
  webhookWorker.on('completed', (job: Job<WebhookRetryJob>) => {
    paymentLogger.info('Webhook job completed', {
      jobId: job.id,
      eventId: job.data.eventId,
      eventType: job.data.eventType,
      attempts: job.attemptsMade,
    });
  });

  webhookWorker.on('failed', (job: Job<WebhookRetryJob> | undefined, error: Error) => {
    if (job) {
      paymentLogger.error('Webhook job failed permanently', {
        jobId: job.id,
        eventId: job.data.eventId,
        eventType: job.data.eventType,
        attempts: job.attemptsMade,
        error: error.message,
      });
    } else {
      paymentLogger.error('Webhook job failed (unknown job)', {
        error: error.message,
      });
    }
  });

  webhookWorker.on('error', (error: Error) => {
    logger.error('Webhook worker error', {
      error: error.message,
      action: 'WORKER_ERROR',
    });
  });

  logger.info('Webhook retry worker started', {
    queue: WEBHOOK_RETRY_QUEUE,
    concurrency: 5,
    action: 'WORKER_STARTED',
  });

  return webhookWorker;
};

/**
 * Schedule a webhook event for retry
 * @param eventId - Stripe event ID for idempotency
 * @param eventType - Stripe event type
 * @param payload - The full Stripe event object
 * @param delay - Optional initial delay in ms (default: 1000ms)
 */
export const scheduleWebhookRetry = async (
  eventId: string,
  eventType: string,
  payload: Stripe.Event,
  delay: number = 1000
): Promise<string | null> => {
  const queue = getWebhookRetryQueue();

  if (!queue) {
    logger.error('Cannot schedule webhook retry: queue not available', {
      eventId,
      eventType,
      action: 'QUEUE_NOT_AVAILABLE',
    });
    return null;
  }

  try {
    // Use eventId as job ID for idempotency (prevents duplicate retries)
    const job = await queue.add(
      'retry',
      {
        eventId,
        eventType,
        payload,
        attempts: 0,
        originalTimestamp: Date.now(),
      },
      {
        jobId: `webhook-${eventId}`, // Unique job ID per event
        delay, // Initial delay before first retry
      }
    );

    paymentLogger.info('Webhook scheduled for retry', {
      eventId,
      eventType,
      jobId: job.id ?? 'unknown',
      delay,
      action: 'RETRY_SCHEDULED',
    });

    return job.id ?? null;
  } catch (error: any) {
    // Handle duplicate job ID gracefully (event already queued)
    if (error.message && error.message.includes('already exists')) {
      logger.warn('Webhook retry already scheduled', {
        eventId,
        eventType,
        action: 'DUPLICATE_RETRY_IGNORED',
      });
      return null;
    }

    logger.error('Failed to schedule webhook retry', {
      eventId,
      eventType,
      error: error.message,
      action: 'SCHEDULE_FAILED',
    });
    return null;
  }
};

/**
 * Get the retry queue instance
 */
export const getQueue = getWebhookRetryQueue;

/**
 * Check if an event is already in the retry queue
 */
export const isEventInQueue = async (eventId: string): Promise<boolean> => {
  const queue = getWebhookRetryQueue();
  if (!queue) return false;

  const job = await queue.getJob(`webhook-${eventId}`);
  return job !== null;
};

/**
 * Get retry queue stats
 */
export const getQueueStats = async (): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> => {
  const queue = getWebhookRetryQueue();
  if (!queue) return null;

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  } catch (error: any) {
    logger.error('Failed to get queue stats', {
      error: error.message,
    });
    return null;
  }
};

/**
 * Gracefully shutdown the worker and queue
 */
export const shutdownWebhookQueue = async (): Promise<void> => {
  const shutdownOperations: Promise<void>[] = [];

  if (webhookWorker) {
    shutdownOperations.push(
      webhookWorker.close().then(() => {
        logger.info('Webhook worker closed', { action: 'WORKER_CLOSED' });
      })
    );
    webhookWorker = null;
  }

  if (webhookRetryQueue) {
    shutdownOperations.push(
      webhookRetryQueue.close().then(() => {
        logger.info('Webhook retry queue closed', { action: 'QUEUE_CLOSED' });
      })
    );
    webhookRetryQueue = null;
  }

  await Promise.all(shutdownOperations);
};

export default {
  scheduleWebhookRetry,
  startWebhookWorker,
  getQueue,
  isEventInQueue,
  getQueueStats,
  shutdownWebhookQueue,
};
