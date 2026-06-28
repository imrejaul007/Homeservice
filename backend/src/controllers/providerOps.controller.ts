import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import ProviderVerification from '../models/providerVerification.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { providerOpsService } from '../services/providerOps.service';
import { fraudDetectionService } from '../services/fraudDetection.service';

/**
 * Escape regex special characters for safe pattern matching
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// Provider Operations Controller
// ============================================

/**
 * Search providers for admin autocomplete/typeahead
 * GET /api/provider-ops/providers/search?q={query}&limit={limit}
 */
export const searchProviders = asyncHandler(async (req: Request, res: Response) => {
  const { q, limit = '10' } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw new ApiError(400, 'Search query must be at least 2 characters');
  }

  const searchQuery = q.trim();
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));

  // Escape special regex characters for safe pattern matching
  const escapedQuery = escapeRegex(searchQuery);
  const regexPattern = new RegExp(escapedQuery, 'i');

  // Search across user fields and business name
  // Use $or to search multiple fields with case-insensitive regex
  const searchFilter = {
    role: 'provider',
    isDeleted: false,
    $or: [
      { firstName: regexPattern },
      { lastName: regexPattern },
      { email: regexPattern },
      { 'businessInfo.businessName': regexPattern },
    ],
  };

  // Execute query to find matching users
  const users = await User.find(searchFilter)
    .select('_id firstName lastName email accountStatus businessInfo')
    .limit(limitNum)
    .lean();

  // If we need more results, also search ProviderProfile directly for businessName
  let providerIds = users.map(u => u._id);

  if (users.length < limitNum) {
    const profileSearchFilter = {
      'businessInfo.businessName': regexPattern,
      isDeleted: false,
    };

    const profiles = await ProviderProfile.find(profileSearchFilter)
      .select('userId businessInfo')
      .limit(limitNum)
      .lean();

    const additionalIds = profiles
      .map(p => p.userId)
      .filter(id => !providerIds.some(pid => pid.equals(id)));

    // Fetch additional users not already in results
    if (additionalIds.length > 0) {
      const additionalUsers = await User.find({
        _id: { $in: additionalIds },
        role: 'provider',
        isDeleted: false,
      })
        .select('_id firstName lastName email accountStatus businessInfo')
        .limit(limitNum - users.length)
        .lean();

      users.push(...additionalUsers);
    }
  }

  // Format response with id, name, email, businessName, status
  const results = users.map(user => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return {
      id: user._id.toString(),
      name: fullName || user.email,
      email: user.email,
      businessName: (user as any).businessInfo?.businessName || null,
      status: user.accountStatus,
    };
  });

  res.json({
    success: true,
    data: {
      results,
      count: results.length,
    },
  });
});

/**
 * Get paginated list of providers with filters
 * GET /api/provider-ops/providers
 */
export const getProviders = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    qualityScoreMin,
    qualityScoreMax,
    city,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const filters = {
    status: status as any,
    qualityScoreMin: qualityScoreMin ? Number(qualityScoreMin) : undefined,
    qualityScoreMax: qualityScoreMax ? Number(qualityScoreMax) : undefined,
    city: city as string,
    search: search as string,
    page: Number(page),
    limit: Math.min(Number(limit), 100),
    sortBy: sortBy as any,
    sortOrder: sortOrder as 'asc' | 'desc',
  };

  const result = await providerOpsService.getProvidersWithFilters(filters);

  res.json({
    success: true,
    data: {
      providers: result.providers,
      pagination: result.pagination,
    },
  });
});

/**
 * Get single provider details
 * GET /api/provider-ops/providers/:providerId
 */
export const getProviderDetails = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  // Use findOne with userId to match the convention used by other endpoints
  const provider = await ProviderProfile.findOne({ userId: providerId })
    .populate('userId', 'firstName lastName email phone accountStatus createdAt');

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  res.json({
    success: true,
    data: { provider },
  });
});

/**
 * Get provider verification details
 * GET /api/provider-ops/verification/:providerId
 */
export const getVerification = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  let verification = await ProviderVerification.findOne({ providerId })
    .populate('reviewHistory.performedBy', 'firstName lastName email');

  res.json({
    success: true,
    data: { verification: verification ?? null },
  });
});

/**
 * Upload KYC document
 * POST /api/provider-ops/verification/:providerId/documents
 */
