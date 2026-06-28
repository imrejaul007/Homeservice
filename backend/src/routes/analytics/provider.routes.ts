import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const queryString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const resolveAuthenticatedProviderId = (
  user: { role: string; _id?: { toString(): string }; id?: string },
  req: Request,
): string => {
  if (user.role === 'admin') {
    return queryString(req.query.providerId);
  }

  if (user._id) {
    return user._id.toString();
  }

  return typeof user.id === 'string' ? user.id : '';
};
import { ApiError } from '../../utils/ApiError';
import {
  providerAnalyticsService,
  PeakHoursData,
  ProfitabilityData,
  ROASMetricsData,
  CompetitivePositionData,
  RepeatCustomerData,
  BookingSourceAttributionData,
  ResponseTimeMetricsData,
  ProviderLTVData,
  GeographicDemandData,
  RevenueForecastData,
  ProviderAnomalyAlert,
} from '../../services/providerAnalytics.service';
import {
  getProviderConversionFunnel,
  getServiceLevelFunnel,
} from '../../services/providerMetrics.shared';
import { detectProviderAnomalies } from '../../services/providerAnomalyDetection.service';
import { getProviderDashboard } from '../../services/providerDashboard.service';
import ProviderProfile from '../../models/providerProfile.model';
import Booking from '../../models/booking.model';
import { Types } from 'mongoose';
import {
  getServicesAnalytics,
  getServiceAnalytics,
  getServiceComparison,
  getTopServices,
  getCategoryBreakdown,
  getRevenueTrend,
  getSummaryStats,
} from '../../controllers/serviceAnalytics.controller';

const router = Router();

// ============================================
// Provider Analytics Routes
// ============================================

/**
 * @route   GET /api/analytics/provider/dashboard
 * @desc    Unified provider analytics dashboard
 * @access  Provider (own) or Admin
 */
export const handleProviderDashboard = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');
  const revenue = queryString(req.query.revenue, 'net');
  const city = queryString(req.query.city);

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = resolveAuthenticatedProviderId(user, req);

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? (period as '7d' | '30d' | '90d') : '30d';
  const revenueValue = revenue === 'gross' ? 'gross' : 'net';

  const data = await getProviderDashboard(providerId, {
    period: periodValue,
    revenue: revenueValue,
    city: city || undefined,
  });

  const overview = data.overview as {
    dataQuality?: { trackingSince: string | null; level: 'full' | 'bookings_only' };
    confirmedBookingRate?: number;
    conversionRateConfirmed?: number;
  };

  res.json({
    success: true,
    data: {
      period: data.period,
      revenue: data.revenue,
      city: data.city ?? null,
      overview: data.overview,
      earnings: data.earnings,
      bookings: data.bookings,
      ratings: data.ratings,
      topServices: data.topServices,
      weeklyData: data.weeklyData,
      timeSeries: data.timeSeries,
      timeSeriesPrevious: data.timeSeriesPrevious,
      funnel: data.funnel,
      cancellationSnapshot: data.cancellation,
      responseTime: data.responseTime,
      ltv: data.customerLtv,
      geographic: data.geographic,
      forecast: data.forecast,
      bookingSources: data.bookingSources,
      anomalyAlerts: data.anomalyAlerts ?? [],
      serviceFunnel: [],
      experiments: data.experiments ?? [],
      dataQuality: overview.dataQuality ?? {
        trackingSince: null,
        level: 'bookings_only' as const,
      },
      meta: {
        metricDefinitions: data.metricDefinitions,
        generatedAt: data.metadata?.generatedAt,
      },
    },
  });
});

router.get('/dashboard', authenticate, handleProviderDashboard);

