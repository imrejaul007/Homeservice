import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================
// Premium Membership Types
// ============================================

export type MembershipTier = 'standard' | 'silver' | 'gold' | 'platinum' | 'vip';

export interface IMembershipBenefits {
  // Featured listings
  featuredListingCredits: number;
  featuredListingDuration: number; // days

  // Priority services
  prioritySupport: boolean;
  priorityResponseTime?: number; // hours

  // Booking benefits
  bookingPriority: boolean;
  exclusiveProviders: boolean;

  // Financial benefits
  commissionDiscount: number; // percentage
  cashbackPercentage: number; // percentage
  exclusiveDiscounts: boolean;

  // Access benefits
  earlyAccess: boolean;
  exclusiveEvents: boolean;
  vipConcierge: boolean;

  // Other
  customNotifications: boolean;
  advancedAnalytics: boolean;
}

// Membership tier configurations
export const MEMBERSHIP_TIERS: Record<MembershipTier, IMembershipBenefits> = {
  standard: {
    featuredListingCredits: 0,
    featuredListingDuration: 0,
    prioritySupport: false,
    bookingPriority: false,
    exclusiveProviders: false,
    commissionDiscount: 0,
    cashbackPercentage: 0,
    exclusiveDiscounts: false,
    earlyAccess: false,
    exclusiveEvents: false,
    vipConcierge: false,
    customNotifications: false,
    advancedAnalytics: false,
  },
  silver: {
    featuredListingCredits: 1,
    featuredListingDuration: 7,
    prioritySupport: false,
    priorityResponseTime: 24,
    bookingPriority: false,
    exclusiveProviders: false,
    commissionDiscount: 2,
    cashbackPercentage: 1,
    exclusiveDiscounts: true,
    earlyAccess: false,
    exclusiveEvents: false,
    vipConcierge: false,
    customNotifications: false,
    advancedAnalytics: false,
  },
  gold: {
    featuredListingCredits: 3,
    featuredListingDuration: 14,
    prioritySupport: true,
    priorityResponseTime: 12,
    bookingPriority: true,
    exclusiveProviders: false,
    commissionDiscount: 5,
    cashbackPercentage: 2,
    exclusiveDiscounts: true,
    earlyAccess: true,
    exclusiveEvents: false,
    vipConcierge: false,
    customNotifications: true,
    advancedAnalytics: false,
  },
  platinum: {
    featuredListingCredits: 5,
    featuredListingDuration: 30,
    prioritySupport: true,
    priorityResponseTime: 4,
    bookingPriority: true,
    exclusiveProviders: true,
    commissionDiscount: 8,
    cashbackPercentage: 3,
    exclusiveDiscounts: true,
    earlyAccess: true,
    exclusiveEvents: true,
    vipConcierge: false,
    customNotifications: true,
    advancedAnalytics: true,
  },
  vip: {
    featuredListingCredits: -1, // Unlimited
    featuredListingDuration: -1, // Permanent
    prioritySupport: true,
    priorityResponseTime: 1,
    bookingPriority: true,
    exclusiveProviders: true,
    commissionDiscount: 10,
    cashbackPercentage: 5,
    exclusiveDiscounts: true,
    earlyAccess: true,
    exclusiveEvents: true,
    vipConcierge: true,
    customNotifications: true,
    advancedAnalytics: true,
  },
};

// Membership tier pricing (monthly)
export const MEMBERSHIP_PRICES: Record<MembershipTier, number> = {
  standard: 0,
  silver: 49,
  gold: 99,
  platinum: 199,
  vip: 499,
};

// Tier upgrade requirements
export const TIER_REQUIREMENTS: Record<MembershipTier, {
  minBookings?: number;
  minSpent?: number;
  minRating?: number;
  referralCount?: number;
}> = {
  standard: {},
  silver: { minBookings: 5, minSpent: 500 },
  gold: { minBookings: 15, minSpent: 2000, minRating: 4.5 },
  platinum: { minBookings: 30, minSpent: 5000, minRating: 4.8, referralCount: 5 },
  vip: { minBookings: 50, minSpent: 15000, minRating: 4.9, referralCount: 15 },
};

// ============================================
// Premium Membership Schema
// ============================================

// Embedded schema definitions with proper typing
const FeaturedListingSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, auto: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
  experienceId: { type: Schema.Types.ObjectId, ref: 'Experience' },
  title: { type: String, required: true },
  imageUrl: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending',
  },
  placement: {
    type: String,
    enum: ['top', 'featured', 'category'],
  },
}, { _id: false });