export const uploadKycDocument = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { documentType } = req.body;

  if (!req.file) {
    throw new ApiError(400, 'Document file is required');
  }

  // SECURITY FIX: Upload KYC documents to Cloudinary with user-specific folder isolation
  let documentUrl: string;

  try {
    const { uploadBufferToCloudinary } = await import('../utils/cloudinary');
    // SECURITY FIX: Use kyc/{userId}/documents for proper isolation between users
    const result = await uploadBufferToCloudinary(req.file.buffer, `kyc/${providerId}/documents`, {
      resourceType: 'raw', // KYC documents may be PDFs, images, etc.
      publicId: `${documentType}_${Date.now()}`,
    });
    documentUrl = result.secureUrl;
  } catch (uploadError) {
    logger.error('Failed to upload KYC document to Cloudinary', {
      providerId,
      documentType,
      error: uploadError instanceof Error ? uploadError.message : String(uploadError),
      action: 'KYC_CLOUDINARY_UPLOAD_FAILED',
    });
    throw new ApiError(500, 'Failed to upload document. Please try again.');
  }

  const verification = await providerOpsService.uploadKycDocument(
    providerId,
    documentType,
    documentUrl,
    {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    }
  );

  res.status(201).json({
    success: true,
    data: { verification },
  });
});

/**
 * Verify KYC document
 * POST /api/provider-ops/verification/:providerId/documents/:documentId/verify
 */
export const verifyDocument = asyncHandler(async (req: Request, res: Response) => {
  const { providerId, documentId } = req.params;
  const { verified, notes } = req.body;

  if (typeof verified !== 'boolean') {
    throw new ApiError(400, 'verified must be a boolean');
  }

  const adminUser = req.user as any;
  const verification = await providerOpsService.verifyKycDocument(
    providerId,
    documentId,
    verified,
    adminUser._id.toString(),
    notes
  );

  logger.info('PROVIDER_OPS: Document verified', {
    providerId,
    documentId,
    verified,
    adminId: adminUser._id,
  });

  res.json({
    success: true,
    data: { verification },
  });
});

/**
 * Submit provider for review
 * POST /api/provider-ops/verification/:providerId/submit
 */
export const submitForReview = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const adminUser = req.user as any;

  const result = await providerOpsService.submitForReview(providerId, adminUser._id.toString());

  res.json({
    success: true,
    data: {
      verification: result.verification,
      onboardingStatus: result.onboardingStatus,
    },
  });
});

/**
 * Get provider onboarding status
 * GET /api/provider-ops/onboarding/:providerId
 */
export const getOnboardingStatus = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  const status = await providerOpsService.getOnboardingStatus(providerId);

  res.json({
    success: true,
    data: status,
  });
});

/**
 * Get provider metrics
 * GET /api/provider-ops/metrics/:providerId
 */
export const getProviderMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  const metrics = await providerOpsService.getProviderMetrics(providerId);

  res.json({
    success: true,
    data: { metrics },
  });
});

/**
 * Approve provider
 * POST /api/provider-ops/providers/:providerId/approve
 */
