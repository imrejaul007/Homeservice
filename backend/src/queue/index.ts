import { Queue, Job } from 'bullmq';
import mongoose, { Schema, Document } from 'mongoose';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load env first
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ============================================
// Failed Jobs Collection (MongoDB)
// ============================================

interface IFailedJob extends Document {
  jobId: string;
  queue: string;
  name: string;
  data: Record<string, unknown>;
  error: string;
  failedAt: Date;
  attemptCount: number;
}

const failedJobSchema = new Schema<IFailedJob>({
  jobId: { type: String, required: true, index: true },
  queue: { type: String, required: true, index: true },
  name: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  error: { type: String, required: true },
  failedAt: { type: Date, default: Date.now, index: true },
  attemptCount: { type: Number, default: 0 },
});

// Compound index for efficient failed job queries
failedJobSchema.index({ queue: 1, failedAt: -1 });

let FailedJob: mongoose.Model<IFailedJob> | null = null;

// Initialize failed job model lazily to avoid connection issues during module load
const getFailedJobModel = async (): Promise<mongoose.Model<IFailedJob>> => {
  if (!FailedJob) {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      const { default: database } = await import('../config/database');
      await database.connect();
    }
    FailedJob = mongoose.model<IFailedJob>('FailedJob', failedJobSchema);
  }
  return FailedJob;
};

// Queue names
export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
  ANALYTICS: 'analytics-queue',
  SEARCH_INDEX: 'search-index-queue',
  WEBHOOK: 'webhook-queue',
  CLEANUP: 'cleanup-queue',
  LOYALTY: 'loyalty-queue',
} as const;

// Check if Redis is configured for queues
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

// Queue connection config - use URL for BullMQ v5
const queueConnection = {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  maxRetriesPerRequest: null,
};

// Queue instances
const queues: Record<string, Queue> = {};
let queuesEnabled = false;

// Initialize queues only if Redis is configured
const initializeQueues = (): boolean => {
  if (!isRedisConfigured()) {
    logger.warn('Redis not configured for queues. Job queue is disabled.', {
      action: 'QUEUE_DISABLED',
    });
    return false;
  }

  queuesEnabled = true;
  return true;
};

// Initialize on module load
initializeQueues();

// Create a queue
export const createQueue = (name: string): Queue | null => {
  if (!queuesEnabled) {
    logger.debug(`Queue ${name} not created - Redis not available`);
    return null;
  }

  if (queues[name]) {
    return queues[name];
  }

  try {
    const queue = new Queue(name, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 60 * 60,
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 60 * 60,
        },
      },
    });

    queues[name] = queue;

    logger.info(`Queue created: ${name}`, {
      queue: name,
      action: 'QUEUE_CREATED',
    });

    return queue;
  } catch (error) {
    logger.error(`Failed to create queue ${name}`, {
      queue: name,
      error: (error as Error).message,
    });
    return null;
  }
};

// Get a queue
export const getQueue = (name: string): Queue | null => {
  if (!queuesEnabled) return null;
  return queues[name] || createQueue(name);
};

// Add job to queue
export const addJob = async <T = unknown>(
  queueName: string,
  jobName: string,
  data: T,
  options?: {
    priority?: number;
    delay?: number;
    repeats?: number;
    deduplicationKey?: string;
  }
): Promise<Job | null> => {
  if (!queuesEnabled) {
    logger.debug(`Job ${jobName} not added - queues disabled`);
    return null;
  }

  const queue = getQueue(queueName);
  if (!queue) return null;

  try {
    const jobOptions: Record<string, unknown> = {
      priority: options?.priority,
      delay: options?.delay,
    };

    // Add deduplication if key provided - prevents duplicate jobs in the queue
    if (options?.deduplicationKey) {
      jobOptions.jobId = `${queueName}:${options.deduplicationKey}`;
    }

    const job = await queue.add(jobName, data, jobOptions);

    logger.debug(`Job added to ${queueName}: ${jobName}`, {
      queue: queueName,
      job: jobName,
      jobId: job.id,
      deduplicated: !!options?.deduplicationKey,
    });

    return job;
  } catch (error) {
    logger.error(`Failed to add job ${jobName} to ${queueName}`, {
      queue: queueName,
      job: jobName,
      error: (error as Error).message,
    });
    return null;
  }
};

