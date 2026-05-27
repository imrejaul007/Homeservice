import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import { Commission } from '../models/commission.model';
import logger from '../utils/logger';
import { cache, ANALYTICS_CACHE_TTL } from '../config/redis';
import { withCache } from '../utils/queryOptimizer';

// ============================================
// Analytics Types
// ============================================

export interface TrendDataPoint {
  date: string;
  value: number;
  previousValue?: number;
  growth?: number;
}

export interface AggregatedMetric {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface CohortData {
  cohort: string;
  period: number;
  users: number;
  retained: number;
  retentionRate: number;
}

export interface FunnelStep {
  step: string;
  count: number;
  percentage: number;
  dropoffRate: number;
}

export interface GeoDistribution {
  region: string;
  country: string;
  city?: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface TimeSeriesData {
  date: string;
  revenue: number;
  bookings: number;
  customers: number;
  providers: number;
  averageValue: number;
}

export interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  totalRevenue: number;
  totalBookings: number;
  averageRating: number;
  growth: number;
  share: number;
}

export interface DashboardMetrics {
  timestamp: Date;
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    inProgress: number;
    noShow: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    monthOverMonthGrowth: number;
    averageBookingValue: number;
    projectedMonthly: number;
  };
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
    returning: number;
    churnRate: number;
  };
  providers: {
    total: number;
    active: number;
    pending: number;
    newThisMonth: number;
    averageRating: number;
  };
  serviceHealth: {
    totalServices: number;
    activeServices: number;
    averageRating: number;
    topPerforming: string[];
  };
}

export interface TimePeriod {
  start: Date;
  end: Date;
}

export interface ComparisonPeriods {
  current: TimePeriod;
  previous: TimePeriod;
}

// ============================================
// Analytics Service Class
// ============================================

export class AnalyticsService {
  private readonly CACHE_TTL = {
    SHORT: 60,    // 1 minute
    MEDIUM: 300,  // 5 minutes
    LONG: 600,    // 10 minutes
  };

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const cacheKey = 'analytics:dashboard:metrics';

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [
        bookingStats,
        revenueStats,
        customerStats,
        providerStats,
        serviceStats,
      ] = await Promise.all([
        this.getBookingStats(),
        this.getRevenueStats(startOfMonth, startOfLastMonth, endOfLastMonth),
        this.getCustomerStats(startOfMonth),
        this.getProviderStats(startOfMonth),
        this.getServiceStats(),
      ]);

      return {
        timestamp: now,
        bookings: bookingStats,
        revenue: revenueStats,
        customers: customerStats,
        providers: providerStats,
        serviceHealth: serviceStats,
      };
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Get booking statistics
   */
  private async getBookingStats() {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusMap = new Map(stats.map(s => [s._id, s.count]));

    return {
      total: Array.from(statusMap.values()).reduce((a, b) => a + b, 0),
      completed: statusMap.get('completed') || 0,
      cancelled: statusMap.get('cancelled') || 0,
      pending: statusMap.get('pending') || 0,
      inProgress: statusMap.get('in_progress') || 0,
      noShow: statusMap.get('no_show') || 0,
    };
  }

  /**
   * Get revenue statistics
   */
  private async getRevenueStats(startOfMonth: Date, startOfLastMonth: Date, endOfLastMonth: Date) {
    const now = new Date();

    const [thisMonthRevenue, lastMonthRevenue, bookingData] = await Promise.all([
      Commission.aggregate([
        {
          $match: {
            calculatedAt: { $gte: startOfMonth, $lte: now },
            status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$grossAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Commission.aggregate([
        {
          $match: {
            calculatedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
            status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$grossAmount' },
          },
        },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$pricing.totalAmount' },
          },
        },
      ]),
    ]);

    const thisMonth = thisMonthRevenue[0]?.total || 0;
    const lastMonth = lastMonthRevenue[0]?.total || 0;
    const bookingCount = bookingData[0]?.count || 0;
    const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : thisMonth > 0 ? 100 : 0;

    const daysInMonth = now.getDate();
    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthly = thisMonth * (daysInCurrentMonth / daysInMonth);

    return {
      total: thisMonth,
      thisMonth,
      lastMonth,
      monthOverMonthGrowth: growth,
      averageBookingValue: bookingCount > 0 ? thisMonth / bookingCount : 0,
      projectedMonthly,
    };
  }

  /**
   * Get customer statistics
   */
  private async getCustomerStats(startOfMonth: Date) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [totalCustomers, activeCustomers, newThisMonth, previousActive] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({
        role: 'customer',
        updatedAt: { $gte: thirtyDaysAgo },
      }),
      User.countDocuments({
        role: 'customer',
        createdAt: { $gte: startOfMonth },
      }),
      User.countDocuments({
        role: 'customer',
        updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }),
    ]);

