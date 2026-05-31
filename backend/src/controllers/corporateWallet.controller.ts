import { Request, Response } from 'express';
import {
  getCorporateWallet,
  getTransactionHistory,
  getEmployeeSpending,
  getSpendingBreakdown,
  requestLimitIncrease,
} from '../services/corporateWallet.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';

const limitIncreaseSchema = Joi.object({
  requestedLimit: Joi.number().min(0).required(),
  reason: Joi.string().min(10).required(),
});

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const wallet = await getCorporateWallet(user._id.toString(), req);

  if (!wallet) {
    res.json({
      success: true,
      data: {
        hasCorporateWallet: false,
        wallet: null,
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      hasCorporateWallet: true,
      wallet,
    },
  });
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page = '1', limit = '20', type, startDate, endDate } = req.query;

  // First get the wallet
  const wallet = await getCorporateWallet(user._id.toString(), req);

  if (!wallet) {
    throw new ApiError(404, 'Corporate wallet not found');
  }

  const result = await getTransactionHistory(wallet.id, req, {
    limit: parseInt(limit as string, 10),
    offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
    type: type as string,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
  });

  res.json({
    success: true,
    data: {
      transactions: result.transactions,
      total: result.total,
      page: parseInt(page as string, 10),
      pages: Math.ceil(result.total / parseInt(limit as string, 10)),
    },
  });
});

export const getSpending = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const wallet = await getCorporateWallet(user._id.toString(), req);

  if (!wallet) {
    throw new ApiError(404, 'Corporate wallet not found');
  }

  const employeeSpending = await getEmployeeSpending(wallet.id, req);

  res.json({
    success: true,
    data: {
      employees: employeeSpending,
    },
  });
});

export const getBreakdown = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const wallet = await getCorporateWallet(user._id.toString(), req);

  if (!wallet) {
    throw new ApiError(404, 'Corporate wallet not found');
  }

  const breakdown = await getSpendingBreakdown(wallet.id, req);

  res.json({
    success: true,
    data: {
      breakdown,
    },
  });
});

export const requestIncrease = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = limitIncreaseSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const wallet = await getCorporateWallet(user._id.toString(), req);

  if (!wallet) {
    throw new ApiError(404, 'Corporate wallet not found');
  }

  const result = await requestLimitIncrease(wallet.id, value.requestedLimit, value.reason, req);

  if (!result.success) {
    throw new ApiError(400, result.error || 'Failed to request limit increase');
  }

  res.json({
    success: true,
    message: 'Limit increase request submitted successfully',
    data: {
      requestId: result.requestId,
    },
  });
});

export default {
  getWallet,
  getTransactions,
  getSpending,
  getBreakdown,
  requestIncrease,
};
