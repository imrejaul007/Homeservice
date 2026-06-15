import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import type { ProviderAnalyticsData, TrendResult } from './analytics.service';
import {
  buildTimeSeries,
  buildCityBookingFilter,
  COMMISSION_RATE,
  getBookingRequestCount,
  getConfirmedBookingCount,
  getNetMultiplier,
  getNetRevenueForPeriod,
  getProviderConversionFunnel,
  getProviderPeriodDates,
  getProviderReviewStats,
  PLATFORM_FEE_RATE,
  REFUND_AWARE_GROSS_ADD_FIELDS,
  sumDailyMetricInRange,
} from './providerMetrics.shared';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface ProviderInsightsOptions {
  revenue?: 'net' | 'gross';
  city?: string;
}

function resolveDataQuality(
  listingImpressions?: Array<{ date?: Date }>,
  profileViews?: Array<{ date?: Date }>,
): { trackingSince: string | null; level: 'full' | 'bookings_only' } {
  const dates: number[] = [];
  for (const entry of [...(listingImpressions || []), ...(profileViews || [])]) {
    if (entry?.date) dates.push(new Date(entry.date).getTime());
  }

  const trackingSince = dates.length
    ? new Date(Math.min(...dates)).toISOString()
    : null;
  const level = (listingImpressions?.length || 0) > 0 ? 'full' : 'bookings_only';

  return { trackingSince, level };
}

export function calcTrendDisplay(current: number, previous: number): TrendResult {
  if (current === 0 && previous === 0) {
    return { value: null, label: 'none' };
  }
  if (previous === 0 && current > 0) {
    return { value: null, label: 'new' };
  }
  return {
    value: Math.round(((current - previous) / previous) * 1000) / 10,
    label: 'percent',
  };
}

export { getProviderConversionFunnel };

/**
 * Provider analytics dashboard — real data for /provider/analytics page.
 */
