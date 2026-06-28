import mongoose, { Types, FilterQuery } from 'mongoose';
import CustomerMetrics, { ICustomerMetrics, CustomerTier, IAbuseFlag, AbuseFlagType } from '../models/customerMetrics.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import { createAuditLog } from './audit.service';
import { abuseDetectionService } from './abuseDetection.service';
import logger from '../utils/logger';

// ============================================
// DTOs and Types
// ============================================

export interface CustomerSearchFilters {
  search?: string;
  tier?: CustomerTier | CustomerTier[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  isBlocked?: boolean;
  minTrustScore?: number;
  maxTrustScore?: number;
  hasUnresolvedFlags?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CustomerListResult {
  customers: Array<{
    metrics: ICustomerMetrics;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatar?: string;
      accountStatus: string;
    };
  }>;
  total: number;
  page: number;
  pages: number;
  stats: {
    totalCustomers: number;
    averageTrustScore: number;
    tierDistribution: Record<CustomerTier, number>;
    riskDistribution: Record<string, number>;
  };
}

export interface CustomerDetailResult {
  metrics: ICustomerMetrics;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
    accountStatus: string;
    isEmailVerified: boolean;
    createdAt: Date;
    lastLogin?: Date;
  };
  recentBookings: Array<{
    id: string;
    bookingNumber: string;
    service: string;
    provider: string;
    scheduledDate: Date;
    status: string;
    totalAmount: number;
  }>;
  abuseHistory: IAbuseFlag[];
  recommendations: string[];
}

export interface TrustScoreBreakdown {
  baseScore: number;
  deductions: Array<{
    category: string;
    reason: string;
    amount: number;
  }>;
  finalScore: number;
  tier: CustomerTier;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
}

export interface AdminActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// CustomerOpsService Class
// ============================================

export class CustomerOpsService {
  // ========================================
  // Customer List & Search
  // ========================================

