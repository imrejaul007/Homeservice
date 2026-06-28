import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import { subscriptionService } from '../services/subscription.service';
import { membershipService } from '../services/membership.service';
import { CUSTOMER_SUBSCRIPTION_PLANS } from '../constants/subscriptionPlans';
import { MembershipTier } from '../models/premiumMembership.model';
import logger from '../utils/logger';
import type { ICustomerProfile } from '../models/customerProfile.model';
import mongoose from 'mongoose';
import customerController from '../controllers/customer.controller';
import { validate } from '../middleware/validation.middleware';
import Joi from 'joi';

const updatePaymentMethodSchema = Joi.object({
  isDefault: Joi.boolean(),
  nickname: Joi.string().max(50).allow(''),
});

const paymentMethodSchema = Joi.object({
  type: Joi.string().valid('card', 'apple_pay', 'google_pay').required(),
  token: Joi.string().required(),
  isDefault: Joi.boolean(),
});

const router = Router();

// Helper function to create dynamic Invoice model (same pattern as invoice.routes.ts)
const createInvoiceSchema = () => {
  const InvoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    type: {
      type: String,
      enum: ['booking', 'subscription', 'refund', 'adjustment'],
      default: 'booking'
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'refunded'],
      default: 'pending'
    },
    lineItems: [{
      description: { type: String, required: true },
      quantity: { type: Number, default: 1 },
      unitPrice: { type: Number, required: true },
      total: { type: Number, required: true }
    }],
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'AED' },
    dueDate: { type: Date },
    paidAt: { type: Date },
    sentAt: { type: Date },
    notes: { type: String },
    terms: { type: String },
    pdfUrl: { type: String }
  }, {
    timestamps: true
  });

  return mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
};

// ============================================
// BOOKING ENDPOINTS
// ============================================

/**
 * @route   POST /api/bookings/:id/reschedule
 * @desc    Reschedule an existing booking
 * @access  Private (Customer)
 */
router.post('/bookings/:id/reschedule', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newDate, newTime } = req.body;
  const userId = (req as any).user._id;

  if (!newDate || !newTime) {
    throw new ApiError(400, 'New date and time are required');
  }

  // Validate date format
  const newScheduledDate = new Date(`${newDate}T${newTime}`);
  if (isNaN(newScheduledDate.getTime())) {
    throw new ApiError(400, 'Invalid date or time format');
  }

  // Check if booking exists and belongs to user
  const booking = await Booking.findById(id);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Verify ownership (customer must own the booking)
  if (booking.customerId?.toString() !== userId.toString()) {
    throw new ApiError(403, 'Not authorized to reschedule this booking');
  }

  // Check if booking can be rescheduled
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new ApiError(400, 'Only pending or confirmed bookings can be rescheduled');
  }

  // Check provider settings for rescheduling
  const providerProfile = await ProviderProfile.findOne({ userId: booking.providerId });
  if (providerProfile && !providerProfile.settings.allowRescheduling) {
    throw new ApiError(400, 'Provider does not allow rescheduling');
  }

  // Check cancellation policy
  const now = new Date();
  const hoursUntilService = (newScheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilService < (providerProfile?.settings.cancellationPolicy.freeUntilHours || 0)) {
    throw new ApiError(400, 'Rescheduling not allowed this close to the service time');
  }

  // Update booking
  const oldScheduledDate = booking.scheduledDate;
  booking.scheduledDate = newScheduledDate;
  booking.scheduledTime = newTime;

  // Recalculate estimated end time
  const [hours, minutes] = newTime.split(':').map(Number);
  const serviceStart = new Date(newScheduledDate);
  serviceStart.setHours(hours, minutes, 0, 0);
  booking.estimatedEndTime = new Date(serviceStart.getTime() + (booking.duration * 60 * 1000));

  // Add to status history
  booking.statusHistory.push({
    status: booking.status,
    timestamp: new Date(),
    reason: 'rescheduled',
    updatedBy: 'customer',
    notes: `Rescheduled from ${oldScheduledDate.toISOString()} to ${newScheduledDate.toISOString()}`
  });

  await booking.save();

  logger.info('Booking rescheduled', {
    bookingId: id,
    userId,
    oldDate: oldScheduledDate,
    newDate: newScheduledDate,
    action: 'BOOKING_RESCHEDULED'
  });

  res.json({
    success: true,
    message: 'Booking rescheduled successfully',
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      oldScheduledDate,
      newScheduledDate,
      newScheduledTime: newTime
    }
  });
}));

