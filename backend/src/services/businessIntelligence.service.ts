import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import { Commission } from '../models/commission.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// ============================================
// Business Intelligence Types
// ============================================

export interface CustomerLifetimeValue {
  customerId: string;
  customerName: string;
  totalBookings: number;
  totalSpent: number;
  averageBookingValue: number;
  firstBookingDate: Date;
  lastBookingDate: Date;
  lifetimeDays: number;
  predictedLTV: number;
  segment: 'low' | 'medium' | 'high' | 'vip';
}

export interface CustomerAcquisitionCost {
  period: string;
  totalMarketingSpend: number;
  newCustomersAcquired: number;
  averageCAC: number;
  byChannel: {
    channel: string;
    spend: number;
    customers: number;
    cac: number;
  }[];
}

export interface RetentionMetrics {
  period: string;
  startingCustomers: number;
  retainedCustomers: number;
  churnedCustomers: number;
  retentionRate: number;
  churnRate: number;
  netRetention: number;
}

export interface CohortRetention {
  cohort: string;
  cohorts: Array<{
    period: number;
    users: number;
    retained: number;
    retentionRate: number;
    revenue: number;
    averageRevenuePerUser: number;
  }>;
}

export interface RFMAnalysis {
  customerId: string;
  recency: number;  // Days since last purchase
  frequency: number; // Number of purchases
  monetary: number;  // Total spend
  rfmScore: string; // e.g., "111" to "555"
  segment: 'champions' | 'loyal' | 'potential' | 'at_risk' | 'lost';
}

export interface RevenueBreakdown {
  period: string;
  grossRevenue: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  platformFees: number;
  paymentFees: number;
  taxes: number;
  providerPayouts: number;
  platformProfit: number;
}

export interface BusinessHealthScore {
  overall: number;
  categories: {
    name: string;
    score: number;
    trend: 'improving' | 'stable' | 'declining';
    metrics: Record<string, number>;
  }[];
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metric?: string;
  }>;
}

export interface BusinessGrowthMetrics {
  period: string;
  revenueGrowth: number;
  customerGrowth: number;
  bookingGrowth: number;
  averageOrderValueGrowth: number;
  npsGrowth: number;
  customerAcquisitionRate: number;
  customerRetentionRate: number;
}

export interface CompetitiveMetrics {
  marketShare: number;
  marketRank: number;
  averageRatingVsCompetitors: number;
  pricePosition: 'premium' | 'mid_market' | 'economy';
  serviceCoverage: number;
  geographicPenetration: number;
}

// ============================================
// Business Intelligence Service Class
// ============================================

export class BusinessIntelligenceService {
  private readonly CACHE_TTL = {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 900,
  };

