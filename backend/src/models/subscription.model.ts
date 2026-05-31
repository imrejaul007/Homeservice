import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  providerId: mongoose.Types.ObjectId;
  plan: 'basic' | 'standard' | 'premium' | 'enterprise';
  status: 'active' | 'paused' | 'cancelled' | 'trial' | 'expired';
  billingCycle: 'monthly' | 'yearly';
  price: number;
  currency: string;

  // Trial period
  trialEndsAt?: Date;
  isInTrialPeriod: boolean;

  // Billing
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  autoRenew: boolean;

  // Payment
  stripeSubscriptionId?: string;
  stripePriceId?: string;

  // Features included
  features: {
    maxServices: number;
    maxImagesPerService: number;
    featuredListingEnabled: boolean;
    prioritySupport: boolean;
    analyticsAccess: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    commissionRate: number; // Provider commission rate (e.g., 10 = 10%)
  };

  // Usage
  usage: {
    servicesUsed: number;
    imagesUsed: number;
    bookingsThisPeriod: number;
  };

  // Limits
  limits: {
    maxBookingsPerMonth: number;
    maxCustomers: number;
  };

  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;
  willRenew: boolean;

  // History
  history: Array<{
    plan: string;
    price: number;
    changedAt: Date;
    reason?: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

// Plan configurations
export const PLAN_FEATURES = {
  basic: {
    maxServices: 5,
    maxImagesPerService: 3,
    featuredListingEnabled: false,
    prioritySupport: false,
    analyticsAccess: false,
    customBranding: false,
    apiAccess: false,
    commissionRate: 15, // 15% commission
    maxBookingsPerMonth: 50,
    maxCustomers: 100,
  },
  standard: {
    maxServices: 15,
    maxImagesPerService: 5,
    featuredListingEnabled: true,
    prioritySupport: false,
    analyticsAccess: true,
    customBranding: false,
    apiAccess: false,
    commissionRate: 12,
    maxBookingsPerMonth: 200,
    maxCustomers: 500,
  },
  premium: {
    maxServices: 50,
    maxImagesPerService: 10,
    featuredListingEnabled: true,
    prioritySupport: true,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: false,
    commissionRate: 10,
    maxBookingsPerMonth: 1000,
    maxCustomers: 2000,
  },
  enterprise: {
    maxServices: -1, // Unlimited
    maxImagesPerService: 20,
    featuredListingEnabled: true,
    prioritySupport: true,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: true,
    commissionRate: 8,
    maxBookingsPerMonth: -1, // Unlimited
    maxCustomers: -1, // Unlimited
  },
} as const;

// Pricing
export const PLAN_PRICES = {
  monthly: {
    basic: 99,
    standard: 299,
    premium: 599,
    enterprise: 1299,
  },
  yearly: {
    basic: 990,
    standard: 2990,
    premium: 5990,
    enterprise: 12990,
  },
} as const;

const subscriptionSchema = new Schema<ISubscription>(
  {
    // Multi-tenant support
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
    const planFeatures = PLAN_FEATURES[this.plan as keyof typeof PLAN_FEATURES];
    const planPrices = PLAN_PRICES[this.billingCycle as keyof typeof PLAN_PRICES];

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

// Indexes for query optimization
// Note: stripeSubscriptionId has index: true on field, stripePriceId is indexed via sparse index below
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
