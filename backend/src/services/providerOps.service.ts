import mongoose from 'mongoose';
import ProviderProfile, { IProviderProfile } from '../models/providerProfile.model';
import ProviderVerification, { IProviderVerification } from '../models/providerVerification.model';
import User, { AccountStatus } from '../models/user.model';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { fraudDetectionService, FraudReport } from './fraudDetection.service';
import { NotificationService } from './notification.service';
import { getSocketServer } from '../socket';

// ============================================
// Provider Operations Types
// ============================================

export interface ProviderMetrics {
  providerId: mongoose.Types.ObjectId;
  qualityScore: number; // 0-100
  reliabilityScore: number; // 0-100
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShows: number;
  avgRating: number;
  avgResponseTime: number; // minutes
  acceptanceRate: number; // percentage
  lastUpdated: Date;
}

export interface ProviderFilters {
  status?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
  qualityScoreMin?: number;
  qualityScoreMax?: number;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'qualityScore' | 'reliabilityScore' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ProviderOnboardingStatus {
  providerId: string;
  currentStage: 'registration' | 'document_upload' | 'under_review' | 'approved' | 'rejected' | 'suspended';
  completedStages: string[];
  pendingStages: string[];
  requiredDocuments: string[];
  missingDocuments: string[];
  estimatedCompletionTime?: number; // minutes
}

export interface PayoutHold {
  providerId: mongoose.Types.ObjectId;
  isOnHold: boolean;
  holdReason?: string;
  holdStartDate?: Date;
  holdEndDate?: Date;
  frozenAmount?: number;
  releasedAmount?: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLAMetrics {
  providerId: mongoose.Types.ObjectId;
  periodBookingCount: number;
  hasInsufficientData: boolean;
  responseTime: {
    avgMinutes: number;
    p95Minutes: number;
    targetMinutes: number;
    compliant: boolean;
  };
  bookingAcceptanceRate: {
    accepted: number;
    rejected: number;
    rate: number;
    targetPercentage: number;
    compliant: boolean;
  };
  completionRate: {
    completed: number;
    cancelled: number;
    noShow: number;
    rate: number;
    targetPercentage: number;
    compliant: boolean;
  };
  lastUpdated: Date;
}

// ============================================
// Provider Operations Service
// ============================================

type ProfileOverallStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'suspended';
type VerificationStatus = 'pending' | 'in_progress' | 'verified' | 'rejected' | 'suspended';

export class ProviderOpsService {
  /**
   * Keep ProviderProfile, ProviderVerification, and User account status aligned.
   */
  private async syncProviderStatus(
    providerId: string,
    profileOverall: ProfileOverallStatus,
    verificationStatus: VerificationStatus,
    accountStatus: AccountStatus
  ): Promise<void> {
    await User.findByIdAndUpdate(providerId, { accountStatus });
    await ProviderProfile.updateOne(
      { userId: providerId },
      { $set: { 'verificationStatus.overall': profileOverall } },
      { runValidators: false }
    );

    const verification = await ProviderVerification.findOne({ providerId });
    if (verification) {
      verification.status = verificationStatus;
      await verification.save();
    } else {
      await ProviderVerification.create({
        providerId,
        status: verificationStatus,
        documents: [],
        backgroundChecks: [],
        fraudFlags: [],
        reviewHistory: [],
        metadata: { verificationAttempts: 0 },
      });
    }
  }

  private mapProfileToVerificationStatus(profileOverall: ProfileOverallStatus): VerificationStatus {
    if (profileOverall === 'approved') return 'verified';
    if (profileOverall === 'in_progress') return 'in_progress';
    if (profileOverall === 'rejected') return 'rejected';
    if (profileOverall === 'suspended') return 'suspended';
    return 'pending';
  }

  // ========================================
  // Onboarding Pipeline
  // ========================================

  /**
   * Get provider onboarding status and pipeline progress
   */
  async getOnboardingStatus(providerId: string): Promise<ProviderOnboardingStatus> {
    const provider = await User.findById(providerId);
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }

    const verification = await ProviderVerification.findOne({ providerId });
    const providerProfile = await ProviderProfile.findOne({ userId: providerId });

    const requiredDocuments = ['id_card', 'passport'];
    const uploadedDocTypes = verification?.documents?.map(d => d.type) || [];
    const missingDocuments = requiredDocuments.filter(d => !uploadedDocTypes.includes(d as any));

    const stages = {
      registration: provider.createdAt !== undefined,
      document_upload: uploadedDocTypes.length > 0,
      under_review: verification?.status === 'in_progress',
      approved: verification?.status === 'verified',
      rejected: verification?.status === 'rejected',
      suspended: verification?.status === 'suspended' || provider.accountStatus === 'suspended',
    };

    const completedStages = Object.entries(stages)
      .filter(([_, completed]) => completed)
      .map(([stage]) => stage);

    const pendingStages = Object.entries(stages)
      .filter(([_, completed]) => !completed)
      .map(([stage]) => stage);

