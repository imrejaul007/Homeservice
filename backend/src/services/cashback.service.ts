import Cashback from '../models/cashback.model';
import Wallet from '../models/wallet.model';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { getTenantId, getTenantIdOptional, isAdminOrSystem } from '../utils/tenantFilter';
import { creditWallet } from './wallet.service';

// Default cashback percentages by source
const DEFAULT_CASHBACK_PERCENTAGES: Record<string, number> = {
  booking: 5, // 5% cashback on bookings
  referral: 10, // 10% cashback on referral bookings
  promotion: 100, // Promotion-based (percentage stored in metadata)
  refund: 100, // Full refund returns cashback
  loyalty: 50, // 50% of loyalty points as cashback
};

// Cashback expiration in days
const CASHBACK_EXPIRATION_DAYS = 90;

export interface CashbackCalculationResult {
  cashbackAmount: number;
  percentage: number;
  source: string;
  expiresAt: Date;
}

export interface CashbackEntry {
  id: string;
  amount: number;
  currency: string;
  source: string;
  status: string;
  sourceDescription: string;
  percentage: number;
  earnedAt: Date;
  expiresAt: Date;
  isExpiringSoon: boolean;
}

/**
 * Calculate cashback amount for a transaction
 */
export const calculateCashback = async (
  originalAmount: number,
  source: string,
  metadata?: Record<string, unknown>
): Promise<CashbackCalculationResult> => {
  // Get the percentage for this source
  let percentage = DEFAULT_CASHBACK_PERCENTAGES[source] || 5;

  // Override percentage from metadata if provided
  if (metadata?.cashbackPercentage) {
    percentage = metadata.cashbackPercentage as number;
  }

  const cashbackAmount = Math.round((originalAmount * percentage) / 100 * 100) / 100;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CASHBACK_EXPIRATION_DAYS);

  return {
    cashbackAmount,
    percentage,
    source,
    expiresAt,
  };
};

/**
 * Earn cashback from a source
 */
