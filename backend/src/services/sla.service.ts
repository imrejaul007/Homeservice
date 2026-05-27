import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import logger from '../utils/logger';

// ============================================
// SLA Service Types
// ============================================

export interface SLAThresholds {
  bookingResponseTime: number;  // minutes
  bookingConfirmationTime: number;  // minutes
  serviceCompletionTime: number;  // hours
  providerResponseTime: number;  // minutes
  cancellationWindow: number;  // minutes before service
}

export interface SLAMetrics {
  totalBookings: number;
  meetingSLA: number;
  breachedSLA: number;
  complianceRate: number;
  averageResponseTime: number;  // minutes
  averageCompletionTime: number;  // hours
  byCategory: SLAComplianceByCategory[];
  byProvider: SLAComplianceByProvider[];
  trends: SLATrend[];
}

export interface SLAComplianceByCategory {
  categoryId: string;
  categoryName: string;
  totalBookings: number;
  complianceRate: number;
  avgResponseTime: number;
  avgCompletionTime: number;
}

export interface SLAComplianceByProvider {
  providerId: string;
  providerName: string;
  totalBookings: number;
  complianceRate: number;
  breachedCount: number;
}

export interface SLATrend {
  date: string;
  complianceRate: number;
  totalBookings: number;
  breaches: number;
}

export interface SLABreach {
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  breachType: 'response_time' | 'confirmation_time' | 'completion_time' | 'cancellation';
  expectedTime: Date;
  actualTime?: Date;
  delayMinutes?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

export interface SLAReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  overallCompliance: number;
  totalBookingsAnalyzed: number;
  totalBreaches: number;
  breachBreakdown: {
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  topBreachedCategories: Array<{ categoryId: string; categoryName: string; breachCount: number }>;
  topBreachedProviders: Array<{ providerId: string; providerName: string; breachCount: number }>;
  recommendations: string[];
}

// Default SLA thresholds (can be configured per tenant)
const DEFAULT_THRESHOLDS: SLAThresholds = {
  bookingResponseTime: 60,      // 1 hour to acknowledge
  bookingConfirmationTime: 30,   // 30 mins to confirm booking
  serviceCompletionTime: 24,      // 24 hours to complete service
  providerResponseTime: 120,     // 2 hours to respond to customer
  cancellationWindow: 120,        // 2 hours before service for free cancellation
};

// ============================================
// SLA Service Class
// ============================================

class SLAService {
  private thresholds: SLAThresholds = DEFAULT_THRESHOLDS;

  /**
   * Update SLA thresholds
   */
  setThresholds(thresholds: Partial<SLAThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): SLAThresholds {
    return { ...this.thresholds };
  }

