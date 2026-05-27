import cron, { ScheduledTask } from 'node-cron';
import mongoose from 'mongoose';
import { WebhookOutbox } from '../models/webhookOutbox.model';
import { WebhookDLQ } from '../models/webhookDLQ.model';
import { eventBus } from '../event-bus';
import logger from '../utils/logger';

/**
 * Calculate next retry time with exponential backoff
 */
const calculateNextRetry = (attempt: number): Date => {
  const delays = [
    60 * 1000,      // 1 minute
    5 * 60 * 1000,  // 5 minutes
    15 * 60 * 1000, // 15 minutes
    60 * 60 * 1000, // 1 hour
    4 * 60 * 60 * 1000, // 4 hours
    8 * 60 * 60 * 1000, // 8 hours
  ];
  
  const delay = delays[Math.min(attempt, delays.length - 1)];
  return new Date(Date.now() + delay);
};

/**
 * Process webhook outbox - polls for pending events and publishes them
 * This is the "relay" in the transactional outbox pattern
 */
export const processWebhookOutbox = async (): Promise<void> => {
  try {
    // Find events ready for processing
    const pendingEvents = await WebhookOutbox.find({
      status: { $in: ['pending', 'failed'] },
      $or: [
        { nextRetryAt: { $lte: new Date() } },
        { nextRetryAt: null }
      ],
      expiresAt: { $gt: new Date() }
    })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

    if (pendingEvents.length === 0) {
      return;
    }

    logger.info(`Processing ${pendingEvents.length} webhook outbox events`, {
      count: pendingEvents.length,
      action: 'OUTBOX_POLL_STARTED'
    });

    for (const outboxEvent of pendingEvents) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Update status to processing
        await WebhookOutbox.updateOne(
          { _id: outboxEvent._id, status: outboxEvent.status },
          {
            $set: {
              status: 'processing',
              lastAttempt: new Date(),
            },
            $inc: { attempts: 1 }
          },
          { session }
        );

        // Publish event to event bus
        await eventBus.publish(outboxEvent.eventType, outboxEvent.payload);

        // Mark as completed
        await WebhookOutbox.updateOne(
          { _id: outboxEvent._id },
          {
            $set: {
              status: 'completed',
              nextRetryAt: null,
            }
          },
          { session }
        );

        await session.commitTransaction();

        logger.debug('Webhook outbox event published', {
          eventId: outboxEvent.eventId,
          eventType: outboxEvent.eventType,
          action: 'OUTBOX_EVENT_PUBLISHED'
        });

      } catch (error: any) {
        await session.abortTransaction();

        logger.error('Failed to process webhook outbox event', {
          eventId: outboxEvent.eventId,
          eventType: outboxEvent.eventType,
          error: error.message,
          attempts: outboxEvent.attempts + 1,
          action: 'OUTBOX_EVENT_FAILED'
        });

        // Update with error info
        const newAttempts = outboxEvent.attempts + 1;
        
        if (newAttempts >= outboxEvent.maxRetries) {
          // Move to DLQ
          await moveToDeadLetterQueue(outboxEvent, error.message);
        } else {
          // Schedule retry
          await WebhookOutbox.updateOne(
            { _id: outboxEvent._id },
            {
              $set: {
                status: 'pending',
                nextRetryAt: calculateNextRetry(newAttempts),
                lastError: error.message,
              }
            }
          );
        }

      } finally {
        session.endSession();
      }
    }

    logger.info(`Completed processing webhook outbox batch`, {
      count: pendingEvents.length,
      action: 'OUTBOX_POLL_COMPLETED'
    });

  } catch (error: any) {
    logger.error('Webhook outbox processing error', {
      error: error.message,
      action: 'OUTBOX_PROCESSING_ERROR'
    });
  }
};

/**
 * Move failed event to persistent dead letter queue
 */
const moveToDeadLetterQueue = async (outboxEvent: any, error: string): Promise<void> => {
  try {
    // Delete from outbox
    await WebhookOutbox.deleteOne({ _id: outboxEvent._id });

    // Add to DLQ
    await WebhookDLQ.create({
      eventId: outboxEvent.eventId,
      eventType: outboxEvent.eventType,
      payload: outboxEvent.payload,
      error,
      attempts: outboxEvent.attempts + 1,
      lastAttempt: new Date(),
    });

    logger.warn('Webhook moved to DLQ', {
      eventId: outboxEvent.eventId,
      eventType: outboxEvent.eventType,
      error,
      action: 'WEBHOOK_DLQ'
    });

  } catch (dlqError: any) {
    logger.error('Failed to move webhook to DLQ', {
      eventId: outboxEvent.eventId,
      error: dlqError.message,
      action: 'DLQ_WRITE_FAILED'
    });
  }
};

/**
 * Retry a specific DLQ entry
 */
export const retryDLQEntry = async (eventId: string): Promise<boolean> => {
  try {
    const dlqEntry = await WebhookDLQ.findOne({ eventId });
    if (!dlqEntry) {
      return false;
    }

    // Add back to outbox
    await WebhookOutbox.create({
      eventId: dlqEntry.eventId,
      eventType: dlqEntry.eventType,
      payload: dlqEntry.payload,
      status: 'pending',
      attempts: 0,
      maxRetries: 5, // Reduced max retries for retried events
      nextRetryAt: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Mark DLQ entry as resolved
    dlqEntry.resolvedAt = new Date();
    dlqEntry.resolvedBy = 'system';
    dlqEntry.resolution = 'automatic';
    await dlqEntry.save();

    logger.info('DLQ entry requeued for retry', {
      eventId,
      action: 'DLQ_RETRY_SCHEDULED'
    });

    return true;

  } catch (error: any) {
    logger.error('Failed to retry DLQ entry', {
      eventId,
      error: error.message,
      action: 'DLQ_RETRY_FAILED'
    });
    return false;
  }
};

/**
 * Start the outbox relay cron job
 * Runs every 5 seconds
 */
let outboxCronJob: ScheduledTask | null = null;

export const startOutboxRelay = (): void => {
  if (outboxCronJob) {
    logger.warn('Outbox relay already running');
    return;
  }

  // Run every 5 seconds
  outboxCronJob = cron.schedule('*/5 * * * * *', async () => {
    await processWebhookOutbox();
  });

  logger.info('Webhook outbox relay started', {
    schedule: '*/5 * * * * *',
    action: 'OUTBOX_RELAY_STARTED'
  });
};

export const stopOutboxRelay = (): void => {
  if (outboxCronJob) {
    outboxCronJob.stop();
    outboxCronJob = null;
    logger.info('Webhook outbox relay stopped', {
      action: 'OUTBOX_RELAY_STOPPED'
    });
  }
};

/**
 * Get outbox statistics
 */
export const getOutboxStats = async (): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> => {
  const counts = await WebhookOutbox.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0
  };

  for (const item of counts) {
    stats[item._id as keyof typeof stats] = item.count;
    stats.total += item.count;
  }

  return stats;
};

export default {
  processWebhookOutbox,
  retryDLQEntry,
  startOutboxRelay,
  stopOutboxRelay,
  getOutboxStats
};
