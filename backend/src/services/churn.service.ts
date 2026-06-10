import { Types } from 'mongoose';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// =============================================================================
// Churn Report Service
// Provides comprehensive churn analytics for admin dashboard
// =============================================================================

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ChurnRiskReport {
  userId: string;
  userName: string;
  email: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  lastBookingDate?: Date;
  daysSinceLastBooking: number;
  totalBookings: number;
  lifetimeValue: number;
  recommendedAction: string;
}

export interface ChurnFilters {
  minRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  minDaysInactive?: number;
  maxDaysInactive?: number;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  limit?: number;
  offset?: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ChurnStats {
  totalCustomers: number;
  activeCustomers: number;
  atRiskCustomers: number;
  churnRate: number;
  byRiskLevel: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  averageRiskScore: number;
  totalLifetimeValueAtRisk: number;
  churnTrend: Array<{
    date: string;
    churnRate: number;
    atRiskCount: number;
  }>;
  topRiskFactors: Array<{
    factor: string;
    count: number;
    percentage: number;
  }>;
}

export interface AtRiskCustomer {
  customerId: string;
  customerName: string;
  email: string;
  phone?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  daysSinceLastBooking: number;
  totalBookings: number;
  totalSpent: number;
  lastBookingDate?: Date;
  predictedChurnDate?: Date;
  recommendedActions: string[];
}

// =============================================================================
// Churn Service Class
// =============================================================================

class ChurnService {
  private readonly CACHE_PREFIX = 'churn:';
  private readonly CACHE_TTL = 300; // 5 minutes

  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    critical: 75,
    high: 50,
    medium: 25,
    low: 0,
  };

  // Inactivity thresholds (days)
  private readonly INACTIVITY_THRESHOLDS = {
    warning: 30,
    high: 60,
    critical: 90,
  };

  // Factor weights
  private readonly FACTOR_WEIGHTS = {
    inactivityDays: 30,
    bookingDecline: 25,
    engagementDrop: 15,
    ratingDecline: 10,
    supportTickets: 10,
    priceSensitivity: 10,
  };

  // =============================================================================
  // Calculate Churn Risk for Customer
  // =============================================================================

  /**
   * Calculate churn risk for a specific customer
   */
  async calculateChurnRisk(customerId: string): Promise<ChurnRiskReport> {
    const cacheKey = `${this.CACHE_PREFIX}risk:${customerId}`;

    // Try cache first
    const cached = await this.getCached<ChurnRiskReport>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch customer
    const user = await User.findById(customerId)
      .select('firstName lastName email phone createdAt')
      .lean();

    if (!user) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    // Fetch booking history
    const bookings = await Booking.find({ customerId: user._id })
      .sort({ scheduledDate: -1 })
      .limit(50)
      .lean();

    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(user, bookings);
    const riskLevel = this.determineRiskLevel(riskMetrics.score);
    const riskFactors = this.identifyRiskFactors(user, bookings);

    const result: ChurnRiskReport = {
      userId: user._id.toString(),
      userName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      riskScore: riskMetrics.score,
      riskLevel,
      riskFactors,
      lastBookingDate: bookings[0]?.scheduledDate,
      daysSinceLastBooking: riskMetrics.daysSinceLastBooking,
      totalBookings: bookings.length,
      lifetimeValue: riskMetrics.lifetimeValue,
      recommendedAction: this.getRecommendedAction(riskLevel),
    };

    // Cache result
    await this.setCached(cacheKey, result);

    return result;
  }

