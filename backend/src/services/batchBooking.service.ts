/**
 * Batch Booking Service
 * Handles bulk operations on bookings with transaction support and notification dispatch
 */
import mongoose, { ClientSession } from 'mongoose';
import Booking from '../models/booking.model';
import BookingNotification from '../models/bookingNotification.model';
import Service from '../models/service.model';
import { eventBus, EVENT_TYPES } from '../event-bus';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';

export interface BatchOperationResult {
  success: number;
  failed: number;
  errors: Array<{ bookingId: string; error: string }>;
  processedIds: string[];
}

export interface BatchBookingFilters {
  providerId?: string;
  customerId?: string;
  status?: string | string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Validate booking IDs and ensure they belong to the provider
 */
async function validateBookingIds(
  bookingIds: string[],
  providerId?: string
): Promise<{ valid: string[]; invalid: string[] }> {
  const validIds: string[] = [];
  const invalidIds: string[] = [];

  for (const id of bookingIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      invalidIds.push(id);
      continue;
    }

    const query: Record<string, unknown> = { _id: new mongoose.Types.ObjectId(id) };
    if (providerId) {
      query.providerId = new mongoose.Types.ObjectId(providerId);
    }

    const booking = await Booking.findOne(query).select('_id');
    if (booking) {
      validIds.push(id);
    } else {
      invalidIds.push(id);
    }
  }

  return { valid: validIds, invalid: invalidIds };
}

/**
 * Batch Accept Bookings
 * Accept multiple pending bookings at once
 */
export async function batchAcceptBookings(
  bookingIds: string[],
  providerId: string,
  session?: ClientSession
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    success: 0,
    failed: 0,
    errors: [],
    processedIds: [],
  };

  // Validate all booking IDs
  const { valid, invalid } = await validateBookingIds(bookingIds, providerId);

  if (invalid.length > 0) {
    invalid.forEach((id) => {
      result.errors.push({ bookingId: id, error: 'Invalid booking ID or not authorized' });
      result.failed++;
    });
  }

  if (valid.length === 0) {
    return result;
  }

  // Process bookings
  for (const bookingId of valid) {
    try {
      const booking = await Booking.findOne({
        _id: new mongoose.Types.ObjectId(bookingId),
        status: 'pending',
      }).session(session || null);

      if (!booking) {
        result.errors.push({ bookingId, error: 'Booking not found or not pending' });
        result.failed++;
        continue;
      }

      // Update booking status
      booking.status = 'confirmed';
      booking.providerResponse = booking.providerResponse || {};
      booking.providerResponse.acceptedAt = new Date();
      booking.statusHistory.push({
        status: 'confirmed',
        timestamp: new Date(),
        reason: 'Batch accepted by provider',
        updatedBy: 'provider',
      });

      await booking.save({ session });

      // Create notification
      if (booking.customerId) {
        const notification = new BookingNotification({
          bookingId: booking._id,
          recipientId: booking.customerId,
          type: 'booking_confirmed',
          title: 'Booking Confirmed',
          message: `Your booking ${booking.bookingNumber} has been confirmed by the provider.`,
          metadata: {
            bookingNumber: booking.bookingNumber,
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
          },
        });
        await notification.save({ session });
      }

      // Emit event
      eventBus.publish(EVENT_TYPES.BOOKING_CONFIRMED, {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
        providerId: booking.providerId,
      });

      result.success++;
      result.processedIds.push(bookingId);

      logger.info('Batch booking accepted', {
        context: 'BatchBookingService',
        action: 'BATCH_ACCEPT',
        bookingId,
        providerId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({ bookingId, error: errorMessage });
      result.failed++;

      logger.error('Batch accept failed for booking', {
        context: 'BatchBookingService',
        action: 'BATCH_ACCEPT_ERROR',
        bookingId,
        error: errorMessage,
      });
    }
  }

  return result;
}

/**
 * Batch Decline Bookings
 * Decline multiple pending bookings with optional reason
 */
export async function batchDeclineBookings(
  bookingIds: string[],
  providerId: string,
  reason?: string,
  session?: ClientSession
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    success: 0,
    failed: 0,
    errors: [],
    processedIds: [],
  };

  // Validate all booking IDs
  const { valid, invalid } = await validateBookingIds(bookingIds, providerId);

  if (invalid.length > 0) {
    invalid.forEach((id) => {
      result.errors.push({ bookingId: id, error: 'Invalid booking ID or not authorized' });
      result.failed++;
    });
  }

  if (valid.length === 0) {
    return result;
  }

  // Process bookings
  for (const bookingId of valid) {
    try {
      const booking = await Booking.findOne({
        _id: new mongoose.Types.ObjectId(bookingId),
        status: 'pending',
      }).session(session || null);

      if (!booking) {
        result.errors.push({ bookingId, error: 'Booking not found or not pending' });
        result.failed++;
        continue;
      }

      // Update booking status
      booking.status = 'cancelled';
      booking.providerResponse = booking.providerResponse || {};
      booking.providerResponse.rejectionReason = reason || 'Declined by provider';
      booking.cancellationDetails = {
        cancelledBy: 'provider',
        cancelledAt: new Date(),
        reason: reason || 'Declined by provider',
        refundAmount: booking.pricing?.totalAmount || 0,
        refundStatus: 'pending',
      };
      booking.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        reason: reason || 'Booking rejected by provider',
        updatedBy: 'provider',
      });

      await booking.save({ session });

      // Create notification
      if (booking.customerId) {
        const notification = new BookingNotification({
          bookingId: booking._id,
          recipientId: booking.customerId,
          type: 'booking_rejected',
          title: 'Booking Declined',
          message: `Your booking ${booking.bookingNumber} has been declined by the provider.`,
          metadata: {
            bookingNumber: booking.bookingNumber,
            reason: reason,
            refundAmount: booking.pricing?.totalAmount || 0,
          },
        });
        await notification.save({ session });

        // Emit refund event
        eventBus.publish(EVENT_TYPES.REFUND_PENDING, {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          amount: booking.pricing?.totalAmount || 0,
          triggeredBy: 'provider_decline',
        });
      }

      // Emit event
      eventBus.publish(EVENT_TYPES.BOOKING_CANCELLED, {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
        providerId: booking.providerId,
        cancelledBy: 'provider',
        reason: reason,
      });

      result.success++;
      result.processedIds.push(bookingId);

      logger.info('Batch booking declined', {
        context: 'BatchBookingService',
        action: 'BATCH_DECLINE',
        bookingId,
        providerId,
        reason,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({ bookingId, error: errorMessage });
      result.failed++;

      logger.error('Batch decline failed for booking', {
        context: 'BatchBookingService',
        action: 'BATCH_DECLINE_ERROR',
        bookingId,
        error: errorMessage,
      });
    }
  }

  return result;
}

