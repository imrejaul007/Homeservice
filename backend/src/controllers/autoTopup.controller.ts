import { Request, Response } from 'express';
import {
  getAutoTopupConfig,
  configureAutoTopup,
  toggleAutoTopup,
  getAutoTopupHistory,
  previewNextTopup,
} from '../services/autoTopup.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';

const configSchema = Joi.object({
  enabled: Joi.boolean().required(),
  thresholdAmount: Joi.number().min(0).required(),
  topupAmount: Joi.number().min(1).required(),
  paymentMethodId: Joi.string().required(),
  paymentMethodType: Joi.string().valid('card', 'bank_account', 'wallet').required(),
  paymentMethodLast4: Joi.string(),
  paymentMethodBrand: Joi.string(),
  maxAutoTopupsPerMonth: Joi.number().min(1).max(30).default(5),
  maxAutoTopupAmount: Joi.number().min(10).max(5000).default(500),
});

const toggleSchema = Joi.object({
  enabled: Joi.boolean().required(),
});

export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const config = await getAutoTopupConfig(user._id.toString(), req);

  if (!config) {
    res.json({
      success: true,
      data: {
        configured: false,
        config: null,
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      configured: true,
      config,
    },
  });
});

export const updateConfig = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = configSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const result = await configureAutoTopup(user._id.toString(), value, req);

  if (!result.success) {
    throw new ApiError(400, result.error || 'Failed to configure auto-topup');
  }

  res.json({
    success: true,
    message: 'Auto-topup configured successfully',
  });
});

export const toggle = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { error, value } = toggleSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const result = await toggleAutoTopup(user._id.toString(), value.enabled, req);

  if (!result.success) {
    throw new ApiError(400, result.error || 'Failed to toggle auto-topup');
  }

  res.json({
    success: true,
    message: `Auto-topup ${value.enabled ? 'enabled' : 'disabled'} successfully`,
  });
});

export const history = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page = '1', limit = '20' } = req.query;

  const result = await getAutoTopupHistory(user._id.toString(), req, {
    limit: parseInt(limit as string, 10),
    offset: (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10),
  });

  res.json({
    success: true,
    data: {
      logs: result.logs,
      total: result.total,
      page: parseInt(page as string, 10),
      pages: Math.ceil(result.total / parseInt(limit as string, 10)),
    },
  });
});

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const preview = await previewNextTopup(user._id.toString(), req);

  res.json({
    success: true,
    data: preview,
  });
});

export default {
  getConfig,
  updateConfig,
  toggle,
  history,
  preview,
};
