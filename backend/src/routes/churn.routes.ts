import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { churnPredictionService, ChurnRisk, CustomerSegment, RetentionCampaign, RetentionAction } from '../services/churnPrediction.service';

const router = Router();

/**
 * @route   GET /api/churn/predict/:userId
 * @desc    Get churn risk prediction for a specific user
 * @access  Admin
 */
router.get('/predict/:userId', authenticate, asyncHandler(async (req: Request, res: Response) => {
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
router.get('/at-risk', authenticate, asyncHandler(async (req: Request, res: Response) => {
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
router.get('/segments', authenticate, asyncHandler(async (_req: Request, res: Response) => {
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
router.post('/campaigns', authenticate, asyncHandler(async (req: Request, res: Response) => {
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
router.post('/execute/:userId', authenticate, asyncHandler(async (req: Request, res: Response) => {
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
router.get('/stats', authenticate, asyncHandler(async (_req: Request, res: Response) => {
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
router.get('/overview', authenticate, asyncHandler(async (_req: Request, res: Response) => {
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
