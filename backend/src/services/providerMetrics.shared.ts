import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import ProviderFunnelDaily from '../models/providerFunnelDaily.model';
import Review from '../models/review.model';
import Service from '../models/service.model';
import { AnalyticsEventModel } from './eventStream.service';
import {
  DEFAULT_COMMISSION_CONFIG,
  DEFAULT_PLATFORM_FEE_CONFIG,
} from './settlement.service';

export const COMMISSION_RATE = DEFAULT_COMMISSION_CONFIG.defaultRate;
export const PLATFORM_FEE_RATE =
  DEFAULT_PLATFORM_FEE_CONFIG.type === 'percentage'
    ? DEFAULT_PLATFORM_FEE_CONFIG.value
    : 0;

export function getNetMultiplier(): number {
  return 1 - COMMISSION_RATE - PLATFORM_FEE_RATE;
}

/** Refund-adjusted gross revenue expression for aggregation pipelines */
export const REFUND_AWARE_GROSS_REVENUE_EXPR = {
  $subtract: [
    { $ifNull: ['$pricing.totalAmount', 0] },
    {
      $cond: [
        {
          $or: [
            { $eq: ['$payment.status', 'refunded'] },
            { $gt: [{ $ifNull: ['$payment.refundAmount', 0] }, 0] },
          ],
        },
        { $ifNull: ['$payment.refundAmount', '$pricing.totalAmount'] },
        0,
      ],
    },
  ],
};

export const REFUND_AWARE_GROSS_ADD_FIELDS = {
  refundAdjustedGross: REFUND_AWARE_GROSS_REVENUE_EXPR,
};

export function buildCityBookingFilter(city?: string): Record<string, unknown> {
  if (!city?.trim() || city.toLowerCase() === 'all') return {};
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { 'location.address.city': new RegExp(`^${escaped}$`, 'i') };
}

export function dashboardPeriodToInsightsPeriod(
  period: '7d' | '30d' | '90d',
): 'week' | 'month' | 'quarter' {
  if (period === '7d') return 'week';
  if (period === '90d') return 'quarter';
  return 'month';
}

export function getProviderPeriodDates(period: '7d' | '30d' | '90d') {
  const now = new Date();
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
  return { now, startDate, previousStartDate, days };
}

export function insightsPeriodToDays(period: 'week' | 'month' | 'quarter' | 'year'): number {
  switch (period) {
    case 'week':
      return 7;
    case 'month':
      return 30;
    case 'quarter':
      return 90;
    case 'year':
      return 365;
    default:
      return 30;
  }
}

export function getInsightsPeriodDates(period: 'week' | 'month' | 'quarter' | 'year') {
  const now = new Date();
  const days = insightsPeriodToDays(period);
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
  const previousEndDate = new Date(startDate.getTime() - 1);
  return { now, startDate, endDate: now, previousStartDate, previousEndDate, days };
}

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sumDailyMetricInRange(
  entries: Array<{ date?: Date; impressions?: number; uniqueImpressions?: number; uniqueViews?: number; views?: number }> | undefined,
  start: Date,
  end: Date,
  field: 'impressions' | 'uniqueImpressions' | 'uniqueViews' | 'views',
): number {
  if (!entries?.length) return 0;
  return entries.reduce((sum, entry) => {
    if (!entry?.date) return sum;
    const d = new Date(entry.date);
    if (d >= start && d <= end) {
      return sum + (entry[field] || 0);
    }
    return sum;
  }, 0);
}

interface AggregatedFunnelCounts {
  impressions: number;
  uniqueImpressions: number;
  profileViews: number;
  uniqueProfileViews: number;
  serviceViews: number;
  bookingRequests: number;
  bookingConfirmed: number;
  completed: number;
}

function emptyAggregatedFunnelCounts(): AggregatedFunnelCounts {
  return {
    impressions: 0,
    uniqueImpressions: 0,
    profileViews: 0,
    uniqueProfileViews: 0,
    serviceViews: 0,
    bookingRequests: 0,
    bookingConfirmed: 0,
    completed: 0,
  };
}

