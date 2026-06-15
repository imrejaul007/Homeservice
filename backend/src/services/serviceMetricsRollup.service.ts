import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import ServiceMetricsDaily from '../models/serviceMetricsDaily.model';
import { AnalyticsEventModel } from './eventStream.service';
import logger from '../utils/logger';

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

async function countServiceViewsForDay(
  providerId: string,
  serviceId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<number> {
  return AnalyticsEventModel.countDocuments({
    eventType: { $in: SERVICE_VIEW_EVENT_TYPES },
    timestamp: { $gte: dayStart, $lte: dayEnd },
    $and: [
      {
        $or: [
          { 'properties.providerId': providerId },
          { 'properties.provider_id': providerId },
        ],
      },
      {
        $or: [
          { 'properties.serviceId': serviceId },
          { 'properties.service_id': serviceId },
        ],
      },
    ],
  });
}

export async function rollupServiceMetricsForDate(targetDate: Date): Promise<number> {
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);
  let updatedRows = 0;

  const bookings = await Booking.find({
    deletedAt: { $exists: false },
    $or: [
      { createdAt: { $gte: dayStart, $lte: dayEnd } },
      { completedAt: { $gte: dayStart, $lte: dayEnd }, status: 'completed' },
    ],
  })
    .select('providerId serviceId status createdAt completedAt pricing.totalAmount')
    .lean();

  const metricsByKey = new Map<
    string,
    {
      providerId: mongoose.Types.ObjectId;
      serviceId: mongoose.Types.ObjectId;
      views: number;
      bookings: number;
      completed: number;
      revenue: number;
    }
  >();

  for (const booking of bookings) {
    if (!booking.providerId || !booking.serviceId) continue;

    const providerId = booking.providerId as mongoose.Types.ObjectId;
    const serviceId = booking.serviceId as mongoose.Types.ObjectId;
    const key = `${providerId.toString()}:${serviceId.toString()}`;

    if (!metricsByKey.has(key)) {
      metricsByKey.set(key, {
        providerId,
        serviceId,
        views: 0,
        bookings: 0,
        completed: 0,
        revenue: 0,
      });
    }

    const row = metricsByKey.get(key)!;
    const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
    if (createdAt && createdAt >= dayStart && createdAt <= dayEnd) {
      row.bookings += 1;
    }

    if (booking.status === 'completed' && booking.completedAt) {
      const completedAt = new Date(booking.completedAt);
      if (completedAt >= dayStart && completedAt <= dayEnd) {
        row.completed += 1;
        row.revenue += booking.pricing?.totalAmount || 0;
      }
    }
  }

  for (const row of metricsByKey.values()) {
    row.views = await countServiceViewsForDay(
      row.providerId.toString(),
      row.serviceId.toString(),
      dayStart,
      dayEnd,
    );

    if (row.views === 0 && row.bookings === 0 && row.completed === 0) {
      continue;
    }

    await ServiceMetricsDaily.findOneAndUpdate(
      {
        providerId: row.providerId,
        serviceId: row.serviceId,
        date: dayStart,
      },
      {
        $set: {
          views: row.views,
          bookings: row.bookings,
          completed: row.completed,
          revenue: Math.round(row.revenue * 100) / 100,
        },
      },
      { upsert: true, new: true },
    );

    updatedRows += 1;
  }

  logger.info('Service metrics daily rollup completed', {
    targetDate: dayStart.toISOString().split('T')[0],
    updatedRows,
  });

  return updatedRows;
}

export async function runNightlyServiceMetricsRollup(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await rollupServiceMetricsForDate(yesterday);
}
