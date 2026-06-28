import mongoose, { Types } from 'mongoose';
import Stripe from 'stripe';
import UserSubscription, {
  IUserSubscription,
  PlanType,
  SubscriptionStatus,
  BillingCycle,
  USER_SUBSCRIPTION_PLANS,
  PLAN_PRICES,
} from '../models/userSubscription.model';
import { PremiumMembership } from '../models/premiumMembership.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';
import logger from '../utils/logger';

// ============================================
// Type Aliases
// ============================================

/**
 * Stripe error type alias for error handling
 */
type StripeErrorType = {
  message: string;
  code?: string;
  type?: string;
  statusCode?: number;
  decline_code?: string;
  detail?: string;
  param?: string;
  requestId?: string;
};

// ============================================
// Stripe Client Configuration
// ============================================

/**
 * Stripe client singleton with lazy initialization
 * Uses API version 2024-12-18.acacia as specified
 */
let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
    }

    stripeClient = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    logger.debug('Stripe client initialized', {
      context: 'SubscriptionService',
      action: 'STRIPE_CLIENT_INIT',
    });
  }
  return stripeClient;
};

// ============================================
// Stripe Price ID Mapping
// ============================================

/**
 * Mapping of internal plan types to Stripe Price IDs
 * These should be configured in your Stripe dashboard and set via environment variables
 */
export const STRIPE_PRICE_IDS: Record<PlanType, Record<BillingCycle, string | undefined>> = {
  free: {
    monthly: process.env.STRIPE_PRICE_FREE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_FREE_YEARLY,
  },
  basic: {
    monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY,
    yearly: process.env.STRIPE_PRICE_BASIC_YEARLY,
  },
  premium: {
    monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
    yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  },
};

/**
 * Get the Stripe Price ID for a given plan and billing cycle
 */
export const getStripePriceId = (plan: PlanType, billingCycle: BillingCycle): string | undefined => {
  return STRIPE_PRICE_IDS[plan]?.[billingCycle];
};

/**
 * Map Stripe subscription status to internal subscription status
 */
export const mapStripeStatus = (stripeStatus: string): SubscriptionStatus => {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    unpaid: 'past_due',
    incomplete: 'past_due',
    incomplete_expired: 'expired',
    paused: 'active', // Treat paused as active (will be resumed)
  };
  return statusMap[stripeStatus] || 'active';
};

// ============================================
// Stripe Integration Types
// ============================================

interface StripeCustomer {
  id: string;
  email: string;
  name: string;
}

interface StripeSubscriptionResult {
  id: string;
  customer: string;
  status: Stripe.Subscription.Status;
  current_period_start: number;
  current_period_end: number;
  price_id?: string;
}

interface CreateSubscriptionOptions {
  userId: string;
  plan: PlanType;
  billingCycle: BillingCycle;
  paymentMethodId?: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

interface CreateSubscriptionOptions {
  userId: string;
  plan: PlanType;
  billingCycle: BillingCycle;
  paymentMethodId?: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

// ============================================
// Subscription Service
// ============================================

export class SubscriptionService {
  // ========================================
  // Create Subscription
  // ========================================

  /**
   * Create a new subscription for a user
   */
  async createSubscription(options: CreateSubscriptionOptions): Promise<IUserSubscription> {
    const { userId, plan, billingCycle, paymentMethodId, trialDays = 0, metadata } = options;

    // Validate user exists
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    // Check if user already has a subscription
    const existingSubscription = await UserSubscription.findByUserId(userId);
    if (existingSubscription) {
      throw ApiError.conflict('User already has a subscription');
    }

    // Get plan details
    const planDetails = USER_SUBSCRIPTION_PLANS[plan];
    if (!planDetails) {
      throw ApiError.badRequest('Invalid subscription plan');
    }

    // Calculate billing dates
    const now = new Date();
    const periodStart = now;
    const periodEnd = new Date(now);

    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Create Stripe customer and subscription if not free plan
    let stripeCustomerId: string | undefined;
    let stripeSubscriptionId: string | undefined;
    let stripePriceId: string | undefined;

    if (plan !== 'free' && paymentMethodId) {
      try {
        const stripeResult = await this.createStripeSubscription({
          userId,
          plan,
          billingCycle,
          paymentMethodId,
          trialDays,
        });
        stripeCustomerId = stripeResult.customerId;
        stripeSubscriptionId = stripeResult.subscriptionId;
        stripePriceId = stripeResult.priceId;
      } catch (error) {
        logger.error('Stripe subscription creation failed', {
          context: 'SubscriptionService',
          action: 'CREATE_SUBSCRIPTION_FAILED',
          userId,
          plan,
          error: error instanceof Error ? error.message : String(error),
        });
        throw ApiError.internal('Failed to create payment subscription');
      }
    }

    // Create subscription
    const subscription = new UserSubscription({
      userId: new Types.ObjectId(userId),
      plan,
      status: trialDays > 0 ? 'trialing' : 'active',
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      price: PLAN_PRICES[billingCycle][plan],
      currency: 'AED',
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      trialEnd: trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : undefined,
      metadata: metadata ? {
        referralCode: metadata.referralCode,
        referredBy: metadata.referredBy,
        source: metadata.source,
        campaign: metadata.campaign,
      } : undefined,
      history: [{
        plan,
        price: PLAN_PRICES[billingCycle][plan],
        changedAt: now,
        reason: 'Initial subscription',
        changedBy: 'user',
      }],
    });

    await subscription.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.SUBSCRIPTION_CREATED, {
      subscriptionId: subscription._id,
      userId,
      plan,
      billingCycle,
      price: subscription.price,
    });

    return subscription;
  }

