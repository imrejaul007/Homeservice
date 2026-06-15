import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import ProviderFunnelDaily, { IProviderFunnelStages } from '../models/providerFunnelDaily.model';
import { AnalyticsEventModel } from './eventStream.service';
import logger from '../utils/logger';

const BOOKING_CONFIRMED_STATUSES = ['confirmed', 'in_progress', 'completed'] as const;

const SERVICE_VIEW_EVENT_TYPES = [
  'service.viewed',
  'service.service_viewed',
  'service_view',
  'booking.booking_start',
  'booking.provider_selected',
  'booking.service_booked',
];

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

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function emptyStages(): IProviderFunnelStages {
  return {
    impressions: 0,
    uniqueImpressions: 0,
    profileViews: 0,
    uniqueProfileViews: 0,
    serviceViews: 0,
    bookingRequests: 0,
    confirmed: 0,
    completed: 0,
  };
}

function readProfileBucketForDay<T extends { date?: Date }>(
  entries: T[] | undefined,
  dayStart: Date,
): T | undefined {
  return entries?.find((entry) => entry.date && isSameDay(new Date(entry.date), dayStart));
}

async function countServiceViews(
  providerId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<number> {
  return AnalyticsEventModel.countDocuments({
    eventType: { $in: SERVICE_VIEW_EVENT_TYPES },
    timestamp: { $gte: dayStart, $lte: dayEnd },
    $or: [
      { 'properties.providerId': providerId },
      { 'properties.provider_id': providerId },
    ],
  });
}

async function collectProviderIdsForDate(dayStart: Date, dayEnd: Date): Promise<string[]> {
  const [bookingProviders, eventProviders, profileProviders] = await Promise.all([
    Booking.distinct('providerId', {
      $or: [
        { createdAt: { $gte: dayStart, $lte: dayEnd } },
        { completedAt: { $gte: dayStart, $lte: dayEnd }, status: 'completed' },
      ],
      deletedAt: { $exists: false },
    }),
    AnalyticsEventModel.distinct('properties.providerId', {
      timestamp: { $gte: dayStart, $lte: dayEnd },
      'properties.providerId': { $exists: true, $ne: null },
    }),
    ProviderProfile.distinct('userId', {
      $or: [
        { 'analytics.listingImpressions.date': { $gte: dayStart, $lte: dayEnd } },
        { 'analytics.profileViews.date': { $gte: dayStart, $lte: dayEnd } },
      ],
    }),
  ]);

  const ids = new Set<string>();
  for (const id of [...bookingProviders, ...profileProviders]) {
    if (id) ids.add(id.toString());
  }
  for (const id of eventProviders) {
    if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
      ids.add(id);
    }
  }

  return Array.from(ids);
}

async function buildFunnelStagesForProvider(
  providerId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<IProviderFunnelStages | null> {
  const providerObjectId = new mongoose.Types.ObjectId(providerId);

  const profile = await ProviderProfile.findOne({ userId: providerId })
    .select('analytics.listingImpressions analytics.profileViews')
    .lean();

  if (!profile) return null;

  const listingBucket = readProfileBucketForDay(profile.analytics?.listingImpressions, dayStart) as
    | { impressions?: number; uniqueImpressions?: number }
    | undefined;
  const profileBucket = readProfileBucketForDay(profile.analytics?.profileViews, dayStart) as
    | { views?: number; uniqueViews?: number }
    | undefined;

  const [serviceViews, bookingRequests, confirmed, completed] = await Promise.all([
    countServiceViews(providerId, dayStart, dayEnd),
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
    Booking.countDocuments({
      providerId: providerObjectId,
      status: 'completed',
      completedAt: { $gte: dayStart, $lte: dayEnd },
      deletedAt: { $exists: false },
    }),
  ]);

  const stages = emptyStages();
  stages.impressions = listingBucket?.impressions || 0;
  stages.uniqueImpressions = listingBucket?.uniqueImpressions || 0;
  stages.profileViews = profileBucket?.views || 0;
  stages.uniqueProfileViews = profileBucket?.uniqueViews || 0;
  stages.serviceViews = serviceViews;
  stages.bookingRequests = bookingRequests;
  stages.confirmed = confirmed;
  stages.completed = completed;

  const hasActivity = Object.values(stages).some((value) => value > 0);
  return hasActivity ? stages : null;
}

export async function rollupProviderFunnelForDate(targetDate: Date): Promise<number> {
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);
  let updatedProviders = 0;

  const providerIds = await collectProviderIdsForDate(dayStart, dayEnd);

  for (const providerId of providerIds) {
    if (!mongoose.Types.ObjectId.isValid(providerId)) continue;

    const stages = await buildFunnelStagesForProvider(providerId, dayStart, dayEnd);
    if (!stages) continue;

    await ProviderFunnelDaily.findOneAndUpdate(
      { providerId, date: dayStart },
      { $set: { stages } },
      { upsert: true, new: true },
    );

    updatedProviders += 1;
  }

  logger.info('Provider funnel daily rollup completed', {
    targetDate: dayStart.toISOString().split('T')[0],
    updatedProviders,
  });

  return updatedProviders;
}

export async function runNightlyProviderFunnelRollup(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await rollupProviderFunnelForDate(yesterday);
}