// Add multiple jobs
export const addBulkJob = async <T = unknown>(
  queueName: string,
  jobs: Array<{
    name: string;
    data: T;
    options?: {
      priority?: number;
      delay?: number;
    };
  }>
): Promise<Job[]> => {
  if (!queuesEnabled) {
    return [];
  }

  const queue = getQueue(queueName);
  if (!queue) return [];

  try {
    const bulkJobs = jobs.map((job) => ({
      name: job.name,
      data: job.data,
      opts: {
        priority: job.options?.priority,
        delay: job.options?.delay,
      },
    }));

    const added = await queue.addBulk(bulkJobs);

    logger.debug(`Bulk jobs added to ${queueName}`, {
      queue: queueName,
      count: added.length,
    });

    return added;
  } catch (error) {
    logger.error(`Failed to add bulk jobs to ${queueName}`, {
      queue: queueName,
      error: (error as Error).message,
    });
    return [];
  }
};

// Get queue stats
export const getQueueStats = async (
  queueName: string
): Promise<{ waiting: number; active: number; completed: number; failed: number } | null> => {
  if (!queuesEnabled) return null;

  const queue = getQueue(queueName);
  if (!queue) return null;

  try {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  } catch (error) {
    logger.error(`Failed to get queue stats for ${queueName}`, {
      queue: queueName,
      error: (error as Error).message,
    });
    return null;
  }
};

// Close all queues gracefully
export const closeAllQueues = async (): Promise<void> => {
  const closePromises = Object.values(queues).map((queue) =>
    queue.close().catch((error) => {
      logger.error('Error closing queue', { error: error.message });
    })
  );

  await Promise.all(closePromises);
  logger.info('All queues closed', { action: 'QUEUES_CLOSED' });
};

// Check if queues are enabled
export const areQueuesEnabled = (): boolean => queuesEnabled;

// ============================================
// Failed Jobs Management
// ============================================

/**
 * Store a failed job for later retry
 */
export const storeFailedJob = async (
  jobId: string,
  queue: string,
  name: string,
  data: unknown,
  error: string,
  attemptCount: number = 0
): Promise<IFailedJob | null> => {
  try {
    const FailedJobModel = await getFailedJobModel();

    const failedJob = new FailedJobModel({
      jobId,
      queue,
      name,
      data,
      error,
      failedAt: new Date(),
      attemptCount,
    });

    await failedJob.save();

    logger.info('Failed job stored', {
      jobId,
      queue,
      name,
      attemptCount,
      action: 'FAILED_JOB_STORED',
    });

    return failedJob;
  } catch (error) {
    logger.error('Failed to store failed job', {
      jobId,
      queue,
      error: (error as Error).message,
    });
    return null;
  }
};

/**
 * Get failed jobs with optional filtering
 */
export const getFailedJobs = async (options?: {
  queue?: string;
  limit?: number;
  offset?: number;
}): Promise<IFailedJob[]> => {
  try {
    const FailedJobModel = await getFailedJobModel();

    const query: Record<string, unknown> = {};
    if (options?.queue) {
      query.queue = options.queue;
    }

    let queryBuilder = FailedJobModel.find(query).sort({ failedAt: -1 });

    if (options?.offset) {
      queryBuilder = queryBuilder.skip(options.offset);
    }

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    return await queryBuilder;
  } catch (error) {
    logger.error('Failed to get failed jobs', {
      error: (error as Error).message,
    });
    return [];
  }
};

/**
 * Retry a specific failed job by re-queueing it
 */
