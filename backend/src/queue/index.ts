import { Queue, Job } from 'bullmq';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load env first
dotenv.config({ path: path.join(__dirname, '../../.env') });

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
  }
): Promise<Job | null> => {
  if (!queuesEnabled) {
    logger.debug(`Job ${jobName} not added - queues disabled`);
    return null;
  }

  const queue = getQueue(queueName);
  if (!queue) return null;

  try {
    const job = await queue.add(jobName, data, {
      priority: options?.priority,
      delay: options?.delay,
    });

    logger.debug(`Job added to ${queueName}: ${jobName}`, {
      queue: queueName,
      job: jobName,
      jobId: job.id,
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

export default {
  createQueue,
  getQueue,
  addJob,
  addBulkJob,
  getQueueStats,
  closeAllQueues,
  areQueuesEnabled,
  QUEUE_NAMES,
};
