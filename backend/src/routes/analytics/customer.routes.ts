import logger from '../../utils/logger';
import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const queryString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
import { ApiError } from '../../utils/ApiError';
import { customerAnalyticsService, CustomerBookingFrequency, CustomerAOVTrend, CategoryDistribution, SeasonalPattern, CESData } from '../../services/customerAnalytics.service';
import CESSubmission from '../../models/cesSubmission.model';
import NPSSubmission from '../../models/npsSubmission.model';

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
    customerId as string,
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
  const { score, bookingId, serviceId, feedback } = req.body;

  if (user.role !== 'customer' && user.role !== 'admin') {
    throw new ApiError(403, 'Only customers can submit CES scores');
  }

  // Validate score (1-7 scale)
  if (!score || typeof score !== 'number' || score < 1 || score > 7) {
    throw new ApiError(400, 'Score must be between 1 and 7');
  }

  // Validate feedback length
  if (feedback && feedback.length > 2000) {
    throw new ApiError(400, 'Feedback cannot exceed 2000 characters');
  }

  const customerId = user._id;

  // Check for duplicate submission for the same booking
  if (bookingId) {
    const existing = await CESSubmission.findOne({
      userId: customerId,
      bookingId: bookingId,
    });
    if (existing) {
      throw new ApiError(409, 'CES score already submitted for this booking');
    }
  }

  // Persist the CES submission to the database
  const submission = await CESSubmission.create({
    userId: customerId,
    bookingId: bookingId || undefined,
    serviceId: serviceId || undefined,
    score,
    feedback: feedback || undefined,
    submittedAt: new Date(),
  });

  logger.info('CES score submitted', {
    submissionId: submission._id.toString(),
    userId: user._id.toString(),
    score,
    bookingId,
    hasFeedback: !!feedback,
  });

  res.status(201).json({
    success: true,
    message: 'CES score submitted successfully',
    data: {
      id: submission._id.toString(),
      score: submission.score,
      submittedAt: submission.submittedAt.toISOString(),
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

  // Fetch submissions from database
  const { Types } = require('mongoose');
  const customerObjectId = new Types.ObjectId(customerId);

  const [submissions, averageScore, distribution] = await Promise.all([
    CESSubmission.getSubmissionsByCustomer(customerObjectId, { limit: 100 }),
    CESSubmission.getAverageScore(customerObjectId, 90),
    CESSubmission.getScoreDistribution(customerObjectId),
  ]);

  // Calculate trend (compare recent 30 days to previous 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recentSubmissions = submissions.filter(s => s.submittedAt >= thirtyDaysAgo);
  const previousSubmissions = submissions.filter(s => s.submittedAt >= sixtyDaysAgo && s.submittedAt < thirtyDaysAgo);

  const recentAvg = recentSubmissions.length > 0
    ? recentSubmissions.reduce((sum, s) => sum + s.score, 0) / recentSubmissions.length
    : 0;
  const previousAvg = previousSubmissions.length > 0
    ? previousSubmissions.reduce((sum, s) => sum + s.score, 0) / previousSubmissions.length
    : 0;
  const trend = previousAvg > 0 ? recentAvg - previousAvg : 0;

  const totalResponses = Object.values(distribution).reduce((a, b) => a + b, 0);

  // Ensure distribution has all required keys
  const formattedDistribution = {
    veryEasy: distribution.veryEasy || 0,
    easy: distribution.easy || 0,
    neutral: distribution.neutral || 0,
    difficult: distribution.difficult || 0,
    veryDifficult: distribution.veryDifficult || 0,
  };

  const data: CESData = {
    customerId,
    scores: submissions.map(s => ({
      score: s.score,
      date: s.submittedAt,
      serviceId: s.serviceId?.toString(),
      bookingId: s.bookingId?.toString(),
    })),
    averageScore: Math.round(averageScore * 10) / 10,
    benchmark: 5.5, // Industry standard CES benchmark
    trend: Math.round(trend * 10) / 10,
    distribution: formattedDistribution,
    responseRate: totalResponses > 0 ? Math.round((totalResponses / 10) * 100) / 100 : 0, // Approximate based on submissions
  };

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/customer/referral-attribution
 * @desc    Get referral attribution analytics for the authenticated customer
 * @access  Customer (own) or Admin
 */
router.get('/referral-attribution', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (user.role !== 'admin' && user.role !== 'customer') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const customerId = user.role === 'admin' ? req.query.customerId : user._id.toString();

  if (!customerId) {
    throw new ApiError(400, 'Customer ID is required');
  }

  const data = await customerAnalyticsService.getReferralAttribution(customerId as string);

  res.json({
    success: true,
    data,
  });
}));

/**
 * @route   GET /api/analytics/customer/nps
 * @desc    Get platform NPS statistics
 * @access  Customer or Admin
 */
router.get('/nps', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  if (user.role !== 'admin' && user.role !== 'customer') {
    throw new ApiError(403, 'Not authorized to access this data');
  }

  const stats = await NPSSubmission.getPlatformStats();

  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * @route   POST /api/analytics/customer/nps
 * @desc    Submit an NPS survey response
 * @access  Customer
 */
router.post('/nps', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { score, bookingId, feedback } = req.body;

  if (user.role !== 'customer' && user.role !== 'admin') {
    throw new ApiError(403, 'Only customers can submit NPS scores');
  }

  if (typeof score !== 'number' || score < 0 || score > 10) {
    throw new ApiError(400, 'Score must be between 0 and 10');
  }

  if (feedback && feedback.length > 2000) {
    throw new ApiError(400, 'Feedback cannot exceed 2000 characters');
  }

  if (bookingId) {
    const existing = await NPSSubmission.findOne({
      userId: user._id,
      bookingId,
    });
    if (existing) {
      throw new ApiError(409, 'NPS score already submitted for this booking');
    }
  }

  const submission = await NPSSubmission.create({
    userId: user._id,
    bookingId: bookingId || undefined,
    score,
    feedback: feedback || undefined,
    submittedAt: new Date(),
  });

  const stats = await NPSSubmission.getPlatformStats();

  res.status(201).json({
    success: true,
    message: 'NPS score submitted successfully',
    data: {
      id: submission._id.toString(),
      score: submission.score,
      submittedAt: submission.submittedAt.toISOString(),
      stats,
    },
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
