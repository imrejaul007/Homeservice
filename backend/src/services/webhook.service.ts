import Stripe from 'stripe';
import mongoose from 'mongoose';
import { WebhookOutbox } from '../models/webhookOutbox.model';
import { WebhookDLQ } from '../models/webhookDLQ.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import { processWebhookOutbox } from '../queue/outboxRelay';
import { withTimeout } from '../utils/retry.util';

/**
 * Configuration constants
 */
const TOLERANCE_SECONDS = 300; // 5 minutes for replay attack prevention
const HANDLER_TIMEOUT_MS = 5000; // 5 second timeout for handlers

/**
 * Validate webhook timestamp to prevent replay attacks
 * Stripe events should not be older than 5 minutes
 */
export const validateWebhookTimestamp = (event: Stripe.Event): void => {
  const ageSeconds = (Date.now() / 1000) - event.created;
  
  if (ageSeconds > TOLERANCE_SECONDS) {
    logger.error('Webhook timestamp too old - possible replay attack', {
      eventId: event.id,
      eventType: event.type,
      ageSeconds,
      action: 'REPLAY_ATTACK_DETECTED'
    });
    throw ApiError.badRequest(`Webhook timestamp too old (${ageSeconds}s > ${TOLERANCE_SECONDS}s)`, [], ERROR_CODES.INVALID_INPUT);
  }

  if (ageSeconds < -60) { // 1 minute in the future
    logger.error('Webhook timestamp in the future', {
      eventId: event.id,
      eventType: event.type,
      ageSeconds,
      action: 'INVALID_TIMESTAMP'
    });
    throw ApiError.badRequest('Webhook timestamp is in the future', [], ERROR_CODES.INVALID_INPUT);
  }
};

/**
 * Validate event sequence for out-of-order delivery
 * Prevents refund events from being processed before payment succeeds
 */
export const validateEventSequence = async (
  event: Stripe.Event,
  booking: any
): Promise<boolean> => {
  const eventType = event.type;
  const paymentStatus = booking.payment?.status;

  switch (eventType) {
    case 'charge.refunded': {
      if (paymentStatus !== 'completed') {
        logger.error('Refund received for unpaid booking', {
          bookingId: booking._id,
          eventId: event.id,
          paymentStatus,
          eventType,
          action: 'OUT_OF_ORDER_REFUND'
        });
        
        // Queue for investigation
        await queueForInvestigation(event, 'Refund before payment confirmed');
        return false;
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      if (paymentStatus === 'refunded') {
        logger.error('Payment failure after refund - suspicious activity', {
          bookingId: booking._id,
          eventId: event.id,
          paymentStatus,
          eventType,
          action: 'OUT_OF_ORDER_PAYMENT_FAILED'
        });
        
        await queueForInvestigation(event, 'Payment failed after refund');
        return false;
      }
      break;
    }

    case 'payment_intent.succeeded': {
      if (paymentStatus === 'refunded') {
        logger.error('Payment succeeded after refund - suspicious activity', {
          bookingId: booking._id,
          eventId: event.id,
          paymentStatus,
          eventType,
          action: 'OUT_OF_ORDER_PAYMENT_SUCCEEDED'
        });
        
        await queueForInvestigation(event, 'Payment succeeded after refund');
        return false;
      }
      break;
    }
  }

  return true;
};

/**
 * Queue event for manual investigation when validation fails
 */
const queueForInvestigation = async (
  event: Stripe.Event,
  reason: string
): Promise<void> => {
  try {
    await WebhookDLQ.create({
      eventId: event.id,
      eventType: event.type,
      payload: event,
      error: reason,
      attempts: 0,
      lastAttempt: new Date(),
    });

    logger.warn('Webhook queued for investigation', {
      eventId: event.id,
      eventType: event.type,
      reason,
      action: 'QUEUED_FOR_INVESTIGATION'
    });
  } catch (error: any) {
    logger.error('Failed to queue for investigation', {
      eventId: event.id,
      error: error.message,
      action: 'INVESTIGATION_QUEUE_FAILED'
    });
  }
};

/**
 * Enhanced handleWebhookEvent with transactional outbox pattern
 * Uses MongoDB transaction to ensure atomicity
 */
export const handleWebhookEventWithOutbox = async (
  event: Stripe.Event
): Promise<{ handled: boolean; message: string }> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate timestamp (replay attack prevention)
    validateWebhookTimestamp(event);

    // Check idempotency
    const alreadyProcessed = await checkWebhookProcessed(event.id);
    if (alreadyProcessed) {
      await session.abortTransaction();
      return { handled: true, message: 'Already processed' };
    }

    // Process event with timeout
    const result = await withTimeout(
      async () => processWebhookEventInTransaction(event, session),
      HANDLER_TIMEOUT_MS,
      'Webhook handler timeout'
    );

    // Mark as processed
    await markWebhookProcessed(event.id, event.type);

    // Commit transaction
    await session.commitTransaction();

    return result;

  } catch (error: any) {
    await session.abortTransaction();

    logger.error('Webhook event handling failed', {
      eventId: event.id,
      eventType: event.type,
      error: error.message,
      action: 'WEBHOOK_HANDLING_FAILED'
    });

    // Don't retry timeout errors
    if (error.message.includes('timeout')) {
      throw error;
    }

    // Schedule retry via outbox
    await scheduleWebhookRetry(event.id, event.type, event);
    throw error;

  } finally {
    session.endSession();
  }
};

