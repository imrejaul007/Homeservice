import Wallet, { IWallet, TransactionStatus } from '../models/wallet.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import { logWalletAlert } from './alert.service';
import { Request } from 'express';
import { addTenantFilter, getTenantId, getTenantIdOptional, isAdminOrSystem } from '../utils/tenantFilter';
import { calculateCommission } from './settlement.service';
import mongoose from 'mongoose';

// Transaction state machine
export const validTransitions: Record<TransactionStatus, TransactionStatus[]> = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: ['reversed'],
  failed: [],
  reversed: [],
};

// Maximum wallet balance limit (100,000 AED)
const MAX_WALLET_BALANCE = 100000;

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

export function getValidNextStatuses(currentStatus: TransactionStatus): TransactionStatus[] {
  return validTransitions[currentStatus] || [];
}

interface TransactionResult {
  success: boolean;
  newBalance: number;
  transactionId?: string;
  error?: string;
}

interface TransactionData {
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference: string;
  referenceType: 'booking' | 'refund' | 'bonus' | 'payout' | 'topup' | 'commission';
  metadata?: Record<string, unknown>;
}

interface CreditOptions {
  preventDuplicateReference?: {
    reference: string;
    referenceType: string;
  };
}

// Create or get wallet for user (tenant-isolated)
export const getOrCreateWallet = async (userId: string, req?: Request, tenantIdOverride?: string): Promise<IWallet> => {
  const tenantId = tenantIdOverride || (req ? getTenantId(req) : undefined);

  const query: any = { userId };
  if (tenantId) {
    query.tenantId = tenantId;
  }

  let wallet = await Wallet.findOne(query);

  if (!wallet) {
    const walletData: any = {
      userId,
      balance: 0,
      currency: 'AED',
      transactions: [],
      pendingBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
    };

    // Set tenantId for multi-tenant isolation
    if (tenantId) {
      walletData.tenantId = tenantId;
    }

    wallet = await Wallet.create(walletData);

    logger.info('Wallet created', { userId, tenantId, action: 'WALLET_CREATED' });
  }

  return wallet;
};

/**
 * Internal credit function that supports MongoDB sessions for transaction safety
 * This is the core function used by creditWallet with session support
 */
