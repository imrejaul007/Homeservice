import Stripe from 'stripe';
import mongoose, { Types } from 'mongoose';
import Payout from '../models/payout.model';
import Settlement from '../models/settlement.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { creditWallet } from './wallet.service';
import { eventBus, EVENT_TYPES } from '../event-bus';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// ===================================
// TYPES & INTERFACES
// ===================================

export interface PayoutSchedule {
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly, 0 for bi-weekly
  dayOfMonth?: number; // 1-28 for monthly
  minPayoutAmount: number;
  maxPayoutAmount?: number;
}

export interface ProviderPayoutConfig {
  providerId: string;
  schedule: PayoutSchedule;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    iban?: string;
    swiftCode?: string;
    routingNumber?: string;
  };
  enabled: boolean;
}

export interface ProcessPayoutResult {
  success: boolean;
  payoutId?: string;
  stripePayoutId?: string;
  error?: string;
  errorCode?: string;
}

export interface EarningsBreakdown {
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  completedBookings: number;
  refundedAmount: number;
  chargebackAmount: number;
  commission: number;
  platformFee: number;
  otherDeductions: number;
  netPayable: number;
}

// Default payout configuration
const DEFAULT_PAYOUT_CONFIG: PayoutSchedule = {
  frequency: 'weekly',
  dayOfWeek: 5, // Friday
  minPayoutAmount: 100,
  maxPayoutAmount: 50000,
};

// ===================================
// PROVIDER PAYOUT CONFIG (In-memory for MVP)
// ===================================

const providerPayoutConfigs: Map<string, ProviderPayoutConfig> = new Map();

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Calculate earnings breakdown for a provider within a period
 */
export const calculateEarningsBreakdown = async (
  providerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<EarningsBreakdown> => {
  // Get completed bookings in the period
  const bookings = await Booking.find({
    providerId: new Types.ObjectId(providerId),
    status: 'completed',
    completedAt: { $gte: periodStart, $lte: periodEnd },
  });

  // Get refunds and chargebacks
  const refunds = await mongoose.model('Booking').find({
    providerId: new Types.ObjectId(providerId),
    'cancellationDetails.refundStatus': 'processed',
    'cancellationDetails.cancelledAt': { $gte: periodStart, $lte: periodEnd },
  });

  const totalGross = bookings.reduce((sum, b) => sum + b.pricing.totalAmount, 0);
  const totalRefunded = refunds.reduce((sum, r) => sum + (r.cancellationDetails?.refundAmount || 0), 0);

  // Calculate commission (15% of gross)
  const commissionRate = 0.15;
  const platformFeeRate = 0.02;

  const grossAmount = totalGross - totalRefunded;
  const commission = grossAmount * commissionRate;
  const platformFee = grossAmount * platformFeeRate;

  // Other deductions (placeholder for additional fees)
  const otherDeductions = 0;

  const netPayable = grossAmount - commission - platformFee - otherDeductions;

  return {
    periodStart,
    periodEnd,
    grossAmount,
    completedBookings: bookings.length,
    refundedAmount: totalRefunded,
    chargebackAmount: 0, // Placeholder
    commission,
    platformFee,
    otherDeductions,
    netPayable: Math.max(0, netPayable),
  };
};

/**
 * Get the next scheduled payout date based on frequency
 */
export const getNextScheduledDate = (
  frequency: 'weekly' | 'bi-weekly' | 'monthly',
  fromDate: Date = new Date()
): Date => {
  const date = new Date(fromDate);

  switch (frequency) {
    case 'weekly': {
      // Schedule for next Friday
      const dayOfWeek = date.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntilFriday);
      date.setHours(0, 0, 0, 0);
      break;
    }

    case 'bi-weekly': {
      // Schedule for next Friday, two weeks out
      const dayOfWeek = date.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntilFriday + 7);
      date.setHours(0, 0, 0, 0);
      break;
    }

    case 'monthly': {
      // Schedule for 1st of next month
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      break;
    }
  }

  return date;
};

/**
 * Get pending earnings for a provider
 */
export const getPendingEarnings = async (providerId: string): Promise<number> => {
  // Sum of all approved settlements not yet paid out
  const settlements = await Settlement.find({
    providerId: new Types.ObjectId(providerId),
    status: 'approved',
    payoutId: { $exists: false },
  });

  return settlements.reduce((sum, s) => sum + s.netAmount, 0);
};

