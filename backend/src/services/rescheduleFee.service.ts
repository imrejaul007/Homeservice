import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type RescheduleTier = 'free' | 'low' | 'medium' | 'high';

export interface RescheduleConfig {
  enabled: boolean;
  tiers: {
    free: { maxHoursBeforeService: number; surchargePercent: number; label: string };
    low: { minHoursBeforeService: number; maxHoursBeforeService: number; surchargePercent: number; label: string };
    medium: { minHoursBeforeService: number; maxHoursBeforeService: number; surchargePercent: number; label: string };
    high: { minHoursBeforeService: number; surchargePercent: number; label: string };
  };
  noNotice: { surchargePercent: number; label: string };
  maxReschedulesPerBooking: number;
  allowProviderInitiated: boolean;
  providerInitiatedFee: number;
}

export interface RescheduleRecord {
  _id?: Types.ObjectId;
  rescheduleId: string;
  bookingId: Types.ObjectId;
  bookingNumber: string;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  initiatedBy: 'customer' | 'provider' | 'system';
  previousDate: Date;
  previousTime: string;
  newDate: Date;
  newTime: string;
  reason?: string;
  rescheduleTier: RescheduleTier;
  baseAmount: number;
  rescheduleFee: number;
  totalAmount: number;
  currency: string;
  isNoNotice: boolean;
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded';
  refundAmount?: number;
  createdAt: Date;
  processedAt?: Date;
}

export interface RescheduleEligibility {
  eligible: boolean;
  canReschedule: boolean;
  currentRescheduleCount: number;
  maxReschedules: number;
  hoursUntilService: number;
  rescheduleTier?: RescheduleTier;
  surchargePercent?: number;
  rescheduleFee?: number;
  baseAmount?: number;
  totalAmount?: number;
  currency?: string;
  reason?: string;
}

// Default configuration
const DEFAULT_CONFIG: RescheduleConfig = {
  enabled: true,
  tiers: {
    free: { maxHoursBeforeService: 72, surchargePercent: 0, label: 'Free Reschedule' },
    low: { minHoursBeforeService: 24, maxHoursBeforeService: 72, surchargePercent: 10, label: 'Low Fee (10%)' },
    medium: { minHoursBeforeService: 0, maxHoursBeforeService: 24, surchargePercent: 25, label: 'Medium Fee (25%)' },
    high: { minHoursBeforeService: 0, surchargePercent: 50, label: 'High Fee (50%)' },
  },
  noNotice: { surchargePercent: 50, label: 'No Notice (50%)' },
  maxReschedulesPerBooking: 3,
  allowProviderInitiated: true,
  providerInitiatedFee: 0,
};

// ============================================
// Reschedule Fee Service
// ============================================

export class RescheduleFeeService {
  private config: RescheduleConfig = DEFAULT_CONFIG;