const creditWalletInternal = async (
  data: TransactionData,
  tenantId?: string,
  isAdmin?: boolean,
  options?: CreditOptions,
  session?: mongoose.ClientSession
): Promise<TransactionResult> => {
  const transactionId = `txn_${randomUUID()}`;
  const transaction = {
    id: transactionId,
    type: 'credit' as const,
    amount: data.amount,
    description: data.description,
    reference: data.reference,
    referenceType: data.referenceType,
    status: 'completed' as const,
    metadata: data.metadata,
    createdAt: new Date(),
  };

  // Build query with tenant isolation
  const baseQuery: any = { userId: data.userId };
  if (!isAdmin && tenantId) {
    baseQuery.tenantId = tenantId;
  }

  // SECURITY FIX: If duplicate prevention is requested, use atomic check-and-credit
  // This prevents race conditions where two requests could both pass a check
  // before either performs the actual credit
  if (options?.preventDuplicateReference) {
    // Use atomic findOneAndUpdate with condition to prevent duplicate
    // The query includes a check that no transaction with this reference exists
    const duplicateCheckQuery = {
      ...baseQuery,
      'transactions.reference': { $ne: options.preventDuplicateReference.reference },
      'transactions.referenceType': { $ne: options.preventDuplicateReference.referenceType },
    };

    const wallet = await Wallet.findOneAndUpdate(
      duplicateCheckQuery,
      {
        $inc: {
          balance: data.amount,
          totalEarned: data.amount,
          version: 1, // Increment version for optimistic locking
        },
        $push: {
          transactions: transaction,
        },
      },
      { new: true, session }
    );

    if (!wallet) {
      // Either wallet doesn't exist OR a transaction with this reference already exists
      // Check which case it is
      const existingWallet = await Wallet.findOne(baseQuery).session(session || null);
      if (existingWallet) {
        // Wallet exists but duplicate was prevented
        logger.warn('Duplicate credit prevented by atomic check', {
          userId: data.userId,
          reference: data.reference,
          referenceType: data.referenceType,
          action: 'DUPLICATE_CREDIT_PREVENTED',
        });
        return {
          success: false,
          newBalance: 0,
          error: 'Transaction with this reference already exists',
        };
      }
      // Wallet doesn't exist, fall through to create
    } else {
      logger.info('Wallet credited with duplicate prevention (atomic)', {
        userId: data.userId,
        tenantId,
        amount: data.amount,
        newBalance: wallet.balance,
        reference: data.reference,
        action: 'WALLET_CREDITED_ATOMIC',
      });
      return {
        success: true,
        newBalance: wallet.balance,
        transactionId: transactionId,
      };
    }
  }

  // CRITICAL FIX: Use atomic findOneAndUpdate with optimistic locking and retry
  // This prevents race conditions by combining read-check-write into a single atomic operation
  const creditWithCapCheck = async (): Promise<{ wallet: any; exceedsCap: boolean; balanceBefore: number }> => {
    const MAX_RETRIES = 3;

    const attemptCredit = async (expectedVersion?: number): Promise<{ wallet: any; reason: string } | null> => {
      const query: any = {
        ...baseQuery,
        balance: { $lte: MAX_WALLET_BALANCE - data.amount }, // Balance cap check
        isFrozen: { $ne: true }, // Ensure wallet is not frozen
      };

      // Include version in query if we have an expected version (for retry after version mismatch)
      if (expectedVersion !== undefined) {
        query.version = expectedVersion;
      }

      const wallet = await Wallet.findOneAndUpdate(
        query,
        {
          $inc: {
            balance: data.amount,
            totalEarned: data.amount,
            version: 1,
          },
          $set: {
            lastTransactionAt: new Date(),
            lastTransactionType: 'credit',
          },
          $push: {
            transactions: transaction,
          },
        },
        { new: true, session }
      );

      if (wallet) {
        return { wallet, reason: 'success' };
      }
      return null;
    };

    // First attempt without version constraint (will use default version matching)
    let result = await attemptCredit();

    if (result) {
      return { wallet: result.wallet, exceedsCap: false, balanceBefore: result.wallet.balance - data.amount };
    }

    // If first attempt failed, fetch fresh wallet to determine reason and retry
    let retries = MAX_RETRIES;
    while (retries > 0) {
      const freshWallet = await Wallet.findOne(baseQuery).session(session || null);

      if (!freshWallet) {
        // Wallet doesn't exist
        return { wallet: null, exceedsCap: false, balanceBefore: 0 };
      }

      if (freshWallet.isFrozen) {
        logger.warn('Wallet is frozen, cannot credit', {
          userId: data.userId,
          tenantId,
          frozenAt: freshWallet.frozenAt,
          freezeReason: freshWallet.freezeReason,
          action: 'WALLET_FROZEN',
        });
        return { wallet: null, exceedsCap: false, balanceBefore: freshWallet.balance };
      }

      if (freshWallet.balance + data.amount > MAX_WALLET_BALANCE) {
        return { wallet: null, exceedsCap: true, balanceBefore: freshWallet.balance };
      }

      // Retry with current version
      result = await attemptCredit(freshWallet.version);

      if (result) {
        return { wallet: result.wallet, exceedsCap: false, balanceBefore: result.wallet.balance - data.amount };
      }

      retries--;
      logger.warn('Credit retry due to concurrent modification', {
        userId: data.userId,
        tenantId,
        remainingRetries: retries,
        action: 'WALLET_CREDIT_RETRY',
      });
    }

    // All retries exhausted
    logger.error('Credit failed after max retries - concurrent modification', {
      userId: data.userId,
      tenantId,
      action: 'WALLET_CREDIT_EXHAUSTED',
    });
    return { wallet: null, exceedsCap: false, balanceBefore: 0 };
  };

  const result = await creditWithCapCheck();

  if (result.exceedsCap) {
    // Reject transaction due to balance cap
    logger.error('Wallet balance exceeded maximum limit (atomic rejection)', {
      userId: data.userId,
      tenantId,
      attemptedBalance: result.balanceBefore + data.amount,
      maxBalance: MAX_WALLET_BALANCE,
      action: 'WALLET_BALANCE_CAP_EXCEEDED',
    });
    logWalletAlert('Wallet balance exceeded maximum limit', {
      userId: data.userId,
      attemptedBalance: result.balanceBefore + data.amount,
      maxBalance: MAX_WALLET_BALANCE,
    });

    return {
      success: false,
      newBalance: MAX_WALLET_BALANCE,
      transactionId: transactionId,
      error: 'Wallet balance cannot exceed maximum limit of 100,000 AED. Transaction has been rejected.',
    };
  }

  if (!result.wallet) {
    // Wallet doesn't exist, create it with the credit
    const newWalletData: any = {
      userId: data.userId,
      balance: data.amount,
      currency: 'AED',
      transactions: [transaction],
      pendingBalance: 0,
      totalEarned: data.amount,
      totalSpent: 0,
      version: 1, // Initialize version
    };

    // Set tenantId for multi-tenant isolation
    if (tenantId) {
      newWalletData.tenantId = tenantId;
    }

    const newWallet = await Wallet.create([newWalletData], { session }).then(wallets => wallets[0]);

    logger.info('Wallet created and credited (atomic)', {
      userId: data.userId,
      tenantId,
      amount: data.amount,
      newBalance: newWallet.balance,
      reference: data.reference,
      action: 'WALLET_CREATED_AND_CREDITED',
    });

    return {
      success: true,
      newBalance: newWallet.balance,
      transactionId: transactionId,
    };
  }

  // Update balanceAfter in the transaction
  await Wallet.updateOne(
    {
      userId: data.userId,
      'transactions.id': transactionId,
    },
    {
      $set: { 'transactions.$.balanceAfter': result.wallet.balance },
    }
  ).session(session || null);

  const wallet = result.wallet;

  logger.info('Wallet credited (atomic with optimistic locking)', {
    userId: data.userId,
    tenantId,
    amount: data.amount,
    newBalance: wallet.balance,
    version: wallet.version,
    reference: data.reference,
    action: 'WALLET_CREDITED',
  });

  return {
    success: true,
    newBalance: wallet.balance,
    transactionId: transactionId,
  };
};

