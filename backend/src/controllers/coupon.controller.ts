import { Request, Response } from 'express';
import Coupon, { ICoupon } from '../models/coupon.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';
import mongoose from 'mongoose';
import logger from '../utils/logger';

/**
 * Validation Schemas
 */
const createCouponSchema = Joi.object({
  code: Joi.string().required().min(3).max(50).uppercase(),
  type: Joi.string().required().valid('percentage', 'fixed', 'free_service'),
  value: Joi.number().required().min(0),
  maxDiscount: Joi.number().min(0).optional(),
  minOrderAmount: Joi.number().min(0).default(0),
  currency: Joi.string().default('AED'),
  usageLimit: Joi.number().integer().min(1).default(1),
  maxUsesPerUser: Joi.number().integer().min(1).default(1),
  validFrom: Joi.date().iso().required(),
  validUntil: Joi.date().iso().greater(Joi.ref('validFrom')).required(),
  applicableCategories: Joi.array().items(Joi.string()).optional(),
  applicableServices: Joi.array().items(Joi.string()).optional(),
  title: Joi.string().required().min(3).max(100),
  description: Joi.string().max(500).optional(),
  displayTitle: Joi.string().max(100).optional(),
  displaySubtitle: Joi.string().max(200).optional(),
  displayGradient: Joi.string().optional(),
  displayBadge: Joi.string().valid('Limited Time', 'New', 'Popular', 'Hot').optional(),
  imageUrl: Joi.string().uri().optional(),
  featured: Joi.boolean().default(false),
  claimExpiresInDays: Joi.number().integer().min(1).max(365).optional(),
});

const updateCouponSchema = Joi.object({
  code: Joi.string().min(3).max(50).uppercase(),
  type: Joi.string().valid('percentage', 'fixed', 'free_service'),
  value: Joi.number().min(0),
  maxDiscount: Joi.number().min(0).allow(null),
  minOrderAmount: Joi.number().min(0),
  currency: Joi.string(),
  usageLimit: Joi.number().integer().min(1),
  maxUsesPerUser: Joi.number().integer().min(1),
  validFrom: Joi.date().iso(),
  validUntil: Joi.date().iso(),
  applicableCategories: Joi.array().items(Joi.string()).optional(),
  applicableServices: Joi.array().items(Joi.string()).optional(),
  title: Joi.string().min(3).max(100),
  description: Joi.string().max(500).allow(''),
  displayTitle: Joi.string().max(100).allow(''),
  displaySubtitle: Joi.string().max(200).allow(''),
  displayGradient: Joi.string().allow(''),
  displayBadge: Joi.string().valid('Limited Time', 'New', 'Popular', 'Hot').allow(''),
  imageUrl: Joi.string().uri().allow(''),
  featured: Joi.boolean(),
  claimExpiresInDays: Joi.number().integer().min(1).max(365),
  isActive: Joi.boolean(),
});

/**
 * GET /api/admin/coupons - List all coupons
 */
export const getAllCoupons = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '20',
    search,
    isActive,
    type,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Build filter
  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
    ];
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  if (type) {
    filter.type = type;
  }

  const status = req.query.status as string | undefined;
  const now = new Date();
  if (status === 'expired') {
    filter.validUntil = { $lt: now };
  } else if (status === 'scheduled') {
    filter.validFrom = { $gt: now };
  } else if (status === 'live') {
    filter.isActive = true;
    filter.validFrom = { $lte: now };
    filter.validUntil = { $gte: now };
  }

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sort: Record<string, 1 | -1> = {
    [sortBy as string]: sortOrder === 'asc' ? 1 : -1,
  };

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'firstName lastName email'),
    Coupon.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      coupons,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

/**
 * POST /api/admin/coupons - Create a new coupon
 */
export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createCouponSchema.validate(req.body);

  if (error) {
    throw ApiError.badRequest(
      error.details[0].message,
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Check for duplicate code
  const existingCoupon = await Coupon.findOne({ code: value.code });
  if (existingCoupon) {
    throw ApiError.conflict('Coupon code already exists', ERROR_CODES.DUPLICATE_ENTRY);
  }

  const {
    usageLimit,
    minOrderAmount,
    applicableServices,
    applicableCategories,
    ...rest
  } = value;

  const serviceIds: string[] = applicableServices || [];
  const categoryIds: string[] = applicableCategories || [];

  const coupon = new Coupon({
    ...rest,
    minOrderValue: minOrderAmount ?? 0,
    maxUses: usageLimit,
    maxUsesPerUser: value.maxUsesPerUser ?? 1,
    currentUses: 0,
    usedBy: [],
    targetServices: serviceIds.map((id: string) => new mongoose.Types.ObjectId(id)),
    targetCategories: categoryIds.map((id: string) => new mongoose.Types.ObjectId(id)),
    targetType: serviceIds.length > 0 ? 'specific_services' : 'all',
    applicableServices: serviceIds,
    applicableCategories: categoryIds,
    createdBy: (req as any).user._id,
  });

  await coupon.save();

  logger.info('Coupon created', {
    action: 'COUPON_CREATED',
    couponId: coupon._id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    createdBy: (req as any).user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Coupon created successfully',
    data: { coupon },
  });
});

