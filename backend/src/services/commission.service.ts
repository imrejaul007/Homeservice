import mongoose, { Types } from 'mongoose';
import { Commission, CommissionRule, ICommission, ICommissionRule, ICommissionTier } from '../models/commission.model';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import logger from '../utils/logger';

// Commission calculation input
export interface CommissionCalculationInput {
  bookingId: string | Types.ObjectId;
  providerId: string | Types.ObjectId;
  serviceId: string | Types.ObjectId;
  grossAmount: number;
  discountAmount?: number;
  categoryId?: string | Types.ObjectId;
}

// Commission calculation result
export interface CommissionCalculationResult {
  success: boolean;
  commission?: ICommission;
  error?: string;
}

// Provider commission summary
export interface ProviderCommissionSummary {
  providerId: string | Types.ObjectId;
  period: { start: Date; end: Date };
  totalGross: number;
  totalNet: number;
  totalCommission: number;
  totalPlatformFee: number;
  totalPaymentProcessingFee: number;
  totalTax: number;
  totalProviderEarnings: number;
  bookingCount: number;
  averageCommissionRate: number;
  byStatus: {
    status: ICommission['status'];
    count: number;
    amount: number;
  }[];
  byCategory: {
    categoryId: Types.ObjectId;
    categoryName: string;
    count: number;
    grossAmount: number;
    commission: number;
  }[];
}

// Default commission rates
const DEFAULT_COMMISSION_RATE = 15; // 15%
const DEFAULT_PLATFORM_FEE = 0; // No additional platform fee
const DEFAULT_PAYMENT_PROCESSING_FEE_PERCENT = 2.5; // 2.5% payment processing fee