/**
 * Batch Complete Bookings
 * Mark multiple in-progress bookings as completed
 */
export async function batchCompleteBookings(
  bookingIds: string[],
  providerId: string,
  session?: ClientSession
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    success: 0,
    failed: 0,
    errors: [],
    processedIds: [],
  };

  // Validate all booking IDs
  const { valid, invalid } = await validateBookingIds(bookingIds, providerId);

  if (invalid.length > 0) {
    invalid.forEach((id) => {
      result.errors.push({ bookingId: id, error: 'Invalid booking ID or not authorized' });
      result.failed++;
    });
  }

  if (valid.length === 0) {
    return result;
  }

  // Process bookings
  for (const bookingId of valid) {
    try {
      const booking = await Booking.findOne({
        _id: new mongoose.Types.ObjectId(bookingId),
        status: 'in_progress',
      }).session(session || null);

      if (!booking) {
        result.errors.push({ bookingId, error: 'Booking not found or not in progress' });
        result.failed++;
        continue;
      }

      // Update booking status
      booking.status = 'completed';
      booking.completedAt = new Date();
      booking.providerResponse = booking.providerResponse || {};
      booking.providerResponse.completedAt = new Date();
      booking.statusHistory.push({
        status: 'completed',
        timestamp: new Date(),
        reason: 'Batch completed by provider',
        updatedBy: 'provider',
      });

      await booking.save({ session });

      // Update service booking count
      await Service.findByIdAndUpdate(booking.serviceId, {
        $inc: { 'searchMetadata.bookingCount': 1 },
      });

      // Create notification for customer
      if (booking.customerId) {
        const notification = new BookingNotification({
          bookingId: booking._id,
          recipientId: booking.customerId,
          type: 'booking_completed',
          title: 'Service Completed',
          message: `Your service ${booking.bookingNumber} has been completed. Please leave a review!`,
          metadata: {
            bookingNumber: booking.bookingNumber,
            serviceName: (booking as any).service?.name,
          },
          actionText: 'Leave Review',
          actionUrl: `/reviews/new?bookingId=${booking._id}`,
        });
        await notification.save({ session });
      }

      // Emit event for analytics and settlements
      eventBus.publish(EVENT_TYPES.BOOKING_COMPLETED, {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
        providerId: booking.providerId,
        serviceId: booking.serviceId,
        totalAmount: booking.pricing?.totalAmount,
      });

      result.success++;
      result.processedIds.push(bookingId);

      logger.info('Batch booking completed', {
        context: 'BatchBookingService',
        action: 'BATCH_COMPLETE',
        bookingId,
        providerId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({ bookingId, error: errorMessage });
      result.failed++;

      logger.error('Batch complete failed for booking', {
        context: 'BatchBookingService',
        action: 'BATCH_COMPLETE_ERROR',
        bookingId,
        error: errorMessage,
      });
    }
  }

  return result;
}

/**
 * Batch Cancel Bookings
 * Cancel multiple active bookings (pending, confirmed, or in_progress)
 */
export async function batchCancelBookings(
  bookingIds: string[],
  providerId: string,
  reason?: string,
  cancelledBy: 'provider' | 'customer' | 'admin' = 'provider',
  session?: ClientSession
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    success: 0,
    failed: 0,
    errors: [],
    processedIds: [],
  };

  // Validate all booking IDs
  const { valid, invalid } = await validateBookingIds(bookingIds, providerId);

  if (invalid.length > 0) {
    invalid.forEach((id) => {
      result.errors.push({ bookingId: id, error: 'Invalid booking ID or not authorized' });
      result.failed++;
    });
  }

  if (valid.length === 0) {
    return result;
  }

  // Process bookings
  for (const bookingId of valid) {
    try {
      const booking = await Booking.findOne({
        _id: new mongoose.Types.ObjectId(bookingId),
        status: { $in: ['pending', 'confirmed', 'in_progress'] },
      }).session(session || null);

      if (!booking) {
        result.errors.push({ bookingId, error: 'Booking not found or cannot be cancelled' });
        result.failed++;
        continue;
      }

      // Calculate refund amount based on cancellation policy
      const refundAmount = booking.calculateRefund();

      // Update booking status
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancellationDetails = {
        cancelledBy,
        cancelledAt: new Date(),
        reason: reason || `Cancelled by ${cancelledBy}`,
        refundAmount,
        refundStatus: refundAmount > 0 ? 'pending' : 'processed',
      };
      booking.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        reason: reason || `Cancelled by ${cancelledBy}`,
        updatedBy: cancelledBy,
      });

      await booking.save({ session });

      // Create notification
      const recipientId = cancelledBy === 'provider' ? booking.customerId : booking.providerId;
      if (recipientId) {
        const notification = new BookingNotification({
          bookingId: booking._id,
          recipientId,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `Booking ${booking.bookingNumber} has been cancelled.`,
          metadata: {
            bookingNumber: booking.bookingNumber,
            cancelledBy,
            reason,
            refundAmount,
          },
        });
        await notification.save({ session });
      }

      // Emit refund event if applicable
      if (refundAmount > 0) {
        eventBus.publish(EVENT_TYPES.REFUND_PENDING, {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          amount: refundAmount,
          triggeredBy: `batch_cancel_${cancelledBy}`,
        });
      }

      // Emit cancellation event
      eventBus.publish(EVENT_TYPES.BOOKING_CANCELLED, {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
        providerId: booking.providerId,
        cancelledBy,
        reason,
        refundAmount,
      });

      result.success++;
      result.processedIds.push(bookingId);

      logger.info('Batch booking cancelled', {
        context: 'BatchBookingService',
        action: 'BATCH_CANCEL',
        bookingId,
        providerId,
        cancelledBy,
        reason,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({ bookingId, error: errorMessage });
      result.failed++;

      logger.error('Batch cancel failed for booking', {
        context: 'BatchBookingService',
        action: 'BATCH_CANCEL_ERROR',
        bookingId,
        error: errorMessage,
      });
    }
  }

  return result;
}

