import mongoose, { Types, Schema } from 'mongoose';
import Settlement from '../models/settlement.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { schedulePayout } from './payoutEngine.service';

// ===================================
// TYPES & INTERFACES
// ===================================

export interface CommissionConfig {
  defaultRate: number;
  tieredRates?: {
    minAmount: number;
    maxAmount?: number;
    rate: number;
  }[];
  categoryOverrides?: Record<string, number>;
}

export interface PlatformFeeConfig {
  type: 'fixed' | 'percentage';
  value: number;
  minFee?: number;
  maxFee?: number;
}

export interface SettlementPeriod {
  start: Date;
  end: Date;
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
}

export interface SettlementResult {
  settlementId: string;
  settlementNumber: string;
  grossAmount: number;
  commission: number;
  platformFee: number;
  netAmount: number;
  lineItems: number;
}

// Default commission configuration
const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  defaultRate: 0.15, // 15%
  tieredRates: [
    { minAmount: 0, maxAmount: 10000, rate: 0.15 },
    { minAmount: 10000, maxAmount: 50000, rate: 0.12 },
    { minAmount: 50000, rate: 0.10 },
  ],
};

// Default platform fee configuration
const DEFAULT_PLATFORM_FEE_CONFIG: PlatformFeeConfig = {
  type: 'percentage',
  value: 0.02, // 2%
};

// Commission configurations by category
const CATEGORY_COMMISSION_OVERRIDES: Record<string, number> = {
  // Premium categories may have different rates
  // Add category-specific overrides here
};

// ===================================
// COMMISSION CALCULATION
// ===================================

/**
 * Get commission rate for a booking based on amount
 */
export const getCommissionRate = (
  amount: number,
  config: CommissionConfig = DEFAULT_COMMISSION_CONFIG
): number => {
  // Check for tiered rates
  if (config.tieredRates) {
    for (const tier of config.tieredRates) {
      if (amount >= tier.minAmount && (tier.maxAmount === undefined || amount < tier.maxAmount)) {
        return tier.rate;
      }
    }
  }

  return config.defaultRate;
};

/**
 * Get commission rate for a booking based on category
 */
export const getCategoryCommissionRate = (categoryId: string): number => {
  return CATEGORY_COMMISSION_OVERRIDES[categoryId] || DEFAULT_COMMISSION_CONFIG.defaultRate;
};

/**
 * Calculate commission for a booking
 */
