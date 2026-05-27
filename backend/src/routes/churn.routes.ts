import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { churnService, ChurnFilters, DateRange } from '../services/churn.service';
import { churnPredictionService, ChurnRisk, CustomerSegment, RetentionCampaign, RetentionAction } from '../services/churnPrediction.service';
import { ChurnRiskReport } from '../services/churn.service';

const router = Router();

/**
 * @route   GET /api/admin/churn/stats
 * @desc    Get comprehensive churn statistics
 * @access  Admin
 */
router.get('/admin/churn/stats', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // Default to last 30 days
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate
    ? new Date(startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  const stats = await churnService.getChurnStats({ startDate: start, endDate: end });

  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * @route   GET /api/admin/churn/at-risk
 * @desc    Get at-risk customers list
 * @access  Admin
 */
router.get('/admin/churn/at-risk', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const {
    minRiskLevel,
    minDaysInactive,
    maxDaysInactive,
    limit = '100',
    offset = '0',
  } = req.query;

  // Validate risk level
  const validLevels = ['low', 'medium', 'high', 'critical'];
  if (minRiskLevel && !validLevels.includes(minRiskLevel as string)) {
    throw new ApiError(400, `Invalid risk level. Must be one of: ${validLevels.join(', ')}`);
  }

  const filters: ChurnFilters = {
    limit: parseInt(limit as string, 10),
    offset: parseInt(offset as string, 10),
  };

  if (minRiskLevel) {
    filters.minRiskLevel = minRiskLevel as 'low' | 'medium' | 'high' | 'critical';
  }

  if (minDaysInactive) {
    const minDays = parseInt(minDaysInactive as string, 10);
    if (isNaN(minDays) || minDays < 0) {
      throw new ApiError(400, 'minDaysInactive must be a non-negative number');
    }
    filters.minDaysInactive = minDays;
  }

  if (maxDaysInactive) {
    const maxDays = parseInt(maxDaysInactive as string, 10);
    if (isNaN(maxDays) || maxDays < 0) {
      throw new ApiError(400, 'maxDaysInactive must be a non-negative number');
    }
    filters.maxDaysInactive = maxDays;
  }

  const atRiskCustomers = await churnService.getAtRiskCustomers(filters);

  res.json({
    success: true,
    data: {
      customers: atRiskCustomers,
      total: atRiskCustomers.length,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
      },
    },
  });
}));

/**
 * @route   GET /api/admin/churn/customers/:id/risk
 * @desc    Get churn risk for specific customer
 * @access  Admin
 */
router.get('/admin/churn/customers/:id/risk', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Customer ID is required');
  }

  const risk = await churnService.calculateChurnRisk(id);

  res.json({
    success: true,
    data: risk,
  });
}));

/**
 * @route   GET /api/admin/churn/overview
 * @desc    Get churn overview for dashboard widgets
 * @access  Admin
 */
router.get('/admin/churn/overview', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const stats = await churnService.getChurnStats({
    startDate: thirtyDaysAgo,
    endDate: now,
  });

  const atRiskCustomers = await churnService.getAtRiskCustomers({
    minRiskLevel: 'medium',
    limit: 5,
  });

  res.json({
    success: true,
    data: {
      totalAtRisk: stats.atRiskCustomers,
      churnRate: stats.churnRate,
      byRiskLevel: stats.byRiskLevel,
      averageRiskScore: stats.averageRiskScore,
      totalLifetimeValueAtRisk: stats.totalLifetimeValueAtRisk,
      topRiskFactors: stats.topRiskFactors.slice(0, 3),
      recentAlerts: atRiskCustomers.map(c => ({
        customerId: c.customerId,
        customerName: c.customerName,
        riskLevel: c.riskLevel,
        riskScore: c.riskScore,
        daysSinceLastBooking: c.daysSinceLastBooking,
        recommendedAction: c.recommendedActions[0] || 'Monitor',
      })),
    },
  });
}));

/**
 * @route   POST /api/admin/churn/refresh
 * @desc    Force refresh churn data cache
 * @access  Admin
 */
router.post('/admin/churn/refresh', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  await churnService.clearCache();

  res.json({
    success: true,
    message: 'Churn data cache refreshed',
  });
}));

// =============================================================================
// Existing churn prediction routes (for backward compatibility)
// =============================================================================

/**
 * @route   GET /api/churn/predict/:userId
 * @desc    Get churn risk prediction for a specific user
 * @access  Admin
 */
router.get('/churn/predict/:userId', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }

  const risk: ChurnRisk = await churnPredictionService.predictChurnRisk(userId);

  res.json({
    success: true,
    data: risk,
  });
}));

/**
 * @route   GET /api/churn/at-risk
 * @desc    Get all at-risk customers
 * @access  Admin
 */
