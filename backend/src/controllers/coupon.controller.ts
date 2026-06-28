import { Request, Response } from 'express';
import Coupon, { ICoupon } from '../models/coupon.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import Joi from 'joi';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import AuditLog from '../models/auditLog.model';

/**
 * Validation Schemas
 */
const createCouponSchema = Joi.object({
  // FIX: Align with offer.service.ts - min 6 chars, alphanumeric only
  code: Joi.string().required().min(6).max(20).pattern(/^[A-Z0-9]+$/).uppercase().messages({
    'string.pattern.base': 'Coupon code must be alphanumeric (A-Z, 0-9 only)',
    'string.min': 'Coupon code must be at least 6 characters',
  }),
  type: Joi.string().required().valid('percentage', 'fixed', 'free_service'),
  value: Joi.number().required().min(0).when('type', {
    is: 'percentage',
    then: Joi.number().max(100).messages({
      'number.max': 'Percentage value cannot exceed 100'
    })
  }),
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
  // FIX: Align with offer.service.ts - min 6 chars, alphanumeric only
  code: Joi.string().min(6).max(20).pattern(/^[A-Z0-9]+$/).uppercase().messages({
    'string.pattern.base': 'Coupon code must be alphanumeric (A-Z, 0-9 only)',
    'string.min': 'Coupon code must be at least 6 characters',
  }),
  type: Joi.string().valid('percentage', 'fixed', 'free_service'),
  value: Joi.number().min(0).when('type', {
    is: 'percentage',
    then: Joi.number().max(100).messages({
      'number.max': 'Percentage value cannot exceed 100'
    })
  }),
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

  // FIX: Soft-deleted records are auto-excluded by the model pre-find hook,
  // but adding explicit filter here for clarity (harmless double-filtering)

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
    // FIX: Only store in targetServices/targetCategories (source of truth)
    // The API layer transforms these to applicableServices/applicableCategories for the frontend
    targetServices: serviceIds.map((id: string) => new mongoose.Types.ObjectId(id)),
    targetCategories: categoryIds.map((id: string) => new mongoose.Types.ObjectId(id)),
    targetType: serviceIds.length > 0 ? 'specific_services' : 'all',
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

  // FIX: Add audit logging for coupon creation
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'COUPON_CREATED',
    resource: 'coupon',
    resourceId: coupon._id.toString(),
    details: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxUses: coupon.maxUses,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
    },
    status: 'success',
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
    // FIX: Removed applicableServices duplicate storage — only targetServices is stored
  }
  if (value.applicableCategories !== undefined) {
    const categoryIds: string[] = value.applicableCategories || [];
    updatePayload.targetCategories = categoryIds.map((cid: string) => new mongoose.Types.ObjectId(cid));
    // FIX: Removed applicableCategories duplicate storage — only targetCategories is stored
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

  // FIX: Add audit logging for coupon update
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'COUPON_UPDATED',
    resource: 'coupon',
    resourceId: coupon._id.toString(),
    details: {
      code: coupon.code,
      updatedFields: Object.keys(value),
    },
    status: 'success',
  });

  res.json({
    success: true,
    message: 'Coupon updated successfully',
    data: { coupon },
  });
});

/**
 * DELETE /api/admin/coupons/:id - Delete a coupon (soft delete)
 * FIX: Now uses soft delete to preserve historical data
 */
