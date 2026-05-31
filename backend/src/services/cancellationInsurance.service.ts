import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type CoverageTier = 'basic' | 'standard' | 'premium' | 'comprehensive';

export interface InsuranceProduct {
  _id?: Types.ObjectId;
  productId: string;
  name: string;
  description: string;
  tier: CoverageTier;
  premiumPercentage: number; // Percentage of booking value
  premiumFixed: number; // Fixed premium amount
  coverageAmount: number; // Maximum coverage
  coverageDetails: {
    cancellationCoverage: number; // Percentage of booking value covered
    delayCoverage: number; // Hours of delay coverage
    noShowCoverage: number; // Amount covered for provider no-show
    qualityIssueCoverage: number; // Amount for quality issues
    priceGuarantee: boolean;
    prioritySupport: boolean;
    refundProcessingDays: number;
  };
  exclusions?: string[];
  validityPeriod: {
    startDate: Date;
    endDate: Date;
  };
  isActive: boolean;
  createdAt: Date;
}

export interface InsurancePolicy {
  _id?: Types.ObjectId;
  policyId: string;
  bookingId: Types.ObjectId;
  bookingNumber: string;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  productId: Types.ObjectId;
  productTier: CoverageTier;
  premiumPaid: number;
  coverageAmount: number;
  currency: string;
  status: 'active' | 'claimed' | 'expired' | 'cancelled' | 'pending_claim';
  claimId?: string;
  effectiveDate: Date;
  expiryDate: Date;
  purchasedAt: Date;
  claimedAt?: Date;
  claimAmount?: number;
  claimResolution?: string;
  metadata?: {
    bookingValue: number;
    serviceName: string;
    scheduledDate: Date;
    claimReason?: string;
  };
}

export interface InsuranceClaim {
  _id?: Types.ObjectId;
  claimId: string;
  policyId: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  claimType: 'cancellation' | 'delay' | 'no_show' | 'quality_issue' | 'price_protection';
  claimAmount: number;
  approvedAmount?: number;
  currency: string;
  status: 'submitted' | 'under_review' | 'approved' | 'denied' | 'resolved';
  reason: string;
  evidence?: {
    description?: string;
    screenshots?: string[];
    receipt?: string;
  };
  submittedAt: Date;
  reviewedAt?: Date;
  resolvedAt?: Date;
  reviewerNotes?: string;
}

// ============================================
// Insurance Configuration
// ============================================

const COVERAGE_TIERS: Record<CoverageTier, {
  premiumPercentage: number;
  coverageAmount: number;
  coverageDetails: InsuranceProduct['coverageDetails'];
}> = {
  basic: {
    premiumPercentage: 2,
    coverageAmount: 0.5, // 50% of booking value
    coverageDetails: {
      cancellationCoverage: 50,
      delayCoverage: 0,
      noShowCoverage: 0,
      qualityIssueCoverage: 0,
      priceGuarantee: false,
      prioritySupport: false,
      refundProcessingDays: 14,
    },
  },
  standard: {
    premiumPercentage: 4,
    coverageAmount: 0.75, // 75% of booking value
    coverageDetails: {
      cancellationCoverage: 75,
      delayCoverage: 24,
      noShowCoverage: 50,
      qualityIssueCoverage: 25,
      priceGuarantee: true,
      prioritySupport: false,
      refundProcessingDays: 10,
    },
  },
  premium: {
    premiumPercentage: 6,
    coverageAmount: 0.9, // 90% of booking value
    coverageDetails: {
      cancellationCoverage: 90,
      delayCoverage: 48,
      noShowCoverage: 75,
      qualityIssueCoverage: 50,
      priceGuarantee: true,
      prioritySupport: true,
      refundProcessingDays: 5,
    },
  },
  comprehensive: {
    premiumPercentage: 10,
    coverageAmount: 1.0, // 100% of booking value
    coverageDetails: {
      cancellationCoverage: 100,
      delayCoverage: 72,
      noShowCoverage: 100,
      qualityIssueCoverage: 75,
      priceGuarantee: true,
      prioritySupport: true,
      refundProcessingDays: 3,
    },
  },
};

// ============================================
// Cancellation Insurance Service
// ============================================