  /**
   * Get paginated list of customers with metrics
   */
  async getCustomerList(
    filters: CustomerSearchFilters,
    page: number = 1,
    limit: number = 20,
    sortBy: string = 'trustScore',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<CustomerListResult> {
    const query: FilterQuery<ICustomerMetrics> = {};

    // Text search
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      const userIds = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
        ],
      }).distinct('_id');

      query.userId = { $in: userIds };
    }

    // Tier filter
    if (filters.tier) {
      query.tier = Array.isArray(filters.tier) ? { $in: filters.tier } : filters.tier;
    }

    // Risk level filter
    if (filters.riskLevel) {
      query.riskLevel = filters.riskLevel;
    }

    // Blocked filter
    if (filters.isBlocked !== undefined) {
      query.isBlocked = filters.isBlocked;
    }

    // Trust score range
    if (filters.minTrustScore !== undefined || filters.maxTrustScore !== undefined) {
      query.trustScore = {};
      if (filters.minTrustScore !== undefined) {
        (query.trustScore as Record<string, number>).$gte = filters.minTrustScore;
      }
      if (filters.maxTrustScore !== undefined) {
        (query.trustScore as Record<string, number>).$lte = filters.maxTrustScore;
      }
    }

    // Unresolved flags filter
    if (filters.hasUnresolvedFlags === true) {
      query['flags.resolved'] = false;
    }

    // Date range
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        (query.createdAt as Record<string, Date>).$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (query.createdAt as Record<string, Date>).$lte = filters.dateTo;
      }
    }

    // Build sort object
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination - stats aggregation runs in single query (no separate collection scan)
    const skip = (page - 1) * limit;

    const [metricsList, total, statsAggregation] = await Promise.all([
      CustomerMetrics.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomerMetrics.countDocuments(query),
      // Single aggregation for all stats: total, avgTrustScore, tier and risk distributions
      CustomerMetrics.aggregate([
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            avgTrustScore: { $avg: '$trustScore' },
            // Tier distribution
            tier_new: { $sum: { $cond: [{ $eq: ['$tier', 'new'] }, 1, 0] } },
            tier_regular: { $sum: { $cond: [{ $eq: ['$tier', 'regular'] }, 1, 0] } },
            tier_trusted: { $sum: { $cond: [{ $eq: ['$tier', 'trusted'] }, 1, 0] } },
            tier_flagged: { $sum: { $cond: [{ $eq: ['$tier', 'flagged'] }, 1, 0] } },
            tier_banned: { $sum: { $cond: [{ $eq: ['$tier', 'banned'] }, 1, 0] } },
            // Risk distribution
            risk_low: { $sum: { $cond: [{ $eq: ['$riskLevel', 'low'] }, 1, 0] } },
            risk_medium: { $sum: { $cond: [{ $eq: ['$riskLevel', 'medium'] }, 1, 0] } },
            risk_high: { $sum: { $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0] } },
            risk_critical: { $sum: { $cond: [{ $eq: ['$riskLevel', 'critical'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    // Get user data for all customers
    const userIds = metricsList.map((m) => m.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select('firstName lastName email avatar accountStatus')
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // Combine metrics with user data
    const customers = metricsList.map((m) => {
      const user = userMap.get(m.userId.toString());
      return {
        metrics: m as unknown as ICustomerMetrics,
        user: user
          ? {
              id: user._id.toString(),
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              avatar: user.avatar,
              accountStatus: user.accountStatus,
            }
          : {
              id: m.userId.toString(),
              firstName: 'Unknown',
              lastName: '',
              email: 'unknown@deleted.com',
              accountStatus: 'deactivated',
            },
      };
    });

    // Build distribution maps from single aggregation result
    const stats = statsAggregation[0];
    const tierDistribution: Record<CustomerTier, number> = {
      new: stats?.tier_new || 0,
      regular: stats?.tier_regular || 0,
      trusted: stats?.tier_trusted || 0,
      flagged: stats?.tier_flagged || 0,
      banned: stats?.tier_banned || 0,
    };

    const riskDistribution: Record<string, number> = {
      low: stats?.risk_low || 0,
      medium: stats?.risk_medium || 0,
      high: stats?.risk_high || 0,
      critical: stats?.risk_critical || 0,
    };

    return {
      customers,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        totalCustomers: stats?.totalCustomers || 0,
        averageTrustScore: Math.round(stats?.avgTrustScore || 0),
        tierDistribution,
        riskDistribution,
      },
    };
  }

  // ========================================
  // Customer Detail
  // ========================================

  /**
   * Get detailed information about a customer
   */
  async getCustomerDetail(userId: string): Promise<CustomerDetailResult> {
    const userObjectId = new Types.ObjectId(userId);

    // Get user
    const user = await User.findById(userObjectId);
    if (!user) {
      throw new ApiError(404, 'Customer not found');
    }

    // Get or create metrics
    const metrics = await CustomerMetrics.getOrCreateForUser(userObjectId);

    // Get recent bookings
    const recentBookings = await Booking.find({ customerId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('service', 'name')
      .populate('provider', 'firstName lastName')
      .select('bookingNumber scheduledDate status pricing.totalAmount')
      .lean();

    const formattedBookings = recentBookings.map((b) => ({
      id: b._id.toString(),
      bookingNumber: b.bookingNumber,
      service: (b.service as any)?.name || 'Unknown Service',
      provider: `${(b.provider as any)?.firstName || ''} ${(b.provider as any)?.lastName || ''}`.trim() || 'Unknown Provider',
      scheduledDate: b.scheduledDate,
      status: b.status,
      totalAmount: b.pricing?.totalAmount || 0,
    }));

    // Generate recommendations based on metrics
    const recommendations = this.generateRecommendations(metrics);

    return {
      metrics,
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        accountStatus: user.accountStatus,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
      recentBookings: formattedBookings,
      abuseHistory: metrics.flags,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on customer metrics
   */
  private generateRecommendations(metrics: ICustomerMetrics): string[] {
    const recommendations: string[] = [];

    // Trust score recommendations
    if (metrics.trustScore < 50) {
      recommendations.push('Consider manual review of recent activity');
    }
    if (metrics.trustScore < 30) {
      recommendations.push('Recommend enhanced monitoring or temporary restrictions');
    }

    // Tier recommendations
    if (metrics.tier === 'new' && metrics.totalBookings > 5) {
      recommendations.push('Customer has completed 5+ bookings - consider tier upgrade to regular');
    }
    if (metrics.tier === 'regular' && metrics.trustScore >= 80 && metrics.completedBookings >= 10) {
      recommendations.push('Customer qualifies for trusted tier based on consistent positive behavior');
    }

    // Behavior recommendations
    if (metrics.cancellationRate > 20) {
      recommendations.push('High cancellation rate - consider implementing booking restrictions');
    }
    if (metrics.noShows > 0) {
      recommendations.push('History of no-shows - consider reminder improvements');
    }
    if (metrics.refundRate > 15) {
      recommendations.push('Elevated refund rate - review for potential abuse patterns');
    }

    // Abuse indicators
    if (metrics.abuseCount > 0) {
      recommendations.push(`Customer has ${metrics.abuseCount} unresolved abuse flag(s)`);
    }
    if (metrics.chargebackCount > 0) {
      recommendations.push('Customer has chargeback history - flag for payment review');
    }

    // Positive signals
    if (metrics.trustScore >= 80 && metrics.abuseCount === 0) {
      recommendations.push('Customer demonstrates trustworthy behavior - eligible for priority support');
    }

    return recommendations;
  }

  // ========================================
  // Trust Score Management
  // ========================================

  /**
   * Get detailed trust score breakdown
   */
  async getTrustScoreBreakdown(userId: string): Promise<TrustScoreBreakdown> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      throw new ApiError(404, 'Customer metrics not found');
    }

    const deductions: Array<{ category: string; reason: string; amount: number }> = [];

    // Base score starts at 100
    let baseScore = 100;

    // Cancellation deduction
    if (metrics.cancellationRate > 20) {
      const deduction = (metrics.cancellationRate - 20) * 2;
      deductions.push({
        category: 'Cancellations',
        reason: `Cancellation rate ${metrics.cancellationRate.toFixed(1)}% exceeds 20% threshold`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // No-show deduction
    if (metrics.noShows > 0) {
      const deduction = metrics.noShows * 5;
      deductions.push({
        category: 'No-Shows',
        reason: `${metrics.noShows} no-show(s) recorded`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // Refund rate deduction
    if (metrics.refundRate > 10) {
      const deduction = (metrics.refundRate - 10) * 3;
      deductions.push({
        category: 'Refunds',
        reason: `Refund rate ${metrics.refundRate.toFixed(1)}% exceeds 10% threshold`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // Chargeback deduction
    if (metrics.chargebackCount > 0) {
      const deduction = metrics.chargebackCount * 20;
      deductions.push({
        category: 'Chargebacks',
        reason: `${metrics.chargebackCount} chargeback(s) recorded`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // Abuse flags deduction
    if (metrics.abuseCount > 0) {
      const deduction = metrics.abuseCount * 15;
      deductions.push({
        category: 'Abuse Flags',
        reason: `${metrics.abuseCount} unresolved abuse flag(s)`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // Spam reports deduction
    if (metrics.spamReports > 0) {
      const deduction = metrics.spamReports * 10;
      deductions.push({
        category: 'Spam',
        reason: `${metrics.spamReports} spam report(s)`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // Suspicious referrals deduction
    if (metrics.suspiciousReferrals > 0) {
      const deduction = metrics.suspiciousReferrals * 10;
      deductions.push({
        category: 'Suspicious Referrals',
        reason: `${metrics.suspiciousReferrals} suspicious referral(s)`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // Coupon abuse deduction
    if (metrics.couponAbuseCount > 0) {
      const deduction = metrics.couponAbuseCount * 8;
      deductions.push({
        category: 'Coupon Abuse',
        reason: `${metrics.couponAbuseCount} coupon abuse incident(s)`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // Review manipulation deduction
    if (metrics.reviewManipulationScore > 0) {
      const deduction = metrics.reviewManipulationScore * 0.5;
      deductions.push({
        category: 'Review Manipulation',
        reason: `Review manipulation score: ${metrics.reviewManipulationScore}`,
        amount: deduction,
      });
      baseScore -= deduction;
    }

    // Calculate final score
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));

    // Determine tier and risk
    const tier = metrics.determineTier();
    const risk = metrics.assessRisk();

    return {
      baseScore: 100,
      deductions,
      finalScore,
      tier,
      riskLevel: risk.level,
      riskFactors: risk.factors,
    };
  }

  /**
   * Recalculate and update trust score for a customer
   */
  async refreshTrustScore(userId: string, adminId: string): Promise<TrustScoreBreakdown> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      throw new ApiError(404, 'Customer metrics not found');
    }

    // Recalculate all metrics
    const newScore = metrics.calculateTrustScore();
    const newTier = metrics.determineTier();
    const risk = metrics.assessRisk();

    const oldScore = metrics.trustScore;
    const oldTier = metrics.tier;

    // Update metrics
    metrics.trustScore = newScore;
    metrics.tier = newTier;
    metrics.riskLevel = risk.level;
    metrics.riskFactors = risk.factors;
    await metrics.save();

    // Log the refresh
    await createAuditLog({
      userId: adminId,
      action: 'TRUST_SCORE_REFRESHED',
      resource: 'customer_metrics',
      resourceId: metrics._id.toString(),
      details: {
        customerId: userId,
        oldScore,
        newScore,
        oldTier,
        newTier,
      },
      status: 'success',
    });

    logger.info('Trust score refreshed', {
      customerId: userId,
      oldScore,
      newScore,
      oldTier,
      newTier,
    });

    return this.getTrustScoreBreakdown(userId);
  }

  // ========================================
  // Abuse Flag Management
  // ========================================

  /**
   * Add an abuse flag to a customer
   */
  async addAbuseFlag(
    userId: string,
    flagType: AbuseFlagType,
    reason: string,
    adminId: string
  ): Promise<AdminActionResult> {
    const userObjectId = new Types.ObjectId(userId);

    const metrics = await CustomerMetrics.getOrCreateForUser(userObjectId);

    // Add the flag
    await metrics.addFlag(flagType, reason);

    // Log the action
    await createAuditLog({
      userId: adminId,
      action: 'ABUSE_FLAG_ADDED',
      resource: 'customer_metrics',
      resourceId: metrics._id.toString(),
      details: {
        customerId: userId,
        flagType,
        reason,
        newTrustScore: metrics.trustScore,
        newTier: metrics.tier,
        newAbuseCount: metrics.abuseCount,
      },
      status: 'success',
    });

    logger.warn('Abuse flag added', {
      customerId: userId,
      adminId,
      flagType,
      reason,
    });

    return {
      success: true,
      message: `Abuse flag '${flagType}' added successfully`,
      data: {
        trustScore: metrics.trustScore,
        tier: metrics.tier,
        abuseCount: metrics.abuseCount,
        riskLevel: metrics.riskLevel,
      },
    };
  }

  /**
   * Resolve an abuse flag
   */
  async resolveAbuseFlag(
    userId: string,
    flagIndex: number,
    resolutionNotes: string,
    adminId: string
  ): Promise<AdminActionResult> {
    const userObjectId = new Types.ObjectId(userId);
    const adminObjectId = new Types.ObjectId(adminId);

    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      throw new ApiError(404, 'Customer metrics not found');
    }

    if (flagIndex < 0 || flagIndex >= metrics.flags.length) {
      throw new ApiError(400, 'Invalid flag index');
    }

    const oldFlag = metrics.flags[flagIndex];

    // Resolve the flag
    await metrics.resolveFlag(flagIndex, adminObjectId, resolutionNotes);

    // Log the action
    await createAuditLog({
      userId: adminId,
      action: 'ABUSE_FLAG_RESOLVED',
      resource: 'customer_metrics',
      resourceId: metrics._id.toString(),
      details: {
        customerId: userId,
        flagType: oldFlag.type,
        flagReason: oldFlag.reason,
        resolutionNotes,
        newTrustScore: metrics.trustScore,
        newTier: metrics.tier,
      },
      status: 'success',
    });

    logger.info('Abuse flag resolved', {
      customerId: userId,
      adminId,
      flagType: oldFlag.type,
    });

    return {
      success: true,
      message: `Flag '${oldFlag.type}' resolved successfully`,
      data: {
        trustScore: metrics.trustScore,
        tier: metrics.tier,
        abuseCount: metrics.abuseCount,
        riskLevel: metrics.riskLevel,
      },
    };
  }

  // ========================================
  // Customer Blocking/Unblocking
  // ========================================

  /**
   * Block a customer
   */
  async blockCustomer(
    userId: string,
    reason: string,
    adminId: string
  ): Promise<AdminActionResult> {
    const userObjectId = new Types.ObjectId(userId);
    const adminObjectId = new Types.ObjectId(adminId);

    const [metrics, user] = await Promise.all([
      CustomerMetrics.findOne({ userId: userObjectId }),
      User.findById(userObjectId),
    ]);

    if (!metrics) {
      throw new ApiError(404, 'Customer metrics not found');
    }

    if (!user) {
      throw new ApiError(404, 'Customer not found');
    }

    if (metrics.isBlocked) {
      throw new ApiError(400, 'Customer is already blocked');
    }

    // Block the customer
    await metrics.block(adminObjectId, reason);

    // Also update user account status
    user.accountStatus = 'suspended';
    await user.save();

    // Log the action
    await createAuditLog({
      userId: adminId,
      action: 'CUSTOMER_BLOCKED',
      resource: 'customer_metrics',
      resourceId: metrics._id.toString(),
      details: {
        customerId: userId,
        reason,
        trustScore: metrics.trustScore,
        abuseCount: metrics.abuseCount,
      },
      status: 'success',
    });

    logger.warn('Customer blocked', {
      customerId: userId,
      adminId,
      reason,
    });

    return {
      success: true,
      message: 'Customer blocked successfully',
      data: {
        userId: user._id.toString(),
        tier: metrics.tier,
        isBlocked: metrics.isBlocked,
      },
    };
  }

  /**
   * Unblock a customer
   */
  async unblockCustomer(userId: string, adminId: string): Promise<AdminActionResult> {
    const userObjectId = new Types.ObjectId(userId);

    const [metrics, user] = await Promise.all([
      CustomerMetrics.findOne({ userId: userObjectId }),
      User.findById(userObjectId),
    ]);

    if (!metrics) {
      throw new ApiError(404, 'Customer metrics not found');
    }

    if (!user) {
      throw new ApiError(404, 'Customer not found');
    }

    if (!metrics.isBlocked) {
      throw new ApiError(400, 'Customer is not blocked');
    }

    // Unblock the customer
    await metrics.unblock();

    // Also update user account status
    user.accountStatus = 'active';
    await user.save();

    // Log the action
    await createAuditLog({
      userId: adminId,
      action: 'CUSTOMER_UNBLOCKED',
      resource: 'customer_metrics',
      resourceId: metrics._id.toString(),
      details: {
        customerId: userId,
        previousTrustScore: metrics.trustScore,
        newTrustScore: metrics.trustScore,
      },
      status: 'success',
    });

    logger.info('Customer unblocked', {
      customerId: userId,
      adminId,
    });

    return {
      success: true,
      message: 'Customer unblocked successfully',
      data: {
        userId: user._id.toString(),
        tier: metrics.tier,
        trustScore: metrics.trustScore,
        isBlocked: metrics.isBlocked,
      },
    };
  }

  // ========================================
  // Tier Management
  // ========================================

  /**
   * Manually adjust customer tier
   */
  async adjustTier(
    userId: string,
    newTier: CustomerTier,
    reason: string,
    adminId: string
  ): Promise<AdminActionResult> {
    const userObjectId = new Types.ObjectId(userId);

    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      throw new ApiError(404, 'Customer metrics not found');
    }

    const oldTier = metrics.tier;

    if (oldTier === newTier) {
      throw new ApiError(400, 'Customer is already at this tier');
    }

    // Cannot manually set banned tier - use block instead
    if (newTier === 'banned') {
      throw new ApiError(400, 'Use blockCustomer to ban a customer');
    }

    // Update tier
    metrics.tier = newTier;

    // If upgrading to trusted, ensure trust score is high enough
    if (newTier === 'trusted' && metrics.trustScore < 70) {
      throw new ApiError(400, 'Customer trust score must be at least 70 for trusted tier');
    }

    // If setting to regular or new, clear any active flags if requested
    await metrics.save();

    // Log the action
    await createAuditLog({
      userId: adminId,
      action: 'TIER_ADJUSTED',
      resource: 'customer_metrics',
      resourceId: metrics._id.toString(),
      details: {
        customerId: userId,
        oldTier,
        newTier,
        reason,
        trustScore: metrics.trustScore,
      },
      status: 'success',
    });

    logger.info('Customer tier adjusted', {
      customerId: userId,
      adminId,
      oldTier,
      newTier,
      reason,
    });

    return {
      success: true,
      message: `Customer tier adjusted from '${oldTier}' to '${newTier}'`,
      data: {
        userId: userId,
        oldTier,
        newTier,
        trustScore: metrics.trustScore,
      },
    };
  }

  // ========================================
  // Abuse Detection Integration
  // ========================================

  /**
   * Run full abuse detection scan on a customer
   */
  async runAbuseScan(userId: string, adminId: string): Promise<{
    scanResult: Awaited<ReturnType<typeof abuseDetectionService.comprehensiveAbuseCheck>>;
    metrics: ICustomerMetrics;
  }> {
    const userObjectId = new Types.ObjectId(userId);

    // Run comprehensive abuse check
    const scanResult = await abuseDetectionService.comprehensiveAbuseCheck(userObjectId);

    // Get updated metrics
    const metrics = await CustomerMetrics.findOne({ userId: userObjectId });

    if (!metrics) {
      throw new ApiError(404, 'Customer metrics not found');
    }

    // Auto-flag if needed
    if (scanResult.shouldFlag) {
      const primaryAbuseType = this.determinePrimaryAbuseType(scanResult.checks);
      await metrics.addFlag(
        primaryAbuseType,
        `Automated scan detected: ${scanResult.recommendedActions.join('; ')}`
      );

      // Log the auto-flagging
      await createAuditLog({
        userId: adminId,
        action: 'AUTO_FLAG_FROM_SCAN',
        resource: 'customer_metrics',
        resourceId: metrics._id.toString(),
        details: {
          customerId: userId,
          scanResult: {
            overallRisk: scanResult.overallRisk,
            shouldFlag: scanResult.shouldFlag,
            recommendedActions: scanResult.recommendedActions,
          },
        },
        status: 'success',
      });
    }

    // Log the scan
    await createAuditLog({
      userId: adminId,
      action: 'ABUSE_SCAN_PERFORMED',
      resource: 'customer_metrics',
      resourceId: metrics._id.toString(),
      details: {
        customerId: userId,
        overallRisk: scanResult.overallRisk,
        shouldFlag: scanResult.shouldFlag,
      },
      status: 'success',
    });

    return { scanResult, metrics };
  }

  /**
   * Determine primary abuse type from scan results
   */
  private determinePrimaryAbuseType(checks: {
    refund: { isAbuse: boolean; confidence: number };
    loyalty: { isAbuse: boolean; confidence: number };
    coupon: { isAbuse: boolean; confidence: number };
    chargeback: { isAbuse: boolean; confidence: number };
    spam: { isAbuse: boolean; confidence: number };
  }): AbuseFlagType {
    const abuseTypes: Array<{ type: AbuseFlagType; confidence: number }> = [];

    if (checks.chargeback.isAbuse) {
      abuseTypes.push({ type: 'chargeback', confidence: checks.chargeback.confidence });
    }
    if (checks.refund.isAbuse) {
      abuseTypes.push({ type: 'high_refund_rate', confidence: checks.refund.confidence });
    }
    if (checks.coupon.isAbuse) {
      abuseTypes.push({ type: 'coupon_abuse', confidence: checks.coupon.confidence });
    }
    if (checks.loyalty.isAbuse) {
      abuseTypes.push({ type: 'fake_referral', confidence: checks.loyalty.confidence });
    }
    if (checks.spam.isAbuse) {
      abuseTypes.push({ type: 'spam', confidence: checks.spam.confidence });
    }

    // Return highest confidence abuse type
    abuseTypes.sort((a, b) => b.confidence - a.confidence);
    return abuseTypes[0]?.type || 'suspicious_activity';
  }

  // ========================================
  // Stats & Reporting
  // ========================================

  /**
   * Get customer ops dashboard statistics
   */
  async getDashboardStats(): Promise<{
    totalCustomers: number;
    tierDistribution: Record<CustomerTier, number>;
    riskDistribution: Record<string, number>;
    averageTrustScore: number;
    recentFlags: Array<{
      type: AbuseFlagType;
      reason: string;
      createdAt: Date;
      customerId: string;
      customerName: string;
    }>;
    topRiskCustomers: Array<{
      userId: string;
      name: string;
      trustScore: number;
      riskLevel: string;
      riskFactors: string[];
    }>;
    dailyFlagTrend: Array<{ date: string; count: number }>;
  }> {
    const stats = await CustomerMetrics.getStats();

    // Get recent flags
    const recentFlagsData = await CustomerMetrics.find({ 'flags.resolved': false })
      .sort({ 'flags.createdAt': -1 })
      .limit(10)
      .populate('userId', 'firstName lastName')
      .lean();

    const recentFlags = recentFlagsData
      .filter((m) => m.flags.length > 0)
      .flatMap((m) => {
        const user = m.userId as any;
        return m.flags
          .filter((f) => !f.resolved)
          .map((f) => ({
            type: f.type as AbuseFlagType,
            reason: f.reason,
            createdAt: f.createdAt,
            customerId: m.userId.toString(),
            customerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          }));
      })
      .slice(0, 10);

    // Get top risk customers
    const highRiskCustomers = await CustomerMetrics.getHighRiskCustomers(10);
    const topRiskCustomers = highRiskCustomers.map((c) => {
      const user = c.userId as any;
      return {
        userId: c.userId.toString(),
        name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        trustScore: c.trustScore,
        riskLevel: c.riskLevel,
        riskFactors: c.riskFactors,
      };
    });

    // Get daily flag trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyFlagTrendData = await CustomerMetrics.aggregate([
      { $unwind: '$flags' },
      { $match: { 'flags.createdAt': { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$flags.createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailyFlagTrend = dailyFlagTrendData.map((d) => ({
      date: d._id,
      count: d.count,
    }));

    return {
      totalCustomers: stats.totalCustomers,
      tierDistribution: stats.tierDistribution,
      riskDistribution: stats.riskDistribution,
      averageTrustScore: stats.averageTrustScore,
      recentFlags,
      topRiskCustomers,
      dailyFlagTrend,
    };
  }

  // ========================================
  // Metrics Sync
  // ========================================

  /**
   * Sync metrics for a customer from booking data
   */
  async syncMetricsFromBookings(userId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const metrics = await CustomerMetrics.getOrCreateForUser(userObjectId);

    // Get all bookings for this user
    const bookings = await Booking.find({ customerId: userObjectId }).lean();

    // Reset counters
    metrics.totalBookings = bookings.length;
    metrics.completedBookings = 0;
    metrics.cancelledBookings = 0;
    metrics.noShows = 0;
    metrics.refundCount = 0;
    metrics.refundAmount = 0;
    metrics.totalSpent = 0;

    // Calculate from bookings
    for (const booking of bookings) {
      if (booking.status === 'completed') {
        metrics.completedBookings += 1;
        metrics.totalSpent += booking.pricing?.totalAmount || 0;
      } else if (booking.status === 'cancelled') {
        metrics.cancelledBookings += 1;
        if (booking.cancellationDetails?.refundAmount) {
          metrics.refundCount += 1;
          metrics.refundAmount += booking.cancellationDetails.refundAmount;
        }
      } else if (booking.status === 'no_show') {
        metrics.noShows += 1;
      }
    }

    // Calculate rates
    metrics.cancellationRate = metrics.totalBookings > 0
      ? (metrics.cancelledBookings / metrics.totalBookings) * 100
      : 0;

    metrics.refundRate = metrics.completedBookings > 0
      ? (metrics.refundCount / metrics.completedBookings) * 100
      : 0;

    metrics.averageBookingValue = metrics.completedBookings > 0
      ? metrics.totalSpent / metrics.completedBookings
      : 0;

    // Recalculate trust score and tier
    metrics.trustScore = metrics.calculateTrustScore();
    metrics.tier = metrics.determineTier();
    const risk = metrics.assessRisk();
    metrics.riskLevel = risk.level;
    metrics.riskFactors = risk.factors;

    await metrics.save();

    logger.info('Customer metrics synced from bookings', {
      customerId: userId,
      totalBookings: metrics.totalBookings,
      trustScore: metrics.trustScore,
    });
  }

  /**
   * Get paginated bookings for a specific user
   */
  async getUserBookings(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    items: Array<{
      id: string;
      bookingNumber: string;
      scheduledDate: Date;
      scheduledTime: string;
      duration: number;
      status: string;
      service: {
        id: string;
        name: string;
        category?: string;
        image?: string;
      };
      provider: {
        id: string;
        firstName: string;
        lastName: string;
        avatar?: string;
        businessName?: string;
      };
      location: {
        type: string;
        address?: {
          street?: string;
          city?: string;
          state?: string;
        };
      };
      pricing: {
        basePrice: number;
        addOns: Array<{ name: string; price: number }>;
        discounts: Array<{ type: string; amount: number }>;
        couponDiscount: number;
        subtotal: number;
        tax: number;
        totalAmount: number;
        currency: string;
      };
      customerInfo: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
      };
      payment: {
        status: string;
        method?: string;
        paidAt?: Date;
      };
      statusHistory: Array<{
        status: string;
        timestamp: Date;
        reason?: string;
        updatedBy: string;
      }>;
      cancellationDetails?: {
        cancelledBy: string;
        reason: string;
        refundAmount: number;
        refundStatus: string;
      };
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
      nextPage: number | null;
      prevPage: number | null;
    };
  }> {
    const { page = 1, limit = 20, status, startDate, endDate } = options;
    const userObjectId = new Types.ObjectId(userId);
    const query: Record<string, unknown> = { customerId: userObjectId };

    // Status filter
    if (status && status !== 'all') {
      if (status === 'active') {
        query.status = { $in: ['pending', 'confirmed', 'in_progress'] };
      } else if (status === 'completed') {
        query.status = { $in: ['completed', 'refunded'] };
      } else {
        query.status = status;
      }
    }

    // Date range filter
    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) {
        (query.scheduledDate as Record<string, Date>).$gte = startDate;
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        (query.scheduledDate as Record<string, Date>).$lte = endDateObj;
      }
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort({ scheduledDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('service', 'name category image')
        .populate('provider', 'firstName lastName avatar')
        .populate('provider.providerProfile', 'businessInfo')
        .lean(),
      Booking.countDocuments(query),
    ]);

    const pages = Math.ceil(total / limit);

    const items = bookings.map((booking) => {
      const provider = booking.provider as any;
      const providerProfile = provider?.providerProfile as any;

      return {
        id: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        duration: booking.duration,
        status: booking.status,
        service: {
          id: (booking.service as any)?._id?.toString() || '',
          name: (booking.service as any)?.name || 'Unknown Service',
          category: (booking.service as any)?.category,
          image: (booking.service as any)?.image,
        },
        provider: {
          id: provider?._id?.toString() || '',
          firstName: provider?.firstName || '',
          lastName: provider?.lastName || '',
          avatar: provider?.avatar,
          businessName: providerProfile?.businessInfo?.businessName,
        },
        location: booking.location,
        pricing: booking.pricing,
        customerInfo: booking.customerInfo,
        payment: booking.payment,
        statusHistory: booking.statusHistory.map((h) => ({
          status: h.status,
          timestamp: h.timestamp,
          reason: h.reason,
          updatedBy: h.updatedBy,
        })),
        cancellationDetails: booking.cancellationDetails ? {
          cancelledBy: booking.cancellationDetails.cancelledBy,
          reason: booking.cancellationDetails.reason,
          refundAmount: booking.cancellationDetails.refundAmount,
          refundStatus: booking.cancellationDetails.refundStatus,
        } : undefined,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
        nextPage: page < pages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }

  /**
   * Create or update metrics for all customers
   */
  async initializeMetricsForAllCustomers(): Promise<{ created: number; updated: number }> {
    const customers = await User.find({ role: 'customer' }).distinct('_id');
    let created = 0;
    let updated = 0;

    for (const customerId of customers) {
      const existing = await CustomerMetrics.findOne({ userId: customerId });
      if (!existing) {
        await CustomerMetrics.create({ userId: customerId });
        created += 1;
      } else {
        // Update metrics for existing customers
        await this.syncMetricsFromBookings(customerId.toString());
        updated += 1;
      }
    }

    logger.info('Metrics initialized for all customers', { created, updated });

    return { created, updated };
  }
}

// Export singleton instance
export const customerOpsService = new CustomerOpsService();
export default customerOpsService;
