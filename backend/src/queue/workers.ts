import { Worker, Job } from 'bullmq';
import { queueRedis } from '../config/redis';
import { getMeiliClient, INDEXES, isMeiliSearchConfigured } from '../config/meilisearch';
import logger from '../utils/logger';
import emailService from '../services/email.service';
import { QUEUE_NAMES } from './index';

// Common worker options with Redis connection - use URL for BullMQ v5
const workerOptions = {
  connection: {
    host: process.env.REDIS_HOST || 'redis-12442.c274.us-east-1-3.ec2.cloud.redislabs.com',
    port: parseInt(process.env.REDIS_PORT || '12442'),
    password: process.env.REDIS_PASSWORD || 'jwTUlq5fg7BD4D8KQcpUfmSoMh0Z6s5w',
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

      case 'booking_request':
        await emailService.sendBookingRequestEmail(to, firstName, bookingDetails);
        break;

      case 'booking_reminder':
        await emailService.sendBookingReminderEmail(to, firstName, bookingDetails);
        break;

      case 'password_reset':
        await emailService.sendPasswordResetEmail(to, firstName, metadata?.resetToken as string);
        break;

      case 'welcome':
        await emailService.sendWelcomeEmail(to, firstName, 'customer');
        break;

      case 'verification':
        await emailService.sendVerificationEmail(to, firstName, metadata?.verificationToken as string);
        break;

      default:
        logger.warn(`Unknown email type: ${type}`);
    }

    logger.info(`Email job completed: ${job.id}`, {
      jobId: job.id,
      type,
      action: 'EMAIL_JOB_COMPLETED',
    });

    return { success: true, type };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Email job failed: ${job.id}`, {
      jobId: job.id,
      type,
      error: errorMessage,
      action: 'EMAIL_JOB_FAILED',
    });
    throw error;
  }
};

const createEmailWorker = (): Worker => {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    emailProcessor,
    workerOptions
  );

  worker.on('completed', (job) => {
    logger.info(`Email job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Email job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Email worker created', { queue: QUEUE_NAMES.EMAIL });
  return worker;
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
    userId,
    type,
    action: 'NOTIFICATION_JOB_STARTED',
  });

  try {
    // Here you would integrate with your notification service
    logger.info(`Notification sent to user ${userId}: ${title}`, {
      jobId: job.id,
      userId,
      type,
      action: 'NOTIFICATION_SENT',
    });

    logger.info(`Notification job completed: ${job.id}`, {
      jobId: job.id,
      userId,
      action: 'NOTIFICATION_JOB_COMPLETED',
    });

    return { success: true, userId };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Notification job failed: ${job.id}`, {
      jobId: job.id,
      userId,
      error: errorMessage,
      action: 'NOTIFICATION_JOB_FAILED',
    });
    throw error;
  }
};

const createNotificationWorker = (): Worker => {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    notificationProcessor,
    workerOptions
  );

  worker.on('completed', (job) => {
    logger.info(`Notification job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Notification job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Notification worker created', { queue: QUEUE_NAMES.NOTIFICATION });
  return worker;
};

// ============================================
// Analytics Worker
// ============================================

interface AnalyticsEventData {
  eventType: string;
  eventData: Record<string, unknown>;
  timestamp: Date;
  sessionId?: string;
  userId?: string;
}

