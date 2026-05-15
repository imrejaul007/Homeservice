import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import payoutEngineService from '../services/payoutEngine.service';
import settlementService from '../services/settlement.service';
import Payout from '../models/payout.model';
import Settlement from '../models/settlement.model';
import { ApiError } from '../utils/ApiError';
import authMiddleware from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// ===================================
// PAYOUT ROUTES
// ===================================

/**
 * GET /api/payout/payouts
 * Get payout history for the authenticated provider
 */
router.get(
  '/payouts',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }
    const {
      page = '1',
      limit = '20',
      status,
      startDate,
      endDate,
    } = req.query;

    const result = await payoutEngineService.getPayoutHistory(providerId, {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      status: status as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: result.payouts,
      pagination: result.pagination,
    });
  })
);

/**
 * GET /api/payout/payouts/upcoming
 * Get upcoming payouts for the authenticated provider
 */
router.get(
  '/payouts/upcoming',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const payouts = await payoutEngineService.getUpcomingPayouts(providerId);

    res.json({
      success: true,
      data: payouts,
    });
  })
);

/**
 * GET /api/payout/payouts/stats
 * Get payout statistics for the authenticated provider
 */
router.get(
  '/payouts/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }
    const period = (req.query.period as 'week' | 'month' | 'year') || 'month';

    const stats = await payoutEngineService.getPayoutStats(providerId, period);

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/payout/payouts/:payoutId
 * Get specific payout details
 */
router.get(
  '/payouts/:payoutId',
  asyncHandler(async (req: Request, res: Response) => {
    const { payoutId } = req.params;
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const payout = await Payout.findOne({
      _id: new Types.ObjectId(payoutId),
      providerId: new Types.ObjectId(providerId),
    }).populate('settlementId');

    if (!payout) {
      throw new ApiError(404, 'Payout not found');
    }

    res.json({
      success: true,
      data: payout,
    });
  })
);

/**
 * POST /api/payout/payouts/:payoutId/cancel
 * Cancel a pending/scheduled payout
 */
router.post(
  '/payouts/:payoutId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { payoutId } = req.params;
    const { reason } = req.body;
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!reason) {
      throw new ApiError(400, 'Cancellation reason is required');
    }

    // Verify ownership
    const payout = await Payout.findOne({
      _id: new Types.ObjectId(payoutId),
      providerId: new Types.ObjectId(providerId),
    });

    if (!payout) {
      throw new ApiError(404, 'Payout not found');
    }

    await payoutEngineService.cancelPayout(payoutId, reason, providerId);

    logger.info('Payout cancelled by provider', {
      payoutId,
      providerId,
      reason,
      action: 'PAYOUT_CANCELLED_BY_PROVIDER',
    });

    res.json({
      success: true,
      message: 'Payout cancelled successfully',
    });
  })
);

// ===================================
// EARNINGS ROUTES
// ===================================

/**
 * GET /api/payout/earnings
 * Get earnings breakdown for the authenticated provider
 */
router.get(
  '/earnings',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }
    const {
      periodStart,
      periodEnd,
    } = req.query;

    // Default to last 30 days if not specified
    const start = periodStart
      ? new Date(periodStart as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = periodEnd
      ? new Date(periodEnd as string)
      : new Date();

    const breakdown = await payoutEngineService.calculateEarningsBreakdown(
      providerId,
      start,
      end
    );

    // Get additional earnings data
    const [pendingAmount, totalPaid, upcomingPayouts] = await Promise.all([
      payoutEngineService.getPendingEarnings(providerId),
      payoutEngineService.getTotalPaidOut(providerId),
      payoutEngineService.getUpcomingPayouts(providerId),
    ]);

    res.json({
      success: true,
      data: {
        breakdown,
        pendingAmount,
        totalPaid,
        upcomingPayouts,
      },
    });
  })
);

/**
 * GET /api/payout/earnings/summary
 * Get earnings summary for the authenticated provider
 */
router.get(
  '/earnings/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }
    const period = (req.query.period as 'week' | 'month' | 'year') || 'month';

    const [payoutStats, settlementSummary] = await Promise.all([
      payoutEngineService.getPayoutStats(providerId, period),
      settlementService.getSettlementSummary(providerId, period),
    ]);

    res.json({
      success: true,
      data: {
        period,
        payouts: payoutStats,
        settlements: settlementSummary,
      },
    });
  })
);

