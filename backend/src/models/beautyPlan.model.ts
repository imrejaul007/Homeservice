import mongoose, { Schema, Document } from 'mongoose';
import {
  BEAUTY_PLANS,
  BEAUTY_COMMISSION_RATES,
  BEAUTY_PLAN_PRICES,
  type BeautyPlanType,
} from '../constants/subscriptionPlans';

// Re-export for backward compatibility
export const COMMISSION_RATES = BEAUTY_COMMISSION_RATES;
// Note: PLAN_PRICES is intentionally not exported here to avoid naming collision
// Use BEAUTY_PLAN_PRICES from constants/subscriptionPlans instead

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
  this.commissionRate = BEAUTY_COMMISSION_RATES[this.plan as BeautyPlanType] || 20;

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
