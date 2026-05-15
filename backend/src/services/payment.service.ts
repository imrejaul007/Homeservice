import Stripe from 'stripe';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';
import logger from '../utils/logger';
import { scheduleWebhookRetry } from './webhookQueue';
import { cache } from '../config/redis';

// Use the Stripe API version from the package
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  message: string;
}

/**
 * Create a payment intent for a booking
 */
export const createPaymentIntent = async (bookingId: string): Promise<PaymentIntentResult> => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('customerId', 'email firstName lastName')
      .populate('providerId', 'email firstName lastName');

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    if (booking.payment.status === 'paid') {
      throw new ApiError(400, 'Booking is already paid');
    }

    // Calculate amount in smallest currency unit ( fils for AED)
    const amountInCents = Math.round(booking.pricing.totalAmount * 100);

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: booking.pricing.currency?.toLowerCase() || 'aed',
      metadata: {
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        customerId: (booking.customerId as any)?._id?.toString() || '',
        customerEmail: (booking.customerId as any)?.email || '',
        providerId: (booking.providerId as any)?._id?.toString() || '',
        serviceName: booking.pricing.basePrice ? 'Service' : '',
      },
      receipt_email: (booking.customerId as any)?.email,
      description: `Payment for Booking #${booking.bookingNumber}`,
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Store payment intent ID on booking
    booking.payment.transactionId = paymentIntent.id;
    booking.payment.status = 'pending';
    await booking.save();

    logger.info('Payment intent created', {
      bookingId,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    logger.error('Failed to create payment intent', {
      bookingId,
      error: error.message,
    });
    throw new ApiError(500, `Failed to create payment intent: ${error.message}`);
  }
};

/**
 * Confirm payment was successful
 */
export const confirmPayment = async (paymentIntentId: string): Promise<{ success: boolean; bookingId?: string }> => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return { success: false };
    }

    const booking = await Booking.findOne({ 'payment.transactionId': paymentIntentId });
    if (!booking) {
      logger.warn('Booking not found for payment intent', { paymentIntentId });
      return { success: false };
    }

    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date();
    await booking.save();

    // Publish payment.completed event
    await eventBus.publish(EVENT_TYPES.PAYMENT_COMPLETED, {
      bookingId: booking._id.toString(),
      transactionId: paymentIntentId,
      amount: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency.toUpperCase(),
      customerId: booking.customerId?.toString(),
      providerId: booking.providerId?.toString(),
      bookingNumber: booking.bookingNumber,
    });

    logger.info('Payment confirmed', {
      bookingId: booking._id,
      paymentIntentId,
    });

    return { success: true, bookingId: booking._id.toString() };
  } catch (error: any) {
    logger.error('Failed to confirm payment', {
      paymentIntentId,
      error: error.message,
    });
    throw new ApiError(500, `Failed to confirm payment: ${error.message}`);
  }
};

/**
 * Handle Stripe webhook events
 * Includes idempotency check and automatic retry on failure
 */
export const handleWebhookEvent = async (event: Stripe.Event): Promise<{ handled: boolean; message: string }> => {
  // Idempotency check: skip if event already processed
  const eventKey = `webhook:processed:${event.id}`;
  const alreadyProcessed = await cache.get(eventKey);
  if (alreadyProcessed) {
    logger.info('Webhook event already processed, skipping', {
      eventId: event.id,
      eventType: event.type,
    });
    return { handled: true, message: 'Already processed' };
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const booking = await Booking.findOne({ 'payment.transactionId': paymentIntent.id });

        if (booking && booking.payment.status !== 'paid') {
          booking.payment.status = 'paid';
          booking.payment.paidAt = new Date();
          await booking.save();

          logger.info('Webhook: Payment succeeded', {
            bookingId: booking._id,
            paymentIntentId: paymentIntent.id,
          });
        }
        // Mark event as processed (24 hour TTL)
        await cache.set(eventKey, JSON.stringify({ processed: true, timestamp: Date.now() }), 86400);
        return { handled: true, message: 'Payment succeeded handled' };
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const booking = await Booking.findOne({ 'payment.transactionId': paymentIntent.id });

        if (booking) {
          booking.payment.status = 'failed';
          booking.payment.transactionId = `failed_${paymentIntent.last_payment_error?.message || 'unknown'}`;
          await booking.save();

          // Publish payment.failed event
          await eventBus.publish(EVENT_TYPES.PAYMENT_FAILED, {
            bookingId: booking._id.toString(),
            transactionId: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message || 'Unknown payment error',
            errorCode: paymentIntent.last_payment_error?.code,
            declineCode: paymentIntent.last_payment_error?.decline_code,
            customerId: booking.customerId?.toString(),
            providerId: booking.providerId?.toString(),
            bookingNumber: booking.bookingNumber,
          });

          logger.warn('Webhook: Payment failed', {
            bookingId: booking._id,
            paymentIntentId: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message,
          });
        }
        // Mark event as processed (24 hour TTL)
        await cache.set(eventKey, JSON.stringify({ processed: true, timestamp: Date.now() }), 86400);
        return { handled: true, message: 'Payment failed handled' };
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const booking = await Booking.findOne({ 'payment.transactionId': charge.payment_intent });

        if (booking) {
          // Initialize totalRefunded if not present
          if (!booking.payment.totalRefunded) {
            booking.payment.totalRefunded = 0;
          }

          // Track the refunded amount
          const refundedAmount = charge.amount_refunded / 100;
          booking.payment.totalRefunded += refundedAmount;

          // Update status based on total refunded vs total amount
          if (booking.payment.totalRefunded >= booking.pricing.totalAmount) {
            booking.payment.status = 'refunded';
          }
          booking.payment.refundedAt = new Date();
          await booking.save();

          logger.info('Webhook: Refund processed', {
            bookingId: booking._id,
            chargeId: charge.id,
            refundedAmount,
            totalRefunded: booking.payment.totalRefunded,
          });
        }
        // Mark event as processed (24 hour TTL)
        await cache.set(eventKey, JSON.stringify({ processed: true, timestamp: Date.now() }), 86400);
        return { handled: true, message: 'Refund handled' };
      }

      default:
        return { handled: false, message: `Unhandled event type: ${event.type}` };
    }
  } catch (error: any) {
    logger.error('Webhook handler error', {
      eventType: event.type,
      error: error.message,
      stack: error.stack,
    });

    // Schedule retry for Stripe to retry webhook
    await scheduleWebhookRetry(event.id, event.type, event);

    // Return error to trigger Stripe retry (HTTP 500)
    // This ensures Stripe will retry the webhook delivery
    throw new ApiError(500, `Webhook processing failed: ${error.message}`);
  }
};

