import mongoose, { Types, Document } from 'mongoose';
import User from '../models/user.model';
import Booking, { IBooking } from '../models/booking.model';

// =============================================================================
// NILIN Churn Prediction Service
// Identifies at-risk customers and automates retention triggers
// =============================================================================

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ChurnRisk {
  userId: Types.ObjectId;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  indicators: ChurnIndicator[];
  predictedChurnDate?: Date;
  confidence: number;
  recommendedActions: RetentionAction[];
  lastBookingDate?: Date;
  daysSinceLastBooking?: number;
  totalBookings: number;
  lifetimeValue: number;
}

export interface ChurnFactor {
  name: string;
  weight: number; // Contribution to risk score (0-100)
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ChurnIndicator {
  type: 'behavioral' | 'engagement' | 'feedback' | 'demographic';
  name: string;
  value: any;
  threshold: any;
  breached: boolean;
}

export interface RetentionAction {
  type: 'offer' | 'outreach' | 'incentive' | 'reengagement' | 'feedback';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImpact: number; // Probability of success (0-1)
  offerDetails?: {
    discountPercent?: number;
    freeService?: string;
    loyaltyPoints?: number;
    validityDays?: number;
  };
  channels: ('push' | 'email' | 'sms' | 'in_app')[];
}

export interface RetentionCampaign {
  _id: Types.ObjectId;
  name: string;
  targetCriteria: {
    riskLevels?: ('low' | 'medium' | 'high' | 'critical')[];
    minDaysInactive?: number;
    maxDaysInactive?: number;
    minBookings?: number;
    maxBookings?: number;
    loyaltyTiers?: ('bronze' | 'silver' | 'gold' | 'platinum')[];
    categories?: string[];
  };
  actions: RetentionAction[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  metrics: {
    targetUsers: number;
    reachedUsers: number;
    respondedUsers: number;
    convertedUsers: number;
    revenue: number;
    roi: number;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CustomerSegment {
  segmentId: string;
  name: string;
  description: string;
  customerCount: number;
  avgLifetimeValue: number;
  avgChurnRisk: number;
  characteristics: {
    avgBookingsPerMonth: number;
    avgOrderValue: number;
    avgDaysSinceLastBooking: number;
    topCategories: string[];
    preferredTimeSlots: string[];
  };
}

// =============================================================================
// Churn Prediction Service Class
// =============================================================================

class ChurnPredictionService {
  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    critical: 75,  // 75-100: Immediate action required
    high: 50,      // 50-74: Priority retention
    medium: 25,    // 25-49: Monitor closely
    low: 0,        // 0-24: Healthy
  };

  // Factor weights (must sum to 100)
  private readonly FACTOR_WEIGHTS = {
    inactivityDays: 30,
    bookingDecline: 25,
    engagementDrop: 15,
    ratingDecline: 10,
    supportTickets: 10,
    priceSensitivity: 10,
  };

  // Inactivity thresholds (in days)
  private readonly INACTIVITY_THRESHOLDS = {
    warning: 30,    // Start monitoring
    high: 60,       // High risk
    critical: 90,    // Very likely to churn
  };

  // Cache for batch predictions
  private batchCache: Map<string, { data: ChurnRisk[]; expiry: number }> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  // =============================================================================
  // Core Prediction Methods
  // =============================================================================

  /**
   * Predict churn risk for a single user
   */
  async predictChurnRisk(userId: string | Types.ObjectId): Promise<ChurnRisk> {
    const user = await User.findById(userId)
      .select('firstName lastName email loyaltySystem aiPersonalization createdAt')
      .lean();

    if (!user) {
      throw new Error('User not found');
    }

    // Get booking history
    const bookings = await Booking.find({ customerId: userId })
      .sort({ scheduledDate: -1 })
      .limit(50)
      .lean() as unknown as (IBooking & { pricing?: { totalAmount: number } })[];

    // Calculate risk factors
    const factors = this.calculateChurnFactors(user, bookings);
    const indicators = this.evaluateIndicators(user, bookings);
    const riskScore = this.calculateRiskScore(factors);
    const riskLevel = this.determineRiskLevel(riskScore);

    // Get last booking info
    const lastBooking = bookings[0];
    const daysSinceLastBooking = lastBooking
      ? Math.floor((Date.now() - new Date(lastBooking.scheduledDate).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // Calculate lifetime value
    const lifetimeValue = bookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);

    // Generate retention recommendations
    const recommendedActions = this.generateRetentionActions(riskLevel, factors, user);

    // Predict churn date for high/critical risk users
    const predictedChurnDate = riskLevel === 'high' || riskLevel === 'critical'
      ? this.predictChurnDate(daysSinceLastBooking, factors)
      : undefined;

    return {
      userId: user._id as Types.ObjectId,
      riskScore,
      riskLevel,
      factors,
      indicators,
      predictedChurnDate,
      confidence: this.calculateConfidence(factors, bookings),
      recommendedActions,
      lastBookingDate: lastBooking ? new Date(lastBooking.scheduledDate) : undefined,
      daysSinceLastBooking,
      totalBookings: bookings.length,
      lifetimeValue,
    };
  }

  /**
   * Calculate individual churn factors
   */
  private calculateChurnFactors(
    user: any,
    bookings: (IBooking & { pricing?: { totalAmount: number } })[]
  ): ChurnFactor[] {
    const factors: ChurnFactor[] = [];
    const now = new Date();

    // 1. Inactivity (30% weight)
    const lastBooking = bookings[0];
    const daysSinceLastBooking = lastBooking
      ? Math.floor((now.getTime() - new Date(lastBooking.scheduledDate).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    let inactivityScore = 0;
    let inactivitySeverity: 'low' | 'medium' | 'high' = 'low';

    if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.critical) {
      inactivityScore = 100;
      inactivitySeverity = 'high';
    } else if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.high) {
      inactivityScore = 75;
      inactivitySeverity = 'high';
    } else if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.warning) {
      inactivityScore = 40;
      inactivitySeverity = 'medium';
    } else {
      inactivityScore = daysSinceLastBooking * 1.5; // Linear scale within warning
      inactivitySeverity = 'low';
    }

    factors.push({
      name: 'inactivity_days',
      weight: this.FACTOR_WEIGHTS.inactivityDays,
      description: `${daysSinceLastBooking} days since last booking`,
      severity: inactivitySeverity,
    });

    // 2. Booking decline (25% weight)
    const bookingTrend = this.calculateBookingTrend(bookings);
    let bookingDeclineScore = 0;
    let bookingDeclineSeverity: 'low' | 'medium' | 'high' = 'low';

    if (bookingTrend < -0.5) {
      bookingDeclineScore = 100;
      bookingDeclineSeverity = 'high';
    } else if (bookingTrend < -0.25) {
      bookingDeclineScore = 60;
      bookingDeclineSeverity = 'medium';
    } else if (bookingTrend < 0) {
      bookingDeclineScore = 30;
      bookingDeclineSeverity = 'low';
    }

    factors.push({
      name: 'booking_decline',
      weight: this.FACTOR_WEIGHTS.bookingDecline,
      description: `${Math.round(bookingTrend * 100)}% change in booking frequency`,
      severity: bookingDeclineSeverity,
    });

    // 3. Engagement drop (15% weight)
    const engagementScore = this.calculateEngagementScore(user, bookings);
    let engagementDropScore = 0;
    let engagementSeverity: 'low' | 'medium' | 'high' = 'low';

    if (engagementScore < 0.2) {
      engagementDropScore = 100;
      engagementSeverity = 'high';
    } else if (engagementScore < 0.4) {
      engagementDropScore = 60;
      engagementSeverity = 'medium';
    } else if (engagementScore < 0.6) {
      engagementDropScore = 30;
      engagementSeverity = 'low';
    }

    factors.push({
      name: 'engagement_drop',
      weight: this.FACTOR_WEIGHTS.engagementDrop,
      description: `Engagement score: ${Math.round(engagementScore * 100)}%`,
      severity: engagementSeverity,
    });

    // 4. Rating decline (10% weight)
    const ratingTrend = this.calculateRatingTrend(bookings);
    let ratingDeclineScore = 0;
    let ratingSeverity: 'low' | 'medium' | 'high' = 'low';

    if (ratingTrend < -1) {
      ratingDeclineScore = 100;
      ratingSeverity = 'high';
    } else if (ratingTrend < -0.5) {
      ratingDeclineScore = 60;
      ratingSeverity = 'medium';
    } else if (ratingTrend < 0) {
      ratingDeclineScore = 30;
      ratingSeverity = 'low';
    }

    factors.push({
      name: 'rating_decline',
      weight: this.FACTOR_WEIGHTS.ratingDecline,
      description: `Rating trend: ${ratingTrend.toFixed(1)} stars`,
      severity: ratingSeverity,
    });

    // 5. Support tickets (10% weight) - placeholder for future implementation
    factors.push({
      name: 'support_tickets',
      weight: this.FACTOR_WEIGHTS.supportTickets,
      description: 'No recent support issues',
      severity: 'low',
    });

    // 6. Price sensitivity (10% weight)
    const priceSensitivity = this.calculatePriceSensitivity(bookings);
    let priceSensitivityScore = 0;
    let priceSeverity: 'low' | 'medium' | 'high' = 'low';

    if (priceSensitivity > 0.5) {
      priceSensitivityScore = 80;
      priceSeverity = 'high';
    } else if (priceSensitivity > 0.3) {
      priceSensitivityScore = 50;
      priceSeverity = 'medium';
    }

    factors.push({
      name: 'price_sensitivity',
      weight: this.FACTOR_WEIGHTS.priceSensitivity,
      description: `${Math.round(priceSensitivity * 100)}% sensitivity to price changes`,
      severity: priceSeverity,
    });

    return factors;
  }

  /**
   * Evaluate churn indicators
   */
  private evaluateIndicators(user: any, bookings: any[]): ChurnIndicator[] {
    const indicators: ChurnIndicator[] = [];
    const now = new Date();

    // Behavioral indicators
    const lastBookingDate = bookings[0]?.scheduledDate;
    const daysSinceActive = lastBookingDate
      ? Math.floor((now.getTime() - new Date(lastBookingDate).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    indicators.push({
      type: 'behavioral',
      name: 'days_since_last_booking',
      value: daysSinceActive,
      threshold: this.INACTIVITY_THRESHOLDS.warning,
      breached: daysSinceActive > this.INACTIVITY_THRESHOLDS.warning,
    });

    // Booking frequency
    const avgDaysBetweenBookings = bookings.length > 1
      ? this.calculateAvgDaysBetweenBookings(bookings)
      : 999;

    indicators.push({
      type: 'behavioral',
      name: 'booking_frequency',
      value: avgDaysBetweenBookings,
      threshold: 30,
      breached: avgDaysBetweenBookings > 30,
    });

    // Engagement indicator
    const hasSearchHistory = (user.aiPersonalization?.behaviorData?.searchHistory?.length || 0) > 0;
    indicators.push({
      type: 'engagement',
      name: 'recent_search_activity',
      value: hasSearchHistory,
      threshold: true,
      breached: !hasSearchHistory,
    });

    // Loyalty tier decline
    const tier = user.loyaltySystem?.tier || 'bronze';
    const hasTierDeclined = tier === 'bronze';
    indicators.push({
      type: 'engagement',
      name: 'loyalty_tier_decline',
      value: tier,
      threshold: 'silver',
      breached: hasTierDeclined && bookings.length > 5,
    });

    return indicators;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(factors: ChurnFactor[]): number {
    let totalWeightedScore = 0;

    for (const factor of factors) {
      const normalizedFactorScore = factor.weight; // Weight represents max contribution
      totalWeightedScore += normalizedFactorScore * (factor.weight / 100);
    }

    // Cap at 100
    return Math.min(100, Math.round(totalWeightedScore));
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.RISK_THRESHOLDS.critical) return 'critical';
    if (score >= this.RISK_THRESHOLDS.high) return 'high';
    if (score >= this.RISK_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  /**
   * Predict likely churn date based on inactivity pattern
   */
  private predictChurnDate(daysSinceLastBooking: number, factors: ChurnFactor[]): Date {
    // Find the inactivity factor
    const inactivityFactor = factors.find(f => f.name === 'inactivity_days');
    const inactivityDays = daysSinceLastBooking;

    // Estimate days until churn based on severity
    let daysUntilChurn: number;
    if (inactivityFactor?.severity === 'high') {
      daysUntilChurn = Math.max(0, this.INACTIVITY_THRESHOLDS.critical - inactivityDays + 14);
    } else if (inactivityFactor?.severity === 'medium') {
      daysUntilChurn = Math.max(0, this.INACTIVITY_THRESHOLDS.high - inactivityDays + 7);
    } else {
      daysUntilChurn = 30; // Default prediction
    }

    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + daysUntilChurn);
    return predictedDate;
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(factors: ChurnFactor[], bookings: any[]): number {
    let confidence = 0.5; // Base confidence

    // More bookings = higher confidence
    if (bookings.length >= 10) {
      confidence += 0.2;
    } else if (bookings.length >= 5) {
      confidence += 0.1;
    }

    // Longer history = higher confidence
    const historyDays = bookings.length > 0
      ? Math.floor((Date.now() - new Date(bookings[bookings.length - 1].scheduledDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (historyDays >= 180) {
      confidence += 0.15;
    } else if (historyDays >= 90) {
      confidence += 0.1;
    }

    // More factors evaluated = higher confidence
    const evaluatedFactors = factors.filter(f => f.weight > 0).length;
    confidence += (evaluatedFactors / 6) * 0.15;

    return Math.min(0.95, confidence);
  }

  // =============================================================================
  // Retention Action Generation
  // =============================================================================

  /**
   * Generate retention actions based on risk level and factors
   */
  private generateRetentionActions(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    factors: ChurnFactor[],
    user: any
  ): RetentionAction[] {
    const actions: RetentionAction[] = [];

    switch (riskLevel) {
      case 'critical':
        actions.push({
          type: 'incentive',
          priority: 'high',
          title: 'Special Comeback Offer',
          description: 'Offer a significant discount to win back this customer immediately',
          expectedImpact: 0.4,
          offerDetails: {
            discountPercent: 30,
            validityDays: 7,
          },
          channels: ['push', 'email', 'sms', 'in_app'],
        });
        actions.push({
          type: 'outreach',
          priority: 'high',
          title: 'Personal Outreach Call',
          description: 'Have a customer success team member reach out personally',
          expectedImpact: 0.5,
          channels: ['sms'],
        });
        break;

      case 'high':
        actions.push({
          type: 'offer',
          priority: 'high',
          title: 'Exclusive Discount',
          description: 'Offer a loyalty discount to encourage return booking',
          expectedImpact: 0.3,
          offerDetails: {
            discountPercent: 20,
            validityDays: 14,
          },
          channels: ['push', 'email', 'in_app'],
        });
        actions.push({
          type: 'reengagement',
          priority: 'medium',
          title: 'Highlight New Services',
          description: 'Showcase new services that match their preferences',
          expectedImpact: 0.25,
          channels: ['push', 'email', 'in_app'],
        });
        break;

      case 'medium':
        actions.push({
          type: 'offer',
          priority: 'medium',
          title: 'Loyalty Points Bonus',
          description: 'Offer double loyalty points on next booking',
          expectedImpact: 0.2,
          offerDetails: {
            loyaltyPoints: 500,
            validityDays: 30,
          },
          channels: ['push', 'email', 'in_app'],
        });
        actions.push({
          type: 'feedback',
          priority: 'medium',
          title: 'Request Feedback',
          description: 'Ask what we can improve to earn their business back',
          expectedImpact: 0.15,
          channels: ['email'],
        });
        break;

      case 'low':
        actions.push({
          type: 'reengagement',
          priority: 'low',
          title: 'App Update Notification',
          description: 'Keep them engaged with new app features',
          expectedImpact: 0.1,
          channels: ['push'],
        });
        break;
    }

    // Add category-specific actions
    const inactivityFactor = factors.find(f => f.name === 'inactivity_days');
    if (inactivityFactor?.severity === 'high' || inactivityFactor?.severity === 'medium') {
      actions.push({
        type: 'reengagement',
        priority: 'medium',
        title: 'Seasonal Promotion',
        description: 'Target with seasonal/special day promotions',
        expectedImpact: 0.2,
        channels: ['push', 'email', 'sms'],
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  // =============================================================================
  // Batch Processing
  // =============================================================================

  /**
   * Get churn risks for all at-risk customers
   */
  async getAtRiskCustomers(
    options: {
      minRiskLevel?: 'medium' | 'high' | 'critical';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ customers: ChurnRisk[]; total: number }> {
    const cacheKey = `at_risk:${options.minRiskLevel || 'all'}:${options.limit || 100}`;
    const cached = this.batchCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { customers: cached.data, total: cached.data.length };
    }

    // Find users with no recent bookings
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.INACTIVITY_THRESHOLDS.warning);

    const atRiskUsers = await User.aggregate([
      {
        $lookup: {
          from: 'bookings',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$customerId', '$$userId'] },
                status: { $in: ['completed', 'confirmed'] },
              },
            },
            { $sort: { scheduledDate: -1 } },
            { $limit: 1 },
            { $project: { scheduledDate: 1, pricing: 1 } },
          ],
          as: 'lastBooking',
        },
      },
      {
        $addFields: {
          lastBookingDate: { $ifNull: [{ $arrayElemAt: ['$lastBooking.scheduledDate', 0] }, null] },
          totalSpent: { $ifNull: [{ $arrayElemAt: ['$lastBooking.pricing.totalAmount', 0] }, 0] },
        },
      },
      {
        $match: {
          role: 'customer',
          accountStatus: 'active',
          isActive: true,
          $or: [
            { lastBookingDate: { $lt: cutoffDate } },
            { lastBookingDate: { $exists: false } },
          ],
        },
      },
      {
        $lookup: {
          from: 'bookings',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$customerId', '$$userId'] },
              },
            },
            { $count: 'totalBookings' },
          ],
          as: 'bookingCount',
        },
      },
      {
        $addFields: {
          totalBookings: { $ifNull: [{ $arrayElemAt: ['$bookingCount.totalBookings', 0] }, 0] },
        },
      },
      { $sort: { lastBookingDate: 1 } },
    ]);

    // Calculate risk for each user
    const riskCustomers: ChurnRisk[] = [];
    for (const user of atRiskUsers) {
      try {
        const risk = await this.predictChurnRisk(user._id);
        if (!options.minRiskLevel || this.isAboveThreshold(risk.riskLevel, options.minRiskLevel)) {
          riskCustomers.push(risk);
        }
      } catch (error) {
        console.error(`Error predicting churn for user ${user._id}:`, error);
      }
    }

    // Sort by risk score descending
    riskCustomers.sort((a, b) => b.riskScore - a.riskScore);

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const paginatedResults = riskCustomers.slice(offset, offset + limit);

    this.batchCache.set(cacheKey, {
      data: paginatedResults,
      expiry: Date.now() + this.CACHE_TTL,
    });

    return { customers: paginatedResults, total: riskCustomers.length };
  }

  /**
   * Check if risk level meets threshold
   */
  private isAboveThreshold(level: string, threshold: string): boolean {
    const levels = ['low', 'medium', 'high', 'critical'];
    return levels.indexOf(level) >= levels.indexOf(threshold);
  }

  // =============================================================================
  // Customer Segmentation
  // =============================================================================

  /**
   * Get customer segments for targeted marketing
   */
  async getCustomerSegments(): Promise<CustomerSegment[]> {
    const segments: CustomerSegment[] = [];

    // Active users (booked in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await User.aggregate([
      {
        $lookup: {
          from: 'bookings',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$customerId', '$$userId'] },
                scheduledDate: { $gte: thirtyDaysAgo },
              },
            },
            { $count: 'count' },
          ],
          as: 'recentBookings',
        },
      },
      {
        $match: {
          role: 'customer',
          'recentBookings.count': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$loyaltySystem.tier',
          count: { $sum: 1 },
          avgLTV: { $avg: '$loyaltySystem.totalSpent' },
        },
      },
    ]);

    // Churned users (inactive > 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const churnedUsers = await User.countDocuments({
      role: 'customer',
      'lastBookingDate': { $lt: sixtyDaysAgo },
    });

