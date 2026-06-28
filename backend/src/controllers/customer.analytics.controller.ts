import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Booking from '../models/booking.model';
import User from '../models/user.model';

function customerBookingFilter(userId: string) {
  const customerObjectId = new mongoose.Types.ObjectId(userId);
  return {
    $or: [
      { customerId: customerObjectId },
      { customerId: userId },
    ],
  };
}

export const getCustomerStats = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'customer') throw new ApiError(403, 'Only customers can access this data');
  const userId = user._id.toString();
  const bookingFilter = customerBookingFilter(userId);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalBookings,
    completedBookings,
    cancelledBookings,
    pendingBookings,
    recentBookings,
  ] = await Promise.all([
    Booking.countDocuments(bookingFilter),
    Booking.countDocuments({ ...bookingFilter, status: 'completed' }),
    Booking.countDocuments({ ...bookingFilter, status: 'cancelled' }),
    Booking.countDocuments({ ...bookingFilter, status: 'pending' }),
    Booking.find(bookingFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('serviceId', 'name')
      .populate('providerId', 'firstName lastName')
      .select('status serviceId providerId createdAt pricing.totalAmount'),
  ]);

  const completedWithPrice = await Booking.find({
    ...bookingFilter,
    status: 'completed',
  }).select('pricing.totalAmount');

  const totalSpent = completedWithPrice.reduce(
    (sum: number, b: any) => sum + (b.pricing?.totalAmount || 0),
    0
  );

  const last30DaysBookings = await Booking.countDocuments({
    ...bookingFilter,
    createdAt: { $gte: thirtyDaysAgo },
  });

  const last7DaysBookings = await Booking.countDocuments({
    ...bookingFilter,
    createdAt: { $gte: sevenDaysAgo },
  });

  const categoryStats = await Booking.aggregate([
    { $match: { ...bookingFilter, status: 'completed' } },
    {
      $lookup: {
        from: 'services',
        localField: 'serviceId',
        foreignField: '_id',
        as: 'serviceDoc',
      },
    },
    { $unwind: { path: '$serviceDoc', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$serviceDoc.category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  const [ratingStats, durationStats] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          ...bookingFilter,
          'review.rating': { $exists: true, $ne: null },
        },
      },
      { $group: { _id: null, avg: { $avg: '$review.rating' } } },
    ]),
    Booking.aggregate([
      { $match: { ...bookingFilter, status: 'completed' } },
      { $group: { _id: null, totalMinutes: { $sum: { $ifNull: ['$duration', 60] } } } },
    ]),
  ]);

  const averageRating = ratingStats[0]?.avg ? Math.round(ratingStats[0].avg * 10) / 10 : 0;
  const totalHours = durationStats[0]?.totalMinutes
    ? Math.round((durationStats[0].totalMinutes / 60) * 10) / 10
    : 0;

  res.json({
    success: true,
    data: {
      overview: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        pendingBookings,
        completionRate: totalBookings > 0
          ? Math.round((completedBookings / totalBookings) * 100)
          : 0,
        averageRating,
        totalHours,
      },
      spending: {
        totalSpent,
        averageOrderValue: completedBookings > 0
          ? Math.round(totalSpent / completedBookings)
          : 0,
      },
      activity: {
        last30Days: last30DaysBookings,
        last7Days: last7DaysBookings,
      },
      topCategories: categoryStats.map(c => ({
        category: c._id || 'Uncategorized',
        count: c.count,
      })),
      recentBookings: recentBookings.map((b: any) => ({
        id: b._id,
        status: b.status,
        service: (b.serviceId as any)?.name || 'Unknown Service',
        provider: (b.providerId as any)?.firstName || 'Unknown',
        date: b.createdAt,
        amount: b.pricing?.totalAmount || 0,
      })),
    },
  });
});

