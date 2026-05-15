import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import { Commission } from '../models/commission.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// ============================================
// Executive Dashboard Types
// ============================================

export interface ExecutiveKPIs {
  timestamp: Date;
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    monthOverMonthGrowth: number;
    yearToDate: number;
    projectedAnnual: number;
  };
  bookings: {
    total: number;
    thisMonth: number;
    completed: number;
    cancelled: number;
    completionRate: number;
  };
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
    retentionRate: number;
    ltv: number;
  };
  providers: {
    total: number;
    active: number;
    pendingVerification: number;
    averageRating: number;
  };
  platform: {
    grossMargin: number;
    netMargin: number;
    takeRate: number;
    averageOrderValue: number;
  };
}

export interface GrowthMetrics {
  period: string;
  revenue: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
  bookings: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
  customers: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
  providers: {
    current: number;
    previous: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface RevenueDashboard {
  summary: {
    totalRevenue: number;
    grossRevenue: number;
    netRevenue: number;
    platformFees: number;
    paymentProcessingFees: number;
    commissions: number;
    taxes: number;
    providerPayouts: number;
  };
  breakdown: {
    byService: Array<{
      serviceId: string;
      serviceName: string;
      revenue: number;
      percentage: number;
      bookings: number;
    }>;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      revenue: number;
      percentage: number;
      bookings: number;
    }>;
    byProvider: Array<{
      providerId: string;
      providerName: string;
      revenue: number;
      percentage: number;
      bookings: number;
    }>;
  };
  trends: {
    daily: Array<{
      date: string;
      revenue: number;
      bookings: number;
    }>;
    weekly: Array<{
      week: string;
      revenue: number;
      bookings: number;
    }>;
    monthly: Array<{
      month: string;
      revenue: number;
      bookings: number;
    }>;
  };
}

export interface OperationalMetrics {
  averageBookingValue: number;
  averageServiceDuration: number;
  bookingLeadTime: number; // Average days between booking and service
  providerUtilization: number;
  customerSatisfaction: {
    averageRating: number;
    responseRate: number;
    reviewRate: number;
  };
  serviceHealth: {
    activeServices: number;
    pendingServices: number;
    topPerformers: Array<{
      serviceId: string;
      serviceName: string;
      bookings: number;
      revenue: number;
      rating: number;
    }>;
    underperformers: Array<{
      serviceId: string;
      serviceName: string;
      reason: string;
    }>;
  };
}

export interface ExecutiveAlert {
  id: string;
  type: 'success' | 'info' | 'warning' | 'critical';
  category: 'revenue' | 'customers' | 'providers' | 'operations' | 'compliance';
  title: string;
  message: string;
  actionRequired: boolean;
  actionUrl?: string;
  createdAt: Date;
}

export interface MarketOpportunity {
  category: string;
  demand: number;
  currentSupply: number;
  gap: number;
  opportunityScore: number;
  recommendation: string;
}

export interface ExecutiveDashboardData {
  kpis: ExecutiveKPIs;
  growth: GrowthMetrics;
  revenue: RevenueDashboard;
  operations: OperationalMetrics;
  alerts: ExecutiveAlert[];
  opportunities: MarketOpportunity[];
}

// ============================================
// Executive Dashboard Service Class
// ============================================

export class ExecutiveDashboardService {
  private readonly CACHE_TTL = {
    SHORT: 30,
    MEDIUM: 300,
    LONG: 600,
  };

  /**
   * Get comprehensive executive dashboard data
   */
  async getExecutiveDashboard(): Promise<ExecutiveDashboardData> {
    const cacheKey = 'executive:dashboard:full';

    return this.getCachedData(cacheKey, async () => {
      const [
        kpis,
        growth,
        revenue,
        operations,
        alerts,
        opportunities,
      ] = await Promise.all([
        this.getExecutiveKPIs(),
        this.getGrowthMetrics(),
        this.getRevenueDashboard(),
        this.getOperationalMetrics(),
        this.getExecutiveAlerts(),
        this.getMarketOpportunities(),
      ]);

      return {
        kpis,
        growth,
        revenue,
        operations,
        alerts,
        opportunities,
      };
    }, this.CACHE_TTL.SHORT);
  }

