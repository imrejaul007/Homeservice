import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  createPaymentIntent,
  getPaymentStatus,
  createRefund,
} from '../services/payment.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import express from 'express';

const router = Router();

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create a payment intent for a booking
 * @access  Private (Customer)
 */
router.post('/create-intent', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.body;
  const userId = (req.user as any)._id;

  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  logger.info('Creating payment intent', {
    bookingId,
    userId,
    action: 'CREATE_PAYMENT_INTENT',
  });

  const result = await createPaymentIntent(bookingId);

  res.json({
    success: true,
    message: 'Payment intent created',
    data: {
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
    },
  });
}));

/**
 * @route   GET /api/payments/status/:bookingId
 * @desc    Get payment status for a booking
 * @access  Private
 */
router.get('/status/:bookingId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;

  const status = await getPaymentStatus(bookingId);

  res.json({
    success: true,
    data: status,
  });
}));

/**
 * @route   POST /api/payments/refund/:bookingId
 * @desc    Create a refund for a booking
 * @access  Private (Admin or Provider)
 */
router.post('/refund/:bookingId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { amount } = req.body;
  const user = req.user as any;

  // Only admin or provider can issue refunds
  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to issue refunds');
  }

  logger.info('Creating refund', {
    bookingId,
    amount,
    userId: user._id,
    userRole: user.role,
    action: 'CREATE_REFUND',
  });

  const result = await createRefund(bookingId, amount);

  res.json({
    success: true,
    message: result.message,
    data: {
      refundId: result.refundId,
      amount: result.amount,
    },
  });
}));

/**
 * @route   POST /api/payments/webhook
 * @desc    Stripe webhook handler
 * @access  Public (but signature verified)
 *
 * NOTE: Stripe requires raw body Buffer for signature verification.
 * This route uses express.raw() middleware to get the unparsed body.
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // Raw body Buffer for Stripe signature verification
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      logger.warn('Webhook received without signature', {
        action: 'WEBHOOK_NO_SIGNATURE',
      });
      res.status(400).json({ error: 'No signature provided' });
      return;
    }

    let event;

    try {
      // Import verifyWebhookSignature
      const { verifyWebhookSignature } = await import('../services/payment.service');
      event = verifyWebhookSignature(req.body, signature);
    } catch (err: any) {
      logger.error('Webhook signature verification failed', {
        error: err.message,
        action: 'WEBHOOK_VERIFICATION_FAILED',
      });
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }

    // Handle the event
    try {
      const { handleWebhookEvent } = await import('../services/payment.service');
      const result = await handleWebhookEvent(event);

      logger.info('Webhook event processed', {
        eventType: event.type,
        handled: result.handled,
        action: 'WEBHOOK_PROCESSED',
      });

      res.json({ received: true, message: result.message });
    } catch (err: any) {
      logger.error('Webhook event handling failed', {
        eventType: event.type,
        error: err.message,
        action: 'WEBHOOK_HANDLING_FAILED',
      });
      res.status(500).json({ error: `Webhook handling error: ${err.message}` });
    }
  }
);

export default router;