async function sumHistoricalFunnelDaily(
  providerId: mongoose.Types.ObjectId,
  startDate: Date,
  beforeDate: Date,
): Promise<AggregatedFunnelCounts> {
  const rows = await ProviderFunnelDaily.find({
    providerId,
    date: { $gte: startOfDay(startDate), $lt: startOfDay(beforeDate) },
  })
    .select('stages')
    .lean();

  const totals = emptyAggregatedFunnelCounts();
  for (const row of rows) {
    totals.impressions += row.stages?.impressions || 0;
    totals.uniqueImpressions += row.stages?.uniqueImpressions || 0;
    totals.profileViews += row.stages?.profileViews || 0;
    totals.uniqueProfileViews += row.stages?.uniqueProfileViews || 0;
    totals.serviceViews += row.stages?.serviceViews || 0;
    totals.bookingRequests += row.stages?.bookingRequests || 0;
    totals.bookingConfirmed += row.stages?.confirmed || 0;
    totals.completed += row.stages?.completed || 0;
  }

  return totals;
}

async function getTodayLiveFunnelCounts(
  providerId: string,
  providerObjectId: mongoose.Types.ObjectId,
  now: Date,
  profileData: {
    listingImpressions?: Array<{ date?: Date; impressions?: number; uniqueImpressions?: number }>;
    profileViews?: Array<{ date?: Date; uniqueViews?: number; views?: number }>;
  },
): Promise<AggregatedFunnelCounts> {
  const todayStart = startOfDay(now);

  const totals = emptyAggregatedFunnelCounts();
  totals.impressions = sumDailyMetricInRange(
    profileData.listingImpressions,
    todayStart,
    now,
    'impressions',
  );
  totals.uniqueImpressions = sumDailyMetricInRange(
    profileData.listingImpressions,
    todayStart,
    now,
    'uniqueImpressions',
  );
  totals.profileViews = sumDailyMetricInRange(
    profileData.profileViews,
    todayStart,
    now,
    'uniqueViews',
  );
  totals.uniqueProfileViews = totals.profileViews;

  const [serviceViews, bookingRequests, bookingConfirmed, completed] = await Promise.all([
    getServiceViewCount(providerId, todayStart, now),
    getBookingRequestCount(providerObjectId, todayStart, now),
    getConfirmedBookingCount(providerObjectId, todayStart, now),
    getCompletedBookingCount(providerObjectId, todayStart, now),
  ]);

  totals.serviceViews = serviceViews;
  totals.bookingRequests = bookingRequests;
  totals.bookingConfirmed = bookingConfirmed;
  totals.completed = completed;

  return totals;
}