router.get('/churn/at-risk', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { minRiskLevel = 'medium', limit = '100', offset = '0' } = req.query;

  const validLevels = ['medium', 'high', 'critical'];
  if (!validLevels.includes(minRiskLevel as string)) {
    throw new ApiError(400, `Invalid risk level. Must be one of: ${validLevels.join(', ')}`);
  }

  const parsedLimit = parseInt(limit as string, 10);
  const parsedOffset = parseInt(offset as string, 10);

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
    throw new ApiError(400, 'Limit must be between 1 and 500');
  }

  if (isNaN(parsedOffset) || parsedOffset < 0) {
    throw new ApiError(400, 'Offset must be a non-negative number');
  }

  const result = await churnPredictionService.getAtRiskCustomers({
    minRiskLevel: minRiskLevel as 'medium' | 'high' | 'critical',
    limit: parsedLimit,
    offset: parsedOffset,
  });

  res.json({
    success: true,
    data: {
      customers: result.customers,
      total: result.total,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + result.customers.length < result.total,
      },
    },
  });
}));

/**
 * @route   GET /api/churn/segments
 * @desc    Get customer segments for targeted marketing
 * @access  Admin
 */
router.get('/churn/segments', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const segments: CustomerSegment[] = await churnPredictionService.getCustomerSegments();

  res.json({
    success: true,
    data: segments,
  });
}));

/**
 * @route   POST /api/churn/campaigns
 * @desc    Create a retention campaign
 * @access  Admin
 */
router.post('/churn/campaigns', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { riskLevels, minDaysInactive, maxDaysInactive, minBookings, maxBookings, loyaltyTiers, categories } = req.body;

  const campaign: RetentionCampaign = await churnPredictionService.createRetentionCampaign({
    riskLevels,
    minDaysInactive,
    maxDaysInactive,
    minBookings,
    maxBookings,
    loyaltyTiers,
    categories,
  });

  res.status(201).json({
    success: true,
    data: campaign,
  });
}));

/**
 * @route   POST /api/churn/execute/:userId
 * @desc    Execute retention action for a user
 * @access  Admin
 */
router.post('/churn/execute/:userId', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { action } = req.body as { action: RetentionAction };

  if (!action || !action.type) {
    throw new ApiError(400, 'Action is required with type property');
  }

  const result = await churnPredictionService.executeRetentionAction(userId, action);

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * @route   GET /api/churn/stats
 * @desc    Get churn statistics
 * @access  Admin
 */
router.get('/churn/stats', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  // Get at-risk customers to calculate stats
  const { customers } = await churnPredictionService.getAtRiskCustomers({ limit: 1000 });

  const stats = {
    totalAtRisk: customers.length,
    byRiskLevel: {
      critical: customers.filter(c => c.riskLevel === 'critical').length,
      high: customers.filter(c => c.riskLevel === 'high').length,
      medium: customers.filter(c => c.riskLevel === 'medium').length,
      low: customers.filter(c => c.riskLevel === 'low').length,
    },
    averageRiskScore: customers.length > 0
      ? customers.reduce((sum, c) => sum + c.riskScore, 0) / customers.length
      : 0,
    totalLifetimeValueAtRisk: customers.reduce((sum, c) => sum + c.lifetimeValue, 0),
    topRiskFactors: calculateTopRiskFactors(customers),
  };

  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * @route   GET /api/churn/overview
 * @desc    Get churn overview for dashboard
 * @access  Admin
 */
router.get('/churn/overview', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const { customers } = await churnPredictionService.getAtRiskCustomers({ minRiskLevel: 'medium', limit: 100 });
  const segments = await churnPredictionService.getCustomerSegments();

  res.json({
    success: true,
    data: {
      atRiskCount: customers.length,
      criticalCount: customers.filter(c => c.riskLevel === 'critical').length,
      highCount: customers.filter(c => c.riskLevel === 'high').length,
      mediumCount: customers.filter(c => c.riskLevel === 'medium').length,
      segments,
      recentAlerts: customers.slice(0, 5).map(c => ({
        userId: c.userId.toString(),
        riskLevel: c.riskLevel,
        riskScore: c.riskScore,
        daysSinceLastBooking: c.daysSinceLastBooking,
        recommendedAction: c.recommendedActions[0]?.title || 'Monitor',
      })),
    },
  });
}));

/**
 * Calculate top risk factors across at-risk customers
 */
function calculateTopRiskFactors(customers: ChurnRisk[]): Array<{ factor: string; count: number }> {
  const factorCounts: Record<string, number> = {};

  for (const customer of customers) {
    for (const factor of customer.factors) {
      if (factor.severity !== 'low') {
        factorCounts[factor.name] = (factorCounts[factor.name] || 0) + 1;
      }
    }
  }

  return Object.entries(factorCounts)
    .map(([factor, count]) => ({ factor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export default router;