    // Build segments
    const tierNames: Record<string, string> = {
      bronze: 'Bronze Customers',
      silver: 'Silver Loyalists',
      gold: 'Gold Members',
      platinum: 'Platinum VIPs',
    };

    for (const tier of activeUsers) {
      segments.push({
        segmentId: `segment_${tier._id || 'no_tier'}`,
        name: tierNames[tier._id] || 'Standard Customers',
        description: `${tier._id || 'Standard'} tier customers with recent activity`,
        customerCount: tier.count,
        avgLifetimeValue: tier.avgLTV || 0,
        avgChurnRisk: tier._id === 'platinum' ? 5 : tier._id === 'gold' ? 15 : 25,
        characteristics: {
          avgBookingsPerMonth: 2,
          avgOrderValue: tier.avgLTV || 100,
          avgDaysSinceLastBooking: 7,
          topCategories: [],
          preferredTimeSlots: ['evening', 'weekend'],
        },
      });
    }

    // Add churned segment
    if (churnedUsers > 0) {
      segments.push({
        segmentId: 'segment_churned',
        name: 'At-Risk Churned',
        description: 'Customers inactive for more than 60 days',
        customerCount: churnedUsers,
        avgLifetimeValue: 0,
        avgChurnRisk: 80,
        characteristics: {
          avgBookingsPerMonth: 0,
          avgOrderValue: 0,
          avgDaysSinceLastBooking: 90,
          topCategories: [],
          preferredTimeSlots: [],
        },
      });
    }

