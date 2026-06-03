import { Request, Response } from 'express';
import { getOrCreateWallet, creditWallet, debitWallet } from '../services/wallet.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { getSettings } from '../services/settings.service';
import Joi from 'joi';
import { getSocketServer } from '../socket';
import logger from '../utils/logger';
import Wallet from '../models/wallet.model';
import crypto from 'crypto';

// Default withdrawal hold period in hours (24 hours)
const DEFAULT_WITHDRAWAL_HOLD_HOURS = 24;

// FIX #5: Withdrawal limits - defined but not used before
const MAX_WITHDRAWAL_AMOUNT = 50000; // Maximum single withdrawal: AED 50,000
const MINIMUM_BALANCE_RESERVE = 0; // Minimum balance to maintain after withdrawal (AED 0 = no reserve)

const withdrawSchema = Joi.object({
  amount: Joi.number().min(1).required(),
  bankAccount: Joi.object({
    bankName: Joi.string().required(),
    accountNumber: Joi.string().required(),
    iban: Joi.string().required(),
    accountHolder: Joi.string().required(),
  }).required(),
});

const addMoneySchema = Joi.object({
  amount: Joi.number().positive().min(0.01).required(),
  paymentMethodId: Joi.string().uuid().required(),
  idempotencyKey: Joi.string().max(100).optional(),
});

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const wallet = await getOrCreateWallet(user._id.toString());

  res.json({
    success: true,
    data: {
      balance: wallet.balance,
      currency: wallet.currency,
      pendingBalance: wallet.pendingBalance,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
    },
  });
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page = '1', limit = '20', type } = req.query;

  // Use aggregation pipeline for database-level pagination (performance optimization)
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.max(1, Math.min(parseInt(limit as string, 10), 100)); // Cap at 100, min at 1
  const skip = (pageNum - 1) * limitNum;

  // Build match stage for type filter
  const matchStage: any = {};
  if (type && typeof type === 'string') {
    matchStage['transactions.type'] = type;
  }

  const result = await Wallet.aggregate([
    { $match: { userId: user._id, isDeleted: { $ne: true } } },
    { $unwind: '$transactions' },
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
    // Get total count
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        transactions: { $push: '$transactions' },
      },
    },
    // Sort and paginate in memory (still more efficient than loading all)
    {
      $project: {
        _id: 0,
        total: 1,
        transactions: {
          $slice: [
            {
              $sortArray: {
                input: '$transactions',
                sortBy: { createdAt: -1 },
              },
            },
            skip,
            limitNum,
          ],
        },
      },
    },
  ]);

  // Fallback for empty result
  const data = result[0] || { total: 0, transactions: [] };

  res.json({
    success: true,
    data: {
      transactions: data.transactions,
      total: data.total,
      page: pageNum,
      pages: Math.ceil(data.total / limitNum),
    },
  });
});

