import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const queryString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
import { ApiError } from '../../utils/ApiError';
import {
  providerAnalyticsService,
  PeakHoursData,
  ProfitabilityData,
  ROASData,
  CompetitivePositionData,
  RepeatCustomerData,
} from '../../services/providerAnalytics.service';
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

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

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

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const validPeriods = ['30d', '90d', '1y'];
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

  const data: ROASData = await providerAnalyticsService.getROAS(
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

  const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();

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

export default router;
