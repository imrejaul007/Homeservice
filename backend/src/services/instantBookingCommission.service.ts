import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export interface InstantBookingConfig {
  enabled: boolean;
  commissionRate: number; // Extra commission rate for instant booking
  minBookingAmount: number;
  maxBookingAmount: number;
  allowedCategories?: Types.ObjectId[];
}

export interface InstantBookingRecord {
  _id?: Types.ObjectId;
  bookingId: Types.ObjectId;
  bookingNumber: string;
  providerId: Types.ObjectId;
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  baseAmount: number;
  instantBookingFee: number;
  extraCommission: number;
  totalAmount: number;
  currency: string;
  bookingType: 'instant' | 'standard';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';
  calculatedAt: Date;
  metadata?: {
    categoryId?: Types.ObjectId;
    categoryName?: string;
    serviceName?: string;
    providerName?: string;
    customerName?: string;
  };
}

export interface RevenueReport {
  period: { start: Date; end: Date };
  totalInstantBookings: number;
  totalStandardBookings: number;
  totalInstantRevenue: number;
  totalStandardRevenue: number;
  totalExtraCommission: number;
  averageInstantFee: number;
  conversionRate: number;
  byCategory: Array<{
    categoryId: Types.ObjectId;
    categoryName: string;
    instantBookings: number;
    revenue: number;
    extraCommission: number;
  }>;
}

// Default configuration
const DEFAULT_CONFIG: InstantBookingConfig = {
  enabled: true,
  commissionRate: 5, // 5% extra commission for instant booking
  minBookingAmount: 0,
  maxBookingAmount: 10000,
};

// ============================================
// Instant Booking Commission Service
// ============================================

export class InstantBookingCommissionService {
  private config: InstantBookingConfig = DEFAULT_CONFIG;