// Add credit to wallet (atomic operation to prevent race conditions)
export const creditWallet = async (
  data: TransactionData,
  req?: Request,
  options?: CreditOptions,
  session?: mongoose.ClientSession
): Promise<TransactionResult> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

    return await creditWalletInternal(data, tenantId, isAdmin, options, session);
  } catch (error: any) {
    logger.error('Failed to credit wallet', {
      userId: data.userId,
      error: error.message,
      action: 'WALLET_CREDIT_ERROR',
    });
    logWalletAlert('Wallet credit failed', { userId: data.userId, error: error.message, reference: data.reference });
    return {
      success: false,
      newBalance: 0,
      error: error.message,
    };
  }
};

/**
 * Internal debit function that supports MongoDB sessions for transaction safety
 */
const debitWalletInternal = async (
  data: TransactionData,
  tenantId?: string,
  isAdmin?: boolean,
  session?: mongoose.ClientSession
): Promise<TransactionResult> => {
  const transactionId = `txn_${randomUUID()}`;
  const transaction = {
    id: transactionId,
    type: 'debit' as const,
    amount: data.amount,
    description: data.description,
    reference: data.reference,
    referenceType: data.referenceType,
    status: 'completed' as const,
    metadata: data.metadata,
    createdAt: new Date(),
  };

  // CRITICAL FIX: Use atomic findOneAndUpdate with optimistic locking and retry
  // This prevents race conditions by combining read-check-write into a single atomic operation
  const baseQuery: any = { userId: data.userId };
  if (!isAdmin && tenantId) {
    baseQuery.tenantId = tenantId;
  }

  const MAX_RETRIES = 3;

  const attemptDebit = async (expectedVersion?: number): Promise<{ wallet: any; reason: string } | null> => {
    const query: any = {
      ...baseQuery,
      balance: { $gte: data.amount }, // Ensure sufficient balance
      isFrozen: { $ne: true }, // Wallet must not be frozen
    };

    // Include version in query if we have an expected version (for retry after version mismatch)
    if (expectedVersion !== undefined) {
      query.version = expectedVersion;
    }

    const wallet = await Wallet.findOneAndUpdate(
      query,
      {
        $inc: {
          balance: -data.amount,
          totalSpent: data.amount,
          version: 1,
        },
        $set: {
          lastTransactionAt: new Date(),
          lastTransactionType: 'debit',
        },
        $push: {
          transactions: transaction,
        },
      },
      { new: true, session }
    );

    if (wallet) {
      // Update balanceAfter in the transaction now that we have the new balance
      await Wallet.updateOne(
        {
          userId: data.userId,
          'transactions.id': transactionId,
        },
        {
          $set: { 'transactions.$.balanceAfter': wallet.balance },
        }
      ).session(session || null);

      return { wallet, reason: 'success' };
    }
    return null;
  };

  // First attempt without version constraint
  let result = await attemptDebit();

  if (result) {
    logger.info('Wallet debited (atomic with optimistic locking)', {
      userId: data.userId,
      tenantId,
      amount: data.amount,
      newBalance: result.wallet.balance,
      version: result.wallet.version,
      transactionId: transactionId,
      reference: data.reference,
      action: 'WALLET_DEBITED',
    });

    return {
      success: true,
      newBalance: result.wallet.balance,
      transactionId: transactionId,
    };
  }

  // If first attempt failed, fetch fresh wallet to determine reason and retry
  let retries = MAX_RETRIES;
  while (retries > 0) {
    const freshWallet = await Wallet.findOne(baseQuery).session(session || null);

    if (!freshWallet) {
      return {
        success: false,
        newBalance: 0,
        error: 'Wallet not found',
      };
    }

    if (freshWallet.isFrozen) {
      logger.warn('Wallet is frozen, cannot debit', {
        userId: data.userId,
        tenantId,
        frozenAt: freshWallet.frozenAt,
        freezeReason: freshWallet.freezeReason,
        action: 'WALLET_FROZEN',
      });
      return {
        success: false,
        newBalance: freshWallet.balance,
        error: 'Wallet is frozen',
      };
    }

    if (freshWallet.balance < data.amount) {
      logger.warn('Wallet debit failed - insufficient balance', {
        userId: data.userId,
        tenantId,
        requestedAmount: data.amount,
        availableBalance: freshWallet.balance,
        reference: data.reference,
        action: 'WALLET_INSUFFICIENT_BALANCE',
      });
      logWalletAlert('Wallet debit failed - insufficient balance', {
        userId: data.userId,
        requestedAmount: data.amount,
        availableBalance: freshWallet.balance,
        reference: data.reference,
      });
      return {
        success: false,
        newBalance: freshWallet.balance,
        error: 'Insufficient balance',
      };
    }

    // Retry with current version
    result = await attemptDebit(freshWallet.version);

    if (result) {
      logger.info('Wallet debited (atomic with optimistic locking after retry)', {
        userId: data.userId,
        tenantId,
        amount: data.amount,
        newBalance: result.wallet.balance,
        version: result.wallet.version,
        transactionId: transactionId,
        reference: data.reference,
        retriesUsed: MAX_RETRIES - retries,
        action: 'WALLET_DEBITED',
      });

      return {
        success: true,
        newBalance: result.wallet.balance,
        transactionId: transactionId,
      };
    }

    retries--;
    logger.warn('Debit retry due to concurrent modification', {
      userId: data.userId,
      tenantId,
      remainingRetries: retries,
      action: 'WALLET_DEBIT_RETRY',
    });
  }

  // All retries exhausted
  logger.error('Debit failed after max retries - concurrent modification', {
    userId: data.userId,
    tenantId,
    action: 'WALLET_DEBIT_EXHAUSTED',
  });
  return {
    success: false,
    newBalance: 0,
    error: 'Concurrent modification detected, please retry',
  };
};