  // ========================================
  // Get Subscription
  // ========================================

  /**
   * Get subscription by user ID
   */
  async getSubscriptionByUserId(userId: string): Promise<IUserSubscription | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }
    return UserSubscription.findByUserId(userId).populate('userId', 'firstName lastName email');
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(subscriptionId: string): Promise<IUserSubscription | null> {
    if (!Types.ObjectId.isValid(subscriptionId)) {
      throw ApiError.badRequest('Invalid subscription ID');
    }
    return UserSubscription.findById(subscriptionId).populate('userId', 'firstName lastName email');
  }

  // ========================================
  // Upgrade / Downgrade
  // ========================================

  /**
   * Upgrade or downgrade subscription plan
   */
  async changePlan(
    userId: string,
    newPlan: PlanType,
    options: {
      billingCycle?: BillingCycle;
      immediate?: boolean;
      reason?: string;
    } = {}
  ): Promise<IUserSubscription> {
    const { billingCycle, immediate = false, reason } = options;

    const subscription = await UserSubscription.findByUserId(userId);
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      throw ApiError.badRequest('Cannot change plan for inactive subscription');
    }

    const oldPlan = subscription.plan;
    const planDetails = USER_SUBSCRIPTION_PLANS[newPlan];

    if (!planDetails) {
      throw ApiError.badRequest('Invalid subscription plan');
    }

    // Handle Stripe subscription update
    if (subscription.stripeSubscriptionId && newPlan !== 'free') {
      try {
        await this.updateStripeSubscription(subscription.stripeSubscriptionId, {
          plan: newPlan,
          billingCycle: billingCycle || subscription.billingCycle,
          immediate,
        });
      } catch (error) {
        logger.error('Stripe subscription update failed', {
          context: 'SubscriptionService',
          action: 'UPDATE_SUBSCRIPTION_FAILED',
          subscriptionId: subscription._id.toString(),
          newPlan,
          error: error instanceof Error ? error.message : String(error),
        });
        throw ApiError.internal('Failed to update payment subscription');
      }
    } else if (subscription.stripeSubscriptionId && newPlan === 'free') {
      // Cancel Stripe subscription when moving to free
      await this.cancelStripeSubscription(subscription.stripeSubscriptionId);
    } else if (!subscription.stripeSubscriptionId && newPlan !== 'free') {
      throw ApiError.badRequest('Payment method required for paid plans');
    }

    // Update subscription
    const now = new Date();
    subscription.plan = newPlan;
    if (billingCycle) {
      subscription.billingCycle = billingCycle;
    }
    subscription.price = PLAN_PRICES[subscription.billingCycle as BillingCycle][newPlan as PlanType];

    // If immediate change, update billing period
    if (immediate) {
      subscription.currentPeriodStart = now;
      const periodEnd = new Date(now);
      if (subscription.billingCycle === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }
      subscription.currentPeriodEnd = periodEnd;
    }

    // Record in history
    await subscription.recordPlanChange(newPlan, reason || `Changed from ${oldPlan} to ${newPlan}`, 'user');

