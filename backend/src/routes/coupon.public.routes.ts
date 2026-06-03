import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import Coupon from '../models/coupon.model';
import Booking from '../models/booking.model';
import Joi from 'joi';
import mongoose from 'mongoose';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const validateCouponSchema = Joi.object({
  code: Joi.string().required().min(3).max(50).uppercase(),
  orderValue: Joi.number().required().min(0),
  serviceId: Joi.string().optional(),
});

const applyCouponSchema = Joi.object({
  code: Joi.string().required().min(3).max(50).uppercase(),
  bookingId: Joi.string().required(),
});

// ============================================
// Types
// ============================================

interface CouponDiscount {
  code: string;
  amount: number;
  type: 'fixed' | 'percentage';
}

interface PriceBreakdown {
  subtotal: number;
  discount: number;
  discounts: CouponDiscount[];
  tax: number;
  total: number;
  currency: string;
}

interface ValidateCouponResponse {
  valid: boolean;
  discount: number;
  couponCode: string;
  couponType?: 'percentage' | 'fixed' | 'free_service';
  message?: string;
  discountDetails?: CouponDiscount;
  minOrderValue?: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a coupon is valid for a user
 */
async function checkUserCouponEligibility(
  coupon: any,
  userId: mongoose.Types.ObjectId
): Promise<{ eligible: boolean; reason?: string }> {
  // Check target type restrictions
  if (coupon.targetType === 'specific_users') {
    const isTargetedUser = coupon.targetUsers?.some(
      (id: mongoose.Types.ObjectId) => id.toString() === userId.toString()
    );
    if (!isTargetedUser) {
      return { eligible: false, reason: 'This coupon is not available for your account' };
    }
  }

  // Check per-user usage limit
  const userUsageCount = coupon.usedBy?.filter(
    (entry: { userId: mongoose.Types.ObjectId }) => entry.userId.toString() === userId.toString()
  ).length || 0;

  if (userUsageCount >= coupon.maxUsesPerUser) {
    return { eligible: false, reason: 'You have already used this coupon the maximum number of times' };
  }

  return { eligible: true };
}

/**
 * Get coupon by code with soft-delete filter
 */
async function findCouponByCode(code: string): Promise<any | null> {
  return Coupon.findOne({ code: code.toUpperCase(), isDeleted: false });
}

// ============================================
// Customer-Facing Coupon Endpoints
// ============================================

/**
 * POST /api/coupons/validate
 * Validate a coupon code and calculate discount for given order value
 * Returns: { valid: boolean, discount: number, couponCode: string, message?: string }
 */
router.post(
  '/validate',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { error, value } = validateCouponSchema.validate(req.body);

    if (error) {
      throw ApiError.badRequest(
        error.details[0].message,
        error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const { code, orderValue, serviceId } = value;
    const userId = (req as any).user._id;

    // Find coupon
    const coupon = await findCouponByCode(code);

    if (!coupon) {
      const response: ValidateCouponResponse = {
        valid: false,
        discount: 0,
        couponCode: code.toUpperCase(),
        message: 'Invalid coupon code',
      };
      res.json({ success: true, data: response });
      return;
    }

    // Check if coupon is active
    const validityCheck = coupon.isValid();
    if (!validityCheck.valid) {
      const response: ValidateCouponResponse = {
        valid: false,
        discount: 0,
        couponCode: coupon.code,
        message: validityCheck.reason,
      };
      res.json({ success: true, data: response });
      return;
    }

    // Check minimum order value
    if (orderValue < coupon.minOrderValue) {
      const response: ValidateCouponResponse = {
        valid: false,
        discount: 0,
        couponCode: coupon.code,
        message: `Minimum order value of ${coupon.currency} ${coupon.minOrderValue} required`,
        minOrderValue: coupon.minOrderValue,
      };
      res.json({ success: true, data: response });
      return;
    }

    // Check service eligibility if coupon targets specific services
    if (coupon.targetType === 'specific_services' && serviceId) {
      const isServiceEligible = coupon.targetServices?.some(
        (id: mongoose.Types.ObjectId) => id.toString() === serviceId
      );
      if (!isServiceEligible) {
        const response: ValidateCouponResponse = {
          valid: false,
          discount: 0,
          couponCode: coupon.code,
          message: 'This coupon is not valid for the selected service',
        };
        res.json({ success: true, data: response });
        return;
      }
    }

    // Check user eligibility
    const eligibility = await checkUserCouponEligibility(coupon, userId);
    if (!eligibility.eligible) {
      const response: ValidateCouponResponse = {
        valid: false,
        discount: 0,
        couponCode: coupon.code,
        message: eligibility.reason,
      };
      res.json({ success: true, data: response });
      return;
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderValue);
    const discountDetails = coupon.getDiscountObject(orderValue);

    const response: ValidateCouponResponse = {
      valid: true,
      discount: discountAmount,
      couponCode: coupon.code,
      couponType: coupon.type,
      discountDetails,
      minOrderValue: coupon.minOrderValue,
    };

    res.json({ success: true, data: response });
  })
);

/**
 * GET /api/coupons/price-breakdown/:bookingId
 * Get booking price breakdown with coupon discount applied
 * Returns: { subtotal, discount, tax, total, discounts }
 */
router.get(
  '/price-breakdown/:bookingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const userId = (req as any).user._id;

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('Invalid booking ID', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Find booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw ApiError.notFound('Booking not found', ERROR_CODES.NOT_FOUND);
    }

    // Verify ownership (customer or provider can view)
    const isOwner = booking.customerId?.toString() === userId.toString() ||
                    booking.providerId?.toString() === userId.toString();

    // Also allow admin users (check via role)
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('You do not have access to this booking', ERROR_CODES.FORBIDDEN);
    }

