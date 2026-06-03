import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  createPaymentIntent,
  getPaymentStatus,
  createRefund,
} from '../services/payment.service';
import { bookingService } from '../services/booking.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import express from 'express';
import { paymentLimiter } from '../middleware/rateLimiter';
import { cache } from '../config/redis';
import crypto from 'crypto';
import Joi from 'joi';
import Booking from '../models/booking.model';
import { IUser } from '../models/user.model';
import mongoose from 'mongoose';

const router = Router();

// ============================================
// Input Validation Schemas
// ============================================

const createPaymentIntentSchema = Joi.object({
  bookingId: Joi.string().required().messages({
    'string.empty': 'Booking ID is required',
    'any.required': 'Booking ID is required',
  }),
});

const createRefundSchema = Joi.object({
  amount: Joi.number().positive().precision(2).messages({
    'number.positive': 'Refund amount must be positive',
    'number.base': 'Refund amount must be a number',
  }),
});

const bookingIdParamSchema = Joi.object({
  bookingId: Joi.string().required().messages({
    'string.empty': 'Booking ID is required',
    'any.required': 'Booking ID is required',
  }),
});

// Idempotency key cache duration (24 hours in seconds)
const IDEMPOTENCY_TTL = 24 * 60 * 60;

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create a payment intent for a booking
 * @access  Private (Customer or Provider owning the booking)
 * @security Ownership check: Only booking customer or assigned provider can create payment intent
 */
router.post('/create-intent', paymentLimiter, authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createPaymentIntentSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { bookingId } = value;
  const user = req.user as IUser;
  const userId = user._id;

  // SECURITY FIX: Verify user owns the booking or is the assigned provider
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // SECURITY FIX: Enhanced ownership verification for guest bookings
  // Check if user is the customer (owner) or the assigned provider
  const isCustomer = booking.customerId?.toString() === userId.toString();
  const isProvider = booking.providerId.toString() === userId.toString();

  // SECURITY FIX: For guest bookings, verify ownership via guest email from booking
  // This allows the same guest who made the booking to create payment intent
  let hasGuestAccess = false;
  if (!isCustomer && !isProvider) {
    // Allow access if user is the guest with matching email from booking
    const guestEmail = req.headers['x-guest-email'] as string;
    if (guestEmail && booking.guestInfo?.email) {
      // Case-insensitive comparison to handle email format variations
      hasGuestAccess = guestEmail.toLowerCase() === booking.guestInfo.email.toLowerCase();
    }
  }

  if (!isCustomer && !isProvider && !hasGuestAccess && user.role !== 'admin') {
    throw new ApiError(403, 'You do not have permission to create a payment intent for this booking');
  }

  // Get or generate idempotency key
  const idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();

  // Check idempotency cache first
  const cacheKey = `payment:idempotency:${idempotencyKey}`;
  const cachedResult = await cache.get(cacheKey);
  if (cachedResult) {
    logger.info('Returning cached payment intent result', {
      idempotencyKey,
      bookingId,
      action: 'PAYMENT_IDEMPOTENT_HIT',
    });
    const parsed = JSON.parse(cachedResult);
    return res.json({
      success: true,
      message: 'Payment intent created (cached)',
      data: {
        clientSecret: parsed.clientSecret,
        paymentIntentId: parsed.paymentIntentId,
      },
      cached: true,
      idempotencyKey,
    });
  }

  logger.info('Creating payment intent', {
    bookingId,
    userId,
    idempotencyKey,
    action: 'CREATE_PAYMENT_INTENT',
  });

  const result = await createPaymentIntent(bookingId, idempotencyKey);

  // Store in cache for idempotency (24h TTL)
  await cache.set(cacheKey, JSON.stringify(result), 24 * 60 * 60);

  res.json({
    success: true,
    message: 'Payment intent created',
    data: {
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
    },
    idempotencyKey,
  });
  return;
}));

/**
 * @route   POST /api/payments/heartbeat
 * @desc    Extend slot lock TTL during long checkout/payment processes
 * @access  Private (Customer)
 * @security Verifies user owns the booking before extending lock
 * SECURITY FIX: Validates bookingId is a proper MongoDB ObjectId
 */