/**
 * GET /api/admin/coupons/:id - Get coupon by ID
 */
export const getCouponById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid coupon ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const coupon = await Coupon.findById(id)
    .populate('createdBy', 'firstName lastName email');

  if (!coupon) {
    throw ApiError.notFound('Coupon not found', ERROR_CODES.NOT_FOUND);
  }

  res.json({
    success: true,
    data: { coupon },
  });
});

/**
 * PUT /api/admin/coupons/:id - Update a coupon
 */
export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid coupon ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const { error, value } = updateCouponSchema.validate(req.body);

  if (error) {
    throw ApiError.badRequest(
      error.details[0].message,
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // If updating code, check for duplicates
  if (value.code) {
    const existingCoupon = await Coupon.findOne({
      code: value.code,
      _id: { $ne: id },
    });
    if (existingCoupon) {
      throw ApiError.conflict('Coupon code already exists', ERROR_CODES.DUPLICATE_ENTRY);
    }
  }

  const updatePayload: Record<string, unknown> = { ...value };

  if (value.usageLimit !== undefined) {
    updatePayload.maxUses = value.usageLimit;
    delete updatePayload.usageLimit;
  }
  if (value.minOrderAmount !== undefined) {
    updatePayload.minOrderValue = value.minOrderAmount;
    delete updatePayload.minOrderAmount;
  }
  if (value.applicableServices !== undefined) {
    const serviceIds: string[] = value.applicableServices || [];
    updatePayload.targetServices = serviceIds.map((sid: string) => new mongoose.Types.ObjectId(sid));
    updatePayload.targetType = serviceIds.length > 0 ? 'specific_services' : 'all';
    updatePayload.applicableServices = serviceIds;
  }
  if (value.applicableCategories !== undefined) {
    const categoryIds: string[] = value.applicableCategories || [];
    updatePayload.targetCategories = categoryIds.map((cid: string) => new mongoose.Types.ObjectId(cid));
    updatePayload.applicableCategories = categoryIds;
  }

  const coupon = await Coupon.findByIdAndUpdate(
    id,
    { $set: updatePayload },
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName email');

  if (!coupon) {
    throw ApiError.notFound('Coupon not found', ERROR_CODES.NOT_FOUND);
  }

  logger.info('Coupon updated', {
    action: 'COUPON_UPDATED',
    couponId: coupon._id,
    code: coupon.code,
    updatedBy: (req as any).user._id,
    fields: Object.keys(value),
  });

  res.json({
    success: true,
    message: 'Coupon updated successfully',
    data: { coupon },
  });
});

/**
 * DELETE /api/admin/coupons/:id - Delete a coupon
 */
export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid coupon ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const coupon = await Coupon.findByIdAndDelete(id);

  if (!coupon) {
    throw ApiError.notFound('Coupon not found', ERROR_CODES.NOT_FOUND);
  }

  logger.info('Coupon deleted', {
    action: 'COUPON_DELETED',
    couponId: id,
    code: coupon.code,
    deletedBy: (req as any).user._id,
  });

  res.json({
    success: true,
    message: 'Coupon deleted successfully',
  });
});

/**
 * POST /api/admin/coupons/:id/deactivate - Deactivate a coupon
 */
export const deactivateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid coupon ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const coupon = await Coupon.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true }
  ).populate('createdBy', 'firstName lastName email');

  if (!coupon) {
    throw ApiError.notFound('Coupon not found', ERROR_CODES.NOT_FOUND);
  }

  logger.info('Coupon deactivated', {
    action: 'COUPON_DEACTIVATED',
    couponId: coupon._id,
    code: coupon.code,
    deactivatedBy: (req as any).user._id,
  });

  res.json({
    success: true,
    message: 'Coupon deactivated successfully',
    data: { coupon },
  });
});

/**
 * GET /api/admin/coupons/stats - Get coupon statistics
 */
export const getCouponStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await Coupon.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        totalUses: { $sum: '$currentUses' },
        percentageCoupons: {
          $sum: { $cond: [{ $eq: ['$type', 'percentage'] }, 1, 0] },
        },
        fixedCoupons: {
          $sum: { $cond: [{ $eq: ['$type', 'fixed'] }, 1, 0] },
        },
        freeServiceCoupons: {
          $sum: { $cond: [{ $eq: ['$type', 'free_service'] }, 1, 0] },
        },
        featured: {
          $sum: { $cond: ['$featured', 1, 0] },
        },
      },
    },
  ]);

  const result = stats[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    totalUses: 0,
    percentageCoupons: 0,
    fixedCoupons: 0,
    freeServiceCoupons: 0,
    featured: 0,
  };

  res.json({
    success: true,
    data: {
      stats: {
        total: result.total,
        active: result.active,
        inactive: result.inactive,
        totalUses: result.totalUses,
        byType: {
          percentage: result.percentageCoupons,
          fixed: result.fixedCoupons,
          free_service: result.freeServiceCoupons,
        },
        featured: result.featured,
      },
    },
  });
});