  /**
   * Initialize the service with custom configuration
   */
  async initialize(config: Partial<InstantBookingConfig>): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('InstantBookingCommissionService initialized', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): InstantBookingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<InstantBookingConfig>): Promise<InstantBookingConfig> {
    this.config = { ...this.config, ...updates };
    logger.info('InstantBookingCommissionService config updated', { config: this.config });
    return this.config;
  }

  /**
   * Check if a booking qualifies for instant booking
   */
  async qualifiesForInstantBooking(
    bookingId: string | Types.ObjectId,
    providerId: string | Types.ObjectId
  ): Promise<{ qualifies: boolean; reason?: string }> {
    const booking = await Booking.findById(bookingId).populate('serviceId');

    if (!booking) {
      return { qualifies: false, reason: 'Booking not found' };
    }

    // Check if instant booking is enabled
    if (!this.config.enabled) {
      return { qualifies: false, reason: 'Instant booking is not enabled' };
    }

    // Check booking amount limits
    const totalAmount = (booking.pricing as any)?.totalAmount || 0;
    if (totalAmount < this.config.minBookingAmount) {
      return { qualifies: false, reason: 'Booking amount below minimum threshold' };
    }
    if (totalAmount > this.config.maxBookingAmount) {
      return { qualifies: false, reason: 'Booking amount exceeds maximum threshold' };
    }

    // Check category restrictions
    if (this.config.allowedCategories && this.config.allowedCategories.length > 0) {
      const service = booking.serviceId as any;
      if (service?.category && !this.config.allowedCategories.some(
        cat => cat.toString() === service.category.toString()
      )) {
        return { qualifies: false, reason: 'Service category not eligible for instant booking' };
      }
    }

    // Check provider eligibility (e.g., verified providers only)
    const User = mongoose.model('User');
    const provider = await User.findById(providerId);
    if (!provider) {
      return { qualifies: false, reason: 'Provider not found' };
    }

    // Provider must be active
    if ((provider as any).status !== 'active') {
      return { qualifies: false, reason: 'Provider is not active' };
    }

    return { qualifies: true };
  }

  /**
   * Calculate instant booking commission for a booking
   */
  async calculateInstantCommission(
    bookingId: string | Types.ObjectId,
    options: { isInstant?: boolean; overrideRate?: number } = {}
  ): Promise<{
    success: boolean;
    record?: InstantBookingRecord;
    error?: string;
  }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId)
        .populate('serviceId')
        .populate('customerId');

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Get base amounts from booking
      const baseAmount = (booking.pricing as any)?.totalAmount || 0;
      const currency = (booking.pricing as any)?.currency || 'AED';
      const isInstant = options.isInstant ?? false;

      if (!isInstant) {
        // Standard booking - no extra commission
        return {
          success: true,
          record: {
            _id: new Types.ObjectId(),
            bookingId: bookingObjectId,
            bookingNumber: booking.bookingNumber,
            providerId: booking.providerId as Types.ObjectId,
            customerId: (booking.customerId as Types.ObjectId) || new Types.ObjectId(),
            serviceId: booking.serviceId as Types.ObjectId,
            baseAmount,
            instantBookingFee: 0,
            extraCommission: 0,
            totalAmount: baseAmount,
            currency,
            bookingType: 'standard',
            status: 'pending',
            calculatedAt: new Date(),
          },
        };
      }

      // Calculate instant booking fee and extra commission
      const rate = options.overrideRate ?? this.config.commissionRate;
      const instantBookingFee = Math.round(baseAmount * (rate / 100) * 100) / 100;
      const extraCommission = instantBookingFee; // Extra commission equals the fee
      const totalAmount = baseAmount + instantBookingFee;

      // Get metadata for reporting
      const service = booking.serviceId as any;
      const customer = booking.customerId as any;
      let categoryId: Types.ObjectId | undefined;
      let categoryName: string | undefined;
      let serviceName: string | undefined;
      let providerName: string | undefined;
      let customerName: string | undefined;

      if (service) {
        categoryId = service.category;
        categoryName = service.categoryName || 'Unknown';
        serviceName = service.name || 'Unknown Service';
      }

      if (customer) {
        customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown';
      }

      // Get provider name
      const User = mongoose.model('User');
      const provider = await User.findById(booking.providerId);
      if (provider) {
        providerName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Unknown';
      }

      const record: InstantBookingRecord = {
        _id: new Types.ObjectId(),
        bookingId: bookingObjectId,
        bookingNumber: booking.bookingNumber,
        providerId: booking.providerId as Types.ObjectId,
        customerId: (booking.customerId as Types.ObjectId) || new Types.ObjectId(),
        serviceId: booking.serviceId as Types.ObjectId,
        baseAmount,
        instantBookingFee,
        extraCommission,
        totalAmount,
        currency,
        bookingType: 'instant',
        status: 'pending',
        calculatedAt: new Date(),
        metadata: {
          categoryId,
          categoryName,
          serviceName,
          providerName,
          customerName,
        },
      };

      // Update booking with instant booking info
      booking.metadata = booking.metadata || {};
      (booking.metadata as any).instantBooking = {
        fee: instantBookingFee,
        extraCommission,
        bookingType: 'instant',
        calculatedAt: new Date(),
      };
      await booking.save();

      logger.info('Instant booking commission calculated', {
        bookingId: bookingObjectId.toString(),
        baseAmount,
        instantBookingFee,
        extraCommission,
        totalAmount,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.INSTANT_BOOKING_COMMISSION_CALCULATED, {
        bookingId: bookingObjectId.toString(),
        bookingNumber: booking.bookingNumber,
        baseAmount,
        instantBookingFee,
        extraCommission,
        providerId: booking.providerId.toString(),
      });

      return { success: true, record };
    } catch (error) {
      logger.error('Error calculating instant booking commission', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate commission',
      };
    }
  }

  /**
   * Update instant booking status
   */
  async updateStatus(
    bookingId: string | Types.ObjectId,
    newStatus: InstantBookingRecord['status']
  ): Promise<{ success: boolean; record?: any; error?: string }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId);
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      const instantBooking = (booking.metadata as any)?.instantBooking;
      if (!instantBooking) {
        return { success: false, error: 'No instant booking record found' };
      }

      instantBooking.status = newStatus;
      instantBooking.updatedAt = new Date();
      await booking.save();

      logger.info('Instant booking status updated', {
        bookingId: bookingObjectId.toString(),
        newStatus,
      });

      return { success: true, record: instantBooking };
    } catch (error) {
      logger.error('Error updating instant booking status', {
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
   * Generate revenue report for instant booking
   */
  async generateRevenueReport(
    startDate: Date,
    endDate: Date,
    options: {
      providerId?: string | Types.ObjectId;
      categoryId?: string | Types.ObjectId;
    } = {}
  ): Promise<RevenueReport> {
    const query: any = {
      'metadata.bookingDate': { $gte: startDate, $lte: endDate },
      'metadata.instantBooking': { $exists: true, $ne: null },
    };

    if (options.providerId) {
      query.providerId = typeof options.providerId === 'string'
        ? new Types.ObjectId(options.providerId)
        : options.providerId;
    }

    if (options.categoryId) {
      query['metadata.categoryId'] = typeof options.categoryId === 'string'
        ? new Types.ObjectId(options.categoryId)
        : options.categoryId;
    }

    const bookings = await Booking.find(query);

    let totalInstantBookings = 0;
    let totalStandardBookings = 0;
    let totalInstantRevenue = 0;
    let totalStandardRevenue = 0;
    let totalExtraCommission = 0;
    const categoryMap = new Map<string, {
      categoryId: string;
      categoryName: string;
      instantBookings: number;
      revenue: number;
      extraCommission: number;
    }>();

    for (const booking of bookings) {
      const instantBooking = (booking.metadata as any)?.instantBooking;
      const totalAmount = (booking.pricing as any)?.totalAmount || 0;
      const categoryId = (booking.metadata as any)?.categoryId?.toString() || 'unknown';
      const categoryName = (booking.metadata as any)?.categoryName || 'Unknown';

      if (instantBooking?.bookingType === 'instant') {
        totalInstantBookings++;
        totalInstantRevenue += totalAmount;
        totalExtraCommission += instantBooking.extraCommission || 0;
      } else {
        totalStandardBookings++;
        totalStandardRevenue += totalAmount;
      }

      // Track by category
      const existing = categoryMap.get(categoryId) || {
        categoryId,
        categoryName,
        instantBookings: 0,
        revenue: 0,
        extraCommission: 0,
      };

      if (instantBooking?.bookingType === 'instant') {
        existing.instantBookings++;
        existing.revenue += totalAmount;
        existing.extraCommission += instantBooking.extraCommission || 0;
      }
      categoryMap.set(categoryId, existing);
    }

    const totalBookings = totalInstantBookings + totalStandardBookings;
    const conversionRate = totalBookings > 0
      ? Math.round((totalInstantBookings / totalBookings) * 10000) / 100
      : 0;

    return {
      period: { start: startDate, end: endDate },
      totalInstantBookings,
      totalStandardBookings,
      totalInstantRevenue,
      totalStandardRevenue,
      totalExtraCommission,
      averageInstantFee: totalInstantBookings > 0
        ? Math.round((totalExtraCommission / totalInstantBookings) * 100) / 100
        : 0,
      conversionRate,
      byCategory: Array.from(categoryMap.values()).map(c => ({
        categoryId: new Types.ObjectId(c.categoryId),
        categoryName: c.categoryName,
        instantBookings: c.instantBookings,
        revenue: c.revenue,
        extraCommission: c.extraCommission,
      })),
    };
  }

  /**
   * Get provider's instant booking statistics
   */
  async getProviderStats(
    providerId: string | Types.ObjectId,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<{
    totalInstantBookings: number;
    totalExtraCommissionPaid: number;
    averageBookingValue: number;
    topCategories: Array<{ categoryName: string; count: number }>;
  }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const query: any = {
      providerId: providerObjectId,
      'metadata.instantBooking.bookingType': 'instant',
    };

    if (options.startDate || options.endDate) {
      query.scheduledDate = {};
      if (options.startDate) query.scheduledDate.$gte = options.startDate;
      if (options.endDate) query.scheduledDate.$lte = options.endDate;
    }

    const bookings = await Booking.find(query);
    const categoryMap = new Map<string, number>();

    let totalExtraCommission = 0;
    let totalAmount = 0;

    for (const booking of bookings) {
      const instantBooking = (booking.metadata as any)?.instantBooking;
      totalExtraCommission += instantBooking?.extraCommission || 0;
      totalAmount += (booking.pricing as any)?.totalAmount || 0;

      const categoryName = (booking.metadata as any)?.categoryName || 'Unknown';
      categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
    }

    const topCategories = Array.from(categoryMap.entries())
      .map(([categoryName, count]) => ({ categoryName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalInstantBookings: bookings.length,
      totalExtraCommissionPaid: totalExtraCommission,
      averageBookingValue: bookings.length > 0 ? totalAmount / bookings.length : 0,
      topCategories,
    };
  }

  /**
   * Process instant booking on booking completion
   */
  async processOnCompletion(bookingId: string | Types.ObjectId): Promise<void> {
    await this.updateStatus(bookingId, 'completed');
  }

  /**
   * Process instant booking on booking cancellation
   */
  async processOnCancellation(
    bookingId: string | Types.ObjectId,
    refundAmount: number = 0
  ): Promise<{ refundDue: number }> {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    const instantBooking = (booking.metadata as any)?.instantBooking;
    if (!instantBooking || instantBooking.bookingType !== 'instant') {
      return { refundDue: 0 };
    }

    // Calculate refund proportionally
    const originalAmount = (booking.pricing as any)?.totalAmount || 0;
    const instantFee = instantBooking.instantBookingFee || 0;

    // Full refund of instant booking fee if booking is fully refunded
    if (refundAmount >= originalAmount) {
      await this.updateStatus(bookingId, 'refunded');
      return { refundDue: instantFee };
    }

    // Partial refund
    const refundRatio = refundAmount / originalAmount;
    const instantFeeRefund = Math.round(instantFee * refundRatio * 100) / 100;

    await this.updateStatus(bookingId, 'cancelled');
    return { refundDue: instantFeeRefund };
  }
}

// ============================================
// Export singleton instance
// ============================================

export const instantBookingCommissionService = new InstantBookingCommissionService();
export default instantBookingCommissionService;
