/**
 * Package Price Calculator Controller
 * Handles API endpoints for dynamic price calculation
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';
import {
  calculatePackagePrice,
  validateDiscountCode,
  getPriceEstimate,
  getPackageAddOns,
  getPackageDurationOptions,
  type AddOnSelection,
  type DurationSelection,
  type LocationDetails,
} from '../services/packagePriceCalculator.service';

// Validation schema for price calculation request
const priceCalculationSchema = Joi.object({
  packageId: Joi.string().required(),
  selectedServices: Joi.array().items(Joi.string()),
  selectedAddOns: Joi.array().items(
    Joi.object({
      id: Joi.string(),
      name: Joi.string().required(),
      price: Joi.number().min(0).required(),
      quantity: Joi.number().integer().min(1).default(1),
    })
  ).default([]),
  selectedDuration: Joi.object({
    duration: Joi.number().integer().min(15).required(),
    price: Joi.number().min(0).required(),
    label: Joi.string().required(),
  }),
  location: Joi.object({
    type: Joi.string().valid('customer_address', 'provider_location', 'online').required(),
    distance: Joi.number().min(0),
  }),
  discountCode: Joi.string().uppercase(),
  isPackage: Joi.boolean().default(true),
});

// Validation schema for discount code validation
const discountValidationSchema = Joi.object({
  code: Joi.string().required(),
  packageId: Joi.string().required(),
  subtotal: Joi.number().min(0).required(),
});

/**
 * Calculate package price with selected options
 * POST /api/packages/calculate-price
 */
export const calculatePrice = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = priceCalculationSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const tenantId = (req as any).tenantId;

  const result = await calculatePackagePrice({
    ...value,
    tenantId,
  });

  if (!result.success) {
    throw new ApiError(400, result.error || 'Failed to calculate price');
  }

  res.json({
    success: true,
    data: result.data,
  });
});

/**
 * Validate a discount code
 * POST /api/packages/validate-discount
 */
export const validateDiscount = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = discountValidationSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const tenantId = (req as any).tenantId;

  const result = await validateDiscountCode(
    value.code,
    value.packageId,
    value.subtotal,
    tenantId
  );

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Get base price estimate for a package
 * GET /api/packages/:id/estimate
 */
export const getEstimate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Package ID is required');
  }

  const tenantId = (req as any).tenantId;

  const result = await getPriceEstimate(id, tenantId);

  if (!result.success) {
    throw new ApiError(404, result.error || 'Package not found');
  }

  res.json({
    success: true,
    data: result.data,
  });
});

/**
 * Get available add-ons for a package
 * GET /api/packages/:id/addons
 */
export const getAddOns = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Package ID is required');
  }

  const tenantId = (req as any).tenantId;

  const result = await getPackageAddOns(id, tenantId);

  if (!result.success) {
    throw new ApiError(404, result.error || 'Package not found');
  }

  res.json({
    success: true,
    data: {
      addOns: result.addOns,
    },
  });
});

/**
 * Get available duration options for a package
 * GET /api/packages/:id/durations
 */
export const getDurations = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Package ID is required');
  }

  const tenantId = (req as any).tenantId;

  const result = await getPackageDurationOptions(id, tenantId);

  if (!result.success) {
    throw new ApiError(404, result.error || 'Package not found');
  }

  res.json({
    success: true,
    data: {
      durationOptions: result.durationOptions,
    },
  });
});

// Export all controller methods
export default {
  calculatePrice,
  validateDiscount,
  getEstimate,
  getAddOns,
  getDurations,
};
