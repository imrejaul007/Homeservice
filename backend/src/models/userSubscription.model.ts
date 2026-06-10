import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  CUSTOMER_SUBSCRIPTION_PLANS,
  CUSTOMER_PLAN_PRICES,
  CUSTOMER_YEARLY_DISCOUNT_PERCENTAGE,
  type CustomerPlanType,
  type CustomerBillingCycle,
} from '../constants/subscriptionPlans';

// ============================================
// User Subscription Types & Interfaces
// ============================================

// Re-export types for backward compatibility
export type PlanType = CustomerPlanType;
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'expired' | 'trialing';
export type BillingCycle = CustomerBillingCycle;

export interface ISubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  limits: {
    bookingsPerMonth?: number;
    featuredListings?: number;
    commissionDiscount?: number;
    maxAddresses?: number;
    maxPaymentMethods?: number;
    prioritySupport?: boolean;
    exclusiveOffers?: boolean;
    earlyAccess?: boolean;
  };
}

// Re-export for backward compatibility
export const USER_SUBSCRIPTION_PLANS = CUSTOMER_SUBSCRIPTION_PLANS;
export const PLAN_PRICES = CUSTOMER_PLAN_PRICES;
export const YEARLY_DISCOUNT_PERCENTAGE = CUSTOMER_YEARLY_DISCOUNT_PERCENTAGE;

// ============================================
// User Subscription Schema
// ============================================

export interface IUserSubscription extends Document {
  userId: Types.ObjectId;
  plan: PlanType;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;

  // Trial period
  trialEnd?: Date;
  isInTrialPeriod: boolean;

  // Payment integration
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;

  // Billing
  price: number;
  currency: string;

  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;

  // Metadata
  metadata?: {
    referralCode?: string;
    referredBy?: string;
    source?: string;
    campaign?: string;
  };

  // Usage tracking
  usage: {
    bookingsThisMonth: number;
    featuredListingsUsed: number;
    totalSpent: number;
  };

  // Plan history for audit
  history: Array<{
    plan: PlanType;
    price: number;
    changedAt: Date;
    reason?: string;
    changedBy: 'user' | 'admin' | 'system';
  }>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const userSubscriptionSchema = new Schema<IUserSubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'] as PlanType[],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'past_due', 'expired', 'trialing'] as SubscriptionStatus[],
      default: 'active',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'] as BillingCycle[],
      default: 'monthly',
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    trialEnd: {
      type: Date,
    },
    stripeCustomerId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripePriceId: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
    },
    cancelledAt: Date,
    cancellationReason: String,
    metadata: {
      referralCode: String,
      referredBy: String,
      source: String,
      campaign: String,
    },
    usage: {
      bookingsThisMonth: { type: Number, default: 0 },
      featuredListingsUsed: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
    },
    history: [{
      plan: {
        type: String,
        enum: ['free', 'basic', 'premium', 'enterprise'] as PlanType[],
      },
      price: Number,
      changedAt: { type: Date, default: Date.now },
      reason: String,
      changedBy: {
        type: String,
        enum: ['user', 'admin', 'system'],
        default: 'user',
      },
    }],
  },
  {
    timestamps: true,
  }
);

// ============================================
// Virtuals
// ============================================

// Check if subscription is currently in trial
userSubscriptionSchema.virtual('isInTrialPeriod').get(function() {
  if (this.status === 'trialing' && this.trialEnd) {
    return new Date() < this.trialEnd;
  }
  return false;
});

// Check if subscription will renew
userSubscriptionSchema.virtual('willRenew').get(function() {
  return !this.cancelAtPeriodEnd && this.status === 'active';
});

// Check if period has expired
userSubscriptionSchema.virtual('isExpired').get(function() {
  return new Date() > this.currentPeriodEnd;
});

// Days remaining in current period
userSubscriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const end = new Date(this.currentPeriodEnd);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Current plan details
userSubscriptionSchema.virtual('planDetails').get(function() {
  return USER_SUBSCRIPTION_PLANS[this.plan];
});

// ============================================
// Instance Methods
// ============================================

/**
 * Check if user has access to a specific feature
 */
userSubscriptionSchema.methods.hasFeature = function(feature: string): boolean {
  const planDetails = USER_SUBSCRIPTION_PLANS[this.plan as PlanType];
  return planDetails.features.some((f: string) =>
    f.toLowerCase().includes(feature.toLowerCase())
  );
};

/**
 * Check if user can perform an action based on limits
 */
userSubscriptionSchema.methods.canPerformAction = function(
  action: 'booking' | 'featuredListing',
  currentCount: number
): { allowed: boolean; reason?: string } {
  const planDetails = USER_SUBSCRIPTION_PLANS[this.plan as PlanType];

  if (action === 'booking') {
    const limit = planDetails.limits.bookingsPerMonth;
    if (limit === -1) return { allowed: true };
    if (limit !== undefined && currentCount >= limit) {
      return {
        allowed: false,
        reason: `Monthly booking limit reached (${limit} bookings on ${this.plan} plan)`,
      };
    }
  }

  if (action === 'featuredListing') {
    const limit = planDetails.limits.featuredListings;
    if (limit === -1) return { allowed: true };
    if (limit !== undefined && currentCount >= limit) {
      return {
        allowed: false,
        reason: `Featured listing limit reached (${limit} listings on ${this.plan} plan)`,
      };
    }
  }

  return { allowed: true };
};