/**
 * @route   GET /api/analytics/provider/peak-hours
 * @desc    Get peak hours revenue data for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/peak-hours', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');

  // Only providers or admins can access
  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = resolveAuthenticatedProviderId(user, req);

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  // Validate period parameter
  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? period : '30d';

  const data: PeakHoursData = await providerAnalyticsService.getPeakHoursRevenue(
    providerId,
    periodValue
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/profitability
 * @desc    Get service profitability data for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/profitability', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '90d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = resolveAuthenticatedProviderId(user, req);

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d', '1y'];
  const periodValue = validPeriods.includes(period) ? period : '90d';

  const data: ProfitabilityData = await providerAnalyticsService.getServiceProfitability(
    providerId,
    periodValue
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/roas
 * @desc    Get ROAS (Return on Ad Spend) data for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/roas', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? period : '30d';

  const data: ROASMetricsData = await providerAnalyticsService.getROAS(
    providerId,
    periodValue
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/competitive-position
 * @desc    Get competitive position data for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/competitive-position', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = resolveAuthenticatedProviderId(user, req);

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const data: CompetitivePositionData = await providerAnalyticsService.getCompetitivePosition(
    providerId
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/travel
 * @desc    Get travel time metrics for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/travel', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? period : '30d';

  const data = await providerAnalyticsService.getTravelMetrics(providerId, periodValue);

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/conversion-funnel
 * @desc    Get provider conversion funnel for the selected period
 * @access  Provider (own) or Admin
 */
router.get('/conversion-funnel', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? (period as '7d' | '30d' | '90d') : '30d';

  const profile = await ProviderProfile.findOne({ userId: providerId })
    .select('analytics.profileViews analytics.listingImpressions')
    .lean();

  const data = await getProviderConversionFunnel(providerId, periodValue, {
    listingImpressions: profile?.analytics?.listingImpressions,
    profileViews: profile?.analytics?.profileViews,
  });

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/conversion-funnel/service/:serviceId
 * @desc    Get service-level conversion funnel for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/conversion-funnel/service/:serviceId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');
  const { serviceId } = req.params;

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? (period as '7d' | '30d' | '90d') : '30d';

  const data = await getServiceLevelFunnel(providerId, serviceId, periodValue);

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/anomalies
 * @desc    Detect provider-level metric anomalies vs previous period
 * @access  Provider (own) or Admin
 */
router.get('/anomalies', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? (period as '7d' | '30d' | '90d') : '30d';

  const data = await detectProviderAnomalies(providerId, periodValue);

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/booking-source-attribution
 * @desc    Get booking counts and revenue breakdown by attribution source
 * @access  Provider (own) or Admin
 */
router.get('/booking-source-attribution', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? period : '30d';

  const data: BookingSourceAttributionData = await providerAnalyticsService.getBookingSourceAttribution(
    providerId,
    periodValue,
  );

  res.json({
    success: true,
    data,
  });
}));

const resolveProviderPeriod = (
  user: { role: string; _id: { toString(): string } },
  req: Request,
  defaultPeriod: string,
  validPeriods: string[],
): { providerId: string; period: string } => {
  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = resolveAuthenticatedProviderId(user, req);
  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const period = queryString(req.query.period, defaultPeriod);
  const periodValue = validPeriods.includes(period) ? period : defaultPeriod;
  return { providerId, period: periodValue };
};

