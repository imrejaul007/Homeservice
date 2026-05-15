import { Request, Response, NextFunction } from 'express';
import { customerOpsService } from '../services/customerOps.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { Types } from 'mongoose';

// ============================================
// Validation Schemas (inline for simplicity)
// ============================================

const abuseFlagTypes = [
  'high_refund_rate',
  'chargeback',
  'coupon_abuse',
  'fake_referral',
  'suspicious_activity',
  'spam',
  'fake_review',
  'multiple_accounts',
  'payment_fraud',
];

const customerTiers = ['new', 'regular', 'trusted', 'flagged', 'banned'];

// ============================================
// Customer List & Search
// ============================================

/**
 * Get paginated list of customers with metrics
 * GET /api/admin/customers
 */
export const getCustomerList = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const {
    search,
    tier,
    riskLevel,
    isBlocked,
    minTrustScore,
    maxTrustScore,
    hasUnresolvedFlags,
    dateFrom,
    dateTo,
    page = '1',
    limit = '20',
    sortBy = 'trustScore',
    sortOrder = 'asc',
  } = req.query;

  const filters: Record<string, unknown> = {};

  if (search) filters.search = search as string;
  if (tier) filters.tier = tier as string;
  if (riskLevel) filters.riskLevel = riskLevel as string;
  if (isBlocked !== undefined) filters.isBlocked = isBlocked === 'true';
  if (minTrustScore !== undefined) filters.minTrustScore = parseInt(minTrustScore as string);
  if (maxTrustScore !== undefined) filters.maxTrustScore = parseInt(maxTrustScore as string);
  if (hasUnresolvedFlags !== undefined) filters.hasUnresolvedFlags = hasUnresolvedFlags === 'true';
  if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
  if (dateTo) filters.dateTo = new Date(dateTo as string);

  const result = await customerOpsService.getCustomerList(
    filters as any,
    parseInt(page as string),
    parseInt(limit as string),
    sortBy as string,
    sortOrder as 'asc' | 'desc'
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// Customer Detail
// ============================================

/**
 * Get detailed information about a customer
 * GET /api/admin/customers/:id
 */
export const getCustomerDetail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const result = await customerOpsService.getCustomerDetail(id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// Trust Score
// ============================================

/**
 * Get trust score breakdown for a customer
 * GET /api/admin/customers/:id/trust-score
 */
export const getTrustScoreBreakdown = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const result = await customerOpsService.getTrustScoreBreakdown(id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Refresh trust score for a customer
 * POST /api/admin/customers/:id/refresh-trust-score
 */
export const refreshTrustScore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.refreshTrustScore(id, adminId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// Abuse Flags
// ============================================

/**
 * Add an abuse flag to a customer
 * POST /api/admin/customers/:id/flags
 */
export const addAbuseFlag = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { type, reason } = req.body;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  if (!type || !abuseFlagTypes.includes(type)) {
    throw new ApiError(400, `Invalid flag type. Must be one of: ${abuseFlagTypes.join(', ')}`);
  }

  if (!reason || reason.trim().length < 10) {
    throw new ApiError(400, 'Reason must be at least 10 characters');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.addAbuseFlag(id, type, reason.trim(), adminId);

  res.status(200).json(result);
});

/**
 * Resolve an abuse flag
 * PATCH /api/admin/customers/:id/flags/:flagIndex/resolve
 */
export const resolveAbuseFlag = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id, flagIndex } = req.params;
  const { resolutionNotes } = req.body;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const index = parseInt(flagIndex);
  if (isNaN(index) || index < 0) {
    throw new ApiError(400, 'Invalid flag index');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.resolveAbuseFlag(id, index, resolutionNotes || '', adminId);

  res.status(200).json(result);
});

// ============================================
// Blocking/Unblocking
// ============================================

/**
 * Block a customer
 * POST /api/admin/customers/:id/block
 */
export const blockCustomer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  if (!reason || reason.trim().length < 10) {
    throw new ApiError(400, 'Reason must be at least 10 characters');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.blockCustomer(id, reason.trim(), adminId);

  res.status(200).json(result);
});

/**
 * Unblock a customer
 * POST /api/admin/customers/:id/unblock
 */
export const unblockCustomer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.unblockCustomer(id, adminId);

  res.status(200).json(result);
});

// ============================================
// Tier Management
// ============================================

/**
 * Adjust customer tier
 * PATCH /api/admin/customers/:id/tier
 */
export const adjustTier = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { tier, reason } = req.body;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  if (!tier || !customerTiers.includes(tier)) {
    throw new ApiError(400, `Invalid tier. Must be one of: ${customerTiers.join(', ')}`);
  }

  if (!reason || reason.trim().length < 10) {
    throw new ApiError(400, 'Reason must be at least 10 characters');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.adjustTier(id, tier, reason.trim(), adminId);

  res.status(200).json(result);
});

// ============================================
// Abuse Scan
// ============================================

/**
 * Run abuse scan on a customer
 * POST /api/admin/customers/:id/abuse-scan
 */
export const runAbuseScan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.runAbuseScan(id, adminId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// Dashboard Stats
// ============================================

/**
 * Get dashboard statistics
 * GET /api/admin/customers/stats
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await customerOpsService.getDashboardStats();

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// Metrics Sync
// ============================================

/**
 * Sync metrics for a customer from booking data
 * POST /api/admin/customers/:id/sync-metrics
 */
export const syncCustomerMetrics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  await customerOpsService.syncMetricsFromBookings(id);

  res.status(200).json({
    success: true,
    message: 'Metrics synced successfully',
  });
});

// ============================================
// Initialize Metrics
// ============================================

/**
 * Initialize metrics for all customers (admin only)
 * POST /api/admin/customers/initialize-metrics
 */
export const initializeAllMetrics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await customerOpsService.initializeMetricsForAllCustomers();

  res.status(200).json({
    success: true,
    data: result,
  });
});