  /**
   * Initialize the service with custom configuration
   */
  async initialize(config: Partial<RescheduleConfig>): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('RescheduleFeeService initialized', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): RescheduleConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<RescheduleConfig>): Promise<RescheduleConfig> {
    this.config = { ...this.config, ...updates };
    logger.info('RescheduleFeeService config updated', { config: this.config });
    return this.config;
  }

  /**
   * Determine reschedule tier based on hours until service
   */
  determineRescheduleTier(hoursUntilService: number): RescheduleTier {
    if (hoursUntilService > 72) {
      return 'free';
    } else if (hoursUntilService > 24) {
      return 'low';
    } else if (hoursUntilService > 0) {
      return 'medium';
    }
    return 'high';
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
   * Check if a booking can be rescheduled
   */
  async checkEligibility(
    bookingId: string | Types.ObjectId,
    initiatedBy: 'customer' | 'provider' = 'customer'
  ): Promise<RescheduleEligibility> {
    const bookingObjectId = typeof bookingId === 'string'
      ? new Types.ObjectId(bookingId)
      : bookingId;

    const booking = await Booking.findById(bookingObjectId);

    if (!booking) {
      return {
        eligible: false,
        canReschedule: false,
        currentRescheduleCount: 0,
        maxReschedules: this.config.maxReschedulesPerBooking,
        hoursUntilService: 0,
        reason: 'Booking not found',
      };
    }

    // Check if booking can be rescheduled
    if (!this.config.enabled) {
      return {
        eligible: false,
        canReschedule: false,
        currentRescheduleCount: (booking.metadata as any)?.rescheduleCount || 0,
        maxReschedules: this.config.maxReschedulesPerBooking,
        hoursUntilService: this.calculateHoursUntilService(booking.scheduledDate),
        reason: 'Rescheduling is currently disabled',
      };
    }

    // Check booking status
    if (['cancelled', 'completed'].includes(booking.status)) {
      return {
        eligible: false,
        canReschedule: false,
        currentRescheduleCount: (booking.metadata as any)?.rescheduleCount || 0,
        maxReschedules: this.config.maxReschedulesPerBooking,
        hoursUntilService: 0,
        reason: `Cannot reschedule ${booking.status} bookings`,
      };
    }

    // Check provider initiated reschedule
    if (initiatedBy === 'provider' && !this.config.allowProviderInitiated) {
      return {
        eligible: false,
        canReschedule: false,
        currentRescheduleCount: (booking.metadata as any)?.rescheduleCount || 0,
        maxReschedules: this.config.maxReschedulesPerBooking,
        hoursUntilService: this.calculateHoursUntilService(booking.scheduledDate),
        reason: 'Provider-initiated rescheduling is not allowed',
      };
    }

    // Check reschedule count
    const currentRescheduleCount = (booking.metadata as any)?.rescheduleCount || 0;
    if (currentRescheduleCount >= this.config.maxReschedulesPerBooking) {
      return {
        eligible: false,
        canReschedule: false,
        currentRescheduleCount,
        maxReschedules: this.config.maxReschedulesPerBooking,
        hoursUntilService: this.calculateHoursUntilService(booking.scheduledDate),
        reason: `Maximum of ${this.config.maxReschedulesPerBooking} reschedules reached`,
      };
    }

    const hoursUntilService = this.calculateHoursUntilService(booking.scheduledDate);
    const baseAmount = (booking.pricing as any)?.totalAmount || 0;
    const rescheduleTier = this.determineRescheduleTier(hoursUntilService);

    // Calculate fee
    let surchargePercent = 0;
    if (rescheduleTier === 'free') {
      surchargePercent = this.config.tiers.free.surchargePercent;
    } else if (rescheduleTier === 'low') {
      surchargePercent = this.config.tiers.low.surchargePercent;
    } else if (rescheduleTier === 'medium') {
      surchargePercent = this.config.tiers.medium.surchargePercent;
    } else {
      surchargePercent = this.config.tiers.high.surchargePercent;
    }

    // For provider initiated, no fee (or fixed fee)
    if (initiatedBy === 'provider') {
      surchargePercent = this.config.providerInitiatedFee;
    }

    const rescheduleFee = Math.round(baseAmount * (surchargePercent / 100) * 100) / 100;
    const totalAmount = baseAmount + rescheduleFee;

    return {
      eligible: true,
      canReschedule: true,
      currentRescheduleCount,
      maxReschedules: this.config.maxReschedulesPerBooking,
      hoursUntilService,
      rescheduleTier,
      surchargePercent,
      rescheduleFee,
      baseAmount,
      totalAmount,
      currency: (booking.pricing as any)?.currency || 'AED',
      reason: surchargePercent > 0
        ? `Rescheduling fee applies (${surchargePercent}%) due to ${hoursUntilService < 24 ? 'less than 24 hours' : hoursUntilService < 72 ? '24-72 hours' : 'less than 72 hours'} notice`
        : 'Free reschedule available',
    };
  }

  /**
   * Calculate reschedule fee for a booking
   */
  async calculateFee(
    bookingId: string | Types.ObjectId,
    initiatedBy: 'customer' | 'provider' = 'customer'
  ): Promise<{
    success: boolean;
    baseAmount?: number;
    rescheduleFee?: number;
    totalAmount?: number;
    currency?: string;
    rescheduleTier?: RescheduleTier;
    surchargePercent?: number;
    hoursUntilService?: number;
    isNoNotice?: boolean;
    error?: string;
  }> {
    try {
      const bookingObjectId = typeof bookingId === 'string'
        ? new Types.ObjectId(bookingId)
        : bookingId;

      const booking = await Booking.findById(bookingObjectId);
      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      const hoursUntilService = this.calculateHoursUntilService(booking.scheduledDate);
      const baseAmount = (booking.pricing as any)?.totalAmount || 0;
      const currency = (booking.pricing as any)?.currency || 'AED';

      // Determine tier and calculate fee
      let surchargePercent = 0;
      let rescheduleTier: RescheduleTier = 'free';
      let isNoNotice = false;

      if (hoursUntilService > 72) {
        rescheduleTier = 'free';
        surchargePercent = 0;
      } else if (hoursUntilService > 24) {
        rescheduleTier = 'low';
        surchargePercent = this.config.tiers.low.surchargePercent;
      } else if (hoursUntilService > 0) {
        rescheduleTier = 'medium';
        surchargePercent = this.config.tiers.medium.surchargePercent;
      } else {
        rescheduleTier = 'high';
        surchargePercent = this.config.tiers.high.surchargePercent;
        isNoNotice = true;
      }

      // Provider initiated fee override
      if (initiatedBy === 'provider') {
        surchargePercent = this.config.providerInitiatedFee;
        rescheduleTier = 'free';
      }

      const rescheduleFee = Math.round(baseAmount * (surchargePercent / 100) * 100) / 100;
      const totalAmount = baseAmount + rescheduleFee;

      return {
        success: true,
        baseAmount,
        rescheduleFee,
        totalAmount,
        currency,
        rescheduleTier,
        surchargePercent,
        hoursUntilService,
        isNoNotice,
      };
    } catch (error) {
      logger.error('Error calculating reschedule fee', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate fee',
      };
    }
  }

  /**
   * Process reschedule request
   */
  async processReschedule(data: {
    bookingId: string | Types.ObjectId;
    initiatedBy: 'customer' | 'provider' | 'system';
    newDate: Date;
    newTime: string;
    reason?: string;
  }): Promise<{ success: boolean; record?: RescheduleRecord; error?: string }> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const bookingObjectId = typeof data.bookingId === 'string'
        ? new Types.ObjectId(data.bookingId)
        : data.bookingId;

      // Check eligibility
      const initiatedBy = data.initiatedBy === 'system' ? 'customer' : data.initiatedBy;
      const eligibility = await this.checkEligibility(bookingObjectId, initiatedBy);
      if (!eligibility.eligible) {
        await session.abortTransaction();
        return { success: false, error: eligibility.reason };
      }

      // Calculate fee
      const feeCalculation = await this.calculateFee(bookingObjectId, initiatedBy);
      if (!feeCalculation.success) {
        await session.abortTransaction();
        return { success: false, error: feeCalculation.error };
      }

      const booking = await Booking.findById(bookingObjectId).session(session);
      if (!booking) {
        await session.abortTransaction();
        return { success: false, error: 'Booking not found' };
      }

      const rescheduleId = this.generateRescheduleId();
      const rescheduleRecord: RescheduleRecord = {
        _id: new Types.ObjectId(),
        rescheduleId,
        bookingId: bookingObjectId,
        bookingNumber: booking.bookingNumber,
        customerId: (booking.customerId as Types.ObjectId) || new Types.ObjectId(),
        providerId: booking.providerId as Types.ObjectId,
        initiatedBy: data.initiatedBy,
        previousDate: booking.scheduledDate,
        previousTime: booking.scheduledTime,
        newDate: data.newDate,
        newTime: data.newTime,
        reason: data.reason,
        rescheduleTier: feeCalculation.rescheduleTier!,
        baseAmount: feeCalculation.baseAmount!,
        rescheduleFee: feeCalculation.rescheduleFee!,
        totalAmount: feeCalculation.totalAmount!,
        currency: feeCalculation.currency!,
        isNoNotice: feeCalculation.isNoNotice || false,
        status: 'pending',
        createdAt: new Date(),
      };

      // Update booking
      booking.scheduledDate = data.newDate;
      booking.scheduledTime = data.newTime;

      // Update metadata
      booking.metadata = booking.metadata || {};
      (booking.metadata as any).rescheduleCount = ((booking.metadata as any)?.rescheduleCount || 0) + 1;
      (booking.metadata as any).lastReschedule = {
        rescheduleId,
        previousDate: rescheduleRecord.previousDate,
        newDate: data.newDate,
        fee: feeCalculation.rescheduleFee,
        tier: feeCalculation.rescheduleTier,
        at: new Date(),
      };

      // Add reschedule fee to pricing
      if (feeCalculation.rescheduleFee! > 0) {
        booking.pricing = booking.pricing || {};
        const pricing = booking.pricing as any;
        pricing.rescheduleFee = feeCalculation.rescheduleFee;
        pricing.totalAmount = feeCalculation.totalAmount;
      }

      await booking.save({ session });

      await session.commitTransaction();

      logger.info('Reschedule processed', {
        rescheduleId,
        bookingId: bookingObjectId.toString(),
        tier: feeCalculation.rescheduleTier,
        fee: feeCalculation.rescheduleFee,
        initiatedBy: data.initiatedBy,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.BOOKING_RESCHEDULED, {
        rescheduleId,
        bookingId: bookingObjectId.toString(),
        bookingNumber: booking.bookingNumber,
        previousDate: rescheduleRecord.previousDate.toISOString(),
        newDate: data.newDate.toISOString(),
        tier: feeCalculation.rescheduleTier,
        fee: feeCalculation.rescheduleFee,
        initiatedBy: data.initiatedBy,
        providerId: booking.providerId.toString(),
        customerId: (booking.customerId as Types.ObjectId)?.toString(),
      });

      return { success: true, record: rescheduleRecord };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error processing reschedule', {
        bookingId: data.bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process reschedule',
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Confirm reschedule (after payment)
   */
  async confirmReschedule(rescheduleId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // This would typically be called after payment confirmation
      logger.info('Reschedule confirmed', { rescheduleId });
      return { success: true };
    } catch (error) {
      logger.error('Error confirming reschedule', {
        rescheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm reschedule',
      };
    }
  }

  /**
   * Cancel reschedule (refund fee if applicable)
   */
  async cancelReschedule(
    rescheduleId: string,
    reason?: string
  ): Promise<{ success: boolean; refundAmount: number; error?: string }> {
    try {
      // In a real implementation, this would revert the booking to the previous date
      logger.info('Reschedule cancelled', { rescheduleId, reason });
      return { success: true, refundAmount: 0 };
    } catch (error) {
      logger.error('Error cancelling reschedule', {
        rescheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        refundAmount: 0,
        error: error instanceof Error ? error.message : 'Failed to cancel reschedule',
      };
    }
  }

  /**
   * Get reschedule history for a booking
   */
  async getRescheduleHistory(bookingId: string | Types.ObjectId): Promise<RescheduleRecord[]> {
    const bookingObjectId = typeof bookingId === 'string'
      ? new Types.ObjectId(bookingId)
      : bookingId;

    const booking = await Booking.findById(bookingObjectId);
    if (!booking) {
      return [];
    }

    const rescheduleHistory = (booking.metadata as any)?.rescheduleHistory || [];
    return rescheduleHistory;
  }

  /**
   * Get provider's reschedule statistics
   */
  async getProviderStats(
    providerId: string | Types.ObjectId,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<{
    totalReschedules: number;
    freeReschedules: number;
    paidReschedules: number;
    totalRescheduleRevenue: number;
    byTier: Record<RescheduleTier, { count: number; revenue: number }>;
    averageRescheduleFee: number;
    noNoticeCount: number;
    customerInitiated: number;
    providerInitiated: number;
  }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const query: any = {
      providerId: providerObjectId,
      'metadata.lastReschedule': { $exists: true },
    };

    if (options.startDate || options.endDate) {
      query.scheduledDate = {};
      if (options.startDate) query.scheduledDate.$gte = options.startDate;
      if (options.endDate) query.scheduledDate.$lte = options.endDate;
    }

    const bookings = await Booking.find(query);

    const byTier: Record<RescheduleTier, { count: number; revenue: number }> = {
      free: { count: 0, revenue: 0 },
      low: { count: 0, revenue: 0 },
      medium: { count: 0, revenue: 0 },
      high: { count: 0, revenue: 0 },
    };

    let freeReschedules = 0;
    let paidReschedules = 0;
    let totalRevenue = 0;
    let noNoticeCount = 0;
    let customerInitiated = 0;
    let providerInitiated = 0;

    for (const booking of bookings) {
      const lastReschedule = (booking.metadata as any)?.lastReschedule;
      if (lastReschedule) {
        const tier = (lastReschedule.tier || 'free') as RescheduleTier;
        byTier[tier].count++;
        byTier[tier].revenue += lastReschedule.fee || 0;
        totalRevenue += lastReschedule.fee || 0;

        if (tier === 'free') {
          freeReschedules++;
        } else {
          paidReschedules++;
        }

        if (lastReschedule.fee >= 50) {
          noNoticeCount++;
        }

        if (lastReschedule.initiatedBy === 'customer') {
          customerInitiated++;
        } else {
          providerInitiated++;
        }
      }
    }

    return {
      totalReschedules: bookings.length,
      freeReschedules,
      paidReschedules,
      totalRescheduleRevenue: totalRevenue,
      byTier,
      averageRescheduleFee: bookings.length > 0 ? totalRevenue / bookings.length : 0,
      noNoticeCount,
      customerInitiated,
      providerInitiated,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateRescheduleId(): string {
    return `RS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const rescheduleFeeService = new RescheduleFeeService();
export default rescheduleFeeService;