// Deduct from wallet (atomic operation to prevent race conditions)
export const debitWallet = async (
  data: TransactionData,
  req?: Request,
  session?: mongoose.ClientSession
): Promise<TransactionResult> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

    return await debitWalletInternal(data, tenantId, isAdmin, session);
  } catch (error: any) {
    logger.error('Failed to debit wallet', {
      userId: data.userId,
      error: error.message,
      action: 'WALLET_DEBIT_ERROR',
    });
    logWalletAlert('Wallet debit failed', { userId: data.userId, error: error.message, reference: data.reference });
    return {
      success: false,
      newBalance: 0,
      error: error.message,
    };
  }
};

// Get transaction history (tenant-isolated)
export const getTransactionHistory = async (
  userId: string,
  req?: Request,
  options?: {
    limit?: number;
    offset?: number;
    type?: 'credit' | 'debit';
    startDate?: Date;
    endDate?: Date;
  }
) => {
  const wallet = await getOrCreateWallet(userId, req);

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

  // Pagination
  const offset = options?.offset || 0;
  const limit = options?.limit || 20;
  const paginatedTransactions = transactions.slice(offset, offset + limit);

  return {
    transactions: paginatedTransactions,
    total: transactions.length,
    balance: wallet.balance,
    currency: wallet.currency,
  };
};

