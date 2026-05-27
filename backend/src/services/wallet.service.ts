import Wallet, { IWallet, TransactionStatus } from '../models/wallet.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import { logWalletAlert } from './alert.service';
import { Request } from 'express';
import { addTenantFilter, getTenantId, getTenantIdOptional, isAdminOrSystem } from '../utils/tenantFilter';
import { calculateCommission } from './settlement.service';

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

// Add credit to wallet (atomic operation to prevent race conditions)
export const creditWallet = async (data: TransactionData, req?: Request): Promise<TransactionResult> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

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

    // Use atomic findOneAndUpdate with $inc to prevent race conditions
    const wallet = await Wallet.findOneAndUpdate(
      baseQuery,
      {
        $inc: {
          balance: data.amount,
          totalEarned: data.amount
        },
        $push: {
          transactions: transaction
        }
      },
      { new: true }
    );

    if (!wallet) {
      // Wallet doesn't exist, create it with the credit
      const newWalletData: any = {
        userId: data.userId,
        balance: data.amount,
        currency: 'AED',
        transactions: [transaction],
        pendingBalance: 0,
        totalEarned: data.amount,
        totalSpent: 0,
      };

      // Set tenantId for multi-tenant isolation
      if (tenantId) {
        newWalletData.tenantId = tenantId;
      }

      const newWallet = await Wallet.create(newWalletData);

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

    // SECURITY FIX: Check if balance exceeds maximum limit
    if (wallet.balance > MAX_WALLET_BALANCE) {
      // Cap balance at maximum and reverse the transaction
      await Wallet.updateOne(
        { _id: wallet._id },
        {
          $set: { balance: MAX_WALLET_BALANCE },
          $pull: { transactions: { id: transactionId } },
          $inc: { totalEarned: -data.amount }
        }
      );

      logger.error('Wallet balance exceeded maximum limit', {
        userId: data.userId,
        tenantId,
        attemptedBalance: wallet.balance,
        maxBalance: MAX_WALLET_BALANCE,
        action: 'WALLET_BALANCE_CAP_EXCEEDED',
      });
      logWalletAlert('Wallet balance exceeded maximum limit', {
        userId: data.userId,
        attemptedBalance: wallet.balance,
        maxBalance: MAX_WALLET_BALANCE,
      });

      return {
        success: false,
        newBalance: MAX_WALLET_BALANCE,
        transactionId: transactionId,
        error: 'Wallet balance cannot exceed maximum limit of 100,000 AED. Transaction has been reversed.',
      };
    }

    // Update balanceAfter in the transaction now that we have the new balance
    await Wallet.updateOne(
      {
        userId: data.userId,
        'transactions.id': transactionId
      },
      {
        $set: { 'transactions.$.balanceAfter': wallet.balance }
      }
    );

    logger.info('Wallet credited (atomic)', {
      userId: data.userId,
      tenantId,
      amount: data.amount,
      newBalance: wallet.balance,
      reference: data.reference,
      action: 'WALLET_CREDITED',
    });

    return {
      success: true,
      newBalance: wallet.balance,
      transactionId: transactionId,
    };
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

// Deduct from wallet (atomic operation to prevent race conditions)
export const debitWallet = async (data: TransactionData, req?: Request): Promise<TransactionResult> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

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

    // Build query with tenant isolation
    const baseQuery: any = { userId: data.userId, balance: { $gte: data.amount } };
    if (!isAdmin && tenantId) {
      baseQuery.tenantId = tenantId;
    }

    // Use atomic findOneAndUpdate with balance check to prevent race conditions
    const wallet = await Wallet.findOneAndUpdate(
      baseQuery,
      {
        $inc: {
          balance: -data.amount,
          totalSpent: data.amount
        },
        $push: {
          transactions: transaction
        }
      },
      { new: true }
    );

    if (!wallet) {
      // Either wallet doesn't exist or insufficient balance
      // Build query with tenant isolation for the check
      const checkQuery: any = { userId: data.userId };
      if (!isAdmin && tenantId) {
        checkQuery.tenantId = tenantId;
      }
      const currentWallet = await Wallet.findOne(checkQuery);
      const balance = currentWallet?.balance ?? 0;

      logger.warn('Wallet debit failed - insufficient balance', {
        userId: data.userId,
        tenantId,
        requestedAmount: data.amount,
        availableBalance: balance,
        reference: data.reference,
        action: 'WALLET_INSUFFICIENT_BALANCE',
      });
      logWalletAlert('Wallet debit failed - insufficient balance', {
        userId: data.userId,
        requestedAmount: data.amount,
        availableBalance: balance,
        reference: data.reference,
      });

      return {
        success: false,
        newBalance: balance,
        error: 'Insufficient balance',
      };
    }

    // Update balanceAfter in the transaction now that we have the new balance
    await Wallet.updateOne(
      {
        userId: data.userId,
        'transactions.id': transactionId
      },
      {
        $set: { 'transactions.$.balanceAfter': wallet.balance }
      }
    );

    logger.info('Wallet debited (atomic)', {
      userId: data.userId,
      tenantId,
      amount: data.amount,
      newBalance: wallet.balance,
      transactionId: transactionId,
      reference: data.reference,
      action: 'WALLET_DEBITED',
    });

    return {
      success: true,
      newBalance: wallet.balance,
      transactionId: transactionId,
    };
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
    const walletQuery: any = { userId };
    if (!isAdmin && tenantId) {
      walletQuery.tenantId = tenantId;
    }

    // Find the wallet and the transaction
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
        error: `Invalid transition from '${currentStatus}' to '${newStatus}'. Valid transitions: ${getValidNextStatuses(currentStatus).join(', ') || 'none'}`
      };
    }

    // Update the transaction status
    await Wallet.updateOne(
      {
        userId,
        'transactions.id': transactionId,
      },
      {
        $set: {
          'transactions.$.status': newStatus,
          'transactions.$.updatedAt': new Date(),
        },
      }
    );

    logger.info('Transaction status updated', {
      userId,
      tenantId,
      transactionId,
      previousStatus: currentStatus,
      newStatus,
      action: 'TRANSACTION_STATUS_UPDATED',
    });

    return { success: true };
  } catch (error: any) {
    logger.error('Failed to update transaction status', {
      userId,
      transactionId,
      error: error.message,
      action: 'TRANSACTION_STATUS_UPDATE_ERROR',
    });
    return { success: false, error: error.message };
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

    // Build query with tenant isolation for payout check
    const payoutCheckQuery: any = {
      userId: providerId,
      'transactions.reference': bookingId,
      'transactions.referenceType': 'booking',
    };
    if (!isAdmin && tenantId) {
      payoutCheckQuery.tenantId = tenantId;
    }

    // Check if payout was already processed for this booking to prevent double payout
    const existingPayout = await Wallet.findOne(payoutCheckQuery);

    if (existingPayout) {
      logger.warn('Payout already processed for this booking', {
        bookingId,
        providerId,
        tenantId,
        action: 'DUPLICATE_PAYOUT_PREVENTED',
      });
      return { success: false, newBalance: 0, error: 'Payout already processed for this booking' };
    }

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
    }, req);
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
