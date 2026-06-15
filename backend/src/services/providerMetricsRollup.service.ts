import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import logger from '../utils/logger';
import {
  BOOKING_ATTRIBUTION_SOURCES,
  BookingAttributionSource,
  resolveStoredAttributionSource,
} from '../utils/bookingAttribution';

const MAX_DAILY_BUCKETS = 90;
const BOOKING_CONFIRMED_STATUSES = ['confirmed', 'in_progress', 'completed'] as const;

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function trimDailyBuckets<T extends { date: Date }>(entries: T[]): T[] {
  if (entries.length <= MAX_DAILY_BUCKETS) return entries;
  return [...entries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_DAILY_BUCKETS);
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function readBucketForDay<T extends { date?: Date }>(
  entries: T[] | undefined,
  dayStart: Date,
): T | undefined {
  return entries?.find((entry) => entry.date && isSameDay(new Date(entry.date), dayStart));
}

async function buildByCityBreakdown(
  providerId: mongoose.Types.ObjectId,
  dayStart: Date,
  dayEnd: Date,
): Promise<Array<{ city: string; bookings: number; revenue: number }>> {
  const rows = await Booking.aggregate([
    {
      $match: {
        providerId,
        deletedAt: { $exists: false },
        createdAt: { $gte: dayStart, $lte: dayEnd },
      },
    },
    {
      $group: {
        _id: { $ifNull: ['$location.address.city', 'Unknown'] },
        bookings: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'completed'] },
                  { $gte: ['$completedAt', dayStart] },
                  { $lte: ['$completedAt', dayEnd] },
                ],
              },
              { $ifNull: ['$pricing.totalAmount', 0] },
              0,
            ],
          },
        },
      },
    },
    { $sort: { bookings: -1 } },
  ]);

  return rows.map((row) => ({
    city: String(row._id || 'Unknown'),
    bookings: row.bookings || 0,
    revenue: Math.round((row.revenue || 0) * 100) / 100,
  }));
}

export async function rollupProviderMetricsForDate(targetDate: Date): Promise<number> {
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);
  let updatedProviders = 0;

  const providerIds = await Booking.distinct('providerId', {
    $or: [
      { createdAt: { $gte: dayStart, $lte: dayEnd } },
      { completedAt: { $gte: dayStart, $lte: dayEnd }, status: 'completed' },
    ],
    deletedAt: { $exists: false },
  });

  for (const providerId of providerIds) {
    if (!mongoose.Types.ObjectId.isValid(providerId)) continue;

    const providerObjectId = new mongoose.Types.ObjectId(providerId);

    const bookings = await Booking.find({
      providerId,
      deletedAt: { $exists: false },
      $or: [
        { createdAt: { $gte: dayStart, $lte: dayEnd } },
        { completedAt: { $gte: dayStart, $lte: dayEnd }, status: 'completed' },
      ],
    })
      .select('status createdAt completedAt pricing.totalAmount attribution metadata.bookingSource')
      .lean();

    if (bookings.length === 0) continue;

    const bySource: Record<string, { count: number; revenue: number }> = {};
    for (const source of BOOKING_ATTRIBUTION_SOURCES) {
      bySource[source] = { count: 0, revenue: 0 };
    }

    let bookingsCreated = 0;
    let bookingsCompleted = 0;
    let revenue = 0;

    for (const booking of bookings) {
      const source: BookingAttributionSource = resolveStoredAttributionSource(booking);
      const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
      if (createdAt && createdAt >= dayStart && createdAt <= dayEnd) {
        bookingsCreated += 1;
        bySource[source].count += 1;
      }

      if (booking.status === 'completed' && booking.completedAt) {
        const completedAt = new Date(booking.completedAt);
        if (completedAt >= dayStart && completedAt <= dayEnd) {
          const amount = booking.pricing?.totalAmount || 0;
          bookingsCompleted += 1;
          revenue += amount;
          bySource[source].revenue += amount;
        }
      }
    }

    const profileDoc = await ProviderProfile.findOne({ userId: providerId })
      .select('analytics.providerMetricsDaily analytics.listingImpressions analytics.profileViews')
      .lean();

    if (!profileDoc) continue;

    const listingBucket = readBucketForDay(profileDoc.analytics?.listingImpressions, dayStart) as
      | { impressions?: number; uniqueImpressions?: number }
      | undefined;
    const profileBucket = readBucketForDay(profileDoc.analytics?.profileViews, dayStart) as
      | { views?: number; uniqueViews?: number }
      | undefined;

    const [bookingRequests, confirmed, byCity] = await Promise.all([
      Booking.countDocuments({
        providerId: providerObjectId,
        createdAt: { $gte: dayStart, $lte: dayEnd },
        deletedAt: { $exists: false },
      }),
      Booking.countDocuments({
        providerId: providerObjectId,
        status: { $in: [...BOOKING_CONFIRMED_STATUSES] },
        createdAt: { $gte: dayStart, $lte: dayEnd },
        deletedAt: { $exists: false },
      }),
      buildByCityBreakdown(providerObjectId, dayStart, dayEnd),
    ]);

    const metrics = [...(profileDoc.analytics?.providerMetricsDaily || [])];
    const existingIndex = metrics.findIndex((entry) => entry.date && isSameDay(new Date(entry.date), dayStart));

    const rollupEntry = {
      date: dayStart,
      bookingsCreated,
      bookingsCompleted,
      revenue: Math.round(revenue * 100) / 100,
      bySource,
      impressions: listingBucket?.impressions || 0,
      uniqueImpressions: listingBucket?.uniqueImpressions || 0,
      funnelStages: {
        impressions: listingBucket?.impressions || 0,
        uniqueImpressions: listingBucket?.uniqueImpressions || 0,
        profileViews: profileBucket?.views || 0,
        uniqueProfileViews: profileBucket?.uniqueViews || 0,
        bookingRequests,
        confirmed,
        completed: bookingsCompleted,
      },
      byCity,
    };

    if (existingIndex >= 0) {
      metrics[existingIndex] = rollupEntry;
    } else {
      metrics.push(rollupEntry);
    }

    await ProviderProfile.updateOne(
      { userId: providerId },
      { $set: { 'analytics.providerMetricsDaily': trimDailyBuckets(metrics) } },
    );

    updatedProviders += 1;
  }

  logger.info('Provider metrics daily rollup completed', {
    targetDate: dayStart.toISOString().split('T')[0],
    updatedProviders,
  });

  return updatedProviders;
}

export async function runNightlyProviderMetricsRollup(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await rollupProviderMetricsForDate(yesterday);
}
