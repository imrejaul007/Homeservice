import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { adminLimiter } from '../../middleware/rateLimiter';
import {
  enforceAdminIpAllowlist,
  enforcePlatformRequire2FA,
} from '../../middleware/platformSettings.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  analyticsService,
  TimeSeriesData,
  CohortData,
  GeoDistribution,
  CategoryPerformance,
  AggregatedMetric,
  ComparisonPeriods,
} from '../../services/analytics.service';

const router = Router();

// All dashboard routes require authentication, admin role, IP allowlist,
// platform 2FA enforcement, and admin rate limiting.
router.use(authenticate);
router.use(requireRole('admin'));
router.use(enforceAdminIpAllowlist);
router.use(enforcePlatformRequire2FA);
router.use(adminLimiter);

// ============================================
// Dashboard Metrics Endpoint
// ============================================

/**
 * @route   GET /api/analytics/dashboard/metrics
 * @desc    Get comprehensive dashboard metrics
 * @access  Admin
 */
router.get('/metrics', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = await analyticsService.getDashboardMetrics();

  res.json({
    success: true,
    data: metrics,
  });
}));

// ============================================
// Time Series Endpoint
// ============================================

/**
 * @route   GET /api/analytics/timeseries
 * @desc    Get time series data for trend analysis
 * @access  Admin
 * @query   startDate - Start date (ISO string)
 * @query   endDate - End date (ISO string)
 * @query   granularity - 'day' | 'week' | 'month' (default: 'day')
 */
router.get('/timeseries', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, granularity = 'day' } = req.query;

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)');
  }

  if (start > end) {
    throw new ApiError(400, 'startDate must be before endDate');
  }

  const validGranularities = ['day', 'week', 'month'];
  if (!validGranularities.includes(granularity as string)) {
    throw new ApiError(400, `Invalid granularity. Must be one of: ${validGranularities.join(', ')}`);
  }

  const data: TimeSeriesData[] = await analyticsService.getTimeSeriesData(
    start,
    end,
    granularity as 'day' | 'week' | 'month'
  );

  res.json({
    success: true,
    data,
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      granularity,
      dataPoints: data.length,
    },
  });
}));

// ============================================
// Trends Endpoint
// ============================================

/**
 * @route   GET /api/analytics/trends
 * @desc    Get trend analysis for a specific metric
 * @access  Admin
 * @query   metric - 'revenue' | 'bookings' | 'customers' | 'providers'
 * @query   currentStart - Current period start date (ISO string)
 * @query   currentEnd - Current period end date (ISO string)
 * @query   previousStart - Previous period start date (ISO string)
 * @query   previousEnd - Previous period end date (ISO string)
 */
router.get('/trends', asyncHandler(async (req: Request, res: Response) => {
  const { metric, currentStart, currentEnd, previousStart, previousEnd } = req.query;

  const validMetrics = ['revenue', 'bookings', 'customers', 'providers'];
  if (!metric || !validMetrics.includes(metric as string)) {
    throw new ApiError(400, `Invalid metric. Must be one of: ${validMetrics.join(', ')}`);
  }

  // Parse dates or use defaults (current month vs previous month)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const periods: ComparisonPeriods = {
    current: {
      start: currentStart ? new Date(currentStart as string) : startOfMonth,
      end: currentEnd ? new Date(currentEnd as string) : now,
    },
    previous: {
      start: previousStart ? new Date(previousStart as string) : startOfLastMonth,
      end: previousEnd ? new Date(previousEnd as string) : endOfLastMonth,
    },
  };

  // Validate dates
  if (isNaN(periods.current.start.getTime()) || isNaN(periods.current.end.getTime()) ||
      isNaN(periods.previous.start.getTime()) || isNaN(periods.previous.end.getTime())) {
    throw new ApiError(400, 'Invalid date format. Use ISO 8601 format.');
  }

  const trend: AggregatedMetric = await analyticsService.getTrendAnalysis(
    metric as 'revenue' | 'bookings' | 'customers' | 'providers',
    periods
  );

  res.json({
    success: true,
    data: trend,
    meta: {
      metric,
      currentPeriod: {
        start: periods.current.start.toISOString(),
        end: periods.current.end.toISOString(),
      },
      previousPeriod: {
        start: periods.previous.start.toISOString(),
        end: periods.previous.end.toISOString(),
      },
    },
  });
}));

