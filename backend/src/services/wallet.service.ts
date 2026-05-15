import Wallet, { IWallet } from '../models/wallet.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';

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

// Create or get wallet for user
export const getOrCreateWallet = async (userId: string): Promise<IWallet> => {
  let wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    wallet = await Wallet.create({
      userId,
      balance: 0,
      currency: 'AED',
      transactions: [],
      pendingBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
    });

    logger.info('Wallet created', { userId, action: 'WALLET_CREATED' });
  }

  return wallet;
};

// Add credit to wallet
export const creditWallet = async (data: TransactionData): Promise<TransactionResult> => {
  try {
    const wallet = await getOrCreateWallet(data.userId);

    const transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'credit' as const,
      amount: data.amount,
      description: data.description,
      reference: data.reference,
      referenceType: data.referenceType,
      status: 'completed' as const,
      balanceAfter: wallet.balance + data.amount,
      metadata: data.metadata,
      createdAt: new Date(),
    };

    wallet.transactions.push(transaction);
    wallet.balance += data.amount;
    wallet.totalEarned += data.amount;

    await wallet.save();

    logger.info('Wallet credited', {
      userId: data.userId,
      amount: data.amount,
      newBalance: wallet.balance,
      reference: data.reference,
      action: 'WALLET_CREDITED',
    });

    return {
      success: true,
      newBalance: wallet.balance,
      transactionId: transaction.id,
    };
  } catch (error: any) {
    logger.error('Failed to credit wallet', {
      userId: data.userId,
      error: error.message,
      action: 'WALLET_CREDIT_ERROR',
    });
    return {
      success: false,
      newBalance: 0,
      error: error.message,
    };
  }
};

// Deduct from wallet (atomic operation to prevent race conditions)
export const debitWallet = async (data: TransactionData): Promise<TransactionResult> => {
  try {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

    // Use atomic findOneAndUpdate with balance check to prevent race conditions
    const wallet = await Wallet.findOneAndUpdate(
      {
        userId: data.userId,
        balance: { $gte: data.amount } // Atomic condition check
      },
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
      const currentWallet = await Wallet.findOne({ userId: data.userId });
      const balance = currentWallet?.balance ?? 0;

      logger.warn('Wallet debit failed - insufficient balance', {
        userId: data.userId,
        requestedAmount: data.amount,
        availableBalance: balance,
        reference: data.reference,
        action: 'WALLET_INSUFFICIENT_BALANCE',
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
    return {
      success: false,
      newBalance: 0,
      error: error.message,
    };
  }
};

// Get transaction history
export const getTransactionHistory = async (
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    type?: 'credit' | 'debit';
    startDate?: Date;
    endDate?: Date;
  }
) => {
  const wallet = await getOrCreateWallet(userId);

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

// Get wallet balance
export const getBalance = async (userId: string): Promise<{
  balance: number;
  currency: string;
  pendingBalance: number;
}> => {
  const wallet = await getOrCreateWallet(userId);

  return {
    balance: wallet.balance,
    currency: wallet.currency,
    pendingBalance: wallet.pendingBalance,
  };
};

// Process booking payment to provider
export const processProviderPayout = async (bookingId: string): Promise<TransactionResult> => {
  try {
    const booking = await Booking.findById(bookingId).populate('providerId');

    if (!booking) {
      return { success: false, newBalance: 0, error: 'Booking not found' };
    }

    const providerId = (booking.providerId as any)._id.toString();
    const payoutAmount = booking.pricing.totalAmount; // This would be net of commission

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
  processProviderPayout,
};