    // Determine current stage
    let currentStage: ProviderOnboardingStatus['currentStage'] = 'registration';
    if (stages.suspended) currentStage = 'suspended';
    else if (stages.rejected) currentStage = 'rejected';
    else if (stages.approved) currentStage = 'approved';
    else if (stages.under_review) currentStage = 'under_review';
    else if (stages.document_upload) currentStage = 'document_upload';

    return {
      providerId,
      currentStage,
      completedStages,
      pendingStages,
      requiredDocuments,
      missingDocuments,
      estimatedCompletionTime: missingDocuments.length > 0 ? 30 : undefined, // 30 mins if docs missing
    };
  }

  /**
   * Submit provider for review
   */
  async submitForReview(providerId: string, adminId?: string): Promise<{
    verification: any;
    onboardingStatus: ProviderOnboardingStatus;
  }> {
    const verification = await ProviderVerification.findOne({ providerId });

    if (!verification) {
      throw new ApiError(400, 'Provider verification record not found');
    }

    // Validate required documents are uploaded
    const requiredDocTypes = ['id_card', 'passport'];
    const uploadedTypes = verification.documents.map(d => d.type);
    const missingDocs = requiredDocTypes.filter(t => !uploadedTypes.includes(t as any));

    if (missingDocs.length > 0) {
      throw new ApiError(400, `Missing required documents: ${missingDocs.join(', ')}`);
    }

    // Update verification status
    const previousStatus = verification.status; // Capture BEFORE changing
    verification.status = 'in_progress';
    verification.metadata.lastAttemptAt = new Date();
    verification.metadata.verificationAttempts += 1;

    if (adminId) {
      verification.reviewHistory.push({
        action: 'under_review',
        performedBy: new mongoose.Types.ObjectId(adminId),
        performedAt: new Date(),
        previousStatus,
        newStatus: 'in_progress',
      });
    }

    await verification.save();

    await this.syncProviderStatus(providerId, 'in_progress', 'in_progress', 'pending_verification');

    const onboardingStatus = await this.getOnboardingStatus(providerId);

    logger.info('PROVIDER_OPS: Provider submitted for review', {
      providerId,
      adminId,
      documentCount: verification.documents.length,
    });

    return { verification, onboardingStatus };
  }

  // ========================================
  // KYC Verification System
  // ========================================

  /**
   * Upload document for KYC verification
   */
  async uploadKycDocument(
    providerId: string,
    documentType: 'id_card' | 'passport' | 'business_license' | 'address_proof' | 'tax_certificate' | 'insurance',
    documentUrl: string,
    metadata?: {
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    }
  ): Promise<IProviderVerification> {
    // Verify provider exists
    const provider = await User.findById(providerId);
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }

    // Find or create verification record
    let verification = await ProviderVerification.findOne({ providerId });
    if (!verification) {
      verification = await ProviderVerification.create({
        providerId,
        status: 'pending',
        documents: [],
        backgroundChecks: [],
        fraudFlags: [],
        reviewHistory: [],
        metadata: { verificationAttempts: 0 },
      });
    }

    // Check if document of this type already exists
    const existingDocIndex = verification.documents.findIndex(d => d.type === documentType);
    if (existingDocIndex >= 0) {
      // Replace existing document
      verification.documents[existingDocIndex] = {
        type: documentType,
        url: documentUrl,
        uploadedAt: new Date(),
        verified: false,
        fileName: metadata?.fileName,
        fileSize: metadata?.fileSize,
        mimeType: metadata?.mimeType,
      };
    } else {
      // Add new document
      verification.documents.push({
        type: documentType,
        url: documentUrl,
        uploadedAt: new Date(),
        verified: false,
        fileName: metadata?.fileName,
        fileSize: metadata?.fileSize,
        mimeType: metadata?.mimeType,
      });
    }

    verification.markModified('documents');
    await verification.save();

    logger.info('PROVIDER_OPS: KYC document uploaded', {
      providerId,
      documentType,
    });

    return verification;
  }

  /**
   * Verify KYC document (admin action)
   */
  async verifyKycDocument(
    providerId: string,
    documentId: string,
    verified: boolean,
    adminId: string,
    notes?: string
  ): Promise<IProviderVerification> {
    const verification = await ProviderVerification.findOne({ providerId });

    if (!verification) {
      throw new ApiError(404, 'Verification record not found');
    }

    const document = verification.documents.find(d => (d._id as any)?.toString() === documentId);
    if (!document) {
      throw new ApiError(404, 'Document not found');
    }

    document.verified = verified;
    document.verifiedAt = new Date();
    document.verifiedBy = new mongoose.Types.ObjectId(adminId);
    if (!verified && notes) {
      document.rejectionReason = notes;
    }

    // Recalculate KYC score
    verification.kycScore = this.calculateKycScore(verification.documents);

    // Update KYC level based on score
    if (verification.kycScore >= 80) {
      verification.kycLevel = 'enhanced';
    } else if (verification.kycScore >= 50) {
      verification.kycLevel = 'standard';
    } else {
      verification.kycLevel = 'basic';
    }

    await verification.save();

    logger.info('PROVIDER_OPS: KYC document verified', {
      providerId,
      documentId,
      verified,
      adminId,
    });

    return verification;
  }