// ===================================
// SETTLEMENT ROUTES
// ===================================

/**
 * GET /api/payout/settlements
 * Get settlement history for the authenticated provider
 */
router.get(
  '/settlements',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }
    const {
      page = '1',
      limit = '20',
      status,
      startDate,
      endDate,
    } = req.query;

    const result = await settlementService.getProviderSettlements(providerId, {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      status: status as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: result.settlements,
      pagination: result.pagination,
    });
  })
);

/**
 * GET /api/payout/settlements/:settlementId
 * Get specific settlement details
 */
router.get(
  '/settlements/:settlementId',
  asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const settlement = await Settlement.findOne({
      _id: new Types.ObjectId(settlementId),
      providerId: new Types.ObjectId(providerId),
    })
      .populate('providerId', 'firstName lastName email')
      .populate('lineItems.bookingId')
      .populate('payoutId');

    if (!settlement) {
      throw new ApiError(404, 'Settlement not found');
    }

    res.json({
      success: true,
      data: settlement,
    });
  })
);

/**
 * POST /api/payout/settlements/:settlementId/dispute
 * Dispute a settlement
 */
router.post(
  '/settlements/:settlementId/dispute',
  asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    const { reason } = req.body;
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!reason) {
      throw new ApiError(400, 'Dispute reason is required');
    }

    // Verify ownership
    const settlement = await Settlement.findOne({
      _id: new Types.ObjectId(settlementId),
      providerId: new Types.ObjectId(providerId),
    });

    if (!settlement) {
      throw new ApiError(404, 'Settlement not found');
    }

    await settlementService.disputeSettlement(settlementId, reason);

    logger.info('Settlement disputed by provider', {
      settlementId,
      providerId,
      reason,
      action: 'SETTLEMENT_DISPUTED_BY_PROVIDER',
    });

    res.json({
      success: true,
      message: 'Settlement disputed successfully',
    });
  })
);

/**
 * GET /api/payout/settlements/summary
 * Get settlement summary for the authenticated provider
 */
router.get(
  '/settlements/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }
    const period = (req.query.period as 'week' | 'month' | 'year') || 'month';

    const summary = await settlementService.getSettlementSummary(providerId, period);

    res.json({
      success: true,
      data: summary,
    });
  })
);

// ===================================
// PAYOUT CONFIGURATION ROUTES
// ===================================

/**
 * GET /api/payout/config
 * Get payout configuration for the authenticated provider
 */
router.get(
  '/config',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }

    const config = payoutEngineService.getProviderPayoutConfig(providerId);

    res.json({
      success: true,
      data: config || {
        schedule: {
          frequency: 'weekly',
          dayOfWeek: 5,
          minPayoutAmount: 100,
        },
        enabled: true,
      },
    });
  })
);

/**
 * PUT /api/payout/config
 * Update payout configuration for the authenticated provider
 */
router.put(
  '/config',
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.user?._id.toString();
    if (!providerId) {
      throw new ApiError(401, 'Authentication required');
    }
    const { frequency, dayOfWeek, dayOfMonth, minPayoutAmount, maxPayoutAmount, bankDetails } = req.body;

    const config = payoutEngineService.updateProviderPayoutConfig(providerId, {
      schedule: {
        frequency: frequency || 'weekly',
        dayOfWeek,
        dayOfMonth,
        minPayoutAmount: minPayoutAmount || 100,
        maxPayoutAmount,
      },
      bankDetails,
    });

    logger.info('Payout config updated by provider', {
      providerId,
      config,
      action: 'PAYOUT_CONFIG_UPDATED_BY_PROVIDER',
    });

    res.json({
      success: true,
      data: config,
    });
  })
);

// ===================================
// ADMIN ROUTES
// ===================================

/**
 * POST /api/payout/admin/generate-settlements
 * Generate settlements for all providers (Admin only)
 */