// ============================================
// PAYMENT ENDPOINTS
// ============================================

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create a payment intent for a booking
 * @access  Private (Customer)
 */
router.post('/payments/create-intent', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, amount } = req.body;
  const userId = (req as any).user._id;

  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  // Validate booking exists and belongs to user
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.customerId?.toString() !== userId.toString()) {
    throw new ApiError(403, 'Not authorized to make payment for this booking');
  }

  // Use booking amount if not provided
  const paymentAmount = amount || booking.pricing.totalAmount;

  // Import payment service
  const { createPaymentIntent } = await import('../services/payment.service');
  const result = await createPaymentIntent(bookingId);

  logger.info('Payment intent created via marketplace', {
    bookingId,
    amount: paymentAmount,
    userId,
    action: 'CREATE_PAYMENT_INTENT'
  });

  res.json({
    success: true,
    message: 'Payment intent created',
    data: {
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      amount: paymentAmount
    }
  });
}));

/**
 * @route   POST /api/payments/refund/:bookingId
 * @desc    Process refund for a booking
 * @access  Private (Admin or Provider)
 */
router.post('/payments/refund/:bookingId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { amount } = req.body;
  const user = req as any;

  // Only admin or provider can issue refunds
  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to issue refunds');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Provider can only refund their own bookings
  if (user.role === 'provider') {
    const providerProfile = await ProviderProfile.findOne({ userId: user._id });
    if (!providerProfile || booking.providerId.toString() !== user._id.toString()) {
      throw new ApiError(403, 'Not authorized to refund this booking');
    }
  }

  // Import refund from payment service
  const { createRefund } = await import('../services/payment.service');
  const result = await createRefund(bookingId, amount);

  logger.info('Refund processed via marketplace', {
    bookingId,
    amount: result.amount,
    userId: user._id,
    userRole: user.role,
    action: 'REFUND_PROCESSED'
  });

  res.json({
    success: result.success,
    message: result.message,
    data: {
      refundId: result.refundId,
      amount: result.amount
    }
  });
}));

/**
 * @route   GET /api/payments/methods
 * @desc    Get user's saved payment methods (from both CustomerProfile and Stripe)
 * @access  Private
 */
router.get('/payments/methods', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  const CustomerProfileModel = (await import('../models/customerProfile.model')).default;
  const customerProfile = await CustomerProfileModel.findOne({ userId }) as ICustomerProfile | null;

  const { ensureStripeCustomerId } = await import('../utils/stripeCustomer');
  const stripeCustomerId = await ensureStripeCustomerId(userId);

  let stripePaymentMethods: any[] = [];
  let defaultPaymentMethodId: string | null = null;

  if (stripeCustomerId) {
    try {
      const { getStripeClient } = await import('../services/subscription.service');
      const stripe = getStripeClient();

      const stripeMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });

      const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId) as any;
      defaultPaymentMethodId = stripeCustomer?.invoice_settings?.default_payment_method || null;

      stripePaymentMethods = stripeMethods.data.map((pm: any) => ({
        id: pm.id,
        type: pm.type,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        funding: pm.card?.funding,
        country: pm.card?.country,
        isDefault: pm.id === defaultPaymentMethodId,
        source: 'stripe',
      }));
    } catch (stripeError) {
      logger.warn('Failed to fetch Stripe payment methods', {
        userId,
        error: (stripeError as Error).message,
        action: 'STRIPE_PAYMENT_METHODS_FETCH_FAILED',
      });
    }
  }

  const combinedMethods = [...stripePaymentMethods];
  const stripeMethodIds = stripePaymentMethods.map((pm: any) => pm.id);
  const localMethods = (customerProfile?.paymentMethods || []).filter(
    (m: any) => !m.stripePaymentMethodId || !stripeMethodIds.includes(m.stripePaymentMethodId)
  );

  localMethods.forEach((method: any) => {
    combinedMethods.push({
      id: method._id,
      type: method.type,
      brand: method.brand,
      last4: method.last4,
      expMonth: method.expiryMonth,
      expYear: method.expiryYear,
      isDefault: method.isDefault && combinedMethods.length === 0,
      source: 'local',
    });
  });

  const defaultMethod = combinedMethods.find((m: any) => m.isDefault) || combinedMethods[0];

  res.json({
    success: true,
    data: {
      paymentMethods: combinedMethods.map((method: any) => ({
        ...method,
        _id: method._id || method.id,
        id: method.id || method._id,
        expiryMonth: method.expiryMonth ?? method.expMonth,
        expiryYear: method.expiryYear ?? method.expYear,
      })),
      defaultMethod: defaultMethod
        ? {
            ...defaultMethod,
            _id: defaultMethod._id || defaultMethod.id,
            id: defaultMethod.id || defaultMethod._id,
          }
        : null,
      hasStripeCustomer: !!stripeCustomerId,
    },
  });
}));