  /**
   * Calculate risk metrics for a customer
   */
  private calculateRiskMetrics(user: any, bookings: any[]): {
    score: number;
    daysSinceLastBooking: number;
    lifetimeValue: number;
  } {
    const now = new Date();
    const lastBooking = bookings[0];
    const daysSinceLastBooking = lastBooking
      ? Math.floor((now.getTime() - new Date(lastBooking.scheduledDate).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // Calculate lifetime value
    const lifetimeValue = bookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);

    // Calculate risk score components
    let score = 0;

    // Inactivity factor (30%)
    if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.critical) {
      score += this.FACTOR_WEIGHTS.inactivityDays;
    } else if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.high) {
      score += this.FACTOR_WEIGHTS.inactivityDays * 0.75;
    } else if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.warning) {
      score += this.FACTOR_WEIGHTS.inactivityDays * 0.4;
    }

    // Booking decline factor (25%)
    const bookingTrend = this.calculateBookingTrend(bookings);
    if (bookingTrend < -0.5) {
      score += this.FACTOR_WEIGHTS.bookingDecline;
    } else if (bookingTrend < -0.25) {
      score += this.FACTOR_WEIGHTS.bookingDecline * 0.6;
    } else if (bookingTrend < 0) {
      score += this.FACTOR_WEIGHTS.bookingDecline * 0.3;
    }

    // Engagement drop (15%) - simplified
    const engagementScore = this.calculateEngagementScore(bookings);
    if (engagementScore < 0.2) {
      score += this.FACTOR_WEIGHTS.engagementDrop;
    } else if (engagementScore < 0.4) {
      score += this.FACTOR_WEIGHTS.engagementDrop * 0.6;
    }

    // Low booking count (10%)
    if (bookings.length === 0) {
      score += this.FACTOR_WEIGHTS.supportTickets;
    } else if (bookings.length < 3) {
      score += this.FACTOR_WEIGHTS.supportTickets * 0.5;
    }

    return {
      score: Math.min(100, Math.round(score)),
      daysSinceLastBooking,
      lifetimeValue,
    };
  }

  /**
   * Calculate booking trend
   */
  private calculateBookingTrend(bookings: any[]): number {
    if (bookings.length < 4) return 0;

    const midpoint = Math.floor(bookings.length / 2);
    const recentBookings = bookings.slice(0, midpoint);
    const olderBookings = bookings.slice(midpoint);

    if (olderBookings.length === 0) return 0;

    const avgDaysRecent = this.calculateAvgDaysBetweenBookings(recentBookings);
    const avgDaysOlder = this.calculateAvgDaysBetweenBookings(olderBookings);

    if (avgDaysOlder === 0) return 0;

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
  private calculateEngagementScore(bookings: any[]): number {
    let score = 0;

    // Booking frequency
    const recentBookings = bookings.filter(
      b => new Date(b.scheduledDate).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    if (recentBookings.length >= 3) score += 0.4;
    else if (recentBookings.length >= 1) score += 0.2;

    // Booking consistency
    if (bookings.length >= 5) score += 0.3;
    else if (bookings.length >= 2) score += 0.1;

    return Math.min(1, score);
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
   * Identify risk factors for a customer
   */
  private identifyRiskFactors(user: any, bookings: any[]): string[] {
    const factors: string[] = [];
    const now = new Date();

    const lastBooking = bookings[0];
    const daysSinceLastBooking = lastBooking
      ? Math.floor((now.getTime() - new Date(lastBooking.scheduledDate).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // Inactivity
    if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.critical) {
      factors.push('Critical inactivity (>90 days)');
    } else if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.high) {
      factors.push('High inactivity (60-90 days)');
    } else if (daysSinceLastBooking > this.INACTIVITY_THRESHOLDS.warning) {
      factors.push('Moderate inactivity (30-60 days)');
    }

    // Booking decline
    const trend = this.calculateBookingTrend(bookings);
    if (trend < -0.5) {
      factors.push('Significant booking decline');
    } else if (trend < 0) {
      factors.push('Decreasing booking frequency');
    }

    // Low engagement
    if (bookings.length === 0) {
      factors.push('No bookings yet');
    } else if (bookings.length < 3) {
      factors.push('Very few bookings');
    }

    // No recent activity
    if (bookings.length > 0 && daysSinceLastBooking > 14) {
      factors.push('Long gap in activity');
    }

    return factors;
  }

  /**
   * Get recommended action based on risk level
   */
  private getRecommendedAction(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical':
        return 'Immediate personal outreach and special offer';
      case 'high':
        return 'Send targeted discount and re-engagement campaign';
      case 'medium':
        return 'Add to email nurture sequence';
      default:
        return 'Continue regular engagement';
    }
  }

  // =============================================================================
  // Get At-Risk Customers
  // =============================================================================

  /**
   * Get list of at-risk customers based on filters
   */
  async getAtRiskCustomers(filters: ChurnFilters): Promise<AtRiskCustomer[]> {
    const cacheKey = `${this.CACHE_PREFIX}at-risk:${JSON.stringify(filters)}`;

    // Try cache first
    const cached = await this.getCached<AtRiskCustomer[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const now = new Date();
    const warningDate = new Date(now.getTime() - this.INACTIVITY_THRESHOLDS.warning * 24 * 60 * 60 * 1000);
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    // Build aggregation pipeline
    const pipeline: any[] = [
      // Match customers
      {
        $match: {
          role: 'customer',
          accountStatus: 'active',
          isActive: true,
        },
      },
      // Lookup last booking
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
          ],
          as: 'lastBooking',
        },
      },
      // Add computed fields
      {
        $addFields: {
          lastBookingDate: { $ifNull: [{ $arrayElemAt: ['$lastBooking.scheduledDate', 0] }, null] },
          totalSpent: { $ifNull: [{ $arrayElemAt: ['$lastBooking.pricing.totalAmount', 0] }, 0] },
        },
      },
      // Filter by inactivity
      {
        $match: {
          $or: [
            { lastBookingDate: { $lt: warningDate } },
            { lastBookingDate: { $exists: false } },
          ],
        },
      },
      // Get booking count
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
            { $count: 'total' },
          ],
          as: 'bookingCount',
        },
      },
      {
        $addFields: {
          totalBookings: { $ifNull: [{ $arrayElemAt: ['$bookingCount.total', 0] }, 0] },
        },
      },
      // Get total spent from all bookings
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
            {
              $group: {
                _id: null,
                totalSpent: { $sum: '$pricing.totalAmount' },
              },
            },
          ],
          as: 'spending',
        },
      },
      // Get all bookings for risk calculation
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
            { $sort: { scheduledDate: -1 } },
            { $limit: 50 },
          ],
          as: 'allBookings',
        },
      },
      {
        $addFields: {
          totalSpent: { $ifNull: [{ $arrayElemAt: ['$spending.totalSpent', 0] }, 0] },
          bookingsForRisk: '$allBookings',
        },
      },
      // Calculate days since last booking
      {
        $addFields: {
          daysSinceLastBooking: {
            $cond: {
              if: { $ifNull: ['$lastBookingDate', false] },
              then: {
                $floor: {
                  $divide: [
                    { $subtract: [now, '$lastBookingDate'] },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
              else: {
                $floor: {
                  $divide: [
                    { $subtract: [now, '$createdAt'] },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
            },
          },
        },
      },
      // Sort by days since last booking
      { $sort: { daysSinceLastBooking: -1 } },
      // Pagination
      { $skip: offset },
      { $limit: limit },
      // Project fields
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          daysSinceLastBooking: 1,
          totalBookings: 1,
          totalSpent: 1,
          lastBookingDate: 1,
        },
      },
    ];

    const customers = await User.aggregate(pipeline);

    // Calculate risk for each customer
    const atRiskCustomers: AtRiskCustomer[] = [];

    for (const customer of customers) {
      const bookings = customer.bookingsForRisk || [];
      const riskMetrics = this.calculateRiskMetrics(customer, bookings);
      const riskLevel = this.determineRiskLevel(riskMetrics.score);
      const riskFactors = this.identifyRiskFactors(customer, bookings);
      const recommendedActions = this.generateRecommendedActions(riskLevel, customer);

      // Apply filters
      if (filters.minRiskLevel) {
        const levels = ['low', 'medium', 'high', 'critical'];
        if (levels.indexOf(riskLevel) < levels.indexOf(filters.minRiskLevel)) {
          continue;
        }
      }

      if (filters.minDaysInactive && customer.daysSinceLastBooking < filters.minDaysInactive) {
        continue;
      }

      if (filters.maxDaysInactive && customer.daysSinceLastBooking > filters.maxDaysInactive) {
        continue;
      }

      atRiskCustomers.push({
        customerId: customer._id.toString(),
        customerName: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        phone: customer.phone,
        riskScore: riskMetrics.score,
        riskLevel,
        riskFactors,
        daysSinceLastBooking: customer.daysSinceLastBooking,
        totalBookings: customer.totalBookings,
        totalSpent: customer.totalSpent,
        lastBookingDate: customer.lastBookingDate,
        predictedChurnDate: this.predictChurnDate(customer.daysSinceLastBooking, riskLevel),
        recommendedActions,
      });
    }

    // Cache result
    await this.setCached(cacheKey, atRiskCustomers);

    return atRiskCustomers;
  }

  /**
   * Predict churn date based on inactivity and risk level
   */
  private predictChurnDate(daysSinceLastBooking: number, riskLevel: string): Date {
    const predictedDate = new Date();

    switch (riskLevel) {
      case 'critical':
        predictedDate.setDate(predictedDate.getDate() + 14);
        break;
      case 'high':
        predictedDate.setDate(predictedDate.getDate() + 30);
        break;
      case 'medium':
        predictedDate.setDate(predictedDate.getDate() + 60);
        break;
      default:
        predictedDate.setDate(predictedDate.getDate() + 90);
    }

    return predictedDate;
  }

  /**
   * Generate recommended actions for a customer
   */
  private generateRecommendedActions(riskLevel: string, customer: any): string[] {
    const actions: string[] = [];

    switch (riskLevel) {
      case 'critical':
        actions.push('Send personal outreach via phone');
        actions.push('Offer significant discount (25-30%)');
        actions.push('Create VIP support ticket');
        break;
      case 'high':
        actions.push('Send targeted email with special offer');
        actions.push('Trigger push notification campaign');
        actions.push('Consider loyalty point bonus');
        break;
      case 'medium':
        actions.push('Add to re-engagement email sequence');
        actions.push('Highlight new features/services');
        actions.push('Send seasonal promotion');
        break;
      default:
        actions.push('Continue regular engagement');
        actions.push('Encourage app reviews');
    }

    return actions;
  }

  // =============================================================================
  // Get Churn Statistics
  // =============================================================================

  /**
   * Get comprehensive churn statistics
   */
  async getChurnStats(dateRange: DateRange): Promise<ChurnStats> {
    const cacheKey = `${this.CACHE_PREFIX}stats:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`;

    // Try cache first
    const cached = await this.getCached<ChurnStats>(cacheKey);
    if (cached) {
      return cached;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get customer counts
    const [totalCustomers, activeCustomers, atRiskCustomers] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({
        role: 'customer',
        updatedAt: { $gte: thirtyDaysAgo },
      }),
      this.getAtRiskCustomers({ minRiskLevel: 'medium', limit: 1000 }),
    ]);

    // Calculate risk distribution
    const byRiskLevel = {
      critical: atRiskCustomers.filter(c => c.riskLevel === 'critical').length,
      high: atRiskCustomers.filter(c => c.riskLevel === 'high').length,
      medium: atRiskCustomers.filter(c => c.riskLevel === 'medium').length,
      low: atRiskCustomers.filter(c => c.riskLevel === 'low').length,
    };

    // Calculate churn rate
    const previousActive = await User.countDocuments({
      role: 'customer',
      updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
    });

    const churnRate = previousActive > 0
      ? ((previousActive - activeCustomers) / previousActive) * 100
      : 0;

    // Calculate average risk score
    const averageRiskScore = atRiskCustomers.length > 0
      ? atRiskCustomers.reduce((sum, c) => sum + c.riskScore, 0) / atRiskCustomers.length
      : 0;

    // Calculate total LTV at risk
    const totalLifetimeValueAtRisk = atRiskCustomers.reduce(
      (sum, c) => sum + c.totalSpent,
      0
    );

    // Get churn trend
    const churnTrend = await this.getChurnTrend(dateRange);

    // Calculate top risk factors
    const allFactors = atRiskCustomers.flatMap(c => c.riskFactors);
    const factorCounts: Record<string, number> = {};
    for (const factor of allFactors) {
      factorCounts[factor] = (factorCounts[factor] || 0) + 1;
    }

    const totalFactorOccurrences = Object.values(factorCounts).reduce((a, b) => a + b, 0);
    const topRiskFactors = Object.entries(factorCounts)
      .map(([factor, count]) => ({
        factor,
        count,
        percentage: totalFactorOccurrences > 0 ? (count / totalFactorOccurrences) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const stats: ChurnStats = {
      totalCustomers,
      activeCustomers,
      atRiskCustomers: atRiskCustomers.length,
      churnRate: Math.max(0, churnRate),
      byRiskLevel,
      averageRiskScore: Math.round(averageRiskScore * 10) / 10,
      totalLifetimeValueAtRisk,
      churnTrend,
      topRiskFactors,
    };

    // Cache result
    await this.setCached(cacheKey, stats);

    return stats;
  }

  /**
   * Get churn trend over time
   */
  private async getChurnTrend(dateRange: DateRange): Promise<Array<{ date: string; churnRate: number; atRiskCount: number }>> {
    const trend: Array<{ date: string; churnRate: number; atRiskCount: number }> = [];

    // Generate weekly data points
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    const dayMs = 24 * 60 * 60 * 1000;

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate.getTime() + 7 * dayMs);

      const [activeThisWeek, activeLastWeek, atRiskThisWeek] = await Promise.all([
        User.countDocuments({
          role: 'customer',
          updatedAt: { $gte: weekStart, $lt: weekEnd },
        }),
        User.countDocuments({
          role: 'customer',
          updatedAt: { $gte: new Date(weekStart.getTime() - 7 * dayMs), $lt: weekStart },
        }),
        this.getAtRiskCustomers({
          minDaysInactive: 0,
          maxDaysInactive: 90,
          limit: 1000,
        }),
      ]);

      const churnRate = activeLastWeek > 0
        ? ((activeLastWeek - activeThisWeek) / activeLastWeek) * 100
        : 0;

      trend.push({
        date: weekStart.toISOString().split('T')[0],
        churnRate: Math.max(0, churnRate),
        atRiskCount: atRiskThisWeek.length,
      });

      currentDate = new Date(weekEnd);
    }

    return trend;
  }

  // =============================================================================
  // Cache Helpers
  // =============================================================================

  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const cached = await cache.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss or error
    }
    return null;
  }

  private async setCached<T>(key: string, data: T): Promise<void> {
    try {
      await cache.set(key, JSON.stringify(data), this.CACHE_TTL);
    } catch {
      // Cache write error - ignore
    }
  }

  /**
   * Clear churn cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await cache.keys(`${this.CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await cache.del(...keys);
      }
      logger.info('Churn cache cleared', { keysDeleted: keys.length });
    } catch (error) {
      logger.error('Failed to clear churn cache', { error });
    }
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const churnService = new ChurnService();

// =============================================================================
// Export Class for Testing
// =============================================================================

export { ChurnService };
export default churnService;