export const approveProvider = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { notes } = req.body;
  const adminUser = req.user as any;

  const result = await providerOpsService.approveProvider(
    providerId,
    adminUser._id.toString(),
    notes
  );

  logger.info('PROVIDER_OPS: Provider approved', {
    providerId,
    adminId: adminUser._id,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Reject provider
 * POST /api/provider-ops/providers/:providerId/reject
 */
export const rejectProvider = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { reason, notes } = req.body;
  const adminUser = req.user as any;

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const result = await providerOpsService.rejectProvider(
    providerId,
    adminUser._id.toString(),
    reason,
    notes
  );

  logger.info('PROVIDER_OPS: Provider rejected', {
    providerId,
    adminId: adminUser._id,
    reason,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Suspend provider
 * POST /api/provider-ops/providers/:providerId/suspend
 */
export const suspendProvider = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { reason, type, endDate, notifyCustomers = true, cancelBookings = false, cancellationMessage } = req.body;
  const adminUser = req.user as any;

  if (!reason) {
    throw new ApiError(400, 'Suspension reason is required');
  }

  const result = await providerOpsService.suspendProvider(
    providerId,
    adminUser._id.toString(),
    reason,
    type || 'temporary',
    endDate ? new Date(endDate) : undefined,
    {
      notifyCustomers,
      cancelBookings,
      cancellationMessage,
    }
  );

  logger.info('PROVIDER_OPS: Provider suspended', {
    providerId,
    adminId: adminUser._id,
    reason,
    type,
    notifyCustomers,
    cancelBookings,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Reactivate provider
 * POST /api/provider-ops/providers/:providerId/reactivate
 */
export const reactivateProvider = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { notes } = req.body;
  const adminUser = req.user as any;

  const result = await providerOpsService.reactivateProvider(
    providerId,
    adminUser._id.toString(),
    notes
  );

  logger.info('PROVIDER_OPS: Provider reactivated', {
    providerId,
    adminId: adminUser._id,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Get SLA metrics
 * GET /api/provider-ops/sla/:providerId
 */
export const getSlaMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  const metrics = await providerOpsService.getSlaMetrics(providerId);

  res.json({
    success: true,
    data: { slaMetrics: metrics },
  });
});

/**
 * Get providers with SLA violations
 * GET /api/provider-ops/sla/violations
 */
export const getSlaViolations = asyncHandler(async (req: Request, res: Response) => {
  const result = await providerOpsService.getProvidersWithSlaViolations();

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Run fraud check
 * POST /api/provider-ops/fraud/check/:providerId
 */
export const runFraudCheck = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  const { report, flagsPersisted } = await providerOpsService.runFraudCheck(providerId);

  logger.info('PROVIDER_OPS: Fraud check completed', {
    providerId,
    riskScore: report.riskScore,
    riskLevel: report.riskLevel,
    flagsPersisted,
  });

  res.json({
    success: true,
    data: { report, flagsPersisted },
  });
});

/**
 * Get fraud status
 * GET /api/provider-ops/fraud/status/:providerId
 */
export const getFraudStatus = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  const status = await providerOpsService.getProviderFraudStatus(providerId);

  res.json({
    success: true,
    data: status,
  });
});

/**
 * Resolve fraud flag
 * POST /api/provider-ops/fraud/resolve/:providerId/:flagId
 */
export const resolveFraudFlag = asyncHandler(async (req: Request, res: Response) => {
  const { providerId, flagId } = req.params;
  const { resolution } = req.body;
  const adminUser = req.user as any;

  if (!resolution) {
    throw new ApiError(400, 'Resolution is required');
  }

  await fraudDetectionService.resolveFraudFlag(
    providerId,
    flagId,
    adminUser._id.toString(),
    resolution
  );

  logger.info('PROVIDER_OPS: Fraud flag resolved', {
    providerId,
    flagId,
    adminId: adminUser._id,
  });

  res.json({
    success: true,
  });
});

/**
 * Get fraud statistics
 * GET /api/provider-ops/fraud/stats
 */
export const getFraudStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await fraudDetectionService.getFraudStats();

  res.json({
    success: true,
    data: stats,
  });
});

/**
 * Get document verification status
 * GET /api/provider-ops/verification/:providerId/documents
 */
export const getDocumentVerificationStatus = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;

  const status = await providerOpsService.getDocumentVerificationStatus(providerId);

  res.json({
    success: true,
    data: status,
  });
});