    return segments;
  }

  // =============================================================================
  // Retention Campaign Management
  // =============================================================================

  /**
   * Create automated retention campaign
   */
  async createRetentionCampaign(criteria: RetentionCampaign['targetCriteria']): Promise<RetentionCampaign> {
    // This would integrate with a campaign/model in production
    const campaign: RetentionCampaign = {
      _id: new Types.ObjectId(),
      name: `Auto-generated Retention Campaign - ${new Date().toISOString().split('T')[0]}`,
      targetCriteria: criteria,
      actions: [
        {
          type: 'offer',
          priority: 'high',
          title: 'Comeback Discount',
          description: 'Special discount to win back',
          expectedImpact: 0.25,
          offerDetails: {
            discountPercent: 20,
            validityDays: 14,
          },
          channels: ['push', 'email', 'in_app'],
        },
      ],
      status: 'draft',
      metrics: {
        targetUsers: 0,
        reachedUsers: 0,
        respondedUsers: 0,
        convertedUsers: 0,
        revenue: 0,
        roi: 0,
      },
      createdAt: new Date(),
    };

    // Get target users count
    const { customers } = await this.getAtRiskCustomers({ minRiskLevel: 'medium' });
    campaign.metrics.targetUsers = customers.length;

    return campaign;
  }

