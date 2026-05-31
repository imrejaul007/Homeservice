/**
 * Service Analytics Service
 * Provides deep analytics for provider services including revenue, popularity, and conversion metrics
 */
import mongoose, { PipelineStage } from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import Review from '../models/review.model';
import User from '../models/user.model';
import logger from '../utils/logger';

export interface ServiceAnalyticsMetrics {
  serviceId: string;
  serviceName: string;
  category: string;
  totalBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  inProgressBookings: number;
  completionRate: number;
  cancellationRate: number;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  averageResponseTime: number; // in hours
  views: number;
  clicks: number;
  conversionRate: number;
  revenueTrend: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
  popularityScore: number;
  rank?: number;
}

export interface ServiceAnalyticsFilters {
  providerId?: string;
  serviceIds?: string[];
  category?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface MarketAverages {
  averageRating: number;
  averageRevenue: number;
  averageConversionRate: number;
  averageCompletionRate: number;
  averageBookingValue: number;
}

/**
 * Calculate popularity score for a service
 */
function calculatePopularityScore(
  bookings: number,
  revenue: number,
  rating: number,
  views: number,
  reviews: number
): number {
  // Weights for popularity calculation
  const bookingWeight = 30;
  const revenueWeight = 25;
  const ratingWeight = 20;
  const viewWeight = 15;
  const reviewWeight = 10;

  // Normalize values (assuming some baseline maxima)
  const maxBookings = 100;
  const maxRevenue = 50000;
  const maxViews = 10000;

  const bookingScore = Math.min(bookings / maxBookings, 1) * bookingWeight;
  const revenueScore = Math.min(revenue / maxRevenue, 1) * revenueWeight;
  const ratingScore = (rating / 5) * ratingWeight;
  const viewScore = Math.min(views / maxViews, 1) * viewWeight;
  const reviewScore = Math.min(reviews / 50, 1) * reviewWeight;

  return Math.round((bookingScore + revenueScore + ratingScore + viewScore + reviewScore) * 100) / 100;
}

/**
 * Calculate trend between two periods
 */
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
}

/**
 * Get daily revenue trend for a service
 */
async function getRevenueTrend(
  serviceId: string,
  days: number = 30
): Promise<Array<{ date: string; revenue: number; bookings: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const pipeline: PipelineStage[] = [
    {
      $match: {
        serviceId: new mongoose.Types.ObjectId(serviceId),
        status: 'completed',
        completedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
        },
        revenue: { $sum: '$pricing.totalAmount' },
        bookings: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 as const },
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        revenue: 1,
        bookings: 1,
      },
    },
  ];

  const result = await Booking.aggregate(pipeline);

  // Fill in missing dates with zero values
  const trend: Array<{ date: string; revenue: number; bookings: number }> = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const existing = result.find((r) => r.date === dateStr);
    trend.push({
      date: dateStr,
      revenue: existing?.revenue || 0,
      bookings: existing?.bookings || 0,
    });
  }

  return trend;
}

/**
 * Get analytics for a single service
 */