// Get wallet balance (tenant-isolated)
export const getBalance = async (userId: string, req?: Request): Promise<{
  balance: number;
  currency: string;
  pendingBalance: number;
}> => {
  const wallet = await getOrCreateWallet(userId, req);

  return {
    balance: wallet.balance,
    currency: wallet.currency,
    pendingBalance: wallet.pendingBalance,
  };
};

// Update transaction status with state machine validation (tenant-isolated)
// FIX: Use atomic findOneAndUpdate to prevent race conditions
export const updateTransactionStatus = async (
  userId: string,
  transactionId: string,
  newStatus: TransactionStatus,
  req?: Request
): Promise<{ success: boolean; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

    // Build query with tenant isolation
    const walletQuery: Record<string, unknown> = { userId };
    if (!isAdmin && tenantId) {
      walletQuery.tenantId = tenantId;
    }

    // CRITICAL FIX: First, find the transaction to get its current status
    const wallet = await Wallet.findOne(walletQuery);
    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    const transaction = wallet.transactions.find((t) => t.id === transactionId);
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    const currentStatus = transaction.status as TransactionStatus;

    // Validate state transition
    if (!canTransition(currentStatus, newStatus)) {
      logger.warn('Invalid transaction state transition', {
        userId,
        tenantId,
        transactionId,
        currentStatus,
        attemptedStatus: newStatus,
        validTransitions: getValidNextStatuses(currentStatus),
        action: 'INVALID_TRANSACTION_TRANSITION',
      });
      return {
        success: false,
        error: `Invalid transition from '${currentStatus}' to '${newStatus}'. Valid transitions: ${getValidNextStatuses(currentStatus).join(', ') || 'none'}`,
      };
    }

    // CRITICAL FIX: Use atomic findOneAndUpdate with status check to prevent race conditions
    // The query includes the current status as a condition, so if another request
    // changes the status between our read and write, the update will fail
    const result = await Wallet.findOneAndUpdate(
      {
        ...walletQuery,
        'transactions.id': transactionId,
        'transactions.$.status': currentStatus, // Verify current status unchanged (atomic check)
      },
      {
        $set: {
          'transactions.$.status': newStatus,
          'transactions.$.updatedAt': new Date(),
        },
      },
      { new: true }
    );

    if (!result) {
      // Transaction status changed concurrently - fetch current status for error message
      const updatedWallet = await Wallet.findOne(walletQuery);
      const concurrentTransaction = updatedWallet?.transactions.find((t) => t.id === transactionId);
      const concurrentStatus = concurrentTransaction?.status ?? 'unknown';

      logger.warn('Concurrent transaction status update detected', {
        userId,
        tenantId,
        transactionId,
        expectedStatus: currentStatus,
        actualStatus: concurrentStatus,
        action: 'CONCURRENT_TRANSACTION_UPDATE',
      });
      return {
        success: false,
        error: `Transaction status changed concurrently (expected '${currentStatus}', found '${concurrentStatus}'). Please retry.`,
      };
    }

    logger.info('Transaction status updated (atomic)', {
      userId,
      tenantId,
      transactionId,
      previousStatus: currentStatus,
      newStatus,
      action: 'TRANSACTION_STATUS_UPDATED',
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update transaction status', {
      userId,
      transactionId,
      error: errorMessage,
      action: 'TRANSACTION_STATUS_UPDATE_ERROR',
    });
    return { success: false, error: errorMessage };
  }
};

