/**
 * Discount Stacking Prevention Utility
 *
 * FIX: Prevents multiple discount types from being applied simultaneously.
 * This ensures only ONE discount type is applied per booking:
 * - Coupon discounts
 * - Bulk/VOLUME discounts
 * - Membership discounts
 * - Loyalty point discounts
 *
 * Priority order (highest to lowest):
 * 1. Coupon discounts (customer explicitly applied)
 * 2. Membership discounts
 * 3. Bulk/Volume discounts
 * 4. Loyalty point redemptions
 */

import Booking from '../models/booking.model';
import logger from '../utils/logger';

// Discount types in priority order (index = priority, lower = higher priority)
export const DISCOUNT_PRIORITY = {
  // Coupon discounts have highest priority - customer explicitly applied these
  coupon: 1,
  // Membership discounts
  membership: 2,
  // Bulk/Volume discounts
  bulk: 3,
  // Loyalty points
  loyalty: 4,
} as const;

export type DiscountType = keyof typeof DISCOUNT_PRIORITY;

export interface DiscountStackingResult {
  canApply: boolean;
  reason?: string;
  conflictingDiscounts?: Array<{
    type: DiscountType;
    amount: number;
    description: string;
  }>;
}

/**
 * Check if a new discount can be applied without conflicting with existing discounts
 */
export async function checkDiscountStacking(
  bookingId: string,
  newDiscountType: DiscountType
): Promise<DiscountStackingResult> {
  const booking = await Booking.findById(bookingId).select('pricing').lean();

  if (!booking || !booking.pricing) {
    return { canApply: true };
  }

  const pricing = booking.pricing as any;
  const conflicts: DiscountStackingResult['conflictingDiscounts'] = [];

  // Check for existing non-bulk discounts (excluding the new type)
  const discountTypes = pricing.discounts || [];

  for (const discount of discountTypes) {
    const existingType = discount.type;

    // Skip if same type
    if (existingType === newDiscountType) {
      continue;
    }

    // Check if discount type conflicts with new discount
    // FIX: Include bulk discounts in conflict checking
    if (existingType === 'coupon' || existingType === 'membership' || existingType === 'bulk') {
      conflicts.push({
        type: existingType,
        amount: discount.amount || 0,
        description: discount.description || existingType,
      });
    }
  }

  // Check coupon discount specifically
  if (pricing.couponDiscount && pricing.couponDiscount > 0) {
    // Coupon discounts conflict with all other discounts
    if (newDiscountType !== 'coupon') {
      conflicts.push({
        type: 'coupon',
        amount: pricing.couponDiscount,
        description: 'Applied coupon',
      });
    }
  }

  // If there are conflicts and the new discount has lower priority, reject it
  if (conflicts.length > 0) {
    const existingHighestPriority = Math.min(
      ...conflicts.map(c => DISCOUNT_PRIORITY[c.type])
    );
    const newPriority = DISCOUNT_PRIORITY[newDiscountType];

    if (newPriority > existingHighestPriority) {
      return {
        canApply: false,
        reason: `Cannot apply ${newDiscountType} discount. A higher-priority discount (${conflicts[0].type}) is already applied.`,
        conflictingDiscounts: conflicts,
      };
    }

    // If new discount has equal or higher priority, it can replace the existing one
    return {
      canApply: true,
      conflictingDiscounts: conflicts,
    };
  }

  return { canApply: true };
}

/**
 * Remove all existing discounts of specific types
 */
export async function clearDiscounts(
  bookingId: string,
  discountTypes?: DiscountType[]
): Promise<void> {
  const booking = await Booking.findById(bookingId);

  if (!booking || !booking.pricing) {
    return;
  }

  const pricing = booking.pricing as any;

  if (discountTypes) {
    // Clear only specified types
    const typesToRemove = new Set(discountTypes);
    pricing.discounts = (pricing.discounts || []).filter((d: any) =>
      !typesToRemove.has(d.type)
    );

    for (const type of discountTypes) {
      if (type === 'coupon') {
        pricing.couponDiscount = 0;
        delete pricing.appliedCouponCode;
      }
    }
  } else {
    // Clear all discounts
    pricing.discounts = [];
    pricing.couponDiscount = 0;
    delete pricing.appliedCouponCode;
  }

  await booking.save();
  logger.info('Discounts cleared', { bookingId, discountTypes });
}

