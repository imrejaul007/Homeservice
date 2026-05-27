import { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import Booking from '../models/booking.model';
import {
  getProviderInsights,
  getProviderPerformanceMetrics,
  getProviderRevenueMetrics,
  getCustomerSatisfactionMetrics,
  getBookingTrends,
  generateProviderInsights,
  getRevenueOptimizationTips,
  clearInsightsCache,
  ProviderInsightsData,
  PerformanceMetrics,
  RevenueMetrics,
  CustomerSatisfactionMetrics,
  BookingTrend,
  ProviderInsight,
  RevenueOptimizationTip
} from '../services/providerInsights.service';
import {
  getOptimalSchedule,
  analyzeBookingPatterns,
  getAvailabilityGaps,
  getPeakDemandAnalysis,
  detectScheduleConflicts,
  getScheduleEfficiencyScore,
  clearScheduleCache,
  ScheduleOptimization,
  BookingPattern,
  AvailabilityGap
} from '../services/scheduleOptimization.service';
import {
  getCustomerCancellationProfile,
  predictBookingCancellation,
  getProviderCancellationStats,
  predictUpcomingCancellations,
  predictNoShows,
  getCancellationPreventionRecommendations,
  clearCancellationCache,
  CancellationRisk,
  ProviderCancellationStats,
  CustomerCancellationProfile,
  BookingCancellationPrediction,
  NoShowRisk,
  PreventionRecommendation
} from '../services/cancellationPrediction.service';

// ============================================
// PROVIDER INSIGHTS CONTROLLERS
// ============================================

/**
 * Get comprehensive provider insights
 * GET /api/provider/insights
 */
export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const period = (req.query.period as string) || 'month';

  if (!['week', 'month', 'quarter', 'year'].includes(period)) {
    throw new ApiError(400, 'Invalid period. Must be: week, month, quarter, or year');
  }

  const insights = await getProviderInsights(providerId, period as 'week' | 'month' | 'quarter' | 'year');

  res.json({
    success: true,
    data: { insights }
  });
});

/**
 * Get provider performance metrics
 * GET /api/provider/insights/performance
 */
export const getPerformance = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const period = (req.query.period as string) || 'month';

  if (!['week', 'month', 'quarter', 'year'].includes(period)) {
    throw new ApiError(400, 'Invalid period');
  }

  const metrics = await getProviderPerformanceMetrics(providerId, period as 'week' | 'month' | 'quarter' | 'year');

  res.json({
    success: true,
    data: { metrics }
  });
});

/**
 * Get provider revenue metrics
 * GET /api/provider/insights/revenue
 */
export const getRevenue = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const period = (req.query.period as string) || 'month';

  if (!['week', 'month', 'quarter', 'year'].includes(period)) {
    throw new ApiError(400, 'Invalid period');
  }

  const metrics = await getProviderRevenueMetrics(providerId, period as 'week' | 'month' | 'quarter' | 'year');

  res.json({
    success: true,
    data: { metrics }
  });
});

/**
 * Get customer satisfaction metrics
 * GET /api/provider/insights/satisfaction
 */
export const getSatisfaction = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const period = (req.query.period as string) || 'month';

  if (!['week', 'month', 'quarter', 'year'].includes(period)) {
    throw new ApiError(400, 'Invalid period');
  }

  const metrics = await getCustomerSatisfactionMetrics(providerId, period as 'week' | 'month' | 'quarter' | 'year');

  res.json({
    success: true,
    data: { metrics }
  });
});

/**
 * Get booking trends
 * GET /api/provider/insights/trends
 */
export const getTrends = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const period = (req.query.period as string) || 'month';

  if (!['week', 'month', 'quarter', 'year'].includes(period)) {
    throw new ApiError(400, 'Invalid period');
  }

  const trends = await getBookingTrends(providerId, period as 'week' | 'month' | 'quarter' | 'year');

  res.json({
    success: true,
    data: { trends }
  });
});

/**
 * Generate provider insights
 * GET /api/provider/insights/generate
 */
export const generateInsights = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const period = (req.query.period as string) || 'month';

  if (!['week', 'month', 'quarter', 'year'].includes(period)) {
    throw new ApiError(400, 'Invalid period');
  }

  const insights = await generateProviderInsights(providerId, period as 'week' | 'month' | 'quarter' | 'year');

  res.json({
    success: true,
    data: { insights }
  });
});

/**
 * Get revenue optimization tips
 * GET /api/provider/insights/optimization-tips
 */
export const getOptimizationTips = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);

  const tips = await getRevenueOptimizationTips(providerId);

  res.json({
    success: true,
    data: { tips }
  });
});

// ============================================
// SCHEDULE OPTIMIZATION CONTROLLERS
// ============================================

/**
 * Get optimal schedule recommendations
 * GET /api/provider/schedule/optimal
 */
export const getScheduleOptimal = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);

  const optimization = await getOptimalSchedule(providerId);

  res.json({
    success: true,
    data: { optimization }
  });
});

/**
 * Analyze booking patterns
 * GET /api/provider/schedule/patterns
 */
export const getSchedulePatterns = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const days = parseInt(req.query.days as string) || 30;

  if (days < 7 || days > 365) {
    throw new ApiError(400, 'Days must be between 7 and 365');
  }

  const patterns = await analyzeBookingPatterns(providerId, days);

  res.json({
    success: true,
    data: { patterns }
  });
});

/**
 * Get availability gaps
 * GET /api/provider/schedule/gaps
 */
