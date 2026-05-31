import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type TipType = 'cash' | 'card' | 'in_app';
export type TipStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type TipGoalStatus = 'active' | 'achieved' | 'expired';

export interface TipAmount {
  percentage: number;
  fixed: number;
  custom: number;
}

export interface TipGoal {
  goalId: string;
  targetAmount: number;
  currentAmount: number;
  startDate: Date;
  endDate: Date;
  status: TipGoalStatus;
  achievedAt?: Date;
}

export interface TipDistribution {
  providerShare: number;
  platformFee: number;
  processingFee: number;
}

export interface Tip {
  _id?: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  amount: number;
  type: TipType;
  status: TipStatus;
  percentage?: number;
  message?: string;
  distribution: TipDistribution;
  cashTip?: {
    collectedAt: Date;
    collectedBy: Types.ObjectId;
    verified: boolean;
  };
  goalProgress?: {
    goalId: string;
    amountContributed: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TipReport {
  providerId: string;
  startDate: Date;
  endDate: Date;
  totalTips: number;
  tipCount: number;
  averageTip: number;
  tipsByType: Record<TipType, { count: number; total: number }>;
  tipsByService: Record<string, { count: number; total: number }>;
  goalProgress: TipGoal[];
}

export interface CreateTipInput {
  bookingId: string;
  customerId: string;
  providerId: string;
  amount: number;
  type: TipType;
  percentage?: number;
  message?: string;
}

export interface CashTipInput {
  bookingId: string;
  amount: number;
  collectedBy: string;
  collectedAt: Date;
}

// ============================================
// Mongoose Interface
// ============================================

interface ITip extends Document, Omit<Tip, '_id'> {}

// ============================================
// Mongoose Schema
// ============================================

const CashTipSchema = new mongoose.Schema({
  collectedAt: { type: Date, required: true },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verified: { type: Boolean, default: false },
}, { _id: false });

const GoalProgressSchema = new mongoose.Schema({
  goalId: { type: String, required: true },
  amountContributed: { type: Number, default: 0 },
}, { _id: false });

const TipSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  type: { type: String, enum: ['cash', 'card', 'in_app'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  percentage: { type: Number, min: 0, max: 100 },
  message: { type: String, maxlength: 500 },
  distribution: {
    providerShare: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    processingFee: { type: Number, required: true },
  },
  cashTip: { type: CashTipSchema },
  goalProgress: { type: [GoalProgressSchema] },
}, {
  timestamps: true,
  collection: 'tips',
});

// Compound index for efficient queries
TipSchema.index({ providerId: 1, createdAt: -1 });
TipSchema.index({ customerId: 1, createdAt: -1 });
TipSchema.index({ bookingId: 1 }, { unique: true });

// ============================================
// Model Registration
// ============================================

export const TipModel = mongoose.models.Tip || mongoose.model<ITip>('Tip', TipSchema);

// ============================================
// Service Class
// ============================================

export class TippingService {

  // Default tip percentages and fees
  private readonly DEFAULT_TIP_PERCENTAGES = [10, 15, 20, 25];
  private readonly PLATFORM_FEE_PERCENT = 10; // 10% platform fee
  private readonly PROCESSING_FEE_PERCENT = 2.9; // Card processing fee

  // ========================================
  // Tip Calculation
  // ========================================

  /**
   * Calculate distribution of a tip amount
   */
  calculateDistribution(amount: number, type: TipType): TipDistribution {
    let processingFee = 0;

    // Card tips have processing fees
    if (type === 'card') {
      processingFee = amount * (this.PROCESSING_FEE_PERCENT / 100);
    }

    const afterProcessing = amount - processingFee;
    const platformFee = afterProcessing * (this.PLATFORM_FEE_PERCENT / 100);
    const providerShare = afterProcessing - platformFee;

    return {
      providerShare: Math.round(providerShare * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      processingFee: Math.round(processingFee * 100) / 100,
    };
  }

  /**
   * Calculate tip amounts based on booking price
   */
  calculateTipOptions(bookingPrice: number): { percentage: number; amount: number }[] {
    return this.DEFAULT_TIP_PERCENTAGES.map(percentage => ({
      percentage,
      amount: Math.round(bookingPrice * (percentage / 100) * 100) / 100,
    }));
  }

  /**
   * Calculate custom tip amount
   */
  calculateCustomTip(bookingPrice: number, customPercentage: number): number {
    if (customPercentage < 0) return 0;
    if (customPercentage > 100) customPercentage = 100;
    return Math.round(bookingPrice * (customPercentage / 100) * 100) / 100;
  }

  // ========================================
  // Tip Creation
  // ========================================

  /**
   * Create a tip for a booking
   */
  async createTip(input: CreateTipInput): Promise<ITip> {
    const { bookingId, customerId, providerId, amount, type, percentage, message } = input;

    // Validate IDs
    if (!Types.ObjectId.isValid(bookingId) || !Types.ObjectId.isValid(customerId) || !Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    if (amount <= 0) {
      throw ApiError.badRequest('Tip amount must be greater than 0');
    }

    // Check if tip already exists for this booking
    const existingTip = await TipModel.findOne({ bookingId: new Types.ObjectId(bookingId) });
    if (existingTip) {
      throw ApiError.conflict('Tip already exists for this booking');
    }

    const distribution = this.calculateDistribution(amount, type);

    const tip = new TipModel({
      bookingId: new Types.ObjectId(bookingId),
      customerId: new Types.ObjectId(customerId),
      providerId: new Types.ObjectId(providerId),
      amount,
      type,
      status: 'pending',
      percentage,
      message,
      distribution,
    });

    await tip.save();

    logger.info('Tip created', {
      context: 'TippingService',
      action: 'TIP_CREATED',
      tipId: tip._id.toString(),
      bookingId,
      amount,
      type,
    });

    eventBus.publish(EVENT_TYPES.TIP_CREATED, {
      tipId: tip._id,
      bookingId,
      providerId,
      amount,
    });

    return tip;
  }

  /**
   * Record a cash tip
   */
  async recordCashTip(input: CashTipInput): Promise<ITip> {
    const { bookingId, amount, collectedBy, collectedAt } = input;

    if (!Types.ObjectId.isValid(bookingId) || !Types.ObjectId.isValid(collectedBy)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    if (amount <= 0) {
      throw ApiError.badRequest('Cash tip amount must be greater than 0');
    }

    // Check if tip already exists
    let tip = await TipModel.findOne({ bookingId: new Types.ObjectId(bookingId) });

    if (tip) {
      // Update existing cash tip
      if (tip.type !== 'cash') {
        throw ApiError.badRequest('Booking already has a non-cash tip');
      }
      tip.amount = amount;
      tip.distribution = this.calculateDistribution(amount, 'cash');
      tip.cashTip = {
        collectedAt,
        collectedBy: new Types.ObjectId(collectedBy),
        verified: false,
      };
    } else {
      // Create new cash tip
      const distribution = this.calculateDistribution(amount, 'cash');
      tip = new TipModel({
        bookingId: new Types.ObjectId(bookingId),
        customerId: new Types.ObjectId(), // Will be populated from booking
        providerId: new Types.ObjectId(), // Will be populated from booking
        amount,
        type: 'cash',
        status: 'pending',
        distribution,
        cashTip: {
          collectedAt,
          collectedBy: new Types.ObjectId(collectedBy),
          verified: false,
        },
      });
    }

    await tip.save();

    logger.info('Cash tip recorded', {
      context: 'TippingService',
      action: 'CASH_TIP_RECORDED',
      tipId: tip._id.toString(),
      bookingId,
      amount,
    });

    return tip;
  }

  /**
   * Verify a cash tip
   */
  async verifyCashTip(tipId: string, verifiedBy: string): Promise<ITip> {
    if (!Types.ObjectId.isValid(tipId)) {
      throw ApiError.badRequest('Invalid tip ID');
    }

    const tip = await TipModel.findById(tipId);
    if (!tip) {
      throw ApiError.notFound('Tip not found');
    }

    if (tip.type !== 'cash') {
      throw ApiError.badRequest('Tip is not a cash tip');
    }

    if (!tip.cashTip) {
      throw ApiError.badRequest('Cash tip details not found');
    }

    tip.cashTip.verified = true;
    await tip.save();

    logger.info('Cash tip verified', {
      context: 'TippingService',
      action: 'CASH_TIP_VERIFIED',
      tipId,
      verifiedBy,
    });

    return tip;
  }

  // ========================================
  // Tip Distribution
  // ========================================

  /**
   * Complete a tip and distribute funds
   */
  async completeTip(tipId: string): Promise<ITip> {
    if (!Types.ObjectId.isValid(tipId)) {
      throw ApiError.badRequest('Invalid tip ID');
    }

    const tip = await TipModel.findById(tipId);
    if (!tip) {
      throw ApiError.notFound('Tip not found');
    }

    if (tip.status !== 'pending') {
      throw ApiError.badRequest('Tip is not in pending status');
    }

    tip.status = 'completed';
    await tip.save();

    // Emit event for fund distribution
    eventBus.publish(EVENT_TYPES.TIP_COMPLETED, {
      tipId: tip._id,
      providerId: tip.providerId,
      amount: tip.distribution.providerShare,
      bookingId: tip.bookingId,
    });

    logger.info('Tip completed', {
      context: 'TippingService',
      action: 'TIP_COMPLETED',
      tipId,
      providerShare: tip.distribution.providerShare,
    });

    return tip;
  }

  /**
   * Fail a tip (e.g., payment failed)
   */
  async failTip(tipId: string, reason?: string): Promise<ITip> {
    if (!Types.ObjectId.isValid(tipId)) {
      throw ApiError.badRequest('Invalid tip ID');
    }

    const tip = await TipModel.findById(tipId);
    if (!tip) {
      throw ApiError.notFound('Tip not found');
    }

    tip.status = 'failed';
    await tip.save();

    logger.warn('Tip failed', {
      context: 'TippingService',
      action: 'TIP_FAILED',
      tipId,
      reason,
    });

    return tip;
  }

  /**
   * Refund a tip
   */
  async refundTip(tipId: string, reason?: string): Promise<ITip> {
    if (!Types.ObjectId.isValid(tipId)) {
      throw ApiError.badRequest('Invalid tip ID');
    }

    const tip = await TipModel.findById(tipId);
    if (!tip) {
      throw ApiError.notFound('Tip not found');
    }

    if (tip.status !== 'completed') {
      throw ApiError.badRequest('Can only refund completed tips');
    }

    tip.status = 'refunded';
    await tip.save();

    logger.info('Tip refunded', {
      context: 'TippingService',
      action: 'TIP_REFUNDED',
      tipId,
      reason,
    });

    eventBus.publish(EVENT_TYPES.TIP_REFUNDED, {
      tipId: tip._id,
      providerId: tip.providerId,
      amount: tip.amount,
    });

    return tip;
  }

  // ========================================
  // Tip Queries
  // ========================================

  /**
   * Get tip by booking ID
   */
  async getTipByBooking(bookingId: string): Promise<ITip | null> {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('Invalid booking ID');
    }

    return TipModel.findOne({ bookingId: new Types.ObjectId(bookingId) })
      .populate('customerId', 'firstName lastName')
      .populate('providerId', 'firstName lastName');
  }

  /**
   * Get tips for a provider
   */
  async getProviderTips(
    providerId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      status?: TipStatus;
      type?: TipType;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ tips: ITip[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const { startDate, endDate, status, type, page = 1, limit = 20 } = options;

    const query: Record<string, unknown> = { providerId: new Types.ObjectId(providerId) };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) (query.createdAt as Record<string, Date>).$gte = startDate;
      if (endDate) (query.createdAt as Record<string, Date>).$lte = endDate;
    }

    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (page - 1) * limit;

    const [tips, total] = await Promise.all([
      TipModel.find(query)
        .populate('bookingId', 'service pricing scheduledAt')
        .populate('customerId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TipModel.countDocuments(query),
    ]);

    return {
      tips,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get tips for a customer
   */
  async getCustomerTips(
    customerId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ tips: ITip[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw ApiError.badRequest('Invalid customer ID');
    }

    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query = { customerId: new Types.ObjectId(customerId) };

    const [tips, total] = await Promise.all([
      TipModel.find(query)
        .populate('bookingId', 'service pricing scheduledAt')
        .populate('providerId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TipModel.countDocuments(query),
    ]);

    return {
      tips,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ========================================
  // Tip Reporting
  // ========================================

  /**
   * Generate tip report for a provider
   */
  async generateProviderTipReport(
    providerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TipReport> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const query = {
      providerId: new Types.ObjectId(providerId),
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const tips = await TipModel.find(query)
      .populate('bookingId', 'service')
      .lean();

    const totalTips = tips.reduce((sum, tip) => sum + tip.amount, 0);
    const tipCount = tips.length;
    const averageTip = tipCount > 0 ? Math.round((totalTips / tipCount) * 100) / 100 : 0;

    const tipsByType: Record<TipType, { count: number; total: number }> = {
      cash: { count: 0, total: 0 },
      card: { count: 0, total: 0 },
      in_app: { count: 0, total: 0 },
    };

    const tipsByService: Record<string, { count: number; total: number }> = {};

    for (const tip of tips) {
      tipsByType[tip.type as TipType].count++;
      tipsByType[tip.type as TipType].total += tip.amount;

      const serviceId = (tip.bookingId as unknown as { service?: { _id?: string } })?.service?._id?.toString() || 'unknown';
      if (!tipsByService[serviceId]) {
        tipsByService[serviceId] = { count: 0, total: 0 };
      }
      tipsByService[serviceId].count++;
      tipsByService[serviceId].total += tip.amount;
    }

    return {
      providerId,
      startDate,
      endDate,
      totalTips,
      tipCount,
      averageTip,
      tipsByType,
      tipsByService,
      goalProgress: [], // Would be populated from goal service
    };
  }

  /**
   * Get total tips earned by provider (all time or by period)
   */
  async getProviderTipSummary(
    providerId: string,
    period?: { start: Date; end: Date }
  ): Promise<{
    totalEarned: number;
    tipsReceived: number;
    averageTip: number;
    thisMonth: number;
    lastMonth: number;
  }> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    const providerObjectId = new Types.ObjectId(providerId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const baseQuery = { providerId: providerObjectId, status: 'completed' };

    const [allTime, thisMonth, lastMonth] = await Promise.all([
      TipModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      TipModel.aggregate([
        { $match: { ...baseQuery, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      TipModel.aggregate([
        { $match: { ...baseQuery, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const totalEarned = allTime[0]?.total || 0;
    const tipsReceived = allTime[0]?.count || 0;

    return {
      totalEarned,
      tipsReceived,
      averageTip: tipsReceived > 0 ? Math.round((totalEarned / tipsReceived) * 100) / 100 : 0,
      thisMonth: thisMonth[0]?.total || 0,
      lastMonth: lastMonth[0]?.total || 0,
    };
  }

  // ========================================
  // Cash Tips Tracking
  // ========================================

  /**
   * Get unverified cash tips for a provider
   */
  async getUnverifiedCashTips(providerId: string): Promise<ITip[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    return TipModel.find({
      providerId: new Types.ObjectId(providerId),
      type: 'cash',
      'cashTip.verified': false,
      status: { $in: ['pending', 'completed'] },
    })
      .populate('bookingId', 'service scheduledAt')
      .populate('customerId', 'firstName lastName')
      .sort({ createdAt: -1 });
  }

  /**
   * Get cash tips summary for reconciliation
   */
  async getCashTipsSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    verified: number;
    unverified: number;
    tips: ITip[];
  }> {
    const tips = await TipModel.find({
      type: 'cash',
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .populate('providerId', 'firstName lastName')
      .populate('cashTip.collectedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    const verified = tips.filter(t => t.cashTip?.verified);
    const unverified = tips.filter(t => !t.cashTip?.verified);

    return {
      total: tips.reduce((sum, t) => sum + t.amount, 0),
      verified: verified.reduce((sum, t) => sum + t.amount, 0),
      unverified: unverified.reduce((sum, t) => sum + t.amount, 0),
      tips,
    };
  }

  // ========================================
  // Tip Goals
  // ========================================

  /**
   * Update tip goal progress after a tip
   */
  async updateTipGoalProgress(
    providerId: string,
    tipAmount: number
  ): Promise<TipGoal[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw ApiError.badRequest('Invalid provider ID');
    }

    // This would integrate with a goal service
    // For now, return empty array as placeholder
    logger.info('Tip goal progress updated', {
      context: 'TippingService',
      action: 'TIP_GOAL_UPDATED',
      providerId,
      tipAmount,
    });

    return [];
  }

  /**
   * Check if provider has achieved any goals
   */
  async checkGoalAchievements(providerId: string): Promise<string[]> {
    // Placeholder for goal achievement logic
    return [];
  }
}

// ============================================
// Export Singleton
// ============================================

export const tippingService = new TippingService();
export default tippingService;