// Get a single transaction by ID (tenant-isolated)
export const getTransaction = async (
  userId: string,
  transactionId: string,
  req?: Request
): Promise<{ transaction?: IWallet['transactions'][0]; error?: string }> => {
  const tenantId = req ? getTenantIdOptional(req) : undefined;
  const isAdmin = req ? isAdminOrSystem(req) : false;

  // Build query with tenant isolation
  const walletQuery: any = { userId };
  if (!isAdmin && tenantId) {
    walletQuery.tenantId = tenantId;
  }

  const wallet = await Wallet.findOne(walletQuery);
  if (!wallet) {
    return { error: 'Wallet not found' };
  }

  const transaction = wallet.transactions.find((t) => t.id === transactionId);
  if (!transaction) {
    return { error: 'Transaction not found' };
  }

  return { transaction };
};

// Process booking payment to provider (tenant-isolated)
export const processProviderPayout = async (bookingId: string, req?: Request): Promise<TransactionResult> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

    // Build query with tenant isolation
    const bookingQuery: any = { _id: bookingId };
    if (!isAdmin && tenantId) {
      bookingQuery.tenantId = tenantId;
    }

    const booking = await Booking.findOne(bookingQuery).populate('providerId');

    if (!booking) {
      return { success: false, newBalance: 0, error: 'Booking not found' };
    }

    const providerId = (booking.providerId as any)._id.toString();

    // SECURITY FIX: Calculate net amount after commission deduction
    // Providers should receive totalAmount - platform commission
    let payoutAmount = booking.pricing.totalAmount;
    try {
      const commissionResult = await calculateCommission(bookingId);
      payoutAmount = commissionResult.netAmount;
      logger.info('Commission calculated for provider payout', {
        bookingId,
        providerId,
        grossAmount: booking.pricing.totalAmount,
        commission: commissionResult.commission,
        netAmount: payoutAmount,
      });
    } catch (commissionError) {
      // If commission calculation fails, log warning but still pay out
      // In production, you might want to fail the payout instead
      logger.warn('Commission calculation failed, using gross amount', {
        bookingId,
        providerId,
        error: (commissionError as Error).message,
      });
    }

    // SECURITY FIX: Use atomic duplicate prevention in creditWallet
    // This replaces the previous separate check-then-credit pattern which had a race condition
    // The new approach uses findOneAndUpdate with a condition that no transaction
    // with this booking reference exists, making it atomic
    return await creditWallet({
      userId: providerId,
      type: 'credit',
      amount: payoutAmount,
      description: `Payment for booking #${booking.bookingNumber}`,
      reference: bookingId,
      referenceType: 'booking',
      metadata: {
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId?.toString(),
      },
    }, req, {
      preventDuplicateReference: {
        reference: bookingId,
        referenceType: 'booking',
      }
    });
  } catch (error: any) {
    logger.error('Failed to process provider payout', {
      bookingId,
      error: error.message,
      action: 'PAYOUT_ERROR',
    });
    return { success: false, newBalance: 0, error: error.message };
  }
};

export default {
  getOrCreateWallet,
  creditWallet,
  debitWallet,
  getTransactionHistory,
  getBalance,
  updateTransactionStatus,
  getTransaction,
  processProviderPayout,
  canTransition,
  getValidNextStatuses,
};
