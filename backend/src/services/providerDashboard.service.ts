import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import { METRIC_DEFINITIONS } from '../constants/providerMetricDefinitions';
import type { TrendResult } from './analytics.service';
import { providerAnalyticsService } from './providerAnalytics.service';
import {
  getProviderInsightsAnalytics,
} from './providerInsightsAnalytics.service';
import {
  getProviderConversionFunnel,
  getProviderPeriodDates,
} from './providerMetrics.shared';
import { AnalyticsEventModel } from './eventStream.service';

export interface ProviderDashboardOptions {
  period?: '7d' | '30d' | '90d';
  revenue?: 'net' | 'gross';
  city?: string;
}

export interface ExperimentExposureResult {
  experimentId: string;
  variant: string;
  exposures: number;
}

export interface ProviderDashboardData {
  providerId: string;
  period: '7d' | '30d' | '90d';
  revenue: 'net' | 'gross';
  city?: string;
  overview: Record<string, unknown>;
  earnings: Record<string, unknown>;
  bookings: Record<string, unknown>;
  topServices: unknown[];
  weeklyData: unknown[];
  timeSeries: unknown[];
  timeSeriesPrevious?: unknown[];
  ratings: Record<string, unknown>;
  funnel: Awaited<ReturnType<typeof getProviderConversionFunnel>>;
  cancellation: {
    totalBookings: number;
    cancelledBookings: number;
    cancellationRate: number;
    completionRate: number;
  };
  responseTime: Awaited<ReturnType<typeof providerAnalyticsService.getResponseTimeMetrics>>;
  customerLtv: Awaited<ReturnType<typeof providerAnalyticsService.getProviderLTV>>;
  geographic: Awaited<ReturnType<typeof providerAnalyticsService.getGeographicDemand>>;
  forecast: Awaited<ReturnType<typeof providerAnalyticsService.getRevenueForecast>>;
  bookingSources: Awaited<ReturnType<typeof providerAnalyticsService.getBookingSourceAttribution>>;
  anomalyAlerts: Awaited<ReturnType<typeof providerAnalyticsService.getProviderAnomalyAlerts>>;
  experiments: ExperimentExposureResult[];
  metricDefinitions: typeof METRIC_DEFINITIONS;
  metadata: Record<string, unknown>;
}

export async function getExperimentResults(
  providerId: string,
  period: '7d' | '30d' | '90d' = '30d',
): Promise<ExperimentExposureResult[]> {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    return [];
  }

  const { now, startDate } = getProviderPeriodDates(period);

  const rows = await AnalyticsEventModel.aggregate([
    {
      $match: {
        eventType: 'experiment.exposure',
        timestamp: { $gte: startDate, $lte: now },
        $or: [
          { 'properties.providerId': providerId },
          { 'properties.provider_id': providerId },
        ],
      },
    },
    {
      $group: {
        _id: {
          experimentId: {
            $ifNull: ['$properties.experimentId', '$properties.experiment_id'],
          },
          variant: { $ifNull: ['$properties.variant', '$properties.variantId'] },
        },
        exposures: { $sum: 1 },
      },
    },
    { $sort: { exposures: -1 } },
  ]);

  return rows.map((row: { _id: { experimentId?: string; variant?: string }; exposures: number }) => ({
    experimentId: String(row._id.experimentId || 'unknown'),
    variant: String(row._id.variant || 'control'),
    exposures: row.exposures,
  }));
}

export async function getProviderDashboard(
  providerId: string,
  options: ProviderDashboardOptions = {},
): Promise<ProviderDashboardData> {
  const period = options.period ?? '30d';
  const revenue = options.revenue ?? 'net';
  const city = options.city?.trim() || undefined;
  const profile = await ProviderProfile.findOne({ userId: providerId })
    .select('analytics.profileViews analytics.listingImpressions')
    .lean();

  const [
    insights,
    funnel,
    responseTime,
    customerLtv,
    geographic,
    forecast,
    bookingSources,
    anomalyAlerts,
    experiments,
  ] = await Promise.all([
    getProviderInsightsAnalytics(providerId, period, { revenue, city }),
    getProviderConversionFunnel(providerId, period, {
      listingImpressions: profile?.analytics?.listingImpressions,
      profileViews: profile?.analytics?.profileViews,
    }),
    providerAnalyticsService.getResponseTimeMetrics(providerId, period),
    providerAnalyticsService.getProviderLTV(providerId, period),
    providerAnalyticsService.getGeographicDemand(providerId, period),
    providerAnalyticsService.getRevenueForecast(providerId, period),
    providerAnalyticsService.getBookingSourceAttribution(providerId, period),
    providerAnalyticsService.getProviderAnomalyAlerts(providerId, period),
    getExperimentResults(providerId, period),
  ]);

  const confirmedBookingRate = (insights.overview as { confirmedBookingRate?: number }).confirmedBookingRate ?? 0;
  const confirmedBookingRateTrend = (insights.overview as { confirmedBookingRateTrend?: TrendResult }).confirmedBookingRateTrend
    ?? { value: null, label: 'none' as const };
  const dataQuality = (insights.overview as { dataQuality?: { trackingSince: string | null; level: 'full' | 'bookings_only' } }).dataQuality
    ?? { trackingSince: null, level: 'bookings_only' as const };

  const overview = {
    ...insights.overview,
    conversionRateConfirmed: confirmedBookingRate,
    conversionRateConfirmedTrend: confirmedBookingRateTrend,
    dataQuality,
  };

  const bookingTotal = insights.bookings.total || 0;
  const bookingCancelled = insights.bookings.cancelled || 0;
  const bookingCompleted = insights.bookings.completed || 0;

  return {
    providerId,
    period,
    revenue,
    city,
    overview,
    earnings: insights.earnings,
    bookings: insights.bookings,
    topServices: insights.topServices,
    weeklyData: insights.weeklyData,
    timeSeries: insights.timeSeries,
    timeSeriesPrevious: insights.timeSeriesPrevious,
    ratings: insights.ratings,
    funnel,
    cancellation: {
      totalBookings: bookingTotal,
      cancelledBookings: bookingCancelled,
      cancellationRate:
        bookingTotal > 0
          ? Math.round((bookingCancelled / bookingTotal) * 1000) / 10
          : 0,
      completionRate:
        bookingTotal > 0
          ? Math.round((bookingCompleted / bookingTotal) * 1000) / 10
          : 0,
    },
    responseTime,
    customerLtv,
    geographic,
    forecast,
    bookingSources,
    anomalyAlerts,
    experiments,
    metricDefinitions: METRIC_DEFINITIONS,
    metadata: {
      ...(insights.metadata || {}),
      revenueMode: revenue,
      cityFilter: city || null,
      generatedAt: new Date().toISOString(),
    },
  };
}

export default getProviderDashboard;