export const earnCashback = async (
  userId: string,
  amount: number,
  source: string,
  sourceDescription: string,
  sourceId?: string,
  metadata?: Record<string, unknown>,
  req?: Request
): Promise<{ success: boolean; cashbackId?: string; amount?: number; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    // Calculate the cashback
    const calculation = await calculateCashback(amount, source, metadata);

    if (calculation.cashbackAmount <= 0) {
      return { success: false, error: 'Cashback amount is zero or negative' };
    }

    const cashbackData: Record<string, unknown> = {
      userId,
      amount: calculation.cashbackAmount,
      currency: 'AED',
      source,
      status: 'earned',
      sourceDescription,
      originalAmount: amount,
      percentage: calculation.percentage,
      expiresAt: calculation.expiresAt,
      metadata,
    };

    if (tenantId) {
      cashbackData.tenantId = tenantId;
    }

    if (sourceId) {
      cashbackData.sourceId = sourceId;
    }

    const cashback = await Cashback.create(cashbackData);

    logger.info('Cashback earned', {
      userId,
      cashbackId: cashback._id.toString(),
      amount: calculation.cashbackAmount,
      source,
      percentage: calculation.percentage,
      action: 'CASHBACK_EARNED',
    });

    return {
      success: true,
      cashbackId: cashback._id.toString(),
      amount: calculation.cashbackAmount,
    };
  } catch (error: any) {
    logger.error('Failed to earn cashback', {
      userId,
      error: error.message,
      source,
      action: 'CASHBACK_EARN_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get user's cashback balance (total available)
 */
export const getCashbackBalance = async (
  userId: string,
  req?: Request
): Promise<{ balance: number; currency: string; breakdown: Record<string, number> }> => {
  const tenantId = req ? getTenantIdOptional(req) : undefined;
  const isAdmin = req ? isAdminOrSystem(req) : false;

  const query: Record<string, unknown> = { userId, status: 'available' };
  if (!isAdmin && tenantId) {
    query.tenantId = tenantId;
  }

  const cashbacks = await Cashback.find(query);

  const balance = cashbacks.reduce((sum, cb) => sum + cb.amount, 0);

  // Calculate breakdown by source
  const breakdown: Record<string, number> = {};
  for (const cb of cashbacks) {
    breakdown[cb.source] = (breakdown[cb.source] || 0) + cb.amount;
  }

  return {
    balance: Math.round(balance * 100) / 100,
    currency: 'AED',
    breakdown,
  };
};

/**
 * Get cashback history with filters
 */
export const getCashbackHistory = async (
  userId: string,
  req?: Request,
  options?: {
    limit?: number;
    offset?: number;
    source?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{
  cashbacks: CashbackEntry[];
  total: number;
  balance: number;
}> => {
  const tenantId = req ? getTenantIdOptional(req) : undefined;
  const isAdmin = req ? isAdminOrSystem(req) : false;

  const query: Record<string, unknown> = { userId };
  if (!isAdmin && tenantId) {
    query.tenantId = tenantId;
  }

  if (options?.source) {
    query.source = options.source;
  }

  if (options?.status) {
    query.status = options.status;
  }

  if (options?.startDate || options?.endDate) {
    query.earnedAt = {};
    if (options.startDate) {
      (query.earnedAt as Record<string, Date>).$gte = options.startDate;
    }
    if (options.endDate) {
      (query.earnedAt as Record<string, Date>).$lte = options.endDate;
    }
  }

  const total = await Cashback.countDocuments(query);
  const cashbacks = await Cashback.find(query)
    .sort({ earnedAt: -1 })
    .skip(options?.offset || 0)
    .limit(options?.limit || 20);

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const entries: CashbackEntry[] = cashbacks.map((cb) => ({
    id: cb._id.toString(),
    amount: cb.amount,
    currency: cb.currency,
    source: cb.source,
    status: cb.status,
    sourceDescription: cb.sourceDescription,
    percentage: cb.percentage,
    earnedAt: cb.earnedAt,
    expiresAt: cb.expiresAt,
    isExpiringSoon: cb.expiresAt <= sevenDaysFromNow && cb.status === 'available',
  }));

  // Calculate balance
  const balanceResult = await getCashbackBalance(userId, req);

  return {
    cashbacks: entries,
    total,
    balance: balanceResult.balance,
  };
};

/**
 * Get expiring cashback alerts
 */
export const getExpiringCashback = async (
  userId: string,
  req?: Request,
  daysThreshold: number = 7
): Promise<CashbackEntry[]> => {
  const tenantId = req ? getTenantIdOptional(req) : undefined;
  const isAdmin = req ? isAdminOrSystem(req) : false;

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  const query: Record<string, unknown> = {
    userId,
    status: 'available',
    expiresAt: { $lte: thresholdDate },
  };

  if (!isAdmin && tenantId) {
    query.tenantId = tenantId;
  }

  const cashbacks = await Cashback.find(query).sort({ expiresAt: 1 });

  return cashbacks.map((cb) => ({
    id: cb._id.toString(),
    amount: cb.amount,
    currency: cb.currency,
    source: cb.source,
    status: cb.status,
    sourceDescription: cb.sourceDescription,
    percentage: cb.percentage,
    earnedAt: cb.earnedAt,
    expiresAt: cb.expiresAt,
    isExpiringSoon: true,
  }));
};

/**
 * Redeem cashback to wallet
 */
export const redeemCashbackToWallet = async (
  userId: string,
  cashbackIds: string[],
  req?: Request
): Promise<{ success: boolean; totalRedeemed?: number; transactionId?: string; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

    // Validate and get cashbacks
    const query: Record<string, unknown> = {
      _id: { $in: cashbackIds },
      userId,
      status: 'available',
    };

    if (!isAdmin && tenantId) {
      query.tenantId = tenantId;
    }

    const cashbacks = await Cashback.find(query);

    if (cashbacks.length !== cashbackIds.length) {
      return { success: false, error: 'Some cashback entries not found or not available' };
    }

    const totalRedeemed = cashbacks.reduce((sum, cb) => sum + cb.amount, 0);

    // Redeem to wallet
    const walletResult = await creditWallet(
      {
        userId,
        type: 'credit',
        amount: totalRedeemed,
        description: `Cashback redemption (${cashbacks.length} entries)`,
        reference: `cashback_redeem_${randomUUID()}`,
        referenceType: 'bonus',
        metadata: {
          cashbackIds: cashbackIds.map((id) => id.toString()),
          source: 'cashback_redemption',
        },
      },
      req
    );

    if (!walletResult.success) {
      return { success: false, error: walletResult.error };
    }

    // Update cashback statuses
    await Cashback.updateMany(
      { _id: { $in: cashbackIds } },
      {
        $set: {
          status: 'redeemed',
          redeemedAt: new Date(),
          redeemedTo: 'wallet',
          redemptionReference: walletResult.transactionId,
        },
      }
    );

    logger.info('Cashback redeemed to wallet', {
      userId,
      cashbackIds,
      totalRedeemed,
      transactionId: walletResult.transactionId,
      action: 'CASHBACK_REDEEMED',
    });

    return {
      success: true,
      totalRedeemed,
      transactionId: walletResult.transactionId,
    };
  } catch (error: any) {
    logger.error('Failed to redeem cashback', {
      userId,
      error: error.message,
      action: 'CASHBACK_REDEEM_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get cashback statistics
 */
export const getCashbackStats = async (
  userId: string,
  req?: Request
): Promise<{
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
  availableBalance: number;
  bySource: Record<string, { count: number; amount: number }>;
}> => {
  const tenantId = req ? getTenantIdOptional(req) : undefined;
  const isAdmin = req ? isAdminOrSystem(req) : false;

  const baseQuery: Record<string, unknown> = { userId };
  if (!isAdmin && tenantId) {
    baseQuery.tenantId = tenantId;
  }

  const [earned, redeemed, expired, available, bySourceAgg] = await Promise.all([
    Cashback.aggregate([
      { $match: { ...baseQuery, status: { $in: ['earned', 'available'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Cashback.aggregate([
      { $match: { ...baseQuery, status: 'redeemed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Cashback.aggregate([
      { $match: { ...baseQuery, status: 'expired' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Cashback.aggregate([
      { $match: { ...baseQuery, status: 'available' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Cashback.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const bySource: Record<string, { count: number; amount: number }> = {};
  for (const item of bySourceAgg) {
    bySource[item._id] = { count: item.count, amount: item.amount };
  }

  return {
    totalEarned: earned[0]?.total || 0,
    totalRedeemed: redeemed[0]?.total || 0,
    totalExpired: expired[0]?.total || 0,
    availableBalance: available[0]?.total || 0,
    bySource,
  };
};

/**
 * Process expired cashback (to be called by a scheduled job)
 */
export const processExpiredCashback = async (): Promise<number> => {
  const now = new Date();

  const result = await Cashback.updateMany(
    {
      status: 'available',
      expiresAt: { $lt: now },
    },
    {
      $set: {
        status: 'expired',
        expiredAt: now,
      },
    }
  );

  if (result.modifiedCount > 0) {
    logger.info('Processed expired cashback', {
      count: result.modifiedCount,
      action: 'CASHBACK_EXPIRY_PROCESSED',
    });
  }

  return result.modifiedCount;
};

export default {
  calculateCashback,
  earnCashback,
  getCashbackBalance,
  getCashbackHistory,
  getExpiringCashback,
  redeemCashbackToWallet,
  getCashbackStats,
  processExpiredCashback,
};