/**
 * Process webhook event within a transaction
 * Writes to outbox atomically with business data changes
 */
const processWebhookEventInTransaction = async (
  event: Stripe.Event,
  session: mongoose.ClientSession
): Promise<{ handled: boolean; message: string }> => {
  // This would be called within a transaction
  // Implementation depends on the specific event type
  
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      // Process payment intent succeeded
      // Write to outbox atomically
      await WebhookOutbox.create([{
        eventId: event.id,
        eventType: event.type,
        payload: event,
        status: 'pending',
        createdAt: new Date(),
        attempts: 0,
        nextRetryAt: null,
        maxRetries: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }], { session });
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      // Process payment intent failed
      await WebhookOutbox.create([{
        eventId: event.id,
        eventType: event.type,
        payload: event,
        status: 'pending',
        createdAt: new Date(),
        attempts: 0,
        nextRetryAt: null,
        maxRetries: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }], { session });
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      // Process refund
      await WebhookOutbox.create([{
        eventId: event.id,
        eventType: event.type,
        payload: event,
        status: 'pending',
        createdAt: new Date(),
        attempts: 0,
        nextRetryAt: null,
        maxRetries: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }], { session });
      break;
    }

    // ===========================================
    // PAYOUT WEBHOOK HANDLERS
    // These handlers update withdrawal (payout) status when Stripe reports payout completion/failure
    // ===========================================

    case 'payout.paid': {
      const payout = event.data.object as Stripe.Payout;
      // Process payout completed - update withdrawal status
      await WebhookOutbox.create([{
        eventId: event.id,
        eventType: event.type,
        payload: event,
        status: 'pending',
        createdAt: new Date(),
        attempts: 0,
        nextRetryAt: null,
        maxRetries: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }], { session });
      break;
    }

    case 'payout.failed': {
      const payout = event.data.object as Stripe.Payout;
      // Process payout failed - update withdrawal status
      await WebhookOutbox.create([{
        eventId: event.id,
        eventType: event.type,
        payload: event,
        status: 'pending',
        createdAt: new Date(),
        attempts: 0,
        nextRetryAt: null,
        maxRetries: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }], { session });
      break;
    }

    case 'payout.canceled': {
      const payout = event.data.object as Stripe.Payout;
      // Process payout canceled - update withdrawal status
      await WebhookOutbox.create([{
        eventId: event.id,
        eventType: event.type,
        payload: event,
        status: 'pending',
        createdAt: new Date(),
        attempts: 0,
        nextRetryAt: null,
        maxRetries: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }], { session });
      break;
    }

    default:
      return { handled: false, message: `Unhandled event type: ${event.type}` };
  }

  return { handled: true, message: `${event.type} queued for processing` };
};

/**
 * Schedule webhook retry by adding to outbox
 */