// Service to handle commission calculations
export class CommissionService {
  /**
   * Get the applicable commission rule for a booking
   */
  private async getApplicableRule(params: {
    providerId: Types.ObjectId;
    categoryId?: Types.ObjectId;
    amount: number;
    date?: Date;
  }): Promise<ICommissionRule | null> {
    const { providerId, categoryId, amount, date = new Date() } = params;

    // Priority order:
    // 1. Provider-specific rule (highest priority)
    // 2. Category-specific rule
    // 3. Promotional rule
    // 4. Standard tiered rule
    // 5. Standard flat rule (fallback)

    // Try provider-specific rule first
    const providerRule = await CommissionRule.findOne({
      providerId,
      isActive: true,
      type: 'provider',
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: date } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: date } }] },
      ],
    }).sort({ priority: -1 });

    if (providerRule) {
      return providerRule;
    }

    // Try category-specific rule
    if (categoryId) {
      const categoryRule = await CommissionRule.findOne({
        categoryId,
        isActive: true,
        type: 'category',
        $and: [
          { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: date } }] },
          { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: date } }] },
        ],
      }).sort({ priority: -1 });

      if (categoryRule) {
        return categoryRule;
      }
    }

    // Try promotional rule
    const promoRule = await CommissionRule.findOne({
      type: 'promotional',
      isActive: true,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: date } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: date } }] },
      ],
    })
      .sort({ priority: -1, rate: 1 }) // Lower rate is better for providers
      .limit(1);

    if (promoRule) {
      return promoRule;
    }

    // Try tiered standard rule
    const tieredRule = await CommissionRule.findOne({
      type: 'tiered',
      isActive: true,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: date } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: date } }] },
      ],
    }).sort({ priority: -1 });

    if (tieredRule && tieredRule.tiers && tieredRule.tiers.length > 0) {
      return tieredRule;
    }

    // Fall back to standard rule
    const standardRule = await CommissionRule.findOne({
      type: 'standard',
      isActive: true,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: date } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: date } }] },
      ],
    }).sort({ priority: -1 });

    if (standardRule) {
      return standardRule;
    }

    // No rule found - return null and use default
    return null;
  }

  /**
   * Calculate commission rate based on tiered rules
   */
  private calculateTieredRate(tiers: ICommissionTier[], amount: number): ICommissionTier | null {
    if (!tiers || tiers.length === 0) {
      return null;
    }

    // Find the applicable tier
    const sortedTiers = [...tiers].sort((a, b) => a.minAmount - b.minAmount);

    for (const tier of sortedTiers) {
      if (amount >= tier.minAmount && amount <= tier.maxAmount) {
        return tier;
      }
    }

    // If amount exceeds all tiers, use the highest tier
    const highestTier = sortedTiers[sortedTiers.length - 1];
    if (amount > highestTier.maxAmount) {
      return highestTier;
    }

    return sortedTiers[0];
  }

  /**
   * Calculate commission for a booking
   */
  async calculateCommission(input: CommissionCalculationInput): Promise<CommissionCalculationResult> {
    try {
      const bookingId = typeof input.bookingId === 'string' ? new Types.ObjectId(input.bookingId) : input.bookingId;
      const providerId = typeof input.providerId === 'string' ? new Types.ObjectId(input.providerId) : input.providerId;
      const serviceId = typeof input.serviceId === 'string' ? new Types.ObjectId(input.serviceId) : input.serviceId;
      const categoryId = input.categoryId
        ? typeof input.categoryId === 'string'
          ? new Types.ObjectId(input.categoryId)
          : input.categoryId
        : undefined;

      // Check if commission already exists for this booking
      const existingCommission = await Commission.findOne({ bookingId });
      if (existingCommission) {
        return {
          success: false,
          error: 'Commission already calculated for this booking',
        };
      }

      // Get booking details
      const booking = await Booking.findById(bookingId).populate('customerId');
      if (!booking) {
        return {
          success: false,
          error: 'Booking not found',
        };
      }

      // Get service details
      const service = await Service.findById(serviceId);
      if (!service) {
        return {
          success: false,
          error: 'Service not found',
        };
      }

      // Get applicable commission rule
      const rule = await this.getApplicableRule({
        providerId,
        categoryId,
        amount: input.grossAmount,
        date: booking.scheduledDate,
      });

      // Calculate commission amounts
      const grossAmount = input.grossAmount;
      const discountAmount = input.discountAmount || 0;
      const netAmount = Math.max(0, grossAmount - discountAmount);

      let commissionRate: number;
      let commissionAmount: number;
      let tierApplied: ICommissionTier | undefined;
      let ruleName: string;
      let ruleType: ICommissionRule['type'];
      let ruleId: Types.ObjectId;

      if (rule) {
        ruleId = rule._id as Types.ObjectId;
        ruleName = rule.name;
        ruleType = rule.type;

        if (rule.type === 'tiered' && rule.tiers && rule.tiers.length > 0) {
          const tierResult = this.calculateTieredRate(rule.tiers, netAmount);
          tierApplied = tierResult ?? undefined;
          commissionRate = tierApplied?.rate || rule.rate || DEFAULT_COMMISSION_RATE;
        } else {
          commissionRate = rule.rate || DEFAULT_COMMISSION_RATE;
        }

        // Calculate commission amount
        if (rule.commissionType === 'flat' && rule.flatAmount) {
          commissionAmount = rule.flatAmount;
        } else {
          commissionAmount = rule.appliesTo === 'gross' ? grossAmount * (commissionRate / 100) : netAmount * (commissionRate / 100);
        }
      } else {
        // Use default commission rate
        ruleId = new Types.ObjectId();
        ruleName = 'Default Commission';
        ruleType = 'standard';
        commissionRate = DEFAULT_COMMISSION_RATE;
        commissionAmount = netAmount * (DEFAULT_COMMISSION_RATE / 100);
      }

      // Calculate platform and processing fees
      const platformFee = rule?.type === 'promotional' ? 0 : DEFAULT_PLATFORM_FEE;
      const paymentProcessingFee = netAmount * (DEFAULT_PAYMENT_PROCESSING_FEE_PERCENT / 100);

      // Calculate total deductions and provider earnings
      const totalDeductions = commissionAmount + platformFee + paymentProcessingFee;
      const providerEarnings = Math.max(0, netAmount - totalDeductions);

      // Get category name
      let categoryName = 'Uncategorized';
      if (categoryId) {
        try {
          const ServiceCategory = mongoose.model('ServiceCategory');
          const category = await ServiceCategory.findById(categoryId);
          if (category) {
            categoryName = category.name;
          }
        } catch {
          // Category lookup failed, use default
        }
      }

      // Get provider name
      let providerName = 'Unknown Provider';
      try {
        const User = mongoose.model('User');
        const provider = await User.findById(providerId);
        if (provider) {
          providerName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Unknown Provider';
        }
      } catch {
        // Provider lookup failed, use default
      }

      // Create commission record
      const commission = new Commission({
        bookingId,
        bookingNumber: booking.bookingNumber,
        providerId,
        serviceId,
        categoryId,
        grossAmount,
        discountAmount,
        netAmount,
        commissionRate,
        commissionType: rule?.commissionType || 'percentage',
        commissionAmount,
        platformFee,
        paymentProcessingFee,
        totalDeductions,
        providerEarnings,
        ruleId,
        ruleName,
        ruleType,
        tierApplied: tierApplied
          ? {
              minAmount: tierApplied.minAmount,
              maxAmount: tierApplied.maxAmount,
              rate: tierApplied.rate,
            }
          : undefined,
        status: 'calculated',
        calculatedAt: new Date(),
        metadata: {
          customerId: booking.customerId as Types.ObjectId,
          serviceTitle: service.name || 'Unknown Service',
          categoryName,
          providerName,
          bookingDate: booking.scheduledDate,
          currency: booking.pricing.currency || 'AED',
        },
      });

      await commission.save();

      logger.info('Commission calculated', {
        commissionId: commission._id,
        bookingId,
        providerId,
        grossAmount,
        commissionAmount,
        providerEarnings,
        ruleName,
      });

      return {
        success: true,
        commission,
      };
    } catch (error) {
      logger.error('Error calculating commission', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate commission',
      };
    }
  }

  /**
   * Batch calculate commissions for multiple bookings
   */
  async batchCalculateCommissions(bookingIds: string[]): Promise<{
    success: number;
    failed: number;
    errors: { bookingId: string; error: string }[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as { bookingId: string; error: string }[],
    };

    for (const bookingId of bookingIds) {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          results.failed++;
          results.errors.push({ bookingId, error: 'Booking not found' });
          continue;
        }

        const input: CommissionCalculationInput = {
          bookingId: booking._id,
          providerId: booking.providerId,
          serviceId: booking.serviceId,
          grossAmount: booking.pricing.totalAmount,
          discountAmount: (booking.pricing as any).couponDiscount || 0,
        };

        // Try to get category from service
        try {
          const service = await Service.findById(booking.serviceId);
          if (service && 'category' in service) {
            input.categoryId = (service as any).category?.toString();
          }
        } catch {
          // Service lookup failed, continue without category
        }

        const result = await this.calculateCommission(input);

        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({ bookingId, error: result.error || 'Unknown error' });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          bookingId,
          error: error instanceof Error ? error.message : 'Failed to process booking',
        });
      }
    }

    logger.info('Batch commission calculation completed', {
      total: bookingIds.length,
      success: results.success,
      failed: results.failed,
    });

    return results;
  }

  /**
   * Get commission by ID
   */
  async getCommissionById(commissionId: string | Types.ObjectId): Promise<ICommission | null> {
    return Commission.findById(commissionId).populate('bookingId serviceId categoryId providerId');
  }

  /**
   * Get commissions for a provider
   */
  async getProviderCommissions(
    providerId: string | Types.ObjectId,
    options: {
      startDate?: Date;
      endDate?: Date;
      status?: ICommission['status'];
      categoryId?: string | Types.ObjectId;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ commissions: ICommission[]; total: number; page: number; totalPages: number }> {
    const providerObjectId = typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { providerId: providerObjectId };

    if (options.startDate || options.endDate) {
      query['metadata.bookingDate'] = {};
      if (options.startDate) {
        query['metadata.bookingDate'].$gte = options.startDate;
      }
      if (options.endDate) {
        query['metadata.bookingDate'].$lte = options.endDate;
      }
    }

    if (options.status) {
      query.status = options.status;
    }

    if (options.categoryId) {
      const categoryObjectId =
        typeof options.categoryId === 'string' ? new Types.ObjectId(options.categoryId) : options.categoryId;
      query.categoryId = categoryObjectId;
    }

    const [commissions, total] = await Promise.all([
      Commission.find(query).sort({ 'metadata.bookingDate': -1 }).skip(skip).limit(limit),
      Commission.countDocuments(query),
    ]);

    return {
      commissions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get provider commission summary
   */
  async getProviderCommissionSummary(
    providerId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderCommissionSummary> {
    const providerObjectId = typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    // Get all commissions in the period
    const commissions = await Commission.find({
      providerId: providerObjectId,
      'metadata.bookingDate': { $gte: startDate, $lte: endDate },
    });

    // Calculate summary
    let totalGross = 0;
    let totalNet = 0;
    let totalCommission = 0;
    let totalPlatformFee = 0;
    let totalPaymentProcessingFee = 0;
    let totalTax = 0;
    let totalProviderEarnings = 0;
    const statusMap = new Map<string, { count: number; amount: number }>();
    const categoryMap = new Map<string, { name: string; count: number; gross: number; commission: number }>();

    for (const comm of commissions) {
      totalGross += comm.grossAmount;
      totalNet += comm.netAmount;
      totalCommission += comm.commissionAmount;
      totalPlatformFee += comm.platformFee;
      totalPaymentProcessingFee += comm.paymentProcessingFee;
      totalTax += comm.taxAmount;
      totalProviderEarnings += comm.providerEarnings;

      // By status
      const statusKey = comm.status;
      const existingStatus = statusMap.get(statusKey) || { count: 0, amount: 0 };
      statusMap.set(statusKey, {
        count: existingStatus.count + 1,
        amount: existingStatus.amount + comm.commissionAmount,
      });

      // By category
      const categoryKey = comm.categoryId?.toString() || 'uncategorized';
      const existingCategory = categoryMap.get(categoryKey) || {
        name: comm.metadata?.categoryName || 'Uncategorized',
        count: 0,
        gross: 0,
        commission: 0,
      };
      categoryMap.set(categoryKey, {
        name: existingCategory.name,
        count: existingCategory.count + 1,
        gross: existingCategory.gross + comm.grossAmount,
        commission: existingCategory.commission + comm.commissionAmount,
      });
    }

    const byStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
      status: status as ICommission['status'],
      count: data.count,
      amount: data.amount,
    }));

    const byCategory = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId: new Types.ObjectId(categoryId === 'uncategorized' ? '000000000000000000000000' : categoryId),
      categoryName: data.name,
      count: data.count,
      grossAmount: data.gross,
      commission: data.commission,
    }));

    return {
      providerId: providerObjectId,
      period: { start: startDate, end: endDate },
      totalGross,
      totalNet,
      totalCommission,
      totalPlatformFee,
      totalPaymentProcessingFee,
      totalTax,
      totalProviderEarnings,
      bookingCount: commissions.length,
      averageCommissionRate: totalGross > 0 ? (totalCommission / totalGross) * 100 : 0,
      byStatus,
      byCategory,
    };
  }

  /**
   * Adjust commission (bonus, penalty, or correction)
   */
  async adjustCommission(
    commissionId: string | Types.ObjectId,
    adjustment: {
      type: 'bonus' | 'penalty' | 'correction' | 'promotion';
      amount: number;
      reason: string;
    },
    adjustedBy: string | Types.ObjectId,
    adjustedByRole: 'admin' | 'provider'
  ): Promise<{ success: boolean; commission?: ICommission; error?: string }> {
    try {
      const commissionObjectId =
        typeof commissionId === 'string' ? new Types.ObjectId(commissionId) : commissionId;
      const adjustedByObjectId = typeof adjustedBy === 'string' ? new Types.ObjectId(adjustedBy) : adjustedBy;

      const commission = await Commission.findById(commissionObjectId);
      if (!commission) {
        return { success: false, error: 'Commission not found' };
      }

      // Cannot adjust paid commissions
      if (commission.status === 'paid') {
        return { success: false, error: 'Cannot adjust paid commissions' };
      }

      // Apply adjustment
      commission.adjustment = {
        type: adjustment.type,
        amount: adjustment.amount,
        reason: adjustment.reason,
        adjustedBy: adjustedByObjectId,
        adjustedAt: new Date(),
      };

      // Recalculate earnings
      (commission as any).recalculateEarnings();

      await commission.save();

      logger.info('Commission adjusted', {
        commissionId: commission._id,
        adjustment,
        newEarnings: commission.providerEarnings,
      });

      return { success: true, commission };
    } catch (error) {
      logger.error('Error adjusting commission', { error, commissionId, adjustment });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to adjust commission',
      };
    }
  }

  /**
   * Update commission status
   */
  async updateCommissionStatus(
    commissionId: string | Types.ObjectId,
    newStatus: ICommission['status'],
    changedBy: string | Types.ObjectId,
    changedByRole: 'system' | 'admin' | 'provider',
    reason?: string
  ): Promise<{ success: boolean; commission?: ICommission; error?: string }> {
    try {
      const commissionObjectId =
        typeof commissionId === 'string' ? new Types.ObjectId(commissionId) : commissionId;
      const changedByObjectId = typeof changedBy === 'string' ? new Types.ObjectId(changedBy) : changedBy;

      const commission = await Commission.findById(commissionObjectId);
      if (!commission) {
        return { success: false, error: 'Commission not found' };
      }

      await (commission as any).updateStatus(newStatus, changedByObjectId, changedByRole, reason);

      logger.info('Commission status updated', {
        commissionId: commission._id,
        oldStatus: commission.status,
        newStatus,
        changedBy,
      });

      return { success: true, commission };
    } catch (error) {
      logger.error('Error updating commission status', { error, commissionId, newStatus });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update commission status',
      };
    }
  }

  /**
   * Create a default commission rule
   */
  async createDefaultCommissionRule(): Promise<void> {
    const existingRule = await CommissionRule.findOne({ type: 'standard', isActive: true });
    if (existingRule) {
      return; // Default rule already exists
    }

    const defaultRule = new CommissionRule({
      name: 'Standard Commission',
      description: 'Default commission rate applied to all bookings without specific rules',
      type: 'standard',
      rate: DEFAULT_COMMISSION_RATE,
      commissionType: 'percentage',
      appliesTo: 'net',
      isActive: true,
      priority: 0,
    });

    await defaultRule.save();
    logger.info('Default commission rule created', { ruleId: defaultRule._id });
  }

  /**
   * Create tiered commission rule
   */
  async createTieredCommissionRule(
    name: string,
    description: string,
    tiers: ICommissionTier[],
    options: { appliesTo?: 'gross' | 'net'; priority?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<ICommissionRule> {
    const rule = new CommissionRule({
      name,
      description,
      type: 'tiered',
      tiers,
      commissionType: 'percentage',
      appliesTo: options.appliesTo || 'net',
      isActive: true,
      priority: options.priority || 10,
      startDate: options.startDate,
      endDate: options.endDate,
    });

    await rule.save();
    logger.info('Tiered commission rule created', { ruleId: rule._id, name, tiers });
    return rule;
  }

  /**
   * Create category-specific commission rule
   */
  async createCategoryCommissionRule(
    categoryId: string | Types.ObjectId,
    rate: number,
    name: string,
    options: { description?: string; commissionType?: 'percentage' | 'flat'; flatAmount?: number } = {}
  ): Promise<ICommissionRule> {
    const categoryObjectId = typeof categoryId === 'string' ? new Types.ObjectId(categoryId) : categoryId;

    const rule = new CommissionRule({
      name: name || `Commission for Category`,
      description: options.description,
      type: 'category',
      categoryId: categoryObjectId,
      rate,
      commissionType: options.commissionType || 'percentage',
      flatAmount: options.flatAmount,
      appliesTo: 'net',
      isActive: true,
      priority: 20,
    });

    await rule.save();
    logger.info('Category commission rule created', { ruleId: rule._id, categoryId, rate });
    return rule;
  }
}

// Export singleton instance
export const commissionService = new CommissionService();

export default commissionService;
