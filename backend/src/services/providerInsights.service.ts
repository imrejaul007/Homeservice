import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// ============================================
// INTERFACES
// ============================================

export interface ProviderInsight {
  id: string;
  type: 'performance' | 'revenue' | 'scheduling' | 'customer';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionItems: string[];
  generatedAt: Date;
  data?: Record<string, any>;
}

export interface PerformanceMetrics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  pendingBookings: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  averageRating: number;
  totalReviews: number;
  responseRate: number;
  averageResponseTime: number; // in minutes
  repeatCustomerRate: number;
  period: string;
}

export interface RevenueMetrics {
  totalRevenue: number;
  averageBookingValue: number;
  revenueGrowth: number; // percentage
  revenueByDay: Array<{ date: string; amount: number; count: number }>;
  revenueByService: Array<{ serviceId: string; serviceName: string; revenue: number; count: number }>;
  peakRevenueHour: number;
  projectedMonthlyRevenue: number;
  period: string;
}

export interface CustomerSatisfactionMetrics {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  recentTrend: Array<{ period: string; averageRating: number; count: number }>;
  positiveReviewPercentage: number;
  negativeReviewPercentage: number;
  commonPraise: string[];
  commonComplaints: string[];
  period: string;
}

export interface BookingTrend {
  period: string;
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: number;
  averageValue: number;
}

export interface ProviderInsightsData {
  providerId: string;
  period: string;
  performance: PerformanceMetrics;
  revenue: RevenueMetrics;
  customerSatisfaction: CustomerSatisfactionMetrics;
  trends: BookingTrend[];
  insights: ProviderInsight[];
  generatedAt: Date;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getDateRange = (period: 'week' | 'month' | 'quarter' | 'year'): { startDate: Date; endDate: Date; previousStartDate: Date; previousEndDate: Date } => {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let startDate: Date;
  let previousStartDate: Date;
  let previousEndDate: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousEndDate = startDate;
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      previousStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      previousEndDate = new Date(now.getFullYear(), quarter * 3, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
      previousEndDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
  }

  return { startDate, endDate, previousStartDate, previousEndDate };
};

const getCached = async <T>(key: string, fetchFn: () => Promise<T>, ttl = 300): Promise<T> => {
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
};

// ============================================
// PERFORMANCE METRICS
// ============================================

export const getProviderPerformanceMetrics = async (
  providerId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<PerformanceMetrics> => {
  const cacheKey = `insights:performance:${providerId}:${period}`;
  const ttl = 300; // 5 minutes

  return getCached(cacheKey, async () => {
    const { startDate, endDate } = getDateRange(period);
    const providerObjectId = new Types.ObjectId(providerId);

    const [
      bookingStats,
      reviewStats,
      responseStats
    ] = await Promise.all([
      // Booking statistics
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      // Review statistics
      Service.aggregate([
        { $match: { providerId: providerObjectId } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating.average' },
            totalReviews: { $sum: '$rating.count' }
          }
        }
      ]),
      // Response time statistics (pending bookings)
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $in: ['pending', 'confirmed'] }
          }
        },
        {
          $project: {
            responseTime: {
              $divide: [
                { $subtract: ['$updatedAt', '$createdAt'] },
                60000 // Convert to minutes
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' },
            total: { $sum: 1 }
          }
        }
      ])
    ]);

    // Process booking stats
    const statsMap = new Map<string, number>();
    bookingStats.forEach((stat: any) => {
      statsMap.set(stat._id, stat.count);
    });

    const totalBookings = Array.from(statsMap.values()).reduce((sum, count) => sum + count, 0);
    const completedBookings = statsMap.get('completed') || 0;
    const cancelledBookings = statsMap.get('cancelled') || 0;
    const noShowBookings = statsMap.get('no_show') || 0;
    const pendingBookings = statsMap.get('pending') || 0;