export async function getServiceAnalytics(
  serviceId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ServiceAnalyticsMetrics | null> {
  const service = await Service.findById(serviceId).lean();
  if (!service) {
    return null;
  }

  const dateFilter: Record<string, unknown> = {};
  if (startDate) {
    dateFilter.$gte = startDate;
  }
  if (endDate) {
    dateFilter.$lte = endDate;
  }

  const matchStage: Record<string, unknown> = {
    serviceId: new mongoose.Types.ObjectId(serviceId),
  };
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  // Get booking statistics
  const bookingStats = await Booking.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.totalAmount', 0],
          },
        },
      },
    },
  ]);

  const statsMap = new Map<string, { count: number; revenue: number }>();
  let totalBookings = 0;
  let totalRevenue = 0;
  let completedBookings = 0;
  let cancelledBookings = 0;

  for (const stat of bookingStats) {
    statsMap.set(stat._id, { count: stat.count, revenue: stat.revenue });
    totalBookings += stat.count;
    totalRevenue += stat.revenue;
    if (stat._id === 'completed') completedBookings = stat.count;
    if (stat._id === 'cancelled') cancelledBookings = stat.count;
  }

  const pendingBookings = statsMap.get('pending')?.count || 0;
  const confirmedBookings = statsMap.get('confirmed')?.count || 0;
  const inProgressBookings = statsMap.get('in_progress')?.count || 0;

  // Calculate average response time (time from booking creation to acceptance)
  const responseTimeStats = await Booking.aggregate([
    {
      $match: {
        serviceId: new mongoose.Types.ObjectId(serviceId),
        acceptedAt: { $exists: true, $ne: null },
        createdAt: { $exists: true },
      },
    },
    {
      $project: {
        responseTimeMinutes: {
          $divide: [
            { $subtract: ['$acceptedAt', '$createdAt'] },
            60000, // Convert ms to minutes
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgResponseTime: { $avg: '$responseTimeMinutes' },
      },
    },
  ]);

  const averageResponseTime = responseTimeStats[0]?.avgResponseTime || 0;

  // Get review statistics
  const reviewStats = await Review.aggregate([
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'booking',
      },
    },
    { $unwind: '$booking' },
    {
      $match: {
        'booking.serviceId': new mongoose.Types.ObjectId(serviceId),
        isHidden: false,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
      },
    },
  ]);

  const reviews = reviewStats[0] || {
    averageRating: 0,
    totalReviews: 0,
    rating5: 0,
    rating4: 0,
    rating3: 0,
    rating2: 0,
    rating1: 0,
  };

  // Calculate rates
  const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
  const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
  const conversionRate =
    service.searchMetadata.searchCount > 0
      ? (totalBookings / service.searchMetadata.searchCount) * 100
      : 0;

  // Get revenue trend
  const revenueTrend = await getRevenueTrend(serviceId, 30);

  // Calculate popularity score
  const popularityScore = calculatePopularityScore(
    totalBookings,
    totalRevenue,
    reviews.averageRating || 0,
    service.searchMetadata.searchCount,
    reviews.totalReviews
  );

  return {
    serviceId: serviceId,
    serviceName: service.name,
    category: service.category,
    totalBookings,
    totalRevenue,
    averageBookingValue: completedBookings > 0 ? totalRevenue / completedBookings : 0,
    completedBookings,
    cancelledBookings,
    pendingBookings,
    confirmedBookings,
    inProgressBookings,
    completionRate: Math.round(completionRate * 100) / 100,
    cancellationRate: Math.round(cancellationRate * 100) / 100,
    averageRating: Math.round((reviews.averageRating || 0) * 10) / 10,
    totalReviews: reviews.totalReviews,
    ratingDistribution: {
      5: reviews.rating5,
      4: reviews.rating4,
      3: reviews.rating3,
      2: reviews.rating2,
      1: reviews.rating1,
    },
    averageResponseTime: Math.round(averageResponseTime), // FIXED: Calculated from booking acceptance times
    views: service.searchMetadata.searchCount,
    clicks: service.searchMetadata.clickCount,
    conversionRate: Math.round(conversionRate * 100) / 100,
    revenueTrend,
    popularityScore,
  };
}

/**
 * Get analytics for multiple services (with ranking)
 */
