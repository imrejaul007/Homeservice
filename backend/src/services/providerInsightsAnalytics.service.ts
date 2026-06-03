import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import Review from '../models/review.model';
import type { ProviderAnalyticsData } from './analytics.service';
import {
  DEFAULT_COMMISSION_CONFIG,
  DEFAULT_PLATFORM_FEE_CONFIG,
} from './settlement.service';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// Commission and platform fee rates for net earnings calculation
const COMMISSION_RATE = DEFAULT_COMMISSION_CONFIG.defaultRate;
const PLATFORM_FEE_RATE = DEFAULT_PLATFORM_FEE_CONFIG.type === 'percentage'
  ? DEFAULT_PLATFORM_FEE_CONFIG.value
  : 0;

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

  // FIX #1 & #2: Calculate earnings with commission and platform fee deductions
  // netEarnings = gross - commission - platformFee
  const totalDeductionRate = COMMISSION_RATE + PLATFORM_FEE_RATE;

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
    // FIX #1: Calculate NET earnings (gross minus commission minus platform fee)
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
          grossTotal: { $sum: '$pricing.totalAmount' },
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
          grossTotal: { $sum: '$pricing.totalAmount' },
        },
      },
    ]),
    // FIX #2: Calculate NET earnings for top services
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
          grossRevenue: { $sum: '$pricing.totalAmount' },
        },
      },
      { $sort: { grossRevenue: -1 } },
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
          grossRevenue: { $sum: '$pricing.totalAmount' },
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
          grossRevenue: { $sum: '$pricing.totalAmount' },
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

  // FIX #1: Calculate NET earnings (gross minus commission minus platform fee)
  const grossPeriodEarnings = earningsCurrent[0]?.grossTotal || 0;
  const grossPreviousPeriodEarnings = earningsPrevious[0]?.grossTotal || 0;
  const periodEarnings = Math.round(grossPeriodEarnings * (1 - totalDeductionRate) * 100) / 100;
  const previousPeriodEarnings = Math.round(grossPreviousPeriodEarnings * (1 - totalDeductionRate) * 100) / 100;

  // Calculate gross earnings for response
  const grossEarnings = {
    thisMonth: Math.round(grossPeriodEarnings),
    lastMonth: Math.round(grossPreviousPeriodEarnings),
  };

  // Calculate platform fees for the period
  const platformFees = {
    thisMonth: Math.round(grossPeriodEarnings * PLATFORM_FEE_RATE * 100) / 100,
    lastMonth: Math.round(grossPreviousPeriodEarnings * PLATFORM_FEE_RATE * 100) / 100,
  };

  const bookingRate =
    serviceClicks > 0
      ? Math.round((bookingRequestsCurrent / serviceClicks) * 10000) / 100
      : 0;
  const prevBookingRate =
    serviceClicks > 0
      ? Math.round((bookingRequestsPrevious / serviceClicks) * 10000) / 100
      : 0;

  let weeklyData: Array<{ day: string; bookings: number; revenue: number; grossRevenue: number }>;

  if (period === '7d') {
    const dayMap = new Map<string, { bookings: number; grossRevenue: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { bookings: 0, grossRevenue: 0 });
    }
    dailyLast7.forEach((row: { _id: string; bookings: number; grossRevenue: number }) => {
      if (dayMap.has(row._id)) {
        dayMap.set(row._id, { bookings: row.bookings, grossRevenue: row.grossRevenue });
      }
    });
    // FIX #1: Calculate NET revenue for weekly data (gross minus commission minus platform fee)
    weeklyData = Array.from(dayMap.entries()).map(([dateKey, data]) => {
      const d = new Date(`${dateKey}T12:00:00`);
      return {
        day: DAY_NAMES[d.getDay()],
        bookings: data.bookings,
        revenue: Math.round(data.grossRevenue * (1 - totalDeductionRate)),
        grossRevenue: Math.round(data.grossRevenue),
      };
    });
  } else {
    const weeklyMap = new Map<number, { bookings: number; grossRevenue: number }>();
    weeklyByDayOfWeek.forEach(
      (row: { _id: number; bookings: number; grossRevenue: number }) => {
        weeklyMap.set(row._id, { bookings: row.bookings, grossRevenue: row.grossRevenue });
      },
    );
    weeklyData = DAY_NAMES.map((day, index) => {
      const dayNum = index + 1;
      const data = weeklyMap.get(dayNum) || { bookings: 0, grossRevenue: 0 };
      return {
        day,
        bookings: data.bookings,
        // FIX #1: Calculate NET revenue (after deductions)
        revenue: Math.round(data.grossRevenue * (1 - totalDeductionRate)),
        grossRevenue: Math.round(data.grossRevenue),
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
    // FIX #1 & #2: Include gross earnings, net earnings, and platform fees in response
    earnings: {
      thisMonth: Math.round(periodEarnings),
      lastMonth: Math.round(previousPeriodEarnings),
      trend: calcTrend(periodEarnings, previousPeriodEarnings),
      grossEarnings: grossEarnings,
      platformFees: platformFees,
      commissionRate: COMMISSION_RATE,
      platformFeeRate: PLATFORM_FEE_RATE,
    },
    bookings: {
      total,
      completed,
      pending,
      cancelled,
    },
    topServices: topServicesData.map(
      (s: { name?: string; bookings: number; grossRevenue: number }) => ({
        name: s.name || 'Unknown Service',
        bookings: s.bookings,
        revenue: Math.round(s.grossRevenue * (1 - totalDeductionRate)),
        grossRevenue: Math.round(s.grossRevenue),
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