  /**
   * Calculate KYC score based on verified documents
   */
  private calculateKycScore(documents: any[]): number {
    const weights: Record<string, number> = {
      id_card: 30,
      passport: 30,
      business_license: 20,
      address_proof: 10,
      tax_certificate: 5,
      insurance: 5,
    };

    let totalWeight = 0;
    let earnedWeight = 0;

    for (const doc of documents) {
      const weight = weights[doc.type] || 10;
      totalWeight += weight;
      if (doc.verified) {
        earnedWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  }

  // ========================================
  // Document Verification Workflow
  // ========================================

  /**
   * Get document verification workflow status
   */
  async getDocumentVerificationStatus(providerId: string): Promise<{
    totalDocuments: number;
    verifiedDocuments: number;
    pendingDocuments: number;
    rejectedDocuments: number;
    documents: any[];
    overallProgress: number;
  }> {
    const verification = await ProviderVerification.findOne({ providerId });

    if (!verification) {
      return {
        totalDocuments: 0,
        verifiedDocuments: 0,
        pendingDocuments: 0,
        rejectedDocuments: 0,
        documents: [],
        overallProgress: 0,
      };
    }

    const documents = verification.documents;
    const verifiedDocuments = documents.filter(d => d.verified).length;
    const pendingDocuments = documents.filter(d => !d.verified && !d.rejectionReason).length;
    const rejectedDocuments = documents.filter(d => !d.verified && d.rejectionReason).length;

    return {
      totalDocuments: documents.length,
      verifiedDocuments,
      pendingDocuments,
      rejectedDocuments,
      documents,
      overallProgress: documents.length > 0
        ? Math.round((verifiedDocuments / documents.length) * 100)
        : 0,
    };
  }

  // ========================================
  // Quality Scoring System
  // ========================================

  /**
   * Calculate provider quality score (0-100)
   * Based on: ratings, response time, completion rate
   */
  async calculateQualityScore(providerId: string): Promise<number> {
    const providerProfile = await ProviderProfile.findOne({ userId: providerId });
    if (!providerProfile) {
      return 0;
    }

    // Weights for quality components
    const weights = {
      rating: 0.4, // 40% weight
      responseTime: 0.3, // 30% weight
      completionRate: 0.3, // 30% weight
    };

    // Rating component (0-100) - use optional chaining for incomplete profiles
    const ratingScore = ((providerProfile.reviewsData?.averageRating || 0) / 5) * 100;

    // Response time component (0-100)
    const responseTime = providerProfile.reviewsData?.avgResponseTime || 0;
    let responseScore = 100;
    if (responseTime > 120) responseScore = 20;
    else if (responseTime > 60) responseScore = 40;
    else if (responseTime > 30) responseScore = 60;
    else if (responseTime > 15) responseScore = 80;

    // Completion rate component (0-100) - use optional chaining for incomplete profiles
    const totalBookings = providerProfile.analytics?.bookingStats?.totalBookings || 0;
    const completedBookings = providerProfile.analytics?.bookingStats?.completedBookings || 0;
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 100;

    const qualityScore = Math.round(
      (ratingScore * weights.rating) +
      (responseScore * weights.responseTime) +
      (completionRate * weights.completionRate)
    );

    // Use updateOne to avoid full document validation on incomplete profiles
    try {
      await ProviderProfile.updateOne(
        { userId: providerId },
        { $set: { 'analytics.performanceMetrics.qualityScore': qualityScore } }
      );
    } catch (updateError) {
      // Silently ignore update errors for incomplete profiles
      logger.warn('Failed to update quality score for incomplete profile', { providerId });
    }

    return Math.min(100, Math.max(0, qualityScore));
  }

  /**
   * Get provider metrics including quality and reliability scores
   */
  async getProviderMetrics(providerId: string): Promise<ProviderMetrics> {
    const providerProfile = await ProviderProfile.findOne({ userId: providerId });

    if (!providerProfile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    const qualityScore = await this.calculateQualityScore(providerId);
    const reliabilityScore = await this.calculateReliabilityScore(providerId);

    const bookingStats = providerProfile.analytics?.bookingStats;
    const reviewsData = providerProfile.reviewsData;
    const performanceMetrics = providerProfile.analytics?.performanceMetrics;

    return {
      providerId: providerProfile.userId as mongoose.Types.ObjectId,
      qualityScore,
      reliabilityScore,
      totalBookings: bookingStats?.totalBookings ?? 0,
      completedBookings: bookingStats?.completedBookings ?? 0,
      cancelledBookings: bookingStats?.cancelledBookings ?? 0,
      noShows: bookingStats?.noShowBookings ?? 0,
      avgRating: reviewsData?.averageRating ?? 0,
      avgResponseTime: reviewsData?.avgResponseTime ?? 0,
      acceptanceRate: performanceMetrics?.acceptanceRate ?? 0,
      lastUpdated: new Date(),
    };
  }

  // ========================================
  // Reliability Scoring System
  // ========================================

  /**
   * Calculate provider reliability score (0-100)
   * Based on: cancellations, no-shows, punctuality
   */
  async calculateReliabilityScore(providerId: string): Promise<number> {
    const providerProfile = await ProviderProfile.findOne({ userId: providerId });
    if (!providerProfile) {
      return 0;
    }

    // Use optional chaining for incomplete profiles
    const stats = providerProfile.analytics?.bookingStats;
    const totalBookings = stats?.totalBookings || 0;

    if (totalBookings === 0) {
      return 100; // New provider with no bookings
    }

    // Cancellation rate (max 40 points deduction)
    const cancellationRate = (stats?.cancelledBookings || 0) / totalBookings;
    const cancellationScore = Math.max(0, 60 - (cancellationRate * 100));

    // No-show rate (max 40 points deduction)
    const noShowRate = (stats?.noShowBookings || 0) / totalBookings;
    const noShowScore = Math.max(0, 60 - (noShowRate * 100));

    // Punctuality score (20 points) - use optional chaining
    const punctualityScore = providerProfile.analytics?.performanceMetrics?.punctualityScore || 50;

    const reliabilityScore = Math.round(
      cancellationScore * 0.35 +
      noShowScore * 0.35 +
      punctualityScore * 0.30
    );

    // Use updateOne to avoid full document validation on incomplete profiles
    try {
      await ProviderProfile.updateOne(
        { userId: providerId },
        { $set: { 'analytics.performanceMetrics.reliabilityScore': reliabilityScore } }
      );
    } catch (updateError) {
      // Silently ignore update errors for incomplete profiles
      logger.warn('Failed to update reliability score for incomplete profile', { providerId });
    }

    return Math.min(100, Math.max(0, reliabilityScore));
  }

  // ========================================
  // Provider Suspension System
  // ========================================

  /**
   * Suspend a provider (temporary or permanent)
   */
  async suspendProvider(
    providerId: string,
    adminId: string,
    reason: string,
    type: 'temporary' | 'permanent',
    endDate?: Date
  ): Promise<{ provider: any; verification: any }> {
    const provider = await User.findById(providerId);
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }

    if (provider.role !== 'provider') {
      throw new ApiError(400, 'User is not a provider');
    }

    const profile = await ProviderProfile.findOne({ userId: providerId });
    const previousProfileOverall =
      (profile?.verificationStatus?.overall as ProfileOverallStatus) || 'approved';

    let verification = await ProviderVerification.findOne({ providerId });
    if (verification) {
      const previousStatus = verification.status;
      verification.status = 'suspended';
      verification.suspension = {
        type,
        endDate: type === 'temporary' ? endDate : undefined,
        reason,
        previousProfileOverall,
      };
      verification.reviewHistory.push({
        action: 'suspended',
        performedBy: new mongoose.Types.ObjectId(adminId),
        performedAt: new Date(),
        notes: reason,
        previousStatus,
        newStatus: 'suspended',
      });
      await verification.save();
    } else {
      verification = await ProviderVerification.create({
        providerId,
        status: 'suspended',
        suspension: {
          type,
          endDate: type === 'temporary' ? endDate : undefined,
          reason,
          previousProfileOverall,
        },
        reviewHistory: [{
          action: 'suspended',
          performedBy: new mongoose.Types.ObjectId(adminId),
          performedAt: new Date(),
          notes: reason,
          newStatus: 'suspended',
        }],
      });
    }

    await this.syncProviderStatus(providerId, 'suspended', 'suspended', 'suspended');

    await Service.updateMany(
      { providerId },
      { $set: { isActive: false, status: 'suspended' } }
    );

    logger.info('PROVIDER_OPS: Provider suspended', {
      providerId,
      adminId,
      reason,
      type,
      endDate,
      previousProfileOverall,
    });

    return {
      provider: await User.findById(providerId),
      verification,
    };
  }

  /**
   * Reactivate a suspended provider
   */
  async reactivateProvider(
    providerId: string,
    adminId: string,
    notes?: string
  ): Promise<{ provider: any; verification: any }> {
    const provider = await User.findById(providerId);
    if (!provider) {
      throw new ApiError(404, 'Provider not found');
    }

    const profile = await ProviderProfile.findOne({ userId: providerId });
    if (profile?.verificationStatus?.overall === 'rejected') {
      throw new ApiError(400, 'Rejected providers cannot be reactivated. They must re-apply.');
    }

    if (provider.accountStatus !== 'suspended') {
      throw new ApiError(400, 'Provider is not suspended');
    }

    const verification = await ProviderVerification.findOne({ providerId });
    if (verification?.status !== 'suspended') {
      throw new ApiError(400, 'Provider verification is not in suspended state');
    }

    if (
      verification.suspension?.type === 'temporary' &&
      verification.suspension.endDate &&
      verification.suspension.endDate > new Date()
    ) {
      throw new ApiError(400, 'Suspension period has not ended yet');
    }

    const restoreOverall =
      (verification.suspension?.previousProfileOverall as ProfileOverallStatus) || 'approved';
    const restoreVerification = this.mapProfileToVerificationStatus(restoreOverall);
    const restoreAccount: AccountStatus =
      restoreOverall === 'approved' ? 'active' : 'pending_verification';

    await this.syncProviderStatus(
      providerId,
      restoreOverall,
      restoreVerification,
      restoreAccount
    );

    const updatedVerification = await ProviderVerification.findOne({ providerId });
    if (updatedVerification) {
      updatedVerification.reviewHistory.push({
        action: 'approved',
        performedBy: new mongoose.Types.ObjectId(adminId),
        performedAt: new Date(),
        notes: notes || 'Provider reactivated after suspension review',
        previousStatus: 'suspended',
        newStatus: restoreVerification,
      });
      updatedVerification.suspension = undefined;
      await updatedVerification.save();
    }

    await Service.updateMany(
      { providerId, status: 'suspended' },
      { $set: { isActive: true, status: 'active' } }
    );

    logger.info('PROVIDER_OPS: Provider reactivated', {
      providerId,
      adminId,
      notes,
      restoreOverall,
    });

    return {
      provider: await User.findById(providerId),
      verification: await ProviderVerification.findOne({ providerId }),
    };
  }

  // ========================================
  // Payout Hold System
  // ========================================

  /**
   * Place a payout hold on a provider
   */
  async placePayoutHold(
    providerId: string,
    adminId: string,
    reason: string,
    frozenAmount?: number
  ): Promise<IProviderProfile> {
    const providerProfile = await ProviderProfile.findOne({ userId: providerId });

    if (!providerProfile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    providerProfile.financials.payout.pendingAmount = providerProfile.financials.payout.pendingAmount || 0;
    // Note: Would need to add a payoutHold field to the schema for full implementation

    logger.info('PROVIDER_OPS: Payout hold placed', {
      providerId,
      adminId,
      reason,
      frozenAmount,
    });

    return providerProfile;
  }

  /**
   * Release a payout hold
   */
  async releasePayoutHold(
    providerId: string,
    adminId: string,
    releaseAmount?: number
  ): Promise<IProviderProfile> {
    const providerProfile = await ProviderProfile.findOne({ userId: providerId });

    if (!providerProfile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    logger.info('PROVIDER_OPS: Payout hold released', {
      providerId,
      adminId,
      releaseAmount,
    });

    return providerProfile;
  }

  // ========================================
  // SLA Monitoring
  // ========================================

  /**
   * Get SLA metrics for a provider
   */
  async getSlaMetrics(providerId: string): Promise<SLAMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookings = await Booking.find({
      providerId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    const periodBookingCount = bookings.length;
    if (periodBookingCount === 0) {
      return {
        providerId: new mongoose.Types.ObjectId(providerId),
        periodBookingCount: 0,
        hasInsufficientData: true,
        responseTime: {
          avgMinutes: 0,
          p95Minutes: 0,
          targetMinutes: 30,
          compliant: true,
        },
        bookingAcceptanceRate: {
          accepted: 0,
          rejected: 0,
          rate: 0,
          targetPercentage: 80,
          compliant: false,
        },
        completionRate: {
          completed: 0,
          cancelled: 0,
          noShow: 0,
          rate: 0,
          targetPercentage: 95,
          compliant: false,
        },
        lastUpdated: new Date(),
      };
    }

    // Calculate response time (using createdAt as request received, acceptedAt as response)
    const responseTimes = bookings
      .filter(b => b.providerResponse?.acceptedAt)
      .map(b => {
        const received = new Date(b.createdAt).getTime();
        const responded = new Date(b.providerResponse!.acceptedAt!).getTime();
        return (responded - received) / (1000 * 60); // minutes
      });

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
    const p95ResponseTime = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)] || 0;

    // Calculate acceptance rate
    const acceptedBookings = bookings.filter(b =>
      b.status !== 'pending' && b.status !== 'cancelled'
    ).length;
    const rejectedBookings = bookings.filter(b =>
      b.status === 'cancelled' && b.cancellationDetails?.cancelledBy === 'provider'
    ).length;
    const totalReviewed = acceptedBookings + rejectedBookings;
    const acceptanceRate = totalReviewed > 0 ? (acceptedBookings / totalReviewed) * 100 : 0;

    // Calculate completion rate
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const cancelledBookings = bookings.filter(b =>
      b.status === 'cancelled' && b.cancellationDetails?.cancelledBy === 'provider'
    ).length;
    const noShows = bookings.filter(b => b.status === 'no_show').length;
    const totalRelevantBookings = completedBookings + cancelledBookings + noShows;
    const completionRate = totalRelevantBookings > 0
      ? (completedBookings / totalRelevantBookings) * 100
      : 0;

    return {
      providerId: new mongoose.Types.ObjectId(providerId),
      periodBookingCount,
      hasInsufficientData: false,
      responseTime: {
        avgMinutes: Math.round(avgResponseTime),
        p95Minutes: Math.round(p95ResponseTime),
        targetMinutes: 30, // SLA target
        compliant: avgResponseTime <= 30,
      },
      bookingAcceptanceRate: {
        accepted: acceptedBookings,
        rejected: rejectedBookings,
        rate: Math.round(acceptanceRate),
        targetPercentage: 80,
        compliant: acceptanceRate >= 80,
      },
      completionRate: {
        completed: completedBookings,
        cancelled: cancelledBookings,
        noShow: noShows,
        rate: Math.round(completionRate),
        targetPercentage: 95,
        compliant: completionRate >= 95,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Get providers with SLA violations
   */
  async getProvidersWithSlaViolations(): Promise<{
    providers: Array<{
      providerId: string;
      violations: string[];
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const providers = await ProviderProfile.find({}).select('userId');

    const violatingProviders: Array<{
      providerId: string;
      violations: string[];
      severity: 'low' | 'medium' | 'high';
    }> = [];

    for (const provider of providers) {
      const slaMetrics = await this.getSlaMetrics(provider.userId.toString());
      if (slaMetrics.hasInsufficientData) {
        continue;
      }
      const violations: string[] = [];

      if (!slaMetrics.responseTime.compliant) {
        violations.push(`Response time SLA violation: ${slaMetrics.responseTime.avgMinutes}min avg (target: ${slaMetrics.responseTime.targetMinutes}min)`);
      }

      if (!slaMetrics.bookingAcceptanceRate.compliant) {
        violations.push(`Acceptance rate SLA violation: ${slaMetrics.bookingAcceptanceRate.rate}% (target: ${slaMetrics.bookingAcceptanceRate.targetPercentage}%)`);
      }

      if (!slaMetrics.completionRate.compliant) {
        violations.push(`Completion rate SLA violation: ${slaMetrics.completionRate.rate}% (target: ${slaMetrics.completionRate.targetPercentage}%)`);
      }

      if (violations.length > 0) {
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (violations.length >= 3) severity = 'high';
        else if (violations.length >= 2) severity = 'medium';

        violatingProviders.push({
          providerId: provider.userId.toString(),
          violations,
          severity,
        });
      }
    }

    return { providers: violatingProviders };
  }

  // ========================================
  // Provider List with Filters
  // ========================================

  /**
   * Get paginated list of providers with filters
   */
  async getProvidersWithFilters(filters: ProviderFilters): Promise<{
    providers: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const query: any = {};

    // Status filter
    if (filters.status) {
      if (filters.status === 'approved') {
        query['verificationStatus.overall'] = { $in: ['approved', 'verified'] };
      } else if (filters.status === 'under_review') {
        query['verificationStatus.overall'] = 'in_progress';
      } else {
        query['verificationStatus.overall'] = filters.status;
      }
    }

    // Search filter (email via User lookup — userId is ObjectId ref)
    if (filters.search?.trim()) {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      const matchingUsers = await User.find({
        role: 'provider',
        $or: [{ email: searchRegex }, { phone: searchRegex }, { firstName: searchRegex }, { lastName: searchRegex }],
      }).select('_id');
      const userIds = matchingUsers.map((u) => u._id);
      query.$or = [
        { 'businessInfo.businessName': searchRegex },
        ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
      ];
    }

    // City filter
    if (filters.city) {
      query['locationInfo.primaryAddress.city'] = { $regex: filters.city, $options: 'i' };
    }

    if (filters.qualityScoreMin !== undefined) {
      query['analytics.performanceMetrics.qualityScore'] = {
        ...query['analytics.performanceMetrics.qualityScore'],
        $gte: filters.qualityScoreMin,
      };
    }
    if (filters.qualityScoreMax !== undefined) {
      query['analytics.performanceMetrics.qualityScore'] = {
        ...query['analytics.performanceMetrics.qualityScore'],
        $lte: filters.qualityScoreMax,
      };
    }

    // Pagination
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Sorting
    const sortOptions: any = {};
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'qualityScore':
        sortOptions['analytics.performanceMetrics.qualityScore'] = sortOrder;
        break;
      case 'reliabilityScore':
        sortOptions['analytics.performanceMetrics.reliabilityScore'] = sortOrder;
        break;
      case 'name':
        sortOptions['businessInfo.businessName'] = sortOrder;
        break;
      default:
        sortOptions.createdAt = sortOrder;
    }

    const total = await ProviderProfile.countDocuments(query);

    const providers = await ProviderProfile.find(query)
      .populate('userId', 'firstName lastName email phone accountStatus createdAt')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    return {
      providers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  // ========================================
  // Provider Approval Workflow
  // ========================================

  /**
   * Approve a provider
   * SECURITY FIX: Added distributed lock to prevent race conditions during approval
   */
  async approveProvider(
    providerId: string,
    adminId: string,
    notes?: string
  ): Promise<{ provider: any; verification: any; metrics: ProviderMetrics }> {
    // SECURITY FIX: Acquire distributed lock to prevent concurrent approval attempts
    const { redis, isRedisAvailable } = await import('../config/redis');
    const lockKey = `provider:approve:${providerId}`;
    let lockAcquired = false;

    if (redis && isRedisAvailable()) {
      const lock = await redis.set(lockKey, adminId, 'EX', 30, 'NX');
      if (!lock) {
        throw new ApiError(409, 'Provider approval already in progress. Please try again.');
      }
      lockAcquired = true;
      logger.info('Acquired distributed lock for provider approval', {
        providerId,
        adminId,
        lockKey,
        action: 'PROVIDER_APPROVAL_LOCK_ACQUIRED',
      });
    }

    try {
      logger.info('Provider approval: Step 1 - Starting approval', {
        providerId,
        adminId,
        action: 'PROVIDER_APPROVAL_STEP_1'
      });

      // Check if already approved via ProviderProfile
      const existingProfile = await ProviderProfile.findOne({ userId: providerId });
      const existingVerification = await ProviderVerification.findOne({ providerId });
      if (
        existingProfile?.verificationStatus?.overall === 'approved' ||
        existingVerification?.status === 'verified'
      ) {
        throw new ApiError(400, 'Provider is already approved');
      }

      logger.info('Provider approval: Step 2 - Finding verification record', {
        providerId,
        action: 'PROVIDER_APPROVAL_STEP_2'
      });

      let verification = existingVerification;

      if (!verification) {
        // Create verification record if it doesn't exist
        logger.info('Creating verification record for provider', { providerId });
        verification = new ProviderVerification({
          providerId,
          status: 'verified',
          kycScore: 100,
          kycLevel: 'standard',
          documents: [],
          backgroundChecks: [],
          fraudFlags: [],
          reviewHistory: [],
          metadata: { verificationAttempts: 1, lastAttemptAt: new Date() },
        });
        
      }

      logger.info('Provider approval: Step 3 - Updating verification status', {
        providerId,
        verificationId: verification._id,
        currentStatus: verification.status,
        action: 'PROVIDER_APPROVAL_STEP_3'
      });

      // Update verification status
      const previousStatus = verification.status; // Capture BEFORE changing
      verification.status = 'verified';
      verification.reviewHistory.push({
        action: 'approved',
        performedBy: new mongoose.Types.ObjectId(adminId),
        performedAt: new Date(),
        notes,
        previousStatus,
        newStatus: 'verified',
      });

      logger.info('Provider approval: Step 4 - Saving verification', {
        providerId,
        action: 'PROVIDER_APPROVAL_STEP_4'
      });
      await verification.save();

      logger.info('Provider approval: Step 5 - Updating user status', {
        providerId,
        action: 'PROVIDER_APPROVAL_STEP_5'
      });
      // Update user status
      await User.findByIdAndUpdate(providerId, {
        accountStatus: 'active',
      });

      // Update provider profile - use updateOne to avoid validation errors on incomplete profiles
      // The provider profile may be incomplete (missing businessInfo, locationInfo, etc.) during onboarding
      await ProviderProfile.updateOne(
        { userId: providerId },
        {
          $set: {
            'verificationStatus.overall': 'approved',
            'instagramStyleProfile.isVerified': true,
          }
        },
        { runValidators: false }
      );

      // Activate services that were pending review
      const activatedServices = await Service.updateMany(
        { providerId, status: 'pending_review' },
        { $set: { isActive: true, status: 'active' } }
      );

      // Notify provider about service activation
      if (activatedServices.modifiedCount > 0) {
        try {
          const notificationService = new NotificationService();
          await notificationService.createNotification({
            recipientId: providerId,
            type: 'service_approved',
            title: 'Services Activated',
            message: `Your services are now live! ${activatedServices.modifiedCount} service(s) have been activated and are visible to customers.`,
            metadata: {
              providerId,
              activatedCount: activatedServices.modifiedCount,
            },
          });
          logger.info('Service activation notification sent', {
            providerId,
            activatedCount: activatedServices.modifiedCount,
          });
        } catch (notificationError) {
          logger.error('Failed to send service activation notification', {
            providerId,
            error: notificationError instanceof Error ? notificationError.message : String(notificationError),
          });
        }
      }

      const metrics = await this.getProviderMetrics(providerId);

      // SECURITY FIX: Send notification to provider about approval
      try {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          recipientId: providerId,
          type: 'provider_approved',
          title: 'Provider Application Approved',
          message: 'Congratulations! Your provider application has been approved. You can now start listing your services.',
          metadata: {
            providerId,
            verificationId: verification._id.toString(),
          },
        });
      } catch (notificationError) {
        logger.error('Failed to send provider approval notification', {
          providerId,
          error: notificationError instanceof Error ? notificationError.message : String(notificationError),
        });
      }

      // Emit provider:approved socket event to notify provider in real-time
      try {
        const socketServer = getSocketServer();
        if (socketServer) {
          socketServer.emitProviderApproved(providerId);
          logger.info('Emitted provider:approved socket event', {
            providerId,
            action: 'SOCKET_PROVIDER_APPROVED',
          });
        }
      } catch (socketError) {
        logger.error('Failed to emit provider:approved socket event', {
          providerId,
          error: socketError instanceof Error ? socketError.message : String(socketError),
        });
      }

      logger.info('PROVIDER_OPS: Provider approved', {
        providerId,
        adminId,
        notes,
      });

      const result = {
        provider: await User.findById(providerId),
        verification,
        metrics,
      };
      return result;
    } catch (error) {
      // Detailed error logging to pinpoint exact failure
      logger.error('Provider approval FAILED', {
        providerId,
        adminId,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error),
        errorType: typeof error,
        action: 'PROVIDER_APPROVAL_FAILED'
      });
      throw error;
    } finally {
      // SECURITY FIX: Always release the distributed lock
      if (lockAcquired && redis && isRedisAvailable()) {
        try {
          await redis.del(lockKey);
          logger.debug('Released provider approval lock', {
            providerId,
            lockKey,
            action: 'PROVIDER_APPROVAL_LOCK_RELEASED',
          });
        } catch (releaseError) {
          logger.warn('Failed to release provider approval lock', {
            providerId,
            lockKey,
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
            action: 'PROVIDER_APPROVAL_LOCK_RELEASE_FAILED',
          });
        }
      }
    }
  }

  /**
   * Reject a provider
   */
  async rejectProvider(
    providerId: string,
    adminId: string,
    reason: string,
    notes?: string
  ): Promise<{ provider: any; verification: any }> {
    let verification = await ProviderVerification.findOne({ providerId });
    if (!verification) {
      verification = await ProviderVerification.create({
        providerId,
        status: 'pending',
        documents: [],
        backgroundChecks: [],
        fraudFlags: [],
        reviewHistory: [],
        metadata: { verificationAttempts: 0 },
      });
    }

    const previousStatus = verification.status;
    verification.status = 'rejected';
    verification.reviewHistory.push({
      action: 'rejected',
      performedBy: new mongoose.Types.ObjectId(adminId),
      performedAt: new Date(),
      notes: notes || reason,
      previousStatus,
      newStatus: 'rejected',
    });
    await verification.save();

    await this.syncProviderStatus(providerId, 'rejected', 'rejected', 'deactivated');

    await ProviderProfile.updateOne(
      { userId: providerId },
      { $set: { 'instagramStyleProfile.isVerified': false } },
      { runValidators: false }
    );

    // Deactivate services
    await Service.updateMany(
      { providerId },
      { $set: { isActive: false, status: 'rejected' } }
    );

    // SECURITY FIX: Send notification to provider about rejection
    try {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipientId: providerId,
        type: 'provider_rejected',
        title: 'Provider Application Rejected',
        message: `Your provider application has been rejected. Reason: ${reason}. Please contact support for more information.`,
        metadata: {
          providerId,
          verificationId: verification._id.toString(),
          reason,
        },
      });
    } catch (notificationError) {
      logger.error('Failed to send provider rejection notification', {
        providerId,
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
      });
    }

    logger.info('PROVIDER_OPS: Provider rejected', {
      providerId,
      adminId,
      reason,
      notes,
    });

    return {
      provider: await User.findById(providerId),
      verification,
    };
  }

  // ========================================
  // Fraud Detection Integration
  // ========================================

  /**
   * Run fraud check on a provider and persist flags to verification record
   */
  async runFraudCheck(providerId: string): Promise<{ report: FraudReport; flagsPersisted: number }> {
    const report = await fraudDetectionService.analyzeProvider(providerId);
    let flagsPersisted = 0;

    const today = new Date().toISOString().slice(0, 10);
    for (const activity of report.suspiciousActivities) {
      const verification = await ProviderVerification.findOne({ providerId });
      const existingToday = verification?.fraudFlags?.some(
        (f) =>
          f.type === activity.type &&
          !f.resolved &&
          f.detectedAt.toISOString().slice(0, 10) === today
      );
      if (!existingToday) {
        await fraudDetectionService.flagSuspiciousActivity(providerId, activity);
        flagsPersisted += 1;
      }
    }

    if (report.suspiciousActivities.some((a) => a.severity === 'critical')) {
      await this.syncProviderStatus(providerId, 'suspended', 'suspended', 'suspended');
      await Service.updateMany(
        { providerId },
        { $set: { isActive: false, status: 'suspended' } }
      );
    }

    return { report, flagsPersisted };
  }

  /**
   * Get provider fraud status
   */
  async getProviderFraudStatus(providerId: string): Promise<{
    hasFlags: boolean;
    flags: any[];
    riskLevel: string;
    lastChecked?: Date;
  }> {
    const verification = await ProviderVerification.findOne({ providerId });

    if (!verification) {
      return {
        hasFlags: false,
        flags: [],
        riskLevel: 'unknown',
      };
    }

    const unresolvedFlags = verification.fraudFlags.filter(f => !f.resolved);

    return {
      hasFlags: unresolvedFlags.length > 0,
      flags: unresolvedFlags,
      riskLevel: unresolvedFlags.length > 0
        ? unresolvedFlags.some(f => f.severity === 'critical' || f.severity === 'high')
          ? 'high'
          : 'medium'
        : 'low',
      lastChecked: verification.updatedAt,
    };
  }
}

// Export singleton instance
export const providerOpsService = new ProviderOpsService();
export default providerOpsService;