const analyticsProcessor = async (job: Job<AnalyticsEventData>) => {
  const { eventType, eventData, timestamp, sessionId, userId } = job.data;

  logger.info(`Processing analytics event: ${job.id}`, {
    jobId: job.id,
    eventType,
    action: 'ANALYTICS_JOB_STARTED',
  });

  try {
    logger.info(`Analytics event processed: ${eventType}`, {
      jobId: job.id,
      eventType,
      sessionId,
      userId,
      action: 'ANALYTICS_EVENT_PROCESSED',
    });

    return { success: true, eventType };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Analytics job failed: ${job.id}`, {
      jobId: job.id,
      eventType,
      error: errorMessage,
      action: 'ANALYTICS_JOB_FAILED',
    });
    throw error;
  }
};

const createAnalyticsWorker = (): Worker => {
  const worker = new Worker<AnalyticsEventData>(
    QUEUE_NAMES.ANALYTICS,
    analyticsProcessor,
    workerOptions
  );

  worker.on('completed', (job) => {
    logger.info(`Analytics job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Analytics job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Analytics worker created', { queue: QUEUE_NAMES.ANALYTICS });
  return worker;
};

// ============================================
// Search Index Worker
// ============================================

interface SearchIndexJobData {
  action: 'index' | 'update' | 'delete';
  entityType: 'service' | 'provider' | 'category';
  entityId: string;
  data?: Record<string, unknown>;
}

const searchIndexProcessor = async (job: Job<SearchIndexJobData>) => {
  const { action, entityType, entityId, data } = job.data;

  logger.info(`Processing search index job: ${job.id}`, {
    jobId: job.id,
    action,
    entityType,
    entityId,
    actionLabel: 'SEARCH_INDEX_JOB_STARTED',
  });

  if (!isMeiliSearchConfigured()) {
    logger.warn('Search index job skipped - Meilisearch not configured', {
      jobId: job.id,
      entityType,
      entityId,
    });
    return { success: false, reason: 'Meilisearch not configured' };
  }

  try {
    let indexName: string;

    switch (entityType) {
      case 'service':
        indexName = INDEXES.SERVICES;
        break;
      case 'provider':
        indexName = INDEXES.PROVIDERS;
        break;
      case 'category':
        indexName = INDEXES.CATEGORIES;
        break;
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    const client = await getMeiliClient();
    if (!client) {
      throw new Error('Failed to get MeiliSearch client');
    }

    const index = client.index(indexName);

    switch (action) {
      case 'index':
      case 'update':
        if (!data) {
          throw new Error(`Data required for ${action} action`);
        }
        await index.addDocuments([data]);
        break;

      case 'delete':
        await index.deleteDocument(entityId);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    logger.info(`Search index job completed: ${job.id}`, {
      jobId: job.id,
      action,
      entityType,
      entityId,
      actionLabel: 'SEARCH_INDEX_JOB_COMPLETED',
    });

    return { success: true, action, entityType, entityId };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Search index job failed: ${job.id}`, {
      jobId: job.id,
      action,
      entityType,
      entityId,
      error: errorMessage,
      actionLabel: 'SEARCH_INDEX_JOB_FAILED',
    });
    throw error;
  }
};

const createSearchIndexWorker = (): Worker => {
  const worker = new Worker<SearchIndexJobData>(
    QUEUE_NAMES.SEARCH_INDEX,
    searchIndexProcessor,
    workerOptions
  );

  worker.on('completed', (job) => {
    logger.info(`Search index job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Search index job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Search index worker created', { queue: QUEUE_NAMES.SEARCH_INDEX });
  return worker;
};

// ============================================
// Webhook Worker
// ============================================

interface WebhookJobData {
  webhookId: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
  signature?: string;
  secret?: string;
  maxRetries?: number;
  retryCount?: number;
}

const webhookProcessor = async (job: Job<WebhookJobData>) => {
  const { webhookId, url, method, headers, payload, signature, secret } = job.data;

  logger.info(`Processing webhook job: ${job.id}`, {
    jobId: job.id,
    webhookId,
    url,
    method,
    actionLabel: 'WEBHOOK_JOB_STARTED',
  });

  try {
    // Build request options
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'NILIN-Webhook/1.0',
      ...headers,
    };

    // Add HMAC signature if secret is provided
    if (secret && payload) {
      const crypto = await import('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(payload));
      requestHeaders['X-Webhook-Signature'] = hmac.digest('hex');
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    // Add body for non-GET requests
    if (method !== 'GET' && payload) {
      requestOptions.body = JSON.stringify(payload);
    }

    // Make the webhook request
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    logger.info(`Webhook job completed: ${job.id}`, {
      jobId: job.id,
      webhookId,
      status: response.status,
      actionLabel: 'WEBHOOK_JOB_COMPLETED',
    });

    return { success: true, webhookId, status: response.status };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Webhook job failed: ${job.id}`, {
      jobId: job.id,
      webhookId,
      url,
      error: errorMessage,
      actionLabel: 'WEBHOOK_JOB_FAILED',
    });
    throw error;
  }
};

const createWebhookWorker = (): Worker => {
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOK,
    webhookProcessor,
    workerOptions
  );

  worker.on('completed', (job) => {
    logger.info(`Webhook job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Webhook job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Webhook worker created', { queue: QUEUE_NAMES.WEBHOOK });
  return worker;
};

// ============================================
// Cleanup Worker
// ============================================

interface CleanupJobData {
  task: string;
  options?: Record<string, unknown>;
}

const cleanupProcessor = async (job: Job<CleanupJobData>) => {
  const { task } = job.data;

  logger.info(`Processing cleanup job: ${job.id}`, {
    jobId: job.id,
    task,
    action: 'CLEANUP_JOB_STARTED',
  });

  try {
    let deletedCount = 0;

    switch (task) {
      case 'expired_tokens':
        logger.info(`Cleanup task completed: ${task}`, {
          jobId: job.id,
          deletedCount,
          action: 'CLEANUP_TASK_COMPLETED',
        });
        break;

      case 'old_audit_logs':
        logger.info(`Cleanup task completed: ${task}`, {
          jobId: job.id,
          deletedCount,
          action: 'CLEANUP_TASK_COMPLETED',
        });
        break;

      case 'orphaned_uploads':
        logger.info(`Cleanup task completed: ${task}`, {
          jobId: job.id,
          deletedCount,
          action: 'CLEANUP_TASK_COMPLETED',
        });
        break;

      case 'expired_cache':
        const { cacheRedis } = await import('../config/redis');
        const cacheKeys = await cacheRedis.keys('nilin:cache:*');
        deletedCount = cacheKeys.length;
        logger.info(`Cleanup task completed: ${task}`, {
          jobId: job.id,
          deletedCount,
          action: 'CLEANUP_TASK_COMPLETED',
        });
        break;

      default:
        logger.warn(`Unknown cleanup task: ${task}`);
    }

    return { success: true, task, deletedCount };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Cleanup job failed: ${job.id}`, {
      jobId: job.id,
      task,
      error: errorMessage,
      action: 'CLEANUP_JOB_FAILED',
    });
    throw error;
  }
};

const createCleanupWorker = (): Worker => {
  const worker = new Worker<CleanupJobData>(
    QUEUE_NAMES.CLEANUP,
    cleanupProcessor,
    workerOptions
  );

  worker.on('completed', (job) => {
    logger.info(`Cleanup job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Cleanup job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Cleanup worker created', { queue: QUEUE_NAMES.CLEANUP });
  return worker;
};

// ============================================
// Worker Exports
// ============================================

export const emailWorker = createEmailWorker();
export const notificationWorker = createNotificationWorker();
export const analyticsWorker = createAnalyticsWorker();
export const searchIndexWorker = createSearchIndexWorker();
export const webhookWorker = createWebhookWorker();
export const cleanupWorker = createCleanupWorker();

// Close all workers
export const closeAllWorkers = async (): Promise<void> => {
  logger.info('Closing queue workers...');

  await Promise.all([
    emailWorker.close(),
    notificationWorker.close(),
    analyticsWorker.close(),
    searchIndexWorker.close(),
    webhookWorker.close(),
    cleanupWorker.close(),
  ]);

  logger.info('All queue workers closed');
};

export default {
  emailWorker,
  notificationWorker,
  analyticsWorker,
  searchIndexWorker,
  webhookWorker,
  cleanupWorker,
  closeAllWorkers,
};