router.post(
  '/admin/generate-settlements',
  authMiddleware.requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { periodStart, periodEnd } = req.body;

    if (!periodStart || !periodEnd) {
      throw new ApiError(400, 'Period start and end dates are required');
    }

    const results = await settlementService.generateBulkSettlements(
      new Date(periodStart),
      new Date(periodEnd)
    );

    logger.info('Bulk settlements generated', {
      ...results,
      action: 'BULK_SETTLEMENTS_GENERATED',
    });

    res.json({
      success: true,
      data: results,
    });
  })
);

/**
 * POST /api/payout/admin/approve-settlement/:settlementId
 * Approve a settlement (Admin only)
 */
router.post(
  '/admin/approve-settlement/:settlementId',
  authMiddleware.requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    const adminId = req.user?._id.toString();

    await settlementService.approveSettlement(settlementId, adminId);

    logger.info('Settlement approved by admin', {
      settlementId,
      adminId,
      action: 'SETTLEMENT_APPROVED_BY_ADMIN',
    });

    res.json({
      success: true,
      message: 'Settlement approved successfully',
    });
  })
);

/**
 * POST /api/payout/admin/pay-settlement/:settlementId
 * Pay a settlement (Admin only)
 */
router.post(
  '/admin/pay-settlement/:settlementId',
  authMiddleware.requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;

    await settlementService.paySettlement(settlementId);

    logger.info('Settlement paid by admin', {
      settlementId,
      adminId: req.user?._id.toString(),
      action: 'SETTLEMENT_PAID_BY_ADMIN',
    });

    res.json({
      success: true,
      message: 'Settlement paid successfully',
    });
  })
);

/**
 * POST /api/payout/admin/process-payouts
 * Process due payouts (Admin only)
 */
router.post(
  '/admin/process-payouts',
  authMiddleware.requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { batchSize = 100 } = req.body;

    const results = await payoutEngineService.processDuePayouts(batchSize);

    logger.info('Payouts processed', {
      ...results,
      action: 'PAYOUTS_PROCESSED',
    });

    res.json({
      success: true,
      data: results,
    });
  })
);

/**
 * POST /api/payout/admin/retry-failed-payouts
 * Retry failed payouts (Admin only)
 */
router.post(
  '/admin/retry-failed-payouts',
  authMiddleware.requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { batchSize = 50 } = req.body;

    const results = await payoutEngineService.retryFailedPayouts(batchSize);

    logger.info('Failed payouts retried', {
      ...results,
      action: 'FAILED_PAYOUTS_RETRIED',
    });

    res.json({
      success: true,
      data: results,
    });
  })
);

/**
 * GET /api/payout/admin/all-payouts
 * Get all payouts (Admin only)
 */
router.get(
  '/admin/all-payouts',
  authMiddleware.requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      page = '1',
      limit = '20',
      status,
      providerId,
      startDate,
      endDate,
    } = req.query;

    const query: Record<string, unknown> = {};

    if (status) query.status = status;
    if (providerId) query.providerId = new Types.ObjectId(providerId as string);
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) (query.createdAt as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (query.createdAt as Record<string, Date>).$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    const [payouts, total] = await Promise.all([
      Payout.find(query)
        .populate('providerId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string, 10)),
      Payout.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: payouts,
      pagination: {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        total,
        pages: Math.ceil(total / parseInt(limit as string, 10)),
      },
    });
  })
);

/**
 * GET /api/payout/admin/all-settlements
 * Get all settlements (Admin only)
 */
router.get(
  '/admin/all-settlements',
  authMiddleware.requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      page = '1',
      limit = '20',
      status,
      providerId,
      startDate,
      endDate,
    } = req.query;

    const query: Record<string, unknown> = {};

    if (status) query.status = status;
    if (providerId) query.providerId = new Types.ObjectId(providerId as string);
    if (startDate || endDate) {
      query.periodStart = {};
      if (startDate) (query.periodStart as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (query.periodStart as Record<string, Date>).$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    const [settlements, total] = await Promise.all([
      Settlement.find(query)
        .populate('providerId', 'firstName lastName email')
        .sort({ periodStart: -1 })
        .skip(skip)
        .limit(parseInt(limit as string, 10)),
      Settlement.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: settlements,
      pagination: {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        total,
        pages: Math.ceil(total / parseInt(limit as string, 10)),
      },
    });
  })
);

export default router;