export class CancellationInsuranceService {
  private insuranceModel: any;
  private claimModel: any;

  constructor() {
    this.initializeModels();
  }

  private initializeModels(): void {
    try {
      this.insuranceModel = mongoose.models.InsurancePolicy || this.createPolicySchema();
      this.claimModel = mongoose.models.InsuranceClaim || this.createClaimSchema();
    } catch {
      this.insuranceModel = this.createPolicySchema();
      this.claimModel = this.createClaimSchema();
    }
  }

  private createPolicySchema(): any {
    const PolicySchema = new mongoose.Schema({
      policyId: { type: String, required: true, unique: true },
      bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
      bookingNumber: { type: String, required: true },
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      productTier: { type: String, enum: ['basic', 'standard', 'premium', 'comprehensive'], required: true },
      premiumPaid: { type: Number, required: true },
      coverageAmount: { type: Number, required: true },
      currency: { type: String, default: 'AED' },
      status: { type: String, enum: ['active', 'claimed', 'expired', 'cancelled', 'pending_claim'], default: 'active' },
      claimId: { type: String },
      effectiveDate: { type: Date, required: true },
      expiryDate: { type: Date, required: true },
      purchasedAt: { type: Date, default: Date.now },
      claimedAt: { type: Date },
      claimAmount: { type: Number },
      claimResolution: { type: String },
      metadata: {
        bookingValue: Number,
        serviceName: String,
        scheduledDate: Date,
        claimReason: String,
      },
    }, { timestamps: true });

    PolicySchema.index({ policyId: 1 }, { unique: true });
    PolicySchema.index({ bookingId: 1 });
    PolicySchema.index({ customerId: 1 });
    PolicySchema.index({ status: 1, expiryDate: 1 });

    return mongoose.model('InsurancePolicy', PolicySchema);
  }

  private createClaimSchema(): any {
    const ClaimSchema = new mongoose.Schema({
      claimId: { type: String, required: true, unique: true },
      policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePolicy', required: true },
      bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      claimType: {
        type: String,
        enum: ['cancellation', 'delay', 'no_show', 'quality_issue', 'price_protection'],
        required: true,
      },
      claimAmount: { type: Number, required: true },
      approvedAmount: { type: Number },
      currency: { type: String, default: 'AED' },
      status: {
        type: String,
        enum: ['submitted', 'under_review', 'approved', 'denied', 'resolved'],
        default: 'submitted',
      },
      reason: { type: String, required: true },
      evidence: {
        description: String,
        screenshots: [String],
        receipt: String,
      },
      submittedAt: { type: Date, default: Date.now },
      reviewedAt: { type: Date },
      resolvedAt: { type: Date },
      reviewerNotes: { type: String },
    }, { timestamps: true });

    ClaimSchema.index({ claimId: 1 }, { unique: true });
    ClaimSchema.index({ policyId: 1 });
    ClaimSchema.index({ status: 1 });

    return mongoose.model('InsuranceClaim', ClaimSchema);
  }

  /**
   * Calculate premium for a booking
   */
  calculatePremium(
    bookingValue: number,
    tier: CoverageTier = 'standard'
  ): { premium: number; coverageAmount: number; currency: string } {
    const tierConfig = COVERAGE_TIERS[tier];
    const premiumPercentage = tierConfig.premiumPercentage;
    const premiumFixed = tier === 'comprehensive' ? 20 : tier === 'premium' ? 10 : tier === 'standard' ? 5 : 0;

    const premium = Math.round((bookingValue * (premiumPercentage / 100) + premiumFixed) * 100) / 100;
    const coverageAmount = Math.round(bookingValue * tierConfig.coverageAmount * 100) / 100;

    return {
      premium,
      coverageAmount,
      currency: 'AED',
    };
  }

