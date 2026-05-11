import { Queue, Job } from 'bullmq';
import { queueRedis } from '../config/redis';
import logger from '../utils/logger';

// Queue names
export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
  ANALYTICS: 'analytics-queue',
  SEARCH_INDEX: 'search-index-queue',
  WEBHOOK: 'webhook-queue',
  CLEANUP: 'cleanup-queue',
} as const;

// Queue instances
const queues: Record<string, Queue> = {};

// Create a queue
export const createQueue = (name: string): Queue => {
  if (queues[name]) {
    return queues[name];
  }

  const queue = new Queue(name, {
    connection: queueRedis,
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
};

// Get a queue
export const getQueue = (name: string): Queue => {
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
): Promise<Job> => {
  const queue = getQueue(queueName);

  const job = await queue.add(jobName, data, {
    priority: options?.priority,
    delay: options?.delay,
  });

  logger.info(`Job added to queue: ${queueName}/${jobName}`, {
    queue: queueName,
    jobName,
    jobId: job.id,
    action: 'JOB_ADDED',
  });

  return job;
};

// Get queue statistics
export const getQueueStats = async (queueName: string): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> => {
  const queue = getQueue(queueName);

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
};

// Close all queues
export const closeAllQueues = async (): Promise<void> => {
  logger.info('Closing all queues...');

  await Promise.all(
    Object.values(queues).map(queue => queue.close())
  );

  logger.info('All queues closed');
};

// Email queue
export const emailQueue = createQueue(QUEUE_NAMES.EMAIL);

// Notification queue
export const notificationQueue = createQueue(QUEUE_NAMES.NOTIFICATION);

// Analytics queue
export const analyticsQueue = createQueue(QUEUE_NAMES.ANALYTICS);

// Search index queue
export const searchIndexQueue = createQueue(QUEUE_NAMES.SEARCH_INDEX);

// Webhook queue
export const webhookQueue = createQueue(QUEUE_NAMES.WEBHOOK);

// Cleanup queue
export const cleanupQueue = createQueue(QUEUE_NAMES.CLEANUP);

export default {
  QUEUE_NAMES,
  createQueue,
  getQueue,
  addJob,
  getQueueStats,
  closeAllQueues,
  emailQueue,
  notificationQueue,
  analyticsQueue,
  searchIndexQueue,
  webhookQueue,
  cleanupQueue,
};