export const calculateCommission = async (
  bookingId: string | Types.ObjectId,
  customRate?: number
): Promise<{
  commission: number;
  platformFee: number;
  netAmount: number;
  rate: number;
}> => {
  const booking = await Booking.findById(bookingId).populate('serviceId');

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  const grossAmount = booking.pricing.totalAmount;

  // Determine commission rate
  let rate = customRate || DEFAULT_COMMISSION_CONFIG.defaultRate;

  // Check for category-specific override
  const service = booking.serviceId as any;
  if (service?.categoryId) {
    const categoryRate = getCategoryCommissionRate(service.categoryId.toString());
    if (categoryRate !== DEFAULT_COMMISSION_CONFIG.defaultRate) {
      rate = categoryRate;
    }
  }

  // Calculate commission
  const commission = grossAmount * rate;

  // Calculate platform fee (percentage of gross)
  const platformFeeConfig = DEFAULT_PLATFORM_FEE_CONFIG;
  let platformFee = 0;

  if (platformFeeConfig.type === 'percentage') {
    platformFee = grossAmount * platformFeeConfig.value;
  }

  // Calculate net amount
  const netAmount = grossAmount - commission - platformFee;

  return {
    commission: Math.round(commission * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    rate,
  };
};

// ===================================
// PLATFORM FEE DEDUCTION
// ===================================

/**
 * Calculate platform fee
 */
export const calculatePlatformFee = (
  grossAmount: number,
  config: PlatformFeeConfig = DEFAULT_PLATFORM_FEE_CONFIG
): number => {
  let fee = 0;

  if (config.type === 'fixed') {
    fee = config.value;
  } else {
    fee = grossAmount * config.value;
  }

  // Apply min/max constraints
  if (config.minFee !== undefined) {
    fee = Math.max(fee, config.minFee);
  }
  if (config.maxFee !== undefined) {
    fee = Math.min(fee, config.maxFee);
  }

  return Math.round(fee * 100) / 100;
};

// ===================================
// NET PAYABLE CALCULATION
// ===================================

/**
 * Calculate net payable amount
 */
export const calculateNetPayable = (
  grossAmount: number,
  commission: number,
  platformFee: number,
  deductions: Array<{ amount: number }>
): number => {
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  return Math.max(0, grossAmount - commission - platformFee - totalDeductions);
};

// ===================================
// SETTLEMENT GENERATION
// ===================================

/**
 * Generate a settlement for a provider
 * FIX: Use atomic findOneAndUpdate with upsert to prevent race condition
 * The $setOnInsert operator ensures we only create if the document doesn't exist
 */
export const generateSettlement = async (
  providerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<SettlementResult> => {
  const providerObjectId = new Types.ObjectId(providerId);

  // Get all completed bookings in the period
  const bookings = await Booking.find({
    providerId: providerObjectId,
    status: 'completed',
    completedAt: { $gte: periodStart, $lte: periodEnd },
    'payment.status': 'completed',
  });

  if (bookings.length === 0) {
    throw new ApiError(400, 'No completed bookings found for this period');
  }

  // Calculate totals
  let grossAmount = 0;
  let totalCommission = 0;
  let totalPlatformFee = 0;

  const lineItems = [];

  for (const booking of bookings) {
    const { commission, platformFee, netAmount } = await calculateCommission(booking._id);

    grossAmount += booking.pricing.totalAmount;
    totalCommission += commission;
    totalPlatformFee += platformFee;

    lineItems.push({
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      date: booking.completedAt || booking.scheduledDate,
      grossAmount: booking.pricing.totalAmount,
      commissionAmount: commission,
      platformFeeAmount: platformFee,
      netAmount,
      status: 'included' as const,
    });
  }

  const netAmount = grossAmount - totalCommission - totalPlatformFee;

  // FIX: Generate settlement number first (atomic counter)
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const counterKey = `settlement-${year}${month}`;

  // Get atomic sequence number
  const sequenceResult = await mongoose.model('Counter').findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, returnDocument: 'after' }
  );
  const sequenceNumber = sequenceResult?.seq || 1;
  const settlementNumber = `STL-${year}${month}-${String(sequenceNumber).padStart(4, '0')}`;

  // FIX: Use atomic findOneAndUpdate with upsert to prevent race condition
  // $setOnInsert only applies when creating a new document
  // This combines the check and create into a single atomic operation
  const settlementData = {
    providerId: providerObjectId,
    periodStart,
    periodEnd,
    grossAmount: Math.round(grossAmount * 100) / 100,
    commission: Math.round(totalCommission * 100) / 100,
    platformFee: Math.round(totalPlatformFee * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    lineItems,
    deductions: [],
    status: 'pending',
    currency: 'AED',
    settlementNumber, // Pre-generate to avoid pre-save hook race condition
  };

  // Use findOneAndUpdate with upsert to atomically prevent duplicate settlements
  // Returns the document (existing or newly created)
  const settlementDoc = await Settlement.findOneAndUpdate(
    {
      providerId: providerObjectId,
      periodStart,
      periodEnd,
    },
    {
      $setOnInsert: settlementData
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  // If the returned document has a settlementNumber, check if it was pre-existing
  // by comparing with the one we just generated
  // Note: $setOnInsert only sets fields on insert, so existing docs won't have our settlementNumber
  if (settlementDoc.settlementNumber !== settlementNumber) {
    // Document already existed with a different settlementNumber
    // Another process created it first - race condition prevented!
    logger.info('Settlement already exists for this period (atomic upsert prevented duplicate)', {
      providerId,
      periodStart,
      periodEnd,
      action: 'SETTLEMENT_DUPLICATE_PREVENTED',
    });
    throw new ApiError(409, 'Settlement already exists for this period');
  }

  // New settlement created
  const settlementId = settlementDoc._id.toString();

  logger.info('Settlement generated', {
    settlementId,
    settlementNumber,
    providerId,
    periodStart,
    periodEnd,
    grossAmount,
    netAmount,
    lineItems: bookings.length,
    action: 'SETTLEMENT_GENERATED',
  });

  return {
    settlementId,
    settlementNumber,
    grossAmount: Math.round(grossAmount * 100) / 100,
    commission: Math.round(totalCommission * 100) / 100,
    platformFee: Math.round(totalPlatformFee * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    lineItems: bookings.length,
  };
};

/**
 * Generate settlements for all providers (batch operation)
 */
export const generateBulkSettlements = async (
  periodStart: Date,
  periodEnd: Date
): Promise<{
  generated: number;
  skipped: number;
  totalNetAmount: number;
  errors: Array<{ providerId: string; error: string }>;
}> => {
  const results = {
    generated: 0,
    skipped: 0,
    totalNetAmount: 0,
    errors: [] as Array<{ providerId: string; error: string }>,
  };

  // Get all providers with completed bookings in the period
  const providersWithBookings = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        completedAt: { $gte: periodStart, $lte: periodEnd },
        'payment.status': 'completed',
      },
    },
    {
      $group: {
        _id: '$providerId',
        bookingCount: { $sum: 1 },
      },
    },
    {
      $match: {
        bookingCount: { $gt: 0 },
      },
    },
  ]);

  for (const providerData of providersWithBookings) {
    try {
      const result = await generateSettlement(
        providerData._id.toString(),
        periodStart,
        periodEnd
      );

      results.generated++;
      results.totalNetAmount += result.netAmount;
    } catch (error: any) {
      // Skip if settlement already exists
      if (error.statusCode === 409) {
        results.skipped++;
      } else {
        results.errors.push({
          providerId: providerData._id.toString(),
          error: error.message,
        });
      }
    }
  }

  return results;
};

