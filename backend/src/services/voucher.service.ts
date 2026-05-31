import Voucher, { IVoucher, VoucherUsage } from '../models/voucher.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { getTenantId, getTenantIdOptional, isAdminOrSystem } from '../utils/tenantFilter';

export interface VoucherValidationResult {
  valid: boolean;
  error?: string;
  voucher?: IVoucher;
  discount?: number;
}

export interface VoucherEntry {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  discountValue: number;
  maxDiscount?: number;
  currency: string;
  validFrom: Date;
  validUntil: Date;
  status: string;
  minimumOrderValue?: number;
}

export interface VoucherUsageEntry {
  id: string;
  voucherId: string;
  voucherCode: string;
  usedAt: Date;
  discountApplied: number;
  bookingId?: string;
}

/**
 * Validate a voucher code
 */
export const validateVoucher = async (
  code: string,
  userId: string,
  orderAmount?: number,
  req?: Request
): Promise<VoucherValidationResult> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

    // Find voucher
    const query: Record<string, unknown> = {
      code: code.toUpperCase(),
      status: 'active',
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    };

    if (!isAdmin && tenantId) {
      query.tenantId = tenantId;
    }

    const voucher = await Voucher.findOne(query);

    if (!voucher) {
      return { valid: false, error: 'Invalid or expired voucher code' };
    }

    // Check usage limits
    if (voucher.totalUses >= voucher.maxUses) {
      return { valid: false, error: 'This voucher has reached its usage limit' };
    }

    // Check per-user limit
    const userUsageCount = await VoucherUsage.countDocuments({
      voucherId: voucher._id,
      userId,
    });

    if (userUsageCount >= voucher.perUserLimit) {
      return { valid: false, error: 'You have already used this voucher the maximum number of times' };
    }

    // Check minimum order value
    if (orderAmount !== undefined && voucher.minimumOrderValue) {
      if (orderAmount < voucher.minimumOrderValue) {
        return {
          valid: false,
          error: `Minimum order value of ${voucher.currency} ${voucher.minimumOrderValue} required`,
        };
      }
    }

    // Check user-specific voucher
    if (voucher.recipientType === 'specific') {
      if (!voucher.recipientUsers?.includes(userId as any)) {
        return { valid: false, error: 'This voucher is not available for your account' };
      }
    }

    // Check tier-based voucher
    if (voucher.recipientType === 'tier') {
      const user = await User.findById(userId).select('loyaltySystem.tier');
      if (!user || !voucher.recipientTiers?.includes(user.loyaltySystem?.tier || 'bronze')) {
        return { valid: false, error: 'This voucher is not available for your membership tier' };
      }
    }

    // Calculate discount (for validation preview)
    let discount = 0;
    if (orderAmount !== undefined) {
      if (voucher.type === 'percentage') {
        discount = Math.min(
          (orderAmount * voucher.discountValue) / 100,
          voucher.maxDiscount || Infinity
        );
      } else if (voucher.type === 'fixed') {
        discount = Math.min(voucher.discountValue, orderAmount);
      }
    }

    return {
      valid: true,
      voucher,
      discount: Math.round(discount * 100) / 100,
    };
  } catch (error: any) {
    logger.error('Failed to validate voucher', {
      code,
      userId,
      error: error.message,
      action: 'VOUCHER_VALIDATE_ERROR',
    });
    return { valid: false, error: 'Failed to validate voucher' };
  }
};

/**
 * Apply discount to booking
 */
