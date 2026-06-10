import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Voucher, VoucherUsage } from '../models/voucher.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Joi from 'joi';
import logger from '../utils/logger';
import AuditLog from '../models/auditLog.model';

// FIX P0-5: Standardize voucher code validation (can be shorter for physical distribution)
const createVoucherSchema = Joi.object({
  // Vouchers can be shorter (4-20) for physical distribution use cases
  code: Joi.string().required().min(4).max(20).pattern(/^[A-Z0-9]+$/).uppercase().messages({
    'string.pattern.base': 'Voucher code must be alphanumeric (A-Z, 0-9 only)',
  }),
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().max(500).optional(),
  type: Joi.string().required().valid('percentage', 'fixed', 'free_service'),
  discountValue: Joi.number().required().min(0),
  maxDiscount: Joi.number().min(0).optional(),
  currency: Joi.string().default('AED'),
  validFrom: Joi.date().iso().required(),
  validUntil: Joi.date().iso().greater(Joi.ref('validFrom')).required(),
  maxUses: Joi.number().integer().min(1).required(),
  perUserLimit: Joi.number().integer().min(1).default(1),
  recipientType: Joi.string().valid('all', 'specific', 'tier').default('all'),
  recipientUsers: Joi.array().items(Joi.string()).optional(),
  recipientTiers: Joi.array().items(Joi.string()).optional(),
  applicableServices: Joi.array().items(Joi.string()).optional(),
  applicableCategories: Joi.array().items(Joi.string()).optional(),
  minimumOrderValue: Joi.number().min(0).default(0),
  status: Joi.string().valid('active', 'cancelled').default('active'),
});

const updateVoucherSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow('').optional(),
  type: Joi.string().valid('percentage', 'fixed', 'free_service').optional(),
  discountValue: Joi.number().min(0).optional(),
  maxDiscount: Joi.number().min(0).allow(null).optional(),
  validFrom: Joi.date().iso().optional(),
  validUntil: Joi.date().iso().optional(),
  maxUses: Joi.number().integer().min(1).optional(),
  perUserLimit: Joi.number().integer().min(1).optional(),
  recipientType: Joi.string().valid('all', 'specific', 'tier').optional(),
  recipientUsers: Joi.array().items(Joi.string()).optional(),
  recipientTiers: Joi.array().items(Joi.string()).optional(),
  applicableServices: Joi.array().items(Joi.string()).optional(),
  applicableCategories: Joi.array().items(Joi.string()).optional(),
  minimumOrderValue: Joi.number().min(0).optional(),
  status: Joi.string().valid('active', 'cancelled').optional(),
});

// FIX: List all vouchers with pagination
export const listAll = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const { status, search } = req.query;

  const query: any = { isDeleted: { $ne: true } };

  if (status) {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { code: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
    ];
  }

  const [vouchers, total] = await Promise.all([
    Voucher.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'firstName lastName email'),
    Voucher.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      vouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

// FIX: Get voucher by ID
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid voucher ID');
  }

  const voucher = await Voucher.findById(id).populate('createdBy', 'firstName lastName email');

  if (!voucher || voucher.isDeleted) {
    throw new ApiError(404, 'Voucher not found');
  }

  // Get usage statistics
  const usageCount = await VoucherUsage.countDocuments({ voucherId: id });
  const uniqueUsers = await VoucherUsage.distinct('userId', { voucherId: id });

  res.json({
    success: true,
    data: {
      voucher,
      stats: {
        totalUses: usageCount,
        uniqueUsers: uniqueUsers.length,
        usagePercentage: voucher.maxUses > 0 ? (usageCount / voucher.maxUses) * 100 : 0,
      },
    },
  });
});

// FIX: Create voucher
export const create = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = createVoucherSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  // Check for duplicate code
  const existing = await Voucher.findOne({ code: value.code, isDeleted: { $ne: true } });
  if (existing) {
    throw new ApiError(409, 'Voucher code already exists');
  }

  const voucher = new Voucher({
    ...value,
    createdBy: (req as any).user._id,
    totalUses: 0,
  });

  await voucher.save();

  // Audit log
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'VOUCHER_CREATED',
    resource: 'voucher',
    resourceId: voucher._id,
    details: { code: voucher.code, name: voucher.name },
    status: 'success',
  });

  logger.info('Voucher created', {
    action: 'VOUCHER_CREATED',
    voucherId: voucher._id,
    code: voucher.code,
    createdBy: (req as any).user._id,
  });

  res.status(201).json({
    success: true,
    data: { voucher },
    message: 'Voucher created successfully',
  });
});

// FIX: Update voucher
export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid voucher ID');
  }

  const { error, value } = updateVoucherSchema.validate(req.body);

  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const voucher = await Voucher.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: value },
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName email');

  if (!voucher) {
    throw new ApiError(404, 'Voucher not found');
  }

  // Audit log
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'VOUCHER_UPDATED',
    resource: 'voucher',
    resourceId: voucher._id,
    details: { code: voucher.code, updates: Object.keys(value) },
    status: 'success',
  });

  logger.info('Voucher updated', {
    action: 'VOUCHER_UPDATED',
    voucherId: voucher._id,
    code: voucher.code,
    updatedBy: (req as any).user._id,
  });

  res.json({
    success: true,
    data: { voucher },
    message: 'Voucher updated successfully',
  });
});

// FIX: Delete voucher (soft delete)
export const deleteVoucher = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid voucher ID');
  }

  const voucher = await Voucher.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        status: 'cancelled',
      },
    },
    { new: true }
  );

  if (!voucher) {
    throw new ApiError(404, 'Voucher not found');
  }

  // Audit log
  await AuditLog.create({
    userId: (req as any).user._id,
    action: 'VOUCHER_DELETED',
    resource: 'voucher',
    resourceId: voucher._id,
    details: { code: voucher.code },
    status: 'success',
  });

  logger.info('Voucher deleted', {
    action: 'VOUCHER_DELETED',
    voucherId: voucher._id,
    code: voucher.code,
    deletedBy: (req as any).user._id,
  });

  res.json({
    success: true,
    message: 'Voucher deleted successfully',
  });
});

// Alias for consistency with route
export const deleteVoucherAlias = deleteVoucher;

// FIX: Get voucher statistics
export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();

  const [
    totalVouchers,
    activeVouchers,
    expiredVouchers,
    totalUsage,
    totalDiscount,
  ] = await Promise.all([
    Voucher.countDocuments({ isDeleted: { $ne: true } }),
    Voucher.countDocuments({ status: 'active', isDeleted: { $ne: true } }),
    Voucher.countDocuments({
      status: { $ne: 'active' },
      isDeleted: { $ne: true }
    }),
    VoucherUsage.countDocuments({}),
    VoucherUsage.aggregate([
      { $group: { _id: null, total: { $sum: '$discountApplied' } } }
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalVouchers,
      activeVouchers,
      expiredVouchers,
      totalUsage,
      totalDiscount: totalDiscount[0]?.total || 0,
    },
  });
});

export default {
  listAll,
  getById,
  create,
  update,
  delete: deleteVoucher,
  getStats,
};