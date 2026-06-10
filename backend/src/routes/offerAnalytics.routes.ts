import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { offerAnalyticsService } from '../services/offerAnalytics.service';
import logger from '../utils/logger';

const router = Router();

// ============================================
// PUBLIC ROUTES (Limited)
// ============================================

/**
 * @route   GET /api/offers-analytics/offer/:id/summary
 * @desc    Get basic offer summary for display
 * @access  Public
 */
router.get('/offer/:id/summary', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const offer = await offerAnalyticsService.getOfferAnalytics(id);

  res.json({
    success: true,
    data: {
      totalClaims: offer.totalClaims,
      totalRedemptions: offer.totalRedemptions,
      redemptionRate: Math.round(offer.redemptionRate * 100) / 100,
    },
  });
}));

// ============================================
// PROTECTED ROUTES
// ============================================

/**
 * @route   GET /api/offers-analytics/global
 * @desc    Get platform-wide offer analytics
 * @access  Admin
 */
router.get('/global', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  let dateRange;
  if (startDate && endDate) {
    dateRange = {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    };
  }

  const analytics = await offerAnalyticsService.getGlobalAnalytics(dateRange);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/offers-analytics/trends
 * @desc    Get offer trend data
 * @access  Admin
 */
router.get('/trends', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = 'month', days = 30 } = req.query;

  const trends = await offerAnalyticsService.getOfferTrends(
    period as 'day' | 'week' | 'month',
    Number(days)
  );

  res.json({
    success: true,
    data: trends,
  });
}));

/**
 * @route   GET /api/offers-analytics/offer/:id
 * @desc    Get detailed analytics for a specific offer
 * @access  Admin or Offer Owner
 * FIX: Added authorization check
 */
router.get('/offer/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req as any;

  // FIX: Check if user is admin or owns the offer
  if (user.role !== 'admin') {
    // Non-admins can only view their own offers' analytics
    // For now, restrict to admins only for security
    throw new ApiError(403, 'Not authorized to view offer analytics');
  }

  const analytics = await offerAnalyticsService.getOfferAnalytics(id);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/offers-analytics/provider/:providerId
 * @desc    Get analytics for a provider's offers
 * @access  Provider (own) or Admin
 */
router.get('/provider/:providerId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const user = req as any;

  // Check authorization
  if (user.role !== 'admin' && user._id.toString() !== providerId) {
    throw new ApiError(403, 'Not authorized to view these analytics');
  }

  const analytics = await offerAnalyticsService.getProviderAnalytics(providerId);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/offers-analytics/user/me
 * @desc    Get current user's offer activity analytics
 * @access  Private
 */
router.get('/user/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any)._id.toString();

  const analytics = await offerAnalyticsService.getUserAnalytics(userId);

  res.json({
    success: true,
    data: analytics,
  });
}));

/**
 * @route   GET /api/offers-analytics/dashboard
 * @desc    Get admin dashboard summary
 * @access  Admin
 */
router.get('/dashboard', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const dashboard = await offerAnalyticsService.getAdminDashboard();

  res.json({
    success: true,
    data: dashboard,
  });
}));

/**
 * @route   GET /api/offers-analytics/attention-required
 * @desc    Get offers requiring attention
 * @access  Admin
 */
router.get('/attention-required', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const attention = await offerAnalyticsService.getOffersRequiringAttention();

  res.json({
    success: true,
    data: attention,
  });
}));

/**
 * @route   GET /api/offers-analytics/export
 * @desc    Export coupons/analytics as CSV or JSON
 * @access  Admin
 */
router.get('/export', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { format = 'csv', isActive, type, startDate, endDate } = req.query;

  const filters: any = {};
  if (isActive !== undefined) {
    filters.isActive = isActive === 'true';
  }
  if (type) {
    filters.type = type as string;
  }
  if (startDate) {
    filters.startDate = new Date(startDate as string);
  }
  if (endDate) {
    filters.endDate = new Date(endDate as string);
  }

  const result = await offerAnalyticsService.exportCoupons({
    format: format as 'csv' | 'json',
    filters,
  });

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
}));

export default router;