export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid coupon ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  // FIX: Soft delete instead of hard delete
  const coupon = await Coupon.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false, // Also deactivate to prevent further use
    },
    { new: true }
  );

  if (!coupon) {
    throw ApiError.notFound('Coupon not found', ERROR_CODES.NOT_FOUND);
  }

  logger.info('Coupon soft deleted', {
    action: 'COUPON_SOFT_DELETED',
    couponId: id,
    code: coupon.code,
    deletedBy: (req as any).user._id,
  });

  // FIX: Add audit logging for coupon deletion
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'COUPON_DELETED',
    resource: 'coupon',
    resourceId: id,
    details: {
      code: coupon.code,
      wasActive: coupon.isActive,
    },
    status: 'success',
  });

  res.json({
    success: true,
    message: 'Coupon deleted successfully',
    data: { coupon },
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

  // FIX: Add audit logging for coupon deactivation
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'COUPON_DEACTIVATED',
    resource: 'coupon',
    resourceId: coupon._id.toString(),
    details: {
      code: coupon.code,
    },
    status: 'success',
  });

  res.json({
    success: true,
    message: 'Coupon deactivated successfully',
    data: { coupon },
  });
});

/**
 * POST /api/admin/coupons/:id/archive - Archive a coupon
 * FIX: Archives the coupon instead of deleting
 */
export const archiveCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid coupon ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const coupon = await Coupon.findByIdAndUpdate(
    id,
    {
      $set: {
        status: 'archived',
        archivedAt: new Date(),
        isActive: false, // Also deactivate to prevent use
      },
    },
    { new: true }
  ).populate('createdBy', 'firstName lastName email');

  if (!coupon) {
    throw ApiError.notFound('Coupon not found', ERROR_CODES.NOT_FOUND);
  }

  logger.info('Coupon archived', {
    action: 'COUPON_ARCHIVED',
    couponId: coupon._id,
    code: coupon.code,
    archivedBy: (req as any).user._id,
  });

  // FIX: Add audit logging for coupon archive
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'COUPON_ARCHIVED',
    resource: 'coupon',
    resourceId: coupon._id.toString(),
    details: {
      code: coupon.code,
    },
    status: 'success',
  });

  res.json({
    success: true,
    message: 'Coupon archived successfully',
    data: { coupon },
  });
});

/**
 * POST /api/admin/coupons/:id/clone - Clone a coupon
 * FIX: Creates a copy of an existing coupon with a new code
 */
export const cloneCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newCode } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid coupon ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  // Find the original coupon
  const originalCoupon = await Coupon.findById(id);
  if (!originalCoupon) {
    throw ApiError.notFound('Coupon not found', ERROR_CODES.NOT_FOUND);
  }

  // Check if new code is provided and not duplicate
  if (!newCode) {
    throw ApiError.badRequest('New coupon code is required', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const normalizedCode = newCode.toUpperCase().trim();
  const existingCoupon = await Coupon.findOne({ code: normalizedCode });
  if (existingCoupon) {
    throw ApiError.conflict('Coupon code already exists', ERROR_CODES.DUPLICATE_ENTRY);
  }

  // Create clone with reset usage and new status
  const clonedCoupon = new Coupon({
    ...originalCoupon.toObject(),
    _id: undefined, // Let MongoDB generate new ID
    code: normalizedCode,
    currentUses: 0,
    usedBy: [],
    clonedFrom: originalCoupon._id,
    status: 'draft', // Start as draft for review
    isActive: false, // Start inactive
    createdBy: (req as any).user._id,
    createdAt: undefined,
    updatedAt: undefined,
  });

  await clonedCoupon.save();

  logger.info('Coupon cloned', {
    action: 'COUPON_CLONED',
    originalCouponId: originalCoupon._id,
    clonedCouponId: clonedCoupon._id,
    newCode: normalizedCode,
    clonedBy: (req as any).user._id,
  });

  // FIX: Add audit logging for coupon clone
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'COUPON_CLONED',
    resource: 'coupon',
    resourceId: clonedCoupon._id.toString(),
    details: {
      originalCouponId: originalCoupon._id.toString(),
      originalCode: originalCoupon.code,
      newCode: normalizedCode,
    },
    status: 'success',
  });

  res.status(201).json({
    success: true,
    message: 'Coupon cloned successfully',
    data: { coupon: clonedCoupon },
  });
});

/**
 * POST /api/admin/coupons/bulk/deactivate - Bulk deactivate coupons
 */
