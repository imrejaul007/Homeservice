import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import {
  getBookingAnalytics,
  getProviderAnalytics,
  getCustomerAnalytics,
  getRevenueAnalytics,
  getServiceAnalytics,
  clearAnalyticsCache,
} from '../services/analytics/analytics.service';

const router = Router();

/**
 * @route   GET /api/analytics/overview
 * @desc    Get analytics overview (all metrics)
 * @access  Admin
 */
router.get('/overview', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const { period = 'month' } = _req.query;

  const [bookings, providers, customers, revenue] = await Promise.all([
    getBookingAnalytics(period as string),
    getProviderAnalytics(),
    getCustomerAnalytics(),
    getRevenueAnalytics(period as string),
  ]);

  res.json({
    success: true,
    data: {
      bookings,
      providers,
      customers,
      revenue,
      period,
    },
  });
}));

/**
 * @route   GET /api/analytics/bookings
 * @desc    Get booking analytics
 * @access  Admin
 */
router.get('/bookings', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const { period = 'month' } = _req.query;

  const analytics = await getBookingAnalytics(period as string);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/providers
 * @desc    Get provider analytics
 * @access  Admin
 */
router.get('/providers', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const analytics = await getProviderAnalytics();

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/customers
 * @desc    Get customer analytics
 * @access  Admin
 */
router.get('/customers', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const analytics = await getCustomerAnalytics();

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Admin
 */
router.get('/revenue', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const { period = 'month' } = _req.query;

  const analytics = await getRevenueAnalytics(period as string);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/analytics/services
 * @desc    Get service analytics
 * @access  Admin
 */
router.get('/services', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const analytics = await getServiceAnalytics();

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   POST /api/analytics/refresh
 * @desc    Force refresh analytics cache
 * @access  Admin
 */
router.post('/refresh', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  await clearAnalyticsCache();

  res.json({
    success: true,
    message: 'Analytics cache cleared',
  });
}));

/**
 * @route   GET /api/analytics/provider/:id
 * @desc    Get analytics for specific provider
 * @access  Provider (own) or Admin
 */
router.get('/provider/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as any;

  // Check if user is the provider or admin
  if (user.role !== 'admin' && user._id.toString() !== id) {
    throw new ApiError(403, 'Not authorized to view these analytics');
  }

  res.json({
    success: true,
    data: {
      providerId: id,
      message: 'Provider analytics endpoint - implement based on requirements',
    },
  });
}));

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard summary metrics
 * @access  Admin
 */
router.get('/dashboard', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get quick stats
  const [todayBookings, weekBookings, monthBookings, pendingProviders] = await Promise.all([
    Booking.countDocuments({
      createdAt: { $gte: startOfToday },
    }),
    Booking.countDocuments({
      createdAt: { $gte: startOfWeek },
    }),
    Booking.countDocuments({
      createdAt: { $gte: startOfMonth },
    }),
    ProviderProfile.countDocuments({ verificationStatus: 'pending' }),
  ]);

  res.json({
    success: true,
    data: {
      todayBookings,
      weekBookings,
      monthBookings,
      pendingProviders,
      timestamp: new Date().toISOString(),
    },
  });
}));

export default router;