router.post('/heartbeat', paymentLimiter, authenticate, asyncHandler(async (req: Request, res: Response) => {
  const heartbeatSchema = Joi.object({
    bookingId: Joi.string().required().custom((value, helpers) => {
      // SECURITY FIX: Validate MongoDB ObjectId format to prevent injection
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('string.pattern.base');
      }
      return value;
    }).messages({
      'string.empty': 'Booking ID is required',
      'any.required': 'Booking ID is required',
      'string.pattern.base': 'Invalid booking ID format',
    }),
    sessionId: Joi.string().required().messages({
      'string.empty': 'Session ID is required',
      'any.required': 'Session ID is required',
    }),
  });

  const { error, value } = heartbeatSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { bookingId, sessionId } = value;
  const user = req.user as IUser;

  // Verify user owns the booking
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Check if user is the customer (owner) or the assigned provider
  const isCustomer = booking.customerId?.toString() === user._id.toString();
  const isProvider = booking.providerId.toString() === user._id.toString();

  if (!isCustomer && !isProvider && user.role !== 'admin') {
    throw new ApiError(403, 'You do not have permission to extend this slot lock');
  }

  const result = await bookingService.extendSlotLockHeartbeat(bookingId, sessionId);

  res.json({
    success: result.success,
    message: result.message,
    expiresIn: result.success ? 900 : 0, // SLOT_LOCK_TTL_SECONDS or 0 if failed
  });
  return;
}));

/**
 * @route   GET /api/payments/status/:bookingId
 * @desc    Get payment status for a booking
 * @access  Private (Customer or Provider owning the booking, or Admin)
 * @security Ownership check: Only booking owner (customer) or assigned provider can view payment status
 */
router.get('/status/:bookingId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = bookingIdParamSchema.validate(req.params);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { bookingId } = value;
  const user = req.user as IUser;

  // SECURITY FIX: Verify user owns the booking or is the assigned provider
  // Admins can view any booking's payment status
  if (user.role !== 'admin') {
    const booking = await Booking.findById(bookingId).lean();

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Check if user is the customer (owner) or the assigned provider
    const isCustomer = booking.customerId?.toString() === user._id.toString();
    const isProvider = booking.providerId.toString() === user._id.toString();

    if (!isCustomer && !isProvider) {
      throw new ApiError(403, 'You do not have permission to view this payment status');
    }
  }

  const status = await getPaymentStatus(bookingId);

  res.json({
    success: true,
    data: status,
  });
}));

/**
 * @route   POST /api/payments/refund/:bookingId
 * @desc    Create a refund for a booking
 * @access  Private (Admin or Provider who owns the booking)
 * @security Ownership check: Provider can only refund their own bookings
 */
router.post('/refund/:bookingId', paymentLimiter, authenticate, asyncHandler(async (req: Request, res: Response) => {
  const paramsError = bookingIdParamSchema.validate(req.params);
  if (paramsError.error) {
    throw new ApiError(400, paramsError.error.details[0].message);
  }

  const { bookingId } = paramsError.value;
  const { error: bodyError, value } = createRefundSchema.validate(req.body);
  if (bodyError) {
    throw new ApiError(400, bodyError.details[0].message);
  }

  const { amount } = value;
  const user = req.user as IUser;

  // Only admin or provider can issue refunds
  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to issue refunds');
  }

  // SECURITY FIX: Verify provider owns the booking being refunded
  // Admins can refund any booking, but providers can only refund their own
  if (user.role === 'provider') {
    const booking = await Booking.findById(bookingId).lean();

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Provider can only refund bookings assigned to them
    if (booking.providerId.toString() !== user._id.toString()) {
      logger.warn('Provider attempted to refund booking they do not own', {
        action: 'UNAUTHORIZED_REFUND_ATTEMPT',
        bookingId,
        providerId: user._id.toString(),
        bookingProviderId: booking.providerId.toString(),
      });
      throw new ApiError(403, 'You can only refund your own bookings');
    }
  }

  // Get or generate idempotency key
  const idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();

  // Check idempotency cache first to prevent duplicate refunds
  const cacheKey = `refund:idempotency:${idempotencyKey}`;
  const cachedResult = await cache.get(cacheKey);
  if (cachedResult) {
    logger.info('Returning cached refund result', {
      idempotencyKey,
      bookingId,
      amount,
      action: 'REFUND_IDEMPOTENT_HIT',
    });
    const parsed = JSON.parse(cachedResult);
    return res.json({
      success: true,
      message: parsed.message,
      data: {
        refundId: parsed.refundId,
        amount: parsed.amount,
      },
      cached: true,
      idempotencyKey,
    });
  }

  logger.info('Creating refund', {
    bookingId,
    amount,
    userId: user._id,
    userRole: user.role,
    idempotencyKey,
    action: 'CREATE_REFUND',
  });

  // Pass idempotency key to service for Stripe idempotency support
  const result = await createRefund(bookingId, amount, idempotencyKey);

  // Store result in cache for idempotency (24h TTL)
  await cache.set(
    cacheKey,
    JSON.stringify({ message: result.message, refundId: result.refundId, amount: result.amount }),
    IDEMPOTENCY_TTL
  );

  res.json({
    success: true,
    message: result.message,
    data: {
      refundId: result.refundId,
      amount: result.amount,
    },
    idempotencyKey,
  });
  return;
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
