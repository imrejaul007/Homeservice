import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';

/**
 * Validates :providerId route param is a valid MongoDB ObjectId.
 */
export function validateProviderIdParam(req: Request, _res: Response, next: NextFunction) {
  const { providerId } = req.params;
  if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
    return next(new ApiError(400, 'Invalid provider ID'));
  }
  next();
}