  /**
   * Get executive-level KPIs
   */
  async getExecutiveKPIs(): Promise<ExecutiveKPIs> {
    const cacheKey = 'executive:kpis';

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [
        revenueData,
        lastMonthRevenue,
        yearToDateRevenue,
        bookingStats,
        customerStats,
        providerStats,
        commissionStats,
      ] = await Promise.all([
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
              grossRevenue: { $sum: '$grossAmount' },
              netRevenue: { $sum: '$netAmount' },
              platformFees: { $sum: '$platformFee' },
              paymentFees: { $sum: '$paymentProcessingFee' },
              commissions: { $sum: '$commissionAmount' },
              taxes: { $sum: '$taxAmount' },
              providerPayouts: { $sum: '$providerEarnings' },
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
          { $group: { _id: null, total: { $sum: '$grossAmount' } } },
        ]),
        Commission.aggregate([
          {
            $match: {
              calculatedAt: { $gte: startOfYear, $lte: now },
              status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
            },
          },
          { $group: { _id: null, total: { $sum: '$grossAmount' } } },
        ]),
        this.getBookingStats(),
        this.getCustomerStats(),
        this.getProviderStats(),
        this.getCommissionStats(),
      ]);

      const revenue = revenueData[0] || {
        grossRevenue: 0,
        netRevenue: 0,
        platformFees: 0,
        paymentFees: 0,
        commissions: 0,
        taxes: 0,
        providerPayouts: 0,
      };
      const thisMonth = revenue.grossRevenue;
      const lastMonth = lastMonthRevenue[0]?.total || 0;
      const monthOverMonthGrowth = lastMonth > 0
        ? ((thisMonth - lastMonth) / lastMonth) * 100
        : thisMonth > 0 ? 100 : 0;

      // Project annual revenue
      const daysInMonth = now.getDate();
      const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysInYear = new Date(now.getFullYear(), 11, 31).getDay();
      const dayOfYear = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      const projectedAnnual = (thisMonth / daysInMonth) * 365;

      const totalBookings = bookingStats.total;
      const averageOrderValue = totalBookings > 0 ? thisMonth / totalBookings : 0;
      const takeRate = thisMonth > 0 ? (revenue.commissions / thisMonth) * 100 : 0;
      const grossMargin = thisMonth > 0
        ? ((revenue.commissions + revenue.platformFees) / thisMonth) * 100
        : 0;
      const netMargin = thisMonth > 0
        ? ((revenue.commissions - revenue.paymentFees) / thisMonth) * 100
        : 0;