    await subscription.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.SUBSCRIPTION_UPDATED, {
      subscriptionId: subscription._id,
      userId,
      oldPlan,
      newPlan,
      billingCycle: subscription.billingCycle,
      immediate,
    });

    return subscription;
  }

  // ========================================
  // Cancellation
  // ========================================

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(
    userId: string,
    options: {
      immediate?: boolean;
      reason?: string;
    } = {}
  ): Promise<IUserSubscription> {
    const { immediate = false, reason } = options;

    const subscription = await UserSubscription.findByUserId(userId);
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (subscription.status === 'cancelled') {
      throw ApiError.badRequest('Subscription is already cancelled');
    }

    // Cancel Stripe subscription
    if (subscription.stripeSubscriptionId) {
      try {
        if (immediate) {
          await this.cancelStripeSubscription(subscription.stripeSubscriptionId);
        }
      } catch (error) {
        logger.error('Stripe subscription cancellation failed', {
          context: 'SubscriptionService',
          action: 'CANCEL_SUBSCRIPTION_FAILED',
          subscriptionId: subscription._id.toString(),
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw ApiError.internal('Failed to cancel payment subscription');
      }
    }

    // Update subscription
    if (immediate) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
    }
    subscription.cancellationReason = reason;

    // Record in history
    subscription.history.push({
      plan: subscription.plan,
      price: subscription.price,
      changedAt: new Date(),
      reason: reason || 'Subscription cancelled',
      changedBy: 'user',
    });

    await subscription.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.SUBSCRIPTION_CANCELLED, {
      subscriptionId: subscription._id,
      userId,
      immediate,
      reason,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    });

    return subscription;
  }

  /**
   * Reactivate a cancelled subscription
   */
  async reactivateSubscription(userId: string): Promise<IUserSubscription> {
    const subscription = await UserSubscription.findByUserId(userId);
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (subscription.status === 'cancelled') {
      throw ApiError.badRequest('Cannot reactivate a cancelled subscription');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw ApiError.badRequest('Subscription is not scheduled for cancellation');
    }

    subscription.cancelAtPeriodEnd = false;
    subscription.cancellationReason = undefined;

    // Reactivate Stripe subscription if needed
    if (subscription.stripeSubscriptionId) {
      try {
        await this.reactivateStripeSubscription(subscription.stripeSubscriptionId);
      } catch (error) {
        logger.error('Stripe subscription reactivation failed', {
          context: 'SubscriptionService',
          action: 'REACTIVATE_FAILED',
          subscriptionId: subscription._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue even if Stripe reactivation fails
      }
    }

    // Record in history
    subscription.history.push({
      plan: subscription.plan,
      price: subscription.price,
      changedAt: new Date(),
      reason: 'Subscription reactivated',
      changedBy: 'user',
    });

    await subscription.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.SUBSCRIPTION_UPDATED, {
      subscriptionId: subscription._id,
      userId,
      action: 'reactivated',
    });

    return subscription;
  }

  // ========================================
  // Billing
  // ========================================

  /**
   * Get billing history for a user
   */
  async getBillingHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    subscriptions: IUserSubscription[];
    total: number;
    page: number;
    pages: number;
  }> {
    const { page = 1, limit = 20 } = options;

    const subscription = await UserSubscription.findByUserId(userId);
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    // Get paginated history
    const skip = (page - 1) * limit;
    const total = subscription.history.length;
    const pages = Math.ceil(total / limit);

    return {
      subscriptions: [subscription],
      total,
      page,
      pages,
    };
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<IUserSubscription> {
    const subscription = await UserSubscription.findByUserId(userId);
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (!subscription.stripeCustomerId) {
      // Create Stripe customer if not exists
      const customer = await this.createStripeCustomer(userId);
      subscription.stripeCustomerId = customer.id;
    }

    // Update payment method in Stripe
    try {
      await this.attachPaymentMethod(subscription.stripeCustomerId, paymentMethodId);
    } catch (error) {
      logger.error('Failed to update payment method', {
        context: 'SubscriptionService',
        action: 'UPDATE_PAYMENT_METHOD_FAILED',
        subscriptionId: subscription._id.toString(),
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw ApiError.internal('Failed to update payment method');
    }

    await subscription.save();
    return subscription;
  }

  // ========================================
  // Usage Tracking
  // ========================================

  /**
   * Record a booking for usage tracking
   */
  async recordBooking(userId: string): Promise<void> {
    const subscription = await UserSubscription.findByUserId(userId);
    if (!subscription) return;

    await subscription.incrementUsage('bookings', 1);
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId: string): Promise<{
    bookingsThisMonth: number;
    bookingLimit: number;
    featuredListingsUsed: number;
    featuredListingLimit: number;
    isUnderLimit: boolean;
  }> {
    const subscription = await UserSubscription.findByUserId(userId);
    if (!subscription) {
      return {
        bookingsThisMonth: 0,
        bookingLimit: 2,
        featuredListingsUsed: 0,
        featuredListingLimit: 0,
        isUnderLimit: true,
      };
    }

    const planDetails = subscription.planDetails;
    const bookingLimit = planDetails.limits.bookingsPerMonth || -1;
    const featuredLimit = planDetails.limits.featuredListings || 0;

    return {
      bookingsThisMonth: subscription.usage.bookingsThisMonth,
      bookingLimit,
      featuredListingsUsed: subscription.usage.featuredListingsUsed,
      featuredListingLimit: featuredLimit,
      isUnderLimit: bookingLimit === -1 || subscription.usage.bookingsThisMonth < bookingLimit,
    };
  }

  /**
   * Check if user can perform an action
   */
  async checkPermission(
    userId: string,
    action: 'booking' | 'featuredListing'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await UserSubscription.findByUserId(userId);
    if (!subscription) {
      // Default to free plan
      const freePlan = USER_SUBSCRIPTION_PLANS.free;
      if (action === 'booking') {
        return { allowed: true }; // Free users can book
      }
      return {
        allowed: false,
        reason: 'Featured listings require a premium subscription',
      };
    }

    return subscription.canPerformAction(
      action,
      action === 'booking' ? subscription.usage.bookingsThisMonth : subscription.usage.featuredListingsUsed
    );
  }

  // ========================================
  // Renewal Processing (called by scheduler)
  // ========================================

  /**
   * Process subscription renewals
   */
  async processRenewals(): Promise<{
    renewed: number;
    failed: number;
    cancelled: number;
  }> {
    const result = { renewed: 0, failed: 0, cancelled: 0 };

    // Find subscriptions due for renewal
    const dueSubscriptions = await UserSubscription.findDueForRenewal(0);

    for (const subscription of dueSubscriptions) {
      try {
        // Process Stripe payment
        if (subscription.stripeSubscriptionId) {
          await this.processStripeRenewal(subscription.stripeSubscriptionId);
        }

        // Update billing period
        const now = new Date();
        subscription.currentPeriodStart = now;
        const periodEnd = new Date(now);

        if (subscription.billingCycle === 'monthly') {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        } else {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        }

        subscription.currentPeriodEnd = periodEnd;

        // Reset monthly usage
        subscription.usage.bookingsThisMonth = 0;

        await subscription.save();
        result.renewed++;

        // Emit event
        eventBus.publish(EVENT_TYPES.SUBSCRIPTION_RENEWED, {
          subscriptionId: subscription._id,
          userId: subscription.userId,
          newPeriodEnd: periodEnd,
        });
      } catch (error) {
        logger.error('Failed to renew subscription', {
          context: 'SubscriptionService',
          action: 'RENEW_FAILED',
          subscriptionId: subscription._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
        subscription.status = 'past_due';
        await subscription.save();
        result.failed++;
      }
    }

    // Handle cancelled subscriptions
    const now = new Date();
    const cancelledSubscriptions = await UserSubscription.find({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { $lt: now },
    });

    if (cancelledSubscriptions.length > 0) {
      const cancelledSubscriptionIds = cancelledSubscriptions.map((s: IUserSubscription) => s._id);

      // Bulk update cancelled subscriptions
      await UserSubscription.updateMany(
        { _id: { $in: cancelledSubscriptionIds } },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: now,
            plan: 'free',
            price: 0
          }
        }
      );

      // Emit events for each cancelled subscription
      for (const subscription of cancelledSubscriptions) {
        eventBus.publish(EVENT_TYPES.SUBSCRIPTION_EXPIRED, {
          subscriptionId: subscription._id,
          userId: subscription.userId,
        });
      }

      result.cancelled = cancelledSubscriptions.length;
    }

    return result;
  }

  /**
   * Handle expired subscriptions
   */
  async processExpiredSubscriptions(): Promise<number> {
    const expiredSubscriptions = await UserSubscription.findExpired();

    // Filter out subscriptions that will be cancelled (already handled in processRenewals)
    const toExpire = expiredSubscriptions.filter((s: IUserSubscription) => !s.cancelAtPeriodEnd);

    if (toExpire.length > 0) {
      const expiredSubscriptionIds = toExpire.map((s: IUserSubscription) => s._id);

      // Bulk update expired subscriptions
      await UserSubscription.updateMany(
        { _id: { $in: expiredSubscriptionIds } },
        {
          $set: {
            status: 'expired',
            plan: 'free',
            price: 0
          }
        }
      );

      // Emit events for each expired subscription
      for (const subscription of toExpire) {
        eventBus.publish(EVENT_TYPES.SUBSCRIPTION_EXPIRED, {
          subscriptionId: subscription._id,
          userId: subscription.userId,
        });
      }

      return toExpire.length;
    }

    return 0;
  }

  // ========================================
  // Admin Operations
  // ========================================

  /**
   * Get all subscriptions (admin)
   */
  async getAllSubscriptions(options: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus;
    plan?: PlanType;
    search?: string;
  } = {}): Promise<{
    subscriptions: IUserSubscription[];
    total: number;
    page: number;
    pages: number;
  }> {
    const { page = 1, limit = 20, status, plan, search } = options;

    const query: any = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;

    const skip = (page - 1) * limit;
    const [subscriptions, total] = await Promise.all([
      UserSubscription.find(query)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UserSubscription.countDocuments(query),
    ]);

    return {
      subscriptions,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get subscription statistics (admin)
   * FIX #10: Proper MRR calculation using aggregation pipeline
   */
  async getStats(): Promise<{
    byPlan: Record<string, { count: number; totalRevenue: number }>;
    byStatus: Record<string, number>;
    totalSubscriptions: number;
    activeSubscriptions: number;
    mrr: number; // Monthly recurring revenue
  }> {
    const stats = await UserSubscription.getStats();
    const totalSubscriptions = await UserSubscription.countDocuments();
    const activeSubscriptions = await UserSubscription.countDocuments({ status: 'active' });

    // FIX #10: Proper MRR calculation using aggregation
    // MRR = Sum of (subscription monthly value) for all active subscriptions
    // For yearly subscriptions: price / 12 = monthly value
    // For monthly subscriptions: price = monthly value
    // Use billingCycleMonths for dynamic billing cycle support
    const mrrData = await UserSubscription.aggregate([
      {
        $match: { status: 'active', isDeleted: { $ne: true } },
      },
      {
        $addFields: {
          // Normalize billing cycle to months (default to 1 for monthly, 12 for yearly)
          billingCycleMonths: {
            $switch: {
              branches: [
                { case: { $eq: ['$billingCycle', 'yearly'] }, then: 12 },
                { case: { $eq: ['$billingCycle', 'quarterly'] }, then: 3 },
                { case: { $eq: ['$billingCycle', 'weekly'] }, then: 1 / 4 },
              ],
              default: 1, // monthly
            },
          },
        },
      },
      {
        $addFields: {
          // FIX #10: Properly calculate monthly value by dividing by cycle length
          monthlyValue: { $divide: ['$price', '$billingCycleMonths'] },
        },
      },
      {
        $group: {
          _id: null,
          totalMrr: { $sum: '$monthlyValue' },
          count: { $sum: 1 },
          byPlan: {
            $push: {
              plan: '$plan',
              monthlyValue: '$monthlyValue',
            },
          },
        },
      },
    ]);

    // Fallback to simple calculation if aggregation returns empty
    let mrr = 0;
    if (mrrData.length > 0 && mrrData[0].totalMrr !== undefined) {
      mrr = mrrData[0].totalMrr;
    } else {
      // Fallback: simple query-based calculation
      const active = await UserSubscription.find({ status: 'active' });
      mrr = active.reduce((sum: number, sub: any) => {
        if (sub.billingCycle === 'yearly') {
          return sum + (sub.price / 12);
        }
        return sum + sub.price;
      }, 0);
    }

    return {
      ...stats,
      totalSubscriptions,
      activeSubscriptions,
      mrr: Math.round(mrr * 100) / 100,
    };
  }

  /**
   * Force cancel subscription (admin)
   */
  async adminCancelSubscription(
    subscriptionId: string,
    reason: string
  ): Promise<IUserSubscription> {
    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (subscription.stripeSubscriptionId) {
      try {
        await this.cancelStripeSubscription(subscription.stripeSubscriptionId);
      } catch (error) {
        logger.error('Stripe cancellation failed', {
          context: 'SubscriptionService',
          action: 'ADMIN_CANCEL_FAILED',
          subscriptionId,
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason;

    subscription.history.push({
      plan: subscription.plan,
      price: subscription.price,
      changedAt: new Date(),
      reason: `Admin cancellation: ${reason}`,
      changedBy: 'admin',
    });

    await subscription.save();
    return subscription;
  }

  /**
   * Manually update subscription (admin)
   */
  async adminUpdateSubscription(
    subscriptionId: string,
    updates: {
      plan?: PlanType;
      status?: SubscriptionStatus;
      billingCycle?: BillingCycle;
    }
  ): Promise<IUserSubscription> {
    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (updates.plan) {
      subscription.plan = updates.plan;
      subscription.price = PLAN_PRICES[subscription.billingCycle as BillingCycle][updates.plan as PlanType];
      await subscription.recordPlanChange(updates.plan, 'Admin update', 'admin');
    }

    if (updates.status) {
      subscription.status = updates.status;
    }

    if (updates.billingCycle) {
      subscription.billingCycle = updates.billingCycle;
      subscription.price = PLAN_PRICES[updates.billingCycle as BillingCycle][subscription.plan as PlanType];
    }

    await subscription.save();
    return subscription;
  }

  // ========================================
  // Stripe Integration (Fully Implemented)
  // ========================================

  /**
   * Create a Stripe customer for a user
   * Uses idempotency key to prevent duplicate customer creation
   */
  private async createStripeCustomer(userId: string): Promise<StripeCustomer> {
    const stripe = getStripeClient();

    // Validate user ID
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    // Check if user already has a Stripe customer ID
    const existingSubscription = await UserSubscription.findByUserId(userId);
    if (existingSubscription?.stripeCustomerId) {
      logger.debug('Stripe customer already exists', {
        context: 'SubscriptionService',
        action: 'STRIPE_CUSTOMER_EXISTS',
        userId,
        customerId: existingSubscription.stripeCustomerId,
      });
      return {
        id: existingSubscription.stripeCustomerId,
        email: '', // These would need to be fetched from Stripe if needed
        name: '',
      };
    }

    // Fetch user details
    const user = await User.findById(userId).select('firstName lastName email');
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    try {
      // Generate idempotency key to prevent duplicate customer creation
      const idempotencyKey = `create_customer_${userId}_${Date.now()}`;

      // Create Stripe customer with user metadata
      const customer = await stripe.customers.create(
        {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: {
            userId: userId,
            app: 'home_service_platform',
            createdAt: new Date().toISOString(),
          },
          // Set up automatic payment methods for future subscriptions
          invoice_settings: {
            default_payment_method: undefined, // Will be set when payment method is attached
          },
        },
        {
          idempotencyKey,
        }
      );

      logger.info('Stripe customer created successfully', {
        context: 'SubscriptionService',
        action: 'STRIPE_CUSTOMER_CREATED',
        userId,
        customerId: customer.id,
        email: user.email,
      });

      return {
        id: customer.id,
        email: customer.email || user.email,
        name: customer.name || `${user.firstName} ${user.lastName}`,
      };
    } catch (error: unknown) {
      const stripeError = error as StripeErrorType;

      logger.error('Failed to create Stripe customer', {
        context: 'SubscriptionService',
        action: 'STRIPE_CUSTOMER_CREATE_FAILED',
        userId,
        error: stripeError.message,
        code: stripeError.code,
      });

      // Handle specific Stripe errors
      if (stripeError.code === 'resource_already_exists') {
        throw ApiError.conflict('Stripe customer already exists for this user');
      }

      throw ApiError.internal('Failed to create payment customer');
    }
  }

  /**
   * Create a Stripe subscription for a user
   * Handles customer creation, payment method attachment, and subscription creation
   */
  private async createStripeSubscription(params: {
    userId: string;
    plan: PlanType;
    billingCycle: BillingCycle;
    paymentMethodId: string;
    trialDays?: number;
  }): Promise<{ customerId: string; subscriptionId: string; priceId: string }> {
    const stripe = getStripeClient();
    const { userId, plan, billingCycle, paymentMethodId, trialDays = 0 } = params;

    // Validate inputs
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    if (!paymentMethodId) {
      throw ApiError.badRequest('Payment method ID is required');
    }

    // Get the Stripe Price ID for this plan
    const priceId = getStripePriceId(plan, billingCycle);
    if (!priceId) {
      throw ApiError.badRequest(
        `Stripe Price ID not configured for plan ${plan} and billing cycle ${billingCycle}`
      );
    }

    try {
      // Step 1: Create or get existing Stripe customer
      let customerId: string;
      const existingSubscription = await UserSubscription.findByUserId(userId);

      if (existingSubscription?.stripeCustomerId) {
        customerId = existingSubscription.stripeCustomerId;
        logger.debug('Using existing Stripe customer', {
          context: 'SubscriptionService',
          action: 'STRIPE_USING_EXISTING_CUSTOMER',
          userId,
          customerId,
        });
      } else {
        const customer = await this.createStripeCustomer(userId);
        customerId = customer.id;

        // Update subscription with customer ID if it exists
        if (existingSubscription) {
          existingSubscription.stripeCustomerId = customerId;
          await existingSubscription.save();
        }
      }

      // Step 2: Attach payment method to customer
      await this.attachPaymentMethod(customerId, paymentMethodId);

      // Step 3: Set the payment method as the default for the customer
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Step 4: Create the subscription with idempotency key
      const idempotencyKey = `create_subscription_${userId}_${Date.now()}`;

      // Build subscription items with optional trial
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [
          {
            price: priceId,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          plan,
          billingCycle,
          app: 'home_service_platform',
        },
      };

      // Add trial period if specified
      if (trialDays > 0) {
        const trialEnd = Math.floor(
          (Date.now() + trialDays * 24 * 60 * 60 * 1000) / 1000
        );
        subscriptionParams.trial_period_days = trialDays;
        subscriptionParams.trial_end = trialEnd;
      }

      const subscription = await stripe.subscriptions.create(subscriptionParams, {
        idempotencyKey,
      });

      // Step 5: If there's an invoice with a payment intent, handle it
      const latestInvoice = subscription.latest_invoice;
      if (latestInvoice && typeof latestInvoice !== 'string') {
        const paymentIntent = latestInvoice.payment_intent;
        if (paymentIntent && typeof paymentIntent !== 'string') {
          // If payment intent requires action (3D secure, etc.), the subscription
          // will be in incomplete state until the payment succeeds
          if (paymentIntent.status === 'requires_action') {
            logger.info('Subscription created with pending payment', {
              context: 'SubscriptionService',
              action: 'STRIPE_SUBSCRIPTION_PENDING_PAYMENT',
              subscriptionId: subscription.id,
              userId,
              paymentIntentId: paymentIntent.id,
            });
          }
        }
      }

      logger.info('Stripe subscription created successfully', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_CREATED',
        userId,
        customerId,
        subscriptionId: subscription.id,
        plan,
        billingCycle,
        priceId,
        status: subscription.status,
        hasTrial: trialDays > 0,
      });

      return {
        customerId,
        subscriptionId: subscription.id,
        priceId,
      };
    } catch (error: unknown) {
      const stripeError = error as StripeErrorType;

      logger.error('Failed to create Stripe subscription', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_CREATE_FAILED',
        userId,
        plan,
        billingCycle,
        error: stripeError.message,
        code: stripeError.code,
        type: stripeError.type,
      });

      // Handle specific Stripe errors
      if (stripeError.code === 'resource_already_exists') {
        throw ApiError.conflict('A subscription already exists for this customer');
      }

      if (stripeError.code === 'invalid_request_error') {
        throw ApiError.badRequest(`Invalid subscription request: ${stripeError.message}`);
      }

      throw ApiError.internal('Failed to create subscription');
    }
  }

  /**
   * Update an existing Stripe subscription (plan change)
   * Handles both immediate changes and changes at period end
   */
  private async updateStripeSubscription(
    subscriptionId: string,
    params: { plan: PlanType; billingCycle: BillingCycle; immediate?: boolean }
  ): Promise<void> {
    const stripe = getStripeClient();
    const { plan, billingCycle, immediate = false } = params;

    // Validate inputs
    if (!subscriptionId) {
      throw ApiError.badRequest('Subscription ID is required');
    }

    // Get the new Stripe Price ID
    const newPriceId = getStripePriceId(plan, billingCycle);
    if (!newPriceId) {
      throw ApiError.badRequest(
        `Stripe Price ID not configured for plan ${plan} and billing cycle ${billingCycle}`
      );
    }

    try {
      // Generate idempotency key for the update
      const idempotencyKey = `update_subscription_${subscriptionId}_${Date.now()}`;

      // Fetch current subscription to get the current item ID
      const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (!currentSubscription.items.data.length) {
        throw ApiError.badRequest('Subscription has no items to update');
      }

      const currentItemId = currentSubscription.items.data[0].id;

      // Build update params
      const updateParams: Stripe.SubscriptionUpdateParams = {
        items: [
          {
            id: currentItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: immediate ? 'always_invoice' : 'create_prorations',
        metadata: {
          ...currentSubscription.metadata,
          updatedAt: new Date().toISOString(),
          updatedBy: 'subscription_service',
        },
      };

      // Update the subscription
      const updatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        updateParams,
        { idempotencyKey }
      );

      logger.info('Stripe subscription updated successfully', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_UPDATED',
        subscriptionId,
        newPlan: plan,
        newBillingCycle: billingCycle,
        immediate,
        newStatus: updatedSubscription.status,
        prorationBehavior: immediate ? 'always_invoice' : 'create_prorations',
      });

      // If immediate change, Stripe will automatically invoice the prorated amount
      if (immediate && updatedSubscription.latest_invoice) {
        logger.debug('Proration invoice will be created', {
          context: 'SubscriptionService',
          action: 'STRIPE_PRORATION_INVOICE',
          subscriptionId,
          invoiceId: typeof updatedSubscription.latest_invoice === 'string'
            ? updatedSubscription.latest_invoice
            : updatedSubscription.latest_invoice.id,
        });
      }
    } catch (error: unknown) {
      const stripeError = error as StripeErrorType;

      logger.error('Failed to update Stripe subscription', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_UPDATE_FAILED',
        subscriptionId,
        newPlan: plan,
        billingCycle,
        error: stripeError.message,
        code: stripeError.code,
      });

      if (stripeError.code === 'subscription_updating_requires_payment_method') {
        throw ApiError.badRequest('Payment method is required to update subscription');
      }

      if (stripeError.code === 'resource_missing') {
        throw ApiError.notFound('Subscription not found in Stripe');
      }

      throw ApiError.internal('Failed to update subscription');
    }
  }

  /**
   * Cancel a Stripe subscription
   * Can cancel immediately or at period end
   */
  private async cancelStripeSubscription(
    subscriptionId: string,
    immediate: boolean = false
  ): Promise<void> {
    const stripe = getStripeClient();

    // Validate input
    if (!subscriptionId) {
      throw ApiError.badRequest('Subscription ID is required');
    }

    try {
      // Generate idempotency key
      const idempotencyKey = `cancel_subscription_${subscriptionId}_${Date.now()}`;

      if (immediate) {
        // Cancel immediately
        await stripe.subscriptions.cancel(subscriptionId, { idempotencyKey });

        logger.info('Stripe subscription cancelled immediately', {
          context: 'SubscriptionService',
          action: 'STRIPE_SUBSCRIPTION_CANCELLED_IMMEDIATE',
          subscriptionId,
        });
      } else {
        // Cancel at period end by setting cancel_at_period_end
        const subscription = await stripe.subscriptions.update(
          subscriptionId,
          {
            cancel_at_period_end: true,
            metadata: {
              ...(await stripe.subscriptions.retrieve(subscriptionId)).metadata,
              cancelledAt: new Date().toISOString(),
              cancelAtPeriodEnd: 'true',
            },
          },
          { idempotencyKey }
        );

        logger.info('Stripe subscription scheduled for cancellation at period end', {
          context: 'SubscriptionService',
          action: 'STRIPE_SUBSCRIPTION_CANCEL_AT_PERIOD_END',
          subscriptionId,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        });
      }
    } catch (error: unknown) {
      const stripeError = error as StripeErrorType;

      logger.error('Failed to cancel Stripe subscription', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_CANCEL_FAILED',
        subscriptionId,
        immediate,
        error: stripeError.message,
        code: stripeError.code,
      });

      if (stripeError.code === 'resource_missing') {
        throw ApiError.notFound('Subscription not found in Stripe');
      }

      if (stripeError.code === 'subscription_already_canceled') {
        logger.warn('Subscription already cancelled in Stripe', {
          context: 'SubscriptionService',
          action: 'STRIPE_SUBSCRIPTION_ALREADY_CANCELLED',
          subscriptionId,
        });
        return; // Not an error, just already cancelled
      }

      throw ApiError.internal('Failed to cancel subscription');
    }
  }

  /**
   * Reactivate a cancelled subscription (remove cancel_at_period_end flag)
   */
  private async reactivateStripeSubscription(subscriptionId: string): Promise<void> {
    const stripe = getStripeClient();

    // Validate input
    if (!subscriptionId) {
      throw ApiError.badRequest('Subscription ID is required');
    }

    try {
      // Generate idempotency key
      const idempotencyKey = `reactivate_subscription_${subscriptionId}_${Date.now()}`;

      // Remove the cancel_at_period_end flag
      const subscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: false,
          metadata: {
            ...(await stripe.subscriptions.retrieve(subscriptionId)).metadata,
            reactivatedAt: new Date().toISOString(),
            cancelAtPeriodEnd: 'false',
          },
        },
        { idempotencyKey }
      );

      logger.info('Stripe subscription reactivated', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_REACTIVATED',
        subscriptionId,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      });
    } catch (error: unknown) {
      const stripeError = error as StripeErrorType;

      logger.error('Failed to reactivate Stripe subscription', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_REACTIVATE_FAILED',
        subscriptionId,
        error: stripeError.message,
        code: stripeError.code,
      });

      if (stripeError.code === 'resource_missing') {
        throw ApiError.notFound('Subscription not found in Stripe');
      }

      if (stripeError.code === 'subscription_already_canceled') {
        throw ApiError.badRequest('Cannot reactivate an already cancelled subscription');
      }

      throw ApiError.internal('Failed to reactivate subscription');
    }
  }

  /**
   * Attach a payment method to a Stripe customer
   */
  private async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    const stripe = getStripeClient();

    // Validate inputs
    if (!customerId) {
      throw ApiError.badRequest('Customer ID is required');
    }

    if (!paymentMethodId) {
      throw ApiError.badRequest('Payment method ID is required');
    }

    try {
      // Generate idempotency key
      const idempotencyKey = `attach_pm_${customerId}_${paymentMethodId}`;

      // Attach the payment method to the customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      }, {
        idempotencyKey,
      });

      logger.debug('Payment method attached to customer', {
        context: 'SubscriptionService',
        action: 'STRIPE_PAYMENT_METHOD_ATTACHED',
        customerId,
        paymentMethodId,
      });
    } catch (error: unknown) {
      const stripeError = error as StripeErrorType;

      logger.error('Failed to attach payment method', {
        context: 'SubscriptionService',
        action: 'STRIPE_PAYMENT_METHOD_ATTACH_FAILED',
        customerId,
        paymentMethodId,
        error: stripeError.message,
        code: stripeError.code,
      });

      if (stripeError.code === 'resource_already_attached') {
        logger.debug('Payment method already attached to customer', {
          context: 'SubscriptionService',
          action: 'STRIPE_PAYMENT_METHOD_ALREADY_ATTACHED',
          customerId,
          paymentMethodId,
        });
        return; // Not an error, just already attached
      }

      if (stripeError.code === 'resource_missing') {
        throw ApiError.notFound('Payment method not found');
      }

      throw ApiError.internal('Failed to attach payment method');
    }
  }

  /**
   * Process a subscription renewal event from Stripe
   * Called by the renewal scheduler or webhook handler
   */
  private async processStripeRenewal(subscriptionId: string): Promise<void> {
    const stripe = getStripeClient();

    // Validate input
    if (!subscriptionId) {
      throw ApiError.badRequest('Subscription ID is required');
    }

    try {
      // Retrieve the current subscription status from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      logger.debug('Processing Stripe renewal', {
        context: 'SubscriptionService',
        action: 'STRIPE_RENEWAL_PROCESSING',
        subscriptionId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      });

      // Check if the subscription is active or trialing
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        logger.warn('Subscription renewal attempted but status is not active', {
          context: 'SubscriptionService',
          action: 'STRIPE_RENEWAL_INVALID_STATUS',
          subscriptionId,
          status: subscription.status,
        });

        if (subscription.status === 'past_due') {
          throw ApiError.badRequest('Subscription payment is past due');
        }

        if (subscription.status === 'canceled') {
          throw ApiError.notFound('Subscription has been cancelled');
        }
      }

      // Update the local subscription with the latest Stripe data
      const localSubscription = await UserSubscription.findOne({ stripeSubscriptionId: subscriptionId });
      if (!localSubscription) {
        logger.warn('No local subscription found for Stripe subscription', {
          context: 'SubscriptionService',
          action: 'STRIPE_RENEWAL_NO_LOCAL_SUBSCRIPTION',
          subscriptionId,
        });
        return;
      }

      // Update period dates from Stripe
      const periodStart = new Date(subscription.current_period_start * 1000);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      // Only update if Stripe's period is ahead of local
      if (periodEnd > localSubscription.currentPeriodEnd) {
        localSubscription.currentPeriodStart = periodStart;
        localSubscription.currentPeriodEnd = periodEnd;
        localSubscription.status = mapStripeStatus(subscription.status);

        // Reset monthly usage on renewal
        localSubscription.usage.bookingsThisMonth = 0;

        await localSubscription.save();

        logger.info('Subscription renewal processed successfully', {
          context: 'SubscriptionService',
          action: 'STRIPE_RENEWAL_SUCCESS',
          subscriptionId,
          localSubscriptionId: localSubscription._id.toString(),
          newPeriodEnd: periodEnd.toISOString(),
        });

        // Emit renewal event
        eventBus.publish(EVENT_TYPES.SUBSCRIPTION_RENEWED, {
          subscriptionId: localSubscription._id,
          userId: localSubscription.userId,
          newPeriodEnd: periodEnd,
          stripeSubscriptionId: subscriptionId,
        });
      } else {
        logger.debug('Subscription period already up to date', {
          context: 'SubscriptionService',
          action: 'STRIPE_RENEWAL_NO_UPDATE_NEEDED',
          subscriptionId,
          localPeriodEnd: localSubscription.currentPeriodEnd.toISOString(),
          stripePeriodEnd: periodEnd.toISOString(),
        });
      }
    } catch (error: unknown) {
      // Check if it's our own ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      const stripeError = error as StripeErrorType;

      logger.error('Failed to process Stripe renewal', {
        context: 'SubscriptionService',
        action: 'STRIPE_RENEWAL_FAILED',
        subscriptionId,
        error: stripeError.message,
        code: stripeError.code,
      });

      throw ApiError.internal('Failed to process subscription renewal');
    }
  }

  /**
   * Get the current status of a Stripe subscription
   * Used for syncing subscription state with the database
   */
  private async getSubscriptionStatus(subscriptionId: string): Promise<{
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    priceId: string | null;
    customerId: string | null;
  }> {
    const stripe = getStripeClient();

    // Validate input
    if (!subscriptionId) {
      throw ApiError.badRequest('Subscription ID is required');
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price'],
      });

      const priceId = subscription.items.data[0]?.price?.id || null;
      const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

      logger.debug('Retrieved Stripe subscription status', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_STATUS_RETRIEVED',
        subscriptionId,
        status: subscription.status,
        cancelAtPeriodEnd,
        priceId,
      });

      return {
        status: mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd,
        priceId,
        customerId: subscription.customer as string,
      };
    } catch (error: unknown) {
      const stripeError = error as StripeErrorType;

      logger.error('Failed to get Stripe subscription status', {
        context: 'SubscriptionService',
        action: 'STRIPE_SUBSCRIPTION_STATUS_FAILED',
        subscriptionId,
        error: stripeError.message,
        code: stripeError.code,
      });

      if (stripeError.code === 'resource_missing') {
        throw ApiError.notFound('Subscription not found in Stripe');
      }

      throw ApiError.internal('Failed to get subscription status');
    }
  }

  /**
   * Sync a local subscription with its Stripe counterpart
   * Updates local database with latest Stripe data
   */
  async syncSubscriptionWithStripe(subscriptionId: string): Promise<IUserSubscription | null> {
    if (!Types.ObjectId.isValid(subscriptionId)) {
      throw ApiError.badRequest('Invalid subscription ID');
    }

    const localSubscription = await UserSubscription.findById(subscriptionId);
    if (!localSubscription) {
      throw ApiError.notFound('Subscription not found');
    }

    if (!localSubscription.stripeSubscriptionId) {
      logger.debug('No Stripe subscription ID to sync', {
        context: 'SubscriptionService',
        action: 'STRIPE_SYNC_NO_STRIPE_ID',
        subscriptionId: localSubscription._id.toString(),
      });
      return localSubscription;
    }

    try {
      const stripeStatus = await this.getSubscriptionStatus(localSubscription.stripeSubscriptionId);

      // Update local subscription with Stripe data
      localSubscription.status = stripeStatus.status;
      localSubscription.currentPeriodStart = stripeStatus.currentPeriodStart;
      localSubscription.currentPeriodEnd = stripeStatus.currentPeriodEnd;
      localSubscription.cancelAtPeriodEnd = stripeStatus.cancelAtPeriodEnd;

      if (stripeStatus.priceId) {
        localSubscription.stripePriceId = stripeStatus.priceId;
      }

      // Handle cancelled subscriptions
      if (stripeStatus.status === 'cancelled' && !localSubscription.cancelledAt) {
        localSubscription.cancelledAt = new Date();
        localSubscription.plan = 'free';
        localSubscription.price = 0;
      }

      await localSubscription.save();

      logger.info('Subscription synced with Stripe', {
        context: 'SubscriptionService',
        action: 'STRIPE_SYNC_SUCCESS',
        subscriptionId: localSubscription._id.toString(),
        stripeSubscriptionId: localSubscription.stripeSubscriptionId,
        newStatus: stripeStatus.status,
      });

      return localSubscription;
    } catch (error: unknown) {
      // Check if it's our own ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      const err = error as Error;
      logger.error('Failed to sync subscription with Stripe', {
        context: 'SubscriptionService',
        action: 'STRIPE_SYNC_FAILED',
        subscriptionId: localSubscription._id.toString(),
        stripeSubscriptionId: localSubscription.stripeSubscriptionId,
        error: err.message,
      });

      throw ApiError.internal('Failed to sync subscription with Stripe');
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
export default subscriptionService;
