import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type RushTier = 'same_day' | 'next_day' | 'within_48h' | 'standard';

export interface RushBookingConfig {
  enabled: boolean;
  tiers: {
    sameDay: { surchargePercent: number; label: string; priority: number };
    nextDay: { surchargePercent: number; label: string; priority: number };
    within48h: { surchargePercent: number; label: string; priority: number };
    standard: { surchargePercent: number; label: string; priority: number };
  };
  blackedOutCategories?: Types.ObjectId[];
  minBookingAmount: number;
  maxBookingAmount: number;
}

export interface RushBookingRecord {
  _id?: Types.ObjectId;
  bookingId: Types.ObjectId;
  bookingNumber: string;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  rushTier: RushTier;
  baseAmount: number;
  rushFee: number;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';
  slotAvailable: boolean;
  originalSlot?: string;
  rushSlot?: string;
  calculatedAt: Date;
  expiresAt: Date;
  metadata?: {
    hoursUntilService: number;
    serviceName?: string;
    customerName?: string;
    providerName?: string;
    categoryId?: Types.ObjectId;
    categoryName?: string;
  };
}

export interface AvailableSlot {
  time: string;
  isAvailable: boolean;
  isRushPriority: boolean;
  surcharge?: number;
}

export interface RushPricingResult {
  eligible: boolean;
  rushTier?: RushTier;
  tierLabel?: string;
  surchargePercent: number;
  baseAmount: number;
  rushFee: number;
  totalAmount: number;
  currency: string;
  hoursUntilService: number;
  reason?: string;
  availableSlots?: AvailableSlot[];
}

// Default configuration
const DEFAULT_CONFIG: RushBookingConfig = {
  enabled: true,
  tiers: {
    sameDay: { surchargePercent: 25, label: 'Same Day', priority: 1 },
    nextDay: { surchargePercent: 15, label: 'Next Day', priority: 2 },
    within48h: { surchargePercent: 10, label: 'Within 48 Hours', priority: 3 },
    standard: { surchargePercent: 0, label: 'Standard', priority: 4 },
  },
  minBookingAmount: 0,
  maxBookingAmount: 10000,
};

// ============================================
// Rush Booking Fee Service
// ============================================

export class RushBookingFeeService {
  private config: RushBookingConfig = DEFAULT_CONFIG;

  private getTierConfig(tier: RushTier) {
    const tierMap: Record<RushTier, keyof RushBookingConfig['tiers']> = {
      same_day: 'sameDay',
      next_day: 'nextDay',
      within_48h: 'within48h',
      standard: 'standard',
    };
    return this.config.tiers[tierMap[tier]];
  }

