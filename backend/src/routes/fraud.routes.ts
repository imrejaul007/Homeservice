import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { fraudDetectionService, FraudReport, SuspiciousActivity } from '../services/fraudDetection.service';

const router = Router();

/**
 * @route   GET /api/fraud/analyze/:providerId
 * @desc    Analyze a specific provider for fraud indicators
 * @access  Admin
 */
router.get('/analyze/:providerId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  const report: FraudReport = await fraudDetectionService.analyzeProvider(providerId);

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * @route   GET /api/fraud/stats
 * @desc    Get fraud detection statistics
 * @access  Admin
 */
router.get('/stats', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const stats = await fraudDetectionService.getFraudStats();

  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * @route   POST /api/fraud/flag/:providerId
 * @desc    Flag suspicious activity for a provider
 * @access  Admin
 */
router.post('/flag/:providerId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { type, severity, description, evidence } = req.body;

  if (!type || !severity || !description) {
    throw new ApiError(400, 'Type, severity, and description are required');
  }

  const validSeverities = ['low', 'medium', 'high', 'critical'];
  if (!validSeverities.includes(severity)) {
    throw new ApiError(400, `Invalid severity. Must be one of: ${validSeverities.join(', ')}`);
  }

  const activity: SuspiciousActivity = {
    type,
    severity,
    description,
    evidence: evidence || {},
    detectedAt: new Date(),
  };

  await fraudDetectionService.flagSuspiciousActivity(providerId, activity);

  res.json({
    success: true,
    message: 'Suspicious activity flagged successfully',
  });
}));

/**
 * @route   POST /api/fraud/resolve/:providerId/:flagId
 * @desc    Resolve a fraud flag
 * @access  Admin
 */
router.post('/resolve/:providerId/:flagId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId, flagId } = req.params;
  const { resolution } = req.body;
  const adminId = (req.user as any)?._id?.toString();

  if (!resolution) {
    throw new ApiError(400, 'Resolution is required');
  }

  await fraudDetectionService.resolveFraudFlag(providerId, flagId, adminId, resolution);

  res.json({
    success: true,
    message: 'Fraud flag resolved successfully',
  });
}));

/**
 * @route   POST /api/fraud/batch-analyze
 * @desc    Batch analyze multiple providers
 * @access  Admin
 */
router.post('/batch-analyze', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerIds } = req.body;

  if (!providerIds || !Array.isArray(providerIds) || providerIds.length === 0) {
    throw new ApiError(400, 'Provider IDs array is required');
  }

  if (providerIds.length > 50) {
    throw new ApiError(400, 'Maximum 50 providers can be analyzed at once');
  }

  const reports: FraudReport[] = await fraudDetectionService.batchAnalyzeProviders(providerIds);

  res.json({
    success: true,
    data: {
      reports,
      totalAnalyzed: reports.length,
      highRiskCount: reports.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
    },
  });
}));

/**
 * @route   GET /api/fraud/report/:providerId
 * @desc    Generate fraud report for a provider
 * @access  Admin
 */
router.get('/report/:providerId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  const report: FraudReport = await fraudDetectionService.generateFraudReport(providerId);

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * @route   GET /api/fraud/overview
 * @desc    Get fraud overview for dashboard
 * @access  Admin
 */
router.get('/overview', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  const stats = await fraudDetectionService.getFraudStats();

  res.json({
    success: true,
    data: {
      totalFlagged: stats.totalFlagged,
      recentFlags: stats.recentFlags,
      resolvedFlags: stats.resolvedFlags,
      pendingFlags: stats.totalFlagged - stats.resolvedFlags,
      bySeverity: stats.bySeverity,
      alertLevel: getAlertLevel(stats),
      summary: generateFraudSummary(stats),
    },
  });
}));

/**
 * @route   GET /api/fraud/patterns
 * @desc    Get fraud pattern configuration
 * @access  Admin
 */
router.get('/patterns', authenticate, asyncHandler(async (_req: Request, _res: Response) => {
  // Return fraud patterns configuration (read-only)
  const patterns = [
    { id: 'duplicate_accounts', name: 'Duplicate Account Detection', severity: 'high' },
    { id: 'velocity_check', name: 'Velocity Check', severity: 'medium' },
    { id: 'suspicious_document', name: 'Suspicious Document', severity: 'critical' },
    { id: 'address_mismatch', name: 'Address Mismatch', severity: 'medium' },
    { id: 'high_risk_country', name: 'High Risk Country', severity: 'high' },
    { id: 'payment_failure_spike', name: 'Payment Failure Spike', severity: 'medium' },
    { id: 'no_show_pattern', name: 'No-Show Pattern', severity: 'high' },
    { id: 'fake_reviews', name: 'Suspicious Review Pattern', severity: 'high' },
  ];

  _res.json({
    success: true,
    data: patterns,
  });
}));

/**
 * Determine alert level based on stats
 */
function getAlertLevel(stats: { bySeverity: Record<string, number>; recentFlags: number }): 'low' | 'medium' | 'high' | 'critical' {
  const critical = stats.bySeverity.critical || 0;
  const high = stats.bySeverity.high || 0;
  const recent = stats.recentFlags;

  if (critical > 0) return 'critical';
  if (high >= 5) return 'high';
  if (recent >= 10) return 'medium';
  return 'low';
}

/**
 * Generate fraud summary text
 */
function generateFraudSummary(stats: { totalFlagged: number; recentFlags: number; resolvedFlags: number }): string {
  const unresolved = stats.totalFlagged - stats.resolvedFlags;

  if (stats.totalFlagged === 0) {
    return 'No fraud flags detected. Platform appears secure.';
  }

  if (unresolved === 0) {
    return `All ${stats.totalFlagged} fraud flags have been resolved.`;
  }

  return `Found ${unresolved} unresolved fraud flags (${stats.recentFlags} in last 7 days).`;
}

export default router;