/**
 * @route   POST /api/payments/methods
 * @desc    Add a new payment method (Stripe)
 * @access  Private
 */
router.post('/payments/methods', authenticate, validate(paymentMethodSchema), customerController.addPaymentMethod);

/**
 * @route   DELETE /api/payments/methods/:paymentMethodId
 * @desc    Remove a saved payment method
 * @access  Private
 */
router.delete(
  '/payments/methods/:paymentMethodId',
  authenticate,
  customerController.deletePaymentMethod
);

/**
 * @route   PATCH /api/payments/methods/:paymentMethodId
 * @desc    Update payment method (e.g. set default)
 * @access  Private
 */
router.patch(
  '/payments/methods/:paymentMethodId',
  authenticate,
  validate(updatePaymentMethodSchema),
  customerController.updatePaymentMethod
);

// Legacy POST handler removed — use customerController Stripe integration above

// ============================================
// SUBSCRIPTION ENDPOINTS
// ============================================

/**
 * @route   GET /api/subscription/current
 * @desc    Get current user's subscription
 * @access  Private
 */
router.get('/subscription/current', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  const subscription = await subscriptionService.getSubscriptionByUserId(userId);

  if (!subscription) {
    // Return full free tier subscription object
    return res.json({
      success: true,
      data: {
        _id: null,
        userId: userId,
        plan: 'free',
        tier: 'free',
        status: 'active',
        billingCycle: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        price: 0,
        currency: 'AED',
        cancelAtPeriodEnd: false,
        features: CUSTOMER_SUBSCRIPTION_PLANS.free.features,
        usage: {
          bookingsThisMonth: 0,
          bookingsLimit: 2,
          featuredListingsUsed: 0,
          featuredListingsLimit: 0
        },
        limits: {
          bookingsPerMonth: 2,
          featuredListings: 0
        }
      }
    });
  }

  return res.json({
    success: true,
    data: {
      _id: subscription._id,
      userId: subscription.userId,
      id: subscription._id,
      plan: subscription.plan,
      tier: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      price: subscription.price,
      currency: subscription.currency,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      features: CUSTOMER_SUBSCRIPTION_PLANS[subscription.plan]?.features || CUSTOMER_SUBSCRIPTION_PLANS.free.features,
      usage: subscription.usage
    }
  });
}));

/**
 * @route   POST /api/subscription/create
 * @desc    Create a new subscription
 * @access  Private
 */
router.post('/subscription/create', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { tier, billingCycle, paymentMethodId } = req.body;
  const userId = (req as any).user._id;

  if (!tier) {
    throw new ApiError(400, 'Subscription tier is required');
  }

  const validTiers = ['free', 'basic', 'premium', 'enterprise'];
  if (!validTiers.includes(tier)) {
    throw new ApiError(400, `Invalid tier. Must be one of: ${validTiers.join(', ')}`);
  }

  if (tier !== 'free' && !paymentMethodId) {
    throw new ApiError(400, 'Payment method required for paid plans');
  }

  const validBillingCycles = ['monthly', 'yearly'];
  if (billingCycle && !validBillingCycles.includes(billingCycle)) {
    throw new ApiError(400, 'Invalid billing cycle');
  }

  const subscription = await subscriptionService.createSubscription({
    userId: userId.toString(),
    plan: tier as any,
    billingCycle: billingCycle || 'monthly',
    paymentMethodId
  });

  logger.info('Subscription created via marketplace', {
    userId,
    tier,
    billingCycle,
    action: 'SUBSCRIPTION_CREATED'
  });

  res.json({
    success: true,
    message: 'Subscription created successfully',
    data: {
      id: subscription._id,
      tier: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd
    }
  });
}));