export const applyVoucherToBooking = async (
  code: string,
  userId: string,
  bookingId: string,
  req?: Request
): Promise<{ success: boolean; discount?: number; usageId?: string; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    // Get booking to determine order amount
    const bookingQuery: Record<string, unknown> = { _id: bookingId, customerId: userId };
    if (tenantId) {
      bookingQuery.tenantId = tenantId;
    }

    const booking = await Booking.findOne(bookingQuery);
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    const orderAmount = booking.pricing.totalAmount;

    // Validate voucher
    const validation = await validateVoucher(code, userId, orderAmount, req);
    if (!validation.valid || !validation.voucher) {
      return { success: false, error: validation.error };
    }

    // Calculate discount
    let discount = 0;
    if (validation.voucher.type === 'percentage') {
      discount = Math.min(
        (orderAmount * validation.voucher.discountValue) / 100,
        validation.voucher.maxDiscount || Infinity
      );
    } else if (validation.voucher.type === 'fixed') {
      discount = Math.min(validation.voucher.discountValue, orderAmount);
    }

    discount = Math.round(discount * 100) / 100;

    // Create usage record
    const usageData: Record<string, unknown> = {
      voucherId: validation.voucher._id,
      voucherCode: validation.voucher.code,
      userId,
      bookingId,
      discountApplied: discount,
      usedAt: new Date(),
    };

    if (tenantId) {
      usageData.tenantId = tenantId;
    }

    const usage = await VoucherUsage.create(usageData);

    // Update voucher usage count
    await Voucher.updateOne(
      { _id: validation.voucher._id },
      { $inc: { totalUses: 1 } }
    );

    logger.info('Voucher applied to booking', {
      voucherId: validation.voucher._id.toString(),
      bookingId,
      userId,
      discount,
      action: 'VOUCHER_APPLIED',
    });

    return {
      success: true,
      discount,
      usageId: usage._id.toString(),
    };
  } catch (error: any) {
    logger.error('Failed to apply voucher', {
      code,
      bookingId,
      userId,
      error: error.message,
      action: 'VOUCHER_APPLY_ERROR',
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get available vouchers for user
 */
export const getAvailableVouchers = async (
  userId: string,
  req?: Request,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ vouchers: VoucherEntry[]; total: number }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;
    const isAdmin = req ? isAdminOrSystem(req) : false;

    const user = await User.findById(userId).select('loyaltySystem.tier');

    // Build query for available vouchers
    const now = new Date();
    const query: Record<string, unknown> = {
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      totalUses: { $lt: '$maxUses' }, // This won't work directly, need to filter
      $or: [
        { recipientType: 'all' },
        { recipientUsers: userId },
        { recipientTiers: user?.loyaltySystem?.tier || 'bronze' },
      ],
    };

    if (!isAdmin && tenantId) {
      query.tenantId = tenantId;
    }

    const vouchers = await Voucher.find(query)
      .sort({ validUntil: 1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 20);

    // Filter by usage limits
    const availableVouchers = [];
    for (const voucher of vouchers) {
      if (voucher.totalUses >= voucher.maxUses) continue;

      const userUsageCount = await VoucherUsage.countDocuments({
        voucherId: voucher._id,
        userId,
      });

      if (userUsageCount >= voucher.perUserLimit) continue;

      availableVouchers.push({
        id: voucher._id.toString(),
        code: voucher.code,
        name: voucher.name,
        description: voucher.description,
        type: voucher.type,
        discountValue: voucher.discountValue,
        maxDiscount: voucher.maxDiscount,
        currency: voucher.currency ?? 'AED',
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        status: voucher.status,
        minimumOrderValue: voucher.minimumOrderValue,
      });
    }

    const total = await Voucher.countDocuments({
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    });

    return {
      vouchers: availableVouchers,
      total,
    };
  } catch (error: any) {
    logger.error('Failed to get available vouchers', {
      userId,
      error: error.message,
      action: 'VOUCHER_LIST_ERROR',
    });
    return { vouchers: [], total: 0 };
  }
};

/**
 * Get user's voucher history
 */
export const getVoucherHistory = async (
  userId: string,
  req?: Request,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ usages: VoucherUsageEntry[]; total: number }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    const query: Record<string, unknown> = { userId };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    const total = await VoucherUsage.countDocuments(query);
    const usages = await VoucherUsage.find(query)
      .sort({ usedAt: -1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 20);

    return {
      usages: usages.map((u) => ({
        id: u._id.toString(),
        voucherId: u.voucherId.toString(),
        voucherCode: u.voucherCode,
        usedAt: u.usedAt,
        discountApplied: u.discountApplied,
        bookingId: u.bookingId?.toString(),
      })),
      total,
    };
  } catch (error: any) {
    logger.error('Failed to get voucher history', {
      userId,
      error: error.message,
      action: 'VOUCHER_HISTORY_ERROR',
    });
    return { usages: [], total: 0 };
  }
};

/**
 * Get expiring voucher alerts
 */
export const getExpiringVouchers = async (
  userId: string,
  req?: Request,
  daysThreshold: number = 7
): Promise<VoucherEntry[]> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const query: Record<string, unknown> = {
      status: 'active',
      validUntil: { $lte: thresholdDate, $gte: new Date() },
      $or: [
        { recipientType: 'all' },
        { recipientUsers: userId },
      ],
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const vouchers = await Voucher.find(query)
      .sort({ validUntil: 1 })
      .limit(10);

    return vouchers.map((v) => ({
      id: v._id.toString(),
      code: v.code,
      name: v.name,
      description: v.description,
      type: v.type,
      discountValue: v.discountValue,
      maxDiscount: v.maxDiscount,
      currency: v.currency ?? 'AED',
      validFrom: v.validFrom,
      validUntil: v.validUntil,
      status: v.status,
      minimumOrderValue: v.minimumOrderValue,
    }));
  } catch (error: any) {
    logger.error('Failed to get expiring vouchers', {
      userId,
      error: error.message,
      action: 'VOUCHER_EXPIRING_ERROR',
    });
    return [];
  }
};

/**
 * Create a voucher (admin)
 */
export const createVoucher = async (
  data: {
    code: string;
    name: string;
    description?: string;
    type: string;
    discountValue: number;
    maxDiscount?: number;
    validFrom: Date;
    validUntil: Date;
    maxUses: number;
    perUserLimit?: number;
    recipientType?: string;
    recipientUsers?: string[];
    recipientTiers?: string[];
    applicableServices?: string[];
    applicableCategories?: string[];
    minimumOrderValue?: number;
  },
  req?: Request
): Promise<{ success: boolean; voucherId?: string; error?: string }> => {
  try {
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    const voucherData: Record<string, unknown> = {
      ...data,
      code: data.code.toUpperCase(),
      status: 'active',
    };

    if (tenantId) {
      voucherData.tenantId = tenantId;
    }

    const voucher = await Voucher.create(voucherData);

    logger.info('Voucher created', {
      voucherId: voucher._id.toString(),
      code: voucher.code,
      action: 'VOUCHER_CREATED',
    });

    return { success: true, voucherId: voucher._id.toString() };
  } catch (error: any) {
    if (error.code === 11000) {
      return { success: false, error: 'Voucher code already exists' };
    }
    logger.error('Failed to create voucher', {
      error: error.message,
      action: 'VOUCHER_CREATE_ERROR',
    });
    return { success: false, error: error.message };
  }
};

export default {
  validateVoucher,
  applyVoucherToBooking,
  getAvailableVouchers,
  getVoucherHistory,
  getExpiringVouchers,
  createVoucher,
};