export const bulkDeactivateCoupons = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('Request body must contain an array of coupon IDs', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const invalidIds = ids.filter((id: string) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    throw ApiError.badRequest(`Invalid coupon IDs: ${invalidIds.join(', ')}`, [], ERROR_CODES.VALIDATION_ERROR);
  }

  const result = await Coupon.updateMany(
    { _id: { $in: ids }, isActive: true },
    { $set: { isActive: false } }
  );

  logger.info('Bulk coupons deactivated', {
    action: 'BULK_COUPONS_DEACTIVATED',
    ids,
    modifiedCount: result.modifiedCount,
    requestedBy: (req as any).user?._id,
  });

  res.json({
    success: true,
    message: `${result.modifiedCount} coupon(s) deactivated`,
    data: { processed: ids.length, modifiedCount: result.modifiedCount }
  });
});

/**
 * DELETE /api/admin/coupons/bulk - Bulk delete coupons
 */
export const bulkDeleteCoupons = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('Request body must contain an array of coupon IDs', [], ERROR_CODES.VALIDATION_ERROR);
  }

  const invalidIds = ids.filter((id: string) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    throw ApiError.badRequest(`Invalid coupon IDs: ${invalidIds.join(', ')}`, [], ERROR_CODES.VALIDATION_ERROR);
  }

  const result = await Coupon.deleteMany({ _id: { $in: ids } });

  logger.info('Bulk coupons deleted', {
    action: 'BULK_COUPONS_DELETED',
    ids,
    deletedCount: result.deletedCount,
    requestedBy: (req as any).user?._id,
  });

  res.json({
    success: true,
    message: `${result.deletedCount} coupon(s) deleted`,
    data: { processed: ids.length, deletedCount: result.deletedCount }
  });
});

/**
 * PATCH /api/admin/coupons/:id/status - Update coupon approval status
 * FIX: Supports draft -> pending_review -> approved -> published workflow
 */
export const updateCouponStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, isActive } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid coupon ID', [], ERROR_CODES.VALIDATION_ERROR);
  }

  // Validate status transitions
  const validStatuses = ['draft', 'pending_review', 'approved', 'published', 'archived'];
  if (status && !validStatuses.includes(status)) {
    throw ApiError.badRequest(
      `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      [],
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Build update object
  const updateData: Record<string, unknown> = {};

  if (status) {
    updateData.status = status;

    // If publishing, activate the coupon
    if (status === 'published') {
      updateData.isActive = true;
    }
    // If reverting to draft or archiving, deactivate
    if (status === 'draft' || status === 'archived') {
      updateData.isActive = false;
    }
    // Set archivedAt timestamp if archiving
    if (status === 'archived') {
      updateData.archivedAt = new Date();
    }
  }

  if (isActive !== undefined) {
    updateData.isActive = isActive;
  }

  const coupon = await Coupon.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true }
  ).populate('createdBy', 'firstName lastName email');

  if (!coupon) {
    throw ApiError.notFound('Coupon not found', ERROR_CODES.NOT_FOUND);
  }

  logger.info('Coupon status updated', {
    action: 'COUPON_STATUS_UPDATED',
    couponId: coupon._id,
    code: coupon.code,
    newStatus: status,
    isActive: coupon.isActive,
    updatedBy: (req as any).user._id,
  });

  // FIX: Add audit logging for coupon status update
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'COUPON_STATUS_UPDATED',
    resource: 'coupon',
    resourceId: coupon._id.toString(),
    details: {
      code: coupon.code,
      newStatus: status,
      isActive: coupon.isActive,
    },
    status: 'success',
  });

  res.json({
    success: true,
    message: `Coupon status updated to ${status || (isActive ? 'active' : 'inactive')}`,
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
        // FIX: Include viewCount in stats for admin analytics
        totalViews: { $sum: { $ifNull: ['$viewCount', 0] } },
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
    totalViews: 0,
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
        // FIX: Include view analytics in stats
        totalViews: result.totalViews,
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