/**
 * @route   POST /api/subscription/cancel
 * @desc    Cancel current subscription
 * @access  Private
 */
router.post('/subscription/cancel', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { immediate, reason } = req.body;
  const userId = (req as any).user._id;

  try {
    const subscription = await subscriptionService.cancelSubscription(userId.toString(), {
      immediate: immediate || false,
      reason: reason || 'User requested cancellation'
    });

    logger.info('Subscription cancelled via marketplace', {
      userId,
      immediate,
      action: 'SUBSCRIPTION_CANCELLED'
    });

    res.json({
      success: true,
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at period end',
      data: {
        tier: subscription.plan,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new ApiError(404, 'No active subscription found');
    }
    throw error;
  }
}));

/**
 * @route   POST /api/subscription/upgrade
 * @desc    Upgrade subscription tier
 * @access  Private
 */
router.post('/subscription/upgrade', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { tier, billingCycle } = req.body;
  const userId = (req as any).user._id;

  if (!tier) {
    throw new ApiError(400, 'Target tier is required');
  }

  const validBillingCycles = ['monthly', 'yearly'];
  if (billingCycle && !validBillingCycles.includes(billingCycle)) {
    throw new ApiError(400, 'Invalid billing cycle');
  }

  try {
    const subscription = await subscriptionService.changePlan(userId.toString(), tier as any, {
      billingCycle,
      immediate: true,
      reason: 'User requested upgrade'
    });

    logger.info('Subscription upgraded via marketplace', {
      userId,
      newTier: tier,
      action: 'SUBSCRIPTION_UPGRADED'
    });

    res.json({
      success: true,
      message: 'Subscription upgraded successfully',
      data: {
        tier: subscription.plan,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        price: subscription.price
      }
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new ApiError(404, 'No active subscription found');
    }
    throw error;
  }
}));

/**
 * @route   GET /api/subscription/plans
 * @desc    Get available subscription plans
 * @access  Public
 */
router.get('/subscription/plans', asyncHandler(async (_req: Request, res: Response) => {
  const plans = {
    free: {
      name: 'Free',
      price: 0,
      billingCycle: null,
      features: [
        'Browse and search providers',
        'Book up to 2 services per month',
        'Standard support',
        'Basic provider profiles'
      ],
      limits: {
        bookingsPerMonth: 2,
        featuredListings: 0,
        prioritySupport: false,
        analytics: false
      }
    },
    basic: {
      name: 'Basic',
      price: 29,
      billingCycle: 'monthly',
      features: [
        'Everything in Free',
        'Book up to 10 services per month',
        'Priority support',
        'Full provider profiles',
        'Basic analytics'
      ],
      limits: {
        bookingsPerMonth: 10,
        featuredListings: 1,
        prioritySupport: true,
        analytics: true
      }
    },
    premium: {
      name: 'Premium',
      price: 79,
      billingCycle: 'monthly',
      features: [
        'Everything in Basic',
        'Unlimited bookings',
        'Featured provider listings',
        'Advanced analytics',
        'Exclusive deals and offers',
        'Early access to new features'
      ],
      limits: {
        bookingsPerMonth: -1, // unlimited
        featuredListings: 5,
        prioritySupport: true,
        analytics: true
      }
    },
    enterprise: {
      name: 'Enterprise',
      price: 199,
      billingCycle: 'monthly',
      features: [
        'Everything in Premium',
        'Dedicated account manager',
        'Custom integrations',
        'API access',
        'Volume discounts',
        'White-label options'
      ],
      limits: {
        bookingsPerMonth: -1,
        featuredListings: -1,
        prioritySupport: true,
        analytics: true,
        apiAccess: true,
        whiteLabel: true
      }
    }
  };

  res.json({
    success: true,
    data: plans
  });
}));

/**
 * @route   GET /api/subscription/usage
 * @desc    Get current subscription usage
 * @access  Private
 */
router.get('/subscription/usage', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  const usage = await subscriptionService.getUsageStats(userId.toString());

  res.json({
    success: true,
    data: usage
  });
}));

