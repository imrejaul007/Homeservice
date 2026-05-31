import logger from '../../utils/logger';
import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const queryString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
import { ApiError } from '../../utils/ApiError';
import { customerAnalyticsService, CustomerBookingFrequency, CustomerAOVTrend, CategoryDistribution, SeasonalPattern, CESData } from '../../services/customerAnalytics.service';

const router = Router();

// ============================================
// Customer Analytics Routes
// ============================================

/**
 * @route   GET /api/analytics/customer/booking-frequency
 * @desc    Get booking frequency data for the authenticated customer
 * @access  Customer (own) or Admin
 */
router.get('/booking-frequency', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '90d');

  // Customers can only access their own data unless admin
  if (user.role !== 'admin' && user.role !== 'customer') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const customerId = user.role === 'admin' ? req.query.customerId : user._id.toString();

  if (!customerId) {
    throw new ApiError(400, 'Customer ID is required');
  }

  // Validate period parameter
  const validPeriods = ['7d', '30d', '90d', '1y'];
  const periodValue = validPeriods.includes(period) ? period : '90d';

  const data: CustomerBookingFrequency = await customerAnalyticsService.getBookingFrequency(
    customerId,
    periodValue
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/customer/aov-trend
 * @desc    Get AOV trend data for the authenticated customer
 * @access  Customer (own) or Admin
 */
router.get('/aov-trend', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '90d');

  if (user.role !== 'admin' && user.role !== 'customer') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const customerId = user.role === 'admin' ? req.query.customerId : user._id.toString();

  if (!customerId) {
    throw new ApiError(400, 'Customer ID is required');
  }

  const validPeriods = ['7d', '30d', '90d', '1y'];
  const periodValue = validPeriods.includes(period) ? period : '90d';

  const data: CustomerAOVTrend = await customerAnalyticsService.getAOVTrend(
    customerId,
    periodValue
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/customer/category-distribution
 * @desc    Get category distribution for the authenticated customer
 * @access  Customer (own) or Admin
 */
router.get('/category-distribution', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const period = queryString(req.query.period, '1y');

  if (user.role !== 'admin' && user.role !== 'customer') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const customerId = user.role === 'admin' ? req.query.customerId : user._id.toString();

  if (!customerId) {
    throw new ApiError(400, 'Customer ID is required');
  }

  const validPeriods = ['30d', '90d', '1y', 'all'];
  const periodValue = validPeriods.includes(period) ? period : '1y';

  const data: CategoryDistribution = await customerAnalyticsService.getCategoryDistribution(
    customerId,
    periodValue
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/customer/seasonal-patterns
 * @desc    Get seasonal patterns for the authenticated customer
 * @access  Customer (own) or Admin
 */
router.get('/seasonal-patterns', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { year } = req.query;

  if (user.role !== 'admin' && user.role !== 'customer') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const customerId = user.role === 'admin' ? req.query.customerId : user._id.toString();

  if (!customerId) {
    throw new ApiError(400, 'Customer ID is required');
  }

  const yearValue = year ? parseInt(year as string, 10) : new Date().getFullYear();

  if (isNaN(yearValue) || yearValue < 2020 || yearValue > 2030) {
    throw new ApiError(400, 'Invalid year parameter');
  }

  const data: SeasonalPattern = await customerAnalyticsService.getSeasonalPatterns(
    customerId,
    yearValue
  );

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   POST /api/analytics/customer/ces
 * @desc    Submit a Customer Effort Score survey response
 * @access  Customer
 */
router.post('/ces', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { score, bookingId, feedback } = req.body;

  if (user.role !== 'customer' && user.role !== 'admin') {
    throw new ApiError(403, 'Only customers can submit CES scores');
  }

  // Validate score (1-7 scale)
  if (!score || typeof score !== 'number' || score < 1 || score > 7) {
    throw new ApiError(400, 'Score must be between 1 and 7');
  }

  // In a real implementation, this would save to a database
  // For now, we'll just acknowledge the submission
  logger.info('CES score submitted', {
    userId: user._id.toString(),
    score,
    bookingId,
    hasFeedback: !!feedback,
  });

  res.json({
    success: true,
    message: 'CES score submitted successfully',
    data: {
      score,
      submittedAt: new Date().toISOString(),
    },
  });
}));

/**
 * @route   GET /api/analytics/customer/ces-history
 * @desc    Get CES score history for the authenticated customer
 * @access  Customer (own) or Admin
 */
router.get('/ces-history', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (user.role !== 'admin' && user.role !== 'customer') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const customerId = user.role === 'admin' ? req.query.customerId : user._id.toString();

  if (!customerId) {
    throw new ApiError(400, 'Customer ID is required');
  }

  // In a real implementation, this would fetch from a database
  // Mock data for now
  const data: CESData = {
    customerId,
    scores: [],
    averageScore: 6.0,
    benchmark: 5.5,
    trend: 0.4,
    distribution: {
      veryEasy: 156,
      easy: 112,
      neutral: 48,
      difficult: 14,
      veryDifficult: 6,
    },
    responseRate: 72,
  };

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   POST /api/analytics/customer/clear-cache
 * @desc    Clear analytics cache for a customer
 * @access  Admin
 */
router.post('/clear-cache', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.body;

  if (!customerId) {
    throw new ApiError(400, 'Customer ID is required');
  }

  await customerAnalyticsService.clearCache(customerId);

  res.json({
    success: true,
    message: `Analytics cache cleared for customer ${customerId}`,
  });
}));

export default router;
