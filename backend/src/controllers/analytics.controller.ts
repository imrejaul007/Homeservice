import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import {
  getBookingAnalytics,
  getProviderAnalytics,
  getCustomerAnalytics,
  getRevenueAnalytics,
  getServiceAnalytics,
  clearAnalyticsCache,
} from '../services/analytics/analytics.service';

/**
 * Get Booking Analytics
 * GET /api/bookings/analytics
 *
 * Returns comprehensive booking statistics including:
 * - Total, completed, cancelled, pending bookings
 * - Revenue metrics
 * - Completion and cancellation rates
 */
export const getBookingAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;
  const user = req.user as any;

  // Validate period parameter
  const validPeriods = ['today', 'week', 'month', 'quarter', 'year', 'all'];
  const periodValue = validPeriods.includes(period as string) ? period : 'month';

  // Only admin can view all bookings analytics, providers see only their own
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isProvider = user?.role === 'provider';

  const analytics = await getBookingAnalytics(periodValue as string, req);

  // If provider, filter to only their bookings (the service already handles this via tenant filter)
  if (isProvider && !isAdmin) {
    // The service layer already filters by tenant/provider context
    // Just ensure we're not exposing global data
    const ProviderProfile = (await import('../models/providerProfile.model')).default;
    const providerProfile = await ProviderProfile.findOne({ userId: user._id });

    if (!providerProfile) {
      throw new ApiError(404, 'Provider profile not found');
    }
  }

  res.json({
    success: true,
    data: {
      ...analytics,
      period: periodValue,
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * Get Provider Analytics
 * GET /api/analytics/providers
 *
 * Returns provider-related analytics including:
 * - Total and active providers
 * - Top rated providers
 * - Providers by verification status
 */
export const getProviderAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;

  const validPeriods = ['today', 'week', 'month', 'quarter', 'year', 'all'];
  const periodValue = validPeriods.includes(period as string) ? period : 'month';

  const analytics = await getProviderAnalytics(periodValue as string, req);

  res.json({
    success: true,
    data: {
      ...analytics,
      period: periodValue,
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * Get Customer Analytics
 * GET /api/analytics/customers
 *
 * Returns customer-related analytics including:
 * - Total and active customers
 * - Top customers by spending
 * - New vs returning customers
 */
export const getCustomerAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;

  const validPeriods = ['today', 'week', 'month', 'quarter', 'year', 'all'];
  const periodValue = validPeriods.includes(period as string) ? period : 'month';

  const analytics = await getCustomerAnalytics(periodValue as string, req);

  res.json({
    success: true,
    data: {
      ...analytics,
      period: periodValue,
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * Get Revenue Analytics
 * GET /api/analytics/revenue
 *
 * Returns revenue-related analytics including:
 * - Total and period-based revenue
 * - Month-over-month growth
 * - Revenue by category and day
 */
export const getRevenueAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month' } = req.query;

  const validPeriods = ['today', 'week', 'month', 'quarter', 'year', 'all'];
  const periodValue = validPeriods.includes(period as string) ? period : 'month';

  const analytics = await getRevenueAnalytics(periodValue as string, req);

  res.json({
    success: true,
    data: {
      ...analytics,
      period: periodValue,
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * Get Service Analytics
 * GET /api/analytics/services
 *
 * Returns service-related analytics including:
 * - Total and active services
 * - Top services by bookings and revenue
 * - Services by category
 */
export const getServiceAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await getServiceAnalytics(req);

  res.json({
    success: true,
    data: {
      ...analytics,
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * Refresh Analytics Cache
 * POST /api/analytics/refresh
 *
 * Forces a refresh of all analytics caches
 */
export const refreshAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  await clearAnalyticsCache();

  res.json({
    success: true,
    message: 'Analytics cache refreshed',
    generatedAt: new Date().toISOString(),
  });
});

export default {
  getBookingAnalyticsHandler,
  getProviderAnalyticsHandler,
  getCustomerAnalyticsHandler,
  getRevenueAnalyticsHandler,
  getServiceAnalyticsHandler,
  refreshAnalyticsHandler,
};