/**
 * @route   POST /api/subscription/reactivate
 * @desc    Reactivate a subscription scheduled for cancellation
 * @access  Private
 */
router.post('/subscription/reactivate', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const subscription = await subscriptionService.reactivateSubscription(userId);

  res.json({
    success: true,
    message: 'Subscription reactivated successfully',
    data: {
      tier: subscription.plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  });
}));

/**
 * @route   PATCH /api/subscription/plan
 * @desc    Change subscription plan
 * @access  Private
 */
router.patch('/subscription/plan', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { plan, tier, billingCycle, immediate, reason } = req.body;
  const newPlan = plan || tier;

  if (!newPlan) {
    throw new ApiError(400, 'Plan is required');
  }

  const subscription = await subscriptionService.changePlan(userId, newPlan, {
    billingCycle,
    immediate,
    reason,
  });

  res.json({
    success: true,
    message: 'Subscription plan updated',
    data: {
      tier: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  });
}));

/**
 * @route   PATCH /api/subscription/payment-method
 * @desc    Update subscription payment method
 * @access  Private
 */
router.patch('/subscription/payment-method', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { paymentMethodId } = req.body;

  if (!paymentMethodId) {
    throw new ApiError(400, 'Payment method ID is required');
  }

  const subscription = await subscriptionService.updatePaymentMethod(userId, paymentMethodId);

  res.json({
    success: true,
    message: 'Payment method updated',
    data: {
      tier: subscription.plan,
      status: subscription.status,
    },
  });
}));

/**
 * @route   GET /api/subscription/history
 * @desc    Get subscription billing history
 * @access  Private
 */
router.get('/subscription/history', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { page, limit } = req.query;

  const history = await subscriptionService.getBillingHistory(userId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({ success: true, data: history });
}));

/**
 * @route   GET /api/subscription/permissions/:action
 * @desc    Check subscription permission for an action
 * @access  Private
 */
router.get('/subscription/permissions/:action', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const action = req.params.action as 'booking' | 'featuredListing';

  if (!['booking', 'featuredListing'].includes(action)) {
    throw new ApiError(400, 'Invalid action. Must be booking or featuredListing');
  }

  const result = await subscriptionService.checkPermission(userId, action);

  res.json({ success: true, data: result });
}));

// Plural aliases for frontend compatibility
router.get('/subscriptions/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const subscription = await subscriptionService.getSubscriptionByUserId(userId);

  if (!subscription) {
    return res.json({
      success: true,
      data: {
        plan: 'free',
        tier: 'free',
        status: 'active',
        features: CUSTOMER_SUBSCRIPTION_PLANS.free.features,
      },
    });
  }

  return res.json({
    success: true,
    data: {
      id: subscription._id,
      plan: subscription.plan,
      tier: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd,
      price: subscription.price,
      currency: subscription.currency,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      features: CUSTOMER_SUBSCRIPTION_PLANS[subscription.plan]?.features || CUSTOMER_SUBSCRIPTION_PLANS.free.features,
      usage: subscription.usage,
    },
  });
}));

router.get('/subscriptions/plans', asyncHandler(async (_req: Request, res: Response) => {
  const plans = Object.entries(CUSTOMER_SUBSCRIPTION_PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    price: plan.price,
    currency: 'AED',
    features: plan.features,
    limits: plan.limits,
  }));
  res.json({ success: true, data: plans });
}));

router.post('/subscriptions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { plan, tier, billingCycle, paymentMethodId } = req.body;
  const selectedTier = tier || plan;
  const userId = (req as any).user._id;

  if (!selectedTier) {
    throw new ApiError(400, 'Subscription tier is required');
  }

  const subscription = await subscriptionService.createSubscription({
    userId: userId.toString(),
    plan: selectedTier,
    billingCycle: billingCycle || 'monthly',
    paymentMethodId,
  });

  res.json({
    success: true,
    data: {
      id: subscription._id,
      tier: subscription.plan,
      plan: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  });
}));

router.patch('/subscriptions/plan', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { plan, tier, billingCycle, immediate, reason } = req.body;
  const newPlan = plan || tier;
  if (!newPlan) throw new ApiError(400, 'Plan is required');
  const subscription = await subscriptionService.changePlan(userId, newPlan, { billingCycle, immediate, reason });
  res.json({
    success: true,
    data: {
      tier: subscription.plan,
      plan: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  });
}));

