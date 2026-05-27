import { Request, Response } from 'express';
import { getOrCreateWallet, creditWallet, debitWallet } from '../services/wallet.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { getSettings } from '../services/settings.service';
import Joi from 'joi';

const withdrawSchema = Joi.object({
  amount: Joi.number().min(1).required(),
  bankAccount: Joi.object({
    bankName: Joi.string().required(),
    accountNumber: Joi.string().required(),
    iban: Joi.string().required(),
    accountHolder: Joi.string().required(),
  }).required(),
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

  const wallet = await getOrCreateWallet(user._id.toString());

  let transactions = [...wallet.transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Filter by type if specified
  if (type && typeof type === 'string') {
    transactions = transactions.filter(t => t.type === type);
  }

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedTransactions = transactions.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: {
      transactions: paginatedTransactions,
      total: transactions.length,
      page: pageNum,
      pages: Math.ceil(transactions.length / limitNum),
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

  // Get user's wallet
  const wallet = await getOrCreateWallet(user._id.toString());

  // Check sufficient balance
  const availableBalance = wallet.balance - wallet.pendingBalance;
  if (value.amount > availableBalance) {
    throw new ApiError(400, `Insufficient balance. Available balance: AED ${availableBalance.toFixed(2)}`);
  }

  // Create a unique reference for this withdrawal
  const withdrawalReference = `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully. Your funds will be processed within 2-3 business days.',
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
  const { amount, paymentMethodId, idempotencyKey } = req.body;

  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid amount');
  }

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
