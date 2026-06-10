import mongoose, { Schema, Document } from 'mongoose';
import {
  PROVIDER_PLAN_FEATURES,
  PROVIDER_PLAN_PRICES,
  type ProviderPlanType,
  type ProviderBillingCycle,
} from '../constants/subscriptionPlans';

// Define the subscription status type
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trial' | 'expired';

// Document interface
export interface ISubscription extends Document {
  tenantId?: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  plan: ProviderPlanType;
  status: SubscriptionStatus;
  billingCycle: ProviderBillingCycle;
  price: number;
  currency: string;
  trialEndsAt?: Date;
  isInTrialPeriod: boolean;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  autoRenew: boolean;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  features: {
    maxServices: number;
    maxImagesPerService: number;
    featuredListingEnabled: boolean;
    prioritySupport: boolean;
    analyticsAccess: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    commissionRate: number;
  };
  usage: {
    servicesUsed: number;
    imagesUsed: number;
    bookingsThisPeriod: number;
  };
  limits: {
    maxBookingsPerMonth: number;
    maxCustomers: number;
  };
  cancelledAt?: Date;
  cancellationReason?: string;
  willRenew: boolean;
  history: Array<{
    plan: string;
    price: number;
    changedAt: Date;
    reason?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['basic', 'standard', 'premium', 'enterprise'],
      default: 'basic',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'trial', 'expired'],
      default: 'trial',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
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
    trialEndsAt: {
      type: Date,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    nextBillingDate: {
      type: Date,
      required: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    stripeSubscriptionId: String,
    stripePriceId: String,
    features: {
      maxServices: { type: Number, default: 5 },
      maxImagesPerService: { type: Number, default: 3 },
      featuredListingEnabled: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      analyticsAccess: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      commissionRate: { type: Number, default: 15 },
    },
    usage: {
      servicesUsed: { type: Number, default: 0 },
      imagesUsed: { type: Number, default: 0 },
      bookingsThisPeriod: { type: Number, default: 0 },
    },
    limits: {
      maxBookingsPerMonth: { type: Number, default: 50 },
      maxCustomers: { type: Number, default: 100 },
    },
    cancelledAt: Date,
    cancellationReason: String,
    willRenew: {
      type: Boolean,
      default: true,
    },
    history: [{
      plan: String,
      price: Number,
      changedAt: { type: Date, default: Date.now },
      reason: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Virtual for checking if in trial
subscriptionSchema.virtual('isInTrialPeriod').get(function() {
  if (this.status === 'trial' && this.trialEndsAt) {
    return new Date() < this.trialEndsAt;
  }
  return false;
});

// Pre-save hook to set features based on plan
subscriptionSchema.pre('save', function(next) {
  if (this.isModified('plan') || this.isModified('billingCycle')) {
    const planFeatures = PROVIDER_PLAN_FEATURES[this.plan as keyof typeof PROVIDER_PLAN_FEATURES];
    const planPrices = PROVIDER_PLAN_PRICES[this.billingCycle as keyof typeof PROVIDER_PLAN_PRICES];

    if (planFeatures && planPrices) {
      this.features = {
        ...this.features,
        ...planFeatures,
      };
      this.price = planPrices[this.plan as keyof typeof planPrices] || this.price;
    }
  }
  next();
});

// Re-export for backward compatibility
export { PROVIDER_PLAN_FEATURES as PLAN_FEATURES, PROVIDER_PLAN_PRICES as PLAN_PRICES };

// Indexes for query optimization
subscriptionSchema.index({ providerId: 1, status: 1 });
subscriptionSchema.index({ status: 1, nextBillingDate: 1 });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ 'usage.bookingsThisPeriod': 1 });

// Compound index for finding subscriptions needing renewal
subscriptionSchema.index({
  status: 1,
  autoRenew: 1,
  nextBillingDate: 1
});

// Tenant isolation indexes
subscriptionSchema.index({ tenantId: 1, status: 1 });
subscriptionSchema.index({ tenantId: 1, providerId: 1 });

const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);

export default Subscription;
