import mongoose, { Types } from 'mongoose';
import CustomerMetrics, { ICustomerMetrics, AbuseFlagType, CustomerTier } from '../models/customerMetrics.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';

// ============================================
// Abuse Detection Thresholds
// ============================================

const THRESHOLDS = {
  refund: {
    highRefundRate: 0.25, // 25% refund rate
    maxRefundsPerMonth: 3,
    maxRefundAmount: 500, // AED
    refundVelocityWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  loyalty: {
    maxReferralsPerWeek: 3,
    minTimeBetweenReferrals: 60 * 60 * 1000, // 1 hour
    suspiciousReferralBonus: 50, // AED minimum bonus
    pointManipulationThreshold: 1000,
  },
  coupon: {
    maxCouponUsage: 5,
    couponVelocityWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
    uniqueAccountsForFraud: 2,
  },
  chargeback: {
    maxChargebacks: 1,
    chargebackAmountThreshold: 100, // AED
    chargebackVelocityWindow: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  spam: {
    maxReportsBeforeFlag: 3,
    reportVelocityWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  general: {
    maxNoShows: 2,
    maxCancellationRate: 0.5, // 50%
    trustScoreThreshold: 40,
  },
  // NEW: Velocity-based fraud detection thresholds
  velocity: {
    maxRegistrationsPerIPPerHour: 5,
    maxRegistrationsPerDevicePerDay: 3,
    maxReferralsPerIPPerDay: 3,
    referralWindowMinutes: 1, // Time window for self-referral detection
    registrationVelocityWindow: 60 * 60 * 1000, // 1 hour
  },
};

// ============================================
// Detection Result Types
// ============================================

export interface AbuseDetectionResult {
  isAbuse: boolean;
  type: AbuseFlagType | null;
  confidence: number; // 0-100
  details: string;
  recommendedAction: 'allow' | 'review' | 'block';
  evidence: Record<string, unknown>;
}

export interface RefundAbuseResult extends AbuseDetectionResult {
  refundHistory: {
    count: number;
    totalAmount: number;
    rate: number;
    recentTrend: 'increasing' | 'stable' | 'decreasing';
  };
}

export interface LoyaltyAbuseResult extends AbuseDetectionResult {
  referralAnalysis: {
    totalReferrals: number;
    suspiciousCount: number;
    patterns: string[];
  };
}

export interface CouponAbuseResult extends AbuseDetectionResult {
  couponAnalysis: {
    totalUsage: number;
    uniqueCoupons: number;
    accountOverlap: number;
    velocity: number; // uses per week
  };
}

export interface ChargebackResult extends AbuseDetectionResult {
  chargebackHistory: {
    count: number;
    totalAmount: number;
    isDisputed: boolean;
    merchantLoss: number;
  };
}

// ============================================
// Velocity Check Result Type
// ============================================

export interface VelocityCheckResult {
  isVelocityAbuse: boolean;
  velocityType: 'registration' | 'referral' | 'login' | 'booking';
  confidence: number;
  details: string;
  recommendedAction: 'allow' | 'review' | 'block';
  evidence: {
    ip?: string;
    fingerprint?: string;
    count: number;
    threshold: number;
    timeWindow: string;
  };
}

// ============================================
// AbuseDetectionService Class
// ============================================

export class AbuseDetectionService {
  // ========================================
  // Refund Abuse Detection
  // ========================================

  /**
   * Analyze a customer for refund abuse patterns
   */
  async detectRefundAbuse(userId: string | Types.ObjectId): Promise<RefundAbuseResult> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      return {
        isAbuse: false,
        type: null,
        confidence: 0,
        details: 'No metrics found for user',
        recommendedAction: 'allow',
        evidence: {},
        refundHistory: { count: 0, totalAmount: 0, rate: 0, recentTrend: 'stable' },
      };
    }

    const refundHistory = await this.getRefundHistory(userObjectId);
    const trend = this.analyzeRefundTrend(refundHistory);

    // Calculate abuse indicators
    const abuseIndicators: { indicator: string; weight: number; value: boolean }[] = [
      {
        indicator: 'High refund rate',
        weight: metrics.refundRate > THRESHOLDS.refund.highRefundRate * 100 ? 40 : 0,
        value: metrics.refundRate > THRESHOLDS.refund.highRefundRate * 100,
      },
      {
        indicator: 'Multiple refunds in short period',
        weight: refundHistory.length > THRESHOLDS.refund.maxRefundsPerMonth ? 30 : 0,
        value: refundHistory.length > THRESHOLDS.refund.maxRefundsPerMonth,
      },
      {
        indicator: 'Increasing refund trend',
        weight: trend === 'increasing' ? 20 : 0,
        value: trend === 'increasing',
      },
      {
        indicator: 'High individual refund amounts',
        weight: metrics.refundAmount > THRESHOLDS.refund.maxRefundAmount * 3 ? 10 : 0,
        value: metrics.refundAmount > THRESHOLDS.refund.maxRefundAmount * 3,
      },
    ];

    const confidence = abuseIndicators.reduce((sum, i) => sum + i.weight, 0);
    const isAbuse = confidence >= 50;

    // Determine if this is a pattern or isolated incident
    const recentRefunds = refundHistory.filter(
      (r) => Date.now() - r.timestamp.getTime() < THRESHOLDS.refund.refundVelocityWindow
    );

    return {
      isAbuse,
      type: isAbuse ? 'high_refund_rate' : null,
      confidence,
      details: this.generateRefundAbuseDescription(abuseIndicators, metrics),
      recommendedAction: this.determineAction(confidence, metrics.trustScore),
      evidence: {
        metrics: {
          refundCount: metrics.refundCount,
          refundRate: metrics.refundRate,
          refundAmount: metrics.refundAmount,
        },
        recentRefunds: recentRefunds.length,
        trend,
        indicators: abuseIndicators.filter((i) => i.value).map((i) => i.indicator),
      },
      refundHistory: {
        count: metrics.refundCount,
        totalAmount: metrics.refundAmount,
        rate: metrics.refundRate,
        recentTrend: trend,
      },
    };
  }

  /**
   * Get refund history for a user
   */
  private async getRefundHistory(userId: Types.ObjectId): Promise<Array<{ timestamp: Date; amount: number }>> {
    const bookings = await Booking.find({
      customerId: userId,
      'cancellationDetails.refundAmount': { $gt: 0 },
    }).select('cancellationDetails createdAt').lean();

    return bookings.map((b) => ({
      timestamp: b.createdAt,
      amount: b.cancellationDetails?.refundAmount || 0,
    }));
  }

  /**
   * Analyze refund trend over time
   */
  private analyzeRefundTrend(history: Array<{ timestamp: Date; amount: number }>): 'increasing' | 'stable' | 'decreasing' {
    if (history.length < 3) return 'stable';

    const sorted = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const midpoint = Math.floor(sorted.length / 2);

    const firstHalfAvg = sorted.slice(0, midpoint).reduce((sum, r) => sum + r.amount, 0) / midpoint;
    const secondHalfAvg = sorted.slice(midpoint).reduce((sum, r) => sum + r.amount, 0) / (sorted.length - midpoint);

    if (secondHalfAvg > firstHalfAvg * 1.3) return 'increasing';
    if (secondHalfAvg < firstHalfAvg * 0.7) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate human-readable abuse description
   */
  private generateRefundAbuseDescription(
    indicators: Array<{ indicator: string; weight: number; value: boolean }>,
    metrics: ICustomerMetrics
  ): string {
    const activeIndicators = indicators.filter((i) => i.value).map((i) => i.indicator);

    if (activeIndicators.length === 0) {
      return 'No refund abuse patterns detected';
    }

    return `Refund abuse detected: ${activeIndicators.join(', ')}. ` +
      `Current refund rate: ${metrics.refundRate.toFixed(1)}%, ` +
      `total refunds: ${metrics.refundCount}, ` +
      `total refund amount: ${metrics.refundAmount} AED`;
  }

  // ========================================
  // Loyalty Abuse Detection
  // ========================================

  /**
   * Detect loyalty/referral abuse
   */
  async detectLoyaltyAbuse(userId: string | Types.ObjectId): Promise<LoyaltyAbuseResult> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      return {
        isAbuse: false,
        type: null,
        confidence: 0,
        details: 'No metrics found for user',
        recommendedAction: 'allow',
        evidence: {},
        referralAnalysis: { totalReferrals: 0, suspiciousCount: 0, patterns: [] },
      };
    }

    const referralAnalysis = await this.analyzeReferralPatterns(userObjectId, metrics);
    const patterns = this.identifyReferralPatterns(referralAnalysis);

    // Calculate abuse confidence
    const abuseIndicators: { indicator: string; weight: number; value: boolean }[] = [
      {
        indicator: 'High referral count in short period',
        weight: metrics.referralCount > THRESHOLDS.loyalty.maxReferralsPerWeek * 4 ? 40 : 0,
        value: metrics.referralCount > THRESHOLDS.loyalty.maxReferralsPerWeek * 4,
      },
      {
        indicator: 'Suspicious referrals detected',
        weight: metrics.suspiciousReferrals > 0 ? 30 : 0,
        value: metrics.suspiciousReferrals > 0,
      },
      {
        indicator: 'Point manipulation detected',
        weight: metrics.loyaltyPointsEarned > THRESHOLDS.loyalty.pointManipulationThreshold ? 20 : 0,
        value: metrics.loyaltyPointsEarned > THRESHOLDS.loyalty.pointManipulationThreshold,
      },
      {
        indicator: 'Multiple referral patterns',
        weight: patterns.length > 2 ? 10 : 0,
        value: patterns.length > 2,
      },
    ];

    const confidence = abuseIndicators.reduce((sum, i) => sum + i.weight, 0);
    const isAbuse = confidence >= 50;

    return {
      isAbuse,
      type: isAbuse ? 'fake_referral' : null,
      confidence,
      details: this.generateLoyaltyAbuseDescription(abuseIndicators, referralAnalysis, metrics),
      recommendedAction: this.determineAction(confidence, metrics.trustScore),
      evidence: {
        metrics: {
          referralCount: metrics.referralCount,
          suspiciousReferrals: metrics.suspiciousReferrals,
          pointsEarned: metrics.loyaltyPointsEarned,
        },
        referralAnalysis,
        patterns,
        indicators: abuseIndicators.filter((i) => i.value).map((i) => i.indicator),
      },
      referralAnalysis: {
        totalReferrals: metrics.referralCount,
        suspiciousCount: metrics.suspiciousReferrals,
        patterns,
      },
    };
  }

  /**
   * Analyze referral patterns for a user
   */
  private async analyzeReferralPatterns(
    userId: Types.ObjectId,
    metrics: ICustomerMetrics
  ): Promise<{
    referredUsers: Array<{ userId: Types.ObjectId; timestamp: Date; isSuspicious: boolean }>;
    accountAgeCorrelation: number;
    deviceOverlap: number;
  }> {
    // Get the user and their referral code
    const user = await User.findById(userId).select('loyaltySystem.referralCode createdAt');
    if (!user?.loyaltySystem?.referralCode) {
      return {
        referredUsers: [],
        accountAgeCorrelation: 0,
        deviceOverlap: 0,
      };
    }

    // Find users referred by this user
    const referredUsersData = await User.find({
      'loyaltySystem.referredBy': userId,
    })
      .select('createdAt')
      .lean();

    const referredUsers = referredUsersData.map((u) => {
      // Flag suspicious referrals: new accounts created within short time windows
      const timeDiff = u.createdAt.getTime() - user.createdAt.getTime();
      const isSuspicious =
        timeDiff < THRESHOLDS.loyalty.minTimeBetweenReferrals * 5 || // Multiple in short time
        timeDiff > 365 * 24 * 60 * 60 * 1000; // Very old referral

      return {
        userId: u._id as Types.ObjectId,
        timestamp: u.createdAt,
        isSuspicious,
      };
    });

    // Calculate account age correlation (referrals made shortly after own signup = suspicious)
    const ownAge = Date.now() - user.createdAt.getTime();
    const recentReferrals = referredUsers.filter(
      (r) => Date.now() - r.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000
    );
    const accountAgeCorrelation = ownAge > 0 ? recentReferrals.length / (ownAge / (24 * 60 * 60 * 1000)) : 0;

    return {
      referredUsers,
      accountAgeCorrelation,
      deviceOverlap: 0, // Would need device tracking data
    };
  }

  /**
   * Identify specific referral abuse patterns
   */
  private identifyReferralPatterns(analysis: {
    referredUsers: Array<{ userId: Types.ObjectId; timestamp: Date; isSuspicious: boolean }>;
    accountAgeCorrelation: number;
    deviceOverlap: number;
  }): string[] {
    const patterns: string[] = [];

    // Check for burst referrals (many in short time)
    const sortedTimestamps = analysis.referredUsers
      .map((r) => r.timestamp.getTime())
      .sort((a, b) => a - b);

    if (sortedTimestamps.length > 1) {
      const gaps: number[] = [];
      for (let i = 1; i < sortedTimestamps.length; i++) {
        gaps.push(sortedTimestamps[i] - sortedTimestamps[i - 1]);
      }
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

      if (avgGap < THRESHOLDS.loyalty.minTimeBetweenReferrals * 2) {
        patterns.push('Burst referral pattern detected');
      }
    }

    // Check for high account age correlation
    if (analysis.accountAgeCorrelation > 0.5) {
      patterns.push('High referral velocity shortly after signup');
    }

    // Check for suspicious referrals
    const suspiciousCount = analysis.referredUsers.filter((r) => r.isSuspicious).length;
    if (suspiciousCount > 0) {
      patterns.push(`${suspiciousCount} suspicious referral(s) identified`);
    }

    // Check for device/IP overlap (would need actual device tracking)
    if (analysis.deviceOverlap > 0) {
      patterns.push('Device/IP overlap detected');
    }

    return patterns;
  }

  /**
   * Generate human-readable loyalty abuse description
   */
  private generateLoyaltyAbuseDescription(
    indicators: Array<{ indicator: string; weight: number; value: boolean }>,
    analysis: { referredUsers: Array<{ userId: Types.ObjectId; timestamp: Date; isSuspicious: boolean }> },
    metrics: ICustomerMetrics
  ): string {
    const activeIndicators = indicators.filter((i) => i.value).map((i) => i.indicator);
    const suspiciousCount = analysis.referredUsers.filter((r) => r.isSuspicious).length;

    if (activeIndicators.length === 0) {
      return 'No loyalty abuse patterns detected';
    }

    return `Loyalty abuse detected: ${activeIndicators.join(', ')}. ` +
      `Total referrals: ${metrics.referralCount}, ` +
      `Suspicious referrals: ${suspiciousCount}`;
  }

  // ========================================
  // Coupon Abuse Detection
  // ========================================

  /**
   * Detect coupon abuse patterns
   */
  async detectCouponAbuse(userId: string | Types.ObjectId): Promise<CouponAbuseResult> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      return {
        isAbuse: false,
        type: null,
        confidence: 0,
        details: 'No metrics found for user',
        recommendedAction: 'allow',
        evidence: {},
        couponAnalysis: { totalUsage: 0, uniqueCoupons: 0, accountOverlap: 0, velocity: 0 },
      };
    }

    const couponAnalysis = await this.analyzeCouponUsage(userObjectId, metrics);

    // Calculate abuse confidence
    const abuseIndicators: { indicator: string; weight: number; value: boolean }[] = [
      {
        indicator: 'Excessive coupon usage',
        weight: metrics.couponUsageCount > THRESHOLDS.coupon.maxCouponUsage * 3 ? 40 : 0,
        value: metrics.couponUsageCount > THRESHOLDS.coupon.maxCouponUsage * 3,
      },
      {
        indicator: 'High coupon velocity',
        weight: couponAnalysis.velocity > THRESHOLDS.coupon.maxCouponUsage ? 30 : 0,
        value: couponAnalysis.velocity > THRESHOLDS.coupon.maxCouponUsage,
      },
      {
        indicator: 'Previous coupon abuse',
        weight: metrics.couponAbuseCount > 0 ? 20 : 0,
        value: metrics.couponAbuseCount > 0,
      },
      {
        indicator: 'Account overlap detected',
        weight: couponAnalysis.accountOverlap > THRESHOLDS.coupon.uniqueAccountsForFraud ? 10 : 0,
        value: couponAnalysis.accountOverlap > THRESHOLDS.coupon.uniqueAccountsForFraud,
      },
    ];

    const confidence = abuseIndicators.reduce((sum, i) => sum + i.weight, 0);
    const isAbuse = confidence >= 50;

    return {
      isAbuse,
      type: isAbuse ? 'coupon_abuse' : null,
      confidence,
      details: this.generateCouponAbuseDescription(abuseIndicators, couponAnalysis, metrics),
      recommendedAction: this.determineAction(confidence, metrics.trustScore),
      evidence: {
        metrics: {
          couponUsageCount: metrics.couponUsageCount,
          couponAbuseCount: metrics.couponAbuseCount,
        },
        couponAnalysis,
        indicators: abuseIndicators.filter((i) => i.value).map((i) => i.indicator),
      },
      couponAnalysis,
    };
  }

  /**
   * Analyze coupon usage patterns
   */
  private async analyzeCouponUsage(
    userId: Types.ObjectId,
    metrics: ICustomerMetrics
  ): Promise<{
    totalUsage: number;
    uniqueCoupons: number;
    accountOverlap: number;
    velocity: number;
  }> {
    // Get bookings with coupon usage
    const bookings = await Booking.find({
      customerId: userId,
      'pricing.couponDiscount': { $gt: 0 },
    })
      .select('createdAt pricing.couponDiscount')
      .lean() as Array<{ createdAt: Date; pricing?: { couponDiscount?: number } }>;

    const totalUsage = bookings.length;
    const uniqueCoupons = new Set(bookings.map((b) => b.pricing?.couponDiscount)).size;

    // Calculate velocity (uses per week)
    const now = Date.now();
    const thirtyDaysAgo = now - THRESHOLDS.coupon.couponVelocityWindow;
    const recentUses = bookings.filter((b) => b.createdAt.getTime() > thirtyDaysAgo).length;
    const velocity = (recentUses / 30) * 7; // uses per week

    // Account overlap would require device/IP tracking - placeholder
    const accountOverlap = metrics.couponAbuseCount > 0 ? 1 : 0;

    return {
      totalUsage,
      uniqueCoupons,
      accountOverlap,
      velocity,
    };
  }

  /**
   * Generate coupon abuse description
   */
  private generateCouponAbuseDescription(
    indicators: Array<{ indicator: string; weight: number; value: boolean }>,
    analysis: { velocity: number; uniqueCoupons: number },
    metrics: ICustomerMetrics
  ): string {
    const activeIndicators = indicators.filter((i) => i.value).map((i) => i.indicator);

    if (activeIndicators.length === 0) {
      return 'No coupon abuse patterns detected';
    }

    return `Coupon abuse detected: ${activeIndicators.join(', ')}. ` +
      `Total coupon uses: ${metrics.couponUsageCount}, ` +
      `Unique coupons: ${analysis.uniqueCoupons}, ` +
      `Weekly velocity: ${analysis.velocity.toFixed(1)}`;
  }

  // ========================================
  // Chargeback Detection
  // ========================================

  /**
   * Detect chargeback patterns
   */
  async detectChargebackRisk(userId: string | Types.ObjectId): Promise<ChargebackResult> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      return {
        isAbuse: false,
        type: null,
        confidence: 0,
        details: 'No metrics found for user',
        recommendedAction: 'allow',
        evidence: {},
        chargebackHistory: { count: 0, totalAmount: 0, isDisputed: false, merchantLoss: 0 },
      };
    }

    // Calculate abuse confidence
    const abuseIndicators: { indicator: string; weight: number; value: boolean }[] = [
      {
        indicator: 'Chargeback count exceeds threshold',
        weight: metrics.chargebackCount >= THRESHOLDS.chargeback.maxChargebacks ? 60 : 0,
        value: metrics.chargebackCount >= THRESHOLDS.chargeback.maxChargebacks,
      },
      {
        indicator: 'High chargeback amount',
        weight: metrics.chargebackAmount > THRESHOLDS.chargeback.chargebackAmountThreshold ? 20 : 0,
        value: metrics.chargebackAmount > THRESHOLDS.chargeback.chargebackAmountThreshold,
      },
      {
        indicator: 'Combined with other abuse flags',
        weight: metrics.abuseCount > 0 ? 20 : 0,
        value: metrics.abuseCount > 0,
      },
    ];

    const confidence = abuseIndicators.reduce((sum, i) => sum + i.weight, 0);
    const isAbuse = confidence >= 50;

    // Calculate merchant loss (chargeback amount + fees, typically 15-20% extra)
    const merchantLoss = metrics.chargebackAmount * 1.2;

    return {
      isAbuse,
      type: isAbuse ? 'chargeback' : null,
      confidence,
      details: this.generateChargebackDescription(abuseIndicators, metrics),
      recommendedAction: this.determineChargebackAction(confidence, metrics),
      evidence: {
        metrics: {
          chargebackCount: metrics.chargebackCount,
          chargebackAmount: metrics.chargebackAmount,
          refundCount: metrics.refundCount,
          abuseCount: metrics.abuseCount,
        },
        merchantLoss,
        indicators: abuseIndicators.filter((i) => i.value).map((i) => i.indicator),
      },
      chargebackHistory: {
        count: metrics.chargebackCount,
        totalAmount: metrics.chargebackAmount,
        isDisputed: false,
        merchantLoss,
      },
    };
  }

  /**
   * Generate chargeback description
   */
  private generateChargebackDescription(
    indicators: Array<{ indicator: string; weight: number; value: boolean }>,
    metrics: ICustomerMetrics
  ): string {
    const activeIndicators = indicators.filter((i) => i.value).map((i) => i.indicator);

    if (activeIndicators.length === 0) {
      return 'No chargeback risk detected';
    }

    return `Chargeback risk detected: ${activeIndicators.join(', ')}. ` +
      `Total chargebacks: ${metrics.chargebackCount}, ` +
      `Total chargeback amount: ${metrics.chargebackAmount} AED`;
  }

  // ========================================
  // Spam Detection
  // ========================================

  /**
   * Detect spam patterns
   */
  async detectSpamRisk(userId: string | Types.ObjectId): Promise<AbuseDetectionResult> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      return {
        isAbuse: false,
        type: null,
        confidence: 0,
        details: 'No metrics found for user',
        recommendedAction: 'allow',
        evidence: {},
      };
    }

    // Calculate abuse confidence
    const abuseIndicators: { indicator: string; weight: number; value: boolean }[] = [
      {
        indicator: 'Multiple spam reports',
        weight: metrics.spamReports >= THRESHOLDS.spam.maxReportsBeforeFlag ? 60 : 0,
        value: metrics.spamReports >= THRESHOLDS.spam.maxReportsBeforeFlag,
      },
      {
        indicator: 'Fake engagement detected',
        weight: metrics.fakeEngagementCount > 0 ? 30 : 0,
        value: metrics.fakeEngagementCount > 0,
      },
      {
        indicator: 'Combined with low trust score',
        weight: metrics.trustScore < THRESHOLDS.general.trustScoreThreshold ? 10 : 0,
        value: metrics.trustScore < THRESHOLDS.general.trustScoreThreshold,
      },
    ];

    const confidence = abuseIndicators.reduce((sum, i) => sum + i.weight, 0);
    const isAbuse = confidence >= 50;

    return {
      isAbuse,
      type: isAbuse ? 'spam' : null,
      confidence,
      details: this.generateSpamDescription(abuseIndicators, metrics),
      recommendedAction: this.determineAction(confidence, metrics.trustScore),
      evidence: {
        metrics: {
          spamReports: metrics.spamReports,
          fakeEngagementCount: metrics.fakeEngagementCount,
          trustScore: metrics.trustScore,
        },
        indicators: abuseIndicators.filter((i) => i.value).map((i) => i.indicator),
      },
    };
  }

  /**
   * Generate spam description
   */
  private generateSpamDescription(
    indicators: Array<{ indicator: string; weight: number; value: boolean }>,
    metrics: ICustomerMetrics
  ): string {
    const activeIndicators = indicators.filter((i) => i.value).map((i) => i.indicator);

    if (activeIndicators.length === 0) {
      return 'No spam risk detected';
    }

    return `Spam risk detected: ${activeIndicators.join(', ')}. ` +
      `Total spam reports: ${metrics.spamReports}, ` +
      `Fake engagement count: ${metrics.fakeEngagementCount}`;
  }

  // ========================================
  // Comprehensive Abuse Check
  // ========================================

  /**
   * Run all abuse detection checks for a user
   */
  async comprehensiveAbuseCheck(
    userId: string | Types.ObjectId
  ): Promise<{
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    checks: {
      refund: RefundAbuseResult;
      loyalty: LoyaltyAbuseResult;
      coupon: CouponAbuseResult;
      chargeback: ChargebackResult;
      spam: AbuseDetectionResult;
    };
    recommendedActions: string[];
    shouldFlag: boolean;
  }> {
    const userObjectId = new Types.ObjectId(userId);

    // Run all checks in parallel
    const [refundCheck, loyaltyCheck, couponCheck, chargebackCheck, spamCheck] = await Promise.all([
      this.detectRefundAbuse(userObjectId),
      this.detectLoyaltyAbuse(userObjectId),
      this.detectCouponAbuse(userObjectId),
      this.detectChargebackRisk(userObjectId),
      this.detectSpamRisk(userObjectId),
    ]);

    // Calculate overall risk score
    const riskScores = [
      refundCheck.isAbuse ? refundCheck.confidence : 0,
      loyaltyCheck.isAbuse ? loyaltyCheck.confidence : 0,
      couponCheck.isAbuse ? couponCheck.confidence : 0,
      chargebackCheck.isAbuse ? chargebackCheck.confidence : 0,
      spamCheck.isAbuse ? spamCheck.confidence : 0,
    ];

    const maxRisk = Math.max(...riskScores);
    const avgRisk = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    const abuseCount = riskScores.filter((r) => r > 0).length;

    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (maxRisk >= 80 || avgRisk >= 50) overallRisk = 'critical';
    else if (maxRisk >= 60 || avgRisk >= 35) overallRisk = 'high';
    else if (maxRisk >= 40 || avgRisk >= 20) overallRisk = 'medium';

    // Determine recommended actions
    const recommendedActions: string[] = [];
    if (refundCheck.isAbuse && refundCheck.recommendedAction !== 'allow') {
      recommendedActions.push(`Review refund behavior (confidence: ${refundCheck.confidence}%)`);
    }
    if (loyaltyCheck.isAbuse && loyaltyCheck.recommendedAction !== 'allow') {
      recommendedActions.push(`Review loyalty/referral abuse (confidence: ${loyaltyCheck.confidence}%)`);
    }
    if (couponCheck.isAbuse && couponCheck.recommendedAction !== 'allow') {
      recommendedActions.push(`Review coupon usage (confidence: ${couponCheck.confidence}%)`);
    }
    if (chargebackCheck.isAbuse && chargebackCheck.recommendedAction !== 'allow') {
      recommendedActions.push(`Review chargeback risk (confidence: ${chargebackCheck.confidence}%)`);
    }
    if (spamCheck.isAbuse && spamCheck.recommendedAction !== 'allow') {
      recommendedActions.push(`Review spam reports (confidence: ${spamCheck.confidence}%)`);
    }

    // Flag if any abuse detected with high confidence
    const shouldFlag = abuseCount > 0 && maxRisk >= 50;

    return {
      overallRisk,
      checks: {
        refund: refundCheck,
        loyalty: loyaltyCheck,
        coupon: couponCheck,
        chargeback: chargebackCheck,
        spam: spamCheck,
      },
      recommendedActions,
      shouldFlag,
    };
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Determine recommended action based on confidence and trust score
   */
  private determineAction(confidence: number, trustScore: number): 'allow' | 'review' | 'block' {
    if (confidence >= 70 || (confidence >= 50 && trustScore < THRESHOLDS.general.trustScoreThreshold)) {
      return 'block';
    }
    if (confidence >= 40 || trustScore < 60) {
      return 'review';
    }
    return 'allow';
  }

  /**
   * Determine action for chargeback cases
   */
  private determineChargebackAction(confidence: number, metrics: ICustomerMetrics): 'allow' | 'review' | 'block' {
    if (confidence >= 60 || metrics.chargebackCount > 2) {
      return 'block';
    }
    if (confidence >= 30 || metrics.chargebackCount > 0) {
      return 'review';
    }
    return 'allow';
  }

  /**
   * Record a spam report against a user
   */
  async recordSpamReport(userId: string | Types.ObjectId, reporterId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.getOrCreateForUser(userObjectId);

    metrics.spamReports += 1;
    metrics.trustScore = metrics.calculateTrustScore();
    metrics.tier = metrics.determineTier();
    const risk = metrics.assessRisk();
    metrics.riskLevel = risk.level;
    metrics.riskFactors = risk.factors;

    // Auto-flag if threshold exceeded
    if (metrics.spamReports >= THRESHOLDS.spam.maxReportsBeforeFlag) {
      await metrics.addFlag('spam', `Spam report threshold exceeded: ${metrics.spamReports} reports`);

      // Log the flagging
      await createAuditLog({
        userId: reporterId,
        action: 'AUTO_FLAG_USER',
        resource: 'customer_metrics',
        resourceId: metrics._id.toString(),
        details: { type: 'spam', spamReports: metrics.spamReports },
        status: 'success',
      });
    }

    await metrics.save();

    logger.info('Spam report recorded', {
      userId: userObjectId.toString(),
      reporterId,
      totalReports: metrics.spamReports,
    });
  }

  /**
   * Process a new chargeback
   */
  async processChargeback(
    userId: string | Types.ObjectId,
    amount: number,
    processedBy: string
  ): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.getOrCreateForUser(userObjectId);

    metrics.chargebackCount += 1;
    metrics.chargebackAmount += amount;

    // Add flag if threshold exceeded
    if (metrics.chargebackCount >= THRESHOLDS.chargeback.maxChargebacks) {
      await metrics.addFlag(
        'chargeback',
        `Chargeback threshold exceeded: ${metrics.chargebackCount} chargeback(s), total ${metrics.chargebackAmount} AED`
      );
    }

    await metrics.save();

    // Log the chargeback
    await createAuditLog({
      userId: processedBy,
      action: 'CHARGEBACK_PROCESSED',
      resource: 'customer_metrics',
      resourceId: metrics._id.toString(),
      details: { customerId: userObjectId.toString(), amount, chargebackCount: metrics.chargebackCount },
      status: 'success',
    });

    logger.warn('Chargeback processed', {
      userId: userObjectId.toString(),
      amount,
      totalChargebacks: metrics.chargebackCount,
    });
  }

  // ========================================
  // Velocity-Based Fraud Detection
  // ========================================

  /**
   * Check for registration velocity abuse (too many registrations from same IP/device)
   */
  async checkRegistrationVelocity(ip: string, fingerprint: string): Promise<VelocityCheckResult> {
    const now = Date.now();
    const oneHourAgo = new Date(now - THRESHOLDS.velocity.registrationVelocityWindow);

    // Count registrations from same IP in last hour
    const ipRegistrationCount = await User.countDocuments({
      registrationIP: ip,
      createdAt: { $gte: oneHourAgo },
    });

    // Count registrations from same device fingerprint in last 24 hours
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const deviceRegistrationCount = await User.countDocuments({
      'deviceFingerprints.fingerprint': fingerprint,
      createdAt: { $gte: oneDayAgo },
    });

    const ipVelocityExceeded = ipRegistrationCount >= THRESHOLDS.velocity.maxRegistrationsPerIPPerHour;
    const deviceVelocityExceeded = deviceRegistrationCount >= THRESHOLDS.velocity.maxRegistrationsPerDevicePerDay;

    if (ipVelocityExceeded) {
      return {
        isVelocityAbuse: true,
        velocityType: 'registration',
        confidence: 80,
        details: `High velocity registration detected from IP: ${ipRegistrationCount} registrations in last hour`,
        recommendedAction: 'block',
        evidence: {
          ip,
          count: ipRegistrationCount,
          threshold: THRESHOLDS.velocity.maxRegistrationsPerIPPerHour,
          timeWindow: '1 hour',
        },
      };
    }

    if (deviceVelocityExceeded) {
      return {
        isVelocityAbuse: true,
        velocityType: 'registration',
        confidence: 70,
        details: `High velocity registration detected from device: ${deviceRegistrationCount} registrations in last 24 hours`,
        recommendedAction: 'review',
        evidence: {
          fingerprint,
          count: deviceRegistrationCount,
          threshold: THRESHOLDS.velocity.maxRegistrationsPerDevicePerDay,
          timeWindow: '24 hours',
        },
      };
    }

    return {
      isVelocityAbuse: false,
      velocityType: 'registration',
      confidence: 0,
      details: 'Registration velocity normal',
      recommendedAction: 'allow',
      evidence: {
        count: ipRegistrationCount,
        threshold: THRESHOLDS.velocity.maxRegistrationsPerIPPerHour,
        timeWindow: '1 hour',
      },
    };
  }

  /**
   * Check for referral velocity abuse
   */
  async checkReferralVelocity(referrerId: string | Types.ObjectId): Promise<VelocityCheckResult> {
    const userObjectId = new Types.ObjectId(referrerId);
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    // Count referrals made in last 24 hours
    const referralCount = await User.countDocuments({
      'loyaltySystem.referredBy': userObjectId,
      createdAt: { $gte: oneDayAgo },
    });

    if (referralCount >= THRESHOLDS.velocity.maxReferralsPerIPPerDay * 2) {
      // More than 2x the threshold = high confidence abuse
      return {
        isVelocityAbuse: true,
        velocityType: 'referral',
        confidence: 90,
        details: `Critical referral velocity: ${referralCount} referrals in last 24 hours`,
        recommendedAction: 'block',
        evidence: {
          count: referralCount,
          threshold: THRESHOLDS.velocity.maxReferralsPerIPPerDay,
          timeWindow: '24 hours',
        },
      };
    }

    if (referralCount >= THRESHOLDS.velocity.maxReferralsPerIPPerDay) {
      return {
        isVelocityAbuse: true,
        velocityType: 'referral',
        confidence: 60,
        details: `High referral velocity: ${referralCount} referrals in last 24 hours`,
        recommendedAction: 'review',
        evidence: {
          count: referralCount,
          threshold: THRESHOLDS.velocity.maxReferralsPerIPPerDay,
          timeWindow: '24 hours',
        },
      };
    }

    return {
      isVelocityAbuse: false,
      velocityType: 'referral',
      confidence: 0,
      details: 'Referral velocity normal',
      recommendedAction: 'allow',
      evidence: {
        count: referralCount,
        threshold: THRESHOLDS.velocity.maxReferralsPerIPPerDay,
        timeWindow: '24 hours',
      },
    };
  }

  /**
   * Check for suspicious IP patterns (VPN, Proxy, Tor)
   * This is a simplified check - in production, use a GeoIP service
   */
  async checkIPSuspicion(ip: string): Promise<{
    isSuspicious: boolean;
    confidence: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let confidence = 0;

    // Check for private/invalid IP ranges
    if (ip.startsWith('10.') || ip.startsWith('172.16.') || ip.startsWith('192.168.')) {
      reasons.push('Private IP address (may be legitimate VPN)');
      confidence += 20;
    }

    // Check for localhost
    if (ip === '127.0.0.1' || ip === '::1') {
      reasons.push('Localhost address');
      confidence += 30;
    }

    // In production, add more sophisticated checks:
    // - Check against VPN/Proxy databases
    // - Check for Tor exit nodes
    // - Use services like IPQualityScore, MaxMind, etc.

    return {
      isSuspicious: confidence >= 50,
      confidence,
      reasons,
    };
  }

  /**
   * Comprehensive fraud check combining multiple signals
   */
  async comprehensiveFraudCheck(
    ip: string,
    fingerprint: string,
    email: string
  ): Promise<{
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    checks: {
      registrationVelocity: VelocityCheckResult;
      ipSuspicion: { isSuspicious: boolean; confidence: number; reasons: string[] };
      existingAccounts: number;
    };
    recommendedAction: 'allow' | 'review' | 'block';
  }> {
    // Run all checks in parallel
    const [velocityCheck, ipSuspicion, existingAccounts] = await Promise.all([
      this.checkRegistrationVelocity(ip, fingerprint),
      this.checkIPSuspicion(ip),
      User.countDocuments({
        $or: [
          { registrationIP: ip },
          { 'deviceFingerprints.fingerprint': fingerprint },
        ],
        email: { $ne: email },
      }),
    ]);

    // Calculate overall risk
    let riskScore = 0;
    if (velocityCheck.isVelocityAbuse) riskScore += velocityCheck.confidence;
    if (ipSuspicion.isSuspicious) riskScore += ipSuspicion.confidence;
    if (existingAccounts >= 5) riskScore += 40;
    else if (existingAccounts >= 3) riskScore += 20;
    else if (existingAccounts >= 1) riskScore += 10;

    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (riskScore >= 80) overallRisk = 'critical';
    else if (riskScore >= 60) overallRisk = 'high';
    else if (riskScore >= 30) overallRisk = 'medium';

    let recommendedAction: 'allow' | 'review' | 'block' = 'allow';
    if (overallRisk === 'critical') recommendedAction = 'block';
    else if (overallRisk === 'high') recommendedAction = 'review';

    return {
      overallRisk,
      checks: {
        registrationVelocity: velocityCheck,
        ipSuspicion,
        existingAccounts,
      },
      recommendedAction,
    };
  }

  /**
   * Record velocity abuse for analytics
   */
  async recordVelocityAbuse(
    type: 'registration' | 'referral',
    ip?: string,
    fingerprint?: string,
    userId?: string
  ): Promise<void> {
    logger.warn('Velocity abuse recorded', {
      type,
      ip,
      fingerprint: fingerprint?.substring(0, 8),
      userId,
      timestamp: new Date().toISOString(),
    });

    // Create audit log
    await createAuditLog({
      userId: userId || 'SYSTEM',
      action: 'VELOCITY_ABUSE_DETECTED',
      resource: 'abuse_detection',
      resourceId: `${type}_${ip || fingerprint}`,
      details: { type, ip, fingerprint },
      status: 'success',
    });
  }
}

// Export singleton instance
export const abuseDetectionService = new AbuseDetectionService();
export default abuseDetectionService;