    // Calculate repeat customer rate
    const repeatCustomers = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$customerId',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $count: 'total'
      }
    ]);

    const uniqueCustomers = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$customerId'
        }
      },
      {
        $count: 'total'
      }
    ]);

    const repeatCount = repeatCustomers[0]?.total || 0;
    const uniqueCount = uniqueCustomers[0]?.total || 0;
    const repeatCustomerRate = uniqueCount > 0 ? (repeatCount / uniqueCount) * 100 : 0;

    return {
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      pendingBookings,
      completionRate: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
      cancellationRate: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
      noShowRate: totalBookings > 0 ? (noShowBookings / totalBookings) * 100 : 0,
      averageRating: reviewStats[0]?.avgRating || 0,
      totalReviews: reviewStats[0]?.totalReviews || 0,
      responseRate: totalBookings > 0 ? ((completedBookings + cancelledBookings) / totalBookings) * 100 : 0,
      averageResponseTime: responseStats[0]?.avgResponseTime || 0,
      repeatCustomerRate,
      period
    };
  }, ttl);
};

// ============================================
// REVENUE METRICS
// ============================================

export const getProviderRevenueMetrics = async (
  providerId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<RevenueMetrics> => {
  const cacheKey = `insights:revenue:${providerId}:${period}`;
  const ttl = 300;

  return getCached(cacheKey, async () => {
    const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(period);
    const providerObjectId = new Types.ObjectId(providerId);

    const [
      currentRevenue,
      previousRevenue,
      revenueByDay,
      revenueByService,
      hourlyRevenue
    ] = await Promise.all([
      // Current period revenue
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]),
      // Previous period revenue for comparison
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: previousStartDate, $lte: previousEndDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.totalAmount' }
          }
        }
      ]),
      // Revenue by day
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
            amount: { $sum: '$pricing.totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Revenue by service
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service'
          }
        },
        { $unwind: '$service' },
        {
          $group: {
            _id: '$serviceId',
            serviceName: { $first: '$service.name' },
            revenue: { $sum: '$pricing.totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } }
      ]),
      // Peak revenue hour analysis
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $hour: '$completedAt' },
            revenue: { $sum: '$pricing.totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 1 }
      ])
    ]);

    const currentTotal = currentRevenue[0]?.total || 0;
    const currentCount = currentRevenue[0]?.count || 0;
    const previousTotal = previousRevenue[0]?.total || 0;
    const revenueGrowth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
    const peakHour = hourlyRevenue[0]?._id || 9;

    // Project monthly revenue
    const now = new Date();
    const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const daysPassed = now.getDate();
    const projectedMonthlyRevenue = currentTotal > 0 ? (currentTotal / daysPassed) * (now.getDate() + (now.getMonth() === 1 ? 28 : 30)) : 0;

    return {
      totalRevenue: currentTotal,
      averageBookingValue: currentCount > 0 ? currentTotal / currentCount : 0,
      revenueGrowth,
      revenueByDay: revenueByDay.map((d: any) => ({
        date: d._id,
        amount: d.amount,
        count: d.count
      })),
      revenueByService: revenueByService.map((s: any) => ({
        serviceId: s._id.toString(),
        serviceName: s.serviceName,
        revenue: s.revenue,
        count: s.count
      })),
      peakRevenueHour: peakHour,
      projectedMonthlyRevenue,
      period
    };
  }, ttl);
};

// ============================================
// CUSTOMER SATISFACTION METRICS
// ============================================