    // Get pricing breakdown
    const { pricing } = booking;

    // Calculate subtotal (basePrice + addOns - existing discounts)
    const addOnsTotal = pricing.addOns?.reduce((sum: number, addon: { price: number }) => sum + addon.price, 0) || 0;
    const existingDiscountsTotal = pricing.discounts?.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0) || 0;
    const subtotal = pricing.basePrice + addOnsTotal - existingDiscountsTotal;

    // Apply coupon discount if exists
    const couponDiscount = pricing.couponDiscount || 0;
    const afterCoupon = Math.max(0, subtotal - couponDiscount);

    // Calculate tax (typically 5% VAT)
    const taxRate = 0.05; // 5% VAT
    const tax = Math.round(afterCoupon * taxRate * 100) / 100;

    // Calculate total
    const total = Math.round((afterCoupon + tax) * 100) / 100;

    // Build discounts array (matching frontend BookingPricing interface)
    const discounts: CouponDiscount[] = [];

    // Add existing discounts from booking
    if (pricing.discounts && pricing.discounts.length > 0) {
      for (const discount of pricing.discounts) {
        discounts.push({
          code: discount.description || 'discount', // Use description as code fallback
          amount: discount.amount,
          type: 'percentage' as const,
        });
      }
    }

    // Add coupon discount if present
    if (couponDiscount > 0 && pricing.discounts) {
      // Find if there's a coupon entry in discounts array
      const couponEntry = pricing.discounts.find(d => d.type === 'coupon');
      const couponCode = couponEntry?.description || 'COUPON';

      discounts.push({
        code: couponCode,
        amount: couponDiscount,
        type: 'percentage' as const,
      });
    }

    const breakdown: PriceBreakdown = {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(couponDiscount * 100) / 100,
      discounts,
      tax,
      total,
      currency: pricing.currency || 'AED',
    };

    res.json({
      success: true,
      data: {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        breakdown,
        appliedCoupon: couponDiscount > 0 ? {
          code: pricing.discounts?.find(d => d.type === 'coupon')?.description || 'COUPON',
          amount: couponDiscount,
        } : null,
      },
    });
  })
);

/**
 * POST /api/coupons/apply
 * Apply a coupon to a booking (validates and stores the discount)
 */