export const getCustomerAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'customer') throw new ApiError(403, 'Only customers can access this data');
  const userId = user._id.toString();
  const bookingFilter = customerBookingFilter(userId);

  const { period = 'month' } = req.query;

  let startDate = new Date();
  switch (period) {
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 1);
  }

  const monthlyStats = await Booking.aggregate([
    {
      $match: {
        ...bookingFilter,
        status: 'completed',
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
        spent: { $sum: '$pricing.totalAmount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const dayOfWeekStats = await Booking.aggregate([
    {
      $match: {
        ...bookingFilter,
        status: 'completed',
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dayOfWeek: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const timeOfDayStats = await Booking.aggregate([
    {
      $match: {
        ...bookingFilter,
        status: 'completed',
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lt: [{ $hour: '$createdAt' }, 12] }, then: 'morning' },
              { case: { $lt: [{ $hour: '$createdAt' }, 17] }, then: 'afternoon' },
              { case: { $lt: [{ $hour: '$createdAt' }, 21] }, then: 'evening' },
            ],
            default: 'night',
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      period,
      monthly: monthlyStats.map(m => ({
        year: m._id.year,
        month: m._id.month,
        bookings: m.count,
        spent: m.spent,
      })),
      dayOfWeek: dayOfWeekStats.map(d => ({
        day: d._id,
        bookings: d.count,
      })),
      timeOfDay: timeOfDayStats,
    },
  });
});

// ============================================
// Health Score Calculation
// ============================================

interface ScoreMetric {
  id: string;
  label: string;
  description: string;
  value: number;
  maxValue: number;
  weight: number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
}

interface HealthScoreData {
  overall: number;
  metrics: ScoreMetric[];
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  insights: string[];
  recommendations: string[];
}

export const getCustomerHealthScore = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'customer') throw new ApiError(403, 'Only customers can access health score data');
  const userId = user._id.toString();
  const bookingFilter = customerBookingFilter(userId);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    totalBookings,
    completedBookings,
    cancelledBookings,
    recentBookings,
    previousMonthBookings,
  ] = await Promise.all([
    Booking.countDocuments(bookingFilter),
    Booking.countDocuments({ ...bookingFilter, status: 'completed' }),
    Booking.countDocuments({ ...bookingFilter, status: 'cancelled' }),
    Booking.countDocuments({ ...bookingFilter, createdAt: { $gte: thirtyDaysAgo } }),
    Booking.countDocuments({
      ...bookingFilter,
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
    }),
  ]);

  const Review = mongoose.model('Review');
  const reviewsAgg = await Review.aggregate([
    { $match: { reviewerId: new mongoose.Types.ObjectId(userId), reviewerType: 'customer' } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        recentReviews: {
          $sum: {
            $cond: [{ $gte: ['$createdAt', thirtyDaysAgo] }, 1, 0],
          },
        },
      },
    },
  ]);

  const reviewsData = reviewsAgg[0] || { avgRating: 0, totalReviews: 0, recentReviews: 0 };

  const userDoc = await User.findById(userId).select('createdAt');
  const accountAgeMonths = userDoc
    ? Math.max(1, Math.floor((now.getTime() - new Date(userDoc.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : 1;

  const paymentReliability = totalBookings > 0
    ? ((completedBookings - cancelledBookings) / totalBookings) * 10
    : 10;

  const bookingFrequencyScore = Math.min(10, Math.log(totalBookings + 1) * 3);
  const satisfactionScore = Math.round((reviewsData.avgRating || 0) * 2 * 10) / 10;
  const recentActivityScore = Math.min(10, (recentBookings * 2) + (reviewsData.recentReviews * 1));
  const loyaltyScore = Math.min(10, Math.min(accountAgeMonths, 5) + (totalBookings > 0 ? 3 : 0));

  const bookingTrend = previousMonthBookings > 0
    ? Math.round(((recentBookings - previousMonthBookings) / previousMonthBookings) * 100)
    : recentBookings > 0 ? 100 : 0;

  const metrics: ScoreMetric[] = [
    {
      id: 'booking_frequency',
      label: 'Booking Frequency',
      description: 'How often you book services',
      value: Math.round(bookingFrequencyScore * 10) / 10,
      maxValue: 10,
      weight: 0.2,
      trend: bookingTrend >= 0 ? 'up' : 'down',
      trendValue: Math.abs(bookingTrend),
    },
    {
      id: 'satisfaction',
      label: 'Satisfaction Score',
      description: 'Based on your reviews and ratings',
      value: satisfactionScore,
      maxValue: 10,
      weight: 0.25,
      trend: reviewsData.recentReviews > 0 ? 'up' : 'neutral',
      trendValue: reviewsData.recentReviews,
    },
    {
      id: 'engagement',
      label: 'Engagement',
      description: 'Recent activity and interaction',
      value: Math.round(recentActivityScore * 10) / 10,
      maxValue: 10,
      weight: 0.2,
      trend: recentBookings > 0 ? 'up' : 'neutral',
      trendValue: recentBookings,
    },
    {
      id: 'payment_history',
      label: 'Payment Reliability',
      description: 'Payment history and disputes',
      value: Math.max(0, Math.round(paymentReliability * 10) / 10),
      maxValue: 10,
      weight: 0.2,
      trend: cancelledBookings === 0 ? 'up' : 'neutral',
      trendValue: 0,
    },
    {
      id: 'loyalty',
      label: 'Loyalty Tenure',
      description: 'How long you\'ve been a customer',
      value: Math.round(loyaltyScore * 10) / 10,
      maxValue: 10,
      weight: 0.15,
      trend: accountAgeMonths > 3 ? 'up' : 'neutral',
      trendValue: Math.min(accountAgeMonths * 2, 20),
    },
  ];

  const overallScore = metrics.reduce((sum, metric) => sum + (metric.value * metric.weight), 0);

  let tier: HealthScoreData['tier'];
  if (overallScore >= 90) tier = 'diamond';
  else if (overallScore >= 80) tier = 'platinum';
  else if (overallScore >= 70) tier = 'gold';
  else if (overallScore >= 50) tier = 'silver';
  else tier = 'bronze';

  const insights: string[] = [];
  if (overallScore >= 80) insights.push("You're in the top tier of customers!");
  if (satisfactionScore >= 8) insights.push('Your satisfaction score is exceptional');
  if (bookingFrequencyScore < 5) insights.push('Try booking more frequently to unlock better benefits');
  if (loyaltyScore >= 8) insights.push('Your loyalty is appreciated - thank you for being a regular!');
  if (totalBookings === 0) insights.push('Book your first service to start building your health score');

  const recommendations: string[] = [];
  if (reviewsData.totalReviews < completedBookings && completedBookings > 0) {
    recommendations.push('Leave reviews after each service to boost your score');
  }
  if (recentBookings === 0) recommendations.push('Book your next service to maintain your activity streak');
  if (bookingFrequencyScore < 5) {
    recommendations.push('Consider booking weekly or bi-weekly services for maximum benefits');
  }
  if (cancelledBookings > completedBookings * 0.2) {
    recommendations.push('Try to avoid last-minute cancellations to improve payment reliability');
  }
  if (totalBookings > 0 && totalBookings < 5) {
    recommendations.push('Explore new service categories to discover more providers');
  }

  res.json({
    success: true,
    data: {
      overall: Math.round(overallScore * 10) / 10,
      metrics,
      tier,
      insights: insights.slice(0, 3),
      recommendations: recommendations.slice(0, 4),
    },
  });
});

export default {
  getCustomerStats,
  getCustomerAnalytics,
  getCustomerHealthScore,
};