const BookingPrioritySchema = new Schema({
  _id: { type: Schema.Types.ObjectId, auto: true },
  providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  reason: { type: String, required: true },
}, { _id: false });

const MembershipTransactionSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, auto: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  reference: String,
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

// Type exports for the embedded schemas
export interface IFeaturedListing {
  _id: Types.ObjectId;
  serviceId?: Types.ObjectId;
  experienceId?: Types.ObjectId;
  title: string;
  imageUrl?: string;
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  placement?: 'top' | 'featured' | 'category';
}

export interface IBookingPriority {
  _id: Types.ObjectId;
  providerId: Types.ObjectId;
  expiresAt: Date;
  reason: string;
}

export interface IMembershipTransaction {
  _id: Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference?: string;
  createdAt: Date;
}

export interface IPremiumMembership extends Document {
  userId: Types.ObjectId;

  // Membership details
  tier: MembershipTier;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  startDate: Date;
  endDate: Date;

  // Membership benefits
  benefits: IMembershipBenefits;

  // Featured listings
  featuredListings: IFeaturedListing[];
  featuredListingCreditsUsed: number;

  // Booking priority
  bookingPriorities: IBookingPriority[];

  // Transactions (cashback, discounts, etc.)
  transactions: IMembershipTransaction[];
  totalCashbackEarned: number;
  totalDiscountsReceived: number;

  // Usage metrics
  metrics: {
    totalBookings: number;
    totalSpent: number;
    averageRating: number;
    referralCount: number;
    referralConversions: number;
    exclusiveOffersUsed: number;
    priorityBookings: number;
  };

  // Benefits tracking
  benefitsUsed: {
    cashbackLastCredited?: Date;
    exclusiveOffersUsedCount: number;
    vipConciergeRequestsCount: number;
  };

  // Payment info
  stripeCustomerId?: string;
  subscriptionId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const premiumMembershipSchema = new Schema<IPremiumMembership>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    tier: {
      type: String,
      enum: ['standard', 'silver', 'gold', 'platinum', 'vip'] as MembershipTier[],
      default: 'standard',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'suspended'],
      default: 'active',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    benefits: {
      featuredListingCredits: { type: Number, default: 0 },
      featuredListingDuration: { type: Number, default: 0 },
      prioritySupport: { type: Boolean, default: false },
      priorityResponseTime: Number,
      bookingPriority: { type: Boolean, default: false },
      exclusiveProviders: { type: Boolean, default: false },
      commissionDiscount: { type: Number, default: 0 },
      cashbackPercentage: { type: Number, default: 0 },
      exclusiveDiscounts: { type: Boolean, default: false },
      earlyAccess: { type: Boolean, default: false },
      exclusiveEvents: { type: Boolean, default: false },
      vipConcierge: { type: Boolean, default: false },
      customNotifications: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
    },
    featuredListings: [FeaturedListingSchema],
    featuredListingCreditsUsed: {
      type: Number,
      default: 0,
    },
    bookingPriorities: [BookingPrioritySchema],
    transactions: [MembershipTransactionSchema],
    totalCashbackEarned: {
      type: Number,
      default: 0,
    },
    totalDiscountsReceived: {
      type: Number,
      default: 0,
    },
    metrics: {
      totalBookings: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      referralCount: { type: Number, default: 0 },
      referralConversions: { type: Number, default: 0 },
      exclusiveOffersUsed: { type: Number, default: 0 },
      priorityBookings: { type: Number, default: 0 },
    },
    benefitsUsed: {
      cashbackLastCredited: Date,
      exclusiveOffersUsedCount: { type: Number, default: 0 },
      vipConciergeRequestsCount: { type: Number, default: 0 },
    },
    stripeCustomerId: String,
    subscriptionId: String,
  },
  {
    timestamps: true,
  }
);

// ============================================
// Virtuals
// ============================================

// Get available featured listing credits
premiumMembershipSchema.virtual('availableFeaturedCredits').get(function() {
  if (this.benefits.featuredListingCredits === -1) return -1; // Unlimited
  return Math.max(0, this.benefits.featuredListingCredits - this.featuredListingCreditsUsed);
});