/**
 * @route   GET /api/analytics/provider/response-time
 * @desc    Get booking response time metrics for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/response-time', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId, period } = resolveProviderPeriod(req.user as any, req, '30d', ['7d', '30d', '90d']);
  const data: ResponseTimeMetricsData = await providerAnalyticsService.getResponseTimeMetrics(providerId, period);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/provider/customer-ltv
 * @desc    Get customer lifetime value metrics for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/customer-ltv', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId, period } = resolveProviderPeriod(req.user as any, req, '30d', ['7d', '30d', '90d']);
  const data: ProviderLTVData = await providerAnalyticsService.getProviderLTV(providerId, period);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/provider/geographic-demand
 * @desc    Get geographic demand breakdown for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/geographic-demand', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId, period } = resolveProviderPeriod(req.user as any, req, '30d', ['7d', '30d', '90d']);
  const data: GeographicDemandData = await providerAnalyticsService.getGeographicDemand(providerId, period);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/provider/revenue-forecast
 * @desc    Get revenue forecast for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/revenue-forecast', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId, period } = resolveProviderPeriod(req.user as any, req, '30d', ['7d', '30d', '90d']);
  const data: RevenueForecastData = await providerAnalyticsService.getRevenueForecast(providerId, period);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/provider/anomaly-alerts
 * @desc    Get rule-based anomaly alerts for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/anomaly-alerts', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId, period } = resolveProviderPeriod(req.user as any, req, '30d', ['7d', '30d', '90d']);
  const data: ProviderAnomalyAlert[] = await providerAnalyticsService.getProviderAnomalyAlerts(providerId, period);
  res.json({ success: true, data });
}));

/**
 * @route   GET /api/analytics/provider/repeat-customers
 * @desc    Get repeat customer rate for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/repeat-customers', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '90d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['30d', '90d', '1y'];
  const periodValue = validPeriods.includes(period) ? period : '90d';

  const data: RepeatCustomerData = await providerAnalyticsService.getRepeatCustomerRate(
    providerId,
    periodValue
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/provider/overview
 * @desc    Get comprehensive analytics overview for the authenticated provider
 * @access  Provider (own) or Admin
 */
router.get('/overview', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? period : '30d';

  // Fetch all analytics data in parallel
  const [peakHours, profitability, roas, competitive, repeatCustomers] = await Promise.all([
    providerAnalyticsService.getPeakHoursRevenue(providerId, periodValue),
    providerAnalyticsService.getServiceProfitability(providerId, periodValue),
    providerAnalyticsService.getROAS(providerId, periodValue),
    providerAnalyticsService.getCompetitivePosition(providerId),
    providerAnalyticsService.getRepeatCustomerRate(providerId, periodValue),
  ]);

  res.json({
    success: true,
    data: {
      peakHours,
      profitability,
      roas,
      competitivePosition: competitive,
      repeatCustomers,
      period: periodValue,
    },
  });
}));

/**
 * @route   POST /api/analytics/provider/clear-cache
 * @desc    Clear analytics cache for a provider
 * @access  Admin
 */
router.post('/clear-cache', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.body;

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  await providerAnalyticsService.clearCache(providerId);

  res.json({
    success: true,
    message: `Analytics cache cleared for provider ${providerId}`,
  });
}));

// ============================================
// Service Analytics Routes
// ============================================

/**
 * @route   GET /api/analytics/provider/services
 * @desc    Get analytics for all provider's services
 * @access  Provider (own) or Admin
 */
router.get('/services', authenticate, asyncHandler(getServicesAnalytics));

/**
 * @route   GET /api/analytics/provider/services/compare
 * @desc    Get service comparison with market averages
 * @access  Provider (own) or Admin
 */
router.get('/services/compare', authenticate, asyncHandler(getServiceComparison));

/**
 * @route   GET /api/analytics/provider/services/top
 * @desc    Get top performing services
 * @access  Provider (own) or Admin
 */
router.get('/services/top', authenticate, asyncHandler(getTopServices));

/**
 * @route   GET /api/analytics/provider/services/categories
 * @desc    Get category breakdown
 * @access  Provider (own) or Admin
 */
router.get('/services/categories', authenticate, asyncHandler(getCategoryBreakdown));

/**
 * @route   GET /api/analytics/provider/services/summary
 * @desc    Get summary stats
 * @access  Provider (own) or Admin
 */
router.get('/services/summary', authenticate, asyncHandler(getSummaryStats));

/**
 * @route   GET /api/analytics/provider/services/:serviceId
 * @desc    Get analytics for a specific service
 * @access  Provider (own) or Admin
 */
router.get('/services/:serviceId', authenticate, asyncHandler(getServiceAnalytics));

