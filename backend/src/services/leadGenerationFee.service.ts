import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import Service from '../models/service.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export interface LeadCreditPackage {
  packageId: string;
  name: string;
  creditCount: number;
  pricePerCredit: number;
  totalPrice: number;
  validityDays: number;
  bonusCredits?: number;
  isPopular?: boolean;
}

export interface Lead {
  _id?: Types.ObjectId;
  leadId: string;
  providerId: Types.ObjectId;
  customerId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  leadType: 'direct' | 'referral' | 'featured' | 'premium';
  quality: 'hot' | 'warm' | 'cold';
  contactInfo: {
    name?: string;
    email?: string;
    phone?: string;
  };
  requirements?: string;
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  location?: {
    city?: string;
    area?: string;
  };
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'expired';
  leadScore: number;
  leadSource?: string;
  responseTime?: number; // Minutes to respond
  creditCost: number;
  expiresAt: Date;
  metadata?: {
    searchQuery?: string;
    matchedServices?: string[];
    distance?: number;
    customerHistory?: {
      previousBookings?: number;
      averageRating?: number;
    };
  };
  timeline: Array<{
    action: string;
    timestamp: Date;
    performedBy?: 'provider' | 'system' | 'customer';
    details?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderLeadCredits {
  _id?: Types.ObjectId;
  providerId: Types.ObjectId;
  totalCredits: number;
  usedCredits: number;
  expiredCredits: number;
  availableCredits: number;
  purchasedCredits: number;
  freeCredits: number;
  creditHistory: Array<{
    type: 'purchase' | 'bonus' | 'used' | 'expired' | 'refund';
    amount: number;
    balance: number;
    description: string;
    referenceId?: string;
    createdAt: Date;
  }>;
  packageId?: string;
  validUntil?: Date;
  autoRefill?: {
    enabled: boolean;
    threshold: number;
    refillAmount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Lead Credit Packages
// ============================================

const CREDIT_PACKAGES: LeadCreditPackage[] = [
  {
    packageId: 'LEAD-STARTER',
    name: 'Starter Pack',
    creditCount: 10,
    pricePerCredit: 2.50,
    totalPrice: 25.00,
    validityDays: 30,
    bonusCredits: 0,
  },
  {
    packageId: 'LEAD-GROWTH',
    name: 'Growth Pack',
    creditCount: 25,
    pricePerCredit: 2.00,
    totalPrice: 50.00,
    validityDays: 30,
    bonusCredits: 5,
    isPopular: true,
  },
  {
    packageId: 'LEAD-PROFESSIONAL',
    name: 'Professional Pack',
    creditCount: 50,
    pricePerCredit: 1.75,
    totalPrice: 87.50,
    validityDays: 60,
    bonusCredits: 10,
  },
  {
    packageId: 'LEAD-ENTERPRISE',
    name: 'Enterprise Pack',
    creditCount: 100,
    pricePerCredit: 1.50,
    totalPrice: 150.00,
    validityDays: 90,
    bonusCredits: 25,
  },
];

// Per-lead pricing
const PER_LEAD_PRICING: Record<Lead['leadType'], { minCredits: number; maxCredits: number }> = {
  direct: { minCredits: 1, maxCredits: 3 },
  referral: { minCredits: 2, maxCredits: 5 },
  featured: { minCredits: 3, maxCredits: 8 },
  premium: { minCredits: 5, maxCredits: 15 },
};

// ============================================
// Lead Generation Fee Service
// ============================================

export class LeadGenerationFeeService {
  private creditsModel: any;

  constructor() {
    this.initializeModel();
  }

  private initializeModel(): void {
    try {
      this.creditsModel = mongoose.models.ProviderLeadCredits || this.createCreditsSchema();
    } catch {
      this.creditsModel = this.createCreditsSchema();
    }
  }

  private createCreditsSchema(): any {
    const CreditsSchema = new mongoose.Schema({
      providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
      totalCredits: { type: Number, default: 0 },
      usedCredits: { type: Number, default: 0 },
      expiredCredits: { type: Number, default: 0 },
      availableCredits: { type: Number, default: 0 },
      purchasedCredits: { type: Number, default: 0 },
      freeCredits: { type: Number, default: 0 },
      creditHistory: [{
        type: { type: String, enum: ['purchase', 'bonus', 'used', 'expired', 'refund'] },
        amount: Number,
        balance: Number,
        description: String,
        referenceId: String,
        createdAt: { type: Date, default: Date.now },
      }],
      packageId: String,
      validUntil: Date,
      autoRefill: {
        enabled: { type: Boolean, default: false },
        threshold: { type: Number, default: 5 },
        refillAmount: { type: Number, default: 10 },
      },
    }, { timestamps: true });

    CreditsSchema.index({ providerId: 1 }, { unique: true });
    CreditsSchema.index({ validUntil: 1 });

    return mongoose.model('ProviderLeadCredits', CreditsSchema);
  }

  /**
   * Get available credit packages
   */
  getCreditPackages(): LeadCreditPackage[] {
    return CREDIT_PACKAGES;
  }

  /**
   * Get package by ID
   */
  getPackageById(packageId: string): LeadCreditPackage | undefined {
    return CREDIT_PACKAGES.find(p => p.packageId === packageId);
  }

  /**
   * Get provider's lead credits
   */
  async getProviderCredits(providerId: string | Types.ObjectId): Promise<ProviderLeadCredits | null> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    return this.creditsModel.findOne({ providerId: providerObjectId });
  }

  /**
   * Add credits to provider account
   */
  async addCredits(
    providerId: string | Types.ObjectId,
    amount: number,
    options: {
      type?: 'purchase' | 'bonus' | 'refund';
      packageId?: string;
      description?: string;
      validUntil?: Date;
    } = {}
  ): Promise<{ success: boolean; balance?: number; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      let credits = await this.creditsModel.findOne({ providerId: providerObjectId });

      if (!credits) {
        credits = new this.creditsModel({
          providerId: providerObjectId,
          totalCredits: 0,
          usedCredits: 0,
          expiredCredits: 0,
          availableCredits: 0,
          creditHistory: [],
        });
      }

      // Add credits
      credits.totalCredits += amount;
      credits.availableCredits += amount;

      if (options.type === 'purchase') {
        credits.purchasedCredits += amount;
      } else if (options.type === 'bonus') {
        credits.freeCredits += amount;
      }

      // Update validity
      if (options.validUntil) {
        credits.validUntil = options.validUntil;
      }

      // Add history entry
      credits.creditHistory.push({
        type: options.type || 'purchase',
        amount,
        balance: credits.availableCredits,
        description: options.description || `Added ${amount} credits`,
        referenceId: options.packageId,
        createdAt: new Date(),
      });

      await credits.save();

      logger.info('Lead credits added', {
        providerId: providerObjectId.toString(),
        amount,
        newBalance: credits.availableCredits,
        type: options.type,
      });

      return { success: true, balance: credits.availableCredits };
    } catch (error) {
      logger.error('Error adding lead credits', {
        providerId: providerId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add credits',
      };
    }
  }

  /**
   * Use credits for a lead
   */
  async useCredits(
    providerId: string | Types.ObjectId,
    leadId: string,
    creditCost: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      let credits = await this.creditsModel.findOne({ providerId: providerObjectId });

      if (!credits) {
        return { success: false, error: 'No credits found for provider' };
      }

      if (credits.availableCredits < creditCost) {
        return { success: false, error: `Insufficient credits. Required: ${creditCost}, Available: ${credits.availableCredits}` };
      }

      credits.availableCredits -= creditCost;
      credits.usedCredits += creditCost;

      credits.creditHistory.push({
        type: 'used',
        amount: -creditCost,
        balance: credits.availableCredits,
        description: `Used ${creditCost} credits for lead ${leadId}`,
        referenceId: leadId,
        createdAt: new Date(),
      });

      await credits.save();

      logger.info('Lead credits used', {
        providerId: providerObjectId.toString(),
        leadId,
        creditCost,
        remainingBalance: credits.availableCredits,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error using lead credits', {
        providerId: providerId.toString(),
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to use credits',
      };
    }
  }

  /**
   * Refund credits for bad lead
   */
  async refundCredits(
    providerId: string | Types.ObjectId,
    leadId: string,
    reason: string
  ): Promise<{ success: boolean; refundAmount?: number; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      const credits = await this.creditsModel.findOne({ providerId: providerObjectId });

      if (!credits) {
        return { success: false, error: 'No credits found for provider' };
      }

      // Find the lead cost from history
      const leadEntry = credits.creditHistory.find(
        (entry: { referenceId?: string; type?: string; amount?: number }) =>
          entry.referenceId === leadId && entry.type === 'used'
      );

      if (!leadEntry) {
        return { success: false, error: 'Lead not found in credit history' };
      }

      const refundAmount = Math.abs(leadEntry.amount);
      credits.availableCredits += refundAmount;
      credits.usedCredits -= refundAmount;

      credits.creditHistory.push({
        type: 'refund',
        amount: refundAmount,
        balance: credits.availableCredits,
        description: `Refunded for bad lead: ${reason}`,
        referenceId: leadId,
        createdAt: new Date(),
      });

      await credits.save();

      logger.info('Lead credits refunded', {
        providerId: providerObjectId.toString(),
        leadId,
        refundAmount,
        reason,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.LEAD_CREDITS_REFUNDED, {
        providerId: providerObjectId.toString(),
        leadId,
        refundAmount,
        reason,
      });

      return { success: true, refundAmount };
    } catch (error) {
      logger.error('Error refunding lead credits', {
        providerId: providerId.toString(),
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refund credits',
      };
    }
  }

  /**
   * Score lead quality based on various factors
   */
  scoreLeadQuality(lead: Partial<Lead>): number {
    let score = 50; // Base score

    // Contact info completeness
    if (lead.contactInfo?.email) score += 10;
    if (lead.contactInfo?.phone) score += 15;

    // Budget provided
    if (lead.budget?.min && lead.budget?.max) {
      score += 15;
      if (lead.budget.max > 500) score += 10;
    }

    // Requirements provided
    if (lead.requirements && lead.requirements.length > 20) score += 10;

    // Customer history
    const history = lead.metadata?.customerHistory;
    if (history) {
      if (history.previousBookings && history.previousBookings > 3) score += 15;
      if (history.averageRating && history.averageRating >= 4) score += 10;
    }

    // Clamp score between 0 and 100
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Categorize lead quality based on score
   */
  categorizeLeadQuality(score: number): Lead['quality'] {
    if (score >= 80) return 'hot';
    if (score >= 50) return 'warm';
    return 'cold';
  }

  /**
   * Calculate credit cost for a lead
   */
  calculateCreditCost(
    leadType: Lead['leadType'],
    quality: Lead['quality'],
    options: { includeProviderMetrics?: boolean; providerRating?: number } = {}
  ): number {
    const pricing = PER_LEAD_PRICING[leadType];
    let cost = (pricing.minCredits + pricing.maxCredits) / 2;

    // Quality multiplier
    const qualityMultiplier: Record<Lead['quality'], number> = {
      hot: 1.5,
      warm: 1.0,
      cold: 0.5,
    };
    cost *= qualityMultiplier[quality];

    // Provider rating bonus (higher rated providers pay more for premium leads)
    if (options.includeProviderMetrics && options.providerRating) {
      if (options.providerRating >= 4.5) {
        cost *= 1.2;
      } else if (options.providerRating >= 4.0) {
        cost *= 1.1;
      }
    }

    return Math.round(cost * 100) / 100;
  }

  /**
   * Purchase lead credits package
   */
  async purchasePackage(
    providerId: string | Types.ObjectId,
    packageId: string,
    options: { paymentId?: string } = {}
  ): Promise<{ success: boolean; creditsAdded?: number; error?: string }> {
    try {
      const packageData = this.getPackageById(packageId);
      if (!packageData) {
        return { success: false, error: 'Package not found' };
      }

      const totalCredits = packageData.creditCount + (packageData.bonusCredits || 0);
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + packageData.validityDays);

      const result = await this.addCredits(providerId, totalCredits, {
        type: 'purchase',
        packageId,
        description: `Purchased ${packageData.name}: ${packageData.creditCount} credits + ${packageData.bonusCredits || 0} bonus`,
        validUntil,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      logger.info('Lead credits package purchased', {
        providerId: providerId.toString(),
        packageId,
        creditsAdded: totalCredits,
      });

      return { success: true, creditsAdded: totalCredits };
    } catch (error) {
      logger.error('Error purchasing lead credits package', {
        providerId: providerId.toString(),
        packageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to purchase package',
      };
    }
  }

  /**
   * Get credit history for provider
   */
  async getCreditHistory(
    providerId: string | Types.ObjectId,
    options: { type?: string; page?: number; limit?: number } = {}
  ): Promise<{ history: ProviderLeadCredits['creditHistory']; total: number }> {
    const credits = await this.getProviderCredits(providerId);
    if (!credits) {
      return { history: [], total: 0 };
    }

    let history = [...credits.creditHistory];
    if (options.type) {
      history = history.filter(h => h.type === options.type);
    }

    // Sort by date descending
    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    return {
      history: history.slice(skip, skip + limit),
      total: history.length,
    };
  }

  /**
   * Process expired credits
   */
  async processExpiredCredits(): Promise<{ processed: number }> {
    const expiredCredits = await this.creditsModel.find({
      validUntil: { $lt: new Date() },
      availableCredits: { $gt: 0 },
    });

    for (const credit of expiredCredits) {
      const expiredAmount = credit.availableCredits;
      credit.expiredCredits += expiredAmount;
      credit.totalCredits -= expiredAmount;
      credit.availableCredits = 0;

      credit.creditHistory.push({
        type: 'expired',
        amount: -expiredAmount,
        balance: 0,
        description: `Expired ${expiredAmount} credits`,
        createdAt: new Date(),
      });

      await credit.save();

      logger.info('Expired lead credits processed', {
        providerId: credit.providerId.toString(),
        expiredAmount,
      });
    }

    return { processed: expiredCredits.length };
  }

  /**
   * Set up auto-refill for provider
   */
  async setAutoRefill(
    providerId: string | Types.ObjectId,
    settings: { enabled: boolean; threshold?: number; refillAmount?: number }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      await this.creditsModel.findOneAndUpdate(
        { providerId: providerObjectId },
        {
          $set: {
            autoRefill: {
              enabled: settings.enabled,
              threshold: settings.threshold || 5,
              refillAmount: settings.refillAmount || 10,
            },
          },
        },
        { upsert: true }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set auto-refill',
      };
    }
  }
}

// ============================================
// Export singleton instance
// ============================================

export const leadGenerationFeeService = new LeadGenerationFeeService();
export default leadGenerationFeeService;