router.post('/subscriptions/cancel', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { immediate, reason } = req.body;
  const subscription = await subscriptionService.cancelSubscription(userId, { immediate, reason });
  res.json({
    success: true,
    data: {
      tier: subscription.plan,
      plan: subscription.plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  });
}));

router.post('/subscriptions/reactivate', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const subscription = await subscriptionService.reactivateSubscription(userId);
  res.json({
    success: true,
    data: {
      tier: subscription.plan,
      plan: subscription.plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
  });
}));

router.patch('/subscriptions/payment-method', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { paymentMethodId } = req.body;
  if (!paymentMethodId) throw new ApiError(400, 'Payment method ID is required');
  const subscription = await subscriptionService.updatePaymentMethod(userId, paymentMethodId);
  res.json({
    success: true,
    data: { tier: subscription.plan, plan: subscription.plan, status: subscription.status },
  });
}));

router.get('/subscriptions/usage', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const usage = await subscriptionService.getUsageStats(userId);
  res.json({ success: true, data: usage });
}));

router.get('/subscriptions/permissions/:action', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const action = req.params.action as 'booking' | 'featuredListing';
  const result = await subscriptionService.checkPermission(userId, action);
  res.json({ success: true, data: result });
}));

router.get('/subscriptions/history', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { page, limit } = req.query;
  const history = await subscriptionService.getBillingHistory(userId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, data: history });
}));

/**
 * @route   GET /api/subscriptions/invoices
 * @desc    Get invoices for the current user's subscription
 * @access  Private
 */
