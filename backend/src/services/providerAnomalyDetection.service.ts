import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import Review from '../models/review.model';
import {
  getGrossRevenueForPeriod,
  getProviderPeriodDates,
  sumDailyMetricInRange,
} from './providerMetrics.shared';

export type ProviderAnomalyType =
  | 'revenue_drop'
  | 'booking_spike'
  | 'cancellation_spike'
  | 'impression_drop'
  | 'rating_drop';

export interface ProviderAnomaly {
  type: ProviderAnomalyType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
}

export interface ProviderAnomalyReport {
  providerId: string;
  period: '7d' | '30d' | '90d';
  anomalies: ProviderAnomaly[];
  checkedAt: string;
}

const REVENUE_DROP_THRESHOLD = -25;
const BOOKING_SPIKE_THRESHOLD = 50;
const CANCELLATION_SPIKE_THRESHOLD = 50;
const IMPRESSION_DROP_THRESHOLD = -30;
const RATING_DROP_THRESHOLD = -15;

function pctChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function severityFromMagnitude(magnitude: number, high: number, medium: number): 'low' | 'medium' | 'high' {
  const abs = Math.abs(magnitude);
  if (abs >= high) return 'high';
  if (abs >= medium) return 'medium';
  return 'low';
}

async function getBookingCounts(
  providerObjectId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
): Promise<{ total: number; cancelled: number }> {
  const [total, cancelled] = await Promise.all([
    Booking.countDocuments({
      providerId: providerObjectId,
      createdAt: { $gte: start, $lte: end },
    }),
    Booking.countDocuments({
      providerId: providerObjectId,
      status: 'cancelled',
      createdAt: { $gte: start, $lte: end },
    }),
  ]);

  return { total, cancelled };
}