// ===================================
// SETTLEMENT APPROVAL & PAYMENT
// ===================================

/**
 * Approve a settlement
 */
export const approveSettlement = async (
  settlementId: string,
  approvedBy?: string
): Promise<void> => {
  const settlement = await Settlement.findById(settlementId);

  if (!settlement) {
    throw new ApiError(404, 'Settlement not found');
  }

  if (settlement.status !== 'pending') {
    throw new ApiError(400, `Cannot approve settlement in status: ${settlement.status}`);
  }

  await (settlement as any).approve(approvedBy ? new Types.ObjectId(approvedBy) : undefined);

  logger.info('Settlement approved', {
    settlementId,
    settlementNumber: settlement.settlementNumber,
    approvedBy,
    action: 'SETTLEMENT_APPROVED',
  });
};

/**
 * Mark settlement as paid and create payout
 */
export const paySettlement = async (
  settlementId: string,
  payoutId?: string
): Promise<void> => {
  const settlement = await Settlement.findById(settlementId);

  if (!settlement) {
    throw new ApiError(404, 'Settlement not found');
  }

  if (settlement.status !== 'approved') {
    throw new ApiError(400, `Cannot pay settlement in status: ${settlement.status}`);
  }

  // Create payout if not provided
  let actualPayoutId = payoutId;
  if (!actualPayoutId) {
    const payout = await schedulePayout(
      settlement.providerId.toString(),
      settlement.netAmount,
      settlementId
    );
    actualPayoutId = payout._id.toString();
  }

  await (settlement as any).markAsPaid(new Types.ObjectId(actualPayoutId));

  logger.info('Settlement paid', {
    settlementId,
    settlementNumber: settlement.settlementNumber,
    payoutId: actualPayoutId,
    netAmount: settlement.netAmount,
    action: 'SETTLEMENT_PAID',
  });
};

// ===================================
// SETTLEMENT RECONCILIATION
// ===================================

/**
 * Reconcile a settlement
 */
export const reconcileSettlement = async (
  settlementId: string,
  reconciledBy: string
): Promise<{
  isReconciled: boolean;
  discrepancies: Array<{
    field: string;
    expected: number;
    actual: number;
  }>;
}> => {
  const settlement = await Settlement.findById(settlementId);

  if (!settlement) {
    throw new ApiError(404, 'Settlement not found');
  }

  // Recalculate totals from line items
  const recalculated = {
    grossAmount: settlement.lineItems.reduce((sum, item) => sum + item.grossAmount, 0),
    commission: settlement.lineItems.reduce((sum, item) => sum + item.commissionAmount, 0),
    platformFee: settlement.lineItems.reduce((sum, item) => sum + item.platformFeeAmount, 0),
    netAmount: settlement.lineItems.reduce((sum, item) => sum + item.netAmount, 0),
  };

  // Check for discrepancies
  const discrepancies: Array<{ field: string; expected: number; actual: number }> = [];

  if (Math.abs(recalculated.grossAmount - settlement.grossAmount) > 0.01) {
    discrepancies.push({
      field: 'grossAmount',
      expected: settlement.grossAmount,
      actual: recalculated.grossAmount,
    });
  }

  if (Math.abs(recalculated.commission - settlement.commission) > 0.01) {
    discrepancies.push({
      field: 'commission',
      expected: settlement.commission,
      actual: recalculated.commission,
    });
  }

  if (Math.abs(recalculated.netAmount - settlement.netAmount) > 0.01) {
    discrepancies.push({
      field: 'netAmount',
      expected: settlement.netAmount,
      actual: recalculated.netAmount,
    });
  }

  // Update settlement with discrepancies if found
  if (discrepancies.length > 0) {
    // Recalculate from line items
    settlement.grossAmount = recalculated.grossAmount;
    settlement.commission = recalculated.commission;
    settlement.platformFee = recalculated.platformFee;
    settlement.netAmount = recalculated.netAmount;
  }

  await (settlement as any).reconcile(
    new Types.ObjectId(reconciledBy),
    discrepancies.length > 0 ? discrepancies : undefined
  );

  logger.info('Settlement reconciled', {
    settlementId,
    discrepanciesFound: discrepancies.length,
    action: 'SETTLEMENT_RECONCILED',
  });

  return {
    isReconciled: discrepancies.length === 0,
    discrepancies,
  };
};