/**
 * Get total paid out to a provider
 */
export const getTotalPaidOut = async (providerId: string): Promise<number> => {
  const result = await Payout.aggregate([
    {
      $match: {
        providerId: new Types.ObjectId(providerId),
        status: 'completed',
      },
    },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: '$amount' },
      },
    },
  ]);

  return result[0]?.totalPaid || 0;
};

// ===================================
// PAYOUT SCHEDULING
// ===================================

/**
 * Create scheduled payout for a provider
 */
export const schedulePayout = async (
  providerId: string,
  amount: number,
  settlementId?: string
): Promise<mongoose.Document> => {
  const config = providerPayoutConfigs.get(providerId) || {
    providerId,
    schedule: DEFAULT_PAYOUT_CONFIG,
    enabled: true,
  };

  const scheduledDate = getNextScheduledDate(config.schedule.frequency);

  const payout = new Payout({
    providerId: new Types.ObjectId(providerId),
    amount,
    currency: 'AED',
    status: 'scheduled',
    method: config.bankDetails ? 'bank_transfer' : 'wallet',
    bankDetails: config.bankDetails,
    scheduledDate,
    settlementId: settlementId ? new Types.ObjectId(settlementId) : undefined,
    earningsBreakdown: {
      grossAmount: amount, // Will be updated with actual breakdown
      commission: 0,
      platformFee: 0,
      deductions: 0,
      netAmount: amount,
    },
    maxRetries: 3,
    currentRetryCount: 0,
  });

  await payout.save();

  logger.info('Payout scheduled', {
    payoutId: payout._id,
    payoutNumber: payout.payoutNumber,
    providerId,
    amount,
    scheduledDate,
    action: 'PAYOUT_SCHEDULED',
  });

  return payout;
};

/**
 * Bulk schedule payouts for all eligible providers
 */
export const scheduleBulkPayouts = async (): Promise<{
  scheduled: number;
  skipped: number;
  totalAmount: number;
}> => {
  const now = new Date();
  const results = {
    scheduled: 0,
    skipped: 0,
    totalAmount: 0,
  };

  // Find all providers with pending settlements
  const settlements = await Settlement.find({
    status: 'approved',
    payoutId: { $exists: false },
  }).populate('providerId');

  // Group by provider
  const byProvider = new Map<string, { settlements: typeof settlements; total: number }>();

  for (const settlement of settlements) {
    const providerId = (settlement.providerId as any)._id.toString();
    if (!byProvider.has(providerId)) {
      byProvider.set(providerId, { settlements: [], total: 0 });
    }
    byProvider.get(providerId)!.settlements.push(settlement);
    byProvider.get(providerId)!.total += settlement.netAmount;
  }

  // Schedule payouts for each provider
  for (const [providerId, data] of byProvider) {
    const config = providerPayoutConfigs.get(providerId);

    // Skip if payouts disabled for this provider
    if (config && !config.enabled) {
      results.skipped++;
      continue;
    }

    // Check minimum payout amount
    const minAmount = config?.schedule.minPayoutAmount || DEFAULT_PAYOUT_CONFIG.minPayoutAmount;
    if (data.total < minAmount) {
      results.skipped++;
      continue;
    }

    try {
      const settlementIds = data.settlements.map(s => s._id.toString());
      await schedulePayout(providerId, data.total, settlementIds[0]);
      results.scheduled++;
      results.totalAmount += data.total;
    } catch (error: any) {
      logger.error('Failed to schedule payout', {
        providerId,
        error: error.message,
        action: 'PAYOUT_SCHEDULE_ERROR',
      });
      results.skipped++;
    }
  }

  return results;
};

// ===================================
// PAYOUT PROCESSING
// ===================================

/**
 * Process a single payout
 */