  /**
   * Get available insurance products
   */
  getProducts(): InsuranceProduct[] {
    const products: InsuranceProduct[] = [
      {
        _id: new Types.ObjectId(),
        productId: 'INS-BASIC',
        name: 'Basic Protection',
        description: 'Covers booking cancellation with partial refund protection',
        tier: 'basic',
        premiumPercentage: COVERAGE_TIERS.basic.premiumPercentage,
        premiumFixed: 0,
        coverageAmount: 0.5,
        coverageDetails: COVERAGE_TIERS.basic.coverageDetails,
        validityPeriod: { startDate: new Date(), endDate: new Date('2030-12-31') },
        isActive: true,
        createdAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        productId: 'INS-STANDARD',
        name: 'Standard Protection',
        description: 'Enhanced coverage including delays and provider no-show protection',
        tier: 'standard',
        premiumPercentage: COVERAGE_TIERS.standard.premiumPercentage,
        premiumFixed: COVERAGE_TIERS.standard.premiumPercentage === 4 ? 5 : 0,
        coverageAmount: 0.75,
        coverageDetails: COVERAGE_TIERS.standard.coverageDetails,
        validityPeriod: { startDate: new Date(), endDate: new Date('2030-12-31') },
        isActive: true,
        createdAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        productId: 'INS-PREMIUM',
        name: 'Premium Protection',
        description: 'Comprehensive coverage with priority support and price guarantee',
        tier: 'premium',
        premiumPercentage: COVERAGE_TIERS.premium.premiumPercentage,
        premiumFixed: 10,
        coverageAmount: 0.9,
        coverageDetails: COVERAGE_TIERS.premium.coverageDetails,
        validityPeriod: { startDate: new Date(), endDate: new Date('2030-12-31') },
        isActive: true,
        createdAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        productId: 'INS-COMPREHENSIVE',
        name: 'Complete Protection',
        description: 'Full coverage with fastest claims processing and maximum protection',
        tier: 'comprehensive',
        premiumPercentage: COVERAGE_TIERS.comprehensive.premiumPercentage,
        premiumFixed: 20,
        coverageAmount: 1.0,
        coverageDetails: COVERAGE_TIERS.comprehensive.coverageDetails,
        validityPeriod: { startDate: new Date(), endDate: new Date('2030-12-31') },
        isActive: true,
        createdAt: new Date(),
      },
    ];

    return products;
  }

  /**
   * Purchase insurance for a booking
   */
  async purchaseInsurance(
    bookingId: string | Types.ObjectId,
    customerId: string | Types.ObjectId,
    tier: CoverageTier,
    options: {
      productId?: string;
      paymentId?: string;
    } = {}
  ): Promise<{ success: boolean; policy?: InsurancePolicy; error?: string }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const customerObjectId = typeof customerId === 'string'
        ? new Types.ObjectId(customerId)
        : customerId;

      const booking = await Booking.findById(bookingObjectId).populate('serviceId');
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Check if insurance already exists
      const existingPolicy = await this.insuranceModel.findOne({ bookingId: bookingObjectId });
      if (existingPolicy) {
        return { success: false, error: 'Insurance already purchased for this booking' };
      }

      // Calculate premium
      const bookingValue = (booking.pricing as any)?.totalAmount || 0;
      const { premium, coverageAmount } = this.calculatePremium(bookingValue, tier);

      const policyId = this.generatePolicyId();
      const effectiveDate = new Date();
      const expiryDate = new Date(booking.scheduledDate);
      expiryDate.setDate(expiryDate.getDate() + 7); // Valid for 7 days after service

      const product = this.getProducts().find(p => p.tier === tier);
      const productId = options.productId || product?._id?.toString() || '';

      const policy = new this.insuranceModel({
        policyId,
        bookingId: bookingObjectId,
        bookingNumber: booking.bookingNumber,
        customerId: customerObjectId,
        providerId: booking.providerId,
        productId: new Types.ObjectId(productId),
        productTier: tier,
        premiumPaid: premium,
        coverageAmount,
        currency: 'AED',
        status: 'active',
        effectiveDate,
        expiryDate,
        metadata: {
          bookingValue,
          serviceName: (booking.serviceId as any)?.name || 'Unknown Service',
          scheduledDate: booking.scheduledDate,
        },
      });

      await policy.save();

      // Update booking metadata
      booking.metadata = booking.metadata || {};
      (booking.metadata as any).insurance = {
        policyId,
        tier,
        premium,
        coverageAmount,
        purchasedAt: new Date(),
      };
      await booking.save();