export async function getServicesAnalytics(
  filters: ServiceAnalyticsFilters
): Promise<ServiceAnalyticsMetrics[]> {
  const { providerId, serviceIds, category, startDate, endDate, limit = 20 } = filters;

  // Build service query
  const serviceQuery: Record<string, unknown> = { isActive: true, isDeleted: false };
  if (providerId) {
    serviceQuery.providerId = new mongoose.Types.ObjectId(providerId);
  }
  if (serviceIds && serviceIds.length > 0) {
    serviceQuery._id = { $in: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  if (category) {
    serviceQuery.category = category;
  }

  const services = await Service.find(serviceQuery).select('_id name category').lean();
  const serviceIdsList = services.map((s) => s._id.toString());

  if (serviceIdsList.length === 0) {
    return [];
  }

  // Get analytics for each service in parallel
  const analyticsPromises = serviceIdsList.map((serviceId) =>
    getServiceAnalytics(serviceId, startDate, endDate)
  );

  const allAnalytics = await Promise.all(analyticsPromises);
  let analytics = allAnalytics.filter((a): a is ServiceAnalyticsMetrics => a !== null);

  // Add ranking based on revenue
  analytics = analytics
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map((a, index) => ({ ...a, rank: index + 1 }));

  // Apply limit
  return analytics.slice(0, limit);
}

/**
 * Get market averages for comparison
 */
export async function getMarketAverages(
  category?: string
): Promise<MarketAverages> {
  const matchStage: Record<string, unknown> = {
    isActive: true,
    isDeleted: false,
  };

  if (category) {
    matchStage.category = category;
  }

  // Get all active services
  const services = await Service.find(matchStage).select(
    '_id searchMetadata.rating searchMetadata.bookingCount'
  ).lean();

  if (services.length === 0) {
    return {
      averageRating: 0,
      averageRevenue: 0,
      averageConversionRate: 0,
      averageCompletionRate: 0,
      averageBookingValue: 0,
    };
  }

  const serviceIds = services.map((s) => s._id);

  // Get booking stats for all services
  const bookingStats = await Booking.aggregate([
    {
      $match: {
        serviceId: { $in: serviceIds },
        status: 'completed',
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalBookings: { $sum: 1 },
        totalCompleted: { $sum: 1 },
      },
    },
  ]);

  const totalStats = bookingStats[0] || { totalRevenue: 0, totalBookings: 0 };

  // Calculate averages
  const totalViews = services.reduce((sum, s) => sum + (s.searchMetadata?.searchCount || 0), 0);
  const totalClicks = services.reduce((sum, s) => sum + (s.searchMetadata?.clickCount || 0), 0);
  const totalRatings = services.reduce(
    (sum, s) => sum + ((s.searchMetadata as any)?.rating?.average || 0) * ((s.searchMetadata as any)?.rating?.count || 0),
    0
  );
  const totalReviewCount = services.reduce(
    (sum, s) => sum + ((s.searchMetadata as any)?.rating?.count || 0),
    0
  );

  return {
    averageRating: totalReviewCount > 0 ? Math.round((totalRatings / totalReviewCount) * 10) / 10 : 0,
    averageRevenue: Math.round(totalStats.totalRevenue / services.length),
    averageConversionRate: totalViews > 0 ? Math.round((totalStats.totalBookings / totalViews) * 10000) / 100 : 0,
    averageCompletionRate: 0, // Would need more complex query
    averageBookingValue:
      totalStats.totalBookings > 0
        ? Math.round(totalStats.totalRevenue / totalStats.totalBookings)
        : 0,
  };
}

/**
 * Get service comparison data (provider's services vs market)
 */
export async function getServiceComparison(
  providerId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  services: ServiceAnalyticsMetrics[];
  marketAverages: MarketAverages;
  trends: Record<string, { revenueTrend: number; bookingTrend: number }>;
}> {
  // Get analytics for provider's services
  const services = await getServicesAnalytics({
    providerId,
    startDate,
    endDate,
    limit: 50,
  });

  // Get market averages
  const marketAverages = await getMarketAverages();

  // Calculate trends (comparing current period to previous period)
  const previousStartDate = startDate ? new Date(startDate) : undefined;
  const previousEndDate = endDate ? new Date(endDate) : undefined;

  if (previousStartDate && previousEndDate) {
    const periodLength = previousEndDate.getTime() - previousStartDate.getTime();
    previousStartDate.setTime(previousStartDate.getTime() - periodLength);
    previousEndDate.setTime(previousEndDate.getTime() - periodLength);
  }

  const previousAnalytics = await getServicesAnalytics({
    providerId,
    startDate: previousStartDate,
    endDate: previousEndDate,
    limit: 50,
  });

  // Calculate trends for each service
  const trends: Record<string, { revenueTrend: number; bookingTrend: number }> = {};

  for (const service of services) {
    const previous = previousAnalytics.find((p) => p.serviceId === service.serviceId);
    if (previous) {
      trends[service.serviceId] = {
        revenueTrend: calculateTrend(service.totalRevenue, previous.totalRevenue),
        bookingTrend: calculateTrend(service.totalBookings, previous.totalBookings),
      };
    } else {
      trends[service.serviceId] = { revenueTrend: 100, bookingTrend: 100 };
    }
  }

  return { services, marketAverages, trends };
}

/**
 * Get top performing services
 */
export async function getTopPerformingServices(
  providerId: string,
  limit: number = 5,
  sortBy: 'revenue' | 'bookings' | 'rating' | 'conversion' = 'revenue',
  startDate?: Date,
  endDate?: Date
): Promise<ServiceAnalyticsMetrics[]> {
  const services = await getServicesAnalytics({
    providerId,
    startDate,
    endDate,
    limit: 100,
  });

  // Sort by the requested field
  const sorted = [...services].sort((a, b) => {
    switch (sortBy) {
      case 'revenue':
        return b.totalRevenue - a.totalRevenue;
      case 'bookings':
        return b.totalBookings - a.totalBookings;
      case 'rating':
        return b.averageRating - a.averageRating;
      case 'conversion':
        return b.conversionRate - a.conversionRate;
      default:
        return 0;
    }
  });

  return sorted.slice(0, limit);
}

/**
 * Get category breakdown
 */
export async function getCategoryBreakdown(
  providerId: string,
  startDate?: Date,
  endDate?: Date
): Promise<
  Array<{
    category: string;
    services: number;
    totalRevenue: number;
    totalBookings: number;
    averageRating: number;
  }>
> {
  const services = await getServicesAnalytics({
    providerId,
    startDate,
    endDate,
    limit: 100,
  });

  // Group by category
  const categoryMap = new Map<
    string,
    {
      services: number;
      totalRevenue: number;
      totalBookings: number;
      ratingSum: number;
      ratingCount: number;
    }
  >();

  for (const service of services) {
    const existing = categoryMap.get(service.category) || {
      services: 0,
      totalRevenue: 0,
      totalBookings: 0,
      ratingSum: 0,
      ratingCount: 0,
    };

    categoryMap.set(service.category, {
      services: existing.services + 1,
      totalRevenue: existing.totalRevenue + service.totalRevenue,
      totalBookings: existing.totalBookings + service.totalBookings,
      ratingSum: existing.ratingSum + service.averageRating * service.totalReviews,
      ratingCount: existing.ratingCount + service.totalReviews,
    });
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      services: data.services,
      totalRevenue: data.totalRevenue,
      totalBookings: data.totalBookings,
      averageRating:
        data.ratingCount > 0 ? Math.round((data.ratingSum / data.ratingCount) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Service Analytics Service Class
 */
export class ServiceAnalyticsService {
  /**
   * Get complete analytics for a service
   */
  async getServiceMetrics(
    serviceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ServiceAnalyticsMetrics | null> {
    return getServiceAnalytics(serviceId, startDate, endDate);
  }

  /**
   * Get all services analytics with filters
   */
  async getAllServicesMetrics(filters: ServiceAnalyticsFilters): Promise<ServiceAnalyticsMetrics[]> {
    return getServicesAnalytics(filters);
  }

  /**
   * Get market comparison data
   */
  async getMarketComparison(
    providerId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    services: ServiceAnalyticsMetrics[];
    marketAverages: MarketAverages;
    trends: Record<string, { revenueTrend: number; bookingTrend: number }>;
  }> {
    return getServiceComparison(providerId, startDate, endDate);
  }

  /**
   * Get top services by various metrics
   */
  async getTopServices(
    providerId: string,
    limit?: number,
    sortBy?: 'revenue' | 'bookings' | 'rating' | 'conversion',
    startDate?: Date,
    endDate?: Date
  ): Promise<ServiceAnalyticsMetrics[]> {
    return getTopPerformingServices(providerId, limit, sortBy, startDate, endDate);
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(
    providerId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      category: string;
      services: number;
      totalRevenue: number;
      totalBookings: number;
      averageRating: number;
    }>
  > {
    return getCategoryBreakdown(providerId, startDate, endDate);
  }

  /**
   * Get revenue trend for a specific period
   */
  async getRevenueTrend(
    serviceId: string,
    days: number = 30
  ): Promise<Array<{ date: string; revenue: number; bookings: number }>> {
    return getRevenueTrend(serviceId, days);
  }

  /**
   * Get overall summary stats
   */
  async getSummaryStats(
    providerId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalServices: number;
    totalRevenue: number;
    totalBookings: number;
    averageRating: number;
    averageConversionRate: number;
    topService: ServiceAnalyticsMetrics | null;
  }> {
    const services = await getServicesAnalytics({
      providerId,
      startDate,
      endDate,
      limit: 100,
    });

    if (services.length === 0) {
      return {
        totalServices: 0,
        totalRevenue: 0,
        totalBookings: 0,
        averageRating: 0,
        averageConversionRate: 0,
        topService: null,
      };
    }

    const totalRevenue = services.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalBookings = services.reduce((sum, s) => sum + s.totalBookings, 0);
    const totalViews = services.reduce((sum, s) => sum + s.views, 0);
    const totalRatingSum = services.reduce(
      (sum, s) => sum + s.averageRating * s.totalReviews,
      0
    );
    const totalReviewCount = services.reduce((sum, s) => sum + s.totalReviews, 0);

    const topService = services.reduce((top, s) =>
      !top || s.totalRevenue > top.totalRevenue ? s : top
    );

    return {
      totalServices: services.length,
      totalRevenue,
      totalBookings,
      averageRating:
        totalReviewCount > 0 ? Math.round((totalRatingSum / totalReviewCount) * 10) / 10 : 0,
      averageConversionRate:
        totalViews > 0 ? Math.round((totalBookings / totalViews) * 10000) / 100 : 0,
      topService,
    };
  }
}

// Export singleton instance
export const serviceAnalyticsService = new ServiceAnalyticsService();