// Check if membership is active
premiumMembershipSchema.virtual('isActive').get(function() {
  return this.status === 'active' && new Date() < this.endDate;
});

// Days until expiration
premiumMembershipSchema.virtual('daysUntilExpiration').get(function() {
  const now = new Date();
  const diff = this.endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Tier benefits summary
premiumMembershipSchema.virtual('benefitsSummary').get(function() {
  const tierBenefits = MEMBERSHIP_TIERS[this.tier];
  const highlights: string[] = [];

  if (tierBenefits.featuredListingCredits > 0) {
    highlights.push(`${tierBenefits.featuredListingCredits} Featured Listing Credits`);
  }
  if (tierBenefits.prioritySupport) {
    highlights.push(`Priority Support (<${tierBenefits.priorityResponseTime}h Response)`);
  }
  if (tierBenefits.bookingPriority) {
    highlights.push('Priority Booking Access');
  }
  if (tierBenefits.cashbackPercentage > 0) {
    highlights.push(`${tierBenefits.cashbackPercentage}% Cashback`);
  }
  if (tierBenefits.exclusiveDiscounts) {
    highlights.push('Exclusive Discounts');
  }
  if (tierBenefits.earlyAccess) {
    highlights.push('Early Access to Features');
  }
  if (tierBenefits.vipConcierge) {
    highlights.push('VIP Concierge Service');
  }

  return highlights;
});

// ============================================
// Instance Methods
// ============================================

/**
 * Check if user can use a specific benefit
 */
premiumMembershipSchema.methods.canUseBenefit = function(benefit: keyof IMembershipBenefits): boolean {
  return !!this.benefits[benefit];
};

/**
 * Check if featured listing credits are available
 */
premiumMembershipSchema.methods.hasFeaturedCredits = function(count: number = 1): boolean {
  const available = this.availableFeaturedCredits;
  return available === -1 || available >= count;
};

/**
 * Use a featured listing credit
 */
premiumMembershipSchema.methods.useFeaturedCredit = async function(count: number = 1): Promise<boolean> {
  if (!this.hasFeaturedCredits(count)) {
    return false;
  }

  if (this.benefits.featuredListingCredits !== -1) {
    this.featuredListingCreditsUsed += count;
  }
  await this.save();
  return true;
};

/**
 * Add cashback to membership
 */
premiumMembershipSchema.methods.addCashback = async function(
  amount: number,
  description: string,
  reference?: string
): Promise<void> {
  this.transactions.push({
    type: 'credit',
    amount,
    description,
    reference,
    createdAt: new Date(),
  });
  this.totalCashbackEarned += amount;
  this.benefitsUsed.cashbackLastCredited = new Date();
  await this.save();
};

/**
 * Add discount value received
 */
premiumMembershipSchema.methods.addDiscount = async function(amount: number, description: string): Promise<void> {
  this.transactions.push({
    type: 'credit',
    amount,
    description,
    createdAt: new Date(),
  });
  this.totalDiscountsReceived += amount;
  this.benefitsUsed.exclusiveOffersUsedCount += 1;
  await this.save();
};

/**
 * Add booking priority for a provider
 */
premiumMembershipSchema.methods.addBookingPriority = async function(
  providerId: Types.ObjectId,
  hours: number = 24,
  reason: string = 'Membership benefit'
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);

  this.bookingPriorities.push({
    providerId,
    expiresAt,
    reason,
  });
  await this.save();
};

/**
 * Check if user has booking priority with a provider
 */
premiumMembershipSchema.methods.hasBookingPriority = function(providerId: Types.ObjectId): boolean {
  if (!this.benefits.bookingPriority) return false;

  const now = new Date();
  return this.bookingPriorities.some(
    (p: IBookingPriority) => p.providerId.toString() === providerId.toString() && p.expiresAt > now
  );
};

/**
 * Update membership metrics
 */
premiumMembershipSchema.methods.updateMetrics = async function(data: Partial<IPremiumMembership['metrics']>): Promise<void> {
  Object.assign(this.metrics, data);
  await this.save();
};

/**
 * Check and update tier based on requirements
 */
premiumMembershipSchema.methods.checkTierUpgrade = async function(): Promise<{
  canUpgrade: boolean;
  currentTier: MembershipTier;
  suggestedTier?: MembershipTier;
  requirements?: Record<string, number>;
}> {
  const currentTierIndex = (['standard', 'silver', 'gold', 'platinum', 'vip'] as MembershipTier[]).indexOf(this.tier);
  let suggestedTier: MembershipTier | undefined;

  // Check each higher tier
  for (let i = currentTierIndex + 1; i < 5; i++) {
    const nextTier = (['standard', 'silver', 'gold', 'platinum', 'vip'] as MembershipTier[])[i];
    const requirements = TIER_REQUIREMENTS[nextTier];
    let meetsAll = true;

    for (const [key, value] of Object.entries(requirements)) {
      if (value && typeof value === 'number') {
        const metricKey = key.replace('min', '').toLowerCase();
        const userValue = this.metrics[metricKey as keyof IPremiumMembership['metrics']];
        if (typeof userValue === 'number' && userValue < value) {
          meetsAll = false;
          break;
        }
      }
    }

    if (meetsAll) {
      suggestedTier = nextTier;
      break;
    }
  }

  return {
    canUpgrade: !!suggestedTier,
    currentTier: this.tier,
    suggestedTier,
    requirements: suggestedTier ? TIER_REQUIREMENTS[suggestedTier] : undefined,
  };
};

/**
 * Upgrade membership tier
 */
premiumMembershipSchema.methods.upgradeTier = async function(
  newTier: MembershipTier,
  duration: number = 30 // days
): Promise<void> {
  this.tier = newTier;
  this.benefits = { ...MEMBERSHIP_TIERS[newTier] };
  this.featuredListingCreditsUsed = 0; // Reset on upgrade

  // Extend end date
  const newEndDate = new Date(this.endDate);
  newEndDate.setDate(newEndDate.getDate() + duration);
  this.endDate = newEndDate;

  await this.save();
};

// ============================================
// Static Methods
// ============================================

/**
 * Find membership by user ID
 */
premiumMembershipSchema.statics.findByUserId = function(userId: string | Types.ObjectId) {
  return this.findOne({ userId });
};

/**
 * Find memberships due for expiration
 */
premiumMembershipSchema.statics.findDueForExpiration = function(daysBefore: number = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysBefore);

  return this.find({
    status: 'active',
    endDate: {
      $lte: futureDate,
      $gte: new Date(),
    },
  });
};