router.get('/subscriptions/invoices', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const { page = 1, limit = 10, status } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Build query for subscription invoices
  const query: any = {
    customerId: userId,
    type: { $in: ['subscription', 'booking'] },
  };

  // Filter by status if provided
  if (status && typeof status === 'string') {
    query.status = status;
  }

  const Invoice = createInvoiceSchema();
  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('customerId', 'firstName lastName email')
      .populate('providerId', 'firstName lastName businessName'),
    Invoice.countDocuments(query),
  ]);

  // Transform invoices for frontend
  const transformedInvoices = invoices.map((inv: any) => ({
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    type: inv.type || 'subscription',
    status: inv.status,
    customerId: inv.customerId?._id?.toString() || userId.toString(),
    customerName: inv.customerId
      ? `${inv.customerId.firstName || ''} ${inv.customerId.lastName || ''}`.trim()
      : 'Customer',
    customerEmail: inv.customerId?.email || '',
    items: (inv.lineItems || []).map((item: any, index: number) => ({
      id: `${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.total,
    })),
    subtotal: inv.subtotal || 0,
    taxRate: inv.taxRate || 0,
    taxAmount: inv.taxAmount || 0,
    discountAmount: inv.discount || 0,
    totalAmount: inv.total || 0,
    currency: inv.currency || 'AED',
    dueDate: inv.dueDate?.toISOString(),
    paidAt: inv.paidAt?.toISOString(),
    sentAt: inv.sentAt?.toISOString(),
    notes: inv.notes,
    pdfUrl: inv.pdfUrl,
    createdAt: inv.createdAt?.toISOString(),
    updatedAt: inv.updatedAt?.toISOString(),
  }));

  res.json({
    success: true,
    data: {
      invoices: transformedInvoices,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}));

/**
 * @route   GET /api/subscriptions/invoices/:id/pdf
 * @desc    Download invoice as PDF
 * @access  Private
 */
router.get('/subscriptions/invoices/:id/pdf', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user._id;

  const Invoice = createInvoiceSchema();

  // Find the invoice
  const invoice = await Invoice.findById(id);

  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  // Verify ownership
  if (invoice.customerId?.toString() !== userId.toString()) {
    throw new ApiError(403, 'Not authorized to access this invoice');
  }

  // Get PDF service
  const { pdfService } = await import('../services/pdf.service');

  // Generate or fetch PDF
  try {
    const pdfBuffer = await pdfService.generateInvoicePDF(invoice.toObject());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Failed to generate invoice PDF', {
      invoiceId: id,
      error: (error as Error).message,
      action: 'INVOICE_PDF_GENERATION_FAILED'
    });

    // Fallback: return a simple PDF or error
    throw new ApiError(500, 'Failed to generate invoice PDF');
  }
}));

/**
 * @route   GET /api/subscriptions/invoices/:id/pdf-url
 * @desc    Get signed URL for invoice PDF
 * @access  Private
 */
router.get('/subscriptions/invoices/:id/pdf-url', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user._id;

  const Invoice = createInvoiceSchema();

  // Find the invoice
  const invoice = await Invoice.findById(id);

  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  // Verify ownership
  if (invoice.customerId?.toString() !== userId.toString()) {
    throw new ApiError(403, 'Not authorized to access this invoice');
  }

  // For simplicity, we'll return a URL that can be used to download the PDF
  // In production, this would generate a signed URL with expiry
  const pdfUrl = `/api/subscriptions/invoices/${id}/pdf`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  res.json({
    success: true,
    data: {
      url: pdfUrl,
      expiresAt: expiresAt.toISOString(),
    },
  });
}));

// ============================================
// ADMIN SUBSCRIPTION & MEMBERSHIP
// ============================================

router.get('/admin/subscriptions', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status, plan } = req.query;
  const result = await subscriptionService.getAllSubscriptions({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: status as any,
    plan: plan as any,
  });
  res.json({ success: true, data: result });
}));

router.get('/admin/subscriptions/stats', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const stats = await subscriptionService.getStats();
  res.json({ success: true, data: stats });
}));

router.get('/admin/memberships', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, tier, status } = req.query;
  const result = await membershipService.getAllMemberships({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    tier: tier as MembershipTier | undefined,
    status: status as string | undefined,
  });
  res.json({ success: true, data: result });
}));

router.get('/admin/memberships/stats', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const stats = await membershipService.getStats();
  res.json({ success: true, data: stats });
}));

// ============================================
// ADMIN PROVIDER MANAGEMENT
// ============================================

/**
 * @route   GET /api/admin/providers/pending
 * @desc    Get list of pending providers
 * @access  Admin
 */
router.get('/admin/providers/pending', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [providers, total] = await Promise.all([
    ProviderProfile.find({ 'verificationStatus.overall': 'pending' })
      .populate('userId', 'firstName lastName email phone createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'pending' })
  ]);

  res.json({
    success: true,
    data: {
      providers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

/**
 * @route   POST /api/admin/providers/:id/approve
 * @desc    Approve a provider
 * @access  Admin
 */
router.post('/admin/providers/:id/approve', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body;

  const provider = await ProviderProfile.findById(id);
  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall === 'approved') {
    throw new ApiError(400, 'Provider is already approved');
  }

  provider.verificationStatus.overall = 'approved';
  provider.verificationStatus.adminNotes = notes || 'Approved by admin';
  await provider.save();

  // Update user account status
  await User.findByIdAndUpdate(provider.userId, { accountStatus: 'active' });

  logger.info('Provider approved via marketplace admin', {
    providerId: id,
    adminId: (req as any).user._id,
    action: 'PROVIDER_APPROVED'
  });

  res.json({
    success: true,
    message: 'Provider approved successfully',
    data: {
      providerId: provider._id,
      status: provider.verificationStatus.overall,
      approvedAt: new Date()
    }
  });
}));

/**
 * @route   POST /api/admin/providers/:id/reject
 * @desc    Reject a provider
 * @access  Admin
 */
router.post('/admin/providers/:id/reject', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, notes } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const provider = await ProviderProfile.findById(id);
  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall === 'rejected') {
    throw new ApiError(400, 'Provider is already rejected');
  }

  provider.verificationStatus.overall = 'rejected';
  provider.verificationStatus.adminNotes = notes || `Rejected: ${reason}`;
  await provider.save();

  // Update user account status
  await User.findByIdAndUpdate(provider.userId, { accountStatus: 'suspended' });

  logger.info('Provider rejected via marketplace admin', {
    providerId: id,
    reason,
    adminId: (req as any).user._id,
    action: 'PROVIDER_REJECTED'
  });

  res.json({
    success: true,
    message: 'Provider rejected',
    data: {
      providerId: provider._id,
      status: provider.verificationStatus.overall,
      reason,
      rejectedAt: new Date()
    }
  });
}));

/**
 * @route   GET /api/admin/providers/stats
 * @desc    Get provider verification stats
 * @access  Admin
 */
router.get('/admin/providers/stats', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const [pending, approved, rejected, total] = await Promise.all([
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'pending' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'approved' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'rejected' }),
    ProviderProfile.countDocuments()
  ]);

  // Get recent activity
  const recentSubmissions = await ProviderProfile.find({
    'verificationStatus.overall': 'pending'
  })
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      stats: {
        pending,
        approved,
        rejected,
        total,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
      },
      recentSubmissions: recentSubmissions.map(p => ({
        providerId: p._id,
        businessName: p.businessInfo.businessName,
        submittedAt: p.createdAt,
        user: p.userId
      }))
    }
  });
}));

// Analytics funnel/geographic: use canonical routes in analytics.routes.ts (/api/analytics/funnel, /api/analytics/geographic)

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Admin
 */
router.get('/analytics/revenue', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get revenue from completed bookings
  const [thisMonthBookings, lastMonthBookings, allTimeBookings] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalAmount' },
          count: { $sum: 1 },
          avgValue: { $avg: '$pricing.totalAmount' }
        }
      }
    ]),
    Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]),
    Booking.aggregate([
      {
        $match: {
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalAmount' },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const thisMonthTotal = thisMonthBookings[0]?.total || 0;
  const lastMonthTotal = lastMonthBookings[0]?.total || 0;
  const total = allTimeBookings[0]?.total || 0;

  const growth = lastMonthTotal > 0
    ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 10000) / 100
    : 0;

  // Daily revenue for this month
  const dailyRevenue = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$pricing.totalAmount' },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: {
      summary: {
        total,
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        growth,
        thisMonthBookings: thisMonthBookings[0]?.count || 0,
        avgBookingValue: thisMonthBookings[0]?.avgValue || 0
      },
      dailyRevenue,
      currency: 'AED'
    }
  });
}));

/**
 * @route   GET /api/analytics/provider/:providerId
 * @desc    Get analytics for specific provider
 * @access  Admin or Provider (own)
 */
router.get('/analytics/provider/:providerId([0-9a-fA-F]{24})', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const user = req.user as any;

  // Check authorization
  if (user.role !== 'admin' && user._id.toString() !== providerId) {
    throw new ApiError(403, 'Not authorized to view these analytics');
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    providerBookings,
    lastMonthBookings,
    providerProfile
  ] = await Promise.all([
    Booking.find({
      providerId,
      createdAt: { $gte: startOfMonth }
    }).populate('customerId', 'firstName lastName'),
    Booking.countDocuments({
      providerId,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    }),
    ProviderProfile.findOne({ userId: providerId })
  ]);

  const completedBookings = providerBookings.filter(b => b.status === 'completed');
  const cancelledBookings = providerBookings.filter(b => b.status === 'cancelled');

  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);
  const lastMonthRevenue = await Booking.aggregate([
    {
      $match: {
        providerId: providerProfile?._id,
        status: 'completed',
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$pricing.totalAmount' }
      }
    }
  ]);

  const revenue = lastMonthRevenue[0]?.total || 0;
  const growth = revenue > 0
    ? Math.round(((totalRevenue - revenue) / revenue) * 10000) / 100
    : 0;

  res.json({
    success: true,
    data: {
      providerId,
      period: 'this_month',
      stats: {
        totalBookings: providerBookings.length,
        completedBookings: completedBookings.length,
        cancelledBookings: cancelledBookings.length,
        pendingBookings: providerBookings.filter(b => b.status === 'pending').length,
        totalRevenue,
        avgBookingValue: completedBookings.length > 0
          ? totalRevenue / completedBookings.length
          : 0,
        growth
      },
      rating: providerProfile?.reviewsData?.averageRating || 0,
      totalReviews: providerProfile?.reviewsData?.totalReviews || 0,
      recentBookings: providerBookings.slice(0, 10).map(b => ({
        id: b._id,
        bookingNumber: b.bookingNumber,
        status: b.status,
        customer: b.customerId,
        totalAmount: b.pricing?.totalAmount,
        scheduledDate: b.scheduledDate,
        createdAt: b.createdAt
      }))
    }
  });
}));

export default router;