export async function getProviderInsightsAnalytics(
  providerId: string,
  period: '7d' | '30d' | '90d' = '30d',
  options: ProviderInsightsOptions = {},
): Promise<ProviderAnalyticsData> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new Error('Invalid provider ID');
  }

  const revenueMode = options.revenue ?? 'net';
  const cityFilter = buildCityBookingFilter(options.city);
  const providerObjectId = new mongoose.Types.ObjectId(providerId);
  const { now, startDate, previousStartDate } = getProviderPeriodDates(period);
  const netMultiplier = getNetMultiplier();

  const [services, providerProfile] = await Promise.all([
    Service.find({ providerId: providerObjectId })
      .select('name searchMetadata rating')
      .lean(),
    ProviderProfile.findOne({ userId: providerObjectId })
      .select('analytics.profileViews analytics.listingImpressions reviewsData')
      .lean(),
  ]);

  const listingImpressionEntries = providerProfile?.analytics?.listingImpressions;
  const profileViewEntries = providerProfile?.analytics?.profileViews;

  const totalViewsAllTime = services.reduce(
    (sum, s) => sum + (s.searchMetadata?.searchCount || 0),
    0,
  );
  const impressionsCurrentRaw = sumDailyMetricInRange(
    listingImpressionEntries,
    startDate,
    now,
    'impressions',
  );
  const impressionsPreviousRaw = sumDailyMetricInRange(
    listingImpressionEntries,
    previousStartDate,
    startDate,
    'impressions',
  );
  const impressionsCurrentUnique = sumDailyMetricInRange(
    listingImpressionEntries,
    startDate,
    now,
    'uniqueImpressions',
  );
  const impressionsPreviousUnique = sumDailyMetricInRange(
    listingImpressionEntries,
    previousStartDate,
    startDate,
    'uniqueImpressions',
  );
  const impressionsCurrent =
    impressionsCurrentUnique > 0 ? impressionsCurrentUnique : impressionsCurrentRaw;
  const impressionsPrevious =
    impressionsPreviousUnique > 0 ? impressionsPreviousUnique : impressionsPreviousRaw;

  const profileViewsCurrent = sumDailyMetricInRange(
    profileViewEntries,
    startDate,
    now,
    'uniqueViews',
  );
  const profileViewsPrevious = sumDailyMetricInRange(
    profileViewEntries,
    previousStartDate,
    startDate,
    'uniqueViews',
  );

  const bookingMatchCurrent = {
    providerId: providerObjectId,
    createdAt: { $gte: startDate, $lte: now },
    ...cityFilter,
  };

  const completedMatchCurrent = {
    providerId: providerObjectId,
    status: 'completed',
    completedAt: { $gte: startDate, $lte: now },
    ...cityFilter,
  };

  const [
    statusBreakdown,
    bookingRequestsCurrent,
    bookingRequestsPrevious,
    confirmedCurrent,
    confirmedPrevious,
    earningsCurrent,
    earningsPrevious,
    topServicesData,
    weeklyByDayOfWeek,
    dailyLast7,
    dailyTimeSeriesRaw,
    dailyTimeSeriesPreviousRaw,
    reviewStats,
  ] = await Promise.all([
    Booking.aggregate([
      { $match: bookingMatchCurrent },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    getBookingRequestCount(providerObjectId, startDate, now, cityFilter),
    getBookingRequestCount(providerObjectId, previousStartDate, startDate, cityFilter),
    getConfirmedBookingCount(providerObjectId, startDate, now, undefined, cityFilter),
    getConfirmedBookingCount(providerObjectId, previousStartDate, startDate, undefined, cityFilter),
    getNetRevenueForPeriod(providerObjectId, startDate, now, cityFilter),
    getNetRevenueForPeriod(providerObjectId, previousStartDate, startDate, cityFilter),
    Booking.aggregate([
      { $match: completedMatchCurrent },
      { $addFields: REFUND_AWARE_GROSS_ADD_FIELDS },
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
          grossRevenue: { $sum: '$refundAdjustedGross' },
        },
      },
      { $sort: { grossRevenue: -1 } },
      { $limit: 5 },
    ]),
    Booking.aggregate([
      { $match: completedMatchCurrent },
      { $addFields: REFUND_AWARE_GROSS_ADD_FIELDS },
      {
        $group: {
          _id: { $dayOfWeek: '$completedAt' },
          bookings: { $sum: 1 },
          grossRevenue: { $sum: '$refundAdjustedGross' },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: 'completed',
          completedAt: {
            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            $lte: now,
          },
          ...cityFilter,
        },
      },
      { $addFields: REFUND_AWARE_GROSS_ADD_FIELDS },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
          },
          bookings: { $sum: 1 },
          grossRevenue: { $sum: '$refundAdjustedGross' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: completedMatchCurrent },
      { $addFields: REFUND_AWARE_GROSS_ADD_FIELDS },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
          },
          bookings: { $sum: 1 },
          grossRevenue: { $sum: '$refundAdjustedGross' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: 'completed',
          completedAt: { $gte: previousStartDate, $lt: startDate },
          ...cityFilter,
        },
      },
      { $addFields: REFUND_AWARE_GROSS_ADD_FIELDS },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
          },
          bookings: { $sum: 1 },
          grossRevenue: { $sum: '$refundAdjustedGross' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    getProviderReviewStats(providerId),
  ]);

  const statusMap = new Map<string, number>();
  statusBreakdown.forEach((row: { _id: string; count: number }) => {
    statusMap.set(row._id, row.count);
  });

  const pending = statusMap.get('pending') || 0;
  const completed = statusMap.get('completed') || 0;
  const cancelled = statusMap.get('cancelled') || 0;
  const total = Array.from(statusMap.values()).reduce((a, b) => a + b, 0);

  const grossPeriodEarnings = earningsCurrent.grossTotal;
  const grossPreviousPeriodEarnings = earningsPrevious.grossTotal;
  const periodEarnings = revenueMode === 'gross'
    ? grossPeriodEarnings
    : earningsCurrent.netTotal;
  const previousPeriodEarnings = revenueMode === 'gross'
    ? grossPreviousPeriodEarnings
    : earningsPrevious.netTotal;

  const grossEarnings = {
    thisMonth: Math.round(grossPeriodEarnings),
    lastMonth: Math.round(grossPreviousPeriodEarnings),
  };

  const platformFees = {
    thisMonth: Math.round(grossPeriodEarnings * PLATFORM_FEE_RATE * 100) / 100,
    lastMonth: Math.round(grossPreviousPeriodEarnings * PLATFORM_FEE_RATE * 100) / 100,
  };

  const bookingRate =
    profileViewsCurrent > 0
      ? Math.round((bookingRequestsCurrent / profileViewsCurrent) * 10000) / 100
      : 0;
  const prevBookingRate =
    profileViewsPrevious > 0
      ? Math.round((bookingRequestsPrevious / profileViewsPrevious) * 10000) / 100
      : 0;

  const confirmedBookingRate =
    profileViewsCurrent > 0
      ? Math.round((confirmedCurrent / profileViewsCurrent) * 10000) / 100
      : 0;
  const prevConfirmedBookingRate =
    profileViewsPrevious > 0
      ? Math.round((confirmedPrevious / profileViewsPrevious) * 10000) / 100
      : 0;

  const dataQuality = resolveDataQuality(
    listingImpressionEntries,
    profileViewEntries,
  );

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
    weeklyData = Array.from(dayMap.entries()).map(([dateKey, data]) => {
      const d = new Date(`${dateKey}T12:00:00`);
      return {
        day: DAY_NAMES[d.getDay()],
        bookings: data.bookings,
        revenue: revenueMode === 'gross'
          ? Math.round(data.grossRevenue)
          : Math.round(data.grossRevenue * netMultiplier),
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
        revenue: revenueMode === 'gross'
          ? Math.round(data.grossRevenue)
          : Math.round(data.grossRevenue * netMultiplier),
        grossRevenue: Math.round(data.grossRevenue),
      };
    });
  }

  const timeSeries = buildTimeSeries(
    period,
    now,
    startDate,
    dailyTimeSeriesRaw as Array<{ _id: string; bookings: number; grossRevenue: number }>,
    netMultiplier,
    revenueMode,
  );

  const previousEnd = new Date(startDate.getTime() - 1);
  const timeSeriesPrevious = buildTimeSeries(
    period,
    previousEnd,
    previousStartDate,
    dailyTimeSeriesPreviousRaw as Array<{ _id: string; bookings: number; grossRevenue: number }>,
    netMultiplier,
    revenueMode,
  );

  const dist = reviewStats.ratingDistribution || {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  return {
    overview: {
      totalViews: impressionsCurrent,
      totalViewsAllTime,
      viewsTrend: calcTrendDisplay(impressionsCurrent, impressionsPrevious),
      profileViews: profileViewsCurrent,
      profileViewsTrend: calcTrendDisplay(profileViewsCurrent, profileViewsPrevious),
      bookingRequests: bookingRequestsCurrent,
      bookingRequestsTrend: calcTrendDisplay(
        bookingRequestsCurrent,
        bookingRequestsPrevious,
      ),
      conversionRate: bookingRate,
      conversionRateTrend: calcTrendDisplay(bookingRate, prevBookingRate),
      confirmedBookingRate,
      confirmedBookingRateTrend: calcTrendDisplay(confirmedBookingRate, prevConfirmedBookingRate),
      dataQuality,
    },
    earnings: {
      thisMonth: Math.round(periodEarnings),
      lastMonth: Math.round(previousPeriodEarnings),
      trend: calcTrendDisplay(periodEarnings, previousPeriodEarnings),
      grossEarnings,
      platformFees,
      commissionRate: COMMISSION_RATE,
      platformFeeRate: PLATFORM_FEE_RATE,
      revenueMode,
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
        revenue: Math.round(s.grossRevenue * netMultiplier),
        grossRevenue: Math.round(s.grossRevenue),
      }),
    ),
    weeklyData,
    timeSeries,
    timeSeriesPrevious,
    metadata: {
      dateFields: {
        revenue: 'completedAt',
        bookingRequests: 'createdAt',
        profileViews: 'uniqueViews',
        listingImpressions: 'dailyBuckets',
      },
      revenueMode,
      cityFilter: options.city || null,
    },
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