async function getAverageRatingForPeriod(
  providerObjectId: mongoose.Types.ObjectId,
  start: Date,
  end: Date,
): Promise<number | null> {
  const result = await Review.aggregate([
    {
      $match: {
        revieweeId: providerObjectId,
        revieweeType: 'provider',
        createdAt: { $gte: start, $lte: end },
        moderationStatus: 'approved',
        isHidden: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (!result[0]?.count) return null;
  return Math.round((result[0].avgRating || 0) * 100) / 100;
}

export async function detectProviderAnomalies(
  providerId: string,
  period: '7d' | '30d' | '90d' = '30d',
): Promise<ProviderAnomalyReport> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    return {
      providerId,
      period,
      anomalies: [],
      checkedAt: new Date().toISOString(),
    };
  }

  const providerObjectId = new mongoose.Types.ObjectId(providerId);
  const { now, startDate, previousStartDate } = getProviderPeriodDates(period);
  const previousEndDate = new Date(startDate.getTime() - 1);

  const [
    currentRevenue,
    previousRevenue,
    currentBookings,
    previousBookings,
    profile,
    currentRating,
    previousRating,
  ] = await Promise.all([
    getGrossRevenueForPeriod(providerObjectId, startDate, now),
    getGrossRevenueForPeriod(providerObjectId, previousStartDate, previousEndDate),
    getBookingCounts(providerObjectId, startDate, now),
    getBookingCounts(providerObjectId, previousStartDate, previousEndDate),
    ProviderProfile.findOne({ userId: providerId })
      .select('analytics.listingImpressions')
      .lean(),
    getAverageRatingForPeriod(providerObjectId, startDate, now),
    getAverageRatingForPeriod(providerObjectId, previousStartDate, previousEndDate),
  ]);

  const currentImpressionsUnique = sumDailyMetricInRange(
    profile?.analytics?.listingImpressions,
    startDate,
    now,
    'uniqueImpressions',
  );
  const currentImpressionsRaw = sumDailyMetricInRange(
    profile?.analytics?.listingImpressions,
    startDate,
    now,
    'impressions',
  );
  const previousImpressionsUnique = sumDailyMetricInRange(
    profile?.analytics?.listingImpressions,
    previousStartDate,
    previousEndDate,
    'uniqueImpressions',
  );
  const previousImpressionsRaw = sumDailyMetricInRange(
    profile?.analytics?.listingImpressions,
    previousStartDate,
    previousEndDate,
    'impressions',
  );

  const currentImpressions = currentImpressionsUnique > 0
    ? currentImpressionsUnique
    : currentImpressionsRaw;
  const previousImpressions = previousImpressionsUnique > 0
    ? previousImpressionsUnique
    : previousImpressionsRaw;

  const anomalies: ProviderAnomaly[] = [];

  const revenueChange = pctChange(currentRevenue.grossTotal, previousRevenue.grossTotal);
  if (previousRevenue.grossTotal > 0 && revenueChange <= REVENUE_DROP_THRESHOLD) {
    anomalies.push({
      type: 'revenue_drop',
      severity: severityFromMagnitude(revenueChange, 50, 30),
      message: `Revenue dropped ${Math.abs(revenueChange)}% compared to the previous ${period} period`,
      currentValue: currentRevenue.grossTotal,
      previousValue: previousRevenue.grossTotal,
      changePercent: revenueChange,
    });
  }

  const bookingChange = pctChange(currentBookings.total, previousBookings.total);
  if (previousBookings.total > 0 && bookingChange >= BOOKING_SPIKE_THRESHOLD) {
    anomalies.push({
      type: 'booking_spike',
      severity: severityFromMagnitude(bookingChange, 100, 60),
      message: `Booking volume increased ${bookingChange}% compared to the previous ${period} period`,
      currentValue: currentBookings.total,
      previousValue: previousBookings.total,
      changePercent: bookingChange,
    });
  }

  const currentCancellationRate = currentBookings.total > 0
    ? (currentBookings.cancelled / currentBookings.total) * 100
    : 0;
  const previousCancellationRate = previousBookings.total > 0
    ? (previousBookings.cancelled / previousBookings.total) * 100
    : 0;
  const cancellationRateChange = pctChange(currentCancellationRate, previousCancellationRate);

  if (
    previousCancellationRate > 0 &&
    cancellationRateChange >= CANCELLATION_SPIKE_THRESHOLD &&
    currentBookings.cancelled >= 2
  ) {
    anomalies.push({
      type: 'cancellation_spike',
      severity: severityFromMagnitude(cancellationRateChange, 100, 70),
      message: `Cancellation rate rose from ${Math.round(previousCancellationRate)}% to ${Math.round(currentCancellationRate)}%`,
      currentValue: Math.round(currentCancellationRate * 100) / 100,
      previousValue: Math.round(previousCancellationRate * 100) / 100,
      changePercent: cancellationRateChange,
    });
  }

  const impressionChange = pctChange(currentImpressions, previousImpressions);
  if (previousImpressions > 0 && impressionChange <= IMPRESSION_DROP_THRESHOLD) {
    anomalies.push({
      type: 'impression_drop',
      severity: severityFromMagnitude(impressionChange, 50, 35),
      message: `Listing impressions dropped ${Math.abs(impressionChange)}% compared to the previous ${period} period`,
      currentValue: currentImpressions,
      previousValue: previousImpressions,
      changePercent: impressionChange,
    });
  }

  if (
    currentRating !== null &&
    previousRating !== null &&
    previousRating > 0
  ) {
    const ratingChange = pctChange(currentRating, previousRating);
    if (ratingChange <= RATING_DROP_THRESHOLD) {
      anomalies.push({
        type: 'rating_drop',
        severity: severityFromMagnitude(ratingChange, 25, 18),
        message: `Average rating fell from ${previousRating} to ${currentRating}`,
        currentValue: currentRating,
        previousValue: previousRating,
        changePercent: ratingChange,
      });
    }
  }

  return {
    providerId,
    period,
    anomalies,
    checkedAt: new Date().toISOString(),
  };
}

export default detectProviderAnomalies;
