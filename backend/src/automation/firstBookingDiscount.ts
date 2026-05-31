/**
 * First Booking Discount Automation
 *
 * Manages discount codes for new user first booking incentive:
 * - Discount code generation
 * - Expiry tracking
 * - Usage limits
 * - Analytics tracking
 */

import mongoose, { Document, Schema } from 'mongoose';
import User from '../models/user.model';
import Coupon from '../models/coupon.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IFirstBookingDiscount extends Document {
  userId: mongoose.Types.ObjectId;
  discountCode: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  generatedAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  usedOnBooking?: mongoose.Types.ObjectId;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  metadata?: {
    emailSentAt?: Date;
    emailOpenedAt?: Date;
    emailClickedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const firstBookingDiscountSchema = new Schema<IFirstBookingDiscount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    discountCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },
    maxDiscount: {
      type: Number,
      min: 1,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: Date,
    usedOnBooking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    status: {
      type: String,
      enum: ['active', 'used', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    metadata: {
      emailSentAt: Date,
      emailOpenedAt: Date,
      emailClickedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
firstBookingDiscountSchema.index({ status: 1, expiresAt: 1 });
firstBookingDiscountSchema.index({ expiresAt: 1, status: 1 });

const FirstBookingDiscount = mongoose.model<IFirstBookingDiscount>('FirstBookingDiscount', firstBookingDiscountSchema);

// Default configuration
const DEFAULT_CONFIG = {
  discountType: 'percentage' as const,
  discountValue: 15, // 15%
  maxDiscount: 50, // Max 50 AED
  minOrderValue: 0,
  validityDays: 30,
  reminderDays: 7, // Remind 7 days before expiry
};

interface DiscountConfig {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  validityDays: number;
  reminderDays: number;
}

/**
 * Generate a unique discount code
 */
function generateDiscountCode(userId: mongoose.Types.ObjectId): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const userSuffix = userId.toString().slice(-4).toUpperCase();
  return `FIRST${timestamp}${userSuffix}`;
}

/**
 * Generate first booking discount for a new user
 */
export async function generateFirstBookingDiscount(
  userId: mongoose.Types.ObjectId,
  config?: Partial<DiscountConfig>
): Promise<IFirstBookingDiscount> {
  try {
    // Check if discount already exists
    const existing = await FirstBookingDiscount.findOne({ userId });
    if (existing) {
      logger.debug('generateFirstBookingDiscount: Discount already exists', {
        userId: userId.toString(),
      });
      return existing;
    }

    // Check if user has already completed a booking
    const hasBookings = await Booking.countDocuments({
      customerId: userId,
      status: { $in: ['completed', 'confirmed', 'in_progress'] },
    });

    if (hasBookings > 0) {
      logger.info('generateFirstBookingDiscount: User already has bookings', {
        userId: userId.toString(),
      });
      throw new Error('User already has existing bookings');
    }

    const mergedConfig: DiscountConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + mergedConfig.validityDays);

    const discount = await FirstBookingDiscount.create({
      userId,
      discountCode: generateDiscountCode(userId),
      discountType: mergedConfig.discountType,
      discountValue: mergedConfig.discountValue,
      maxDiscount: mergedConfig.maxDiscount,
      minOrderValue: mergedConfig.minOrderValue,
      expiresAt,
      status: 'active',
    });

    logger.info('generateFirstBookingDiscount: Discount generated', {
      userId: userId.toString(),
      discountCode: discount.discountCode,
      expiresAt: expiresAt.toISOString(),
    });

    // Also create a matching coupon in the Coupon model for redemption
    await Coupon.create({
      code: discount.discountCode,
      type: mergedConfig.discountType,
      value: mergedConfig.discountValue,
      maxDiscount: mergedConfig.maxDiscount,
      minOrderValue: mergedConfig.minOrderValue,
      maxUses: 1,
      maxUsesPerUser: 1,
      validFrom: new Date(),
      validUntil: expiresAt,
      isActive: true,
      targetType: 'first_booking',
      targetUsers: [userId],
      title: 'First Booking Discount',
      description: 'Welcome discount for new users',
      createdBy: new mongoose.Types.ObjectId(), // System user
    });

    // Send notification
    await addJob('notification-queue', 'send_notification', {
      userId: userId.toString(),
      type: 'discount_earned',
      title: 'You Earned 15% Off!',
      message: `Use code ${discount.discountCode} on your first booking. Valid for ${mergedConfig.validityDays} days!`,
      data: {
        discountCode: discount.discountCode,
        discountValue: mergedConfig.discountValue,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return discount;
  } catch (error) {
    logger.error('generateFirstBookingDiscount: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Validate and get discount for a user
 */
export async function getValidDiscount(userId: mongoose.Types.ObjectId): Promise<IFirstBookingDiscount | null> {
  try {
    const discount = await FirstBookingDiscount.findOne({
      userId,
      status: 'active',
      expiresAt: { $gt: new Date() },
    });

    return discount;
  } catch (error) {
    logger.error('getValidDiscount: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Mark discount as used
 */
export async function markDiscountUsed(
  userId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId
): Promise<IFirstBookingDiscount | null> {
  try {
    const discount = await FirstBookingDiscount.findOne({
      userId,
      status: 'active',
      expiresAt: { $gt: new Date() },
    });

    if (!discount) {
      logger.warn('markDiscountUsed: No valid discount found', {
        userId: userId.toString(),
      });
      return null;
    }

    discount.status = 'used';
    discount.usedAt = new Date();
    discount.usedOnBooking = bookingId;
    await discount.save();

    // Deactivate the coupon in Coupon model
    await Coupon.updateOne(
      { code: discount.discountCode },
      {
        isActive: false,
        $push: {
          usedBy: {
            userId,
            usedAt: new Date(),
            orderId: bookingId.toString(),
          },
        },
      }
    );

    logger.info('markDiscountUsed: Discount marked as used', {
      userId: userId.toString(),
      bookingId: bookingId.toString(),
      discountCode: discount.discountCode,
    });

    // Publish event for analytics
    await addJob('analytics-queue', 'track_event', {
      event: 'first_booking_discount_used',
      userId: userId.toString(),
      bookingId: bookingId.toString(),
      discountCode: discount.discountCode,
      discountValue: discount.discountValue,
      discountType: discount.discountType,
      timestamp: new Date().toISOString(),
    });

    return discount;
  } catch (error) {
    logger.error('markDiscountUsed: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Cancel discount for a user (e.g., fraud detection)
 */
export async function cancelDiscount(userId: mongoose.Types.ObjectId): Promise<boolean> {
  try {
    const result = await FirstBookingDiscount.updateOne(
      { userId, status: 'active' },
      { status: 'cancelled' }
    );

    if (result.modifiedCount > 0) {
      // Also deactivate the coupon
      await Coupon.updateMany(
        {
          targetUsers: userId,
          targetType: 'first_booking',
          isActive: true,
        },
        { isActive: false }
      );

      logger.info('cancelDiscount: Discount cancelled', {
        userId: userId.toString(),
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('cancelDiscount: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process expired discounts
 * Called by scheduled job daily
 */
export async function processExpiredDiscounts(): Promise<number> {
  try {
    const result = await FirstBookingDiscount.updateMany(
      {
        status: 'active',
        expiresAt: { $lt: new Date() },
      },
      {
        status: 'expired',
      }
    );

    // Also deactivate expired coupons
    const expiredDiscounts = await FirstBookingDiscount.find({
      status: 'expired',
    }).select('discountCode');

    if (expiredDiscounts.length > 0) {
      await Coupon.updateMany(
        { code: { $in: expiredDiscounts.map(d => d.discountCode) } },
        { isActive: false }
      );
    }

    logger.info('processExpiredDiscounts: Processed expired discounts', {
      expiredCount: result.modifiedCount,
    });

    return result.modifiedCount;
  } catch (error) {
    logger.error('processExpiredDiscounts: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Send expiry reminders for expiring discounts
 * Called by scheduled job daily
 */
export async function sendExpiryReminders(): Promise<number> {
  try {
    const reminderThreshold = new Date(Date.now() + DEFAULT_CONFIG.reminderDays * 24 * 60 * 60 * 1000);

    const expiringDiscounts = await FirstBookingDiscount.find({
      status: 'active',
      expiresAt: {
        $gt: new Date(),
        $lte: reminderThreshold,
      },
    }).populate('userId', 'email firstName communicationPreferences');

    for (const discount of expiringDiscounts) {
      const user = discount.userId as unknown as {
        email: string;
        firstName: string;
        communicationPreferences?: { email?: { promotions?: boolean } };
      };

      if (!user?.communicationPreferences?.email?.promotions) continue;

      // Check if reminder already sent
      if (discount.metadata?.emailSentAt) {
        const daysSinceReminder = Math.floor(
          (Date.now() - discount.metadata.emailSentAt.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (daysSinceReminder < 7) continue; // Only remind once per week
      }

      await addJob('notification-queue', 'send_notification', {
        userId: discount.userId.toString(),
        type: 'discount_expiry_reminder',
        title: 'Your Discount Expires Soon!',
        message: `Code ${discount.discountCode} expires in ${DEFAULT_CONFIG.reminderDays} days. Don't miss out!`,
        data: {
          discountCode: discount.discountCode,
          expiresAt: discount.expiresAt.toISOString(),
          daysRemaining: Math.ceil(
            (discount.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          ),
        },
      });

      await discount.updateOne({
        'metadata.emailSentAt': new Date(),
      });
    }

    logger.info('sendExpiryReminders: Sent reminders', {
      count: expiringDiscounts.length,
    });

    return expiringDiscounts.length;
  } catch (error) {
    logger.error('sendExpiryReminders: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get discount analytics
 */
export async function getDiscountAnalytics(): Promise<{
  totalGenerated: number;
  totalUsed: number;
  totalExpired: number;
  usageRate: number;
  averageDiscountValue: number;
  redemptionByDay: Array<{ date: string; count: number }>;
}> {
  const stats = await FirstBookingDiscount.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDiscountValue: { $avg: '$discountValue' },
      },
    },
  ]);

  const statusCounts = stats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const totalGenerated = (Object.values(statusCounts) as number[]).reduce((sum, count) => sum + count, 0);
  const totalUsed = statusCounts['used'] || 0;
  const totalExpired = statusCounts['expired'] || 0;

  // Get daily redemption data for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const redemptionByDay = await FirstBookingDiscount.aggregate([
    {
      $match: {
        status: 'used',
        usedAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$usedAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    totalGenerated,
    totalUsed,
    totalExpired,
    usageRate: totalGenerated > 0 ? (totalUsed / totalGenerated) * 100 : 0,
    averageDiscountValue: stats[0]?.avgDiscountValue || 0,
    redemptionByDay: redemptionByDay.map(r => ({
      date: r._id,
      count: r.count,
    })),
  };
}

/**
 * Check and generate first booking discounts for eligible users
 * Wrapper function for scheduler integration
 */
export async function checkFirstBookingDiscount(): Promise<{
  discountsGenerated: number;
  remindersSent: number;
}> {
  try {
    logger.info('Checking first booking discounts via scheduler');

    // Process expired discounts
    const expired = await processExpiredDiscounts();
    logger.info('Expired discounts processed', { count: expired });

    // Send expiry reminders
    const reminders = await sendExpiryReminders();
    logger.info('Expiry reminders sent', { count: reminders });

    logger.info('First booking discount check completed via scheduler');

    return {
      discountsGenerated: expired,
      remindersSent: reminders,
    };
  } catch (error) {
    logger.error('First booking discount check failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  generateFirstBookingDiscount,
  getValidDiscount,
  markDiscountUsed,
  cancelDiscount,
  processExpiredDiscounts,
  sendExpiryReminders,
  getDiscountAnalytics,
  checkFirstBookingDiscount,
  FirstBookingDiscount,
};