  /**
   * Initialize the service with custom configuration
   */
  async initialize(config: Partial<RushBookingConfig>): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('RushBookingFeeService initialized', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): RushBookingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<RushBookingConfig>): Promise<RushBookingConfig> {
    this.config = { ...this.config, ...updates };
    logger.info('RushBookingFeeService config updated', { config: this.config });
    return this.config;
  }

  /**
   * Determine rush tier based on hours until service
   */
  determineRushTier(hoursUntilService: number): RushTier {
    if (hoursUntilService <= 24) {
      return 'same_day';
    } else if (hoursUntilService <= 48) {
      return 'next_day';
    } else if (hoursUntilService <= 72) {
      return 'within_48h';
    }
    return 'standard';
  }

  /**
   * Calculate hours until a given date/time
   */
  calculateHoursUntilService(scheduledDate: Date): number {
    const now = new Date();
    const diff = scheduledDate.getTime() - now.getTime();
    return Math.max(0, diff / (1000 * 60 * 60));
  }

  /**
   * Check if a booking qualifies for rush pricing
   */
  async checkEligibility(
    bookingId: string | Types.ObjectId,
    providerId: string | Types.ObjectId
  ): Promise<{ eligible: boolean; reason?: string }> {
    if (!this.config.enabled) {
      return { eligible: false, reason: 'Rush booking is not enabled' };
    }

    const bookingObjectId = typeof bookingId === 'string'
      ? new Types.ObjectId(bookingId)
      : bookingId;

    const booking = await Booking.findById(bookingObjectId)
      .populate('serviceId')
      .populate('providerId');

    if (!booking) {
      return { eligible: false, reason: 'Booking not found' };
    }

    // Check booking amount limits
    const totalAmount = (booking.pricing as any)?.totalAmount || 0;
    if (totalAmount < this.config.minBookingAmount) {
      return { eligible: false, reason: 'Booking amount below minimum threshold' };
    }
    if (totalAmount > this.config.maxBookingAmount) {
      return { eligible: false, reason: 'Booking amount exceeds maximum threshold' };
    }

    // Check if provider accepts rush bookings
    const provider = booking.providerId as any;
    if (provider && !provider.acceptsRushBookings) {
      return { eligible: false, reason: 'Provider does not accept rush bookings' };
    }

    // Check category restrictions
    const service = booking.serviceId as any;
    if (service?.category && this.config.blackedOutCategories?.length) {
      if (this.config.blackedOutCategories.some(
        cat => cat.toString() === service.category.toString()
      )) {
        return { eligible: false, reason: 'Service category not eligible for rush booking' };
      }
    }

    // Check if service is already scheduled (can't rush an already completed service)
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return { eligible: false, reason: 'Booking is already completed or cancelled' };
    }

    return { eligible: true };
  }

  /**
   * Get available time slots for rush booking
   */
  async getAvailableSlots(
    providerId: string | Types.ObjectId,
    serviceId: string | Types.ObjectId,
    date: Date,
    options: { duration?: number } = {}
  ): Promise<{ success: boolean; slots?: AvailableSlot[]; error?: string }> {
    try {
      const providerObjectId = typeof providerId === 'string'
        ? new Types.ObjectId(providerId)
        : providerId;

      const serviceObjectId = typeof serviceId === 'string'
        ? new Types.ObjectId(serviceId)
        : serviceId;

      // Get service duration
      const service = await Service.findById(serviceObjectId);
      const duration = options.duration || service?.duration || 60;

      // Generate time slots (9 AM to 8 PM, 30-min intervals)
      const slots: AvailableSlot[] = [];
      const requestedDate = new Date(date);
      const now = new Date();
      const hoursUntil = this.calculateHoursUntilService(requestedDate);
      const rushTier = this.determineRushTier(hoursUntil);

      for (let hour = 9; hour < 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

          // Check if slot is in the past
          const slotDate = new Date(requestedDate);
          slotDate.setHours(hour, minute, 0, 0);

          if (slotDate <= now) {
            continue;
          }

          // Check if slot conflicts with existing bookings
          const existingBooking = await Booking.findOne({
            providerId: providerObjectId,
            scheduledDate: requestedDate,
            scheduledTime: slotTime,
            status: { $nin: ['cancelled', 'completed'] },
          });

          const isAvailable = !existingBooking;
          const isRushPriority = rushTier !== 'standard' && isAvailable;
          const surcharge = isRushPriority
            ? this.getTierConfig(rushTier).surchargePercent
            : 0;

          slots.push({
            time: slotTime,
            isAvailable,
            isRushPriority,
            surcharge: isRushPriority ? surcharge : undefined,
          });
        }
      }

      return { success: true, slots };
    } catch (error) {
      logger.error('Error getting available slots', {
        providerId: providerId.toString(),
        date: date.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get available slots',
      };
    }
  }

  /**
   * Calculate rush booking fee for a booking
   */
  async calculateRushFee(
    bookingId: string | Types.ObjectId,
    options: { forceRushTier?: RushTier } = {}
  ): Promise<RushPricingResult> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId)
        .populate('serviceId')
        .populate('customerId')
        .populate('providerId');

      if (!booking) {
        return {
          eligible: false,
          surchargePercent: 0,
          baseAmount: 0,
          rushFee: 0,
          totalAmount: 0,
          currency: 'AED',
          hoursUntilService: 0,
          reason: 'Booking not found',
        };
      }

      const baseAmount = (booking.pricing as any)?.totalAmount || 0;
      const currency = (booking.pricing as any)?.currency || 'AED';
      const hoursUntilService = this.calculateHoursUntilService(booking.scheduledDate);
      const rushTier = options.forceRushTier || this.determineRushTier(hoursUntilService);

      // Check eligibility
      const eligibility = await this.checkEligibility(bookingObjectId, booking.providerId);
      if (!eligibility.eligible) {
        return {
          eligible: false,
          surchargePercent: 0,
          baseAmount,
          rushFee: 0,
          totalAmount: baseAmount,
          currency,
          hoursUntilService,
          reason: eligibility.reason,
        };
      }

      // Get rush tier config
      const tierConfig = this.getTierConfig(rushTier);
      const surchargePercent = tierConfig.surchargePercent;
      const rushFee = Math.round(baseAmount * (surchargePercent / 100) * 100) / 100;
      const totalAmount = baseAmount + rushFee;

      // Get available slots if rush tier applies
      let availableSlots: AvailableSlot[] | undefined;
      if (rushTier !== 'standard') {
        const slotsResult = await this.getAvailableSlots(
          booking.providerId,
          booking.serviceId,
          booking.scheduledDate
        );
        if (slotsResult.success) {
          availableSlots = slotsResult.slots;
        }
      }

      return {
        eligible: true,
        rushTier,
        tierLabel: tierConfig.label,
        surchargePercent,
        baseAmount,
        rushFee,
        totalAmount,
        currency,
        hoursUntilService,
        availableSlots,
      };
    } catch (error) {
      logger.error('Error calculating rush fee', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        eligible: false,
        surchargePercent: 0,
        baseAmount: 0,
        rushFee: 0,
        totalAmount: 0,
        currency: 'AED',
        hoursUntilService: 0,
        reason: error instanceof Error ? error.message : 'Failed to calculate rush fee',
      };
    }
  }

  /**
   * Apply rush pricing to a booking
   */
  async applyRushPricing(
    bookingId: string | Types.ObjectId,
    selectedSlot?: string
  ): Promise<{ success: boolean; record?: RushBookingRecord; error?: string }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      // Calculate rush fee
      const pricing = await this.calculateRushFee(bookingObjectId);

      if (!pricing.eligible) {
        return { success: false, error: pricing.reason };
      }

      const booking = await Booking.findById(bookingObjectId)
        .populate('serviceId')
        .populate('customerId')
        .populate('providerId');

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      const service = booking.serviceId as any;
      const customer = booking.customerId as any;
      const provider = booking.providerId as any;

      // Update booking with rush pricing
      booking.pricing = booking.pricing || {};
      (booking.pricing as any).rushFee = pricing.rushFee;
      (booking.pricing as any).rushTier = pricing.rushTier;
      (booking.pricing as any).totalAmount = pricing.totalAmount;

      if (selectedSlot) {
        booking.scheduledTime = selectedSlot;
        (booking.metadata as any) = booking.metadata || {};
        (booking.metadata as any).rushSlot = selectedSlot;
      }

      await booking.save();

      // Create rush booking record
      const record: RushBookingRecord = {
        _id: new Types.ObjectId(),
        bookingId: bookingObjectId,
        bookingNumber: booking.bookingNumber,
        customerId: (booking.customerId as Types.ObjectId) || new Types.ObjectId(),
        providerId: booking.providerId as Types.ObjectId,
        serviceId: booking.serviceId as Types.ObjectId,
        rushTier: pricing.rushTier!,
        baseAmount: pricing.baseAmount,
        rushFee: pricing.rushFee,
        totalAmount: pricing.totalAmount,
        currency: pricing.currency,
        status: 'pending',
        slotAvailable: pricing.availableSlots?.some(s => s.isAvailable) || false,
        originalSlot: booking.scheduledTime,
        rushSlot: selectedSlot,
        calculatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        metadata: {
          hoursUntilService: pricing.hoursUntilService,
          serviceName: service?.name,
          customerName: customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : undefined,
          providerName: provider ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim() : undefined,
          categoryId: service?.category,
          categoryName: service?.categoryName,
        },
      };

      logger.info('Rush pricing applied', {
        bookingId: bookingObjectId.toString(),
        rushTier: pricing.rushTier,
        baseAmount: pricing.baseAmount,
        rushFee: pricing.rushFee,
        totalAmount: pricing.totalAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.RUSH_BOOKING_APPLIED, {
        bookingId: bookingObjectId.toString(),
        bookingNumber: booking.bookingNumber,
        rushTier: pricing.rushTier,
        rushFee: pricing.rushFee,
        totalAmount: pricing.totalAmount,
        providerId: booking.providerId.toString(),
        customerId: (booking.customerId as Types.ObjectId)?.toString(),
      });

      return { success: true, record };
    } catch (error) {
      logger.error('Error applying rush pricing', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply rush pricing',
      };
    }
  }

  /**
   * Update rush booking status
   */
  async updateStatus(
    bookingId: string | Types.ObjectId,
    newStatus: RushBookingRecord['status']
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId);
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      if (!(booking.metadata as any)?.rushFee) {
        return { success: false, error: 'No rush booking record found' };
      }

      (booking.metadata as any).rushStatus = newStatus;
      (booking.metadata as any).rushStatusUpdatedAt = new Date();
      await booking.save();

      logger.info('Rush booking status updated', {
        bookingId: bookingObjectId.toString(),
        newStatus,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error updating rush booking status', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  }

  /**
   * Get provider's rush booking statistics
   */
  async getProviderStats(
    providerId: string | Types.ObjectId,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<{
    totalRushBookings: number;
    totalRushRevenue: number;
    byTier: Record<RushTier, { count: number; revenue: number }>;
    averageRushFee: number;
    topCategory: { name: string; count: number } | null;
  }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const query: any = {
      providerId: providerObjectId,
      'metadata.rushFee': { $exists: true, $gt: 0 },
    };

    if (options.startDate || options.endDate) {
      query.scheduledDate = {};
      if (options.startDate) query.scheduledDate.$gte = options.startDate;
      if (options.endDate) query.scheduledDate.$lte = options.endDate;
    }

    const bookings = await Booking.find(query);

    const byTier: Record<RushTier, { count: number; revenue: number }> = {
      same_day: { count: 0, revenue: 0 },
      next_day: { count: 0, revenue: 0 },
      within_48h: { count: 0, revenue: 0 },
      standard: { count: 0, revenue: 0 },
    };

    let totalRushRevenue = 0;
    const categoryMap = new Map<string, number>();

    for (const booking of bookings) {
      const rushTier = ((booking.metadata as any)?.rushTier || 'standard') as RushTier;
      const rushFee = (booking.metadata as any)?.rushFee || 0;

      byTier[rushTier].count++;
      byTier[rushTier].revenue += rushFee;
      totalRushRevenue += rushFee;

      const categoryName = (booking.metadata as any)?.categoryName || 'Unknown';
      categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
    }

    const rushBookings = bookings.filter(b => (b.metadata as any)?.rushFee > 0);
    const topCategoryEntry = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalRushBookings: rushBookings.length,
      totalRushRevenue,
      byTier,
      averageRushFee: rushBookings.length > 0 ? totalRushRevenue / rushBookings.length : 0,
      topCategory: topCategoryEntry
        ? { name: topCategoryEntry[0], count: topCategoryEntry[1] }
        : null,
    };
  }

  /**
   * Process rush booking on completion
   */
  async processOnCompletion(bookingId: string | Types.ObjectId): Promise<void> {
    await this.updateStatus(bookingId, 'completed');
  }

  /**
   * Process rush booking on cancellation (handle refunds)
   */
  async processOnCancellation(
    bookingId: string | Types.ObjectId,
    refundAmount: number = 0
  ): Promise<{ refundDue: number }> {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    const rushFee = (booking.metadata as any)?.rushFee || 0;
    if (rushFee <= 0) {
      return { refundDue: 0 };
    }

    const originalAmount = (booking.pricing as any)?.totalAmount || 0;
    const hoursUntilService = this.calculateHoursUntilService(booking.scheduledDate);
    const rushTier = this.determineRushTier(hoursUntilService);

    // Refund policy: full rush fee refund if cancelled >24h before
    if (hoursUntilService > 24) {
      await this.updateStatus(bookingId, 'refunded');
      return { refundDue: rushFee };
    }

    // Partial refund (50%) if cancelled between 12-24h before
    if (hoursUntilService > 12) {
      const partialRefund = rushFee * 0.5;
      await this.updateStatus(bookingId, 'cancelled');
      return { refundDue: partialRefund };
    }

    // No refund if cancelled <12h before
    await this.updateStatus(bookingId, 'cancelled');
    return { refundDue: 0 };
  }
}

// ============================================
// Export singleton instance
// ============================================

export const rushBookingFeeService = new RushBookingFeeService();
export default rushBookingFeeService;
