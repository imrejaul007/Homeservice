import CorporateWallet, { ICorporateWallet } from '../models/corporateWallet.model';
import CorporateSpending from '../models/corporateWallet.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { getTenantId, getTenantIdOptional, isAdminOrSystem } from '../utils/tenantFilter';

export interface CorporateWalletEntry {
  id: string;
  companyId: string;
  companyName: string;
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  currency: string;
  dailySpendingLimit?: number;
  monthlySpendingLimit?: number;
  perTransactionLimit?: number;
  totalSpent: number;
  totalSpentThisMonth: number;
  status: string;
  billingCycle: string;
  billingDay: number;
  nextBillingDate: Date;
}

export interface SpendingBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  bookingCount: number;
}

export interface EmployeeSpending {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department?: string;
  totalSpent: number;
  monthlyLimit?: number;
  usedThisMonth: number;
  bookingCount: number;
}

export interface TransactionEntry {
  id: string;
  type: string;
  amount: number;
  description: string;
  reference: string;
  status: string;
  balanceAfter: number;
  employeeName?: string;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Link a corporate account to a user
 */
export const linkCorporateAccount = async (
  userId: string,
  companyId: string,
  options?: {
    creditLimit?: number;
    dailySpendingLimit?: number;
    monthlySpendingLimit?: number;
    perTransactionLimit?: number;
    billingCycle?: 'monthly' | 'quarterly' | 'annually';
    billingDay?: number;
  },
  req?: Request
): Promise<{ success: boolean; walletId?: string; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    // Check if wallet already exists
    const existing = await CorporateWallet.findOne({ companyId, employeeId: userId });
    if (existing) {
      return { success: false, error: 'Corporate wallet already linked for this company' };
    }

    // Calculate next billing date
    const now = new Date();
    let nextBillingDate: Date;
    const billingDay = options?.billingDay || 1;

    if (options?.billingCycle === 'quarterly') {
      nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 3, billingDay);
    } else if (options?.billingCycle === 'annually') {
      nextBillingDate = new Date(now.getFullYear() + 1, now.getMonth(), billingDay);
    } else {
      // Monthly
      nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, billingDay);
    }

    const walletData: Record<string, unknown> = {
      companyId,
      employeeId: userId,
      currentBalance: 0,
      creditLimit: options?.creditLimit || 0,
      availableCredit: options?.creditLimit || 0,
      currency: 'AED',
      dailySpendingLimit: options?.dailySpendingLimit,
      monthlySpendingLimit: options?.monthlySpendingLimit,
      perTransactionLimit: options?.perTransactionLimit,
      totalSpent: 0,
      totalSpentThisMonth: 0,
      status: 'active',
      billingCycle: options?.billingCycle || 'monthly',
      billingDay,
      nextBillingDate,
      transactions: [],
    };

    if (tenantId) {
      walletData.tenantId = tenantId;
    }

    const wallet = await CorporateWallet.create(walletData);

    logger.info('Corporate wallet linked', {
      walletId: wallet._id.toString(),
      userId,
      companyId,
      action: 'CORPORATE_WALLET_LINKED',
    });

    return { success: true, walletId: wallet._id.toString() };
  } catch (error: any) {
    logger.error('Failed to link corporate wallet', {
      userId,
      companyId,
      error: error.message,
      action: 'CORPORATE_LINK_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get corporate wallet for user
 * Security: Only the employee who owns the wallet or an admin can access it
 */
export const getCorporateWallet = async (
  userId: string,
  req?: Request
): Promise<CorporateWalletEntry | null> => {
  const tenantId = req ? getTenantIdOptional(req) : undefined;
  const isAdmin = req ? isAdminOrSystem(req) : false;

  // IDOR fix: Get the authenticated user from request to verify authorization
  const authenticatedUserId = req?.user?.id || req?.user?._id?.toString();

  // Authorization check: user can only access their own wallet unless they are admin
  // Non-admin users must use their own authenticated ID to query the wallet
  if (!isAdmin) {
    if (!authenticatedUserId) {
      logger.warn('IDOR attempt blocked: no authenticated user found', {
        action: 'CORPORATE_WALLET_IDOR_BLOCKED',
      });
      return null;
    }
    // Always use authenticated user's ID for non-admin requests
    userId = authenticatedUserId;
  }

  const query: Record<string, unknown> = { employeeId: userId, status: { $ne: 'closed' } };
  if (!isAdmin && tenantId) {
    query.tenantId = tenantId;
  }

  const wallet = await CorporateWallet.findOne(query);

  if (!wallet) {
    return null;
  }

  // Get company name from user
  const user = await User.findById(userId).select('corporateInfo.companyName');

  return {
    id: wallet._id.toString(),
    companyId: wallet.companyId.toString(),
    companyName: user?.corporateInfo?.companyName || 'Unknown Company',
    currentBalance: wallet.currentBalance,
    creditLimit: wallet.creditLimit,
    availableCredit: wallet.availableCredit,
    currency: wallet.currency,
    dailySpendingLimit: wallet.dailySpendingLimit,
    monthlySpendingLimit: wallet.monthlySpendingLimit,
    perTransactionLimit: wallet.perTransactionLimit,
    totalSpent: wallet.totalSpent,
    totalSpentThisMonth: wallet.totalSpentThisMonth,
    status: wallet.status,
    billingCycle: wallet.billingCycle,
    billingDay: wallet.billingDay,
    nextBillingDate: wallet.nextBillingDate,
  };
};

/**
 * Check spending limits before transaction
 */
export const checkSpendingLimits = async (
  walletId: string,
  amount: number,
  employeeId?: string,
  req?: Request
): Promise<{ allowed: boolean; error?: string; requiresApproval?: boolean }> => {
  try {
    const wallet = await CorporateWallet.findById(walletId);

    if (!wallet) {
      return { allowed: false, error: 'Corporate wallet not found' };
    }

    if (wallet.status !== 'active') {
      return { allowed: false, error: `Corporate wallet is ${wallet.status}` };
    }

    // Check per-transaction limit
    if (wallet.perTransactionLimit && amount > wallet.perTransactionLimit) {
      return {
        allowed: false,
        error: `Amount exceeds per-transaction limit of ${wallet.currency} ${wallet.perTransactionLimit}`,
      };
    }

    // Check daily spending limit
    if (wallet.dailySpendingLimit) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todaySpending = wallet.transactions
        .filter((t) => t.type === 'charge' && t.createdAt >= todayStart)
        .reduce((sum, t) => sum + t.amount, 0);

      if (todaySpending + amount > wallet.dailySpendingLimit) {
        return {
          allowed: false,
          error: `Daily spending limit of ${wallet.currency} ${wallet.dailySpendingLimit} would be exceeded`,
        };
      }
    }

    // Check monthly spending limit
    if (wallet.monthlySpendingLimit) {
      if (wallet.totalSpentThisMonth + amount > wallet.monthlySpendingLimit) {
        return {
          allowed: false,
          error: `Monthly spending limit of ${wallet.currency} ${wallet.monthlySpendingLimit} would be exceeded`,
        };
      }
    }

    // Check available credit
    if (wallet.availableCredit < amount) {
      if (wallet.requiresApprovalAbove && amount > wallet.requiresApprovalAbove) {
        return { allowed: true, requiresApproval: true };
      }
      return {
        allowed: false,
        error: `Insufficient credit. Available: ${wallet.currency} ${wallet.availableCredit}`,
      };
    }

    return { allowed: true };
  } catch (error: any) {
    logger.error('Failed to check spending limits', {
      walletId,
      error: error.message,
      action: 'CORPORATE_LIMIT_CHECK_ERROR',
    });
    return { allowed: false, error: error.message };
  }
};

/**
 * Process corporate charge for a booking
 */
export const processCorporateCharge = async (
  walletId: string,
  bookingId: string,
  amount: number,
  description: string,
  employeeId: string,
  employeeName: string,
  req?: Request
): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    // Check limits
    const limitCheck = await checkSpendingLimits(walletId, amount, employeeId, req);
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.error };
    }

    const wallet = await CorporateWallet.findById(walletId);
    if (!wallet) {
      return { success: false, error: 'Corporate wallet not found' };
    }

    const transactionId = `corp_txn_${randomUUID()}`;
    const transaction = {
      id: transactionId,
      type: 'charge' as const,
      amount,
      description,
      reference: bookingId,
      referenceType: 'booking' as const,
      status: 'completed' as const,
      balanceAfter: wallet.currentBalance - amount,
      employeeId,
      employeeName,
      metadata: { tenantId },
      createdAt: new Date(),
      completedAt: new Date(),
    };

    // Update wallet atomically
    await CorporateWallet.findByIdAndUpdate(walletId, {
      $push: { transactions: transaction },
      $inc: {
        currentBalance: -amount,
        availableCredit: -amount,
        totalSpent: amount,
        totalSpentThisMonth: amount,
      },
    });

    // Update spending tracking
    await updateSpendingTracking(walletId, employeeId, employeeName, amount);

    logger.info('Corporate charge processed', {
      walletId,
      transactionId,
      bookingId,
      amount,
      action: 'CORPORATE_CHARGE_PROCESSED',
    });

    return { success: true, transactionId };
  } catch (error: any) {
    logger.error('Failed to process corporate charge', {
      walletId,
      bookingId,
      error: error.message,
      action: 'CORPORATE_CHARGE_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Update spending tracking by employee and category
 */
const updateSpendingTracking = async (
  walletId: string,
  employeeId: string,
  employeeName: string,
  amount: number,
  categoryId?: string,
  categoryName?: string
): Promise<void> => {
  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await CorporateSpending.findOneAndUpdate(
      {
        walletId,
        employeeId,
        periodStart: { $gte: periodStart },
        periodEnd: { $lte: periodEnd },
      },
      {
        $inc: {
          usedThisMonth: amount,
          totalSpent: amount,
          bookingCount: 1,
        },
        $setOnInsert: {
          employeeName,
          periodStart,
          periodEnd,
        },
      },
      { upsert: true, new: true }
    );
  } catch (error: any) {
    logger.error('Failed to update spending tracking', { walletId, employeeId, error: error.message });
    throw new Error(`Failed to update spending tracking: ${error.message}`);
  }
};

/**
 * Get transaction history
 */
export const getTransactionHistory = async (
  walletId: string,
  req?: Request,
  options?: {
    limit?: number;
    offset?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{ transactions: TransactionEntry[]; total: number }> => {
  try {
    const wallet = await CorporateWallet.findById(walletId);

    if (!wallet) {
      return { transactions: [], total: 0 };
    }

    let transactions = [...wallet.transactions];

    // Filter by type
    if (options?.type) {
      transactions = transactions.filter((t) => t.type === options.type);
    }

    // Filter by date range
    if (options?.startDate || options?.endDate) {
      transactions = transactions.filter((t) => {
        const txDate = new Date(t.createdAt);
        if (options.startDate && txDate < options.startDate) return false;
        if (options.endDate && txDate > options.endDate) return false;
        return true;
      });
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = transactions.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    const paginated = transactions.slice(offset, offset + limit);

    return {
      transactions: paginated.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        reference: t.reference,
        status: t.status,
        balanceAfter: t.balanceAfter,
        employeeName: t.employeeName,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
      total,
    };
  } catch (error: any) {
    logger.error('Failed to get transaction history', {
      walletId,
      error: error.message,
      action: 'CORPORATE_HISTORY_ERROR',
    });
    return { transactions: [], total: 0 };
  }
};

/**
 * Get employee spending breakdown
 */
export const getEmployeeSpending = async (
  walletId: string,
  req?: Request
): Promise<EmployeeSpending[]> => {
  try {
    const wallet = await CorporateWallet.findById(walletId);
    if (!wallet) {
      return [];
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const spendings = await CorporateSpending.find({
      walletId,
      periodStart: { $gte: periodStart },
      periodEnd: { $lte: periodEnd },
    });

    return spendings.map((s) => ({
      employeeId: s.employeeId.toString(),
      employeeName: s.employeeName ?? '',
      employeeEmail: s.employeeEmail ?? '',
      department: s.department,
      totalSpent: s.totalSpent,
      monthlyLimit: s.monthlyLimit,
      usedThisMonth: s.usedThisMonth ?? 0,
      bookingCount: s.bookingCount ?? 0,
    }));
  } catch (error: any) {
    logger.error('Failed to get employee spending', {
      walletId,
      error: error.message,
      action: 'CORPORATE_EMPLOYEE_SPENDING_ERROR',
    });
    return [];
  }
};

/**
 * Get spending breakdown by category
 */
export const getSpendingBreakdown = async (
  walletId: string,
  req?: Request
): Promise<SpendingBreakdown[]> => {
  try {
    const wallet = await CorporateWallet.findById(walletId);
    if (!wallet) {
      return [];
    }

    // Aggregate spending by category from transactions metadata
    const categoryMap = new Map<string, { amount: number; count: number; name: string }>();

    for (const tx of wallet.transactions) {
      if (tx.type === 'charge' && tx.metadata?.categoryId) {
        const categoryId = tx.metadata.categoryId as string;
        const categoryName = (tx.metadata.categoryName as string) || 'Other';
        const existing = categoryMap.get(categoryId) || { amount: 0, count: 0, name: categoryName };
        existing.amount += tx.amount;
        existing.count += 1;
        categoryMap.set(categoryId, existing);
      }
    }

    const totalSpent = wallet.totalSpent || 1; // Avoid division by zero

    return Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      amount: data.amount,
      percentage: Math.round((data.amount / totalSpent) * 100 * 100) / 100,
      bookingCount: data.count,
    }));
  } catch (error: any) {
    logger.error('Failed to get spending breakdown', {
      walletId,
      error: error.message,
      action: 'CORPORATE_BREAKDOWN_ERROR',
    });
    throw new Error(`Failed to retrieve spending breakdown: ${error.message}`);
  }
};

/**
 * Request limit increase
 */
export const requestLimitIncrease = async (
  walletId: string,
  requestedLimit: number,
  reason: string,
  req?: Request
): Promise<{ success: boolean; requestId?: string; error?: string }> => {
  try {
    // Validation: requestedLimit must be a positive number
    if (!requestedLimit || typeof requestedLimit !== 'number' || requestedLimit <= 0) {
      return { success: false, error: 'Requested limit must be a positive number' };
    }

    // Validation: reason must be present and have reasonable length
    if (!reason || typeof reason !== 'string') {
      return { success: false, error: 'A reason is required for the limit increase request' };
    }

    const reasonTrimmed = reason.trim();
    if (reasonTrimmed.length < 10) {
      return { success: false, error: 'Reason must be at least 10 characters long' };
    }

    if (reasonTrimmed.length > 1000) {
      return { success: false, error: 'Reason must not exceed 1000 characters' };
    }

    // Fetch wallet to get current credit limit
    const wallet = await CorporateWallet.findById(walletId);
    if (!wallet) {
      return { success: false, error: 'Corporate wallet not found' };
    }

    const currentLimit = wallet.creditLimit || 0;

    // Validation: requested limit must not exceed 10x current limit (prevent abuse)
    const maxAllowedLimit = currentLimit * 10;
    if (requestedLimit > maxAllowedLimit) {
      return {
        success: false,
        error: `Requested limit cannot exceed 10x the current limit (${maxAllowedLimit.toLocaleString()}). Please contact support for higher increases.`
      };
    }

    // Validation: requested limit should be greater than current limit
    if (requestedLimit <= currentLimit) {
      return { success: false, error: 'Requested limit must be greater than current credit limit' };
    }

    // In production, this would create a ticket for admin review
    const requestId = `limit_req_${randomUUID()}`;

    logger.info('Limit increase requested', {
      walletId,
      requestId,
      currentLimit,
      requestedLimit,
      increasePercentage: Math.round((requestedLimit / currentLimit - 1) * 100),
      reasonLength: reasonTrimmed.length,
      action: 'CORPORATE_LIMIT_INCREASE_REQUESTED',
    });

    return { success: true, requestId };
  } catch (error: any) {
    logger.error('Failed to request limit increase', {
      walletId,
      error: error.message,
      action: 'CORPORATE_LIMIT_REQUEST_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Update spending limits
 */
export const updateSpendingLimits = async (
  walletId: string,
  limits: {
    creditLimit?: number;
    dailySpendingLimit?: number;
    monthlySpendingLimit?: number;
    perTransactionLimit?: number;
  },
  req?: Request
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: Record<string, unknown> = { ...limits };

    await CorporateWallet.findByIdAndUpdate(walletId, {
      $set: updateData,
    });

    logger.info('Spending limits updated', {
      walletId,
      limits,
      action: 'CORPORATE_LIMITS_UPDATED',
    });

    return { success: true };
  } catch (error: any) {
    logger.error('Failed to update spending limits', {
      walletId,
      error: error.message,
      action: 'CORPORATE_LIMITS_UPDATE_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Process billing cycle reset (to be called by scheduled job)
 */
export const processBillingCycleReset = async (): Promise<number> => {
  const now = new Date();

  // Find wallets where nextBillingDate has passed
  const wallets = await CorporateWallet.find({
    nextBillingDate: { $lte: now },
    status: 'active',
  });

  let processed = 0;

  for (const wallet of wallets) {
    // Reset monthly spending
    wallet.totalSpentThisMonth = 0;

    // Calculate next billing date
    if (wallet.billingCycle === 'quarterly') {
      wallet.nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 3, wallet.billingDay);
    } else if (wallet.billingCycle === 'annually') {
      wallet.nextBillingDate = new Date(now.getFullYear() + 1, now.getMonth(), wallet.billingDay);
    } else {
      wallet.nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, wallet.billingDay);
    }

    await wallet.save();
    processed++;
  }

  if (processed > 0) {
    logger.info('Billing cycle reset processed', {
      count: processed,
      action: 'CORPORATE_BILLING_RESET',
    });
  }

  return processed;
};

export default {
  linkCorporateAccount,
  getCorporateWallet,
  checkSpendingLimits,
  processCorporateCharge,
  getTransactionHistory,
  getEmployeeSpending,
  getSpendingBreakdown,
  requestLimitIncrease,
  updateSpendingLimits,
  processBillingCycleReset,
};