export async function getGrossRevenueForPeriod(
  providerId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
  extraMatch: Record<string, unknown> = {},
): Promise<{ grossTotal: number; count: number }> {
  const result = await Booking.aggregate([
    {
      $match: {
        providerId,
        status: 'completed',
        completedAt: { $gte: start, $lte: end },
        ...extraMatch,
      },
    },
    {
      $addFields: {
        refundAmount: {
          $cond: [
            {
              $or: [
                { $eq: ['$payment.status', 'refunded'] },
                { $gt: [{ $ifNull: ['$payment.refundAmount', 0] }, 0] },
              ],
            },
            { $ifNull: ['$payment.refundAmount', '$pricing.totalAmount'] },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        grossTotal: {
          $sum: {
            $subtract: [
              { $ifNull: ['$pricing.totalAmount', 0] },
              '$refundAmount',
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    grossTotal: Math.max(0, result[0]?.grossTotal || 0),
    count: result[0]?.count || 0,
  };
}

export async function getNetRevenueForPeriod(
  providerId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
  extraMatch: Record<string, unknown> = {},
): Promise<{ netTotal: number; grossTotal: number; count: number }> {
  const { grossTotal, count } = await getGrossRevenueForPeriod(providerId, start, end, extraMatch);
  const netTotal = Math.round(grossTotal * getNetMultiplier() * 100) / 100;
  return { netTotal, grossTotal, count };
}

export async function getBookingRequestCount(
  providerId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
  extraMatch: Record<string, unknown> = {},
): Promise<number> {
  return Booking.countDocuments({
    providerId,
    createdAt: { $gte: start, $lte: end },
    ...extraMatch,
  });
}

export async function getCompletedBookingCount(
  providerId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
): Promise<number> {
  return Booking.countDocuments({
    providerId,
    status: 'completed',
    completedAt: { $gte: start, $lte: end },
  });
}

export async function getProviderReviewStats(providerId: string) {
  return (Review as any).getProviderStats(providerId);
}

export function buildTimeSeries(
  period: '7d' | '30d' | '90d',
  now: Date,
  startDate: Date,
  dailyRows: Array<{ _id: string; bookings: number; grossRevenue: number }>,
  netMultiplier: number,
  revenueMode: 'net' | 'gross' = 'net',
): Array<{ date: string; revenue: number; grossRevenue: number; bookings: number }> {
  const dayMap = new Map<string, { bookings: number; grossRevenue: number }>();
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { bookings: 0, grossRevenue: 0 });
  }

  dailyRows.forEach((row) => {
    if (dayMap.has(row._id)) {
      dayMap.set(row._id, { bookings: row.bookings, grossRevenue: row.grossRevenue });
    }
  });

  return Array.from(dayMap.entries())
    .filter(([dateKey]) => {
      const d = new Date(`${dateKey}T12:00:00`);
      return d >= startDate && d <= now;
    })
    .map(([date, data]) => {
      const grossRevenue = Math.round(data.grossRevenue);
      return {
        date,
        bookings: data.bookings,
        grossRevenue,
        revenue: revenueMode === 'gross'
          ? grossRevenue
          : Math.round(data.grossRevenue * netMultiplier),
      };
    });
}

export interface ConversionFunnelStage {
  id: string;
  label: string;
  count: number;
  rateFromPrevious: number | null;
}

export interface ProviderConversionFunnel {
  stages: ConversionFunnelStage[];
  overallConversionRate: number;
}

const SERVICE_VIEW_EVENT_TYPES = [
  'service.viewed',
  'service_view',
  'service.service_viewed',
  'booking.booking_start',
  'booking.provider_selected',
  'booking.service_booked',
];

const BOOKING_CONFIRMED_STATUSES = ['confirmed', 'in_progress', 'completed'] as const;

async function countProviderAnalyticsEvents(
  providerId: string,
  eventTypes: string[],
  start: Date,
  end: Date,
  serviceId?: string,
): Promise<number> {
  const match: Record<string, unknown> = {
    eventType: { $in: eventTypes },
    timestamp: { $gte: start, $lte: end },
    $or: [
      { 'properties.providerId': providerId },
      { 'properties.provider_id': providerId },
    ],
  };

  if (serviceId) {
    match.$and = [
      {
        $or: [
          { 'properties.serviceId': serviceId },
          { 'properties.service_id': serviceId },
        ],
      },
    ];
  }

  return AnalyticsEventModel.countDocuments(match);
}

async function getServiceViewCount(
  providerId: string,
  start: Date,
  end: Date,
  serviceId?: string,
): Promise<number> {
  const analyticsCount = await countProviderAnalyticsEvents(
    providerId,
    SERVICE_VIEW_EVENT_TYPES,
    start,
    end,
    serviceId,
  );

  if (analyticsCount > 0) {
    return analyticsCount;
  }

  const serviceQuery: Record<string, unknown> = {
    providerId: new mongoose.Types.ObjectId(providerId),
    isDeleted: { $ne: true },
  };
  if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
    serviceQuery._id = new mongoose.Types.ObjectId(serviceId);
  }

  const services = await Service.find(serviceQuery)
    .select('searchMetadata.clickCount')
    .lean();

  return services.reduce((sum, service) => sum + (service.searchMetadata?.clickCount || 0), 0);
}

export async function getConfirmedBookingCount(
  providerObjectId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
  serviceId?: string,
  extraMatch: Record<string, unknown> = {},
): Promise<number> {
  const query: Record<string, unknown> = {
    providerId: providerObjectId,
    status: { $in: [...BOOKING_CONFIRMED_STATUSES] },
    createdAt: { $gte: start, $lte: end },
    ...extraMatch,
  };

  if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
    query.serviceId = new mongoose.Types.ObjectId(serviceId);
  }

  return Booking.countDocuments(query);
}

async function getBookingRequestCountForService(
  providerObjectId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
  serviceId?: string,
): Promise<number> {
  const query: Record<string, unknown> = {
    providerId: providerObjectId,
    createdAt: { $gte: start, $lte: end },
  };

  if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
    query.serviceId = new mongoose.Types.ObjectId(serviceId);
  }

  return Booking.countDocuments(query);
}

async function getCompletedBookingCountForService(
  providerObjectId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
  serviceId?: string,
): Promise<number> {
  const query: Record<string, unknown> = {
    providerId: providerObjectId,
    status: 'completed',
    completedAt: { $gte: start, $lte: end },
  };

  if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
    query.serviceId = new mongoose.Types.ObjectId(serviceId);
  }

  return Booking.countDocuments(query);
}

function buildFunnelStages(
  rawStages: Array<{ id: string; label: string; count: number }>,
  denominatorCandidates: number[],
): ProviderConversionFunnel {
  const stages: ConversionFunnelStage[] = rawStages.map((stage, index) => {
    const previous = index > 0 ? rawStages[index - 1].count : null;
    const rateFromPrevious =
      previous && previous > 0 ? Math.round((stage.count / previous) * 10000) / 100 : null;
    return { ...stage, rateFromPrevious };
  });

  const denominator = denominatorCandidates.find((value) => value > 0) || 0;
  const completed = rawStages.find((stage) => stage.id === 'completed')?.count || 0;
  const overallConversionRate =
    denominator > 0 ? Math.round((completed / denominator) * 10000) / 100 : 0;

  return { stages, overallConversionRate };
}

export async function getProviderConversionFunnel(
  providerId: string,
  period: '7d' | '30d' | '90d',
  profileData: {
    listingImpressions?: Array<{ date?: Date; impressions?: number; uniqueImpressions?: number }>;
    profileViews?: Array<{ date?: Date; uniqueViews?: number; views?: number }>;
  },
): Promise<ProviderConversionFunnel> {
  const providerObjectId = new mongoose.Types.ObjectId(providerId);
  const { now, startDate } = getProviderPeriodDates(period);
  const todayStart = startOfDay(now);

  const historical = await sumHistoricalFunnelDaily(providerObjectId, startDate, todayStart);
  const today = await getTodayLiveFunnelCounts(providerId, providerObjectId, now, profileData);

  const listingImpressions = historical.impressions + today.impressions;
  const uniqueListingImpressions = historical.uniqueImpressions + today.uniqueImpressions;
  const profileViews = historical.uniqueProfileViews + today.profileViews;
  const serviceViews = historical.serviceViews + today.serviceViews;
  const bookingRequests = historical.bookingRequests + today.bookingRequests;
  const bookingConfirmed = historical.bookingConfirmed + today.bookingConfirmed;
  const completed = historical.completed + today.completed;

  const rawStages = [
    {
      id: 'impressions',
      label: 'Listing impressions',
      count: uniqueListingImpressions > 0 ? uniqueListingImpressions : listingImpressions,
    },
    { id: 'profile_views', label: 'Profile views', count: profileViews },
    { id: 'service_views', label: 'Service views', count: serviceViews },
    { id: 'booking_requests', label: 'Booking requests', count: bookingRequests },
    { id: 'booking_confirmed', label: 'Bookings confirmed', count: bookingConfirmed },
    { id: 'completed', label: 'Completed bookings', count: completed },
  ];

  return buildFunnelStages(rawStages, [
    uniqueListingImpressions,
    listingImpressions,
    profileViews,
    serviceViews,
  ]);
}

export async function getServiceLevelFunnel(
  providerId: string,
  serviceId: string,
  period: '7d' | '30d' | '90d',
): Promise<ProviderConversionFunnel & { serviceId: string }> {
  if (!mongoose.Types.ObjectId.isValid(providerId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
    return { serviceId, stages: [], overallConversionRate: 0 };
  }

  const providerObjectId = new mongoose.Types.ObjectId(providerId);
  const { now, startDate } = getProviderPeriodDates(period);

  const [serviceViews, bookingRequests, bookingConfirmed, completed] = await Promise.all([
    getServiceViewCount(providerId, startDate, now, serviceId),
    getBookingRequestCountForService(providerObjectId, startDate, now, serviceId),
    getConfirmedBookingCount(providerObjectId, startDate, now, serviceId),
    getCompletedBookingCountForService(providerObjectId, startDate, now, serviceId),
  ]);

  const rawStages = [
    { id: 'service_views', label: 'Service views', count: serviceViews },
    { id: 'booking_requests', label: 'Booking requests', count: bookingRequests },
    { id: 'booking_confirmed', label: 'Bookings confirmed', count: bookingConfirmed },
    { id: 'completed', label: 'Completed bookings', count: completed },
  ];

  const funnel = buildFunnelStages(rawStages, [serviceViews]);
  return { ...funnel, serviceId };
}