export const processPayout = async (payoutId: string): Promise<ProcessPayoutResult> => {
  const payout = await Payout.findById(payoutId);

  if (!payout) {
    return { success: false, error: 'Payout not found', errorCode: 'PAYOUT_NOT_FOUND' };
  }

  if (!['pending', 'scheduled', 'failed'].includes(payout.status)) {
    return {
      success: false,
      error: `Cannot process payout in status: ${payout.status}`,
      errorCode: 'INVALID_STATUS',
    };
  }

  try {
    await payout.markAsProcessing();

    if (payout.method === 'wallet') {
      // Credit to wallet directly
      const result = await creditWallet({
        userId: payout.providerId.toString(),
        type: 'credit',
        amount: payout.amount,
        description: `Payout #${payout.payoutNumber}`,
        reference: payoutId,
        referenceType: 'payout',
        metadata: {
          payoutNumber: payout.payoutNumber,
        },
      });

      if (result.success) {
        await payout.markAsCompleted(undefined);
        return { success: true, payoutId: payout._id.toString() };
      } else {
        throw new Error(result.error || 'Wallet credit failed');
      }
    } else {
      // Bank transfer via Stripe
      // Note: This would use Stripe Connect for actual bank transfers
      const stripePayout = await createStripePayout(payout);

      if (stripePayout) {
        await payout.markAsCompleted(stripePayout.id);
        return {
          success: true,
          payoutId: payout._id.toString(),
          stripePayoutId: stripePayout.id,
        };
      } else {
        throw new Error('Stripe payout creation failed');
      }
    }
  } catch (error: any) {
    logger.error('Failed to process payout', {
      payoutId,
      error: error.message,
      action: 'PAYOUT_PROCESSING_ERROR',
    });

    await payout.addFailure(error.message, 'PROCESSING_ERROR');

    return {
      success: false,
      payoutId,
      error: error.message,
      errorCode: 'PROCESSING_ERROR',
    };
  }
};

/**
 * Create a Stripe payout for bank transfer
 */
const createStripePayout = async (payout: any): Promise<Stripe.Payout | null> => {
  try {
    // In production, this would use Stripe Connect
    // For now, return a mock payout
    const payoutParams: Stripe.PayoutCreateParams = {
      amount: Math.round(payout.amount * 100), // Convert to cents
      currency: payout.currency.toLowerCase(),
      metadata: {
        payoutId: payout._id.toString(),
        payoutNumber: payout.payoutNumber,
        providerId: payout.providerId.toString(),
      },
      description: `NILIN Payout #${payout.payoutNumber}`,
    };

    const stripePayout = await stripe.payouts.create(payoutParams);

    logger.info('Stripe payout created', {
      payoutId: payout._id,
      stripePayoutId: stripePayout.id,
      amount: payout.amount,
      action: 'STRIPE_PAYOUT_CREATED',
    });

    return stripePayout;
  } catch (error: any) {
    logger.error('Failed to create Stripe payout', {
      payoutId: payout._id,
      error: error.message,
      action: 'STRIPE_PAYOUT_ERROR',
    });
    throw error;
  }
};

/**
 * Process due payouts (for scheduled job)
 */
export const processDuePayouts = async (batchSize: number = 100): Promise<{
  processed: number;
  failed: number;
  totalAmount: number;
}> => {
  const results = {
    processed: 0,
    failed: 0,
    totalAmount: 0,
  };

  const duePayouts = await Payout.findDuePayouts(batchSize);

  for (const payout of duePayouts) {
    const result = await processPayout(payout._id.toString());

    if (result.success) {
      results.processed++;
      results.totalAmount += payout.amount;

      // Publish event
      await eventBus.publish(EVENT_TYPES.PAYOUT_COMPLETED, {
        payoutId: result.payoutId,
        providerId: (payout as any).providerId._id.toString(),
        amount: payout.amount,
        stripePayoutId: result.stripePayoutId,
      });
    } else {
      results.failed++;
    }
  }

  return results;
};

// ===================================
// FAILED PAYOUT RECOVERY
// ===================================

/**
 * Retry failed payouts
 */
export const retryFailedPayouts = async (batchSize: number = 50): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
  totalAmount: number;
}> => {
  const results = {
    retried: 0,
    succeeded: 0,
    failed: 0,
    totalAmount: 0,
  };

  const failedPayouts = await Payout.findRetriablePayouts(batchSize);

  for (const payout of failedPayouts) {
    if (!payout.isRetryable) continue;

    results.retried++;

    const result = await processPayout(payout._id.toString());

    if (result.success) {
      results.succeeded++;
      results.totalAmount += payout.amount;
    } else {
      results.failed++;
    }
  }

  return results;
};