/**
 * Auto-reconcile all settlements
 */
export const autoReconcileSettlements = async (
  limit: number = 100
): Promise<{
  reconciled: number;
  discrepancies: number;
}> => {
  const results = {
    reconciled: 0,
    discrepancies: 0,
  };

  // Find pending settlements
  const settlements = await Settlement.find({
    status: 'pending',
    'reconciliation.isReconciled': false,
  })
    .limit(limit)
    .populate('providerId', '_id');

  for (const settlement of settlements) {
    const providerId = (settlement.providerId as any)._id.toString();

    try {
      const result = await reconcileSettlement(settlement._id.toString(), providerId);

      if (result.isReconciled) {
        results.reconciled++;
      } else {
        results.discrepancies++;
      }
    } catch (error: any) {
      logger.error('Failed to reconcile settlement', {
        settlementId: settlement._id,
        error: error.message,
        action: 'RECONCILIATION_ERROR',
      });
    }
  }

  return results;
};

// ===================================
// DEDUCTIONS MANAGEMENT
// ===================================

/**
 * Add deduction to a settlement
 */
export const addSettlementDeduction = async (
  settlementId: string,
  type: string,
  amount: number,
  description: string,
  reference?: string
): Promise<void> => {
  const settlement = await Settlement.findById(settlementId);

  if (!settlement) {
    throw new ApiError(404, 'Settlement not found');
  }

  if (settlement.status === 'paid') {
    throw new ApiError(400, 'Cannot modify paid settlement');
  }

  (settlement as any).addDeduction(type, amount, description, reference);
  await settlement.save();

  logger.info('Settlement deduction added', {
    settlementId,
    type,
    amount,
    description,
    action: 'SETTLEMENT_DEDUCTION_ADDED',
  });
};

/**
 * Remove deduction from a settlement
 */
export const removeSettlementDeduction = async (
  settlementId: string,
  deductionIndex: number
): Promise<void> => {
  const settlement = await Settlement.findById(settlementId);

  if (!settlement) {
    throw new ApiError(404, 'Settlement not found');
  }

  if (settlement.status === 'paid') {
    throw new ApiError(400, 'Cannot modify paid settlement');
  }

  (settlement as any).removeDeduction(deductionIndex);
  await settlement.save();

  logger.info('Settlement deduction removed', {
    settlementId,
    deductionIndex,
    action: 'SETTLEMENT_DEDUCTION_REMOVED',
  });
};

// ===================================
// DISPUTE MANAGEMENT
// ===================================

/**
 * Dispute a settlement
 */
export const disputeSettlement = async (
  settlementId: string,
  reason: string
): Promise<void> => {
  const settlement = await Settlement.findById(settlementId);

  if (!settlement) {
    throw new ApiError(404, 'Settlement not found');
  }

  if (!['pending', 'approved'].includes(settlement.status)) {
    throw new ApiError(400, `Cannot dispute settlement in status: ${settlement.status}`);
  }

  await (settlement as any).dispute(reason);

  logger.info('Settlement disputed', {
    settlementId,
    reason,
    action: 'SETTLEMENT_DISPUTED',
  });
};

// ===================================
// SETTLEMENT QUERIES
// ===================================

/**
 * Get settlement by ID
 */
