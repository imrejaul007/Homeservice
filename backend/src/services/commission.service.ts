import mongoose, { Types, ClientSession } from 'mongoose';
import { Commission, CommissionRule, ICommission, ICommissionRule, ICommissionTier } from '../models/commission.model';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import logger from '../utils/logger';
import { taxService } from './taxService';
import { getPlatformPolicySync } from './platformSettingsPolicy.service';

// Commission calculation input
export interface CommissionCalculationInput {
  bookingId: string | Types.ObjectId;
  providerId: string | Types.ObjectId;
  serviceId: string | Types.ObjectId;
  grossAmount: number;
  discountAmount?: number;
  taxAmount?: number;
  categoryId?: string | Types.ObjectId;
  region?: string;
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
   * PERFORMANCE FIX: Single aggregation query with $or conditions instead of up to 5 sequential queries
   */
  private async getApplicableRule(params: {
    providerId: Types.ObjectId;
    categoryId?: Types.ObjectId;
    amount: number;
    date?: Date;
  }): Promise<ICommissionRule | null> {
    const { providerId, categoryId, amount, date = new Date() } = params;

    // Build match conditions that apply to all rule types
    const dateCondition = {
      startDate: {
        $or: [
          { $exists: false },
          { $lte: date },
        ],
      },
      endDate: {
        $or: [
          { $exists: false },
          { $gte: date },
        ],
      },
    };

    // Single aggregation query to fetch all applicable rules
    const rules = await CommissionRule.aggregate([
      {
        $match: {
          isActive: true,
          ...dateCondition,
          $or: [
            // Provider-specific rule
            { providerId, type: 'provider' },
            // Category-specific rule
            ...(categoryId ? [{ categoryId, type: 'category' }] : []),
            // Promotional rule
            { type: 'promotional' },
            // Tiered rule
            { type: 'tiered', tiers: { $exists: true, $ne: [] } },
            // Standard rule
            { type: 'standard' },
          ],
        },
      },
      // Sort by priority (descending) and rate (ascending for promotional)
      { $sort: { priority: -1, rate: 1 } },
      // Limit to reasonable number for post-processing
      { $limit: 10 },
    ]);

    if (rules.length === 0) {
      return null;
    }

    // Priority order (must match original logic):
    // 1. Provider-specific rule (highest priority)
    // 2. Category-specific rule
    // 3. Promotional rule
    // 4. Standard tiered rule
    // 5. Standard flat rule (fallback)
    const priorityOrder = ['provider', 'category', 'promotional', 'tiered', 'standard'];

    // Find first matching rule by priority
    for (const type of priorityOrder) {
      const rule = rules.find(r => r.type === type);
      if (rule) {
        // For tiered rules, also verify it has valid tiers
        if (type === 'tiered' && (!rule.tiers || rule.tiers.length === 0)) {
          continue;
        }
        return rule as unknown as ICommissionRule;
      }
    }

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
      const providedTaxAmount = input.taxAmount || 0;

      // Calculate tax on commission using taxService (for UAE VAT, KSA VAT, etc.)
      const region = input.region || 'AE';
      const commissionTaxResult = await taxService.calculateCommissionTax(
        grossAmount - discountAmount,
        providerId,
        region
      );
      const taxAmount = Math.max(providedTaxAmount, commissionTaxResult.taxAmount);

      // Net amount after discount and tax (commission is calculated on pre-tax amount)
      const taxableAmount = Math.max(0, grossAmount - discountAmount - taxAmount);
      const netAmount = taxableAmount;

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
          const tierResult = this.calculateTieredRate(rule.tiers, taxableAmount);
          tierApplied = tierResult ?? undefined;
          commissionRate = tierApplied?.rate || rule.rate || DEFAULT_COMMISSION_RATE;
        } else {
          commissionRate = rule.rate || DEFAULT_COMMISSION_RATE;
        }

