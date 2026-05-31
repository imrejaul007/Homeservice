import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type DiscountType = 'percentage' | 'fixed_amount' | 'free_service';
export type BulkDiscountStatus = 'active' | 'inactive' | 'expired';

export interface VolumeTier {
  minQuantity: number;
  maxQuantity?: number;
  discountPercent: number;
  label: string;
}

export interface BulkDiscountConfig {
  enabled: boolean;
  autoApply: boolean;
  volumeTiers: VolumeTier[];
  maxDiscountPercent: number;
  applyToServices?: Types.ObjectId[];
  excludeCategories?: Types.ObjectId[];
  startDate: Date;
  endDate: Date;
}

export interface BulkDiscountRecord {
  _id?: Types.ObjectId;
  discountId: string;
  bookingId: Types.ObjectId;
  bookingNumber: string;
  customerId: Types.ObjectId;
  customerName: string;
  discountTier: VolumeTier;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  bookingCount: number; // How many bookings counted toward this discount
  appliedAt: Date;
  metadata?: {
    categoryId?: Types.ObjectId;
    serviceName?: string;
    promoCode?: string;
  };
}

export interface CustomerBookingStats {
  customerId: Types.ObjectId;
  customerName: string;
  totalBookings: number;
  totalSpent: number;
  eligibleForDiscount: boolean;
  currentTier?: VolumeTier;
  nextTier?: VolumeTier;
  bookingsUntilNextTier?: number;
  discountPercent: number;
  potentialSavings: number;
  bookingHistory: Array<{
    bookingId: Types.ObjectId;
    bookingNumber: string;
    date: Date;
    amount: number;
    serviceName: string;
  }>;
}

// Default configuration
const DEFAULT_CONFIG: BulkDiscountConfig = {
  enabled: true,
  autoApply: true,
  volumeTiers: [
    { minQuantity: 3, maxQuantity: 5, discountPercent: 5, label: '3-5 Bookings (5% off)' },
    { minQuantity: 6, maxQuantity: 10, discountPercent: 10, label: '6-10 Bookings (10% off)' },
    { minQuantity: 11, maxQuantity: 20, discountPercent: 15, label: '11-20 Bookings (15% off)' },
    { minQuantity: 21, maxQuantity: 50, discountPercent: 20, label: '21-50 Bookings (20% off)' },
    { minQuantity: 51, discountPercent: 25, label: '51+ Bookings (25% off)' },
  ],
  maxDiscountPercent: 25,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2030-12-31'),
};

// ============================================
// Bulk Discount Service
// ============================================

export class BulkDiscountService {
  private config: BulkDiscountConfig = DEFAULT_CONFIG;