// ============================================
// Cohort Analysis Endpoint
// ============================================

/**
 * @route   GET /api/analytics/cohorts
 * @desc    Get cohort analysis data
 * @access  Admin
 * @query   type - 'weekly' | 'monthly' (default: 'monthly')
 * @query   periods - Number of retention periods to analyze (default: 6)
 */
router.get('/cohorts', asyncHandler(async (req: Request, res: Response) => {
  const { type = 'monthly', periods = '6' } = req.query;

  const validTypes = ['weekly', 'monthly'];
  if (!validTypes.includes(type as string)) {
    throw new ApiError(400, `Invalid cohort type. Must be one of: ${validTypes.join(', ')}`);
  }

  const retentionPeriods = parseInt(periods as string, 10);
  if (isNaN(retentionPeriods) || retentionPeriods < 1 || retentionPeriods > 24) {
    throw new ApiError(400, 'Periods must be a number between 1 and 24');
  }

  const data: CohortData[] = await analyticsService.getCohortAnalysis(
    type as 'weekly' | 'monthly',
    retentionPeriods
  );

  // Group by cohort for easier frontend consumption
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.cohort]) {
      acc[item.cohort] = [];
    }
    acc[item.cohort].push({
      period: item.period,
      users: item.users,
      retained: item.retained,
      retentionRate: Math.round(item.retentionRate * 100) / 100,
    });
    return acc;
  }, {} as Record<string, Array<{ period: number; users: number; retained: number; retentionRate: number }>>);

  res.json({
    success: true,
    data,
    groupedData,
    meta: {
      cohortType: type,
      retentionPeriods,
      cohortCount: Object.keys(groupedData).length,
    },
  });
}));

// ============================================
// Geographic Distribution Endpoint
// ============================================

/**
 * @route   GET /api/analytics/geographic
 * @desc    Get geographic distribution of bookings and revenue
 * @access  Admin
 * @query   startDate - Start date (ISO string)
 * @query   endDate - End date (ISO string)
 */
router.get('/geographic', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // Default to last 90 days if no dates provided
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format. Use ISO 8601 format.');
  }

  if (start > end) {
    throw new ApiError(400, 'startDate must be before endDate');
  }

  const data: GeoDistribution[] = await analyticsService.getGeographicDistribution(start, end);

  // Calculate summary statistics
  const totalBookings = data.reduce((sum, item) => sum + item.count, 0);
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const avgRevenuePerBooking = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  res.json({
    success: true,
    data,
    summary: {
      totalRegions: data.length,
      totalBookings,
      totalRevenue,
      averageRevenuePerBooking: Math.round(avgRevenuePerBooking * 100) / 100,
      topCity: data[0]?.city || data[0]?.region || 'N/A',
    },
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
  });
}));

// ============================================
// Category Performance Endpoint
// ============================================

/**
 * @route   GET /api/analytics/categories
 * @desc    Get category performance metrics
 * @access  Admin
 * @query   startDate - Start date (ISO string)
 * @query   endDate - End date (ISO string)
 */
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // Default to last 30 days if no dates provided
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format. Use ISO 8601 format.');
  }

  if (start > end) {
    throw new ApiError(400, 'startDate must be before endDate');
  }

  const data: CategoryPerformance[] = await analyticsService.getCategoryPerformance(start, end);

  // Calculate summary statistics
  const totalRevenue = data.reduce((sum, item) => sum + item.totalRevenue, 0);
  const totalBookings = data.reduce((sum, item) => sum + item.totalBookings, 0);
  const avgRating = data.length > 0
    ? data.reduce((sum, item) => sum + item.averageRating, 0) / data.length
    : 0;

  // Find top performer
  const topPerformer = data.length > 0
    ? data.reduce((max, item) => (item.totalRevenue > max.totalRevenue ? item : max), data[0])
    : null;

  res.json({
    success: true,
    data,
    summary: {
      totalCategories: data.length,
      totalRevenue,
      totalBookings,
      averageRating: Math.round(avgRating * 100) / 100,
      topPerformer: topPerformer
        ? { name: topPerformer.categoryName, revenue: topPerformer.totalRevenue }
        : null,
    },
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
  });
}));

export default router;
