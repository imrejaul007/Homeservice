import mongoose, { Schema, Document } from 'mongoose';

// Beauty/Salon subscription plans
export const BEAUTY_PLANS = {
  FREE: 'beauty_free',
  PRO: 'beauty_pro',
  PREMIUM: 'beauty_premium',
} as const;

// Commission rates by plan
export const COMMISSION_RATES: Record<string, number> = {
  beauty_free: 20,
  beauty_pro: 15,
  beauty_premium: 12,
};

// Plan pricing
export const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  beauty_free: { monthly: 0, yearly: 0 },
  beauty_pro: { monthly: 299, yearly: 2990 },
  beauty_premium: { monthly: 799, yearly: 7990 },
};

export interface IBeautyPlan extends Document {
  providerId: mongoose.Types.ObjectId;
  plan: 'beauty_free' | 'beauty_pro' | 'beauty_premium';
  status: 'active' | 'paused' | 'cancelled';
  commissionRate: number;
  bookingLimit: number;
  features: {
    portfolio: boolean;
    homeVisits: boolean;
    priorityListing: boolean;
    analytics: boolean;
    multiBranch: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    dedicatedSupport: boolean;
  };
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const beautyPlanSchema = new Schema({
  providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  plan: {
    type: String,
    enum: ['beauty_free', 'beauty_pro', 'beauty_premium'],
    default: 'beauty_free',
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled'],
    default: 'active',
  },
  commissionRate: { type: Number, default: 20 },
  bookingLimit: { type: Number, default: 50 },
  features: {
    portfolio: { type: Boolean, default: true },
    homeVisits: { type: Boolean, default: false },
    priorityListing: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    multiBranch: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false },
    dedicatedSupport: { type: Boolean, default: false },
  },
  currentPeriodStart: { type: Date, default: Date.now },
  currentPeriodEnd: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  stripeSubscriptionId: String,
}, { timestamps: true });

// Update commission based on plan
beautyPlanSchema.pre('save', function(next) {
  this.commissionRate = COMMISSION_RATES[this.plan] || 20;

  // Set features based on plan
  this.features = {
    portfolio: true,
    homeVisits: this.plan !== 'beauty_free',
    priorityListing: this.plan !== 'beauty_free',
    analytics: this.plan === 'beauty_pro' || this.plan === 'beauty_premium',
    multiBranch: this.plan === 'beauty_premium',
    apiAccess: this.plan === 'beauty_premium',
    whiteLabel: this.plan === 'beauty_premium',
    dedicatedSupport: this.plan === 'beauty_premium',
  };

  // Set booking limit
  this.bookingLimit = this.plan === 'beauty_free' ? 50 : -1; // -1 = unlimited

  next();
});

export const BeautyPlan = mongoose.model<IBeautyPlan>('BeautyPlan', beautyPlanSchema);
export default BeautyPlan;