export const requestWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = withdrawSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  // Validate withdrawal amount must be positive
  if (value.amount <= 0) {
    throw new ApiError(400, 'Withdrawal amount must be greater than zero');
  }

  // Get platform settings for minimum withdrawal amount
  const settings = await getSettings();
  const minimumWithdrawal = settings.minimumWithdrawalAmount || 50;

  // Validate against minimum withdrawal amount
  if (value.amount < minimumWithdrawal) {
    throw new ApiError(400, `Minimum withdrawal amount is AED ${minimumWithdrawal}`);
  }

  // FIX #5: Enforce maximum withdrawal amount limit
  if (value.amount > MAX_WITHDRAWAL_AMOUNT) {
    throw new ApiError(400, `Withdrawal amount exceeds maximum limit of AED ${MAX_WITHDRAWAL_AMOUNT}. Please enter a smaller amount.`);
  }

  // Get user's wallet
  const wallet = await getOrCreateWallet(user._id.toString());

  // CRITICAL FIX: Check actual balance (not just available balance) to prevent negative balance
  // The actual balance must be >= withdrawal amount
  if (value.amount > wallet.balance) {
    throw new ApiError(400, `Insufficient balance. Your balance is AED ${wallet.balance.toFixed(2)}. Please enter an amount less than or equal to your balance.`);
  }

  // Check sufficient available balance (balance minus pending)
  const availableBalance = wallet.balance - wallet.pendingBalance;
  if (value.amount > availableBalance) {
    throw new ApiError(400, `Insufficient available balance. Available balance: AED ${availableBalance.toFixed(2)} (includes AED ${wallet.pendingBalance.toFixed(2)} pending in other withdrawals).`);
  }

  // FIX #5: Enforce minimum balance reserve
  // After withdrawal, available balance must be >= MINIMUM_BALANCE_RESERVE
  const balanceAfterWithdrawal = availableBalance - value.amount;
  if (balanceAfterWithdrawal < MINIMUM_BALANCE_RESERVE) {
    throw new ApiError(400, `Withdrawal would leave balance below minimum reserve. Available after withdrawal: AED ${balanceAfterWithdrawal.toFixed(2)}, Minimum reserve: AED ${MINIMUM_BALANCE_RESERVE}.`);
  }

  // Create a unique reference for this withdrawal using cryptographically secure random
  const withdrawalReference = `wd_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

  // Initiate the withdrawal using the wallet service
  // For withdrawals, we use a different approach - create pending transaction
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Import the Wallet model directly to create a pending withdrawal transaction
    const Wallet = require('../models/wallet.model').default;

    const walletDoc = await Wallet.findOne({ userId: user._id.toString() }).session(session);

    if (!walletDoc) {
      throw new ApiError(404, 'Wallet not found');
    }

    // Check if wallet is frozen
    if ((walletDoc as any).isFrozen) {
      throw new ApiError(403, 'Wallet is frozen');
    }

    // CRITICAL FIX: Re-check actual balance within transaction to prevent race conditions
    // and ensure balance never goes negative
    if (value.amount > walletDoc.balance) {
      throw new ApiError(400, `Insufficient balance. Your balance is AED ${walletDoc.balance.toFixed(2)}. Please enter an amount less than or equal to your balance.`);
    }

    // Also check available balance (balance minus pending)
    const currentAvailableBalance = walletDoc.balance - walletDoc.pendingBalance;
    if (value.amount > currentAvailableBalance) {
      throw new ApiError(400, `Insufficient available balance. Available balance: AED ${currentAvailableBalance.toFixed(2)} (includes AED ${walletDoc.pendingBalance.toFixed(2)} pending in other withdrawals).`);
    }

    // HIGH PRIORITY FIX: Check minimum hold period for withdrawals
    // Find the most recent credit transaction (earnings from bookings) to check hold period
    const creditTransactions = walletDoc.transactions
      .filter((t: any) => t.type === 'credit' && t.referenceType === 'commission' && t.status === 'completed')
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (creditTransactions.length > 0) {
      const mostRecentCredit = creditTransactions[0];
      const creditTime = new Date(mostRecentCredit.createdAt).getTime();
      const now = Date.now();
      const holdPeriodMs = DEFAULT_WITHDRAWAL_HOLD_HOURS * 60 * 60 * 1000;

      // Check if the most recent earnings are still within the hold period
      if (now - creditTime < holdPeriodMs) {
        const hoursRemaining = Math.ceil((holdPeriodMs - (now - creditTime)) / (60 * 60 * 1000));
        throw new ApiError(400, `Withdrawal not allowed. New earnings have a 24-hour hold period for security. Please wait ${hoursRemaining} more hour(s) before withdrawing. You can withdraw AED ${(walletDoc.balance - walletDoc.pendingBalance - mostRecentCredit.amount).toFixed(2)} from your available balance.`);
      }
    }

    // Create pending withdrawal transaction
    const pendingTransaction = {
      id: withdrawalReference,
      type: 'debit' as const,
      amount: value.amount,
      description: `Withdrawal to ${value.bankAccount.bankName} (${value.bankAccount.accountNumber.slice(-4)})`,
      reference: withdrawalReference,
      referenceType: 'payout' as const,
      status: 'pending' as const, // Set to pending, will be 'processing' after admin approval
      balanceAfter: walletDoc.balance - value.amount,
      metadata: {
        bankAccount: {
          bankName: value.bankAccount.bankName,
          accountNumber: value.bankAccount.accountNumber,
          iban: value.bankAccount.iban,
          accountHolder: value.bankAccount.accountHolder,
        },
        requestedAt: new Date(),
        estimatedProcessingDays: 3,
      },
      createdAt: new Date(),
    };

    // Add to pending balance (funds are held but not yet deducted)
    walletDoc.pendingBalance += value.amount;

    // Add the pending transaction
    walletDoc.transactions.push(pendingTransaction);

    await walletDoc.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // Calculate new available balance (excluding pending)
    const newAvailableBalance = walletDoc.balance - walletDoc.pendingBalance;

    // FIX 4: Emit withdrawal:pending socket event to notify provider in real-time
    try {
      const socketServer = getSocketServer();
      if (socketServer) {
        // Emit to provider about pending withdrawal
        socketServer.emitToUser(user._id.toString(), 'withdrawal:pending', {
          withdrawalId: withdrawalReference,
          providerId: user._id.toString(), // Include providerId for filtering
          amount: value.amount,
          currency: 'AED',
          status: 'pending',
        });
        // FIX 1: Emit wallet:balance_updated showing pendingBalance increase
        socketServer.emitToUser(user._id.toString(), 'wallet:balance_updated', {
          userId: user._id.toString(),
          balance: walletDoc.balance,
          pendingBalance: walletDoc.pendingBalance,
          availableBalance: newAvailableBalance,
          currency: 'AED',
          change: {
            pendingBalance: value.amount,
            type: 'withdrawal_pending',
          },
        });

        logger.info('Emitted withdrawal:pending socket event', {
          withdrawalId: withdrawalReference,
          providerId: user._id.toString(),
          amount: value.amount,
          action: 'SOCKET_WITHDRAWAL_PENDING',
        });

        // Also emit to admins about new withdrawal request
        socketServer.emitNewWithdrawalRequest(
          withdrawalReference,
          user._id.toString(),
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Provider',
          value.amount,
          'AED'
        );
      }
    } catch (socketError) {
      // Don't fail the withdrawal request if socket emission fails
      logger.error('Failed to emit withdrawal:pending socket event', {
        withdrawalId: withdrawalReference,
        error: socketError instanceof Error ? socketError.message : String(socketError),
      });
    }

    res.json({
      success: true,
      data: {
        transactionId: withdrawalReference,
        amount: value.amount,
        currency: 'AED',
        status: 'pending',
        newBalance: walletDoc.balance,
        availableBalance: newAvailableBalance,
        pendingBalance: walletDoc.pendingBalance,
        bankAccount: {
          bankName: value.bankAccount.bankName,
          accountNumber: `****${value.bankAccount.accountNumber.slice(-4)}`,
        },
        estimatedProcessingTime: '2-3 business days',
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    await session.abortTransaction();

    // Check if it's an ApiError (which we throw intentionally)
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, `Failed to process withdrawal: ${error.message}`);
  } finally {
    session.endSession();
  }
});

export const getEarningsSummary = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { period = 'month' } = req.query;

  const wallet = await getOrCreateWallet(user._id.toString());

  // Calculate period dates
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  // Filter transactions for the period
  const periodTransactions = wallet.transactions.filter(
    t => new Date(t.createdAt) >= startDate && t.status === 'completed'
  );

  const earnings = periodTransactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const withdrawals = periodTransactions
    .filter(t => t.referenceType === 'payout')
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({
    success: true,
    data: {
      period,
      earnings,
      withdrawals,
      netEarnings: earnings - withdrawals,
      transactionCount: periodTransactions.length,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    },
  });
});

/**
 * Add money to wallet (top-up)
 */
export const addMoney = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = addMoneySchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const { amount, paymentMethodId, idempotencyKey } = value;

  // For now, simulate successful top-up
  // In production, this would integrate with Stripe/payment gateway
  const result = await creditWallet({
    userId: user._id.toString(),
    type: 'credit',
    amount,
    description: 'Wallet Top-up',
    reference: idempotencyKey || `topup-${Date.now()}`,
    referenceType: 'topup',
    metadata: {
      paymentMethodId,
      source: 'app',
    },
  });

  if (!result.success) {
    throw new ApiError(400, result.error || 'Failed to add money');
  }

  // FIX 2: Emit wallet:balance_updated after successful top-up
  try {
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitToUser(user._id.toString(), 'wallet:balance_updated', {
        userId: user._id.toString(),
        balance: result.newBalance,
        pendingBalance: 0, // Top-up doesn't affect pending balance
        availableBalance: result.newBalance,
        currency: 'AED',
        change: {
          balance: amount,
          type: 'topup',
        },
      });
      logger.info('Emitted wallet:balance_updated after top-up', {
        userId: user._id.toString(),
        amount,
        newBalance: result.newBalance,
        action: 'SOCKET_TOPUP_SUCCESS',
      });
    }
  } catch (socketError) {
    // Don't fail the top-up if socket emission fails
    logger.error('Failed to emit wallet:balance_updated after top-up', {
      userId: user._id.toString(),
      error: socketError instanceof Error ? socketError.message : String(socketError),
    });
  }

  res.json({
    success: true,
    message: 'Money added successfully',
    data: {
      transactionId: result.transactionId,
      newBalance: result.newBalance,
      amount,
    },
  });
});

export default {
  getWallet,
  getTransactions,
  requestWithdrawal,
  getEarningsSummary,
  addMoney,
};
