import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import Booking from '../models/booking.model';
import User from '../models/user.model';

export const getCustomerStats = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = user._id.toString();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get bookings stats
  const [
    totalBookings,
    completedBookings,
    cancelledBookings,
    pendingBookings,
    recentBookings,
  ] = await Promise.all([
    Booking.countDocuments({ 'customer.userId': userId }),
    Booking.countDocuments({ 'customer.userId': userId, status: 'completed' }),
    Booking.countDocuments({ 'customer.userId': userId, status: 'cancelled' }),
    Booking.countDocuments({ 'customer.userId': userId, status: 'pending' }),
    Booking.find({ 'customer.userId': userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('status service.name provider.firstName createdAt pricing.totalAmount'),
  ]);

  // Spending stats
  const completedWithPrice = await Booking.find({
    'customer.userId': userId,
    status: 'completed',
  }).select('pricing.totalAmount');

  const totalSpent = completedWithPrice.reduce(
    (sum: number, b: any) => sum + (b.pricing?.totalAmount || 0),
    0
  );

  // Last 30 days stats
  const last30DaysBookings = await Booking.countDocuments({
    'customer.userId': userId,
    createdAt: { $gte: thirtyDaysAgo },
  });

  const last7DaysBookings = await Booking.countDocuments({
    'customer.userId': userId,
    createdAt: { $gte: sevenDaysAgo },
  });

  // Favorite categories (most booked)
  const categoryStats = await Booking.aggregate([
    { $match: { 'customer.userId': userId, status: 'completed' } },
    { $group: { _id: '$service.category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

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
        category: c._id,
        count: c.count,
      })),
      recentBookings: recentBookings.map((b: any) => ({
        id: b._id,
        status: b.status,
        service: b.service?.name || 'Unknown Service',
        provider: b.provider?.firstName || 'Unknown',
        date: b.createdAt,
        amount: b.pricing?.totalAmount || 0,
      })),
    },
  });
});

export const getCustomerAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = user._id.toString();

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

  // Monthly breakdown
  const monthlyStats = await Booking.aggregate([
    {
      $match: {
        'customer.userId': userId,
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

  // Day of week distribution
  const dayOfWeekStats = await Booking.aggregate([
    {
      $match: {
        'customer.userId': userId,
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

  // Time of day distribution
  const timeOfDayStats = await Booking.aggregate([
    {
      $match: {
        'customer.userId': userId,
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

export default {
  getCustomerStats,
  getCustomerAnalytics,
};
