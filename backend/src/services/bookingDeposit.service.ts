import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export interface DepositConfig {
  enabled: boolean;
  defaultDepositPercentage: number; // Percentage of booking value
  minDepositAmount: number;
  maxDepositPercentage: number; // Maximum percentage allowed
  securityDepositEnabled: boolean;
  securityDepositMin: number;
  securityDepositMax: number;
  autoReleaseDays: number; // Days after service completion to auto-release
}

export interface Deposit {
  _id?: Types.ObjectId;
  depositId: string;
  bookingId: Types.ObjectId;
  bookingNumber: string;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  type: 'service_deposit' | 'security_deposit';
  amount: number;
  percentage: number;
  totalBookingValue: number;
  currency: string;
  status: 'pending' | 'held' | 'released' | 'forfeited' | 'refunded' | 'partial_refund';
  paymentId?: string;
  paidAt?: Date;
  releasedAt?: Date;
  refundId?: string;
  refundedAt?: Date;
  refundAmount?: number;
  notes?: string;
  metadata?: {
    serviceName?: string;
    scheduledDate?: Date;
    completionDate?: Date;
    reason?: string;
  };
  timeline: Array<{
    action: string;
    timestamp: Date;
    performedBy: 'customer' | 'provider' | 'system' | 'admin';
    details?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartialRefundCalculation {
  serviceCompleted: boolean;
  completedServices: string[];
  remainingServices: string[];
  totalValue: number;
  completedValue: number;
  depositAmount: number;
  refundableAmount: number;
  forfeitAmount: number;
  forfeitPercentage: number;
  reason: string;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: DepositConfig = {
  enabled: true,
  defaultDepositPercentage: 20, // 20% deposit
  minDepositAmount: 10,
  maxDepositPercentage: 50, // Maximum 50%
  securityDepositEnabled: true,
  securityDepositMin: 50,
  securityDepositMax: 500,
  autoReleaseDays: 7, // Auto-release 7 days after completion
};

// ============================================
// Booking Deposit Service
// ============================================

export class BookingDepositService {
  private config: DepositConfig = DEFAULT_CONFIG;

  /**
   * Initialize with custom configuration
   */
  async initialize(config: Partial<DepositConfig>): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('BookingDepositService initialized', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): DepositConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<DepositConfig>): Promise<DepositConfig> {
    this.config = { ...this.config, ...updates };
    return this.config;
  }

  /**
   * Calculate deposit amount for a booking
   */
  calculateDepositAmount(
    bookingValue: number,
    options: { percentage?: number; type?: Deposit['type'] } = {}
  ): { amount: number; percentage: number; currency: string } {
    const percentage = options.percentage || this.config.defaultDepositPercentage;
    let amount = bookingValue * (percentage / 100);

    // Apply type-specific constraints
    if (options.type === 'security_deposit') {
      amount = Math.max(this.config.securityDepositMin, amount);
      amount = Math.min(this.config.securityDepositMax, amount);
    } else {
      amount = Math.max(this.config.minDepositAmount, amount);
      amount = Math.min(bookingValue * (this.config.maxDepositPercentage / 100), amount);
    }

    return {
      amount: Math.round(amount * 100) / 100,
      percentage,
      currency: 'AED',
    };
  }

  /**
   * Create a deposit record for a booking
   */
  async createDeposit(
    bookingId: string | Types.ObjectId,
    options: {
      type?: Deposit['type'];
      customPercentage?: number;
      customerId?: string;
    } = {}
  ): Promise<{ success: boolean; deposit?: Deposit; error?: string }> {
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

      // Calculate deposit amount
      const totalValue = (booking.pricing as any)?.totalAmount || 0;
      const type = options.type || 'service_deposit';

      const depositCalc = this.calculateDepositAmount(totalValue, {
        percentage: options.customPercentage,
        type,
      });

      const depositId = this.generateDepositId();

      const deposit: Deposit = {
        _id: new Types.ObjectId(),
        depositId,
        bookingId: bookingObjectId,
        bookingNumber: booking.bookingNumber,
        customerId: (booking.customerId as Types.ObjectId) || new Types.ObjectId(options.customerId || ''),
        providerId: booking.providerId as Types.ObjectId,
        type,
        amount: depositCalc.amount,
        percentage: depositCalc.percentage,
        totalBookingValue: totalValue,
        currency: depositCalc.currency,
        status: 'pending',
        timeline: [{
          action: 'created',
          timestamp: new Date(),
          performedBy: 'system',
          details: `Deposit of ${depositCalc.amount} ${depositCalc.currency} created (${depositCalc.percentage}% of booking value)`,
        }],
        metadata: {
          serviceName: (booking.serviceId as any)?.name || 'Unknown Service',
          scheduledDate: booking.scheduledDate,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in booking metadata
      booking.metadata = booking.metadata || {};
      (booking.metadata as any).deposit = {
        depositId,
        type,
        amount: depositCalc.amount,
        percentage: depositCalc.percentage,
        status: 'pending',
        createdAt: new Date(),
      };
      await booking.save();

      logger.info('Deposit created', {
        depositId,
        bookingId: bookingObjectId.toString(),
        amount: depositCalc.amount,
        type,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.DEPOSIT_CREATED, {
        depositId,
        bookingId: bookingObjectId.toString(),
        amount: depositCalc.amount,
        type,
      });

      return { success: true, deposit };
    } catch (error) {
      logger.error('Error creating deposit', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create deposit',
      };
    }
  }

  /**
   * Record deposit payment
   */
  async recordPayment(
    depositId: string,
    paymentId: string
  ): Promise<{ success: boolean; deposit?: Deposit; error?: string }> {
    try {
      const booking = await Booking.findOne({ 'metadata.deposit.depositId': depositId });
      if (!booking) {
        return { success: false, error: 'Booking with this deposit not found' };
      }

      const deposit = (booking.metadata as any)?.deposit;
      if (!deposit) {
        return { success: false, error: 'No deposit record found' };
      }

      deposit.paymentId = paymentId;
      deposit.status = 'held';
      deposit.paidAt = new Date();
      deposit.timeline.push({
        action: 'payment_received',
        timestamp: new Date(),
        performedBy: 'system',
        details: `Payment received via ${paymentId}`,
      });

      await booking.save();

      logger.info('Deposit payment recorded', { depositId, paymentId });

      return { success: true, deposit };
    } catch (error) {
      logger.error('Error recording deposit payment', {
        depositId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record payment',
      };
    }
  }

  /**
   * Release deposit (full refund to customer)
   */
  async releaseDeposit(
    depositId: string,
    options: {
      performedBy?: 'customer' | 'provider' | 'system' | 'admin';
      reason?: string;
    } = {}
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const booking = await Booking.findOne({ 'metadata.deposit.depositId': depositId });
      if (!booking) {
        return { success: false, error: 'Booking with this deposit not found' };
      }

      const deposit = (booking.metadata as any)?.deposit;
      if (!deposit) {
        return { success: false, error: 'No deposit record found' };
      }

      if (deposit.status !== 'held') {
        return { success: false, error: `Cannot release deposit with status: ${deposit.status}` };
      }

      // Create refund record
      const refundId = this.generateRefundId();
      deposit.status = 'released';
      deposit.refundId = refundId;
      deposit.refundedAt = new Date();
      deposit.refundAmount = deposit.amount;
      deposit.timeline.push({
        action: 'released',
        timestamp: new Date(),
        performedBy: options.performedBy || 'system',
        details: options.reason || 'Deposit released',
      });

      await booking.save();

      logger.info('Deposit released', { depositId, refundId, amount: deposit.amount });

      // Emit event
      eventBus.publish(EVENT_TYPES.DEPOSIT_RELEASED, {
        depositId,
        bookingId: booking._id.toString(),
        refundId,
        amount: deposit.amount,
      });

      return { success: true, refundId };
    } catch (error) {
      logger.error('Error releasing deposit', {
        depositId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release deposit',
      };
    }
  }

  /**
   * Forfeit deposit (retain funds due to cancellation or no-show)
   */
  async forfeitDeposit(
    depositId: string,
    options: {
      performedBy: 'customer' | 'provider' | 'system' | 'admin';
      reason: string;
      percentage?: number; // Partial forfeit
    } = { performedBy: 'system', reason: 'Deposit forfeited' }
  ): Promise<{ success: boolean; forfeitedAmount?: number; error?: string }> {
    try {
      const booking = await Booking.findOne({ 'metadata.deposit.depositId': depositId });
      if (!booking) {
        return { success: false, error: 'Booking with this deposit not found' };
      }

      const deposit = (booking.metadata as any)?.deposit;
      if (!deposit) {
        return { success: false, error: 'No deposit record found' };
      }

      if (!['pending', 'held'].includes(deposit.status)) {
        return { success: false, error: `Cannot forfeit deposit with status: ${deposit.status}` };
      }

      const forfeitPercentage = options.percentage || 100;
      const forfeitedAmount = Math.round(deposit.amount * (forfeitPercentage / 100) * 100) / 100;

      deposit.status = forfeitPercentage === 100 ? 'forfeited' : 'partial_refund';
      deposit.refundAmount = deposit.amount - forfeitedAmount;
      deposit.timeline.push({
        action: 'forfeited',
        timestamp: new Date(),
        performedBy: options.performedBy,
        details: `${forfeitPercentage}% forfeited: ${options.reason}`,
      });

      await booking.save();

      logger.info('Deposit forfeited', {
        depositId,
        forfeitedAmount,
        reason: options.reason,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.DEPOSIT_FORFEITED, {
        depositId,
        bookingId: booking._id.toString(),
        forfeitedAmount,
        reason: options.reason,
      });

      return { success: true, forfeitedAmount };
    } catch (error) {
      logger.error('Error forfeiting deposit', {
        depositId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to forfeit deposit',
      };
    }
  }

  /**
   * Calculate partial refund for partial service completion
   */
  calculatePartialRefund(
    depositAmount: number,
    totalBookingValue: number,
    completedValue: number,
    options: { reason: string } = { reason: 'Partial service completed' }
  ): PartialRefundCalculation {
    const completedPercentage = totalBookingValue > 0
      ? (completedValue / totalBookingValue) * 100
      : 0;

    // Forfeit 50% of remaining value after completed portion
    const remainingValue = totalBookingValue - completedValue;
    const maxForfeitPercentage = 50;
    const actualForfeitPercentage = Math.min(maxForfeitPercentage, 100 - completedPercentage);

    const refundableAmount = Math.round(
      (depositAmount * (completedPercentage / 100) + remainingValue * (1 - actualForfeitPercentage / 100)) * 100
    ) / 100;

    const forfeitAmount = Math.round((depositAmount - refundableAmount) * 100) / 100;

    return {
      serviceCompleted: completedPercentage >= 90, // 90% threshold
      completedServices: [],
      remainingServices: [],
      totalValue: totalBookingValue,
      completedValue,
      depositAmount,
      refundableAmount,
      forfeitAmount,
      forfeitPercentage: Math.round(actualForfeitPercentage * 100) / 100,
      reason: options.reason,
    };
  }

  /**
   * Process partial refund
   */
  async processPartialRefund(
    depositId: string,
    refundAmount: number,
    options: {
      performedBy: 'customer' | 'provider' | 'system' | 'admin';
      reason: string;
    }
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const booking = await Booking.findOne({ 'metadata.deposit.depositId': depositId });
      if (!booking) {
        return { success: false, error: 'Booking with this deposit not found' };
      }

      const deposit = (booking.metadata as any)?.deposit;
      if (!deposit) {
        return { success: false, error: 'No deposit record found' };
      }

      if (refundAmount > deposit.amount) {
        return { success: false, error: 'Refund amount exceeds deposit amount' };
      }

      const refundId = this.generateRefundId();
      deposit.status = refundAmount === deposit.amount ? 'refunded' : 'partial_refund';
      deposit.refundId = refundId;
      deposit.refundedAt = new Date();
      deposit.refundAmount = refundAmount;
      deposit.timeline.push({
        action: 'partial_refund',
        timestamp: new Date(),
        performedBy: options.performedBy,
        details: `${options.reason} - Refund: ${refundAmount}`,
      });

      await booking.save();

      logger.info('Partial deposit refund processed', {
        depositId,
        refundId,
        refundAmount,
      });

      return { success: true, refundId };
    } catch (error) {
      logger.error('Error processing partial refund', {
        depositId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process partial refund',
      };
    }
  }

  /**
   * Handle cancellation - manage deposits appropriately
   */
  async handleCancellation(
    bookingId: string | Types.ObjectId,
    options: {
      cancelledBy: 'customer' | 'provider' | 'system';
      reason: string;
      cancellationHoursBeforeService: number;
    }
  ): Promise<{
    success: boolean;
    depositAction?: 'release' | 'forfeit' | 'partial';
    amount?: number;
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

      const deposit = (booking.metadata as any)?.deposit;
      if (!deposit) {
        return { success: true }; // No deposit to manage
      }

      const hoursBeforeService = options.cancellationHoursBeforeService;

      // Cancellation policy: Free cancellation if > 24 hours before
      if (hoursBeforeService > 24) {
        // Full refund
        const result = await this.releaseDeposit(deposit.depositId, {
          performedBy: options.cancelledBy,
          reason: 'Free cancellation (>24 hours before service)',
        });

        return {
          success: result.success,
          depositAction: 'release',
          amount: deposit.amount,
        };
      } else if (hoursBeforeService > 0) {
        // Partial forfeit (25% of deposit)
        const forfeitPercentage = 25;
        const forfeitAmount = Math.round(deposit.amount * (forfeitPercentage / 100) * 100) / 100;

        const result = await this.forfeitDeposit(deposit.depositId, {
          performedBy: options.cancelledBy,
          reason: `Late cancellation (${forfeitPercentage}% forfeit)`,
          percentage: forfeitPercentage,
        });

        return {
          success: result.success,
          depositAction: 'partial',
          amount: deposit.amount - forfeitAmount,
        };
      } else {
        // No-show or after service time - full forfeit
        const result = await this.forfeitDeposit(deposit.depositId, {
          performedBy: options.cancelledBy,
          reason: 'No-show or service time passed',
          percentage: 100,
        });

        return {
          success: result.success,
          depositAction: 'forfeit',
          amount: 0,
        };
      }
    } catch (error) {
      logger.error('Error handling cancellation deposits', {
        bookingId: bookingId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to handle cancellation',
      };
    }
  }

  /**
   * Get deposit by ID
   */
  async getDeposit(depositId: string): Promise<Deposit | null> {
    const booking = await Booking.findOne({ 'metadata.deposit.depositId': depositId });
    if (!booking) return null;

    const deposit = (booking.metadata as any)?.deposit;
    if (!deposit) return null;

    return {
      ...deposit,
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      providerId: booking.providerId,
      totalBookingValue: (booking.pricing as any)?.totalAmount || 0,
      currency: (booking.pricing as any)?.currency || 'AED',
    };
  }

  /**
   * Get deposits for a provider
   */
  async getProviderDeposits(
    providerId: string | Types.ObjectId,
    options: {
      status?: Deposit['status'];
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ deposits: Deposit[]; total: number }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const query: any = { providerId: providerObjectId };

    if (options.status) {
      query['metadata.deposit.status'] = options.status;
    }

    if (options.startDate || options.endDate) {
      query.scheduledDate = {};
      if (options.startDate) query.scheduledDate.$gte = options.startDate;
      if (options.endDate) query.scheduledDate.$lte = options.endDate;
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Booking.countDocuments(query),
    ]);

    const deposits: Deposit[] = bookings
      .map(booking => {
        const deposit = (booking.metadata as any)?.deposit;
        if (!deposit) return null;
        return {
          ...deposit,
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          customerId: booking.customerId,
          providerId: booking.providerId,
          totalBookingValue: (booking.pricing as any)?.totalAmount || 0,
          currency: (booking.pricing as any)?.currency || 'AED',
        };
      })
      .filter(Boolean);

    return { deposits: deposits as Deposit[], total };
  }

  /**
   * Get security deposit tracking
   */
  async getSecurityDepositSummary(providerId: string | Types.ObjectId): Promise<{
    totalHeld: number;
    totalReleased: number;
    totalForfeited: number;
    pendingCount: number;
    pendingAmount: number;
  }> {
    const providerObjectId = typeof providerId === 'string'
      ? new Types.ObjectId(providerId)
      : providerId;

    const bookings = await Booking.find({
      providerId: providerObjectId,
      'metadata.deposit.type': 'security_deposit',
    });

    let totalHeld = 0;
    let totalReleased = 0;
    let totalForfeited = 0;
    let pendingCount = 0;
    let pendingAmount = 0;

    for (const booking of bookings) {
      const deposit = (booking.metadata as any)?.deposit;
      if (!deposit) continue;

      switch (deposit.status) {
        case 'held':
          totalHeld += deposit.amount;
          pendingCount++;
          pendingAmount += deposit.amount;
          break;
        case 'released':
          totalReleased += deposit.amount;
          break;
        case 'forfeited':
          totalForfeited += deposit.amount;
          break;
        case 'pending':
          pendingCount++;
          pendingAmount += deposit.amount;
          break;
      }
    }

    return { totalHeld, totalReleased, totalForfeited, pendingCount, pendingAmount };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateDepositId(): string {
    return `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  private generateRefundId(): string {
    return `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const bookingDepositService = new BookingDepositService();
export default bookingDepositService;
