import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import ProviderVerification from '../models/providerVerification.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { providerOpsService } from '../services/providerOps.service';
import { fraudDetectionService } from '../services/fraudDetection.service';

// ============================================
// Provider Operations Controller
// ============================================

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

  // SECURITY FIX: Upload KYC documents to Cloudinary instead of local storage
  let documentUrl: string;

  try {
    const { uploadBufferToCloudinary } = await import('../utils/cloudinary');
    const result = await uploadBufferToCloudinary(req.file.buffer, 'kyc/documents', {
      resourceType: 'raw', // KYC documents may be PDFs, images, etc.
      publicId: `${providerId}_${documentType}_${Date.now()}`,
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
  const { reason, type, endDate } = req.body;
  const adminUser = req.user as any;

  if (!reason) {
    throw new ApiError(400, 'Suspension reason is required');
  }

  const result = await providerOpsService.suspendProvider(
    providerId,
    adminUser._id.toString(),
    reason,
    type || 'temporary',
    endDate ? new Date(endDate) : undefined
  );

  logger.info('PROVIDER_OPS: Provider suspended', {
    providerId,
    adminId: adminUser._id,
    reason,
    type,
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
      },
    },
  ]);
  const agg = qualityAgg[0] || {};

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
        avgRating: Math.round((agg.avgRating || 0) * 10) / 10,
      },
      fraud: fraudStats,
      sla: {
        compliantProviders: total,
        violationsCount: 0,
      },
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
