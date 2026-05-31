import { Request, Response } from 'express';
import {
  getCashbackBalance,
  getCashbackHistory,
  getExpiringCashback,
  redeemCashbackToWallet,
  getCashbackStats,
} from '../services/cashback.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';

const redeemSchema = Joi.object({
  cashbackIds: Joi.array().items(Joi.string()).min(1).required(),
});

export const getBalance = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const result = await getCashbackBalance(user._id.toString(), req);

  res.json({
    success: true,
    data: result,
  });
});

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page = '1', limit = '20', source, status, startDate, endDate } = req.query;

  const result = await getCashbackHistory(user._id.toString(), req, {
    limit: parseInt(limit as string, 10),
    offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
    source: source as string,
    status: status as string,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
  });

  res.json({
    success: true,
    data: {
      cashbacks: result.cashbacks,
      total: result.total,
      balance: result.balance,
      page: parseInt(page as string, 10),
      pages: Math.ceil(result.total / parseInt(limit as string, 10)),
    },
  });
});

export const getExpiring = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { days = '7' } = req.query;

  const cashbacks = await getExpiringCashback(
    user._id.toString(),
    req,
    parseInt(days as string, 10)
  );

  res.json({
    success: true,
    data: { cashbacks },
  });
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const stats = await getCashbackStats(user._id.toString(), req);

  res.json({
    success: true,
    data: stats,
  });
});

export const redeem = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = redeemSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  if (value.cashbackIds.length === 0) {
    throw new ApiError(400, 'Please select at least one cashback to redeem');
  }

  const result = await redeemCashbackToWallet(user._id.toString(), value.cashbackIds, req);

  if (!result.success) {
    throw new ApiError(400, result.error || 'Failed to redeem cashback');
  }

  res.json({
    success: true,
    message: `Successfully redeemed ${value.cashbackIds.length} cashback entries`,
    data: {
      totalRedeemed: result.totalRedeemed,
      transactionId: result.transactionId,
    },
  });
});

export default {
  getBalance,
  getHistory,
  getExpiring,
  getStats,
  redeem,
};