        // Calculate commission amount
        if (rule.commissionType === 'flat' && rule.flatAmount) {
          commissionAmount = rule.flatAmount;
        } else {
          commissionAmount = rule.appliesTo === 'gross'
            ? grossAmount * (commissionRate / 100)
            : taxableAmount * (commissionRate / 100);
        }
      } else {
        // Use default commission rate
        ruleId = new Types.ObjectId();
        ruleName = 'Default Commission';
        ruleType = 'standard';
        commissionRate = getPlatformPolicySync().commissionRate ?? DEFAULT_COMMISSION_RATE;
        commissionAmount = taxableAmount * (commissionRate / 100);
      }

      const processingFeePercent =
        getPlatformPolicySync().paymentProcessingFee ?? DEFAULT_PAYMENT_PROCESSING_FEE_PERCENT;

      // Calculate platform and processing fees
      const platformFee = rule?.type === 'promotional' ? 0 : DEFAULT_PLATFORM_FEE;
      const paymentProcessingFee = taxableAmount * (processingFeePercent / 100);

      // Calculate total deductions and provider earnings
      const totalDeductions = commissionAmount + platformFee + paymentProcessingFee;
      const providerEarnings = Math.max(0, grossAmount - discountAmount - taxAmount - totalDeductions);

      // Get category name and provider name in parallel
      // PERFORMANCE FIX: Parallel execution instead of sequential queries
      let categoryName = 'Uncategorized';
      let providerName = 'Unknown Provider';

      const [categoryResult, providerResult] = await Promise.all([
        categoryId
          ? (async () => {
              try {
                const ServiceCategory = mongoose.model('ServiceCategory');
                const category = await ServiceCategory.findById(categoryId).lean() as { name?: string } | null;
                return category?.name || 'Uncategorized';
              } catch (error) {
                logger.warn('Failed to lookup ServiceCategory for commission', {
                  categoryId: categoryId?.toString(),
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
                return 'Uncategorized';
              }
            })()
          : Promise.resolve('Uncategorized'),
        (async () => {
          try {
            const User = mongoose.model('User');
            const provider = await User.findById(providerId).lean();
            if (provider) {
              return `${(provider as any).firstName || ''} ${(provider as any).lastName || ''}`.trim() || 'Unknown Provider';
            }
            return 'Unknown Provider';
          } catch {
            return 'Unknown Provider';
          }
        })(),
      ]);

      categoryName = categoryResult;
      providerName = providerResult;

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
        taxAmount,
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

      // FIX: Wrap check + create in transaction to prevent race conditions
      const session = await mongoose.startSession();
      let transactionSuccess = false;
      try {
        session.startTransaction();

        // Check inside transaction to prevent race condition
        const existingCommission = await Commission.findOne({ bookingId }).session(session);
        if (existingCommission) {
          await session.abortTransaction();
          transactionSuccess = true;
          return {
            success: false,
            error: 'Commission already calculated for this booking',
          };
        }

        await commission.save({ session });
        await session.commitTransaction();
        transactionSuccess = true;

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
        if (!transactionSuccess) {
          await session.abortTransaction();
        }
        logger.error('Error calculating commission', { error, input });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to calculate commission',
        };
      } finally {
        if (session && !session.hasEnded) {
          await session.endSession();
        }
      }
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
          taxAmount: (booking.pricing as any).tax || 0,
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
   * PERFORMANCE FIX: Use selective field population to reduce data transfer
   */
  async getCommissionById(commissionId: string | Types.ObjectId): Promise<ICommission | null> {
    return Commission.findById(commissionId).populate([
      { path: 'bookingId', select: 'bookingNumber customerId serviceId providerId scheduledDate pricing status' },
      { path: 'serviceId', select: 'name description' },
      { path: 'categoryId', select: 'name' },
      { path: 'providerId', select: 'firstName lastName email' },
    ]);
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
   * PERFORMANCE FIX: Uses MongoDB aggregation pipeline instead of loading all records into memory
   */
  async getProviderCommissionSummary(
    providerId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderCommissionSummary> {
    const providerObjectId = typeof providerId === 'string' ? new Types.ObjectId(providerId) : providerId;

    // Use aggregation pipeline for database-level computation
    const result = await Commission.aggregate([
      // Match by provider and date range (also check completedAt for safety)
      {
        $match: {
          providerId: providerObjectId,
          $or: [
            { 'metadata.bookingDate': { $gte: startDate, $lte: endDate } },
            { completedAt: { $gte: startDate, $lte: endDate } },
          ],
        },
      },
      // Group all commissions and compute totals
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossAmount' },
          totalNet: { $sum: '$netAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalPlatformFee: { $sum: '$platformFee' },
          totalPaymentProcessingFee: { $sum: '$paymentProcessingFee' },
          totalTax: { $sum: '$taxAmount' },
          totalProviderEarnings: { $sum: '$providerEarnings' },
          bookingCount: { $sum: 1 },
          // Group by status
          byStatus: {
            $push: {
              status: '$status',
              commissionAmount: '$commissionAmount',
            },
          },
          // Group by category
          byCategory: {
            $push: {
              categoryId: '$categoryId',
              categoryName: { $ifNull: ['$metadata.categoryName', 'Uncategorized'] },
              grossAmount: '$grossAmount',
              commissionAmount: '$commissionAmount',
            },
          },
        },
      },
      // Compute average commission rate
      {
        $addFields: {
          averageCommissionRate: {
            $cond: {
              if: { $gt: ['$totalGross', 0] },
              then: { $multiply: [{ $divide: ['$totalCommission', '$totalGross'] }, 100] },
              else: 0,
            },
          },
        },
      },
    ]);

    // Handle empty result
    if (!result.length) {
      return {
        providerId: providerObjectId,
        period: { start: startDate, end: endDate },
        totalGross: 0,
        totalNet: 0,
        totalCommission: 0,
        totalPlatformFee: 0,
        totalPaymentProcessingFee: 0,
        totalTax: 0,
        totalProviderEarnings: 0,
        bookingCount: 0,
        averageCommissionRate: 0,
        byStatus: [],
        byCategory: [],
      };
    }

    const data = result[0];

    // Aggregate by status
    const statusGroups = new Map<string, { count: number; amount: number }>();
    for (const item of data.byStatus) {
      const existing = statusGroups.get(item.status) || { count: 0, amount: 0 };
      statusGroups.set(item.status, {
        count: existing.count + 1,
        amount: existing.amount + item.commissionAmount,
      });
    }
    const byStatus = Array.from(statusGroups.entries()).map(([status, stats]) => ({
      status: status as ICommission['status'],
      count: stats.count,
      amount: stats.amount,
    }));

    // Aggregate by category
    const categoryGroups = new Map<string, { name: string; count: number; gross: number; commission: number }>();
    for (const item of data.byCategory) {
      const key = item.categoryId?.toString() || 'uncategorized';
      const existing = categoryGroups.get(key) || {
        name: item.categoryName,
        count: 0,
        gross: 0,
        commission: 0,
      };
      categoryGroups.set(key, {
        name: item.categoryName,
        count: existing.count + 1,
        gross: existing.gross + item.grossAmount,
        commission: existing.commission + item.commissionAmount,
      });
    }
    const byCategory = Array.from(categoryGroups.entries()).map(([categoryId, stats]) => ({
      categoryId: new Types.ObjectId(categoryId === 'uncategorized' ? '000000000000000000000000' : categoryId),
      categoryName: stats.name,
      count: stats.count,
      grossAmount: stats.gross,
      commission: stats.commission,
    }));

    return {
      providerId: providerObjectId,
      period: { start: startDate, end: endDate },
      totalGross: data.totalGross,
      totalNet: data.totalNet,
      totalCommission: data.totalCommission,
      totalPlatformFee: data.totalPlatformFee,
      totalPaymentProcessingFee: data.totalPaymentProcessingFee,
      totalTax: data.totalTax,
      totalProviderEarnings: data.totalProviderEarnings,
      bookingCount: data.bookingCount,
      averageCommissionRate: data.averageCommissionRate,
      byStatus,
      byCategory,
    };
  }

  /**
   * Adjust commission (bonus, penalty, or correction)
   * HIGH SEVERITY FIX: Wrapped in transaction to ensure atomicity with CommissionHistory
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
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const commissionObjectId =
        typeof commissionId === 'string' ? new Types.ObjectId(commissionId) : commissionId;
      const adjustedByObjectId = typeof adjustedBy === 'string' ? new Types.ObjectId(adjustedBy) : adjustedBy;

      const commission = await Commission.findById(commissionObjectId).session(session);
      if (!commission) {
        await session.abortTransaction();
        return { success: false, error: 'Commission not found' };
      }

      // Cannot adjust paid commissions
      if (commission.status === 'paid') {
        await session.abortTransaction();
        return { success: false, error: 'Cannot adjust paid commissions' };
      }

      // Store previous values for history
      const previousStatus = commission.status;
      const previousEarnings = commission.providerEarnings;

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

      // Create CommissionHistory entry
      const CommissionHistory = mongoose.model('CommissionHistory');
      const historyEntry = new CommissionHistory({
        commissionId: commission._id,
        previousStatus,
        previousEarnings,
        newStatus: commission.status,
        newEarnings: commission.providerEarnings,
        adjustment: {
          type: adjustment.type,
          amount: adjustment.amount,
          reason: adjustment.reason,
        },
        adjustedBy: adjustedByObjectId,
        adjustedByRole,
        adjustedAt: new Date(),
      });
      await historyEntry.save({ session });

      // Save commission
      await commission.save({ session });

      await session.commitTransaction();

      logger.info('Commission adjusted with history', {
        commissionId: commission._id,
        adjustment,
        newEarnings: commission.providerEarnings,
        historyId: historyEntry._id,
      });

      return { success: true, commission };
    } catch (error) {
      if (session && session.hasEnded === false) {
        await session.abortTransaction();
      }
      logger.error('Error adjusting commission', { error, commissionId, adjustment });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to adjust commission',
      };
    } finally {
      if (session && session.hasEnded === false) {
        await session.endSession();
      }
    }
  }

  /**
   * Update commission status
   * ERROR HANDLING FIX: Wrap in transaction to prevent race conditions during concurrent updates
   */
  async updateCommissionStatus(
    commissionId: string | Types.ObjectId,
    newStatus: ICommission['status'],
    changedBy: string | Types.ObjectId,
    changedByRole: 'system' | 'admin' | 'provider',
    reason?: string
  ): Promise<{ success: boolean; commission?: ICommission; error?: string }> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const commissionObjectId =
        typeof commissionId === 'string' ? new Types.ObjectId(commissionId) : commissionId;
      const changedByObjectId = typeof changedBy === 'string' ? new Types.ObjectId(changedBy) : changedBy;

      const commission = await Commission.findById(commissionObjectId).session(session);
      if (!commission) {
        await session.abortTransaction();
        return { success: false, error: 'Commission not found' };
      }

      const oldStatus = commission.status;
      await (commission as any).updateStatus(newStatus, changedByObjectId, changedByRole, reason);

      // Create status change history entry
      const CommissionHistory = mongoose.model('CommissionHistory');
      const historyEntry = new CommissionHistory({
        commissionId: commission._id,
        previousStatus: oldStatus,
        previousEarnings: commission.providerEarnings,
        newStatus: commission.status,
        newEarnings: commission.providerEarnings,
        adjustment: {
          type: 'correction',
          amount: 0,
          reason: reason || `Status changed from ${oldStatus} to ${newStatus}`,
        },
        adjustedBy: changedByObjectId,
        adjustedByRole: changedByRole,
        adjustedAt: new Date(),
      });
      await historyEntry.save({ session });

      await commission.save({ session });
      await session.commitTransaction();

      logger.info('Commission status updated', {
        commissionId: commission._id,
        oldStatus,
        newStatus,
        changedBy,
        historyId: historyEntry._id,
      });

      return { success: true, commission };
    } catch (error) {
      if (session && session.hasEnded === false) {
        await session.abortTransaction();
      }
      logger.error('Error updating commission status', { error, commissionId, newStatus });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update commission status',
      };
    } finally {
      if (session && session.hasEnded === false) {
        await session.endSession();
      }
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