/**
 * Record a plan change in history
 */
userSubscriptionSchema.methods.recordPlanChange = async function(
  newPlan: PlanType,
  reason?: string,
  changedBy: 'user' | 'admin' | 'system' = 'user'
): Promise<void> {
  const planDetails = USER_SUBSCRIPTION_PLANS[newPlan];
  this.history.push({
    plan: newPlan,
    price: planDetails.price,
    changedAt: new Date(),
    reason,
    changedBy,
  });
};

/**
 * Calculate prorated amount for upgrade/downgrade
 */
userSubscriptionSchema.methods.calculateProration = function(
  newPlan: PlanType,
  billingCycle: BillingCycle = 'monthly'
): { amount: number; description: string } {
  const newPlanDetails = USER_SUBSCRIPTION_PLANS[newPlan];
  const newPrice = PLAN_PRICES[billingCycle][newPlan];
  const currentPrice = this.price;

  // Get days remaining in current period
  const now = new Date();
  const periodEnd = new Date(this.currentPeriodEnd);
  const totalDays = Math.ceil(
    (periodEnd.getTime() - this.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate prorated amounts
  const oldDailyRate = currentPrice / totalDays;
  const newDailyRate = newPrice / totalDays;

  const unusedCredit = oldDailyRate * daysRemaining;
  const newCost = newDailyRate * daysRemaining;

  const proratedAmount = Math.max(0, newCost - unusedCredit);

  return {
    amount: Math.round(proratedAmount * 100) / 100,
    description: `Prorated charge for ${daysRemaining} days remaining on ${newPlanDetails.name} plan`,
  };
};

/**
 * Increment usage counter
 */
userSubscriptionSchema.methods.incrementUsage = async function(
  type: 'bookings' | 'featuredListings',
  amount: number = 1
): Promise<void> {
  if (type === 'bookings') {
    this.usage.bookingsThisMonth += amount;
  } else if (type === 'featuredListings') {
    this.usage.featuredListingsUsed += amount;
  }
  await this.save();
};

/**
 * Reset monthly usage (called by scheduled job)
 */
userSubscriptionSchema.methods.resetMonthlyUsage = async function(): Promise<void> {
  this.usage.bookingsThisMonth = 0;
  this.usage.featuredListingsUsed = 0;
  await this.save();
};

// ============================================
// Static Methods
// ============================================

/**
 * Find subscription by user ID
 */
userSubscriptionSchema.statics.findByUserId = function(userId: string | Types.ObjectId) {
  return this.findOne({ userId });
};

/**
 * Find subscriptions due for renewal
 */
userSubscriptionSchema.statics.findDueForRenewal = function(daysBefore: number = 3) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysBefore);

  return this.find({
    status: 'active',
    cancelAtPeriodEnd: false,
    currentPeriodEnd: {
      $lte: futureDate,
      $gte: new Date(),
    },
  });
};

/**
 * Find expired subscriptions
 */
userSubscriptionSchema.statics.findExpired = function() {
  return this.find({
    status: 'active',
    currentPeriodEnd: { $lt: new Date() },
  });
};

/**
 * Find subscriptions with failed payments
 */
userSubscriptionSchema.statics.findWithFailedPayments = function() {
  return this.find({
    status: 'past_due',
    stripeSubscriptionId: { $exists: true },
  });
};

/**
 * Get subscription statistics
 */
userSubscriptionSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$plan',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$usage.totalSpent' },
      },
    },
  ]);

  const statusCounts = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    byPlan: stats.reduce((acc, s) => {
      acc[s._id] = { count: s.count, totalRevenue: s.totalRevenue };
      return acc;
    }, {} as Record<string, { count: number; totalRevenue: number }>),
    byStatus: statusCounts.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {} as Record<string, number>),
  };
};

// ============================================
// Middleware
// ============================================

// Pre-save hook to set default plan features
userSubscriptionSchema.pre('save', function(next) {
  // Set initial period dates if not set
  if (this.isNew) {
    const now = new Date();
    if (!this.currentPeriodStart) {
      this.currentPeriodStart = now;
    }
    if (!this.currentPeriodEnd) {
      const periodEnd = new Date(now);
      if (this.billingCycle === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }
      this.currentPeriodEnd = periodEnd;
    }
  }

  // Update price based on plan and billing cycle
  if (this.isModified('plan') || this.isModified('billingCycle')) {
    this.price = PLAN_PRICES[this.billingCycle][this.plan];
  }

  // Check for expired subscription
  if (this.isModified('currentPeriodEnd') && this.currentPeriodEnd < new Date()) {
    if (this.status === 'active') {
      this.status = 'expired';
    }
  }

  next();
});

// ============================================
// Indexes
// ============================================
// Note: stripeSubscriptionId and stripeCustomerId already have index: true on fields
userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
userSubscriptionSchema.index({ createdAt: -1 });

// Compound index for renewal processing
userSubscriptionSchema.index({
  status: 1,
  cancelAtPeriodEnd: 1,
  currentPeriodEnd: 1,
});

// ============================================
// Export
// ============================================

export const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema) as any;

// Add findByUserId static method
(UserSubscription as any).findByUserId = function(userId: string | Types.ObjectId) {
  return this.findOne({ userId });
};

export default UserSubscription;