/**
 * Cancel a payout
 */
export const cancelPayout = async (
  payoutId: string,
  reason: string,
  cancelledBy?: string
): Promise<void> => {
  const payout = await Payout.findById(payoutId);

  if (!payout) {
    throw new ApiError(404, 'Payout not found');
  }

  if (!payout.canBeCancelled) {
    throw new ApiError(400, `Cannot cancel payout in status: ${payout.status}`);
  }

  await payout.cancel(reason, cancelledBy ? new Types.ObjectId(cancelledBy) : undefined);

  logger.info('Payout cancelled', {
    payoutId,
    reason,
    cancelledBy,
    action: 'PAYOUT_CANCELLED',
  });
};

// ===================================
// PAYOUT HISTORY & QUERIES
// ===================================

/**
 * Get payout history for a provider
 */
export const getPayoutHistory = async (
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
    query.createdAt = {};
    if (startDate) (query.createdAt as Record<string, Date>).$gte = startDate;
    if (endDate) (query.createdAt as Record<string, Date>).$lte = endDate;
  }

  const [payouts, total] = await Promise.all([
    Payout.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('settlementId'),
    Payout.countDocuments(query),
  ]);

  return {
    payouts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get upcoming payouts for a provider
 */
export const getUpcomingPayouts = async (providerId: string): Promise<any[]> => {
  return Payout.find({
    providerId: new Types.ObjectId(providerId),
    status: { $in: ['pending', 'scheduled'] },
    scheduledDate: { $gte: new Date() },
  })
    .sort({ scheduledDate: 1 })
    .limit(5);
};

/**
 * Get payout statistics for a provider
 */
export const getPayoutStats = async (
  providerId: string,
  period: 'week' | 'month' | 'year' = 'month'
): Promise<{
  totalPaid: number;
  pendingAmount: number;
  failedAmount: number;
  payoutCount: number;
  avgPayoutAmount: number;
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

  const stats = await Payout.aggregate([
    {
      $match: {
        providerId: new Types.ObjectId(providerId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    totalPaid: 0,
    pendingAmount: 0,
    failedAmount: 0,
    payoutCount: 0,
    avgPayoutAmount: 0,
  };

  for (const stat of stats) {
    switch (stat._id) {
      case 'completed':
        result.totalPaid = stat.totalAmount;
        result.payoutCount = stat.count;
        result.avgPayoutAmount = stat.count > 0 ? stat.totalAmount / stat.count : 0;
        break;
      case 'pending':
      case 'scheduled':
        result.pendingAmount += stat.totalAmount;
        break;
      case 'failed':
        result.failedAmount += stat.totalAmount;
        break;
    }
  }

  return result;
};

// ===================================
// PROVIDER PAYOUT CONFIGURATION
// ===================================

/**
 * Get payout configuration for a provider
 */
export const getProviderPayoutConfig = (providerId: string): ProviderPayoutConfig | null => {
  return providerPayoutConfigs.get(providerId) || null;
};

/**
 * Update payout configuration for a provider
 */
export const updateProviderPayoutConfig = (
  providerId: string,
  config: Partial<ProviderPayoutConfig>
): ProviderPayoutConfig => {
  const existing = providerPayoutConfigs.get(providerId) || {
    providerId,
    schedule: DEFAULT_PAYOUT_CONFIG,
    enabled: true,
  };

  const updated = {
    ...existing,
    ...config,
  };

  providerPayoutConfigs.set(providerId, updated);

  logger.info('Provider payout config updated', {
    providerId,
    config: updated,
    action: 'PAYOUT_CONFIG_UPDATED',
  });

  return updated;
};

// ===================================
// EXPORTS
// ===================================

export default {
  // Earnings calculation
  calculateEarningsBreakdown,
  getPendingEarnings,
  getTotalPaidOut,

  // Scheduling
  schedulePayout,
  scheduleBulkPayouts,
  getNextScheduledDate,

  // Processing
  processPayout,
  processDuePayouts,

  // Recovery
  retryFailedPayouts,
  cancelPayout,

  // Queries
  getPayoutHistory,
  getUpcomingPayouts,
  getPayoutStats,

  // Configuration
  getProviderPayoutConfig,
  updateProviderPayoutConfig,
};
