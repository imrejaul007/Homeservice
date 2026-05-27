import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import Review from '../models/review.model';
import type { ProviderAnalyticsData } from './analytics.service';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function calcTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function getPeriodDates(period: '7d' | '30d' | '90d') {
  const now = new Date();
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(
    startDate.getTime() - days * 24 * 60 * 60 * 1000,
  );
  return { now, startDate, previousStartDate, days };
}

function sumProfileViewsInRange(
  entries: Array<{ date?: Date; views?: number }> | undefined,
  start: Date,
  end: Date,
): number {
  if (!entries?.length) return 0;
  return entries.reduce((sum, entry) => {
    if (!entry?.date) return sum;
    const d = new Date(entry.date);
    if (d >= start && d <= end) {
      return sum + (entry.views || 0);
    }
    return sum;
  }, 0);
}

/**
 * Provider analytics dashboard — real data for /provider/analytics page.
 */
export async function getProviderInsightsAnalytics(
  providerId: string,
  period: '7d' | '30d' | '90d' = '30d',
): Promise<ProviderAnalyticsData> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new Error('Invalid provider ID');
  }

  const providerObjectId = new mongoose.Types.ObjectId(providerId);
  const { now, startDate, previousStartDate } = getPeriodDates(period);

  const [services, providerProfile] = await Promise.all([
    Service.find({ providerId: providerObjectId })
      .select('name searchMetadata rating')
      .lean(),
    ProviderProfile.findOne({ userId: providerObjectId })
      .select('analytics.profileViews reviewsData')
      .lean(),
  ]);

  const serviceImpressions = services.reduce(
    (sum, s) => sum + (s.searchMetadata?.searchCount || 0),
    0,
  );
  const serviceClicks = services.reduce(
    (sum, s) => sum + (s.searchMetadata?.clickCount || 0),
    0,
  );

  const profileViewEntries = providerProfile?.analytics?.profileViews as
    | Array<{ date?: Date; views?: number }>
    | undefined;
  const profileViewsCurrent = sumProfileViewsInRange(
    profileViewEntries,
    startDate,
    now,
  );
  const profileViewsPrevious = sumProfileViewsInRange(
    profileViewEntries,
    previousStartDate,
    startDate,
  );

  const bookingMatchCurrent = {
    providerId: providerObjectId,
    createdAt: { $gte: startDate, $lte: now },
  };
  const bookingMatchPrevious = {
    providerId: providerObjectId,
    createdAt: { $gte: previousStartDate, $lt: startDate },
  };

  const [
    statusBreakdown,
    bookingRequestsCurrent,
    bookingRequestsPrevious,
    earningsCurrent,
    earningsPrevious,
    topServicesData,
    weeklyByDayOfWeek,
    dailyLast7,
    reviewStats,
  ] = await Promise.all([
    Booking.aggregate([
      { $match: bookingMatchCurrent },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.countDocuments(bookingMatchCurrent),
    Booking.countDocuments(bookingMatchPrevious),
    Booking.aggregate([
      {
        $match: {
          ...bookingMatchCurrent,
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalAmount' },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          ...bookingMatchPrevious,
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalAmount' },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: 'completed',
          createdAt: { $gte: startDate, $lte: now },
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
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$serviceId',
          name: { $first: '$service.name' },
          bookings: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: 'completed',
          createdAt: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          bookings: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: 'completed',
          createdAt: {
            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    (Review as any).getProviderStats(providerId),
  ]);

  const statusMap = new Map<string, number>();
  statusBreakdown.forEach((row: { _id: string; count: number }) => {
    statusMap.set(row._id, row.count);
  });

  const pending = statusMap.get('pending') || 0;
  const completed = statusMap.get('completed') || 0;
  const cancelled = statusMap.get('cancelled') || 0;
  const total = Array.from(statusMap.values()).reduce((a, b) => a + b, 0);

  const periodEarnings = earningsCurrent[0]?.total || 0;
  const previousPeriodEarnings = earningsPrevious[0]?.total || 0;

  const bookingRate =
    serviceClicks > 0
      ? Math.round((bookingRequestsCurrent / serviceClicks) * 10000) / 100
      : 0;
  const prevBookingRate =
    serviceClicks > 0
      ? Math.round((bookingRequestsPrevious / serviceClicks) * 10000) / 100
      : 0;

  let weeklyData: Array<{ day: string; bookings: number; revenue: number }>;

  if (period === '7d') {
    const dayMap = new Map<string, { bookings: number; revenue: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { bookings: 0, revenue: 0 });
    }
    dailyLast7.forEach((row: { _id: string; bookings: number; revenue: number }) => {
      if (dayMap.has(row._id)) {
        dayMap.set(row._id, { bookings: row.bookings, revenue: row.revenue });
      }
    });
    weeklyData = Array.from(dayMap.entries()).map(([dateKey, data]) => {
      const d = new Date(`${dateKey}T12:00:00`);
      return {
        day: DAY_NAMES[d.getDay()],
        bookings: data.bookings,
        revenue: Math.round(data.revenue),
      };
    });
  } else {
    const weeklyMap = new Map<number, { bookings: number; revenue: number }>();
    weeklyByDayOfWeek.forEach(
      (row: { _id: number; bookings: number; revenue: number }) => {
        weeklyMap.set(row._id, { bookings: row.bookings, revenue: row.revenue });
      },
    );
    weeklyData = DAY_NAMES.map((day, index) => {
      const dayNum = index + 1;
      const data = weeklyMap.get(dayNum) || { bookings: 0, revenue: 0 };
      return {
        day,
        bookings: data.bookings,
        revenue: Math.round(data.revenue),
      };
    });
  }

  const dist = reviewStats.ratingDistribution || {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  return {
    overview: {
      totalViews: serviceImpressions,
      viewsTrend: calcTrend(bookingRequestsCurrent, bookingRequestsPrevious),
      profileViews: profileViewsCurrent,
      profileViewsTrend: calcTrend(profileViewsCurrent, profileViewsPrevious),
      bookingRequests: bookingRequestsCurrent,
      bookingRequestsTrend: calcTrend(
        bookingRequestsCurrent,
        bookingRequestsPrevious,
      ),
      conversionRate: bookingRate,
      conversionRateTrend: calcTrend(bookingRate, prevBookingRate),
    },
    earnings: {
      thisMonth: Math.round(periodEarnings),
      lastMonth: Math.round(previousPeriodEarnings),
      trend: calcTrend(periodEarnings, previousPeriodEarnings),
    },
    bookings: {
      total,
      completed,
      pending,
      cancelled,
    },
    topServices: topServicesData.map(
      (s: { name?: string; bookings: number; revenue: number }) => ({
        name: s.name || 'Unknown Service',
        bookings: s.bookings,
        revenue: Math.round(s.revenue),
      }),
    ),
    weeklyData,
    ratings: {
      average: reviewStats.averageRating || 0,
      total: reviewStats.totalReviews || 0,
      breakdown: {
        5: dist[5] || 0,
        4: dist[4] || 0,
        3: dist[3] || 0,
        2: dist[2] || 0,
        1: dist[1] || 0,
      },
    },
  };
}