export const getScheduleGaps = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);

  const gaps = await getAvailabilityGaps(providerId);

  res.json({
    success: true,
    data: { gaps }
  });
});

/**
 * Get peak demand analysis
 * GET /api/provider/schedule/peak-demand
 */
export const getSchedulePeakDemand = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);

  const analysis = await getPeakDemandAnalysis(providerId);

  res.json({
    success: true,
    data: { analysis }
  });
});

/**
 * Detect schedule conflicts
 * GET /api/provider/schedule/conflicts
 */
export const getScheduleConflicts = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const dateParam = req.query.date as string;

  if (!dateParam) {
    throw new ApiError(400, 'Date parameter is required (YYYY-MM-DD)');
  }

  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date format. Use YYYY-MM-DD');
  }

  const conflicts = await detectScheduleConflicts(providerId, date);

  res.json({
    success: true,
    data: { conflicts }
  });
});

/**
 * Get schedule efficiency score
 * GET /api/provider/schedule/efficiency
 */
export const getScheduleEfficiency = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);

  const score = await getScheduleEfficiencyScore(providerId);

  res.json({
    success: true,
    data: { score }
  });
});

// ============================================
// CANCELLATION PREDICTION CONTROLLERS
// ============================================

/**
 * Get customer cancellation profile
 * GET /api/provider/cancellations/customer/:customerId
 * Requires provider to have a booking with this customer for authorization
 */
export const getCancellationProfile = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const providerId = (req.user as any)?._id?.toString();

  if (!customerId) {
    throw new ApiError(400, 'Customer ID is required');
  }

  if (!providerId) {
    throw new ApiError(401, 'Authentication required');
  }

  // Verify provider has a booking with this customer (authorization check)
  const booking = await Booking.findOne({
    customerId: customerId,
    providerId: providerId
  }).lean();

  if (!booking) {
    throw new ApiError(403, 'Access denied. You can only view profiles for your own customers.');
  }

  const profile = await getCustomerCancellationProfile(customerId);

  res.json({
    success: true,
    data: { profile }
  });
});

/**
 * Predict booking cancellation
 * GET /api/provider/cancellations/predict/:bookingId
 * Requires booking to belong to this provider for authorization
 */
export const predictCancellation = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const providerId = (req.user as any)?._id?.toString();

  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  if (!providerId) {
    throw new ApiError(401, 'Authentication required');
  }

  // Verify booking belongs to this provider (authorization check)
  const booking = await Booking.findOne({
    _id: bookingId,
    providerId: providerId
  }).lean();

  if (!booking) {
    throw new ApiError(403, 'Access denied. You can only predict cancellations for your own bookings.');
  }

  const prediction = await predictBookingCancellation(bookingId);

  res.json({
    success: true,
    data: { prediction }
  });
});

/**
 * Get provider cancellation statistics
 * GET /api/provider/cancellations/stats
 */
export const getCancellationStats = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const period = (req.query.period as string) || 'month';

  if (!['week', 'month', 'quarter', 'year'].includes(period)) {
    throw new ApiError(400, 'Invalid period');
  }

  const stats = await getProviderCancellationStats(providerId, period as 'week' | 'month' | 'quarter' | 'year');

  res.json({
    success: true,
    data: { stats }
  });
});

/**
 * Predict upcoming cancellations
 * GET /api/provider/cancellations/upcoming
 */
export const getUpcomingCancellations = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const days = parseInt(req.query.days as string) || 7;

  if (days < 1 || days > 30) {
    throw new ApiError(400, 'Days must be between 1 and 30');
  }

  const predictions = await predictUpcomingCancellations(providerId, days);

  res.json({
    success: true,
    data: { predictions }
  });
});

/**
 * Predict no-shows for a specific date
 * GET /api/provider/cancellations/no-shows
 */
export const getNoShows = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);
  const dateParam = req.query.date as string;

  let date: Date;
  if (dateParam) {
    date = new Date(dateParam);
    if (isNaN(date.getTime())) {
      throw new ApiError(400, 'Invalid date format. Use YYYY-MM-DD');
    }
  } else {
    date = new Date();
  }

  const noShows = await predictNoShows(providerId, date);

  res.json({
    success: true,
    data: { noShows }
  });
});

/**
 * Get cancellation prevention recommendations
 * GET /api/provider/cancellations/prevention
 */
export const getPreventionRecommendations = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);

  const recommendations = await getCancellationPreventionRecommendations(providerId);

  res.json({
    success: true,
    data: { recommendations }
  });
});

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear all insights cache
 * POST /api/provider/insights/cache/clear
 */
export const clearCache = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)?._id?.toString() || (req.user as any);

  await Promise.all([
    clearInsightsCache(providerId),
    clearScheduleCache(providerId),
    clearCancellationCache(providerId)
  ]);

  res.json({
    success: true,
    message: 'Insights cache cleared successfully'
  });
});

export default {
  // Provider Insights
  getInsights,
  getPerformance,
  getRevenue,
  getSatisfaction,
  getTrends,
  generateInsights,
  getOptimizationTips,

  // Schedule Optimization
  getScheduleOptimal,
  getSchedulePatterns,
  getScheduleGaps,
  getSchedulePeakDemand,
  getScheduleConflicts,
  getScheduleEfficiency,

  // Cancellation Prediction
  getCancellationProfile,
  predictCancellation,
  getCancellationStats,
  getUpcomingCancellations,
  getNoShows,
  getPreventionRecommendations,

  // Cache Management
  clearCache
};