router.post(
  '/apply',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = applyCouponSchema.validate(req.body);

    if (error) {
      throw ApiError.badRequest(
        error.details[0].message,
        error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const { code, bookingId } = value;
    const userId = (req as any).user._id;

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('Invalid booking ID', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Find booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw ApiError.notFound('Booking not found', ERROR_CODES.NOT_FOUND);
    }

    // Verify customer ownership
    if (booking.customerId?.toString() !== userId.toString()) {
      throw ApiError.forbidden('You can only apply coupons to your own bookings', ERROR_CODES.FORBIDDEN);
    }

    // Check booking status - only pending/confirmed bookings can have coupons applied
    const cancellableStatuses: string[] = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(booking.status as string)) {
      throw ApiError.badRequest('Cannot apply coupon to this booking', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Check if coupon already applied
    if (booking.pricing.couponDiscount > 0) {
      throw ApiError.badRequest('A coupon has already been applied to this booking', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Find coupon
    const coupon = await findCouponByCode(code);

    if (!coupon) {
      throw ApiError.notFound('Invalid coupon code', ERROR_CODES.NOT_FOUND);
    }

    // Check if coupon is valid
    const validityCheck = coupon.isValid();
    if (!validityCheck.valid) {
      throw ApiError.badRequest(validityCheck.reason || 'Coupon is not valid', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Calculate order value for discount calculation
    const addOnsTotal = booking.pricing.addOns?.reduce((sum: number, addon: { price: number }) => sum + addon.price, 0) || 0;
    const orderValue = booking.pricing.basePrice + addOnsTotal;

    // Check minimum order value
    if (orderValue < coupon.minOrderValue) {
      throw ApiError.badRequest(
        `Minimum order value of ${coupon.currency} ${coupon.minOrderValue} required`,
        [],
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check user eligibility
    const eligibility = await checkUserCouponEligibility(coupon, userId);
    if (!eligibility.eligible) {
      throw ApiError.badRequest(eligibility.reason || 'Not eligible for this coupon', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderValue);
    const discountDetails = coupon.getDiscountObject(orderValue);

    // Update booking with coupon discount
    const newSubtotal = orderValue - discountAmount;
    const taxRate = 0.05;
    const newTax = Math.round(newSubtotal * taxRate * 100) / 100;
    const newTotal = Math.round((newSubtotal + newTax) * 100) / 100;

    // Add coupon to discounts array with type 'coupon'
    const discounts = booking.pricing.discounts || [];
    discounts.push({
      type: 'coupon',
      amount: discountAmount,
      description: coupon.code,
    });

    booking.pricing = {
      ...booking.pricing,
      couponDiscount: discountAmount,
      subtotal: Math.round(newSubtotal * 100) / 100,
      tax: newTax,
      totalAmount: newTotal,
      discounts,
    };

    await booking.save();

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        booking,
        appliedCoupon: {
          code: coupon.code,
          type: coupon.type,
          discount: discountAmount,
          discountDetails,
          newTotal,
        },
      },
    });
  })
);

/**
 * DELETE /api/coupons/remove/:bookingId
 * Remove coupon from a booking
 */
router.delete(
  '/remove/:bookingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const userId = (req as any).user._id;

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('Invalid booking ID', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Find booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw ApiError.notFound('Booking not found', ERROR_CODES.NOT_FOUND);
    }

    // Verify customer ownership
    if (booking.customerId?.toString() !== userId.toString()) {
      throw ApiError.forbidden('You can only modify your own bookings', ERROR_CODES.FORBIDDEN);
    }

    // Check booking status
    const removableStatuses: string[] = ['pending', 'confirmed'];
    if (!removableStatuses.includes(booking.status as string)) {
      throw ApiError.badRequest('Cannot remove coupon from this booking', [], ERROR_CODES.VALIDATION_ERROR);
    }

    // Check if coupon is applied
    if (!booking.pricing.couponDiscount || booking.pricing.couponDiscount <= 0) {
      throw ApiError.notFound('No coupon applied to this booking', ERROR_CODES.NOT_FOUND);
    }

    // Recalculate pricing without coupon
    const addOnsTotal = booking.pricing.addOns?.reduce((sum: number, addon: { price: number }) => sum + addon.price, 0) || 0;
    const baseTotal = booking.pricing.basePrice + addOnsTotal;
    const taxRate = 0.05;
    const newTax = Math.round(baseTotal * taxRate * 100) / 100;
    const newTotal = Math.round((baseTotal + newTax) * 100) / 100;

    // Remove coupon discount from discounts array
    const discounts = (booking.pricing.discounts || []).filter(d => d.type !== 'coupon');

    booking.pricing = {
      ...booking.pricing,
      couponDiscount: 0,
      subtotal: Math.round(baseTotal * 100) / 100,
      tax: newTax,
      totalAmount: newTotal,
      discounts,
    };

    await booking.save();

    res.json({
      success: true,
      message: 'Coupon removed successfully',
      data: { booking },
    });
  })
);

export default router;