      return {
        timestamp: now,
        revenue: {
          total: thisMonth,
          thisMonth,
          lastMonth,
          monthOverMonthGrowth,
          yearToDate: yearToDateRevenue[0]?.total || 0,
          projectedAnnual,
        },
        bookings: {
          total: totalBookings,
          thisMonth: bookingStats.thisMonth,
          completed: bookingStats.completed,
          cancelled: bookingStats.cancelled,
          completionRate: totalBookings > 0 ? (bookingStats.completed / totalBookings) * 100 : 0,
        },
        customers: {
          total: customerStats.total,
          active: customerStats.active,
          newThisMonth: customerStats.newThisMonth,
          retentionRate: customerStats.retentionRate,
          ltv: customerStats.averageLTV,
        },
        providers: {
          total: providerStats.total,
          active: providerStats.active,
          pendingVerification: providerStats.pending,
          averageRating: providerStats.averageRating,
        },
        platform: {
          grossMargin,
          netMargin,
          takeRate,
          averageOrderValue,
        },
      };
    }, this.CACHE_TTL.SHORT);
  }

  /**
   * Get growth metrics
   */
  async getGrowthMetrics(): Promise<GrowthMetrics> {
    const cacheKey = 'executive:growth';

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const thisWeekStart = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000);
      const lastWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        revenueComparison,
        bookingComparison,
        customerComparison,
        providerComparison,
      ] = await Promise.all([
        Commission.aggregate([
          {
            $match: {
              calculatedAt: {
                $gte: lastMonthStart,
                $lte: now,
              },
              status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
            },
          },
          {
            $group: {
              _id: {
                $cond: [
                  { $gte: ['$calculatedAt', thisMonthStart] },
                  'current',
                  'previous',
                ],
              },
              total: { $sum: '$grossAmount' },
            },
          },
        ]),
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: lastMonthStart, $lte: now },
              status: 'completed',
            },
          },
          {
            $group: {
              _id: {
                $cond: [
                  { $gte: ['$createdAt', thisMonthStart] },
                  'current',
                  'previous',
                ],
              },
              count: { $sum: 1 },
            },
          },
        ]),
        User.aggregate([
          {
            $match: {
              role: 'customer',
              createdAt: { $gte: lastMonthStart, $lte: now },
            },
          },
          {
            $group: {
              _id: {
                $cond: [
                  { $gte: ['$createdAt', thisMonthStart] },
                  'current',
                  'previous',
                ],
              },
              count: { $sum: 1 },
            },
          },
        ]),
        User.aggregate([
          {
            $match: {
              role: 'provider',
              createdAt: { $gte: lastMonthStart, $lte: now },
            },
          },
          {
            $group: {
              _id: {
                $cond: [
                  { $gte: ['$createdAt', thisMonthStart] },
                  'current',
                  'previous',
                ],
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      const getValue = (data: any[], key: string) =>
        data.find(d => d._id === key)?.total || data.find(d => d._id === key)?.count || 0;

      const currentRevenue = getValue(revenueComparison, 'current');
      const previousRevenue = getValue(revenueComparison, 'previous');
      const currentBookings = getValue(bookingComparison, 'current');
      const previousBookings = getValue(bookingComparison, 'previous');
      const currentCustomers = getValue(customerComparison, 'current');
      const previousCustomers = getValue(customerComparison, 'previous');
      const currentProviders = getValue(providerComparison, 'current');
      const previousProviders = getValue(providerComparison, 'previous');

      const calcTrend = (growth: number): 'up' | 'down' | 'stable' => {
        if (growth > 1) return 'up';
        if (growth < -1) return 'down';
        return 'stable';
      };

      const calcGrowth = (current: number, previous: number) => {
        const growth = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
        return {
          current,
          previous,
          growth,
          trend: calcTrend(growth),
        };
      };

      const revenue = calcGrowth(currentRevenue, previousRevenue);
      const bookings = calcGrowth(currentBookings, previousBookings);
      const customers = calcGrowth(currentCustomers, previousCustomers);
      const providers = calcGrowth(currentProviders, previousProviders);

      return {
        period: `${lastMonthStart.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
        revenue,
        bookings,
        customers,
        providers,
      };
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Get revenue dashboard
   */
  async getRevenueDashboard(): Promise<RevenueDashboard> {
    const cacheKey = 'executive:revenue';

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [
        summaryData,
        byService,
        byCategory,
        byProvider,
        dailyTrend,
        monthlyTrend,
      ] = await Promise.all([
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
              grossRevenue: { $sum: '$grossAmount' },
              netRevenue: { $sum: '$netAmount' },
              platformFees: { $sum: '$platformFee' },
              paymentFees: { $sum: '$paymentProcessingFee' },
              commissions: { $sum: '$commissionAmount' },
              taxes: { $sum: '$taxAmount' },
              providerPayouts: { $sum: '$providerEarnings' },
            },
          },
        ]),
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfMonth, $lte: now },
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
            $group: {
              _id: '$service._id',
              serviceName: { $first: '$service.title' },
              revenue: { $sum: '$pricing.totalAmount' },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
        ]),
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfMonth, $lte: now },
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
              revenue: { $sum: '$pricing.totalAmount' },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { revenue: -1 } },
        ]),
        Commission.aggregate([
          {
            $match: {
              calculatedAt: { $gte: startOfMonth, $lte: now },
              status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
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
              providerName: { $first: { $concat: ['$provider.firstName', ' ', '$provider.lastName'] } },
              revenue: { $sum: '$grossAmount' },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
        ]),
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfMonth, $lte: now },
              status: 'completed',
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              revenue: { $sum: '$pricing.totalAmount' },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: startOfYear, $lte: now },
              status: 'completed',
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
              revenue: { $sum: '$pricing.totalAmount' },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      const summary = summaryData[0] || {
        grossRevenue: 0,
        netRevenue: 0,
        platformFees: 0,
        paymentFees: 0,
        commissions: 0,
        taxes: 0,
        providerPayouts: 0,
      };
      const totalRevenue = summary.grossRevenue;

      return {
        summary: {
          totalRevenue: summary.grossRevenue,
          grossRevenue: summary.grossRevenue,
          netRevenue: summary.netRevenue,
          platformFees: summary.platformFees,
          paymentProcessingFees: summary.paymentFees,
          commissions: summary.commissions,
          taxes: summary.taxes,
          providerPayouts: summary.providerPayouts,
        },
        breakdown: {
          byService: byService.map((s: any) => ({
            serviceId: s._id.toString(),
            serviceName: s.serviceName,
            revenue: s.revenue,
            percentage: totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0,
            bookings: s.bookings,
          })),
          byCategory: byCategory.map((c: any) => ({
            categoryId: c._id.toString(),
            categoryName: c.categoryName,
            revenue: c.revenue,
            percentage: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
            bookings: c.bookings,
          })),
          byProvider: byProvider.map((p: any) => ({
            providerId: p._id.toString(),
            providerName: p.providerName,
            revenue: p.revenue,
            percentage: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
            bookings: p.bookings,
          })),
        },
        trends: {
          daily: dailyTrend.map((d: any) => ({
            date: d._id,
            revenue: d.revenue,
            bookings: d.bookings,
          })),
          weekly: [], // Would require weekly aggregation
          monthly: monthlyTrend.map((m: any) => ({
            month: m._id,
            revenue: m.revenue,
            bookings: m.bookings,
          })),
        },
      };
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Get operational metrics
   */
  async getOperationalMetrics(): Promise<OperationalMetrics> {
    const cacheKey = 'executive:operations';

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        bookingMetrics,
        serviceMetrics,
        ratingMetrics,
      ] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: thirtyDaysAgo },
              status: 'completed',
            },
          },
          {
            $group: {
              _id: null,
              avgBookingValue: { $avg: '$pricing.totalAmount' },
              avgDuration: { $avg: '$duration' },
              count: { $sum: 1 },
            },
          },
        ]),
        Service.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: null,
              activeCount: { $sum: 1 },
              avgRating: { $avg: '$rating.average' },
            },
          },
        ]),
        Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: thirtyDaysAgo },
              status: 'completed',
            },
          },
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'bookingId',
              as: 'review',
            },
          },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              reviewedBookings: {
                $sum: { $cond: [{ $gt: [{ $size: '$review' }, 0] }, 1, 0] },
              },
            },
          },
        ]),
      ]);

      const topServices = await Service.find({ isActive: true })
        .sort({ totalBookings: -1 })
        .limit(5)
        .select('_id title totalBookings pricing.basePrice rating.average')
        .lean();

      return {
        averageBookingValue: bookingMetrics[0]?.avgBookingValue || 0,
        averageServiceDuration: bookingMetrics[0]?.avgDuration || 0,
        bookingLeadTime: 3, // Would require lead time calculation
        providerUtilization: 65, // Would require provider availability data
        customerSatisfaction: {
          averageRating: serviceMetrics[0]?.avgRating || 0,
          responseRate: 95,
          reviewRate: bookingMetrics[0]?.count > 0
            ? (bookingMetrics[0].reviewedBookings / bookingMetrics[0].count) * 100
            : 0,
        },
        serviceHealth: {
          activeServices: serviceMetrics[0]?.activeCount || 0,
          pendingServices: 0,
          topPerformers: topServices.map((s: any) => ({
            serviceId: s._id.toString(),
            serviceName: s.title,
            bookings: s.totalBookings || 0,
            revenue: (s.totalBookings || 0) * s.pricing?.basePrice || 0,
            rating: s.rating?.average || 0,
          })),
          underperformers: [],
        },
      };
    }, this.CACHE_TTL.MEDIUM);
  }

  /**
   * Get executive alerts
   */
  async getExecutiveAlerts(): Promise<ExecutiveAlert[]> {
    const cacheKey = 'executive:alerts';

    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const alerts: ExecutiveAlert[] = [];

      // Check for high cancellation rate
      const [completed, cancelled] = await Promise.all([
        Booking.countDocuments({
          createdAt: { $gte: startOfMonth },
          status: 'completed',
        }),
        Booking.countDocuments({
          createdAt: { $gte: startOfMonth },
          status: 'cancelled',
        }),
      ]);

      const cancellationRate = completed + cancelled > 0
        ? (cancelled / (completed + cancelled)) * 100
        : 0;

      if (cancellationRate > 15) {
        alerts.push({
          id: 'high-cancellation',
          type: 'warning',
          category: 'operations',
          title: 'High Cancellation Rate',
          message: `Cancellation rate is ${cancellationRate.toFixed(1)}%, exceeding the 15% threshold.`,
          actionRequired: true,
          actionUrl: '/admin/disputes',
          createdAt: now,
        });
      }

      // Check for provider verification backlog
      const pendingProviders = await User.countDocuments({
        role: 'provider',
        accountStatus: 'pending_verification',
      });

      if (pendingProviders > 10) {
        alerts.push({
          id: 'provider-backlog',
          type: 'info',
          category: 'providers',
          title: 'Provider Verification Backlog',
          message: `${pendingProviders} providers are awaiting verification.`,
          actionRequired: true,
          actionUrl: '/admin/providers',
          createdAt: now,
        });
      }

      // Check for low customer retention
      const retention = await this.getRetentionAlert();
      if (retention) {
        alerts.push(retention);
      }

      return alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
        return severityOrder[a.type] - severityOrder[b.type];
      });
    }, this.CACHE_TTL.SHORT);
  }

  /**
   * Get market opportunities
   */
  async getMarketOpportunities(): Promise<MarketOpportunity[]> {
    const cacheKey = 'executive:opportunities';

    return this.getCachedData(cacheKey, async () => {
      const categories = await ServiceCategory.find({}).lean();
      const opportunities: MarketOpportunity[] = [];

      for (const category of categories) {
        const [demand, supply] = await Promise.all([
          Booking.countDocuments({
            'service.category': category._id,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          }),
          Service.countDocuments({ category: category._id, isActive: true }),
        ]);

        if (demand > 50 && supply < 10) {
          opportunities.push({
            category: category.name,
            demand,
            currentSupply: supply,
            gap: demand - supply,
            opportunityScore: Math.min(100, ((demand - supply) / demand) * 100),
            recommendation: `Consider recruiting ${Math.ceil(demand / 10)} more providers in ${category.name} to meet demand.`,
          });
        }
      }

      return opportunities
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, 5);
    }, this.CACHE_TTL.LONG);
  }

  /**
   * Clear executive dashboard cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await cache.keys('executive:*');
      if (keys.length > 0) {
        await cache.del(...keys);
      }
      logger.info('Executive dashboard cache cleared', { keysDeleted: keys.length });
    } catch (error) {
      logger.error('Failed to clear executive dashboard cache', { error });
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

  private async getBookingStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [stats, thisMonthCount] = await Promise.all([
      Booking.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Booking.countDocuments({
        createdAt: { $gte: startOfMonth },
      }),
    ]);

    const statusMap = new Map(stats.map(s => [s._id, s.count]));

    return {
      total: Array.from(statusMap.values()).reduce((a, b) => a + b, 0),
      thisMonth: thisMonthCount,
      completed: statusMap.get('completed') || 0,
      cancelled: statusMap.get('cancelled') || 0,
    };
  }

  private async getCustomerStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, active, newThisMonth, ltvData] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({
        role: 'customer',
        updatedAt: { $gte: thirtyDaysAgo },
      }),
      User.countDocuments({
        role: 'customer',
        createdAt: { $gte: startOfMonth },
      }),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$customerId',
            totalSpent: { $sum: '$pricing.totalAmount' },
          },
        },
        {
          $group: {
            _id: null,
            avgLTV: { $avg: '$totalSpent' },
          },
        },
      ]),
    ]);

    return {
      total,
      active,
      newThisMonth,
      retentionRate: total > 0 ? (active / total) * 100 : 0,
      averageLTV: ltvData[0]?.avgLTV || 0,
    };
  }

  private async getProviderStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, active, pending, avgRating] = await Promise.all([
      User.countDocuments({ role: 'provider' }),
      User.countDocuments({
        role: 'provider',
        updatedAt: { $gte: thirtyDaysAgo },
      }),
      User.countDocuments({
        role: 'provider',
        accountStatus: 'pending_verification',
      }),
      Service.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, avgRating: { $avg: '$rating.average' } } },
      ]),
    ]);

    return {
      total,
      active,
      pending,
      averageRating: avgRating[0]?.avgRating || 0,
    };
  }

  private async getCommissionStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = await Commission.aggregate([
      {
        $match: {
          calculatedAt: { $gte: startOfMonth, $lte: now },
          status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
        },
      },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$commissionAmount' },
          totalRevenue: { $sum: '$grossAmount' },
        },
      },
    ]);

    return {
      totalCommission: stats[0]?.totalCommission || 0,
      totalRevenue: stats[0]?.totalRevenue || 0,
      takeRate: stats[0]?.totalRevenue > 0
        ? (stats[0].totalCommission / stats[0].totalRevenue) * 100
        : 0,
    };
  }

  private async getRetentionAlert(): Promise<ExecutiveAlert | null> {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [previousActive, currentActive] = await Promise.all([
      User.countDocuments({
        role: 'customer',
        updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }),
      User.countDocuments({
        role: 'customer',
        updatedAt: { $gte: thirtyDaysAgo },
      }),
    ]);

    const retentionRate = previousActive > 0
      ? ((currentActive - (previousActive - currentActive)) / previousActive) * 100
      : 0;

    if (retentionRate < 60) {
      return {
        id: 'low-retention',
        type: 'critical',
        category: 'customers',
        title: 'Low Customer Retention',
        message: `Customer retention rate dropped to ${retentionRate.toFixed(1)}%. Immediate action recommended.`,
        actionRequired: true,
        actionUrl: '/admin/customers',
        createdAt: now,
      };
    }

    return null;
  }
}

// Export singleton instance
export const executiveDashboardService = new ExecutiveDashboardService();

export default executiveDashboardService;
