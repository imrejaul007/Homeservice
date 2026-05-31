import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type WarrantyTier = 'basic_30' | 'standard_90' | 'premium_365';
export type WarrantyStatus = 'active' | 'expired' | 'claimed' | 'cancelled' | 'transferred';
export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'denied' | 'resolved';
export type ClaimType = 'repair' | 'replacement' | 'refund' | 'credit';

export interface WarrantyTierConfig {
  tier: WarrantyTier;
  name: string;
  description: string;
  durationDays: number;
  premiumPercent: number;
  premiumFixed: number;
  coverageAmount: number;
  coverageDetails: {
    laborCoverage: number; // percentage
    partsCoverage: number; // percentage
    emergencyService: boolean;
    prioritySupport: boolean;
    multipleClaims: boolean;
    maxClaims: number;
    deductibleAmount: number;
    coveredIssues: string[];
    excludedIssues: string[];
  };
}

export interface WarrantyPolicy {
  _id?: Types.ObjectId;
  policyId: string;
  policyNumber: string;
  customerId: Types.ObjectId;
  customerName: string;
  customerEmail: string;
  serviceId: Types.ObjectId;
  serviceName: string;
  bookingId?: Types.ObjectId;
  bookingNumber?: string;
  providerId?: Types.ObjectId;
  providerName?: string;
  warrantyTier: WarrantyTier;
  purchaseDate: Date;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  serviceValue: number;
  premiumPaid: number;
  coverageAmount: number;
  currency: string;
  status: WarrantyStatus;
  isTransferable: boolean;
  transferCount: number;
  maxTransfers: number;
  remainingClaims: number;
  claimsHistory: Types.ObjectId[];
  coverageTracking: Array<{
    date: Date;
    type: 'check' | 'service' | 'claim' | 'renewal';
    description: string;
    provider?: string;
    cost?: number;
    covered?: number;
  }>;
  metadata?: {
    serviceCategory?: string;
    manufacturer?: string;
    model?: string;
    installationDate?: Date;
    warrantyCardNumber?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WarrantyClaim {
  _id?: Types.ObjectId;
  claimId: string;
  claimNumber: string;
  policyId: Types.ObjectId;
  policyNumber: string;
  customerId: Types.ObjectId;
  customerName: string;
  serviceId: Types.ObjectId;
  serviceName: string;
  bookingId?: Types.ObjectId;
  claimType: ClaimType;
  claimReason: string;
  claimDescription: string;
  claimAmount: number;
  approvedAmount?: number;
  deductibleApplied: number;
  currency: string;
  status: ClaimStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledDate?: Date;
  completedDate?: Date;
  assignedProviderId?: Types.ObjectId;
  assignedProviderName?: string;
  repairDetails?: {
    diagnosis: string;
    workPerformed: string;
    partsReplaced?: string[];
    laborHours?: number;
    partsCost?: number;
    laborCost?: number;
  };
  evidence: {
    photos?: string[];
    documents?: string[];
    description?: string;
    submittedAt: Date;
  };
  reviewerNotes?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Warranty Tier Configurations
// ============================================

const WARRANTY_TIERS: Record<WarrantyTier, WarrantyTierConfig> = {
  basic_30: {
    tier: 'basic_30',
    name: 'Basic 30-Day Warranty',
    description: 'Essential coverage for 30 days after service completion',
    durationDays: 30,
    premiumPercent: 3,
    premiumFixed: 0,
    coverageAmount: 0.5, // 50% of service value
    coverageDetails: {
      laborCoverage: 50,
      partsCoverage: 30,
      emergencyService: false,
      prioritySupport: false,
      multipleClaims: false,
      maxClaims: 1,
      deductibleAmount: 25,
      coveredIssues: [
        'Service not completed as specified',
        'Minor issues within 48 hours',
        'Touch-up work',
      ],
      excludedIssues: [
        'Normal wear and tear',
        'Customer-caused damage',
        'Pre-existing conditions',
        'Cosmetic issues',
      ],
    },
  },
  standard_90: {
    tier: 'standard_90',
    name: 'Standard 90-Day Warranty',
    description: 'Comprehensive coverage for 90 days with emergency support',
    durationDays: 90,
    premiumPercent: 5,
    premiumFixed: 15,
    coverageAmount: 0.75, // 75% of service value
    coverageDetails: {
      laborCoverage: 75,
      partsCoverage: 50,
      emergencyService: true,
      prioritySupport: true,
      multipleClaims: true,
      maxClaims: 2,
      deductibleAmount: 50,
      coveredIssues: [
        'Service not completed as specified',
        'Quality issues reported within 30 days',
        'Equipment malfunction due to improper installation',
        'Water damage from plumbing repairs',
        'Electrical issues from electrical work',
        'Emergency callback service',
      ],
      excludedIssues: [
        'Normal wear and tear',
        'Customer-caused damage',
        'Pre-existing conditions',
        'Commercial use',
        'Natural disasters',
      ],
    },
  },
  premium_365: {
    tier: 'premium_365',
    name: 'Premium 1-Year Warranty',
    description: 'Full year protection with comprehensive coverage and priority service',
    durationDays: 365,
    premiumPercent: 8,
    premiumFixed: 50,
    coverageAmount: 1.0, // 100% of service value
    coverageDetails: {
      laborCoverage: 100,
      partsCoverage: 80,
      emergencyService: true,
      prioritySupport: true,
      multipleClaims: true,
      maxClaims: 3,
      deductibleAmount: 25,
      coveredIssues: [
        'All workmanship issues',
        'All equipment failures due to installation',
        'All covered parts replacement',
        'Priority emergency service 24/7',
        'Annual maintenance check',
        'Transferable to new homeowner',
        'Direct provider coordination',
      ],
      excludedIssues: [
        'Customer misuse or abuse',
        'Natural damage (floods, fires)',
        'Commercial misuse',
        'Unauthorized repairs',
        'Cosmetic wear',
      ],
    },
  },
};

// ============================================
// Extended Warranty Service
// ============================================

export class ExtendedWarrantyService {
  private policyModel: any;
  private claimModel: any;

  constructor() {
    this.initializeModels();
  }

  private initializeModels(): void {
    try {
      this.policyModel = mongoose.models.WarrantyPolicy || this.createPolicySchema();
      this.claimModel = mongoose.models.WarrantyClaim || this.createClaimSchema();
    } catch {
      this.policyModel = this.createPolicySchema();
      this.claimModel = this.createClaimSchema();
    }
  }

  private createPolicySchema(): any {
    const PolicySchema = new mongoose.Schema({
      policyId: { type: String, required: true, unique: true },
      policyNumber: { type: String, required: true, unique: true },
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      customerName: { type: String, required: true },
      customerEmail: { type: String, required: true },
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
      serviceName: { type: String, required: true },
      bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
      bookingNumber: String,
      providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      providerName: String,
      warrantyTier: {
        type: String,
        enum: ['basic_30', 'standard_90', 'premium_365'],
        required: true,
      },
      purchaseDate: { type: Date, default: Date.now },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      durationDays: { type: Number, required: true },
      serviceValue: { type: Number, required: true },
      premiumPaid: { type: Number, required: true },
      coverageAmount: { type: Number, required: true },
      currency: { type: String, default: 'AED' },
      status: {
        type: String,
        enum: ['active', 'expired', 'claimed', 'cancelled', 'transferred'],
        default: 'active',
      },
      isTransferable: { type: Boolean, default: false },
      transferCount: { type: Number, default: 0 },
      maxTransfers: { type: Number, default: 0 },
      remainingClaims: { type: Number, required: true },
      claimsHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WarrantyClaim' }],
      coverageTracking: [{
        date: Date,
        type: { type: String, enum: ['check', 'service', 'claim', 'renewal'] },
        description: String,
        provider: String,
        cost: Number,
        covered: Number,
      }],
      metadata: {
        serviceCategory: String,
        manufacturer: String,
        model: String,
        installationDate: Date,
        warrantyCardNumber: String,
      },
    }, { timestamps: true });

    PolicySchema.index({ policyId: 1 }, { unique: true });
    PolicySchema.index({ customerId: 1 });
    PolicySchema.index({ serviceId: 1 });
    PolicySchema.index({ status: 1, endDate: 1 });
    PolicySchema.index({ bookingId: 1 });

    return mongoose.model('WarrantyPolicy', PolicySchema);
  }

  private createClaimSchema(): any {
    const ClaimSchema = new mongoose.Schema({
      claimId: { type: String, required: true, unique: true },
      claimNumber: { type: String, required: true, unique: true },
      policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'WarrantyPolicy', required: true },
      policyNumber: { type: String, required: true },
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      customerName: { type: String, required: true },
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
      serviceName: { type: String, required: true },
      bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
      claimType: {
        type: String,
        enum: ['repair', 'replacement', 'refund', 'credit'],
        required: true,
      },
      claimReason: { type: String, required: true },
      claimDescription: { type: String, required: true },
      claimAmount: { type: Number, required: true },
      approvedAmount: Number,
      deductibleApplied: { type: Number, default: 0 },
      currency: { type: String, default: 'AED' },
      status: {
        type: String,
        enum: ['submitted', 'under_review', 'approved', 'denied', 'resolved'],
        default: 'submitted',
      },
      priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
      },
      scheduledDate: Date,
      completedDate: Date,
      assignedProviderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      assignedProviderName: String,
      repairDetails: {
        diagnosis: String,
        workPerformed: String,
        partsReplaced: [String],
        laborHours: Number,
        partsCost: Number,
        laborCost: Number,
      },
      evidence: {
        photos: [String],
        documents: [String],
        description: String,
        submittedAt: { type: Date, default: Date.now },
      },
      reviewerNotes: String,
      resolutionNotes: String,
    }, { timestamps: true });

    ClaimSchema.index({ claimId: 1 }, { unique: true });
    ClaimSchema.index({ policyId: 1 });
    ClaimSchema.index({ customerId: 1 });
    ClaimSchema.index({ status: 1 });

    return mongoose.model('WarrantyClaim', ClaimSchema);
  }

  // ============================================
  // Tier Management
  // ============================================

  /**
   * Get available warranty tiers
   */
  getTiers(): WarrantyTierConfig[] {
    return Object.values(WARRANTY_TIERS);
  }

  /**
   * Get tier configuration
   */
  getTierConfig(tier: WarrantyTier): WarrantyTierConfig | undefined {
    return WARRANTY_TIERS[tier];
  }

  /**
   * Calculate warranty premium
   */
  calculatePremium(serviceValue: number, tier: WarrantyTier): {
    premium: number;
    coverageAmount: number;
    deductible: number;
    currency: string;
    tier: WarrantyTierConfig;
  } {
    const tierConfig = WARRANTY_TIERS[tier];
    const premiumPercent = tierConfig.premiumPercent;
    const premiumFixed = tierConfig.premiumFixed;
    const premium = Math.round((serviceValue * (premiumPercent / 100) + premiumFixed) * 100) / 100;
    const coverageAmount = Math.round(serviceValue * tierConfig.coverageAmount * 100) / 100;
    const deductible = tierConfig.coverageDetails.deductibleAmount;

    return {
      premium,
      coverageAmount,
      deductible,
      currency: 'AED',
      tier: tierConfig,
    };
  }

  // ============================================
  // Policy Management
  // ============================================

  /**
   * Purchase extended warranty
   */
  async purchaseWarranty(data: {
    serviceId: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    tier: WarrantyTier;
    bookingId?: string;
    providerId?: string;
    providerName?: string;
    serviceValue: number;
    serviceName?: string;
    metadata?: {
      serviceCategory?: string;
      manufacturer?: string;
      model?: string;
      installationDate?: Date;
    };
  }): Promise<{ success: boolean; policy?: WarrantyPolicy; error?: string }> {
    try {
      // Get service details
      let serviceName = data.serviceName;
      if (!serviceName && data.serviceId) {
        const service = await Service.findById(data.serviceId);
        serviceName = service?.name || 'Unknown Service';
      }

      // Calculate premium and coverage
      const { premium, coverageAmount, deductible, tier: tierConfig } = this.calculatePremium(
        data.serviceValue,
        data.tier
      );

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + tierConfig.durationDays);

      const policyId = this.generatePolicyId();
      const policyNumber = `EW-${tierConfig.tier.split('_')[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      const policy = new this.policyModel({
        policyId,
        policyNumber,
        customerId: new Types.ObjectId(data.customerId),
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        serviceId: new Types.ObjectId(data.serviceId),
        serviceName: serviceName || 'Unknown Service',
        bookingId: data.bookingId ? new Types.ObjectId(data.bookingId) : undefined,
        bookingNumber: data.bookingId ? `BK-${data.bookingId.slice(-6)}` : undefined,
        providerId: data.providerId ? new Types.ObjectId(data.providerId) : undefined,
        providerName: data.providerName,
        warrantyTier: data.tier,
        purchaseDate: new Date(),
        startDate,
        endDate,
        durationDays: tierConfig.durationDays,
        serviceValue: data.serviceValue,
        premiumPaid: premium,
        coverageAmount,
        currency: 'AED',
        status: 'active',
        isTransferable: data.tier === 'premium_365',
        maxTransfers: data.tier === 'premium_365' ? 1 : 0,
        remainingClaims: tierConfig.coverageDetails.maxClaims,
        metadata: data.metadata,
      });

      await (policy as any).save();

      // Update booking if provided
      if (data.bookingId) {
        await Booking.findByIdAndUpdate(data.bookingId, {
          $set: {
            'metadata.extendedWarranty': {
              policyId,
              tier: data.tier,
              premium,
              coverageAmount,
              purchasedAt: new Date(),
            },
          },
        });
      }

      logger.info('Extended warranty purchased', {
        policyId,
        policyNumber,
        customerId: data.customerId,
        tier: data.tier,
        premium,
        coverageAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.EXTENDED_WARRANTY_PURCHASED, {
        policyId,
        policyNumber,
        customerId: data.customerId,
        tier: data.tier,
        premium,
        coverageAmount,
        endDate: endDate.toISOString(),
      });

      return { success: true, policy };
    } catch (error) {
      logger.error('Error purchasing warranty', {
        customerId: data.customerId,
        serviceId: data.serviceId,
        tier: data.tier,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to purchase warranty',
      };
    }
  }

  /**
   * Get policy by ID
   */
  async getPolicy(policyId: string): Promise<WarrantyPolicy | null> {
    return this.policyModel.findOne({ policyId })
      .populate('serviceId')
      .populate('claimsHistory');
  }

  /**
   * Get customer's warranty policies
   */
  async getCustomerPolicies(
    customerId: string,
    options: { status?: WarrantyStatus; tier?: WarrantyTier; page?: number; limit?: number } = {}
  ): Promise<{ policies: WarrantyPolicy[]; total: number }> {
    const customerObjectId = typeof customerId === 'string'
      ? new Types.ObjectId(customerId)
      : customerId;

    const query: any = { customerId: customerObjectId };
    if (options.status) {
      query.status = options.status;
    }
    if (options.tier) {
      query.warrantyTier = options.tier;
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [policies, total] = await Promise.all([
      this.policyModel.find(query)
        .populate('serviceId')
        .sort({ purchaseDate: -1 })
        .skip(skip)
        .limit(limit),
      this.policyModel.countDocuments(query),
    ]);

    return { policies, total };
  }

  /**
   * Check warranty validity for a claim
   */
  async validateWarranty(policyId: string): Promise<{
    valid: boolean;
    reason?: string;
    policy?: WarrantyPolicy;
    remainingClaims?: number;
  }> {
    const policy = await this.policyModel.findOne({ policyId });
    if (!policy) {
      return { valid: false, reason: 'Policy not found' };
    }

    if (policy.status !== 'active') {
      return { valid: false, reason: `Policy status is: ${policy.status}` };
    }

    const now = new Date();
    if (now > policy.endDate) {
      return { valid: false, reason: 'Policy has expired' };
    }

    if (policy.remainingClaims <= 0) {
      return { valid: false, reason: 'No remaining claims available' };
    }

    return {
      valid: true,
      policy,
      remainingClaims: policy.remainingClaims,
    };
  }

  // ============================================
  // Claim Processing
  // ============================================

  /**
   * Submit warranty claim
   */
  async submitClaim(data: {
    policyId: string;
    customerId: string;
    customerName: string;
    serviceId: string;
    serviceName: string;
    claimType: ClaimType;
    claimReason: string;
    claimDescription: string;
    claimAmount: number;
    evidence?: {
      photos?: string[];
      documents?: string[];
      description?: string;
    };
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }): Promise<{ success: boolean; claim?: WarrantyClaim; error?: string }> {
    try {
      // Validate warranty
      const validation = await this.validateWarranty(data.policyId);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      const policy = validation.policy!;

      // Check if claim amount exceeds coverage
      const tierConfig = WARRANTY_TIERS[policy.warrantyTier as WarrantyTier];
      const maxCoverage = policy.coverageAmount;
      const deductible = tierConfig.coverageDetails.deductibleAmount;

      if (data.claimAmount > maxCoverage) {
        return {
          success: false,
          error: `Claim amount exceeds maximum coverage of ${maxCoverage}`,
        };
      }

      // Check excluded issues
      for (const excluded of tierConfig.coverageDetails.excludedIssues) {
        if (data.claimDescription.toLowerCase().includes(excluded.toLowerCase())) {
          return {
            success: false,
            error: `Claim reason is excluded from warranty coverage: ${excluded}`,
          };
        }
      }

      const claimId = this.generateClaimId();
      const claimNumber = `CLM-${Date.now().toString(36).toUpperCase()}`;

      const deductibleApplied = Math.min(deductible, data.claimAmount);

      const claim = new this.claimModel({
        claimId,
        claimNumber,
        policyId: policy._id,
        policyNumber: policy.policyNumber,
        customerId: new Types.ObjectId(data.customerId),
        customerName: data.customerName,
        serviceId: new Types.ObjectId(data.serviceId),
        serviceName: data.serviceName,
        claimType: data.claimType,
        claimReason: data.claimReason,
        claimDescription: data.claimDescription,
        claimAmount: data.claimAmount,
        deductibleApplied,
        currency: 'AED',
        status: 'submitted',
        priority: data.priority || 'normal',
        evidence: {
          ...data.evidence,
          submittedAt: new Date(),
        },
      });

      await claim.save();

      // Update policy
      policy.claimsHistory.push(claim._id);
      policy.remainingClaims -= 1;
      if (policy.remainingClaims <= 0) {
        policy.status = 'claimed';
      }
      policy.coverageTracking.push({
        date: new Date(),
        type: 'claim',
        description: `Claim submitted: ${data.claimReason}`,
        cost: data.claimAmount,
      });
      await (policy as any).save();

      logger.info('Warranty claim submitted', {
        claimId,
        claimNumber,
        policyId: data.policyId,
        claimAmount: data.claimAmount,
        deductibleApplied,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.EXTENDED_WARRANTY_CLAIM_SUBMITTED, {
        claimId,
        policyId: data.policyId,
        customerId: data.customerId,
        claimType: data.claimType,
        claimAmount: data.claimAmount,
      });

      return { success: true, claim };
    } catch (error) {
      logger.error('Error submitting warranty claim', {
        policyId: data.policyId,
        customerId: data.customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit claim',
      };
    }
  }

  /**
   * Process claim (approve/deny)
   */
  async processClaim(data: {
    claimId: string;
    action: 'approve' | 'deny';
    approvedAmount?: number;
    reviewerNotes?: string;
    repairDetails?: WarrantyClaim['repairDetails'];
  }): Promise<{ success: boolean; claim?: WarrantyClaim; error?: string }> {
    try {
      const claim = await this.claimModel.findOne({ claimId: data.claimId });
      if (!claim) {
        return { success: false, error: 'Claim not found' };
      }

      if (!['submitted', 'under_review'].includes(claim.status)) {
        return { success: false, error: `Cannot process claim with status: ${claim.status}` };
      }

      const policy = await this.policyModel.findById(claim.policyId);
      if (!policy) {
        return { success: false, error: 'Policy not found' };
      }

      claim.status = data.action === 'approve' ? 'approved' : 'denied';
      claim.reviewerNotes = data.reviewerNotes;

      if (data.action === 'approve') {
        claim.approvedAmount = data.approvedAmount ?? claim.claimAmount;
        claim.repairDetails = data.repairDetails;

        // Add to coverage tracking
        policy.coverageTracking.push({
          date: new Date(),
          type: 'service',
          description: `Claim approved: ${claim.claimReason}`,
          covered: claim.approvedAmount,
        });
      }

      await claim.save();
      await (policy as any).save();

      logger.info(`Warranty claim ${data.action}ed`, {
        claimId: data.claimId,
        approvedAmount: claim.approvedAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.EXTENDED_WARRANTY_CLAIM_PROCESSED, {
        claimId: data.claimId,
        policyId: policy.policyId,
        action: data.action,
        approvedAmount: claim.approvedAmount,
      });

      return { success: true, claim };
    } catch (error) {
      logger.error('Error processing warranty claim', {
        claimId: data.claimId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process claim',
      };
    }
  }

  /**
   * Get claims for a policy
   */
  async getPolicyClaims(policyId: string): Promise<WarrantyClaim[]> {
    const policy = await this.policyModel.findOne({ policyId });
    if (!policy) {
      return [];
    }

    return this.claimModel.find({ policyId: policy._id })
      .populate('assignedProviderId')
      .sort({ createdAt: -1 });
  }

  /**
   * Renew warranty policy
   */
  async renewPolicy(
    policyId: string,
    newTier?: WarrantyTier
  ): Promise<{ success: boolean; policy?: WarrantyPolicy; error?: string }> {
    try {
      const policy = await this.policyModel.findOne({ policyId });
      if (!policy) {
        return { success: false, error: 'Policy not found' };
      }

      const tier = newTier || policy.warrantyTier;
      const { premium, coverageAmount, tier: tierConfig } = this.calculatePremium(
        policy.serviceValue,
        tier
      );

      policy.warrantyTier = tier;
      policy.startDate = new Date();
      policy.endDate = new Date();
      policy.endDate.setDate(policy.endDate.getDate() + tierConfig.durationDays);
      policy.durationDays = tierConfig.durationDays;
      policy.premiumPaid = premium;
      policy.coverageAmount = coverageAmount;
      policy.status = 'active';
      policy.remainingClaims = tierConfig.coverageDetails.maxClaims;
      policy.coverageTracking.push({
        date: new Date(),
        type: 'renewal',
        description: `Policy renewed for ${tierConfig.durationDays} days`,
        cost: premium,
      });

      await (policy as any).save();

      logger.info('Warranty policy renewed', {
        policyId,
        newTier: tier,
        newEndDate: policy.endDate.toISOString(),
      });

      return { success: true, policy };
    } catch (error) {
      logger.error('Error renewing warranty policy', {
        policyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to renew policy',
      };
    }
  }

  // ============================================
  // Coverage Tracking
  // ============================================

  /**
   * Add coverage tracking entry
   */
  async addCoverageTracking(
    policyId: string,
    entry: {
      type: 'check' | 'service' | 'claim' | 'renewal';
      description: string;
      provider?: string;
      cost?: number;
      covered?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const policy = await this.policyModel.findOneAndUpdate(
        { policyId },
        {
          $push: {
            coverageTracking: {
              date: new Date(),
              ...entry,
            },
          },
        },
        { new: true }
      );

      if (!policy) {
        return { success: false, error: 'Policy not found' };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error adding coverage tracking', {
        policyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add tracking entry',
      };
    }
  }

  /**
   * Get coverage tracking history
   */
  async getCoverageTracking(policyId: string): Promise<Array<{
    date: Date;
    type: string;
    description: string;
    provider?: string;
    cost?: number;
    covered?: number;
  }>> {
    const policy = await this.policyModel.findOne({ policyId });
    return policy?.coverageTracking || [];
  }

  // ============================================
  // Analytics
  // ============================================

  /**
   * Get warranty analytics
   */
  async getAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
    tier?: WarrantyTier;
  } = {}): Promise<{
    totalPolicies: number;
    activePolicies: number;
    expiredPolicies: number;
    totalPremiumCollected: number;
    totalClaims: number;
    totalClaimAmount: number;
    totalApprovedAmount: number;
    claimApprovalRate: number;
    byTier: Record<WarrantyTier, { policies: number; premium: number; claims: number }>;
    averageClaimValue: number;
    mostClaimedService: string;
  }> {
    const matchQuery: any = {};
    if (options.startDate || options.endDate) {
      matchQuery.purchaseDate = {};
      if (options.startDate) matchQuery.purchaseDate.$gte = options.startDate;
      if (options.endDate) matchQuery.purchaseDate.$lte = options.endDate;
    }
    if (options.tier) {
      matchQuery.warrantyTier = options.tier;
    }

    const policies = await this.policyModel.find(matchQuery);
    const claims = await this.claimModel.find({
      createdAt: matchQuery.purchaseDate || undefined,
    });

    const byTier: Record<WarrantyTier, { policies: number; premium: number; claims: number }> = {
      basic_30: { policies: 0, premium: 0, claims: 0 },
      standard_90: { policies: 0, premium: 0, claims: 0 },
      premium_365: { policies: 0, premium: 0, claims: 0 },
    };

    let totalPremium = 0;
    let totalClaimAmount = 0;
    let totalApprovedAmount = 0;
    let approvedCount = 0;
    const serviceClaimMap = new Map<string, number>();

    for (const policy of policies) {
      const tier = policy.warrantyTier as WarrantyTier;
      byTier[tier].policies++;
      byTier[tier].premium += policy.premiumPaid;
      totalPremium += policy.premiumPaid;
    }

    for (const claim of claims) {
      const policy = policies.find((p: { _id: { toString(): string }; warrantyTier: string }) => p._id.toString() === claim.policyId.toString());
      if (policy) {
        const tier = policy.warrantyTier as WarrantyTier;
        byTier[tier].claims++;
        totalClaimAmount += claim.claimAmount;
        if (claim.status === 'approved' || claim.status === 'resolved') {
          totalApprovedAmount += claim.approvedAmount || claim.claimAmount;
          approvedCount++;
        }
        serviceClaimMap.set(
          claim.serviceName,
          (serviceClaimMap.get(claim.serviceName) || 0) + 1
        );
      }
    }

    const mostClaimedEntry = Array.from(serviceClaimMap.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalPolicies: policies.length,
      activePolicies: policies.filter((p: { status: string }) => p.status === 'active').length,
      expiredPolicies: policies.filter((p: { status: string }) => p.status === 'expired').length,
      totalPremiumCollected: totalPremium,
      totalClaims: claims.length,
      totalClaimAmount,
      totalApprovedAmount,
      claimApprovalRate: claims.length > 0 ? (approvedCount / claims.length) * 100 : 0,
      byTier,
      averageClaimValue: claims.length > 0 ? totalClaimAmount / claims.length : 0,
      mostClaimedService: mostClaimedEntry?.[0] || 'N/A',
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generatePolicyId(): string {
    return `WP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  private generateClaimId(): string {
    return `WC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const extendedWarrantyService = new ExtendedWarrantyService();
export default extendedWarrantyService;