/**
 * Get membership statistics
 */
premiumMembershipSchema.statics.getStats = async function() {
  const tierStats = await this.aggregate([
    {
      $group: {
        _id: '$tier',
        count: { $sum: 1 },
        avgSpent: { $avg: '$metrics.totalSpent' },
        totalCashback: { $sum: '$totalCashbackEarned' },
      },
    },
  ]);

  const statusStats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    byTier: tierStats.reduce((acc, t) => {
      acc[t._id] = {
        count: t.count,
        avgSpent: Math.round(t.avgSpent || 0),
        totalCashback: t.totalCashback,
      };
      return acc;
    }, {} as Record<string, { count: number; avgSpent: number; totalCashback: number }>),
    byStatus: statusStats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {} as Record<string, number>),
  };
};

// ============================================
// Middleware
// ============================================

// Pre-save hook to set default benefits based on tier
premiumMembershipSchema.pre('save', function(next) {
  if (this.isNew) {
    this.benefits = { ...MEMBERSHIP_TIERS[this.tier] };
    this.metrics = {
      totalBookings: 0,
      totalSpent: 0,
      averageRating: 0,
      referralCount: 0,
      referralConversions: 0,
      exclusiveOffersUsed: 0,
      priorityBookings: 0,
    };
  }

  // Check for expired membership
  if (this.isModified('endDate') && this.endDate < new Date() && this.status === 'active') {
    this.status = 'expired';
  }

  next();
});

// ============================================
// Indexes
// ============================================

premiumMembershipSchema.index({ userId: 1, status: 1 });
premiumMembershipSchema.index({ tier: 1, status: 1 });
premiumMembershipSchema.index({ endDate: 1, status: 1 });
premiumMembershipSchema.index({ 'metrics.totalSpent': -1 });
premiumMembershipSchema.index({ 'metrics.referralCount': -1 });
premiumMembershipSchema.index({ createdAt: -1 });

// ============================================
// Export
// ============================================

export const PremiumMembership = mongoose.model('PremiumMembership', premiumMembershipSchema) as any;

// Add findByUserId static method
(PremiumMembership as any).findByUserId = function(userId: string | Types.ObjectId) {
  return this.findOne({ userId });
};

export default PremiumMembership;