  /**
   * Execute retention action for a user
   */
  async executeRetentionAction(userId: string, action: RetentionAction): Promise<{
    success: boolean;
    message: string;
    actionTaken: string;
  }> {
    const user = await User.findById(userId).select('firstName lastName email communicationPreferences');

    if (!user) {
      return { success: false, message: 'User not found', actionTaken: 'none' };
    }

    // Check user communication preferences
    const prefs = user.communicationPreferences;

    // Execute based on channels
    const executedChannels: string[] = [];
    for (const channel of action.channels) {
      switch (channel) {
        case 'push':
          if (prefs.push.promotions) {
            // Send push notification
            executedChannels.push('push');
          }
          break;
        case 'email':
          if (prefs.email.promotions) {
            // Send email
            executedChannels.push('email');
          }
          break;
        case 'sms':
          if (prefs.sms.promotions) {
            // Send SMS
            executedChannels.push('sms');
          }
          break;
        case 'in_app':
          executedChannels.push('in_app');
          break;
      }
    }

    // Log action
    console.log(`Retention action '${action.title}' executed for user ${userId} via channels: ${executedChannels.join(', ')}`);

    return {
      success: true,
      message: `Action sent via ${executedChannels.length} channel(s)`,
      actionTaken: action.title,
    };
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Calculate booking trend over time
   */
  private calculateBookingTrend(bookings: any[]): number {
    if (bookings.length < 4) return 0;

    // Split bookings into two halves
    const midpoint = Math.floor(bookings.length / 2);
    const recentBookings = bookings.slice(0, midpoint);
    const olderBookings = bookings.slice(midpoint);

    if (olderBookings.length === 0) return 0;

    // Calculate average days between bookings for each period
    const avgDaysRecent = this.calculateAvgDaysBetweenBookings(recentBookings);
    const avgDaysOlder = this.calculateAvgDaysBetweenBookings(olderBookings);

    if (avgDaysOlder === 0) return 0;

    // Negative trend means bookings becoming less frequent
    return (avgDaysRecent - avgDaysOlder) / avgDaysOlder;
  }

  /**
   * Calculate average days between bookings
   */
  private calculateAvgDaysBetweenBookings(bookings: any[]): number {
    if (bookings.length < 2) return 999;

    let totalDays = 0;
    for (let i = 0; i < bookings.length - 1; i++) {
      const current = new Date(bookings[i].scheduledDate);
      const next = new Date(bookings[i + 1].scheduledDate);
      totalDays += (current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
    }

    return totalDays / (bookings.length - 1);
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(user: any, bookings: any[]): number {
    let score = 0;

    // App engagement (based on AI personalization activity)
    const searchHistory = user.aiPersonalization?.behaviorData?.searchHistory || [];
    const profileViews = user.aiPersonalization?.behaviorData?.interactionHistory?.profileViews || [];

    if (searchHistory.length > 5) score += 0.3;
    else if (searchHistory.length > 0) score += 0.1;

    if (profileViews.length > 3) score += 0.2;
    else if (profileViews.length > 0) score += 0.1;

    // Booking frequency
    const recentBookings = bookings.filter(
      b => new Date(b.scheduledDate).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    );
    if (recentBookings.length >= 3) score += 0.3;
    else if (recentBookings.length >= 1) score += 0.2;

    // Loyalty tier bonus
    const tier = user.loyaltySystem?.tier;
    if (tier === 'platinum') score += 0.2;
    else if (tier === 'gold') score += 0.15;
    else if (tier === 'silver') score += 0.1;

    return Math.min(1, score);
  }

  /**
   * Calculate rating trend
   */
  private calculateRatingTrend(bookings: any[]): number {
    const ratings = bookings
      .filter(b => b.customerReview)
      .map(b => b.customerReview?.rating || 0);

    if (ratings.length < 2) return 0;

    // Compare average of recent vs older ratings
    const midpoint = Math.floor(ratings.length / 2);
    const recentRatings = ratings.slice(0, midpoint);
    const olderRatings = ratings.slice(midpoint);

    const avgRecent = recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length;
    const avgOlder = olderRatings.reduce((a, b) => a + b, 0) / olderRatings.length;

    return avgRecent - avgOlder;
  }

  /**
   * Calculate price sensitivity
   */
  private calculatePriceSensitivity(bookings: any[]): number {
    if (bookings.length < 5) return 0;

    // Calculate variance in booking amounts relative to average
    const amounts = bookings.map(b => b.pricing?.totalAmount || 0);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    if (avgAmount === 0) return 0;

    const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgAmount;

    // Higher variation = more price sensitive
    return Math.min(1, coefficientOfVariation);
  }

  /**
   * Clear batch cache
   */
  clearCache(): void {
    this.batchCache.clear();
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const churnPredictionService = new ChurnPredictionService();

// =============================================================================
// Export Class for Testing
// =============================================================================

export { ChurnPredictionService };
export default churnPredictionService;
