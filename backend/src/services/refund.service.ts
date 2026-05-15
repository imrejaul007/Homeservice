import mongoose, { Types, Document } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Dispute from '../models/dispute.model';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// TYPES & INTERFACES
// ============================================

export type RefundStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed';
export type RefundType = 'full' | 'partial' | 'prorated' | 'chargeback' | 'dispute';
export type RefundReason = 'cancellation' | 'service_not_provided' | 'poor_quality' | 'provider_no_show' | 'customer_request' | 'duplicate_charge' | 'billing_error' | 'other';

export interface IRefundRequest extends Document {
  _id: Types.ObjectId;
  refundNumber: string;
  bookingId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  processedBy?: Types.ObjectId;
  amount: number;
  originalAmount: number;
  reason: RefundReason;
  description?: string;
  status: RefundStatus;
  type: RefundType;
  stripeRefundId?: string;
  stripeChargeId?: string;
  disputeId?: Types.ObjectId;
  refundPercentage?: number;
  processingNotes?: string;
  rejectionReason?: string;
  approvedAt?: Date;
  processedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
  timeline: Array<{
    action: string;
    performedBy: Types.ObjectId;
    performedByRole: 'customer' | 'provider' | 'admin' | 'system';
    timestamp: Date;
    details?: string;
    previousStatus?: RefundStatus;
    newStatus?: RefundStatus;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRefundDTO {
  bookingId: string;
  requestedBy: string;
  amount?: number;
  reason: RefundReason;
  description?: string;
  type?: RefundType;
  disputeId?: string;
}

export interface ProcessRefundDTO {
  refundId: string;
  action: 'approve' | 'reject';
  processedBy: string;
  amount?: number;
  notes?: string;
  rejectionReason?: string;
}

export interface RefundFiltersDTO {
  status?: RefundStatus;
  type?: RefundType;
  requestedBy?: string;
  bookingId?: string;
  disputeId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedRefundsResult {
  refunds: IRefundRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

export interface RefundStats {
  totalRefunds: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  completedCount: number;
  completedAmount: number;
  rejectedCount: number;
  avgRefundAmount: number;
  byStatus: Record<RefundStatus, { count: number; amount: number }>;
  byType: Record<RefundType, { count: number; amount: number }>;
}

// ============================================
// REFUND SERVICE CLASS
// ============================================

export class RefundService {
  // Auto-approve threshold (refunds below this amount are auto-approved)
  private readonly AUTO_APPROVE_THRESHOLD = 50; // 50 AED

  // ========================================
  // Create Refund Request
  // ========================================

  async createRefundRequest(data: CreateRefundDTO): Promise<IRefundRequest> {
    // Validate booking exists
    const booking = await Booking.findById(data.bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Validate user is authorized
    if (booking.customerId?.toString() !== data.requestedBy) {
      throw new ApiError(403, 'Only the customer can request a refund');
    }

    // Check booking status allows refund
    if (!['completed', 'cancelled'].includes(booking.status)) {
      throw new ApiError(400, 'Booking must be completed or cancelled to request a refund');
    }

    // Check if payment was made
    if (booking.payment?.status !== 'paid') {
      throw new ApiError(400, 'No payment was made for this booking');
    }

    // Check for existing pending refund
    const existingRefund = await mongoose.model('RefundRequest').findOne({
      bookingId: data.bookingId,
      status: { $in: ['pending', 'approved', 'processing'] },
    });

    if (existingRefund) {
      throw new ApiError(409, 'A refund request is already pending for this booking');
    }

    // Calculate refund amount
    const originalAmount = booking.pricing?.totalAmount || 0;
    let refundAmount = data.amount || originalAmount;

    // Validate refund amount
    if (refundAmount > originalAmount) {
      throw new ApiError(400, 'Refund amount cannot exceed booking total');
    }

    // Determine refund type
    const type = data.type || this.determineRefundType(originalAmount, refundAmount);

    // Generate refund number
    const refundNumber = await this.generateRefundNumber();

    // Create refund request
    const RefundRequest = mongoose.model('RefundRequest');
    const refund = new RefundRequest({
      refundNumber,
      bookingId: new Types.ObjectId(data.bookingId),
      requestedBy: new Types.ObjectId(data.requestedBy),
      amount: refundAmount,
      originalAmount,
      reason: data.reason,
      description: data.description,
      status: 'pending',
      type,
      stripeChargeId: booking.payment?.transactionId,
      disputeId: data.disputeId ? new Types.ObjectId(data.disputeId) : undefined,
      refundPercentage: Math.round((refundAmount / originalAmount) * 100),
      timeline: [{
        action: 'created',
        performedBy: new Types.ObjectId(data.requestedBy),
        performedByRole: 'customer',
        timestamp: new Date(),
        details: `Refund request created for ${refundAmount} ${booking.pricing?.currency || 'AED'}`,
      }],
    });

    await refund.save();

    // Auto-approve if below threshold
    if (refundAmount <= this.AUTO_APPROVE_THRESHOLD) {
      await this.autoApproveRefund(refund);
    }

    // Populate for response
    await refund.populate('requestedBy', 'firstName lastName email');

    // Emit event
    eventBus.publish(EVENT_TYPES.REFUND_CREATED, {
      refundId: refund._id,
      refundNumber: refund.refundNumber,
      bookingId: refund.bookingId,
      amount: refundAmount,
      type,
      requestedBy: data.requestedBy,
    });

    return refund;
  }

  // ========================================
  // Get Refund by ID
  // ========================================

  async getRefundById(refundId: string, userId?: string, userRole?: string): Promise<IRefundRequest> {
    if (!mongoose.Types.ObjectId.isValid(refundId)) {
      throw new ApiError(400, 'Invalid refund ID');
    }

    const RefundRequest = mongoose.model('RefundRequest');
    const refund = await RefundRequest.findById(refundId)
      .populate('bookingId', 'bookingNumber pricing scheduledDate customerInfo')
      .populate('requestedBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName email')
      .populate('disputeId', 'disputeNumber status');

    if (!refund) {
      throw new ApiError(404, 'Refund not found');
    }

    // Authorization check
    if (userId && userRole !== 'admin') {
      const isAuthorized =
        refund.requestedBy._id.toString() === userId ||
        (refund.bookingId as any).customerId?.toString() === userId;

      if (!isAuthorized) {
        throw new ApiError(403, 'Access denied');
      }
    }

    return refund;
  }

  // ========================================
  // List Refunds (with filters)
  // ========================================

  async listRefunds(filters: RefundFiltersDTO): Promise<PaginatedRefundsResult> {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.requestedBy) {
      query.requestedBy = new Types.ObjectId(filters.requestedBy);
    }

    if (filters.bookingId) {
      query.bookingId = new Types.ObjectId(filters.bookingId);
    }

    if (filters.disputeId) {
      query.disputeId = new Types.ObjectId(filters.disputeId);
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      query.amount = {};
      if (filters.minAmount !== undefined) query.amount.$gte = filters.minAmount;
      if (filters.maxAmount !== undefined) query.amount.$lte = filters.maxAmount;
    }

    const RefundRequest = mongoose.model('RefundRequest');
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [refunds, total] = await Promise.all([
      RefundRequest.find(query)
        .populate('bookingId', 'bookingNumber pricing scheduledDate')
        .populate('requestedBy', 'firstName lastName email')
        .populate('processedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      RefundRequest.countDocuments(query),
    ]);

    return {
      refunds: refunds as unknown as IRefundRequest[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + refunds.length < total,
      },
    };
  }

  // ========================================
  // Get Refunds by Booking
  // ========================================

  async getRefundsByBooking(bookingId: string): Promise<IRefundRequest[]> {
    const RefundRequest = mongoose.model('RefundRequest');
    return RefundRequest.find({ bookingId: new Types.ObjectId(bookingId) })
      .populate('requestedBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName email')
      .sort({ createdAt: -1 }) as unknown as IRefundRequest[];
  }

  // ========================================
  // Get Refunds by User
  // ========================================

  async getRefundsByUser(userId: string, filters?: { status?: RefundStatus; page?: number; limit?: number }): Promise<PaginatedRefundsResult> {
    return this.listRefunds({
      ...filters,
      requestedBy: userId,
    });
  }

  // ========================================
  // Process Refund (Approve/Reject)
  // ========================================

  async processRefund(data: ProcessRefundDTO): Promise<IRefundRequest> {
    const RefundRequest = mongoose.model('RefundRequest');
    const refund = await RefundRequest.findById(data.refundId);

    if (!refund) {
      throw new ApiError(404, 'Refund not found');
    }

    if (refund.status !== 'pending') {
      throw new ApiError(400, 'Refund has already been processed');
    }

    const processedBy = new Types.ObjectId(data.processedBy);
    const previousStatus = refund.status;

    if (data.action === 'approve') {
      // Validate amount if modified
      if (data.amount && data.amount > refund.originalAmount) {
        throw new ApiError(400, 'Approved amount cannot exceed original refund amount');
      }

      // Update refund
      refund.status = 'approved';
      refund.approvedAt = new Date();
      refund.processedBy = processedBy;
      refund.processedAt = new Date();
      refund.amount = data.amount || refund.amount;
      refund.processingNotes = data.notes;

      // Add timeline entry
      refund.timeline.push({
        action: 'approved',
        performedBy: processedBy,
        performedByRole: 'admin',
        timestamp: new Date(),
        details: `Refund approved for ${refund.amount} ${(refund.bookingId as any)?.pricing?.currency || 'AED'}`,
        previousStatus,
        newStatus: 'approved',
      });

      await refund.save();

      // Process the actual refund
      await this.processStripeRefund(refund);

    } else {
      // Reject refund
      refund.status = 'rejected';
      refund.processedBy = processedBy;
      refund.processedAt = new Date();
      refund.rejectionReason = data.rejectionReason;
      refund.processingNotes = data.notes;

      // Add timeline entry
      refund.timeline.push({
        action: 'rejected',
        performedBy: processedBy,
        performedByRole: 'admin',
        timestamp: new Date(),
        details: `Refund rejected: ${data.rejectionReason || 'No reason provided'}`,
        previousStatus,
        newStatus: 'rejected',
      });

      await refund.save();
    }

    // Emit event
    eventBus.publish(EVENT_TYPES.REFUND_PROCESSED, {
      refundId: refund._id,
      refundNumber: refund.refundNumber,
      bookingId: refund.bookingId,
      action: data.action,
      amount: refund.amount,
      processedBy: data.processedBy,
    });

    // Re-fetch with populated data
    return this.getRefundById(data.refundId);
  }

  // ========================================
  // Process Stripe Refund
  // ========================================

  async processStripeRefund(refund: IRefundRequest): Promise<IRefundRequest> {
    const RefundRequest = mongoose.model('RefundRequest');

    try {
      // Update status to processing
      refund.status = 'processing';
      await refund.save();

      // Get Stripe instance (using the payment service pattern)
      const stripe = await this.getStripeInstance();

      if (!refund.stripeChargeId) {
        // Try to get charge ID from booking
        const booking = await Booking.findById(refund.bookingId);
        if (booking?.payment?.transactionId) {
          refund.stripeChargeId = booking.payment.transactionId;
        } else {
          throw new ApiError(400, 'No Stripe charge ID found for this booking');
        }
      }

      // Create Stripe refund
      const stripeRefund = await stripe.refunds.create({
        charge: refund.stripeChargeId,
        amount: Math.round(refund.amount * 100), // Convert to cents
        reason: 'requested_by_customer',
        metadata: {
          refundId: refund._id.toString(),
          refundNumber: refund.refundNumber,
          bookingId: refund.bookingId.toString(),
          type: refund.type,
        },
      });

      // Update refund with Stripe refund ID
      refund.stripeRefundId = stripeRefund.id;
      refund.status = 'completed';
      refund.completedAt = new Date();

      // Update timeline
      refund.timeline.push({
        action: 'stripe_processed',
        performedBy: new Types.ObjectId('system'),
        performedByRole: 'system',
        timestamp: new Date(),
        details: `Stripe refund ${stripeRefund.id} processed successfully`,
        previousStatus: 'processing',
        newStatus: 'completed',
      });

      await refund.save();

      // Update booking payment status
      await this.updateBookingPaymentStatus(refund.bookingId.toString(), refund.amount);

      // Emit success event
      eventBus.publish(EVENT_TYPES.REFUND_COMPLETED, {
        refundId: refund._id,
        refundNumber: refund.refundNumber,
        bookingId: refund.bookingId,
        amount: refund.amount,
        stripeRefundId: stripeRefund.id,
      });

      return refund;

    } catch (error: any) {
      // Update refund status to failed
      refund.status = 'failed';
      refund.processingNotes = `Stripe processing failed: ${error.message}`;

      refund.timeline.push({
        action: 'stripe_failed',
        performedBy: new Types.ObjectId('system'),
        performedByRole: 'system',
        timestamp: new Date(),
        details: `Stripe refund failed: ${error.message}`,
        previousStatus: 'processing',
        newStatus: 'failed',
      });

      await refund.save();

      // Emit failure event
      eventBus.publish(EVENT_TYPES.REFUND_FAILED, {
        refundId: refund._id,
        refundNumber: refund.refundNumber,
        bookingId: refund.bookingId,
        error: error.message,
      });

      throw error;
    }
  }

  // ========================================
  // Handle Stripe Webhook
  // ========================================

  async handleStripeWebhook(event: any): Promise<void> {
    const RefundRequest = mongoose.model('RefundRequest');

    switch (event.type) {
      case 'charge.refunded': {
        const charge = event.data.object;
        const refundId = charge.metadata?.refundId;

        if (refundId) {
          const refund = await RefundRequest.findById(refundId);
          if (refund && refund.status !== 'completed') {
            refund.status = 'completed';
            refund.completedAt = new Date();
            refund.stripeRefundId = charge.refunds?.data?.[0]?.id || charge.id;

            refund.timeline.push({
              action: 'webhook_received',
              performedBy: new Types.ObjectId('system'),
              performedByRole: 'system',
              timestamp: new Date(),
              details: 'Stripe webhook: charge.refunded received',
              previousStatus: refund.status,
              newStatus: 'completed',
            });

            await refund.save();
          }
        }
        break;
      }

      case 'refund.created': {
        const stripeRefund = event.data.object;
        console.log('Stripe refund created:', stripeRefund.id);
        break;
      }

      case 'refund.updated': {
        const stripeRefund = event.data.object;
        console.log('Stripe refund updated:', stripeRefund.id, 'Status:', stripeRefund.status);
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  // ========================================
  // Handle Chargeback
  // ========================================

  async handleChargeback(chargeId: string, amount?: number): Promise<IRefundRequest> {
    // Find booking by charge ID
    const booking = await Booking.findOne({ 'payment.transactionId': chargeId });
    if (!booking) {
      throw new ApiError(404, 'Booking not found for this charge');
    }

    // Create chargeback refund request
    const refundNumber = await this.generateRefundNumber();
    const RefundRequest = mongoose.model('RefundRequest');

    const refund = new RefundRequest({
      refundNumber,
      bookingId: booking._id,
      requestedBy: new Types.ObjectId('000000000000000000000000'), // System user
      amount: amount || booking.pricing?.totalAmount || 0,
      originalAmount: booking.pricing?.totalAmount || 0,
      reason: 'other',
      description: 'Chargeback initiated',
      status: 'processing',
      type: 'chargeback',
      stripeChargeId: chargeId,
      refundPercentage: 100,
      timeline: [{
        action: 'chargeback_initiated',
        performedBy: new Types.ObjectId('000000000000000000000000'),
        performedByRole: 'system',
        timestamp: new Date(),
        details: `Chargeback initiated for ${amount || booking.pricing?.totalAmount} ${booking.pricing?.currency || 'AED'}`,
      }],
    });

    await refund.save();

    // Emit chargeback event
    eventBus.publish(EVENT_TYPES.CHARGEBACK_CREATED, {
      refundId: refund._id,
      refundNumber: refund.refundNumber,
      bookingId: booking._id,
      chargeId,
      amount: refund.amount,
    });

    return refund;
  }

  // ========================================
  // Cancel Refund Request
  // ========================================

  async cancelRefundRequest(refundId: string, userId: string): Promise<IRefundRequest> {
    const RefundRequest = mongoose.model('RefundRequest');
    const refund = await RefundRequest.findById(refundId);

    if (!refund) {
      throw new ApiError(404, 'Refund not found');
    }

    if (refund.requestedBy.toString() !== userId) {
      throw new ApiError(403, 'Only the requester can cancel a refund');
    }

    if (refund.status !== 'pending') {
      throw new ApiError(400, 'Only pending refunds can be cancelled');
    }

    const previousStatus = refund.status;
    refund.status = 'rejected';
    refund.rejectionReason = 'Cancelled by customer';

    refund.timeline.push({
      action: 'cancelled',
      performedBy: new Types.ObjectId(userId),
      performedByRole: 'customer',
      timestamp: new Date(),
      details: 'Refund cancelled by requester',
      previousStatus,
      newStatus: 'rejected',
    });

    await refund.save();

    // Emit event
    eventBus.publish(EVENT_TYPES.REFUND_CANCELLED, {
      refundId: refund._id,
      refundNumber: refund.refundNumber,
      cancelledBy: userId,
    });

    return this.getRefundById(refundId);
  }

  // ========================================
  // Get Refund Statistics
  // ========================================

  async getRefundStats(startDate?: string, endDate?: string): Promise<RefundStats> {
    const RefundRequest = mongoose.model('RefundRequest');

    const matchStage: any = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const aggregation = await RefundRequest.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          byStatus: { $push: { status: '$status', amount: '$amount' } },
          byType: { $push: { type: '$type', amount: '$amount' } },
        },
      },
    ]);

    const result = aggregation[0] || { totalRefunds: 0, totalAmount: 0, byStatus: [], byType: [] };

    // Process by status
    const byStatus: Record<RefundStatus, { count: number; amount: number }> = {
      pending: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      processing: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
    };

    (result.byStatus || []).forEach((item: any) => {
      const status = item.status as RefundStatus;
      if (status in byStatus) {
        byStatus[status] = {
          count: byStatus[status].count + 1,
          amount: byStatus[status].amount + (item.amount || 0),
        };
      }
    });

    // Process by type
    const byType: Record<RefundType, { count: number; amount: number }> = {
      full: { count: 0, amount: 0 },
      partial: { count: 0, amount: 0 },
      prorated: { count: 0, amount: 0 },
      chargeback: { count: 0, amount: 0 },
      dispute: { count: 0, amount: 0 },
    };

    (result.byType || []).forEach((item: any) => {
      const type = item.type as RefundType;
      if (type in byType) {
        byType[type] = {
          count: byType[type].count + 1,
          amount: byType[type].amount + (item.amount || 0),
        };
      }
    });

    return {
      totalRefunds: result.totalRefunds || 0,
      totalAmount: result.totalAmount || 0,
      pendingCount: byStatus.pending.count,
      pendingAmount: byStatus.pending.amount,
      completedCount: byStatus.completed.count,
      completedAmount: byStatus.completed.amount,
      rejectedCount: byStatus.rejected.count,
      avgRefundAmount: result.totalRefunds > 0 ? result.totalAmount / result.totalRefunds : 0,
      byStatus,
      byType,
    };
  }

  // ========================================
  // Get Pending Refunds (for dashboard)
  // ========================================

  async getPendingRefunds(limit?: number): Promise<IRefundRequest[]> {
    const RefundRequest = mongoose.model('RefundRequest');
    return RefundRequest.find({ status: 'pending' })
      .populate('bookingId', 'bookingNumber pricing')
      .populate('requestedBy', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .limit(limit || 10) as unknown as IRefundRequest[];
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Generate unique refund number
   */
  private async generateRefundNumber(): Promise<string> {
    const RefundRequest = mongoose.model('RefundRequest');
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const count = await RefundRequest.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `REF-${year}${month}-${sequence}`;
  }

  /**
   * Determine refund type based on amounts
   */
  private determineRefundType(originalAmount: number, refundAmount: number): RefundType {
    if (refundAmount === originalAmount) {
      return 'full';
    } else if (refundAmount < originalAmount * 0.5) {
      return 'prorated';
    } else {
      return 'partial';
    }
  }

  /**
   * Auto-approve small refunds
   */
  private async autoApproveRefund(refund: IRefundRequest): Promise<void> {
    const RefundRequest = mongoose.model('RefundRequest');

    refund.status = 'approved';
    refund.approvedAt = new Date();
    refund.processingNotes = 'Auto-approved (below threshold)';

    refund.timeline.push({
      action: 'auto_approved',
      performedBy: new Types.ObjectId('system'),
      performedByRole: 'system',
      timestamp: new Date(),
      details: `Auto-approved (amount ${refund.amount} below ${this.AUTO_APPROVE_THRESHOLD} threshold)`,
      previousStatus: 'pending',
      newStatus: 'approved',
    });

    await refund.save();

    // Process the refund
    await this.processStripeRefund(refund);
  }

  /**
   * Get Stripe instance
   */
  private async getStripeInstance(): Promise<any> {
    const Stripe = (await import('stripe')).default;
    return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16' as any,
    });
  }

  /**
   * Update booking payment status after refund
   */
  private async updateBookingPaymentStatus(bookingId: string, refundAmount: number): Promise<void> {
    const booking = await Booking.findById(bookingId);
    if (booking) {
      booking.payment = booking.payment || {};
      booking.payment.refundedAt = new Date();
      booking.payment.totalRefunded = (booking.payment.totalRefunded || 0) + refundAmount;

      // Check if fully refunded
      if (booking.payment.totalRefunded >= booking.pricing?.totalAmount) {
        booking.payment.status = 'refunded';
      }

      await booking.save();
    }
  }
}

// ============================================
// CREATE REFUND REQUEST MODEL
// ============================================

// Define Schema reference before use
const Schema = mongoose.Schema;

// Create the RefundRequest model schema
const refundRequestSchema = new mongoose.Schema({
  refundNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  },
  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  processedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Refund amount cannot be negative'],
  },
  originalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  reason: {
    type: String,
    enum: ['cancellation', 'service_not_provided', 'poor_quality', 'provider_no_show', 'customer_request', 'duplicate_charge', 'billing_error', 'other'],
    required: true,
  },
  description: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'failed'],
    default: 'pending',
    index: true,
  },
  type: {
    type: String,
    enum: ['full', 'partial', 'prorated', 'chargeback', 'dispute'],
    required: true,
  },
  stripeRefundId: String,
  stripeChargeId: String,
  disputeId: {
    type: Schema.Types.ObjectId,
    ref: 'Dispute',
  },
  refundPercentage: Number,
  processingNotes: String,
  rejectionReason: String,
  approvedAt: Date,
  processedAt: Date,
  completedAt: Date,
  metadata: mongoose.Schema.Types.Mixed,
  timeline: [{
    action: String,
    performedBy: Schema.Types.ObjectId,
    performedByRole: String,
    timestamp: Date,
    details: String,
    previousStatus: String,
    newStatus: String,
  }],
}, {
  timestamps: true,
});

// Add indexes
refundRequestSchema.index({ status: 1, createdAt: -1 });
refundRequestSchema.index({ requestedBy: 1, status: 1 });
refundRequestSchema.index({ bookingId: 1, status: 1 });

// Register model if not already registered
if (!mongoose.models.RefundRequest) {
  mongoose.model('RefundRequest', refundRequestSchema);
}

// ============================================
// EXPORT SERVICE INSTANCE
// ============================================

export const refundService = new RefundService();
export default refundService;
