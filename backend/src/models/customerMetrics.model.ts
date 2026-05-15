import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ============================================
// Flag Type Definitions
// ============================================

export type AbuseFlagType =
  | 'high_refund_rate'
  | 'chargeback'
  | 'coupon_abuse'
  | 'fake_referral'
  | 'suspicious_activity'
  | 'spam'
  | 'fake_review'
  | 'multiple_accounts'
  | 'payment_fraud';

export type CustomerTier = 'new' | 'regular' | 'trusted' | 'flagged' | 'banned';

// ============================================
// Static Methods Interface
// ============================================

export interface ICustomerMetricsModel extends Model<ICustomerMetrics> {
  getOrCreateForUser(userId: Types.ObjectId): Promise<ICustomerMetrics>;
  getHighRiskCustomers(limit?: number): Promise<ICustomerMetrics[]>;
  getFlaggedCustomers(options?: { page?: number; limit?: number; includeResolved?: boolean }): Promise<{ customers: ICustomerMetrics[]; total: number }>;
  getByTier(tier: CustomerTier, options?: { page?: number; limit?: number }): Promise<{ customers: ICustomerMetrics[]; total: number }>;
  getBlockedCustomers(options?: { page?: number; limit?: number }): Promise<{ customers: ICustomerMetrics[]; total: number }>;
  updateFromBooking(userId: Types.ObjectId, bookingData: { status: 'completed' | 'cancelled' | 'no_show'; totalAmount: number; isRefund?: boolean; refundAmount?: number }): Promise<void>;
  getStats(): Promise<{
    totalCustomers: number;
    tierDistribution: Record<CustomerTier, number>;
    riskDistribution: Record<string, number>;
    averageTrustScore: number;
    flaggedCount: number;
    blockedCount: number;
    topRiskFactors: { factor: string; count: number }[];
  }>;
}

export interface IAbuseFlag {
  type: AbuseFlagType;
  reason: string;
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  resolutionNotes?: string;
}

export interface ICustomerMetrics extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;

  // Trust scoring
  trustScore: number; // 0-100
  tier: CustomerTier;

  // Behavior metrics
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShows: number;
  cancellationRate: number; // percentage

  // Abuse indicators
  refundCount: number;
  refundAmount: number;
  refundRate: number; // percentage
  chargebackCount: number;
  chargebackAmount: number;

  // Loyalty abuse
  referralCount: number;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  suspiciousReferrals: number;

  // Coupon abuse
  couponUsageCount: number;
  couponAbuseCount: number;

  // Flags
  flags: IAbuseFlag[];

  // Abuse counts
  abuseCount: number;
  lastAbuseAt?: Date;
  lifetimeAbuseScore: number; // Cumulative score of all abuse incidents

  // Spam indicators
  spamReports: number;
  fakeEngagementCount: number;

  // Account status
  isBlocked: boolean;
  blockReason?: string;
  blockedAt?: Date;
  blockedBy?: Types.ObjectId;

  // Activity tracking
  firstBookingAt?: Date;
  lastBookingAt?: Date;
  averageBookingValue: number;
  totalSpent: number;

  // Review manipulation
  reviewsWritten: number;
  reviewsReceived: number;
  reviewManipulationScore: number; // 0-100, higher = more suspicious

  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance Methods
  calculateTrustScore(): number;
  determineTier(): CustomerTier;
  assessRisk(): { level: 'low' | 'medium' | 'high' | 'critical'; factors: string[] };
  addFlag(type: AbuseFlagType, reason: string): Promise<void>;
  resolveFlag(flagIndex: number, resolvedBy: Types.ObjectId, notes?: string): Promise<void>;
  block(blockedBy: Types.ObjectId, reason: string): Promise<void>;
  unblock(): Promise<void>;
}

// ============================================
// Schema Definition
// ============================================