  /**
   * Calculate SLA compliance for a date range
   */
  async calculateCompliance(startDate: Date, endDate: Date): Promise<SLAMetrics> {
    const bookings = await Booking.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'cancelled', 'confirmed', 'in_progress'] },
    }).populate('service');

    const totalBookings = bookings.length;
    let meetingSLA = 0;
    let breachedSLA = 0;
    const allResponseTimes: number[] = [];
    const allCompletionTimes: number[] = [];
    const breaches: SLABreach[] = [];

    for (const booking of bookings) {
      const compliance = this.checkBookingCompliance(booking);
      if (compliance.compliant) {
        meetingSLA++;
      } else {
        breachedSLA++;
        breaches.push(compliance.breach!);
      }

      if (compliance.responseTime !== null) {
        allResponseTimes.push(compliance.responseTime);
      }
      if (compliance.completionTime !== null) {
        allCompletionTimes.push(compliance.completionTime);
      }
    }

    const avgResponseTime = allResponseTimes.length > 0
      ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
      : 0;

    const avgCompletionTime = allCompletionTimes.length > 0
      ? allCompletionTimes.reduce((a, b) => a + b, 0) / allCompletionTimes.length
      : 0;

    const byCategory = await this.getComplianceByCategory(startDate, endDate);
    const byProvider = await this.getComplianceByProvider(startDate, endDate);
    const trends = await this.getTrends(startDate, endDate);

    return {
      totalBookings,
      meetingSLA,
      breachedSLA,
      complianceRate: totalBookings > 0 ? (meetingSLA / totalBookings) * 100 : 100,
      averageResponseTime: avgResponseTime,
      averageCompletionTime: avgCompletionTime,
      byCategory,
      byProvider,
      trends,
    };
  }

  /**
   * Check if a single booking meets SLA requirements
   */
  private checkBookingCompliance(booking: any): {
    compliant: boolean;
    responseTime: number | null;
    completionTime: number | null;
    breach?: SLABreach;
  } {
    const createdAt = new Date(booking.createdAt);
    const scheduledDate = new Date(booking.scheduledDate);
    const confirmedAt = booking.confirmedAt ? new Date(booking.confirmedAt) : null;
    const completedAt = booking.completedAt ? new Date(booking.completedAt) : null;

    // Calculate response time (creation to confirmation)
    let responseTime: number | null = null;
    let completionTime: number | null = null;

    if (confirmedAt) {
      responseTime = (confirmedAt.getTime() - createdAt.getTime()) / (1000 * 60); // in minutes

      if (responseTime > this.thresholds.bookingConfirmationTime) {
        return {
          compliant: false,
          responseTime,
          completionTime: null,
          breach: {
            bookingId: booking._id,
            customerId: booking.customerId,
            providerId: booking.providerId,
            breachType: 'confirmation_time',
            expectedTime: new Date(createdAt.getTime() + this.thresholds.bookingConfirmationTime * 60 * 1000),
            actualTime: confirmedAt,
            delayMinutes: responseTime - this.thresholds.bookingConfirmationTime,
            severity: this.calculateSeverity(responseTime - this.thresholds.bookingConfirmationTime, 'medium'),
            resolved: false,
          },
        };
      }
    }

    // Calculate completion time
    if (completedAt) {
      completionTime = (completedAt.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60); // in hours

      if (completionTime > this.thresholds.serviceCompletionTime) {
        return {
          compliant: false,
          responseTime,
          completionTime,
          breach: {
            bookingId: booking._id,
            customerId: booking.customerId,
            providerId: booking.providerId,
            breachType: 'completion_time',
            expectedTime: new Date(scheduledDate.getTime() + this.thresholds.serviceCompletionTime * 60 * 60 * 1000),
            actualTime: completedAt,
            delayMinutes: (completionTime - this.thresholds.serviceCompletionTime) * 60,
            severity: this.calculateSeverity(completionTime - this.thresholds.serviceCompletionTime, 'high'),
            resolved: false,
          },
        };
      }
    }

    return { compliant: true, responseTime, completionTime };
  }

  /**
   * Calculate breach severity based on delay
   */
  private calculateSeverity(delayMinutes: number, baseSeverity: 'low' | 'medium' | 'high' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    if (delayMinutes > 480) return 'critical'; // 8+ hours
    if (delayMinutes > 240) return 'high';      // 4+ hours
    if (delayMinutes > 60) return 'medium';     // 1+ hour
    return baseSeverity;
  }

  /**
   * Get compliance breakdown by service category
   */
  private async getComplianceByCategory(startDate: Date, endDate: Date): Promise<SLAComplianceByCategory[]> {
    const result = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: 'services',
          localField: 'serviceId',
          foreignField: '_id',
          as: 'service',
        },
      },
      { $unwind: '$service' },
      {
        $lookup: {
          from: 'servicecategories',
          localField: 'service.category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$service.category',
          categoryName: { $first: '$category.name' },
          totalBookings: { $sum: 1 },
          confirmedBookings: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$confirmedAt', null] },
                    {
                      $lte: [
                        { $subtract: ['$confirmedAt', '$createdAt'] },
                        this.thresholds.bookingConfirmationTime * 60 * 1000,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          categoryId: '$_id',
          categoryName: { $ifNull: ['$categoryName', 'Uncategorized'] },
          totalBookings: 1,
          complianceRate: {
            $cond: [
              { $gt: ['$totalBookings', 0] },
              { $multiply: [{ $divide: ['$confirmedBookings', '$totalBookings'] }, 100] },
              100,
            ],
          },
          avgResponseTime: 0,
          avgCompletionTime: 0,
        },
      },
      { $sort: { totalBookings: -1 } },
      { $limit: 20 },
    ]);

    return result.map((r: any) => ({
      categoryId: r.categoryId?.toString() || 'unknown',
      categoryName: r.categoryName,
      totalBookings: r.totalBookings,
      complianceRate: Math.round(r.complianceRate * 100) / 100,
      avgResponseTime: r.avgResponseTime || 0,
      avgCompletionTime: r.avgCompletionTime || 0,
    }));
  }

  /**
   * Get compliance breakdown by provider
   */
  private async getComplianceByProvider(startDate: Date, endDate: Date): Promise<SLAComplianceByProvider[]> {
    const result = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'providerId',
          foreignField: '_id',
          as: 'provider',
        },
      },
      { $unwind: '$provider' },
      {
        $group: {
          _id: '$providerId',
          providerName: { $first: { $concat: ['$provider.firstName', ' ', { $ifNull: ['$provider.lastName', ''] }] } },
          totalBookings: { $sum: 1 },
          breachedBookings: {
            $sum: {
              $cond: [
                {
                  $or: [
                    {
                      $and: [
                        { $ne: ['$confirmedAt', null] },
                        {
                          $gt: [
                            { $subtract: ['$confirmedAt', '$createdAt'] },
                            this.thresholds.bookingConfirmationTime * 60 * 1000,
                          ],
                        },
                      ],
                    },
                    {
                      $and: [
                        { $eq: ['$status', 'cancelled'] },
                        { $eq: ['$cancellationDetails.cancelledBy', 'provider'] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          providerId: '$_id',
          providerName: 1,
          totalBookings: 1,
          complianceRate: {
            $cond: [
              { $gt: ['$totalBookings', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$totalBookings', '$breachedBookings'] }, '$totalBookings'] }, 100] },
              100,
            ],
          },
          breachedCount: '$breachedBookings',
        },
      },
      { $sort: { totalBookings: -1 } },
      { $limit: 50 },
    ]);

    return result.map((r: any) => ({
      providerId: r._id?.toString() || 'unknown',
      providerName: r.providerName,
      totalBookings: r.totalBookings,
      complianceRate: Math.round(r.complianceRate * 100) / 100,
      breachedCount: r.breachedCount,
    }));
  }

  /**
   * Get SLA trends over time
   */
  private async getTrends(startDate: Date, endDate: Date): Promise<SLATrend[]> {
    const result = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalBookings: { $sum: 1 },
          breachedBookings: {
            $sum: {
              $cond: [
                {
                  $or: [
                    {
                      $and: [
                        { $ne: ['$confirmedAt', null] },
                        {
                          $gt: [
                            { $subtract: ['$confirmedAt', '$createdAt'] },
                            this.thresholds.bookingConfirmationTime * 60 * 1000,
                          ],
                        },
                      ],
                    },
                    {
                      $and: [
                        { $ne: ['$completedAt', null] },
                        {
                          $gt: [
                            { $subtract: ['$completedAt', '$scheduledDate'] },
                            this.thresholds.serviceCompletionTime * 60 * 60 * 1000,
                          ],
                        },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((r: any) => ({
      date: r._id,
      complianceRate: r.totalBookings > 0
        ? Math.round(((r.totalBookings - r.breachedBookings) / r.totalBookings) * 100 * 100) / 100
        : 100,
      totalBookings: r.totalBookings,
      breaches: r.breachedBookings,
    }));
  }

  /**
   * Generate comprehensive SLA report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<SLAReport> {
    const bookings = await Booking.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).populate('service');

    const totalBookingsAnalyzed = bookings.length;
    const breachBreakdown = {
      byType: {
        response_time: 0,
        confirmation_time: 0,
        completion_time: 0,
        cancellation: 0,
      } as Record<string, number>,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      } as Record<string, number>,
    };

    const categoryBreaches: Record<string, number> = {};
    const providerBreaches: Record<string, number> = {};
    const recommendations: string[] = [];

    let totalBreaches = 0;

    for (const booking of bookings) {
      const compliance = this.checkBookingCompliance(booking);
      if (!compliance.compliant && compliance.breach) {
        totalBreaches++;
        const breach = compliance.breach;

        breachBreakdown.byType[breach.breachType]++;
        breachBreakdown.bySeverity[breach.severity]++;

        const categoryId = (booking.service as any)?.category?.toString() || 'unknown';
        const providerId = booking.providerId.toString();

        categoryBreaches[categoryId] = (categoryBreaches[categoryId] || 0) + 1;
        providerBreaches[providerId] = (providerBreaches[providerId] || 0) + 1;
      }
    }

    // Get category and provider names for top breaches
    const topBreachedCategories = await this.getTopBreachedCategories(categoryBreaches);
    const topBreachedProviders = await this.getTopBreachedProviders(providerBreaches);

    // Generate recommendations
    const overallCompliance = totalBookingsAnalyzed > 0
      ? ((totalBookingsAnalyzed - totalBreaches) / totalBookingsAnalyzed) * 100
      : 100;

    if (overallCompliance < 80) {
      recommendations.push('SLA compliance is below 80%. Consider implementing automated reminders for providers.');
    }
    if (breachBreakdown.byType.confirmation_time > totalBreaches * 0.3) {
      recommendations.push('Confirmation time breaches are high. Reduce confirmation threshold or add incentives for faster responses.');
    }
    if (breachBreakdown.byType.completion_time > totalBreaches * 0.3) {
      recommendations.push('Completion time breaches are high. Review scheduling buffer and provider capacity.');
    }
    if (breachBreakdown.bySeverity.critical > 0) {
      recommendations.push('Critical SLA breaches detected. Immediate intervention required for affected bookings.');
    }
    if (recommendations.length === 0) {
      recommendations.push('SLA compliance is within acceptable levels. Continue monitoring.');
    }

    return {
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      overallCompliance: Math.round(overallCompliance * 100) / 100,
      totalBookingsAnalyzed,
      totalBreaches,
      breachBreakdown,
      topBreachedCategories,
      topBreachedProviders,
      recommendations,
    };
  }

  /**
   * Get top breached categories with names
   */
  private async getTopBreachedCategories(categoryBreaches: Record<string, number>): Promise<Array<{ categoryId: string; categoryName: string; breachCount: number }>> {
    const sorted = Object.entries(categoryBreaches)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const results = [];
    for (const [categoryId] of sorted) {
      if (categoryId !== 'unknown') {
        const ServiceCategory = (await import('../models/serviceCategory.model')).default;
        const category = await ServiceCategory.findById(categoryId).select('name');
        results.push({
          categoryId,
          categoryName: category?.name || 'Unknown Category',
          breachCount: categoryBreaches[categoryId],
        });
      }
    }

    return results;
  }

  /**
   * Get top breached providers with names
   */
  private async getTopBreachedProviders(providerBreaches: Record<string, number>): Promise<Array<{ providerId: string; providerName: string; breachCount: number }>> {
    const sorted = Object.entries(providerBreaches)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const results = [];
    for (const [providerId] of sorted) {
      const User = (await import('../models/user.model')).default;
      const provider = await User.findById(providerId).select('firstName lastName');
      if (provider) {
        results.push({
          providerId,
          providerName: `${provider.firstName} ${provider.lastName || ''}`.trim(),
          breachCount: providerBreaches[providerId],
        });
      }
    }

    return results;
  }

  /**
   * Get SLA overview for dashboard
   */
  async getOverview(): Promise<{
    currentCompliance: number;
    trend: 'improving' | 'stable' | 'declining';
    totalBreaches: number;
    criticalBreaches: number;
    averageResponseTime: number;
    topIssue: string;
  }> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [recentMetrics, olderMetrics] = await Promise.all([
      this.calculateCompliance(sevenDaysAgo, now),
      this.calculateCompliance(fourteenDaysAgo, sevenDaysAgo),
    ]);

    const breachCount = await Booking.countDocuments({
      confirmedAt: { $exists: true },
      createdAt: { $gte: thirtyDaysAgo },
      $expr: {
        $gt: [
          { $subtract: ['$confirmedAt', '$createdAt'] },
          this.thresholds.bookingConfirmationTime * 60 * 1000,
        ],
      },
    });

    const criticalBreachCount = await Booking.countDocuments({
      confirmedAt: { $exists: true },
      createdAt: { $gte: sevenDaysAgo },
      $expr: {
        $gt: [
          { $subtract: ['$confirmedAt', '$createdAt'] },
          4 * 60 * 60 * 1000, // 4 hours
        ],
      },
    });

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    const diff = recentMetrics.complianceRate - olderMetrics.complianceRate;
    if (diff > 5) trend = 'improving';
    else if (diff < -5) trend = 'declining';

    let topIssue = 'No significant issues';
    if (breachCount > recentMetrics.totalBookings * 0.2) {
      topIssue = 'High confirmation time breaches';
    } else if (criticalBreachCount > 0) {
      topIssue = 'Critical response delays detected';
    }

    return {
      currentCompliance: recentMetrics.complianceRate,
      trend,
      totalBreaches: breachCount,
      criticalBreaches: criticalBreachCount,
      averageResponseTime: recentMetrics.averageResponseTime,
      topIssue,
    };
  }
}

// Export singleton instance
export const slaService = new SLAService();

export default slaService;