/**
 * Get all applied discounts for a booking
 */
export async function getAppliedDiscounts(bookingId: string): Promise<{
  totalDiscount: number;
  discounts: Array<{
    type: string;
    code?: string;
    amount: number;
    description?: string;
  }>;
}> {
  const booking = await Booking.findById(bookingId).select('pricing').lean();

  if (!booking || !booking.pricing) {
    return { totalDiscount: 0, discounts: [] };
  }

  const pricing = booking.pricing as any;
  const discounts = pricing.discounts || [];

  // Include coupon discount in total
  const couponDiscount = pricing.couponDiscount || 0;
  if (couponDiscount > 0) {
    discounts.push({
      type: 'coupon',
      code: pricing.appliedCouponCode || 'COUPON',
      amount: couponDiscount,
    });
  }

  const totalDiscount = discounts.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

  return { totalDiscount, discounts };
}

/**
 * Apply a discount with stacking prevention
 * Returns the new discount amount and any removed conflicts
 */
export async function applyDiscountWithStackingPrevention(
  bookingId: string,
  newDiscount: {
    type: DiscountType;
    code?: string;
    amount: number;
    description?: string;
  }
): Promise<{
  success: boolean;
  newTotalDiscount: number;
  removedConflicts?: DiscountType[];
  error?: string;
}> {
  // Check if discount can be applied
  const stackingCheck = await checkDiscountStacking(bookingId, newDiscount.type);

  if (!stackingCheck.canApply) {
    return {
      success: false,
      newTotalDiscount: 0,
      error: stackingCheck.reason,
    };
  }

  const booking = await Booking.findById(bookingId);

  if (!booking || !booking.pricing) {
    return {
      success: false,
      newTotalDiscount: 0,
      error: 'Booking not found',
    };
  }

  const pricing = booking.pricing as any;
  const removedConflicts: DiscountType[] = [];

  // Remove conflicting discounts if new one has equal or higher priority
  if (stackingCheck.conflictingDiscounts && stackingCheck.conflictingDiscounts.length > 0) {
    for (const conflict of stackingCheck.conflictingDiscounts) {
      if (conflict.type !== newDiscount.type) {
        removedConflicts.push(conflict.type);

        // Remove from discounts array
        pricing.discounts = (pricing.discounts || []).filter(
          (d: any) => d.type !== conflict.type
        );

        // Clear type-specific fields
        if (conflict.type === 'coupon') {
          pricing.couponDiscount = 0;
          delete pricing.appliedCouponCode;
        }

        logger.info('Conflicting discount removed', {
          bookingId,
          removedType: conflict.type,
          newDiscountType: newDiscount.type,
        });
      }
    }
  }

  // Add the new discount
  pricing.discounts = pricing.discounts || [];

  // For coupons, also set the couponDiscount field
  if (newDiscount.type === 'coupon') {
    pricing.couponDiscount = newDiscount.amount;
    pricing.appliedCouponCode = newDiscount.code;
  }

  pricing.discounts.push({
    type: newDiscount.type,
    code: newDiscount.code,
    amount: newDiscount.amount,
    description: newDiscount.description,
  });

  // Calculate new total
  const totalDiscount = (pricing.discounts || []).reduce(
    (sum: number, d: any) => sum + (d.amount || 0),
    0
  );

  await booking.save();

  logger.info('Discount applied with stacking prevention', {
    bookingId,
    newDiscount,
    removedConflicts,
    totalDiscount,
  });

  return {
    success: true,
    newTotalDiscount: totalDiscount,
    removedConflicts,
  };
}

export default {
  checkDiscountStacking,
  clearDiscounts,
  getAppliedDiscounts,
  applyDiscountWithStackingPrevention,
  DISCOUNT_PRIORITY,
};