/**
 * Get dashboard statistics
 * GET /api/provider-ops/dashboard/stats
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  // Get provider counts
  const [total, pending, inProgress, approved, suspended, rejected] = await Promise.all([
    ProviderProfile.countDocuments(),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'pending' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'in_progress' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': { $in: ['approved', 'verified'] } }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'suspended' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'rejected' }),
  ]);

  const fraudStats = await fraudDetectionService.getFraudStats();

  const qualityAgg = await ProviderProfile.aggregate([
    {
      $group: {
        _id: null,
        avgQuality: { $avg: '$analytics.performanceMetrics.qualityScore' },
        avgReliability: { $avg: '$analytics.performanceMetrics.reliabilityScore' },
        avgRating: { $avg: '$reviewsData.averageRating' },
        totalBookings: { $sum: '$analytics.bookingStats.totalBookings' },
        completedBookings: { $sum: '$analytics.bookingStats.completedBookings' },
        avgResponseRate: { $avg: '$analytics.performanceMetrics.responseRate' },
        avgAcceptanceRate: { $avg: '$analytics.performanceMetrics.acceptanceRate' },
        totalEarnings: { $sum: '$analytics.revenueStats.totalEarnings' },
        pendingPayout: { $sum: '$financials.payout.pendingAmount' },
      },
    },
  ]);
  const agg = qualityAgg[0] || {};

  // Real SLA computation: a provider is "compliant" when they have
  // analytics.performanceMetrics.responseRate >= 80, acceptanceRate >= 80,
  // and the completion rate (completedBookings / totalBookings) >= 0.8.
  // Providers without bookings or with no metrics are excluded (treated as
  // "insufficient data", not compliant nor violating).
  const slaAgg = await ProviderProfile.aggregate([
    {
      $match: {
        'analytics.bookingStats.totalBookings': { $gt: 0 },
      },
    },
    {
      $project: {
        responseRate: { $ifNull: ['$analytics.performanceMetrics.responseRate', 0] },
        acceptanceRate: { $ifNull: ['$analytics.performanceMetrics.acceptanceRate', 0] },
        completionRate: {
          $cond: [
            { $gt: ['$analytics.bookingStats.totalBookings', 0] },
            {
              $divide: [
                { $ifNull: ['$analytics.bookingStats.completedBookings', 0] },
                '$analytics.bookingStats.totalBookings',
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        isCompliant: {
          $and: [
            { $gte: ['$responseRate', 80] },
            { $gte: ['$acceptanceRate', 80] },
            { $gte: ['$completionRate', 0.8] },
          ],
        },
        isViolating: {
          $or: [
            { $lt: ['$responseRate', 60] },
            { $lt: ['$acceptanceRate', 60] },
            { $lt: ['$completionRate', 0.5] },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        compliantProviders: { $sum: { $cond: ['$isCompliant', 1, 0] } },
        violationsCount: { $sum: { $cond: ['$isViolating', 1, 0] } },
      },
    },
  ]);
  const slaSummary = slaAgg[0] || { compliantProviders: 0, violationsCount: 0 };

  // Real quality / reliability / rating distribution buckets.
  // Quality & reliability live on providerProfile; rating distribution is
  // derived from the stored per-provider ratingDistribution counters.
  const distributionAgg = await ProviderProfile.aggregate([
    {
      $group: {
        _id: null,
        qualityExcellent: {
          $sum: {
            $cond: [{ $gte: ['$analytics.performanceMetrics.qualityScore', 80] }, 1, 0],
          },
        },
        qualityGood: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$analytics.performanceMetrics.qualityScore', 60] },
                  { $lt: ['$analytics.performanceMetrics.qualityScore', 80] },
                ],
              },
              1,
              0,
            ],
          },
        },
        qualityNeedsImprovement: {
          $sum: {
            $cond: [{ $lt: ['$analytics.performanceMetrics.qualityScore', 60] }, 1, 0],
          },
        },
        reliabilityExcellent: {
          $sum: {
            $cond: [{ $gte: ['$analytics.performanceMetrics.reliabilityScore', 80] }, 1, 0],
          },
        },
        reliabilityGood: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$analytics.performanceMetrics.reliabilityScore', 60] },
                  { $lt: ['$analytics.performanceMetrics.reliabilityScore', 80] },
                ],
              },
              1,
              0,
            ],
          },
        },
        reliabilityNeedsImprovement: {
          $sum: {
            $cond: [{ $lt: ['$analytics.performanceMetrics.reliabilityScore', 60] }, 1, 0],
          },
        },
        rating5: { $sum: { $ifNull: ['$reviewsData.ratingDistribution.5', 0] } },
        rating4: { $sum: { $ifNull: ['$reviewsData.ratingDistribution.4', 0] } },
        rating3: { $sum: { $ifNull: ['$reviewsData.ratingDistribution.3', 0] } },
        rating2: { $sum: { $ifNull: ['$reviewsData.ratingDistribution.2', 0] } },
        rating1: { $sum: { $ifNull: ['$reviewsData.ratingDistribution.1', 0] } },
      },
    },
  ]);
  const dist = distributionAgg[0] || {
    qualityExcellent: 0,
    qualityGood: 0,
    qualityNeedsImprovement: 0,
    reliabilityExcellent: 0,
    reliabilityGood: 0,
    reliabilityNeedsImprovement: 0,
    rating5: 0,
    rating4: 0,
    rating3: 0,
    rating2: 0,
    rating1: 0,
  };

  const safeTotal = total || 0;
  const pct = (count: number) => (safeTotal > 0 ? Math.round((count / safeTotal) * 100) : 0);

  res.json({
    success: true,
    data: {
      providers: {
        total,
        pending,
        inProgress,
        approved,
        suspended,
        rejected,
      },
      metrics: {
        avgQualityScore: Math.round(agg.avgQuality || 0),
        avgReliabilityScore: Math.round(agg.avgReliability || 0),
        totalBookings: agg.totalBookings || 0,
        completedBookings: agg.completedBookings || 0,
        avgRating: Math.round((agg.avgRating || 0) * 10) / 10,
        avgResponseRate: Math.round(agg.avgResponseRate || 0),
        avgAcceptanceRate: Math.round(agg.avgAcceptanceRate || 0),
        totalEarnings: agg.totalEarnings || 0,
        pendingPayout: agg.pendingPayout || 0,
      },
      fraud: fraudStats,
      sla: {
        compliantProviders: slaSummary.compliantProviders,
        violationsCount: slaSummary.violationsCount,
      },
      distributions: {
        quality: {
          excellent: { count: dist.qualityExcellent, percentage: pct(dist.qualityExcellent) },
          good: { count: dist.qualityGood, percentage: pct(dist.qualityGood) },
          needsImprovement: {
            count: dist.qualityNeedsImprovement,
            percentage: pct(dist.qualityNeedsImprovement),
          },
        },
        reliability: {
          excellent: { count: dist.reliabilityExcellent, percentage: pct(dist.reliabilityExcellent) },
          good: { count: dist.reliabilityGood, percentage: pct(dist.reliabilityGood) },
          needsImprovement: {
            count: dist.reliabilityNeedsImprovement,
            percentage: pct(dist.reliabilityNeedsImprovement),
          },
        },
        rating: {
          5: dist.rating5,
          4: dist.rating4,
          3: dist.rating3,
          2: dist.rating2,
          1: dist.rating1,
        },
      },
      hasData: safeTotal > 0,
    },
  });
});

/**
 * Place payout hold
 * POST /api/provider-ops/providers/:providerId/payout-hold
 */