/**
 * Create a refund for a booking
 */
export const createRefund = async (
  bookingId: string,
  amount?: number
): Promise<RefundResult> => {
  try {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    if (!booking.payment.transactionId) {
      throw new ApiError(400, 'No payment found for this booking');
    }

    if (booking.payment.status !== 'paid') {
      throw new ApiError(400, 'Booking is not paid');
    }

    // Initialize totalRefunded if not present (for backwards compatibility)
    const currentTotalRefunded = booking.payment.totalRefunded || 0;

    // Calculate maximum refundable amount
    const maxRefundable = booking.pricing.totalAmount - currentTotalRefunded;
    if (maxRefundable <= 0) {
      throw new ApiError(400, `Full refund already processed. Total refunded: ${currentTotalRefunded}`);
    }

    // Calculate refund amount
    let refundAmount: number;
    if (amount !== undefined && amount !== null) {
      // Validate requested amount doesn't exceed remaining refundable amount
      if (amount > maxRefundable) {
        throw new ApiError(
          400,
          `Refund amount ${amount} exceeds maximum refundable amount ${maxRefundable.toFixed(2)}. ` +
          `Already refunded: ${currentTotalRefunded.toFixed(2)}, Total paid: ${booking.pricing.totalAmount.toFixed(2)}`
        );
      }
      if (amount <= 0) {
        throw new ApiError(400, 'Refund amount must be positive');
      }
      refundAmount = amount;
    } else {
      // Full refund of remaining amount
      refundAmount = maxRefundable;
    }

    const refund = await stripe.refunds.create({
      payment_intent: booking.payment.transactionId,
      amount: Math.round(refundAmount * 100), // Convert to cents
    });

    // Update booking with new total refunded
    booking.payment.totalRefunded = currentTotalRefunded + refundAmount;

    // Update status based on total refunded vs total amount
    if (booking.payment.totalRefunded >= booking.pricing.totalAmount) {
      booking.payment.status = 'refunded';
    }
    booking.payment.refundedAt = new Date();
    await booking.save();

    logger.info('Refund created', {
      bookingId,
      refundId: refund.id,
      amount: refundAmount,
      totalRefunded: booking.payment.totalRefunded,
      maxRefundable: booking.pricing.totalAmount,
    });

    return {
      success: true,
      refundId: refund.id,
      amount: refundAmount,
      message: `Refund of ${refundAmount.toFixed(2)} processed successfully. Total refunded: ${booking.payment.totalRefunded.toFixed(2)}`,
    };
  } catch (error: any) {
    logger.error('Failed to create refund', {
      bookingId,
      error: error.message,
    });
    throw new ApiError(500, `Failed to create refund: ${error.message}`);
  }
};

/**
 * Get payment status for a booking
 */
export const getPaymentStatus = async (bookingId: string): Promise<{
  status: string;
  transactionId?: string;
  paidAt?: Date;
  refundedAt?: Date;
}> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  return {
    status: booking.payment.status,
    transactionId: booking.payment.transactionId,
    paidAt: booking.payment.paidAt,
    refundedAt: booking.payment.refundedAt,
  };
};

/**
 * Verify Stripe webhook signature
 */
export const verifyWebhookSignature = (payload: string | Buffer, signature: string): Stripe.Event => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new ApiError(500, 'Stripe webhook secret not configured');
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error: any) {
    logger.error('Webhook signature verification failed', {
      error: error.message,
    });
    throw new ApiError(400, `Webhook signature verification failed: ${error.message}`);
  }
};

export default {
  createPaymentIntent,
  confirmPayment,
  handleWebhookEvent,
  createRefund,
  getPaymentStatus,
  verifyWebhookSignature,
};