const scheduleWebhookRetry = async (
  eventId: string,
  eventType: string,
  payload: Stripe.Event
): Promise<void> => {
  try {
    // Check if already in outbox
    const existing = await WebhookOutbox.findOne({ eventId });
    if (existing) {
      logger.debug('Webhook already in outbox', {
        eventId,
        eventType,
        action: 'OUTBOX_DUPLICATE'
      });
      return;
    }

    await WebhookOutbox.create({
      eventId,
      eventType,
      payload,
      status: 'pending',
      createdAt: new Date(),
      attempts: 0,
      nextRetryAt: new Date(Date.now() + 60 * 1000), // 1 minute initial delay
      maxRetries: 10,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    logger.info('Webhook scheduled for retry via outbox', {
      eventId,
      eventType,
      action: 'OUTBOX_RETRY_SCHEDULED'
    });

  } catch (error: any) {
    logger.error('Failed to schedule webhook retry', {
      eventId,
      eventType,
      error: error.message,
      action: 'OUTBOX_RETRY_FAILED'
    });
  }
};

/**
 * Check if webhook was already processed or is currently being processed
 * Uses Redis for fast lookups, falls back to MongoDB
 * FIX: Add WebhookOutbox check to prevent concurrent processing of same event
 */
const WEBHOOK_PROCESSED_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

const checkWebhookProcessed = async (eventId: string): Promise<boolean> => {
  try {
    // FIX: Check Redis cache first for fast lookups
    const { cache, isRedisAvailable } = await import('../config/redis');
    if (isRedisAvailable() && cache.client) {
      const cached = await cache.client.get(`webhook:processed:${eventId}`);
      if (cached) {
        logger.debug('Webhook already processed (Redis cache hit)', { eventId });
        return true;
      }

      // FIX: Also check for in-flight processing in Redis
      const inFlight = await cache.client.get(`webhook:inflight:${eventId}`);
      if (inFlight) {
        logger.debug('Webhook currently being processed (Redis inflight check)', { eventId });
        return true;
      }

      // FIX: Atomically mark as in-flight to prevent concurrent processing
      // Only set if not already present (NX) with short TTL (30 seconds for processing timeout)
      const marked = await cache.client.set(
        `webhook:inflight:${eventId}`,
        JSON.stringify({ startedAt: Date.now() }),
        'EX',
        30, // 30 second TTL - should be enough for processing
        'NX'
      );

      if (!marked) {
        // Another process is handling this event
        logger.debug('Webhook currently being processed (set NX failed)', { eventId });
        return true;
      }
    }

    // Check WebhookOutbox for in-flight events (prevents processing same event twice)
    const outboxEntry = await WebhookOutbox.findOne({ eventId }).lean();
    if (outboxEntry) {
      logger.debug('Webhook already in outbox (in-flight)', { eventId, status: outboxEntry.status });
      // Refresh the Redis inflight marker
      if (isRedisAvailable() && cache.client) {
        await cache.client.expire(`webhook:inflight:${eventId}`, 30);
      }
      return true;
    }

    // Fallback to MongoDB ProcessedWebhook collection
    const processed = await mongoose.models.ProcessedWebhook?.findOne({ eventId });
    if (processed) {
      // FIX: Cache the result in Redis for future lookups
      if (isRedisAvailable() && cache.client) {
        await cache.client.setex(
          `webhook:processed:${eventId}`,
          WEBHOOK_PROCESSED_CACHE_TTL,
          '1'
        );
        // FIX: Remove inflight marker since processing is complete
        await cache.client.del(`webhook:inflight:${eventId}`);
      }
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to check webhook processed status', {
      eventId,
      error: (error as Error).message
    });
    return false;
  }
};

/**
 * Mark webhook as processed
 * FIX: Update Redis cache when marking as processed to maintain consistency
 * FIX: Also clear the inflight marker to allow future processing if needed
 */
const markWebhookProcessed = async (
  eventId: string,
  eventType: string
): Promise<void> => {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // FIX: Update both Redis and MongoDB for consistency
    const { cache, isRedisAvailable } = await import('../config/redis');

    // Update Redis cache immediately for fast future lookups
    if (isRedisAvailable() && cache.client) {
      // Set processed marker with full TTL
      await cache.client.setex(
        `webhook:processed:${eventId}`,
        WEBHOOK_PROCESSED_CACHE_TTL,
        '1'
      );

      // FIX: Remove inflight marker - processing is complete
      await cache.client.del(`webhook:inflight:${eventId}`);
    }

    await mongoose.models.ProcessedWebhook?.findOneAndUpdate(
      { eventId },
      {
        eventId,
        eventType,
        processedAt: new Date(),
        expiresAt,
      },
      { upsert: true, new: true }
    );

  } catch (error) {
    logger.error('Failed to mark webhook as processed', {
      eventId,
      eventType,
      error: (error as Error).message
    });
  }
};

export default {
  validateWebhookTimestamp,
  validateEventSequence,
  handleWebhookEventWithOutbox,
  processWebhookOutbox
};