/**
 * @route   GET /api/analytics/provider/services/:serviceId/trend
 * @desc    Get revenue trend for a specific service
 * @access  Provider (own) or Admin
 */
router.get('/services/:serviceId/trend', authenticate, asyncHandler(getRevenueTrend));

/**
 * @route   GET /api/analytics/provider/no-show-rate
 * @desc    Get no-show rate metrics and daily breakdown for provider
 * @access  Provider (own) or Admin
 */
router.get('/no-show-rate', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '30d');

  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const providerId = resolveAuthenticatedProviderId(user, req);
  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['7d', '30d', '90d'];
  const periodValue = validPeriods.includes(period) ? period : '30d';
  const days = periodValue === '7d' ? 7 : periodValue === '90d' ? 90 : 30;

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

  const providerObjectId = new Types.ObjectId(providerId);

  const [currentStats, previousStats, dailyBreakdown, upcomingNoShows] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: previousStartDate, $lt: startDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          totalBookings: { $sum: 1 },
          noShows: {
            $sum: {
              $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0],
            },
          },
          lateCancellations: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'cancelled'] },
                    { $lt: ['$cancellationDetails.hoursBeforeService', 24] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
            },
          },
          revenueLoss: {
            $sum: {
              $cond: [{ $eq: ['$status', 'no_show'] }, '$pricing.totalAmount', 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.find({
      providerId: providerObjectId,
      status: 'no_show',
      createdAt: { $gte: startDate, $lte: now },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('cancellationDetails.reason pricing.totalAmount')
      .lean(),
  ]);

  const currentMap = new Map<string, { count: number; revenue?: number }>(
    currentStats.map((row: { _id: string; count: number; revenue?: number }) => [row._id, row]),
  );
  const previousMap = new Map<string, number>(
    previousStats.map((row: { _id: string; count: number }) => [row._id, row.count]),
  );

  const totalBookings = currentStats.reduce((sum: number, row: { count: number }) => sum + row.count, 0);
  const noShows = currentMap.get('no_show')?.count || 0;
  const lateCancellations = currentStats
    .filter((row: { _id: string }) => row._id === 'cancelled')
    .reduce((sum: number, row: { count: number }) => sum + row.count, 0);
  const noShowRate = totalBookings > 0 ? (noShows / totalBookings) * 100 : 0;

  const previousTotal = Array.from(previousMap.values()).reduce((sum, count) => sum + (count as number), 0);
  const previousNoShows = previousMap.get('no_show') || 0;
  const previousRate = previousTotal > 0 ? (previousNoShows / previousTotal) * 100 : 0;
  const trend = noShowRate - previousRate;

  const reasonCounts = new Map<string, number>();
  upcomingNoShows.forEach((booking) => {
    const reason = (booking as { cancellationDetails?: { reason?: string } }).cancellationDetails?.reason
      || 'No reason provided';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  });
  const topReason = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const revenueLoss = dailyBreakdown.reduce(
    (sum: number, row: { revenueLoss?: number }) => sum + (row.revenueLoss || 0),
    0,
  );

  res.json({
    success: true,
    data: {
      providerId,
      period: periodValue,
      stats: {
        totalBookings,
        noShows,
        lateCancellations,
        noShowRate: Math.round(noShowRate * 10) / 10,
        averageNoShowRate: 5,
        trend: Math.round(trend * 10) / 10,
        revenueLoss,
        topReason,
        customerImpact: noShows,
      },
      dailyData: dailyBreakdown.map((row: {
        _id: string;
        totalBookings: number;
        noShows: number;
        lateCancellations: number;
        completed: number;
      }) => ({
        date: row._id,
        totalBookings: row.totalBookings,
        noShows: row.noShows,
        lateCancellations: row.lateCancellations,
        completed: row.completed,
        rate: row.totalBookings > 0 ? (row.noShows / row.totalBookings) * 100 : 0,
      })),
    },
  });
}));

export default router;