export const retryFailedJob = async (failedJobId: string): Promise<boolean> => {
  try {
    const FailedJobModel = await getFailedJobModel();

    const failedJob = await FailedJobModel.findById(failedJobId);
    if (!failedJob) {
      logger.warn('Failed job not found for retry', { failedJobId });
      return false;
    }

    // Re-queue the job
    const job = await addJob(failedJob.queue, failedJob.name, failedJob.data);

    if (job) {
      // Remove from failed jobs collection after successful re-queue
      await FailedJobModel.deleteOne({ _id: failedJobId });

      logger.info('Failed job re-queued', {
        originalJobId: failedJob.jobId,
        newJobId: job.id,
        queue: failedJob.queue,
        name: failedJob.name,
        action: 'FAILED_JOB_RETRY_SUCCESS',
      });

      return true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to retry failed job', {
      failedJobId,
      error: (error as Error).message,
    });
    return false;
  }
};

/**
 * Retry all failed jobs for a specific queue
 */
export const retryAllFailedJobs = async (queueName?: string): Promise<{ total: number; retried: number; failed: number }> => {
  try {
    const FailedJobModel = await getFailedJobModel();

    const query: Record<string, unknown> = {};
    if (queueName) {
      query.queue = queueName;
    }

    const failedJobs = await FailedJobModel.find(query);
    let retried = 0;
    let failed = 0;

    for (const failedJob of failedJobs) {
      const success = await retryFailedJob(failedJob._id.toString());
      if (success) {
        retried++;
      } else {
        failed++;
      }
    }

    logger.info('Bulk retry of failed jobs completed', {
      queue: queueName || 'all',
      total: failedJobs.length,
      retried,
      failed,
    });

    return { total: failedJobs.length, retried, failed };
  } catch (error) {
    logger.error('Failed to retry all failed jobs', {
      queue: queueName,
      error: (error as Error).message,
    });
    return { total: 0, retried: 0, failed: 0 };
  }
};

/**
 * Delete a failed job record
 */
export const deleteFailedJob = async (failedJobId: string): Promise<boolean> => {
  try {
    const FailedJobModel = await getFailedJobModel();
    const result = await FailedJobModel.deleteOne({ _id: failedJobId });
    return result.deletedCount > 0;
  } catch (error) {
    logger.error('Failed to delete failed job', {
      failedJobId,
      error: (error as Error).message,
    });
    return false;
  }
};

/**
 * Clear all failed jobs
 */
export const clearFailedJobs = async (queueName?: string): Promise<number> => {
  try {
    const FailedJobModel = await getFailedJobModel();

    const query: Record<string, unknown> = {};
    if (queueName) {
      query.queue = queueName;
    }

    const result = await FailedJobModel.deleteMany(query);

    logger.info('Failed jobs cleared', {
      queue: queueName || 'all',
      count: result.deletedCount,
      action: 'FAILED_JOBS_CLEARED',
    });

    return result.deletedCount;
  } catch (error) {
    logger.error('Failed to clear failed jobs', {
      queue: queueName,
      error: (error as Error).message,
    });
    return 0;
  }
};

/**
 * Get count of failed jobs
 */
export const getFailedJobCount = async (queueName?: string): Promise<number> => {
  try {
    const FailedJobModel = await getFailedJobModel();

    const query: Record<string, unknown> = {};
    if (queueName) {
      query.queue = queueName;
    }

    return await FailedJobModel.countDocuments(query);
  } catch (error) {
    logger.error('Failed to get failed job count', {
      queue: queueName,
      error: (error as Error).message,
    });
    return 0;
  }
};

export default {
  createQueue,
  getQueue,
  addJob,
  addBulkJob,
  getQueueStats,
  closeAllQueues,
  areQueuesEnabled,
  QUEUE_NAMES,
  // Failed jobs
  storeFailedJob,
  getFailedJobs,
  retryFailedJob,
  retryAllFailedJobs,
  deleteFailedJob,
  clearFailedJobs,
  getFailedJobCount,
};