export const placePayoutHold = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { reason, frozenAmount } = req.body;
  const adminUser = req.user as any;

  if (!reason) {
    throw new ApiError(400, 'Hold reason is required');
  }

  const providerProfile = await providerOpsService.placePayoutHold(
    providerId,
    adminUser._id.toString(),
    reason,
    frozenAmount
  );

  logger.info('PROVIDER_OPS: Payout hold placed', {
    providerId,
    adminId: adminUser._id,
    frozenAmount,
  });

  res.json({
    success: true,
    data: { provider: providerProfile },
  });
});

/**
 * Release payout hold
 * POST /api/provider-ops/providers/:providerId/payout-release
 */
export const releasePayoutHold = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { releaseAmount } = req.body;
  const adminUser = req.user as any;

  const providerProfile = await providerOpsService.releasePayoutHold(
    providerId,
    adminUser._id.toString(),
    releaseAmount
  );

  logger.info('PROVIDER_OPS: Payout hold released', {
    providerId,
    adminId: adminUser._id,
    releaseAmount,
  });

  res.json({
    success: true,
    data: { provider: providerProfile },
  });
});

/**
 * Get services for a specific provider
 * GET /api/provider-ops/providers/:providerId/services
 */
export const getProviderServices = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const {
    page = '1',
    limit = '20',
    status,
  } = req.query;

  // Validate provider exists
  const provider = await ProviderProfile.findOne({ userId: providerId });
  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  // Build query
  const query: Record<string, unknown> = { providerId: new mongoose.Types.ObjectId(providerId) };

  // Optional status filter
  if (status && typeof status === 'string' && status !== 'all') {
    const validStatuses = ['draft', 'active', 'inactive', 'pending_review', 'rejected'];
    if (validStatuses.includes(status)) {
      query.status = status;
    }
  }

  // Calculate pagination
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  // Execute queries in parallel
  const [services, totalCount] = await Promise.all([
    Service.find(query)
      .select('name price category status createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Service.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalCount / limitNum);

  res.json({
    success: true,
    data: {
      items: services,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        nextPage: pageNum < totalPages ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null,
      },
    },
  });
});