  /**
   * Initialize the service with custom configuration
   */
  async initialize(config: Partial<BulkDiscountConfig>): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('BulkDiscountService initialized', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): BulkDiscountConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<BulkDiscountConfig>): Promise<BulkDiscountConfig> {
    this.config = { ...this.config, ...updates };
    logger.info('BulkDiscountService config updated', { config: this.config });
    return this.config;
  }

  /**
   * Get volume tiers
   */
  getVolumeTiers(): VolumeTier[] {
    return this.config.volumeTiers;
  }

  /**
   * Get applicable tier for booking count
   */
  getApplicableTier(bookingCount: number): VolumeTier | null {
    for (const tier of this.config.volumeTiers) {
      if (bookingCount >= tier.minQuantity) {
        if (tier.maxQuantity === undefined || bookingCount <= tier.maxQuantity) {
          return tier;
        }
      }
    }
    return null;
  }

  /**
   * Get customer's booking statistics and discount eligibility
   */
  async getCustomerStats(
    customerId: string | Types.ObjectId,
    options: {
      serviceId?: string;
      categoryId?: string;
      periodStart?: Date;
      periodEnd?: Date;
    } = {}
  ): Promise<CustomerBookingStats> {
    const customerObjectId = typeof customerId === 'string'
      ? new Types.ObjectId(customerId)
      : customerId;

    const matchQuery: any = {
      customerId: customerObjectId,
      status: { $in: ['confirmed', 'completed'] },
    };

    if (options.periodStart || options.periodEnd) {
      matchQuery.scheduledDate = {};
      if (options.periodStart) matchQuery.scheduledDate.$gte = options.periodStart;
      if (options.periodEnd) matchQuery.scheduledDate.$lte = options.periodEnd;
    }

    if (options.serviceId) {
      matchQuery.serviceId = new Types.ObjectId(options.serviceId);
    }

    if (options.categoryId) {
      matchQuery['metadata.categoryId'] = new Types.ObjectId(options.categoryId);
    }

    const bookings = await Booking.find(matchQuery)
      .populate('serviceId', 'name')
      .sort({ scheduledDate: -1 });

    const totalBookings = bookings.length;
    const totalSpent = bookings.reduce((sum, b) => sum + ((b.pricing as any)?.totalAmount || 0), 0);

    const currentTier = this.getApplicableTier(totalBookings);
    const nextTier = this.getNextTier(totalBookings);
    const bookingsUntilNextTier = nextTier ? nextTier.minQuantity - totalBookings : 0;
    const discountPercent = currentTier?.discountPercent || 0;
    const potentialSavings = Math.round(totalSpent * (discountPercent / 100) * 100) / 100;

    // Get customer name
    const lastBooking = bookings[0];
    const customerName = (lastBooking?.customerId as any)?.firstName
      ? `${(lastBooking.customerId as any).firstName} ${(lastBooking.customerId as any).lastName || ''}`.trim()
      : 'Unknown';

    const bookingHistory = bookings.slice(0, 20).map(b => ({
      bookingId: b._id as Types.ObjectId,
      bookingNumber: b.bookingNumber,
      date: b.scheduledDate,
      amount: (b.pricing as any)?.totalAmount || 0,
      serviceName: (b.serviceId as any)?.name || 'Unknown Service',
    }));

    return {
      customerId: customerObjectId,
      customerName,
      totalBookings,
      totalSpent,
      eligibleForDiscount: totalBookings >= 3,
      currentTier: currentTier ?? undefined,
      nextTier: nextTier ?? undefined,
      bookingsUntilNextTier,
      discountPercent,
      potentialSavings,
      bookingHistory,
    };
  }

  /**
   * Get next tier for a booking count
   */
  getNextTier(bookingCount: number): VolumeTier | null {
    for (const tier of this.config.volumeTiers) {
      if (tier.minQuantity > bookingCount) {
        return tier;
      }
    }
    return null;
  }

  /**
   * Calculate bulk discount for a booking
   */
  async calculateDiscount(
    bookingId: string | Types.ObjectId,
    options: {
      customerId?: string | Types.ObjectId;
      autoApply?: boolean;
    } = {}
  ): Promise<{
    eligible: boolean;
    discountPercent: number;
    discountAmount: number;
    originalAmount: number;
    finalAmount: number;
    currency: string;
    currentTier?: VolumeTier;
    currentBookingCount: number;
    message?: string;
  }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId);
      if (!booking) {
        return {
          eligible: false,
          discountPercent: 0,
          discountAmount: 0,
          originalAmount: 0,
          finalAmount: 0,
          currency: 'AED',
          currentBookingCount: 0,
        };
      }

      // Check if already has discount
      const existingDiscount = (booking.pricing as any)?.bulkDiscount;
      if (existingDiscount) {
        return {
          eligible: true,
          discountPercent: existingDiscount.discountPercent,
          discountAmount: existingDiscount.discountAmount,
          originalAmount: existingDiscount.originalAmount,
          finalAmount: existingDiscount.finalAmount,
          currency: (booking.pricing as any)?.currency || 'AED',
          currentBookingCount: existingDiscount.bookingCount,
          message: 'Bulk discount already applied to this booking',
        };
      }

      // Get customer ID
      const customerId = options.customerId
        ? (typeof options.customerId === 'string'
            ? new Types.ObjectId(options.customerId)
            : options.customerId)
        : (booking.customerId as Types.ObjectId);

      // Get customer stats (exclude current booking)
      const stats = await this.getCustomerStats(customerId);
      const currentBookingCount = stats.totalBookings; // Not counting current booking yet

      // Get applicable tier
      const tier = this.getApplicableTier(currentBookingCount + 1);

      if (!tier) {
        return {
          eligible: false,
          discountPercent: 0,
          discountAmount: 0,
          originalAmount: (booking.pricing as any)?.totalAmount || 0,
          finalAmount: (booking.pricing as any)?.totalAmount || 0,
          currency: (booking.pricing as any)?.currency || 'AED',
          currentBookingCount,
          message: 'Book more services to unlock bulk discounts',
        };
      }

      const originalAmount = (booking.pricing as any)?.totalAmount || 0;
      let discountPercent = tier.discountPercent;

      // Cap discount at max
      discountPercent = Math.min(discountPercent, this.config.maxDiscountPercent);

      const discountAmount = Math.round(originalAmount * (discountPercent / 100) * 100) / 100;
      const finalAmount = originalAmount - discountAmount;

      const shouldApply = options.autoApply ?? this.config.autoApply;

      return {
        eligible: true,
        discountPercent,
        discountAmount,
        originalAmount,
        finalAmount,
        currency: (booking.pricing as any)?.currency || 'AED',
        currentTier: tier,
        currentBookingCount: currentBookingCount + 1,
        message: shouldApply
          ? `Bulk discount applied: ${tier.label}`
          : `You qualify for ${tier.label}! Apply it to save ${discountAmount} AED`,
      };
    } catch (error) {
      logger.error('Error calculating bulk discount', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        eligible: false,
        discountPercent: 0,
        discountAmount: 0,
        originalAmount: 0,
        finalAmount: 0,
        currency: 'AED',
        currentBookingCount: 0,
      };
    }
  }

  /**
   * Apply bulk discount to a booking
   */
  async applyDiscount(
    bookingId: string | Types.ObjectId,
    options: {
      customerId?: string | Types.ObjectId;
      discountPercent?: number;
    } = {}
  ): Promise<{ success: boolean; record?: BulkDiscountRecord; error?: string }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      // Calculate discount
      const calculation = await this.calculateDiscount(bookingObjectId, {
        customerId: options.customerId,
        autoApply: true,
      });

      if (!calculation.eligible) {
        return { success: false, error: 'Not eligible for bulk discount' };
      }

      // Get booking
      const booking = await Booking.findById(bookingObjectId)
        .populate('serviceId')
        .populate('customerId');

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      const discountId = this.generateDiscountId();
      const customerObjectId = (booking.customerId as Types.ObjectId) || new Types.ObjectId();

      // Create record
      const record: BulkDiscountRecord = {
        _id: new Types.ObjectId(),
        discountId,
        bookingId: bookingObjectId,
        bookingNumber: booking.bookingNumber,
        customerId: customerObjectId,
        customerName: (booking.customerId as any)?.firstName
          ? `${(booking.customerId as any).firstName} ${(booking.customerId as any).lastName || ''}`.trim()
          : 'Unknown',
        discountTier: calculation.currentTier!,
        originalAmount: calculation.originalAmount,
        discountAmount: calculation.discountAmount,
        finalAmount: calculation.finalAmount,
        currency: calculation.currency,
        bookingCount: calculation.currentBookingCount,
        appliedAt: new Date(),
        metadata: {
          categoryId: (booking.serviceId as any)?.category,
          serviceName: (booking.serviceId as any)?.name,
        },
      };

      // Update booking pricing
      booking.pricing = booking.pricing || {};
      const pricing = booking.pricing as any;

      pricing.bulkDiscount = {
        discountId,
        discountPercent: calculation.discountPercent,
        discountAmount: calculation.discountAmount,
        originalAmount: calculation.originalAmount,
        tierLabel: calculation.currentTier?.label,
        bookingCount: calculation.currentBookingCount,
        appliedAt: new Date(),
      };

      // Add discount to pricing discounts array
      pricing.discounts = pricing.discounts || [];
      pricing.discounts.push({
        type: 'bulk',
        code: `BULK-${calculation.currentBookingCount}`,
        amount: calculation.discountAmount,
        description: calculation.currentTier?.label,
      });

      // Recalculate total
      const subtotal = pricing.subtotal || calculation.originalAmount;
      const otherDiscounts = pricing.discounts
        .filter((d: any) => d.type !== 'bulk')
        .reduce((sum: number, d: any) => sum + d.amount, 0);
      pricing.totalAmount = Math.max(0, calculation.finalAmount);
      pricing.discount = calculation.discountAmount + otherDiscounts;

      await booking.save();

      logger.info('Bulk discount applied', {
        discountId,
        bookingId: bookingObjectId.toString(),
        tier: calculation.currentTier?.label,
        discountPercent: calculation.discountPercent,
        discountAmount: calculation.discountAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.BULK_DISCOUNT_APPLIED, {
        discountId,
        bookingId: bookingObjectId.toString(),
        customerId: customerObjectId.toString(),
        tier: calculation.currentTier?.label,
        discountPercent: calculation.discountPercent,
        discountAmount: calculation.discountAmount,
        bookingCount: calculation.currentBookingCount,
      });

      return { success: true, record };
    } catch (error) {
      logger.error('Error applying bulk discount', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply discount',
      };
    }
  }

  /**
   * Remove bulk discount from a booking
   */
  async removeDiscount(bookingId: string | Types.ObjectId): Promise<{ success: boolean; error?: string }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId);
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      const pricing = booking.pricing as any;
      if (!pricing?.bulkDiscount) {
        return { success: false, error: 'No bulk discount to remove' };
      }

      // Restore original amount
      const discountAmount = pricing.bulkDiscount.discountAmount;

      pricing.discounts = pricing.discounts?.filter((d: any) => d.type !== 'bulk') || [];
      pricing.totalAmount = (pricing.totalAmount || 0) + discountAmount;
      pricing.discount = (pricing.discount || 0) - discountAmount;
      delete pricing.bulkDiscount;

      await booking.save();

      logger.info('Bulk discount removed', { bookingId: bookingObjectId.toString() });
      return { success: true };
    } catch (error) {
      logger.error('Error removing bulk discount', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove discount',
      };
    }
  }

  /**
   * Get discount summary for a customer
   */
  async getDiscountSummary(customerId: string | Types.ObjectId): Promise<{
    totalDiscounts: number;
    totalSavings: number;
    averageDiscount: number;
    byTier: Record<string, { count: number; totalSavings: number }>;
    recentDiscounts: BulkDiscountRecord[];
  }> {
    const customerObjectId = typeof customerId === 'string'
      ? new Types.ObjectId(customerId)
      : customerId;

    const matchQuery: any = {
      customerId: customerObjectId,
      'pricing.bulkDiscount': { $exists: true },
    };

    const bookings = await Booking.find(matchQuery)
      .populate('serviceId', 'name')
      .sort({ scheduledDate: -1 })
      .limit(50);

    const byTier: Record<string, { count: number; totalSavings: number }> = {};
    let totalSavings = 0;

    for (const booking of bookings) {
      const bulkDiscount = (booking.pricing as any)?.bulkDiscount;
      if (bulkDiscount) {
        const tierLabel = bulkDiscount.tierLabel || 'Unknown';
        if (!byTier[tierLabel]) {
          byTier[tierLabel] = { count: 0, totalSavings: 0 };
        }
        byTier[tierLabel].count++;
        byTier[tierLabel].totalSavings += bulkDiscount.discountAmount;
        totalSavings += bulkDiscount.discountAmount;
      }
    }

    const recentDiscounts = bookings.slice(0, 10).map(b => ({
      _id: b._id,
      discountId: (b.pricing as any)?.bulkDiscount?.discountId || '',
      bookingId: b._id as Types.ObjectId,
      bookingNumber: b.bookingNumber,
      customerId: customerObjectId,
      customerName: 'Customer',
      discountTier: { minQuantity: 0, discountPercent: 0, label: '' },
      originalAmount: (b.pricing as any)?.bulkDiscount?.originalAmount || 0,
      discountAmount: (b.pricing as any)?.bulkDiscount?.discountAmount || 0,
      finalAmount: (b.pricing as any)?.totalAmount || 0,
      currency: (b.pricing as any)?.currency || 'AED',
      bookingCount: (b.pricing as any)?.bulkDiscount?.bookingCount || 0,
      appliedAt: (b.pricing as any)?.bulkDiscount?.appliedAt || b.scheduledDate,
      metadata: {
        serviceName: (b.serviceId as any)?.name,
      },
    }));

    return {
      totalDiscounts: bookings.length,
      totalSavings,
      averageDiscount: bookings.length > 0 ? totalSavings / bookings.length : 0,
      byTier,
      recentDiscounts,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateDiscountId(): string {
    return `BULK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const bulkDiscountService = new BulkDiscountService();
export default bulkDiscountService;