export const getCustomerSatisfactionMetrics = async (
  providerId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<CustomerSatisfactionMetrics> => {
  const cacheKey = `insights:satisfaction:${providerId}:${period}`;
  const ttl = 300;

  return getCached(cacheKey, async () => {
    const { startDate, endDate } = getDateRange(period);
    const providerObjectId = new Types.ObjectId(providerId);

    // Get all services for this provider
    const services = await Service.find({ providerId: providerObjectId }).select('_id').lean();
    const serviceIds = services.map(s => s._id);

    // Aggregate review data from services
    const reviewStats = await Service.aggregate([
      { $match: { providerId: providerObjectId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating.average' },
          totalReviews: { $sum: '$rating.count' },
          rating5: { $sum: '$rating.distribution.5' },
          rating4: { $sum: '$rating.distribution.4' },
          rating3: { $sum: '$rating.distribution.3' },
          rating2: { $sum: '$rating.distribution.2' },
          rating1: { $sum: '$rating.distribution.1' }
        }
      }
    ]);

    // Get reviews from completed bookings with review data
    const reviews = await Booking.find({
      providerId: providerObjectId,
      status: 'completed',
      'review.isReviewed': true,
      'review.createdAt': { $gte: startDate, $lte: endDate }
    })
      .select('review rating')
      .sort({ 'review.createdAt': -1 })
      .limit(50)
      .lean();

    // Calculate trend data (weekly breakdown)
    const trendData = await Service.aggregate([
      { $match: { providerId: providerObjectId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating.average' },
          totalReviews: { $sum: '$rating.count' }
        }
      }
    ]);

    // Analyze reviews for common praise and complaints
    const positiveKeywords = ['great', 'excellent', 'amazing', 'professional', 'friendly', 'recommend', 'best', 'perfect', 'clean', 'on time'];
    const negativeKeywords = ['late', 'rude', 'poor', 'bad', 'disappointed', 'expensive', 'dirty', 'unprofessional', 'cancelled', 'wait'];

    let positiveCount = 0;
    let negativeCount = 0;
    const praiseWords: string[] = [];
    const complaintWords: string[] = [];

    reviews.forEach((booking: any) => {
      const review = booking.review;
      if (!review) return;

      const comment = (review.comment || '').toLowerCase();
      const rating = review.rating || 0;
      if (rating >= 4) {
        positiveCount++;
        positiveKeywords.forEach(keyword => {
          if (comment.includes(keyword)) {
            praiseWords.push(keyword);
          }
        });
      } else if (rating <= 2) {
        negativeCount++;
        negativeKeywords.forEach(keyword => {
          if (comment.includes(keyword)) {
            complaintWords.push(keyword);
          }
        });
      }
    });

    const totalReviews = reviews.length || reviewStats[0]?.totalReviews || 0;
    const ratingDistribution = {
      5: reviewStats[0]?.rating5 || 0,
      4: reviewStats[0]?.rating4 || 0,
      3: reviewStats[0]?.rating3 || 0,
      2: reviewStats[0]?.rating2 || 0,
      1: reviewStats[0]?.rating1 || 0
    };

    // Count keyword occurrences
    const countOccurrences = (arr: string[]) => {
      const counts: Record<string, number> = {};
      arr.forEach(word => {
        counts[word] = (counts[word] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
    };

    return {
      averageRating: reviewStats[0]?.avgRating || 0,
      totalReviews,
      ratingDistribution,
      recentTrend: trendData.map((t: any) => ({
        period: 'Current',
        averageRating: t.avgRating || 0,
        count: t.totalReviews || 0
      })),
      positiveReviewPercentage: totalReviews > 0 ? (positiveCount / totalReviews) * 100 : 0,
      negativeReviewPercentage: totalReviews > 0 ? (negativeCount / totalReviews) * 100 : 0,
      commonPraise: countOccurrences(praiseWords),
      commonComplaints: countOccurrences(complaintWords),
      period
    };
  }, ttl);
};

// ============================================
// INSIGHTS GENERATION
// ============================================

export const generateProviderInsights = async (
  providerId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<ProviderInsight[]> => {
  const insights: ProviderInsight[] = [];
  const now = new Date();

  // Get all metrics for analysis
  const [performance, revenue, satisfaction] = await Promise.all([
    getProviderPerformanceMetrics(providerId, period),
    getProviderRevenueMetrics(providerId, period),
    getCustomerSatisfactionMetrics(providerId, period)
  ]);

  // 1. Performance Insights
  if (performance.cancellationRate > 20) {
    insights.push({
      id: `insight-high-cancellation-${now.getTime()}`,
      type: 'performance',
      title: 'High Cancellation Rate Detected',
      description: `Your cancellation rate of ${performance.cancellationRate.toFixed(1)}% is above the recommended threshold of 15%. High cancellation rates can negatively impact your search ranking and customer trust.`,
      impact: 'high',
      actionItems: [
        'Review your cancellation reasons - are there patterns?',
        'Consider implementing a deposit for new customers',
        'Send reminder messages 24 hours before appointments',
        'Make it easy for customers to reschedule instead of cancelling'
      ],
      generatedAt: now
    });
  }

  if (performance.noShowRate > 5) {
    insights.push({
      id: `insight-no-show-${now.getTime()}`,
      type: 'performance',
      title: 'Address No-Show Pattern',
      description: `Your no-show rate of ${performance.noShowRate.toFixed(1)}% indicates a need for better customer engagement before appointments.`,
      impact: 'high',
      actionItems: [
        'Send confirmation requests before appointments',
        'Implement a reminder system (SMS/email) 2-3 hours before',
        'Consider requiring a phone number for all bookings',
        'Offer instant booking confirmation with calendar sync'
      ],
      generatedAt: now
    });
  }

  if (performance.repeatCustomerRate > 30) {
    insights.push({
      id: `insight-loyalty-${now.getTime()}`,
      type: 'customer',
      title: 'Strong Customer Loyalty',
      description: `${performance.repeatCustomerRate.toFixed(1)}% of your customers return for additional services. This is above the industry average of 20%.`,
      impact: 'medium',
      actionItems: [
        'Consider implementing a loyalty rewards program',
        'Reach out to repeat customers with exclusive offers',
        'Ask satisfied customers to refer friends and family',
        'Create package deals for returning customers'
      ],
      generatedAt: now
    });
  }

  // 2. Revenue Insights
  if (revenue.revenueGrowth < -10) {
    insights.push({
      id: `insight-revenue-decline-${now.getTime()}`,
      type: 'revenue',
      title: 'Revenue Decline Alert',
      description: `Your revenue has decreased by ${Math.abs(revenue.revenueGrowth).toFixed(1)}% compared to the previous period. This may indicate pricing, visibility, or quality issues.`,
      impact: 'high',
      actionItems: [
        'Review your pricing compared to competitors',
        'Check your service ratings and respond to feedback',
        'Ensure your availability is up to date',
        'Consider adding new services to attract more customers',
        'Analyze which services have the highest demand'
      ],
      generatedAt: now
    });
  }

  if (revenue.averageBookingValue < 100) {
    insights.push({
      id: `insight-upsell-${now.getTime()}`,
      type: 'revenue',
      title: 'Upselling Opportunity',
      description: `Your average booking value of ${revenue.averageBookingValue.toFixed(0)} AED suggests opportunities to increase revenue per customer.`,
      impact: 'medium',
      actionItems: [
        'Offer add-on services during booking',
        'Create bundled service packages',
        'Train staff on upselling techniques',
        'Display premium service options prominently'
      ],
      generatedAt: now
    });
  }

  // 3. Customer Satisfaction Insights
  if (satisfaction.averageRating < 4.0 && satisfaction.totalReviews > 10) {
    insights.push({
      id: `insight-rating-warning-${now.getTime()}`,
      type: 'customer',
      title: 'Rating Below Target',
      description: `Your average rating of ${satisfaction.averageRating.toFixed(1)} is below the recommended 4.5 stars. Customers often filter out providers below 4.0 stars.`,
      impact: 'high',
      actionItems: [
        'Review recent negative feedback carefully',
        'Respond professionally to all reviews',
        'Follow up with recent customers to address concerns',
        'Focus on the most common complaints',
        'Consider additional training for your team'
      ],
      generatedAt: now
    });
  }

  if (satisfaction.commonComplaints.length > 0) {
    insights.push({
      id: `insight-complaints-${now.getTime()}`,
      type: 'customer',
      title: 'Common Customer Concerns',
      description: `Customers frequently mention: ${satisfaction.commonComplaints.join(', ')}. Addressing these issues can improve your rating.`,
      impact: 'medium',
      actionItems: satisfaction.commonComplaints.map(complaint =>
        `Address "${complaint}" concerns in your service delivery`
      ),
      generatedAt: now
    });
  }

  // 4. Scheduling Insights
  if (performance.pendingBookings > 10 && performance.responseRate < 50) {
    insights.push({
      id: `insight-response-time-${now.getTime()}`,
      type: 'scheduling',
      title: 'Improve Response Time',
      description: `You have ${performance.pendingBookings} pending bookings and a ${performance.responseRate.toFixed(0)}% response rate. Quick responses significantly increase booking conversion.`,
      impact: 'high',
      actionItems: [
        'Enable push notifications for new booking requests',
        'Set specific times to check and respond to requests',
        'Use the mobile app for instant notifications',
        'Consider auto-accept for certain time slots'
      ],
      generatedAt: now
    });
  }

  // 5. Growth Insights
  if (revenue.projectedMonthlyRevenue > revenue.totalRevenue * 1.5) {
    insights.push({
      id: `insight-growth-${now.getTime()}`,
      type: 'revenue',
      title: 'Strong Growth Trajectory',
      description: `Your current revenue pace projects ${revenue.projectedMonthlyRevenue.toFixed(0)} AED this month, up from ${revenue.totalRevenue.toFixed(0)} AED.`,
      impact: 'medium',
      actionItems: [
        'Consider expanding your availability',
        'Prepare for increased demand with extra supplies',
        'Schedule any maintenance during slower periods',
        'Hire additional help if needed'
      ],
      generatedAt: now
    });
  }

  // Sort by impact priority
  const impactOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return insights;
};

// ============================================
// TREND ANALYSIS
// ============================================

export const getBookingTrends = async (
  providerId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<BookingTrend[]> => {
  const cacheKey = `insights:trends:${providerId}:${period}`;
  const ttl = 300;

  return getCached(cacheKey, async () => {
    const { startDate, endDate } = getDateRange(period);
    const providerObjectId = new Types.ObjectId(providerId);

    let groupFormat: string;
    let sortOrder: 1 | -1 = 1;

    switch (period) {
      case 'week':
        groupFormat = '%Y-%m-%d';
        break;
      case 'month':
        groupFormat = '%Y-%W'; // Week number
        sortOrder = 1;
        break;
      case 'quarter':
        groupFormat = '%Y-%m';
        break;
      case 'year':
        groupFormat = '%Y-%m';
        break;
      default:
        groupFormat = '%Y-%m-%d';
    }

    const trends = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      },
      {
        $group: {
          _id: '$_id.period',
          bookings: {
            $sum: { $cond: [{ $eq: ['$_id.status', 'pending'] }, '$count', 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$_id.status', 'completed'] }, '$count', 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$_id.status', 'cancelled'] }, '$count', 0] }
          },
          revenue: { $sum: '$revenue' },
          totalCount: { $sum: '$count' }
        }
      },
      {
        $project: {
          period: '$_id',
          bookings: '$totalCount',
          completed: 1,
          cancelled: 1,
          revenue: 1,
          averageValue: {
            $cond: [{ $gt: ['$totalCount', 0] },
              { $divide: ['$revenue', '$totalCount'] },
              0
            ]
          }
        }
      },
      { $sort: { period: sortOrder } }
    ] as any[]);

    return trends;
  }, ttl);
};

// ============================================
// COMPREHENSIVE INSIGHTS DATA
// ============================================

export const getProviderInsights = async (
  providerId: string,
  period: 'week' | 'month' | 'quarter' | 'year' = 'month'
): Promise<ProviderInsightsData> => {
  const [performance, revenue, satisfaction, trends, insights] = await Promise.all([
    getProviderPerformanceMetrics(providerId, period),
    getProviderRevenueMetrics(providerId, period),
    getCustomerSatisfactionMetrics(providerId, period),
    getBookingTrends(providerId, period),
    generateProviderInsights(providerId, period)
  ]);

  return {
    providerId,
    period,
    performance,
    revenue,
    customerSatisfaction: satisfaction,
    trends,
    insights,
    generatedAt: new Date()
  };
};

// ============================================
// REVENUE OPTIMIZATION TIPS
// ============================================

export interface RevenueOptimizationTip {
  category: 'pricing' | 'volume' | 'efficiency' | 'retention';
  title: string;
  description: string;
  potentialImpact: number; // Estimated revenue increase percentage
  difficulty: 'easy' | 'medium' | 'hard';
  actionItems: string[];
}

export const getRevenueOptimizationTips = async (
  providerId: string
): Promise<RevenueOptimizationTip[]> => {
  const tips: RevenueOptimizationTip[] = [];
  const revenue = await getProviderRevenueMetrics(providerId, 'month');
  const performance = await getProviderPerformanceMetrics(providerId, 'month');

  // Pricing optimization
  if (revenue.averageBookingValue < 150) {
    tips.push({
      category: 'pricing',
      title: 'Increase Average Order Value',
      description: 'Your average booking value is below the platform average. Consider introducing premium service tiers or bundled packages.',
      potentialImpact: 15,
      difficulty: 'medium',
      actionItems: [
        'Create premium versions of your popular services',
        'Offer package deals (e.g., "Book 3, get 10% off")',
        'Add high-margin add-on services',
        'Review competitor pricing for market positioning'
      ]
    });
  }

  // Volume optimization
  if (revenue.peakRevenueHour >= 9 && revenue.peakRevenueHour <= 11) {
    tips.push({
      category: 'volume',
      title: 'Extend Peak Hours',
      description: `Most of your revenue comes from ${revenue.peakRevenueHour}:00 - ${revenue.peakRevenueHour + 3}:00. Consider promoting off-peak availability.`,
      potentialImpact: 20,
      difficulty: 'easy',
      actionItems: [
        'Add incentives for morning (7-9 AM) bookings',
        'Create a "Happy Hour" discount for afternoon slots',
        'Promote evening appointments on social media',
        'Consider weekend-only premium pricing'
      ]
    });
  }

  // Efficiency optimization
  if (performance.completionRate < 80) {
    tips.push({
      category: 'efficiency',
      title: 'Improve Booking Completion',
      description: `${(100 - performance.completionRate).toFixed(0)}% of your bookings don\'t complete. Reducing this can significantly increase revenue.`,
      potentialImpact: 25,
      difficulty: 'medium',
      actionItems: [
        'Send booking confirmations immediately',
        'Follow up with pending bookings within 1 hour',
        'Remove friction from the booking process',
        'Ensure your availability calendar is always up-to-date'
      ]
    });
  }

  // Retention optimization
  if (performance.repeatCustomerRate < 20) {
    tips.push({
      category: 'retention',
      title: 'Build Customer Loyalty',
      description: 'Only a small percentage of your customers return. Increasing retention is more cost-effective than acquiring new customers.',
      potentialImpact: 30,
      difficulty: 'medium',
      actionItems: [
        'Implement a loyalty points system',
        'Offer discounts to returning customers',
        'Create a referral program with rewards',
        'Send follow-up messages after service completion',
        'Remember customer preferences for personalization'
      ]
    });
  }

  // Default tip if no specific optimization identified
  if (tips.length === 0) {
    tips.push({
      category: 'volume',
      title: 'Expand Your Service Offerings',
      description: 'Consider adding complementary services to attract more customers and increase booking frequency.',
      potentialImpact: 10,
      difficulty: 'hard',
      actionItems: [
        'Survey customers about services they want',
        'Research popular services in your category',
        'Start with one new service per quarter',
        'Promote new services to existing customers'
      ]
    });
  }

  return tips.sort((a, b) => b.potentialImpact - a.potentialImpact);
};

// ============================================
// CLEAR CACHE
// ============================================

export const clearInsightsCache = async (providerId: string): Promise<void> => {
  try {
    const patterns = [
      `insights:performance:${providerId}:*`,
      `insights:revenue:${providerId}:*`,
      `insights:satisfaction:${providerId}:*`,
      `insights:trends:${providerId}:*`
    ];

    for (const pattern of patterns) {
      const keys = await cache.keys(pattern);
      if (keys.length > 0) {
        await cache.del(...keys);
      }
    }

    logger.info('Insights cache cleared', { providerId });
  } catch (error) {
    logger.error('Failed to clear insights cache', { error, providerId });
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  getProviderPerformanceMetrics,
  getProviderRevenueMetrics,
  getCustomerSatisfactionMetrics,
  getBookingTrends,
  getProviderInsights,
  generateProviderInsights,
  getRevenueOptimizationTips,
  clearInsightsCache
};