    const churnRate = previousActive > 0
      ? ((previousActive - activeCustomers) / previousActive) * 100
      : 0;

    return {
      total: totalCustomers,
      active: activeCustomers,
      newThisMonth,
      returning: totalCustomers - newThisMonth,
      churnRate: Math.max(0, churnRate),
    };
  }

  /**
   * Get provider statistics
   */
  private async getProviderStats(startOfMonth: Date) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalProviders, activeProviders, pendingProviders, newThisMonth, avgRating] = await Promise.all([
      User.countDocuments({ role: 'provider' }),
      User.countDocuments({
        role: 'provider',
        updatedAt: { $gte: thirtyDaysAgo },
      }),
      User.countDocuments({
        role: 'provider',
        accountStatus: 'pending_verification',
      }),
      User.countDocuments({
        role: 'provider',
        createdAt: { $gte: startOfMonth },
      }),
      Service.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, avgRating: { $avg: '$rating.average' } } },
      ]),
    ]);

    return {
      total: totalProviders,
      active: activeProviders,
      pending: pendingProviders,
      newThisMonth,
      averageRating: avgRating[0]?.avgRating || 0,
    };
  }

  /**
   * Get service statistics
   */
  private async getServiceStats() {
    const [totalServices, activeServices, avgRating, topPerforming] = await Promise.all([
      Service.countDocuments({}),
      Service.countDocuments({ isActive: true }),
      Service.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, avgRating: { $avg: '$rating.average' } } },
      ]),
      Service.find({ isActive: true })
        .sort({ totalBookings: -1 })
        .limit(5)
        .select('title')
        .lean(),
    ]);

    return {
      totalServices,
      activeServices,
      averageRating: avgRating[0]?.avgRating || 0,
      topPerforming: topPerforming.map(s => s.name),
    };
  }

  /**
   * Get time series data for trend analysis
   */
  async getTimeSeriesData(
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesData[]> {
    const cacheKey = `analytics:timeseries:${startDate.toISOString()}:${endDate.toISOString()}:${granularity}`;

    return this.getCachedData(cacheKey, async () => {
      let dateFormat: string;
      let dateUnit: { $dateTrunc: { date: string; unit: string } };

      switch (granularity) {
        case 'week':
          dateFormat = '%Y-W%V';
          dateUnit = { $dateTrunc: { date: '$createdAt', unit: 'week' } };
          break;
        case 'month':
          dateFormat = '%Y-%m';
          dateUnit = { $dateTrunc: { date: '$createdAt', unit: 'month' } };
          break;
        default:
          dateFormat = '%Y-%m-%d';
          dateUnit = { $dateTrunc: { date: '$createdAt', unit: 'day' } };
      }

      const bookings = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: dateUnit,
            revenue: { $sum: '$pricing.totalAmount' },
            bookings: { $sum: 1 },
            customers: { $addToSet: '$customerId' },
            providers: { $addToSet: '$providerId' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return bookings.map((b: any) => ({
        date: b._id instanceof Date ? b._id.toISOString().split('T')[0] : String(b._id),
        revenue: b.revenue,
        bookings: b.bookings,
        customers: b.customers.length,
        providers: b.providers.length,
        averageValue: b.bookings > 0 ? b.revenue / b.bookings : 0,
      }));
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Get trend analysis for a specific metric
   */
  async getTrendAnalysis(
    metric: 'revenue' | 'bookings' | 'customers' | 'providers',
    periods: ComparisonPeriods
  ): Promise<AggregatedMetric> {
    const cacheKey = `analytics:trend:${metric}:${periods.current.start.toISOString()}`;

    return this.getCachedData(cacheKey, async () => {
      let currentValue = 0;
      let previousValue = 0;

      switch (metric) {
        case 'revenue':
          const [currentRevenue, previousRevenue] = await Promise.all([
            Commission.aggregate([
              {
                $match: {
                  calculatedAt: { $gte: periods.current.start, $lte: periods.current.end },
                  status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
                },
              },
              { $group: { _id: null, total: { $sum: '$grossAmount' } } },
            ]),
            Commission.aggregate([
              {
                $match: {
                  calculatedAt: { $gte: periods.previous.start, $lte: periods.previous.end },
                  status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
                },
              },
              { $group: { _id: null, total: { $sum: '$grossAmount' } } },
            ]),
          ]);
          currentValue = currentRevenue[0]?.total || 0;
          previousValue = previousRevenue[0]?.total || 0;
          break;

        case 'bookings':
          const [currentBookings, previousBookings] = await Promise.all([
            Booking.countDocuments({
              createdAt: { $gte: periods.current.start, $lte: periods.current.end },
              status: 'completed',
            }),
            Booking.countDocuments({
              createdAt: { $gte: periods.previous.start, $lte: periods.previous.end },
              status: 'completed',
            }),
          ]);
          currentValue = currentBookings;
          previousValue = previousBookings;
          break;

        case 'customers':
          const [currentCustomers, previousCustomers] = await Promise.all([
            User.countDocuments({
              createdAt: { $gte: periods.current.start, $lte: periods.current.end },
              role: 'customer',
            }),
            User.countDocuments({
              createdAt: { $gte: periods.previous.start, $lte: periods.previous.end },
              role: 'customer',
            }),
          ]);
          currentValue = currentCustomers;
          previousValue = previousCustomers;
          break;

        case 'providers':
          const [currentProviders, previousProviders] = await Promise.all([
            User.countDocuments({
              createdAt: { $gte: periods.current.start, $lte: periods.current.end },
              role: 'provider',
            }),
            User.countDocuments({
              createdAt: { $gte: periods.previous.start, $lte: periods.previous.end },
              role: 'provider',
            }),
          ]);
          currentValue = currentProviders;
          previousValue = previousProviders;
          break;
      }

      const change = currentValue - previousValue;
      const changePercent = previousValue > 0
        ? ((currentValue - previousValue) / previousValue) * 100
        : currentValue > 0 ? 100 : 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (changePercent > 1) trend = 'up';
      else if (changePercent < -1) trend = 'down';

      return {
        current: currentValue,
        previous: previousValue,
        change,
        changePercent,
        trend,
      };
    }, this.CACHE_TTL.SHORT);
  }

  /**
   * Get cohort analysis data
   */
  async getCohortAnalysis(
    cohortType: 'weekly' | 'monthly' = 'monthly',
    retentionPeriods: number = 6
  ): Promise<CohortData[]> {
    const cacheKey = `analytics:cohort:${cohortType}:${retentionPeriods}`;

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - (retentionPeriods + 1) * 30 * 24 * 60 * 60 * 1000);

      // Get all customers and their booking history
      const customers = await User.find({
        role: 'customer',
        createdAt: { $gte: startDate },
      }).select('_id createdAt').lean();

      const customerCreationDates = new Map(
        customers.map(c => [c._id.toString(), new Date(c.createdAt)])
      );

      const bookings = await Booking.find({
        customerId: { $in: Array.from(customerCreationDates.keys()) },
      })
        .select('customerId createdAt')
        .sort({ createdAt: 1 })
        .lean();

      // Group customers into cohorts
      const cohortMap = new Map<string, {
        creationDate: Date;
        customers: Set<string>;
      }>();

      for (const customer of customers) {
        const customerId = customer._id.toString();
        const creationDate = customerCreationDates.get(customerId)!;
        const cohortKey = cohortType === 'monthly'
          ? `${creationDate.getFullYear()}-${String(creationDate.getMonth() + 1).padStart(2, '0')}`
          : this.getWeekKey(creationDate);

        if (!cohortMap.has(cohortKey)) {
          cohortMap.set(cohortKey, {
            creationDate,
            customers: new Set(),
          });
        }
        cohortMap.get(cohortKey)!.customers.add(customerId);
      }

      // Calculate retention for each cohort at each period
      const cohortData: CohortData[] = [];
      const sortedCohorts = Array.from(cohortMap.entries()).sort((a, b) =>
        a[1].creationDate.getTime() - b[1].creationDate.getTime()
      );

      for (const [cohortKey, cohort] of sortedCohorts) {
        for (let period = 0; period <= retentionPeriods; period++) {
          const periodStart = this.addPeriods(cohort.creationDate, period, cohortType);
          const periodEnd = this.addPeriods(periodStart, 1, cohortType);

          const customersInPeriod = new Set<string>();
          for (const booking of bookings) {
            const bookingDate = new Date(booking.createdAt);
            if (bookingDate >= periodStart && bookingDate < periodEnd) {
              customersInPeriod.add(booking.customerId!.toString());
            }
          }

          // Intersect with original cohort
          let retained = 0;
          for (const customerId of cohort.customers) {
            if (customersInPeriod.has(customerId)) {
              retained++;
            }
          }

          cohortData.push({
            cohort: cohortKey,
            period,
            users: cohort.customers.size,
            retained,
            retentionRate: cohort.customers.size > 0
              ? (retained / cohort.customers.size) * 100
              : 0,
          });
        }
      }

      return cohortData;
    }, this.CACHE_TTL.LONG);
  }

  /**
   * Get conversion funnel data
   */
  async getConversionFunnel(startDate: Date, endDate: Date): Promise<FunnelStep[]> {
    const cacheKey = `analytics:funnel:${startDate.toISOString()}:${endDate.toISOString()}`;

    return this.getCachedData(cacheKey, async () => {
      const statuses = ['pending', 'confirmed', 'in_progress', 'completed'];
      const statusLabels: Record<string, string> = {
        pending: 'Search / Browse',
        confirmed: 'Booking Made',
        in_progress: 'Service Started',
        completed: 'Completed',
      };

      const counts = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const countMap = new Map(counts.map(c => [c._id, c.count]));
      const funnelSteps: FunnelStep[] = [];
      let previousCount = 0;

      for (const status of statuses) {
        const count = countMap.get(status) || 0;
        const stepTotal = count + (countMap.get('cancelled') || 0) * (statuses.indexOf(status) / statuses.length);

        if (previousCount === 0 && count === 0) continue;

        const dropoffRate = previousCount > 0
          ? ((previousCount - count) / previousCount) * 100
          : 0;

        funnelSteps.push({
          step: statusLabels[status],
          count,
          percentage: stepTotal > 0 ? (count / stepTotal) * 100 : 0,
          dropoffRate: Math.max(0, dropoffRate),
        });

        previousCount = count;
      }

      return funnelSteps;
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Get geographic distribution of business
   */
  async getGeographicDistribution(startDate: Date, endDate: Date): Promise<GeoDistribution[]> {
    const cacheKey = `analytics:geo:${startDate.toISOString()}:${endDate.toISOString()}`;

    return this.getCachedData(cacheKey, async () => {
      const bookings = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: '$location.address.country',
            count: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' },
          },
        },
        { $sort: { revenue: -1 } },
      ]);

      const totalRevenue = bookings.reduce((sum, b) => sum + b.revenue, 0);

      return bookings.map(b => ({
        region: b._id || 'Unknown',
        country: b._id || 'Unknown',
        count: b.count,
        revenue: b.revenue,
        percentage: totalRevenue > 0 ? (b.revenue / totalRevenue) * 100 : 0,
      }));
    }, this.CACHE_TTL.LONG);
  }

  /**
   * Get category performance metrics
   */
  async getCategoryPerformance(startDate: Date, endDate: Date): Promise<CategoryPerformance[]> {
    const cacheKey = `analytics:categories:${startDate.toISOString()}:${endDate.toISOString()}`;

    return this.getCachedData(cacheKey, async () => {
      const previousStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousEnd = new Date(startDate.getTime() - 1);

      const [currentData, previousData, categories] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
              status: 'completed',
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
          { $unwind: '$category' },
          {
            $group: {
              _id: '$category._id',
              categoryName: { $first: '$category.name' },
              totalRevenue: { $sum: '$pricing.totalAmount' },
              totalBookings: { $sum: 1 },
              avgRating: { $avg: '$service.rating.average' },
            },
          },
          { $sort: { totalRevenue: -1 } },
        ]),
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: previousStart, $lte: previousEnd },
              status: 'completed',
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
          { $unwind: '$category' },
          {
            $group: {
              _id: '$category._id',
              totalRevenue: { $sum: '$pricing.totalAmount' },
            },
          },
        ]),
        ServiceCategory.find({}).select('_id name').lean(),
      ]);

      const previousMap = new Map(
        previousData.map((p: any) => [p._id.toString(), p.totalRevenue])
      );
      const categoryMap = new Map(categories.map(c => [c._id.toString(), c.name]));
      const totalCurrentRevenue = currentData.reduce((sum: number, c: any) => sum + c.totalRevenue, 0);

      return currentData.map((c: any) => {
        const currentRevenue = c.totalRevenue;
        const prevRevenue = previousMap.get(c._id.toString()) || 0;
        const growth = prevRevenue > 0
          ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
          : currentRevenue > 0 ? 100 : 0;

        return {
          categoryId: c._id.toString(),
          categoryName: c.categoryName || categoryMap.get(c._id.toString()) || 'Unknown',
          totalRevenue: currentRevenue,
          totalBookings: c.totalBookings,
          averageRating: c.avgRating || 0,
          growth,
          share: totalCurrentRevenue > 0 ? (currentRevenue / totalCurrentRevenue) * 100 : 0,
        };
      });
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Clear analytics cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await cache.keys('analytics:*');
      if (keys.length > 0) {
        await cache.del(...keys);
      }
      logger.info('Analytics cache cleared', { keysDeleted: keys.length });
    } catch (error) {
      logger.error('Failed to clear analytics cache', { error });
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

  private getWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + 1);
    return `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;
  }

  private addPeriods(date: Date, periods: number, type: 'weekly' | 'monthly'): Date {
    const result = new Date(date);
    if (type === 'monthly') {
      result.setMonth(result.getMonth() + periods);
    } else {
      result.setDate(result.getDate() + periods * 7);
    }
    return result;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

export default analyticsService;

// ============================================
// Provider-Specific Analytics
// ============================================

export interface ProviderAnalyticsData {
  overview: {
    totalViews: number;
    viewsTrend: number;
    profileViews: number;
    profileViewsTrend: number;
    bookingRequests: number;
    bookingRequestsTrend: number;
    conversionRate: number;
    conversionRateTrend: number;
  };
  earnings: {
    thisMonth: number;
    lastMonth: number;
    trend: number;
  };
  bookings: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
  };
  topServices: Array<{
    name: string;
    bookings: number;
    revenue: number;
  }>;
  weeklyData: Array<{
    day: string;
    bookings: number;
    revenue: number;
  }>;
  ratings: {
    average: number;
    total: number;
    breakdown: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
}

/**
 * Get analytics data for a specific provider
 */
export const getProviderAnalyticsData = async (providerId: string, period: '7d' | '30d' | '90d' = '30d'): Promise<ProviderAnalyticsData> => {
  const { getProviderInsightsAnalytics } = await import('./providerInsightsAnalytics.service');
  return getProviderInsightsAnalytics(providerId, period);
};
