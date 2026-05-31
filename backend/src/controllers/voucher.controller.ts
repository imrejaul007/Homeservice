import { Request, Response } from 'express';
import {
  validateVoucher,
  applyVoucherToBooking,
  getAvailableVouchers,
  getVoucherHistory,
  getExpiringVouchers,
} from '../services/voucher.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';

const validateSchema = Joi.object({
  code: Joi.string().required(),
  orderAmount: Joi.number().min(0),
});

const applySchema = Joi.object({
  code: Joi.string().required(),
  bookingId: Joi.string().required(),
});

export const validate = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = validateSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const result = await validateVoucher(value.code, user._id.toString(), value.orderAmount, req);

  if (!result.valid) {
    throw new ApiError(400, result.error || 'Invalid voucher');
  }

  res.json({
    success: true,
    data: {
      valid: true,
      voucher: {
        code: result.voucher?.code,
        name: result.voucher?.name,
        description: result.voucher?.description,
        type: result.voucher?.type,
        discountValue: result.voucher?.discountValue,
        maxDiscount: result.voucher?.maxDiscount,
        currency: result.voucher?.currency,
        validUntil: result.voucher?.validUntil,
      },
      discount: result.discount,
    },
  });
});

export const apply = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = applySchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const result = await applyVoucherToBooking(value.code, user._id.toString(), value.bookingId, req);

  if (!result.success) {
    throw new ApiError(400, result.error || 'Failed to apply voucher');
  }

  res.json({
    success: true,
    message: 'Voucher applied successfully',
    data: {
      discount: result.discount,
      usageId: result.usageId,
    },
  });
});

export const listAvailable = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page = '1', limit = '20' } = req.query;

  const result = await getAvailableVouchers(user._id.toString(), req, {
    limit: parseInt(limit as string, 10),
    offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
  });

  res.json({
    success: true,
    data: {
      vouchers: result.vouchers,
      total: result.total,
      page: parseInt(page as string, 10),
      pages: Math.ceil(result.total / parseInt(limit as string, 10)),
    },
  });
});

export const history = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page = '1', limit = '20' } = req.query;

  const result = await getVoucherHistory(user._id.toString(), req, {
    limit: parseInt(limit as string, 10),
    offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
  });

  res.json({
    success: true,
    data: {
      usages: result.usages,
      total: result.total,
      page: parseInt(page as string, 10),
      pages: Math.ceil(result.total / parseInt(limit as string, 10)),
    },
  });
});

export const expiring = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { days = '7' } = req.query;

  const vouchers = await getExpiringVouchers(user._id.toString(), req, parseInt(days as string, 10));

  res.json({
    success: true,
    data: { vouchers },
  });
});

export default {
  validate,
  apply,
  listAvailable,
  history,
  expiring,
};
