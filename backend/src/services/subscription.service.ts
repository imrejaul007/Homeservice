import mongoose, { Types } from 'mongoose';
import UserSubscription, {
  IUserSubscription,
  PlanType,
  SubscriptionStatus,
  BillingCycle,
  USER_SUBSCRIPTION_PLANS,
  PLAN_PRICES,
} from '../models/userSubscription.model';
import { PremiumMembership } from '../models/premiumMembership.model';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Stripe Integration Types (placeholder)
// ============================================

interface StripeCustomer {
  id: string;
  email: string;
  name: string;
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
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
        console.error('Stripe subscription creation failed:', error);
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
        console.error('Stripe subscription update failed:', error);
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
        console.error('Stripe subscription cancellation failed:', error);
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
        console.error('Stripe subscription reactivation failed:', error);
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
      console.error('Failed to update payment method:', error);
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
        console.error(`Failed to renew subscription ${subscription._id}:`, error);
        subscription.status = 'past_due';
        await subscription.save();
        result.failed++;
      }
    }

    // Handle cancelled subscriptions
    const cancelledSubscriptions = await UserSubscription.find({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { $lt: new Date() },
    });

    for (const subscription of cancelledSubscriptions) {
      try {
        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date();
        subscription.plan = 'free'; // Downgrade to free
        subscription.price = 0;
        await subscription.save();
        result.cancelled++;

        // Emit event
        eventBus.publish(EVENT_TYPES.SUBSCRIPTION_EXPIRED, {
          subscriptionId: subscription._id,
          userId: subscription.userId,
        });
      } catch (error) {
        console.error(`Failed to cancel subscription ${subscription._id}:`, error);
      }
    }

    return result;
  }

  /**
   * Handle expired subscriptions
   */
  async processExpiredSubscriptions(): Promise<number> {
    const expiredSubscriptions = await UserSubscription.findExpired();
    let processed = 0;

    for (const subscription of expiredSubscriptions) {
      if (!subscription.cancelAtPeriodEnd) {
        subscription.status = 'expired';
        subscription.plan = 'free'; // Downgrade to free
        subscription.price = 0;
        await subscription.save();
        processed++;

        // Emit event
        eventBus.publish(EVENT_TYPES.SUBSCRIPTION_EXPIRED, {
          subscriptionId: subscription._id,
          userId: subscription.userId,
        });
      }
    }

    return processed;
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

    // Calculate MRR (monthly recurring revenue)
    const active = await UserSubscription.find({ status: 'active' });
    const mrr = active.reduce((sum: number, sub: any) => {
      if (sub.billingCycle === 'yearly') {
        return sum + (sub.price / 12);
      }
      return sum + sub.price;
    }, 0);

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
        console.error('Stripe cancellation failed:', error);
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
  // Stripe Integration (Stub implementations)
  // ========================================

  private async createStripeCustomer(userId: string): Promise<StripeCustomer> {
    // TODO: Implement actual Stripe customer creation
    // This is a stub - replace with actual Stripe SDK calls
    return {
      id: `cus_${Date.now()}`,
      email: '',
      name: '',
    };
  }

  private async createStripeSubscription(params: {
    userId: string;
    plan: PlanType;
    billingCycle: BillingCycle;
    paymentMethodId: string;
    trialDays?: number;
  }): Promise<{ customerId: string; subscriptionId: string; priceId: string }> {
    // TODO: Implement actual Stripe subscription creation
    // This is a stub - replace with actual Stripe SDK calls
    return {
      customerId: `cus_${Date.now()}`,
      subscriptionId: `sub_${Date.now()}`,
      priceId: `price_${params.plan}_${params.billingCycle}`,
    };
  }

  private async updateStripeSubscription(
    subscriptionId: string,
    params: { plan: PlanType; billingCycle: BillingCycle; immediate?: boolean }
  ): Promise<void> {
    // TODO: Implement actual Stripe subscription update
    console.log('Updating Stripe subscription:', subscriptionId, params);
  }

  private async cancelStripeSubscription(subscriptionId: string): Promise<void> {
    // TODO: Implement actual Stripe subscription cancellation
    console.log('Cancelling Stripe subscription:', subscriptionId);
  }

  private async reactivateStripeSubscription(subscriptionId: string): Promise<void> {
    // TODO: Implement actual Stripe subscription reactivation
    console.log('Reactivating Stripe subscription:', subscriptionId);
  }

  private async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // TODO: Implement actual Stripe payment method attachment
    console.log('Attaching payment method:', customerId, paymentMethodId);
  }

  private async processStripeRenewal(subscriptionId: string): Promise<void> {
    // TODO: Implement actual Stripe renewal processing
    console.log('Processing Stripe renewal:', subscriptionId);
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
export default subscriptionService;