const customerMetricsSchema = new Schema<ICustomerMetrics>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },

    // Trust scoring
    trustScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
      index: true,
    },

    tier: {
      type: String,
      enum: ['new', 'regular', 'trusted', 'flagged', 'banned'],
      default: 'new',
      index: true,
    },

    // Behavior metrics
    totalBookings: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedBookings: {
      type: Number,
      default: 0,
      min: 0,
    },

    cancelledBookings: {
      type: Number,
      default: 0,
      min: 0,
    },

    noShows: {
      type: Number,
      default: 0,
      min: 0,
    },

    cancellationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Abuse indicators - Refunds
    refundCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Abuse indicators - Chargebacks
    chargebackCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    chargebackAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Loyalty abuse
    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    loyaltyPointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    loyaltyPointsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },

    suspiciousReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Coupon abuse
    couponUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    couponAbuseCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Flags
    flags: [{
      type: {
        type: String,
        enum: [
          'high_refund_rate',
          'chargeback',
          'coupon_abuse',
          'fake_referral',
          'suspicious_activity',
          'spam',
          'fake_review',
          'multiple_accounts',
          'payment_fraud',
        ],
        required: true,
      },
      reason: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      resolved: {
        type: Boolean,
        default: false,
      },
      resolvedAt: Date,
      resolvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      resolutionNotes: String,
    }],

    // Abuse counts
    abuseCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastAbuseAt: Date,

    lifetimeAbuseScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Spam indicators
    spamReports: {
      type: Number,
      default: 0,
      min: 0,
    },

    fakeEngagementCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Account status
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    blockReason: String,

    blockedAt: Date,

    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    // Activity tracking
    firstBookingAt: Date,

    lastBookingAt: Date,

    averageBookingValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Review manipulation
    reviewsWritten: {
      type: Number,
      default: 0,
      min: 0,
    },

    reviewsReceived: {
      type: Number,
      default: 0,
      min: 0,
    },

    reviewManipulationScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Risk assessment
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
      index: true,
    },

    riskFactors: [{
      type: String,
    }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ============================================
// Indexes
// ============================================

// Compound indexes for common queries
customerMetricsSchema.index({ trustScore: 1, tier: 1 });
customerMetricsSchema.index({ riskLevel: 1, isBlocked: 1 });
customerMetricsSchema.index({ 'flags.type': 1, 'flags.resolved': 1 });
customerMetricsSchema.index({ abuseCount: -1, trustScore: 1 });
customerMetricsSchema.index({ tier: 1, trustScore: -1 });
customerMetricsSchema.index({ createdAt: -1 });
customerMetricsSchema.index({ lastAbuseAt: -1 });

// ============================================
// Instance Methods
// ============================================

/**
 * Calculate trust score based on behavior metrics
 */
customerMetricsSchema.methods.calculateTrustScore = function(): number {
  let score = 100;

  // Deduct for cancellations (more than 20%)
  if (this.cancellationRate > 20) {
    score -= (this.cancellationRate - 20) * 2;
  }

  // Deduct for no-shows
  score -= this.noShows * 5;

  // Deduct for high refund rate (more than 10%)
  if (this.refundRate > 10) {
    score -= (this.refundRate - 10) * 3;
  }

  // Deduct for chargebacks
  score -= this.chargebackCount * 20;

  // Deduct for abuse flags
  score -= this.abuseCount * 15;

  // Deduct for spam reports
  score -= this.spamReports * 10;

  // Deduct for suspicious referrals
  score -= this.suspiciousReferrals * 10;

  // Deduct for coupon abuse
  score -= this.couponAbuseCount * 8;

  // Deduct for review manipulation
  score -= this.reviewManipulationScore * 0.5;

  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Determine tier based on trust score and activity
 */
customerMetricsSchema.methods.determineTier = function(): CustomerTier {
  // Banned users always stay banned
  if (this.tier === 'banned') return 'banned';

  // Blocked/flagged users
  if (this.isBlocked || this.abuseCount > 2) return 'flagged';
  if (this.abuseCount > 0) return 'flagged';

  // New users
  if (this.totalBookings === 0) return 'new';
  if (this.totalBookings < 3) return 'new';

  // Calculate weighted score
  const trustWeight = this.trustScore * 0.7;
  const activityWeight = Math.min(this.totalBookings / 50, 1) * 30; // Max 30 points for 50+ bookings

  const weightedScore = trustWeight + activityWeight;

  // Determine tier
  if (weightedScore >= 80) return 'trusted';
  if (weightedScore >= 50) return 'regular';

  return 'flagged';
};

/**
 * Assess risk level based on various factors
 */
customerMetricsSchema.methods.assessRisk = function(): { level: 'low' | 'medium' | 'high' | 'critical'; factors: string[] } {
  const factors: string[] = [];
  let riskScore = 0;

  // Chargebacks - critical risk
  if (this.chargebackCount > 0) {
    riskScore += this.chargebackCount * 30;
    factors.push(`${this.chargebackCount} chargeback(s)`);
  }

  // High refund rate
  if (this.refundRate > 25) {
    riskScore += 40;
    factors.push(`High refund rate: ${this.refundRate}%`);
  } else if (this.refundRate > 10) {
    riskScore += 20;
    factors.push(`Elevated refund rate: ${this.refundRate}%`);
  }

  // High cancellation rate
  if (this.cancellationRate > 30) {
    riskScore += 20;
    factors.push(`High cancellation rate: ${this.cancellationRate}%`);
  }

  // No-shows
  if (this.noShows > 0) {
    riskScore += this.noShows * 10;
    factors.push(`${this.noShows} no-show(s)`);
  }

  // Suspicious referrals
  if (this.suspiciousReferrals > 0) {
    riskScore += this.suspiciousReferrals * 15;
    factors.push(`${this.suspiciousReferrals} suspicious referral(s)`);
  }

  // Coupon abuse
  if (this.couponAbuseCount > 0) {
    riskScore += this.couponAbuseCount * 10;
    factors.push(`${this.couponAbuseCount} coupon abuse incident(s)`);
  }

  // Spam reports
  if (this.spamReports > 0) {
    riskScore += this.spamReports * 15;
    factors.push(`${this.spamReports} spam report(s)`);
  }

  // Low trust score
  if (this.trustScore < 30) {
    riskScore += 30;
    factors.push(`Very low trust score: ${this.trustScore}`);
  } else if (this.trustScore < 50) {
    riskScore += 15;
    factors.push(`Low trust score: ${this.trustScore}`);
  }

  // Recent abuse
  if (this.lastAbuseAt) {
    const daysSinceAbuse = (Date.now() - this.lastAbuseAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAbuse < 30) {
      riskScore += 10;
      factors.push('Recent abuse activity');
    }
  }

  // Determine risk level
  let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (riskScore >= 80) level = 'critical';
  else if (riskScore >= 50) level = 'high';
  else if (riskScore >= 20) level = 'medium';

  return { level, factors };
};

/**
 * Add an abuse flag
 */
customerMetricsSchema.methods.addFlag = async function(
  type: AbuseFlagType,
  reason: string
): Promise<void> {
  this.flags.push({
    type,
    reason,
    createdAt: new Date(),
    resolved: false,
  });

  this.abuseCount += 1;
  this.lastAbuseAt = new Date();

  // Update lifetime abuse score
  const severityScores: Record<AbuseFlagType, number> = {
    chargeback: 50,
    payment_fraud: 50,
    multiple_accounts: 40,
    high_refund_rate: 30,
    coupon_abuse: 25,
    fake_referral: 25,
    suspicious_activity: 20,
    spam: 15,
    fake_review: 15,
  };

  this.lifetimeAbuseScore += severityScores[type] || 20;

  // Recalculate metrics
  this.trustScore = this.calculateTrustScore();
  this.tier = this.determineTier();
  const risk = this.assessRisk();
  this.riskLevel = risk.level;
  this.riskFactors = risk.factors;

  await this.save();
};

/**
 * Resolve an abuse flag
 */
customerMetricsSchema.methods.resolveFlag = async function(
  flagIndex: number,
  resolvedBy: Types.ObjectId,
  notes?: string
): Promise<void> {
  if (this.flags[flagIndex]) {
    this.flags[flagIndex].resolved = true;
    this.flags[flagIndex].resolvedAt = new Date();
    this.flags[flagIndex].resolvedBy = resolvedBy;
    this.flags[flagIndex].resolutionNotes = notes;

    // Recalculate metrics
    this.trustScore = this.calculateTrustScore();
    this.tier = this.determineTier();
    const risk = this.assessRisk();
    this.riskLevel = risk.level;
    this.riskFactors = risk.factors;

    await this.save();
  }
};

/**
 * Block customer
 */
customerMetricsSchema.methods.block = async function(
  blockedBy: Types.ObjectId,
  reason: string
): Promise<void> {
  this.isBlocked = true;
  this.blockedAt = new Date();
  this.blockedBy = blockedBy;
  this.blockReason = reason;
  this.tier = 'banned';

  await this.save();
};

/**
 * Unblock customer
 */
customerMetricsSchema.methods.unblock = async function(): Promise<void> {
  this.isBlocked = false;
  this.blockReason = undefined;
  this.blockedAt = undefined;
  this.blockedBy = undefined;

  // Recalculate tier
  this.trustScore = this.calculateTrustScore();
  this.tier = this.determineTier();

  await this.save();
};

// ============================================
// Static Methods
// ============================================

/**
 * Get or create metrics for a user
 */
customerMetricsSchema.statics.getOrCreateForUser = async function(
  userId: Types.ObjectId
): Promise<ICustomerMetrics> {
  let metrics = await this.findOne({ userId });

  if (!metrics) {
    metrics = await this.create({ userId });
  }

  return metrics;
};

/**
 * Get high-risk customers
 */
customerMetricsSchema.statics.getHighRiskCustomers = function(
  limit: number = 50
): Promise<ICustomerMetrics[]> {
  return this.find({
    riskLevel: { $in: ['high', 'critical'] },
  })
    .sort({ lifetimeAbuseScore: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName email')
    .lean();
};

/**
 * Get flagged customers for review
 */
customerMetricsSchema.statics.getFlaggedCustomers = function(
  options: { page?: number; limit?: number; includeResolved?: boolean } = {}
): Promise<{ customers: ICustomerMetrics[]; total: number }> {
  const { page = 1, limit = 20, includeResolved = false } = options;

  const query: Record<string, unknown> = {
    tier: 'flagged',
  };

  if (!includeResolved) {
    query['flags.resolved'] = false;
  }

  return Promise.all([
    this.find(query)
      .sort({ trustScore: 1, lastAbuseAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'firstName lastName email avatar accountStatus')
      .lean(),
    this.countDocuments(query),
  ]).then(([customers, total]) => ({ customers, total }));
};

/**
 * Get customers by tier
 */
customerMetricsSchema.statics.getByTier = function(
  tier: CustomerTier,
  options: { page?: number; limit?: number } = {}
): Promise<{ customers: ICustomerMetrics[]; total: number }> {
  const { page = 1, limit = 20 } = options;

  return Promise.all([
    this.find({ tier })
      .sort({ trustScore: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'firstName lastName email avatar')
      .lean(),
    this.countDocuments({ tier }),
  ]).then(([customers, total]) => ({ customers, total }));
};

/**
 * Get blocked customers
 */
customerMetricsSchema.statics.getBlockedCustomers = function(
  options: { page?: number; limit?: number } = {}
): Promise<{ customers: ICustomerMetrics[]; total: number }> {
  const { page = 1, limit = 20 } = options;

  return Promise.all([
    this.find({ isBlocked: true })
      .sort({ blockedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'firstName lastName email avatar')
      .populate('blockedBy', 'firstName lastName')
      .lean(),
    this.countDocuments({ isBlocked: true }),
  ]).then(([customers, total]) => ({ customers, total }));
};

/**
 * Update metrics from booking data
 */
customerMetricsSchema.statics.updateFromBooking = async function(
  userId: Types.ObjectId,
  bookingData: {
    status: 'completed' | 'cancelled' | 'no_show';
    totalAmount: number;
    isRefund?: boolean;
    refundAmount?: number;
  }
): Promise<void> {
  const CustomerMetricsModel = this as unknown as typeof CustomerMetrics;
  const metrics = await CustomerMetricsModel.getOrCreateForUser(userId);

  metrics.totalBookings += 1;

  if (!metrics.firstBookingAt) {
    metrics.firstBookingAt = new Date();
  }
  metrics.lastBookingAt = new Date();

  if (bookingData.status === 'completed') {
    metrics.completedBookings += 1;
    metrics.totalSpent += bookingData.totalAmount;
    metrics.averageBookingValue = metrics.totalSpent / metrics.completedBookings;
  } else if (bookingData.status === 'cancelled') {
    metrics.cancelledBookings += 1;
  } else if (bookingData.status === 'no_show') {
    metrics.noShows += 1;
  }

  // Update refund metrics
  if (bookingData.isRefund && bookingData.refundAmount) {
    metrics.refundCount += 1;
    metrics.refundAmount += bookingData.refundAmount;
  }

  // Recalculate rates
  metrics.cancellationRate = metrics.totalBookings > 0
    ? (metrics.cancelledBookings / metrics.totalBookings) * 100
    : 0;

  metrics.refundRate = metrics.completedBookings > 0
    ? (metrics.refundCount / metrics.completedBookings) * 100
    : 0;

  // Recalculate trust score and tier
  metrics.trustScore = metrics.calculateTrustScore();
  metrics.tier = metrics.determineTier();
  const risk = metrics.assessRisk();
  metrics.riskLevel = risk.level;
  metrics.riskFactors = risk.factors;

  await metrics.save();
};

/**
 * Get customer ops statistics
 */
customerMetricsSchema.statics.getStats = async function(): Promise<{
  totalCustomers: number;
  tierDistribution: Record<CustomerTier, number>;
  riskDistribution: Record<string, number>;
  averageTrustScore: number;
  flaggedCount: number;
  blockedCount: number;
  topRiskFactors: { factor: string; count: number }[];
}> {
  const [
    totalCustomers,
    tierStats,
    riskStats,
    avgTrustScore,
    tierDistribution,
    riskDistribution,
  ] = await Promise.all([
    this.countDocuments(),
    this.aggregate([
      { $group: { _id: '$tier', count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $group: { _id: null, avg: { $avg: '$trustScore' } } },
    ]),
    this.find().select('tier').lean(),
    this.find().select('riskLevel').lean(),
  ]);

  // Flatten tier distribution
  const tierDist: Record<CustomerTier, number> = {
    new: 0,
    regular: 0,
    trusted: 0,
    flagged: 0,
    banned: 0,
  };

  tierStats.forEach((t: any) => {
    tierDist[t._id as CustomerTier] = t.count;
  });

  // Flatten risk distribution
  const riskDist: Record<string, number> = {};
  riskStats.forEach((r: any) => {
    riskDist[r._id] = r.count;
  });

  // Calculate flagged and blocked counts
  const flaggedCount = tierDistribution.filter((t: any) => t.tier === 'flagged').length;
  const blockedCount = tierDistribution.filter((t: any) => t.tier === 'banned').length;

  // Aggregate risk factors
  const riskFactorAggregation = await this.aggregate([
    { $unwind: '$riskFactors' },
    { $group: { _id: '$riskFactors', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const topRiskFactors = riskFactorAggregation.map((r: any) => ({
    factor: r._id,
    count: r.count,
  }));

  return {
    totalCustomers,
    tierDistribution: tierDist,
    riskDistribution: riskDist,
    averageTrustScore: Math.round(avgTrustScore[0]?.avg || 0),
    flaggedCount,
    blockedCount,
    topRiskFactors,
  };
};

// ============================================
// Export
// ============================================

const CustomerMetrics: Model<ICustomerMetrics> & ICustomerMetricsModel = mongoose.model<ICustomerMetrics, ICustomerMetricsModel>(
  'CustomerMetrics',
  customerMetricsSchema
) as Model<ICustomerMetrics> & ICustomerMetricsModel;

export type CustomerMetricsModel = Model<ICustomerMetrics> & ICustomerMetricsModel;

export default CustomerMetrics;