/**
 * Batch Booking Service Class with Transaction Support
 */
export class BatchBookingService {
  /**
   * Execute batch operation within a transaction
   */
  async executeWithTransaction<T>(
    operation: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });

      const result = await operation(session);

      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Batch accept with transaction
   */
  async batchAcceptWithTransaction(
    bookingIds: string[],
    providerId: string
  ): Promise<BatchOperationResult> {
    return this.executeWithTransaction((session) =>
      batchAcceptBookings(bookingIds, providerId, session)
    );
  }

  /**
   * Batch decline with transaction
   */
  async batchDeclineWithTransaction(
    bookingIds: string[],
    providerId: string,
    reason?: string
  ): Promise<BatchOperationResult> {
    return this.executeWithTransaction((session) =>
      batchDeclineBookings(bookingIds, providerId, reason, session)
    );
  }

  /**
   * Batch complete with transaction
   */
  async batchCompleteWithTransaction(
    bookingIds: string[],
    providerId: string
  ): Promise<BatchOperationResult> {
    return this.executeWithTransaction((session) =>
      batchCompleteBookings(bookingIds, providerId, session)
    );
  }

  /**
   * Batch cancel with transaction
   */
  async batchCancelWithTransaction(
    bookingIds: string[],
    providerId: string,
    reason?: string,
    cancelledBy: 'provider' | 'customer' | 'admin' = 'provider'
  ): Promise<BatchOperationResult> {
    return this.executeWithTransaction((session) =>
      batchCancelBookings(bookingIds, providerId, reason, cancelledBy, session)
    );
  }

  /**
   * Get batch operation summary for preview
   */
  async getBatchPreview(
    bookingIds: string[],
    providerId?: string
  ): Promise<{
    valid: number;
    invalid: number;
    byStatus: Record<string, number>;
    totalValue: number;
  }> {
    const { valid, invalid } = await validateBookingIds(bookingIds, providerId);

    if (valid.length === 0) {
      return { valid: 0, invalid: invalid.length, byStatus: {}, totalValue: 0 };
    }

    const bookings = await Booking.find({
      _id: { $in: valid.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select('status pricing.totalAmount');

    const byStatus: Record<string, number> = {};
    let totalValue = 0;

    for (const booking of bookings) {
      byStatus[booking.status] = (byStatus[booking.status] || 0) + 1;
      totalValue += booking.pricing?.totalAmount || 0;
    }

    return {
      valid: valid.length,
      invalid: invalid.length,
      byStatus,
      totalValue,
    };
  }

  /**
   * Dispatch notifications for batch operations
   */
  async dispatchNotifications(
    bookingIds: string[],
    notificationType: string,
    customData?: Record<string, unknown>
  ): Promise<void> {
    const bookings = await Booking.find({
      _id: { $in: bookingIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).populate('customerId providerId');

    for (const booking of bookings) {
      const notification = new BookingNotification({
        bookingId: booking._id,
        recipientId: (booking as any).customerId?._id,
        type: notificationType,
        title: this.getNotificationTitle(notificationType),
        message: this.getNotificationMessage(notificationType, booking),
        metadata: {
          bookingNumber: booking.bookingNumber,
          ...customData,
        },
      });

      await notification.save();
    }
  }

  private getNotificationTitle(type: string): string {
    const titles: Record<string, string> = {
      batch_accepted: 'Bookings Accepted',
      batch_declined: 'Bookings Declined',
      batch_completed: 'Services Completed',
      batch_cancelled: 'Bookings Cancelled',
    };
    return titles[type] || 'Booking Update';
  }

  private getNotificationMessage(type: string, booking: any): string {
    const messages: Record<string, string> = {
      batch_accepted: `Your booking ${booking.bookingNumber} has been accepted by the provider.`,
      batch_declined: `Your booking ${booking.bookingNumber} has been declined.`,
      batch_completed: `Your service ${booking.bookingNumber} has been completed.`,
      batch_cancelled: `Your booking ${booking.bookingNumber} has been cancelled.`,
    };
    return messages[type] || 'Your booking has been updated.';
  }
}

// Export singleton instance
export const batchBookingService = new BatchBookingService();