      logger.info('Insurance purchased', {
        policyId,
        bookingId: bookingObjectId.toString(),
        tier,
        premium,
        coverageAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.INSURANCE_PURCHASED, {
        policyId,
        bookingId: bookingObjectId.toString(),
        customerId: customerObjectId.toString(),
        tier,
        premium,
      });

      return { success: true, policy };
    } catch (error) {
      logger.error('Error purchasing insurance', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to purchase insurance',
      };
    }
  }

  /**
   * Submit a claim
   */
  async submitClaim(
    policyId: string,
    data: {
      customerId: string | Types.ObjectId;
      claimType: InsuranceClaim['claimType'];
      claimAmount: number;
      reason: string;
      evidence?: InsuranceClaim['evidence'];
    }
  ): Promise<{ success: boolean; claim?: InsuranceClaim; error?: string }> {
    try {
      const customerObjectId = typeof data.customerId === 'string'
        ? new Types.ObjectId(data.customerId)
        : data.customerId;

      const policy = await this.insuranceModel.findOne({ policyId });
      if (!policy) {
        return { success: false, error: 'Policy not found' };
      }

      if (policy.customerId.toString() !== customerObjectId.toString()) {
        return { success: false, error: 'Policy does not belong to this customer' };
      }

      if (policy.status !== 'active') {
        return { success: false, error: `Cannot file claim on policy with status: ${policy.status}` };
      }

      // Validate claim amount against coverage
      const coverageDetails = COVERAGE_TIERS[policy.productTier as CoverageTier].coverageDetails;
      let maxClaimAmount = policy.coverageAmount;

      if (data.claimType === 'cancellation') {
        maxClaimAmount = (policy.metadata as any)?.bookingValue * (coverageDetails.cancellationCoverage / 100);
      } else if (data.claimType === 'no_show') {
        maxClaimAmount = (policy.metadata as any)?.bookingValue * (coverageDetails.noShowCoverage / 100);
      } else if (data.claimType === 'quality_issue') {
        maxClaimAmount = (policy.metadata as any)?.bookingValue * (coverageDetails.qualityIssueCoverage / 100);
      }

      if (data.claimAmount > maxClaimAmount) {
        return {
          success: false,
          error: `Claim amount exceeds maximum coverage of ${maxClaimAmount}`,
        };
      }

      const claimId = this.generateClaimId();

      const claim = new this.claimModel({
        claimId,
        policyId: policy._id,
        bookingId: policy.bookingId,
        customerId: customerObjectId,
        claimType: data.claimType,
        claimAmount: data.claimAmount,
        currency: policy.currency,
        status: 'submitted',
        reason: data.reason,
        evidence: data.evidence,
      });

      await claim.save();

      // Update policy status
      policy.status = 'pending_claim';
      policy.claimId = claimId;
      await policy.save();

      logger.info('Insurance claim submitted', {
        claimId,
        policyId,
        claimType: data.claimType,
        claimAmount: data.claimAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.INSURANCE_CLAIM_SUBMITTED, {
        claimId,
        policyId,
        bookingId: policy.bookingId.toString(),
        claimType: data.claimType,
        claimAmount: data.claimAmount,
      });

      return { success: true, claim };
    } catch (error) {
      logger.error('Error submitting claim', {
        policyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit claim',
      };
    }
  }

  /**
   * Process a claim (approve/deny)
   */
  async processClaim(
    claimId: string,
    data: {
      action: 'approve' | 'deny';
      approvedAmount?: number;
      reviewerNotes?: string;
    }
  ): Promise<{ success: boolean; claim?: InsuranceClaim; error?: string }> {
    try {
      const claim = await this.claimModel.findOne({ claimId });
      if (!claim) {
        return { success: false, error: 'Claim not found' };
      }

      if (claim.status !== 'submitted' && claim.status !== 'under_review') {
        return { success: false, error: `Cannot process claim with status: ${claim.status}` };
      }

      const policy = await this.insuranceModel.findById(claim.policyId);
      if (!policy) {
        return { success: false, error: 'Policy not found' };
      }

      claim.status = data.action === 'approve' ? 'approved' : 'denied';
      claim.reviewedAt = new Date();
      claim.reviewerNotes = data.reviewerNotes;

      if (data.action === 'approve') {
        claim.approvedAmount = data.approvedAmount || claim.claimAmount;
        claim.resolvedAt = new Date();
        policy.status = 'claimed';
        policy.claimedAt = new Date();
        policy.claimAmount = claim.approvedAmount;
      } else {
        claim.resolvedAt = new Date();
        policy.status = 'active'; // Return to active if denied
      }

      await claim.save();
      await policy.save();

      logger.info(`Insurance claim ${data.action}ed`, {
        claimId,
        approvedAmount: claim.approvedAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.INSURANCE_CLAIM_PROCESSED, {
        claimId,
        policyId: policy.policyId,
        action: data.action,
        approvedAmount: claim.approvedAmount,
      });

      return { success: true, claim };
    } catch (error) {
      logger.error('Error processing claim', {
        claimId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process claim',
      };
    }
  }

  /**
   * Get policy by ID
   */
  async getPolicy(policyId: string): Promise<InsurancePolicy | null> {
    return this.insuranceModel.findOne({ policyId }).populate('bookingId productId');
  }

  /**
   * Get customer's insurance policies
   */
  async getCustomerPolicies(
    customerId: string | Types.ObjectId,
    options: { status?: InsurancePolicy['status']; page?: number; limit?: number } = {}
  ): Promise<{ policies: InsurancePolicy[]; total: number }> {
    const customerObjectId = typeof customerId === 'string'
      ? new Types.ObjectId(customerId)
      : customerId;

    const query: any = { customerId: customerObjectId };
    if (options.status) {
      query.status = options.status;
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [policies, total] = await Promise.all([
      this.insuranceModel.find(query).populate('bookingId').sort({ purchasedAt: -1 }).skip(skip).limit(limit),
      this.insuranceModel.countDocuments(query),
    ]);

    return { policies, total };
  }

  /**
   * Get analytics for insurance products
   */
  async getAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
    tier?: CoverageTier;
  } = {}): Promise<{
    totalPolicies: number;
    totalPremiumCollected: number;
    totalClaims: number;
    totalClaimAmount: number;
    claimApprovalRate: number;
    byTier: Record<CoverageTier, { policies: number; premium: number; claims: number }>;
    averageClaimValue: number;
  }> {
    const query: any = {};
    if (options.startDate || options.endDate) {
      query.purchasedAt = {};
      if (options.startDate) query.purchasedAt.$gte = options.startDate;
      if (options.endDate) query.purchasedAt.$lte = options.endDate;
    }
    if (options.tier) {
      query.productTier = options.tier;
    }

    const policies = await this.insuranceModel.find(query);
    const claims = await this.claimModel.find({ status: { $in: ['approved', 'resolved'] } });

    const byTier: Record<CoverageTier, { policies: number; premium: number; claims: number }> = {
      basic: { policies: 0, premium: 0, claims: 0 },
      standard: { policies: 0, premium: 0, claims: 0 },
      premium: { policies: 0, premium: 0, claims: 0 },
      comprehensive: { policies: 0, premium: 0, claims: 0 },
    };

    let totalPremium = 0;
    let totalClaimAmount = 0;
    let approvedClaims = 0;

    for (const policy of policies) {
      const tier = policy.productTier as CoverageTier;
      byTier[tier].policies++;
      byTier[tier].premium += policy.premiumPaid;
      totalPremium += policy.premiumPaid;
    }

    for (const claim of claims) {
      const policy = policies.find((p: { _id: { toString(): string } }) => p._id.toString() === claim.policyId.toString());
      if (policy) {
        const tier = policy.productTier as CoverageTier;
        byTier[tier].claims++;
        totalClaimAmount += claim.approvedAmount || claim.claimAmount;
        if (claim.status === 'approved') approvedClaims++;
      }
    }

    return {
      totalPolicies: policies.length,
      totalPremiumCollected: totalPremium,
      totalClaims: claims.length,
      totalClaimAmount,
      claimApprovalRate: claims.length > 0 ? (approvedClaims / claims.length) * 100 : 0,
      byTier,
      averageClaimValue: claims.length > 0 ? totalClaimAmount / claims.length : 0,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generatePolicyId(): string {
    return `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  private generateClaimId(): string {
    return `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const cancellationInsuranceService = new CancellationInsuranceService();
export default cancellationInsuranceService;