  /**
   * Calculate Customer Lifetime Value for all customers
   */
  async calculateCustomerLTV(
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<CustomerLifetimeValue[]> {
    const cacheKey = `bi:ltv:${startDate?.toISOString()}:${endDate?.toISOString()}:${limit}`;

    return this.getCachedData(cacheKey, async () => {
      const matchStage: any = { status: 'completed' };
      if (startDate && endDate) {
        matchStage.createdAt = { $gte: startDate, $lte: endDate };
      }

      const customerStats = await Booking.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$customerId',
            totalBookings: { $sum: 1 },
            totalSpent: { $sum: '$pricing.totalAmount' },
            firstBooking: { $min: '$createdAt' },
            lastBooking: { $max: '$createdAt' },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { totalSpent: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: '$customer' },
      ]);

      const now = new Date();
      const ltvData: CustomerLifetimeValue[] = [];

      for (const stat of customerStats) {
        const lifetimeDays = Math.max(1,
          Math.ceil((now.getTime() - new Date(stat.firstBooking).getTime()) / (1000 * 60 * 60 * 24))
        );
        const avgBookingValue = stat.totalBookings > 0 ? stat.totalSpent / stat.totalBookings : 0;

        // Predict LTV based on historical data (simplified model)
        // Assuming average customer lifespan of 365 days and monthly activity
        const monthlyValue = stat.totalSpent / (lifetimeDays / 30);
        const predictedLTV = monthlyValue * 12; // Project to 12 months

        let segment: 'low' | 'medium' | 'high' | 'vip';
        if (stat.totalSpent >= 5000) segment = 'vip';
        else if (stat.totalSpent >= 1000) segment = 'high';
        else if (stat.totalSpent >= 200) segment = 'medium';
        else segment = 'low';

        ltvData.push({
          customerId: stat._id.toString(),
          customerName: `${stat.customer.firstName} ${stat.customer.lastName}`,
          totalBookings: stat.totalBookings,
          totalSpent: stat.totalSpent,
          averageBookingValue: avgBookingValue,
          firstBookingDate: stat.firstBooking,
          lastBookingDate: stat.lastBooking,
          lifetimeDays,
          predictedLTV,
          segment,
        });
      }

      return ltvData;
    }, this.CACHE_TTL.LONG);
  }

  /**
   * Calculate Customer Acquisition Cost
   */
  async calculateCAC(
    startDate: Date,
    endDate: Date
  ): Promise<CustomerAcquisitionCost> {
    const cacheKey = `bi:cac:${startDate.toISOString()}:${endDate.toISOString()}`;

    return this.getCachedData(cacheKey, async () => {
      const newCustomers = await User.countDocuments({
        role: 'customer',
        createdAt: { $gte: startDate, $lte: endDate },
      });

      // Simulated marketing spend (in production, this would come from marketing/ad spend data)
      const totalMarketingSpend = newCustomers * 25; // Assumed average CAC contribution
      const averageCAC = newCustomers > 0 ? totalMarketingSpend / newCustomers : 0;

      // Analyze acquisition by booking source/metadata
      const bookingsBySource = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            'metadata.bookingSource': { $exists: true },
          },
        },
        {
          $group: {
            _id: '$metadata.bookingSource',
            count: { $sum: 1 },
            customers: { $addToSet: '$customerId' },
          },
        },
      ]);

      const byChannel = bookingsBySource.map((source: any) => ({
        channel: source._id || 'unknown',
        spend: (source.count / newCustomers) * totalMarketingSpend,
        customers: source.customers.length,
        cac: source.customers.length > 0
          ? ((source.count / newCustomers) * totalMarketingSpend) / source.customers.length
          : 0,
      }));

      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalMarketingSpend,
        newCustomersAcquired: newCustomers,
        averageCAC,
        byChannel,
      };
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Calculate retention metrics
   */
  async calculateRetentionMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<RetentionMetrics> {
    const cacheKey = `bi:retention:${startDate.toISOString()}:${endDate.toISOString()}`;

    return this.getCachedData(cacheKey, async () => {
      const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const previousPeriodStart = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const previousPeriodEnd = new Date(startDate.getTime() - 1);

      // Get customers at start of period
      const [previousCustomers, currentCustomers, churnedInPeriod] = await Promise.all([
        User.distinct('_id', {
          role: 'customer',
          createdAt: { $lt: startDate },
        }),
        User.distinct('_id', {
          role: 'customer',
          createdAt: { $lt: endDate },
        }),
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
              status: 'completed',
            },
          },
          {
            $group: {
              _id: '$customerId',
              firstBooking: { $min: '$createdAt' },
            },
          },
          {
            $match: {
              firstBooking: { $lt: startDate },
            },
          },
        ]),
      ]);

      const previousSet = new Set(previousCustomers.map((id: any) => id.toString()));
      const currentSet = new Set(currentCustomers.map((id: any) => id.toString()));

      let retainedCustomers = 0;
      let churnedCustomers = 0;

      for (const customerId of previousSet) {
        if (currentSet.has(customerId)) {
          retainedCustomers++;
        } else {
          churnedCustomers++;
        }
      }

      const startingCustomers = previousSet.size;
      const retentionRate = startingCustomers > 0 ? (retainedCustomers / startingCustomers) * 100 : 0;
      const churnRate = startingCustomers > 0 ? (churnedCustomers / startingCustomers) * 100 : 0;

      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        startingCustomers,
        retainedCustomers,
        churnedCustomers,
        retentionRate,
        churnRate,
        netRetention: retentionRate - churnRate,
      };
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Perform RFM (Recency, Frequency, Monetary) analysis
   */
  async performRFMAnalysis(limit: number = 1000): Promise<RFMAnalysis[]> {
    const cacheKey = `bi:rfm:${limit}`;

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const customerStats = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
          },
        },
        {
          $group: {
            _id: '$customerId',
            totalBookings: { $sum: 1 },
            totalSpend: { $sum: '$pricing.totalAmount' },
            lastBookingDate: { $max: '$createdAt' },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { totalSpend: -1 } },
        { $limit: limit },
      ]);

      // Calculate RFM scores
      const rfmData: RFMAnalysis[] = [];

      for (const stat of customerStats) {
        const daysSinceLastBooking = Math.ceil(
          (now.getTime() - new Date(stat.lastBookingDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Recency: Lower days = higher score (1-5)
        let rScore: number;
        if (daysSinceLastBooking <= 7) rScore = 5;
        else if (daysSinceLastBooking <= 14) rScore = 4;
        else if (daysSinceLastBooking <= 30) rScore = 3;
        else if (daysSinceLastBooking <= 60) rScore = 2;
        else rScore = 1;

        // Frequency: More bookings = higher score (1-5)
        let fScore: number;
        if (stat.totalBookings >= 10) fScore = 5;
        else if (stat.totalBookings >= 5) fScore = 4;
        else if (stat.totalBookings >= 3) fScore = 3;
        else if (stat.totalBookings >= 2) fScore = 2;
        else fScore = 1;

        // Monetary: Higher spend = higher score (1-5)
        let mScore: number;
        if (stat.totalSpend >= 2000) mScore = 5;
        else if (stat.totalSpend >= 1000) mScore = 4;
        else if (stat.totalSpend >= 500) mScore = 3;
        else if (stat.totalSpend >= 200) mScore = 2;
        else mScore = 1;

        const rfmScore = `${rScore}${fScore}${mScore}`;

        // Determine segment
        let segment: RFMAnalysis['segment'];
        if (rScore >= 4 && fScore >= 4 && mScore >= 4) segment = 'champions';
        else if (fScore >= 3 && mScore >= 3) segment = 'loyal';
        else if (rScore >= 3 && fScore <= 2) segment = 'potential';
        else if (rScore <= 2 && fScore >= 3) segment = 'at_risk';
        else segment = 'lost';

        rfmData.push({
          customerId: stat._id.toString(),
          recency: daysSinceLastBooking,
          frequency: stat.totalBookings,
          monetary: stat.totalSpend,
          rfmScore,
          segment,
        });
      }

      return rfmData;
    }, this.CACHE_TTL.LONG);
  }

  /**
   * Get revenue breakdown by category
   */
  async getRevenueBreakdown(
    startDate: Date,
    endDate: Date
  ): Promise<RevenueBreakdown[]> {
    const cacheKey = `bi:revenue:${startDate.toISOString()}:${endDate.toISOString()}`;

    return this.getCachedData(cacheKey, async () => {
      // Get commission data for the period
      const commissions = await Commission.find({
        calculatedAt: { $gte: startDate, $lte: endDate },
        status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
      }).lean();

      // Get refunds for the period
      const refunds = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'cancelled',
            'cancellationDetails.refundAmount': { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalRefunds: { $sum: '$cancellationDetails.refundAmount' },
          },
        },
      ]);

      let grossRevenue = 0;
      let totalCommission = 0;
      let totalPlatformFee = 0;
      let totalPaymentFee = 0;
      let totalTax = 0;
      let totalProviderPayouts = 0;

      for (const comm of commissions) {
        grossRevenue += comm.grossAmount;
        totalCommission += comm.commissionAmount;
        totalPlatformFee += comm.platformFee;
        totalPaymentFee += comm.paymentProcessingFee;
        totalTax += comm.taxAmount;
        totalProviderPayouts += comm.providerEarnings;
      }

      const refundsTotal = refunds[0]?.totalRefunds || 0;
      const netRevenue = grossRevenue - refundsTotal;
      const platformProfit = totalCommission + totalPlatformFee + totalPaymentFee;

      return [{
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        grossRevenue,
        discounts: 0, // Would come from booking discounts field
        refunds: refundsTotal,
        netRevenue,
        platformFees: totalPlatformFee,
        paymentFees: totalPaymentFee,
        taxes: totalTax,
        providerPayouts: totalProviderPayouts,
        platformProfit,
      }];
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Calculate business health score
   */
  async calculateBusinessHealthScore(): Promise<BusinessHealthScore> {
    const cacheKey = 'bi:health';

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const [
        retentionMetrics,
        cacMetrics,
        revenueComparison,
      ] = await Promise.all([
        this.calculateRetentionMetrics(startOfMonth, now),
        this.calculateCAC(startOfMonth, now),
        this.getRevenueBreakdown(startOfMonth, now),
      ]);

      const alerts: BusinessHealthScore['alerts'] = [];
      const categories: BusinessHealthScore['categories'] = [];

      // Retention health
      let retentionScore = 80;
      if (retentionMetrics.retentionRate >= 90) retentionScore = 100;
      else if (retentionMetrics.retentionRate < 70) {
        retentionScore = 50;
        alerts.push({
          severity: 'warning',
          message: 'Customer retention rate is below target',
          metric: 'retention_rate',
        });
      }

      categories.push({
        name: 'Customer Retention',
        score: retentionScore,
        trend: retentionMetrics.retentionRate >= 70 ? 'stable' : 'declining',
        metrics: {
          retentionRate: retentionMetrics.retentionRate,
          churnRate: retentionMetrics.churnRate,
        },
      });

      // Acquisition health
      let acquisitionScore = 70;
      if (cacMetrics.newCustomersAcquired > 0) {
        acquisitionScore = Math.min(100, 100 - (cacMetrics.averageCAC / 10));
      }

      categories.push({
        name: 'Customer Acquisition',
        score: acquisitionScore,
        trend: 'stable',
        metrics: {
          cac: cacMetrics.averageCAC,
          newCustomers: cacMetrics.newCustomersAcquired,
        },
      });

      // Revenue health
      let revenueScore = 75;
      const currentRevenue = revenueComparison[0]?.netRevenue || 0;
      if (currentRevenue > 100000) revenueScore = 100;
      else if (currentRevenue < 50000) {
        revenueScore = 50;
        alerts.push({
          severity: 'warning',
          message: 'Monthly revenue below target threshold',
          metric: 'revenue',
        });
      }

      categories.push({
        name: 'Revenue Health',
        score: revenueScore,
        trend: 'stable',
        metrics: {
          netRevenue: currentRevenue,
          grossRevenue: revenueComparison[0]?.grossRevenue || 0,
          platformProfit: revenueComparison[0]?.platformProfit || 0,
        },
      });

      // Calculate overall score
      const overall = Math.round(
        categories.reduce((sum, cat) => sum + cat.score, 0) / categories.length
      );

      return { overall, categories, alerts };
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Calculate growth metrics
   */
  async calculateGrowthMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<BusinessGrowthMetrics> {
    const cacheKey = `bi:growth:${startDate.toISOString()}:${endDate.toISOString()}`;

    return this.getCachedData(cacheKey, async () => {
      const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const previousStart = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(startDate.getTime() - 1);

      const [
        currentRevenue,
        previousRevenue,
        currentCustomers,
        previousCustomers,
        currentBookings,
        previousBookings,
      ] = await Promise.all([
        Commission.aggregate([
          {
            $match: {
              calculatedAt: { $gte: startDate, $lte: endDate },
              status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
            },
          },
          { $group: { _id: null, total: { $sum: '$grossAmount' } } },
        ]),
        Commission.aggregate([
          {
            $match: {
              calculatedAt: { $gte: previousStart, $lte: previousEnd },
              status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
            },
          },
          { $group: { _id: null, total: { $sum: '$grossAmount' } } },
        ]),
        User.countDocuments({
          role: 'customer',
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        User.countDocuments({
          role: 'customer',
          createdAt: { $gte: previousStart, $lte: previousEnd },
        }),
        Booking.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        }),
        Booking.countDocuments({
          createdAt: { $gte: previousStart, $lte: previousEnd },
          status: 'completed',
        }),
      ]);

      const currentRev = currentRevenue[0]?.total || 0;
      const prevRev = previousRevenue[0]?.total || 0;
      const revenueGrowth = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : currentRev > 0 ? 100 : 0;

      const customerGrowth = previousCustomers > 0
        ? ((currentCustomers - previousCustomers) / previousCustomers) * 100
        : currentCustomers > 0 ? 100 : 0;

      const bookingGrowth = previousBookings > 0
        ? ((currentBookings - previousBookings) / previousBookings) * 100
        : currentBookings > 0 ? 100 : 0;

      const currentAOV = currentBookings > 0 ? currentRev / currentBookings : 0;
      const previousAOV = previousBookings > 0 ? prevRev / previousBookings : 0;
      const aovGrowth = previousAOV > 0 ? ((currentAOV - previousAOV) / previousAOV) * 100 : 0;

      const retention = await this.calculateRetentionMetrics(startDate, endDate);

      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        revenueGrowth,
        customerGrowth,
        bookingGrowth,
        averageOrderValueGrowth: aovGrowth,
        npsGrowth: 0, // Would require NPS survey data
        customerAcquisitionRate: customerGrowth,
        customerRetentionRate: retention.retentionRate,
      };
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Get competitive metrics
   */
  async getCompetitiveMetrics(): Promise<CompetitiveMetrics> {
    const cacheKey = 'bi:competitive';

    return this.getCachedData(cacheKey, async () => {
      const [avgRating, totalBookings, totalProviders] = await Promise.all([
        Service.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: null, avgRating: { $avg: '$rating.average' } } },
        ]),
        Booking.countDocuments({ status: 'completed' }),
        User.countDocuments({ role: 'provider' }),
      ]);

      const rating = avgRating[0]?.avgRating || 0;

      return {
        // FIX: Removed hardcoded placeholder values
        // These metrics require actual market data and competitive analysis
        marketShare: 0, // Requires external market data
        marketRank: 0, // Requires competitive benchmarking
        averageRatingVsCompetitors: 0, // Requires competitor data collection
        pricePosition: 'mid_market', // Can be calculated from pricing data
        serviceCoverage: (totalProviders / 100) * 100, // Valid calculation
        geographicPenetration: 0, // Requires location analytics implementation
      };
    }, this.CACHE_TTL.LONG);
  }

  /**
   * Clear BI cache using SCAN (non-blocking)
   */
  async clearCache(): Promise<void> {
    try {
      const client = cache.client;
      if (!client) return;

      let cursor = 0;
      let deletedCount = 0;

      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          'bi:*',
          'COUNT',
          100
        );
        cursor = parseInt(nextCursor, 10);

        if (keys.length > 0) {
          await client.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== 0);

      logger.info('Business Intelligence cache cleared', { keysDeleted: deletedCount });
    } catch (error) {
      logger.error('Failed to clear BI cache', { error });
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async getCachedData<T>(key: string, fetchFn: () => Promise<T>, ttl: number): Promise<T> {
    try {
      const cached = await cache.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss or error
    }

    const data = await fetchFn();

    try {
      await cache.set(key, JSON.stringify(data), ttl);
    } catch {
      // Cache write error - ignore
    }

    return data;
  }
}

// Export singleton instance
export const businessIntelligenceService = new BusinessIntelligenceService();

export default businessIntelligenceService;