export const getSettlement = async (settlementId: string): Promise<any> => {
  const settlement = await Settlement.findById(settlementId)
    .populate('providerId', 'firstName lastName email')
    .populate('lineItems.bookingId');

  if (!settlement) {
    throw new ApiError(404, 'Settlement not found');
  }

  return settlement;
};

/**
 * Get settlements for a provider
 */
export const getProviderSettlements = async (
  providerId: string,
  options: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
) => {
  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate,
  } = options;

  const query: Record<string, unknown> = { providerId: new Types.ObjectId(providerId) };

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.periodStart = {};
    if (startDate) (query.periodStart as Record<string, Date>).$gte = startDate;
    if (endDate) (query.periodStart as Record<string, Date>).$lte = endDate;
  }

  const [settlements, total] = await Promise.all([
    Settlement.find(query)
      .sort({ periodStart: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('payoutId'),
    Settlement.countDocuments(query),
  ]);

  return {
    settlements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get settlement summary for a provider
 */
export const getSettlementSummary = async (
  providerId: string,
  period: 'week' | 'month' | 'year' = 'month'
): Promise<{
  totalGross: number;
  totalCommission: number;
  totalPlatformFee: number;
  totalNet: number;
  settlementCount: number;
  pendingCount: number;
  paidCount: number;
}> => {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
  }

  const summary = await Settlement.aggregate([
    {
      $match: {
        providerId: new Types.ObjectId(providerId),
        periodStart: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$status',
        totalGross: { $sum: '$grossAmount' },
        totalCommission: { $sum: '$commission' },
        totalPlatformFee: { $sum: '$platformFee' },
        totalNet: { $sum: '$netAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    totalGross: 0,
    totalCommission: 0,
    totalPlatformFee: 0,
    totalNet: 0,
    settlementCount: 0,
    pendingCount: 0,
    paidCount: 0,
  };

  for (const item of summary) {
    result.totalGross += item.totalGross;
    result.totalCommission += item.totalCommission;
    result.totalPlatformFee += item.totalPlatformFee;
    result.totalNet += item.totalNet;
    result.settlementCount += item.count;

    if (item._id === 'pending' || item._id === 'approved') {
      result.pendingCount += item.count;
    } else if (item._id === 'paid') {
      result.paidCount += item.count;
    }
  }

  return result;
};

// ===================================
// BOOKING COMPLETION PROCESSING
// ===================================

/**
 * Process booking completion - add provider earnings to pending balance
 * This is the critical money flow function that ensures providers receive their money
 */
export const processBookingCompletion = async (bookingId: string): Promise<{
  success: boolean;
  providerEarnings: number;
  commission: number;
  platformFee: number;
  settlementId?: string;
}> => {
  try {
    // 1. Fetch booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Only process completed bookings
    if (booking.status !== 'completed') {
      logger.warn('Attempted to process non-completed booking', {
        bookingId,
        status: booking.status,
        action: 'SETTLEMENT_SKIP_NON_COMPLETED',
      });
      return {
        success: false,
        providerEarnings: 0,
        commission: 0,
        platformFee: 0,
      };
    }

    // 2. Calculate commission
    const { commission, platformFee, netAmount: providerEarnings } = await calculateCommission(bookingId);

    // 3. Get or create provider wallet and update pending balance
    const Wallet = mongoose.model('Wallet');
    const providerWallet = await Wallet.findOne({ userId: booking.providerId });

    if (!providerWallet) {
      // Create wallet if it doesn't exist
      const newWallet = new Wallet({
        userId: booking.providerId,
        balance: 0,
        pendingBalance: providerEarnings,
        currency: 'AED',
        transactions: [{
          id: new mongoose.Types.ObjectId().toString(),
          type: 'credit',
          amount: providerEarnings,
          description: `Earnings from booking ${booking.bookingNumber}`,
          reference: bookingId,
          referenceType: 'commission',
          status: 'completed',
          balanceAfter: providerEarnings,
          createdAt: new Date(),
        }],
        totalEarned: providerEarnings,
      });
      await newWallet.save();

      logger.info('Created new wallet for provider', {
        providerId: booking.providerId.toString(),
        amount: providerEarnings,
        bookingId,
        action: 'WALLET_CREATED',
      });
    } else {
      // Update existing wallet atomically
      await Wallet.findOneAndUpdate(
        { userId: booking.providerId },
        {
          $inc: {
            pendingBalance: providerEarnings,
            totalEarned: providerEarnings,
          },
          $push: {
            transactions: {
              $each: [{
                id: new mongoose.Types.ObjectId().toString(),
                type: 'credit',
                amount: providerEarnings,
                description: `Earnings from booking ${booking.bookingNumber}`,
                reference: bookingId,
                referenceType: 'commission',
                status: 'completed',
                balanceAfter: (providerWallet.pendingBalance || 0) + providerEarnings,
                createdAt: new Date(),
              }],
              $position: 0, // Add to beginning of array
            },
          },
        }
      );

      logger.info('Updated provider pending balance', {
        providerId: booking.providerId.toString(),
        amount: providerEarnings,
        newPendingBalance: (providerWallet.pendingBalance || 0) + providerEarnings,
        bookingId,
        action: 'PENDING_BALANCE_UPDATED',
      });
    }

    // 4. Create individual booking settlement record
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const counterKey = `booking-settlement-${year}${month}`;

    // Get atomic sequence number
    const sequenceResult = await mongoose.model('Counter').findOneAndUpdate(
      { _id: counterKey },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, returnDocument: 'after' }
    );
    const sequenceNumber = sequenceResult?.seq || 1;
    const settlementNumber = `BS-${year}${month}-${String(sequenceNumber).padStart(6, '0')}`;

    const settlement = await Settlement.create({
      providerId: booking.providerId,
      periodStart: now,
      periodEnd: now,
      grossAmount: booking.pricing.totalAmount,
      commission,
      platformFee,
      netAmount: providerEarnings,
      lineItems: [{
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        date: now,
        grossAmount: booking.pricing.totalAmount,
        commissionAmount: commission,
        platformFeeAmount: platformFee,
        netAmount: providerEarnings,
        status: 'included',
      }],
      deductions: [],
      status: 'pending',
      currency: 'AED',
      settlementNumber,
    });

    logger.info('Booking settlement created', {
      settlementId: settlement._id.toString(),
      settlementNumber,
      providerId: booking.providerId.toString(),
      bookingId,
      grossAmount: booking.pricing.totalAmount,
      commission,
      platformFee,
      netAmount: providerEarnings,
      action: 'BOOKING_SETTLEMENT_CREATED',
    });

    return {
      success: true,
      providerEarnings,
      commission,
      platformFee,
      settlementId: settlement._id.toString(),
    };
  } catch (error) {
    logger.error('Failed to process booking completion', {
      bookingId,
      error: error instanceof Error ? error.message : String(error),
      action: 'SETTLEMENT_PROCESS_ERROR',
    });
    throw error;
  }
};

/**
 * Get provider's pending balance and recent settlements
 */
export const getProviderWalletSummary = async (providerId: string): Promise<{
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  totalSpent: number;
  recentSettlements: Array<{
    settlementId: string;
    settlementNumber: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;
}> => {
  const Wallet = mongoose.model('Wallet');
  const wallet = await Wallet.findOne({ userId: new mongoose.Types.ObjectId(providerId) });

  if (!wallet) {
    return {
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
      recentSettlements: [],
    };
  }

  // Get recent settlements for this provider
  const recentSettlements = await Settlement.find({
    providerId: new mongoose.Types.ObjectId(providerId),
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('_id settlementNumber netAmount status createdAt')
    .lean();

  return {
    balance: wallet.balance,
    pendingBalance: wallet.pendingBalance,
    totalEarned: wallet.totalEarned,
    totalSpent: wallet.totalSpent,
    recentSettlements: recentSettlements.map(s => ({
      settlementId: s._id.toString(),
      settlementNumber: s.settlementNumber,
      amount: s.netAmount,
      status: s.status,
      createdAt: s.createdAt,
    })),
  };
};

// ===================================
// EXPORTS
// ===================================

export default {
  // Commission
  getCommissionRate,
  getCategoryCommissionRate,
  calculateCommission,

  // Platform fee
  calculatePlatformFee,

  // Net payable
  calculateNetPayable,

  // Booking completion processing
  processBookingCompletion,
  getProviderWalletSummary,

  // Generation
  generateSettlement,
  generateBulkSettlements,

  // Approval & Payment
  approveSettlement,
  paySettlement,

  // Reconciliation
  reconcileSettlement,
  autoReconcileSettlements,

  // Deductions
  addSettlementDeduction,
  removeSettlementDeduction,

  // Disputes
  disputeSettlement,

  // Queries
  getSettlement,
  getProviderSettlements,
  getSettlementSummary,

  // Configuration
  DEFAULT_COMMISSION_CONFIG,
  DEFAULT_PLATFORM_FEE_CONFIG,
};
