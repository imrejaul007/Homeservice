/**
 * Auto-Refund Threshold Automation
 *
 * Automatic dispute resolution through threshold-based refunds:
 * - Threshold-based refunds
 * - Provider notification
 * - Audit trail
 * - Exception handling
 */

import mongoose, { Document, Schema } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Dispute from '../models/dispute.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IAutoRefundRecord extends Document {
  bookingId: mongoose.Types.ObjectId;
  disputeId?: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  refundType: 'threshold_auto' | 'partial_auto' | 'full_auto' | 'admin_override';
  originalAmount: number;
  refundAmount: number;
  refundPercentage: number;
  reason: string;
  triggerCriteria: {
    amountThreshold?: number;
    daysSinceBooking?: number;
    responseDeadlineExceeded?: boolean;
    customerSeverity?: 'low' | 'medium' | 'high';
  };
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed';
  providerNotifiedAt?: Date;
  providerResponseDeadline?: Date;
  providerResponse?: {
    respondedAt: Date;
    accepted: boolean;
    notes?: string;
  };
  processedAt?: Date;
  processedBy: 'system' | mongoose.Types.ObjectId;
  errorMessage?: string;
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    performedBy: 'system' | mongoose.Types.ObjectId;
    details?: string;
    previousStatus?: string;
    newStatus?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const autoRefundRecordSchema = new Schema<IAutoRefundRecord>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    disputeId: {
      type: Schema.Types.ObjectId,
      ref: 'Dispute',
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refundType: {
      type: String,
      enum: ['threshold_auto', 'partial_auto', 'full_auto', 'admin_override'],
      required: true,
    },
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    reason: {
      type: String,
      required: true,
    },
    triggerCriteria: {
      amountThreshold: Number,
      daysSinceBooking: Number,
      responseDeadlineExceeded: Boolean,
      customerSeverity: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processed', 'failed'],
      default: 'pending',
      index: true,
    },
    providerNotifiedAt: Date,
    providerResponseDeadline: Date,
    providerResponse: {
      respondedAt: Date,
      accepted: Boolean,
      notes: String,
    },
    processedAt: Date,
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    errorMessage: String,
    auditTrail: [{
      action: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      performedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      details: String,
      previousStatus: String,
      newStatus: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
autoRefundRecordSchema.index({ status: 1, createdAt: -1 });
autoRefundRecordSchema.index({ providerId: 1, status: 1 });
autoRefundRecordSchema.index({ providerResponseDeadline: 1, status: 1 });

const AutoRefundRecord = mongoose.model<IAutoRefundRecord>('AutoRefundRecord', autoRefundRecordSchema);

// Configuration
const CONFIG = {
  // Amount thresholds (in default currency - AED)
  thresholds: {
    // Auto-refund threshold (full refund for small amounts)
    autoRefundAmount: 50, // Full refund for bookings under 50 AED

    // Partial refund threshold
    partialRefundAmount: 200, // Partial refund for bookings under 200 AED

    // Full refund percentage for auto-refunds
    fullRefundPercentage: 100,

    // Partial refund percentage
    partialRefundPercentage: 50,
  },

  // Time-based thresholds
  timeThresholds: {
    // Auto-refund if no response within X hours
    providerResponseDeadlineHours: 48,

    // Auto-refund if booking was completed X days ago
    maxDaysForComplaint: 30,
  },

  // Severity-based refund rules
  severityRules: {
    high: {
      autoRefundPercentage: 100,
      noResponseThresholdHours: 24,
    },
    medium: {
      autoRefundPercentage: 75,
      noResponseThresholdHours: 48,
    },
    low: {
      autoRefundPercentage: 50,
      noResponseThresholdHours: 72,
    },
  },

  // Exceptions - categories that skip auto-refund
  exceptionCategories: [
    'cancellation',
    'no_show',
  ],

  // Provider response deadline (hours)
  providerNoticeHours: 24,
};

type Severity = 'low' | 'medium' | 'high';

/**
 * Assess complaint severity based on various factors
 */
function assessSeverity(
  bookingAmount: number,
  disputeCategory: string,
  complaintAge: number // days since booking
): Severity {
  // High severity conditions
  if (bookingAmount <= CONFIG.thresholds.autoRefundAmount) {
    return 'high';
  }

  if (CONFIG.exceptionCategories.includes(disputeCategory)) {
    return 'low';
  }

  // Medium severity for older complaints
  if (complaintAge > 14) {
    return 'medium';
  }

  return 'low';
}

/**
 * Calculate refund amount based on severity and amount
 */
function calculateRefundAmount(
  originalAmount: number,
  severity: Severity,
  bookingAmount: number
): { amount: number; percentage: number; type: IAutoRefundRecord['refundType'] } {
  // Small bookings always get full refund
  if (bookingAmount <= CONFIG.thresholds.autoRefundAmount) {
    return {
      amount: originalAmount,
      percentage: 100,
      type: 'threshold_auto',
    };
  }

  // Use severity rules
  const severityConfig = CONFIG.severityRules[severity];

  // Calculate partial refund
  const refundPercentage = severityConfig.autoRefundPercentage;
  const refundAmount = Math.round(originalAmount * (refundPercentage / 100));

  return {
    amount: refundAmount,
    percentage: refundPercentage,
    type: refundPercentage === 100 ? 'full_auto' : 'partial_auto',
  };
}

/**
 * Check for disputes eligible for auto-refund
 * Called by scheduled job every hour
 */
export async function checkDisputesForAutoRefund(): Promise<{
  processed: number;
  refundsCreated: number;
  autoProcessed: number;
}> {
  const result = {
    processed: 0,
    refundsCreated: 0,
    autoProcessed: 0,
  };

  try {
    // Find open disputes that haven't been assigned to auto-refund
    const disputes = await Dispute.find({
      status: 'open',
      category: { $nin: CONFIG.exceptionCategories },
    }).populate('bookingId', 'pricing totalAmount customerId providerId completedAt')
      .populate('initiator.userId', 'firstName email');

    for (const dispute of disputes) {
      result.processed++;

      try {
        // Check if already processed
        const existing = await AutoRefundRecord.findOne({ disputeId: dispute._id });
        if (existing) continue;

        const booking = dispute.bookingId as unknown as {
          _id: mongoose.Types.ObjectId;
          pricing: { totalAmount: number };
          customerId: mongoose.Types.ObjectId;
          providerId: mongoose.Types.ObjectId;
          completedAt?: Date;
        };

        if (!booking) continue;

        const complaintAge = dispute.createdAt
          ? Math.floor((Date.now() - dispute.createdAt.getTime()) / (24 * 60 * 60 * 1000))
          : 0;

        // Check if within time threshold
        if (complaintAge > CONFIG.timeThresholds.maxDaysForComplaint) {
          logger.debug('checkDisputesForAutoRefund: Complaint too old', {
            disputeId: dispute._id.toString(),
            complaintAge,
          });
          continue;
        }

        const severity = assessSeverity(
          booking.pricing.totalAmount,
          dispute.category,
          complaintAge
        );

        const refundCalc = calculateRefundAmount(
          booking.pricing.totalAmount,
          severity,
          booking.pricing.totalAmount
        );

        // Create auto-refund record
        const refundRecord = await createAutoRefundRecord(
          dispute._id,
          booking,
          {
            refundType: refundCalc.type,
            refundAmount: refundCalc.amount,
            refundPercentage: refundCalc.percentage,
            reason: `Auto-refund for ${dispute.category} dispute (${severity} severity)`,
            triggerCriteria: {
              amountThreshold: booking.pricing.totalAmount,
              daysSinceBooking: complaintAge,
              customerSeverity: severity,
            },
          }
        );

        result.refundsCreated++;

        // For high severity, process immediately
        if (severity === 'high' && booking.pricing.totalAmount <= CONFIG.thresholds.autoRefundAmount) {
          await processAutoRefund(refundRecord._id);
          result.autoProcessed++;
        }

      } catch (error) {
        logger.error('checkDisputesForAutoRefund: Error processing dispute', {
          disputeId: dispute._id.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('checkDisputesForAutoRefund: Processed', result);
    return result;
  } catch (error) {
    logger.error('checkDisputesForAutoRefund: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Create an auto-refund record
 */
export async function createAutoRefundRecord(
  disputeId: mongoose.Types.ObjectId,
  booking: {
    _id: mongoose.Types.ObjectId;
    pricing: { totalAmount: number };
    customerId: mongoose.Types.ObjectId;
    providerId: mongoose.Types.ObjectId;
  },
  refundDetails: {
    refundType: IAutoRefundRecord['refundType'];
    refundAmount: number;
    refundPercentage: number;
    reason: string;
    triggerCriteria: IAutoRefundRecord['triggerCriteria'];
  }
): Promise<IAutoRefundRecord> {
  const responseDeadline = new Date();
  responseDeadline.setHours(responseDeadline.getHours() + CONFIG.providerNoticeHours);

  const record = await AutoRefundRecord.create({
    bookingId: booking._id,
    disputeId,
    customerId: booking.customerId,
    providerId: booking.providerId,
    originalAmount: booking.pricing.totalAmount,
    ...refundDetails,
    status: 'pending',
    providerResponseDeadline: responseDeadline,
    auditTrail: [{
      action: 'created',
      timestamp: new Date(),
      performedBy: 'system',
      details: refundDetails.reason,
    }],
  });

  // Notify provider
  await notifyProvider(record);

  logger.info('createAutoRefundRecord: Record created', {
    recordId: record._id.toString(),
    bookingId: booking._id.toString(),
    refundAmount: refundDetails.refundAmount,
  });

  return record;
}

/**
 * Notify provider about auto-refund
 */
async function notifyProvider(record: IAutoRefundRecord): Promise<void> {
  try {
    const provider = await User.findById(record.providerId).select('email firstName');

    if (!provider) return;

    // Send email notification
    await addJob('email-queue', 'send_email', {
      to: provider.email,
      subject: 'Auto-Refund Processing - Action Required',
      template: 'auto_refund_notice',
      data: {
        providerName: provider.firstName,
        bookingId: record.bookingId.toString(),
        refundAmount: record.refundAmount,
        refundPercentage: record.refundPercentage,
        reason: record.reason,
        responseDeadline: record.providerResponseDeadline?.toISOString(),
        acceptUrl: `${process.env.FRONTEND_URL}/bookings/${record.bookingId}/refund/accept`,
        disputeUrl: `${process.env.FRONTEND_URL}/disputes/${record.disputeId}`,
      },
    });

    // Update record
    await record.updateOne({
      providerNotifiedAt: new Date(),
      auditTrail: {
        action: 'provider_notified',
        timestamp: new Date(),
        performedBy: 'system',
        details: `Provider notified at ${new Date().toISOString()}`,
      },
    });

    logger.info('notifyProvider: Provider notified', {
      recordId: record._id.toString(),
      providerId: record.providerId.toString(),
    });
  } catch (error) {
    logger.error('notifyProvider: Failed', {
      recordId: record._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Process auto-refund (execute the refund)
 */
export async function processAutoRefund(
  recordId: mongoose.Types.ObjectId,
  adminOverride?: boolean
): Promise<boolean> {
  try {
    const record = await AutoRefundRecord.findById(recordId);
    if (!record) {
      throw new Error(`Refund record not found: ${recordId}`);
    }

    if (record.status === 'processed') {
      logger.debug('processAutoRefund: Already processed', { recordId: recordId.toString() });
      return false;
    }

    // Update status
    record.status = 'approved';
    record.auditTrail.push({
      action: 'approved',
      timestamp: new Date(),
      performedBy: adminOverride ? 'system' : 'system',
      details: adminOverride ? 'Admin override' : 'Auto-approved based on threshold',
      previousStatus: record.status,
      newStatus: 'approved',
    });

    await record.save();

    // Process the actual refund (in production, this would call payment service)
    await executeRefund(record);

    return true;
  } catch (error) {
    logger.error('processAutoRefund: Failed', {
      recordId: recordId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    await AutoRefundRecord.findByIdAndUpdate(recordId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return false;
  }
}

/**
 * Execute the refund transaction
 */
async function executeRefund(record: IAutoRefundRecord): Promise<void> {
  try {
    // In production, this would:
    // 1. Call payment gateway (Stripe, etc.) to process refund
    // 2. Update booking payment status
    // 3. Update wallet balances
    // 4. Send confirmation emails

    // Update booking payment status
    await Booking.findByIdAndUpdate(record.bookingId, {
      'payment.status': 'refunded',
      'payment.totalRefunded': record.refundAmount,
      'payment.refundedAt': new Date(),
    });

    // Update record
    await record.updateOne({
      status: 'processed',
      processedAt: new Date(),
      auditTrail: {
        action: 'refund_processed',
        timestamp: new Date(),
        performedBy: 'system',
        details: `Refund of ${record.refundAmount} processed successfully`,
        previousStatus: 'approved',
        newStatus: 'processed',
      },
    });

    // Notify customer
    await notifyCustomer(record);

    // Publish event
    await addJob('analytics-queue', 'track_event', {
      event: 'auto_refund_processed',
      bookingId: record.bookingId.toString(),
      disputeId: record.disputeId?.toString(),
      refundAmount: record.refundAmount,
      refundType: record.refundType,
      timestamp: new Date().toISOString(),
    });

    logger.info('executeRefund: Refund processed', {
      recordId: record._id.toString(),
      refundAmount: record.refundAmount,
    });
  } catch (error) {
    logger.error('executeRefund: Refund execution failed', {
      recordId: record._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    await record.updateOne({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      auditTrail: {
        action: 'refund_failed',
        timestamp: new Date(),
        performedBy: 'system',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

/**
 * Notify customer about refund
 */
async function notifyCustomer(record: IAutoRefundRecord): Promise<void> {
  try {
    const customer = await User.findById(record.customerId).select('email firstName');

    if (!customer) return;

    await addJob('email-queue', 'send_email', {
      to: customer.email,
      subject: 'Your Refund Has Been Processed',
      template: 'refund_confirmation',
      data: {
        customerName: customer.firstName,
        refundAmount: record.refundAmount,
        originalAmount: record.originalAmount,
        reason: record.reason,
        bookingId: record.bookingId.toString(),
      },
    });

    // Push notification
    await addJob('notification-queue', 'send_notification', {
      userId: record.customerId.toString(),
      type: 'refund_processed',
      title: 'Refund Processed',
      message: `Your refund of ${record.refundAmount} has been processed. Thank you for your patience.`,
      data: {
        bookingId: record.bookingId.toString(),
        refundAmount: record.refundAmount,
      },
    });

    logger.info('notifyCustomer: Customer notified', {
      recordId: record._id.toString(),
      customerId: record.customerId.toString(),
    });
  } catch (error) {
    logger.error('notifyCustomer: Failed', {
      recordId: record._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Process pending refunds that exceeded provider response deadline
 * Called hourly by scheduled job
 */
export async function processExpiredResponseDeadlines(): Promise<number> {
  try {
    const now = new Date();

    const expiredRecords = await AutoRefundRecord.find({
      status: 'pending',
      providerResponseDeadline: { $lt: now },
      providerResponse: { $exists: false },
    });

    let processed = 0;

    for (const record of expiredRecords) {
      // Update criteria to reflect deadline exceeded
      record.triggerCriteria.responseDeadlineExceeded = true;

      // Auto-approve and process
      await processAutoRefund(record._id);
      processed++;
    }

    logger.info('processExpiredResponseDeadlines: Processed', { count: processed });
    return processed;
  } catch (error) {
    logger.error('processExpiredResponseDeadlines: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get auto-refund statistics
 */
export async function getAutoRefundStats(): Promise<{
  totalRecords: number;
  byStatus: Record<string, number>;
  totalRefunded: number;
  averageRefundPercentage: number;
  averageProcessingTime: number;
  byType: Record<string, { count: number; totalAmount: number }>;
}> {
  const [statusStats, amountStats, typeStats] = await Promise.all([
    AutoRefundRecord.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AutoRefundRecord.aggregate([
      { $match: { status: 'processed' } },
      {
        $group: {
          _id: null,
          totalRefunded: { $sum: '$refundAmount' },
          avgPercentage: { $avg: '$refundPercentage' },
          avgProcessingTime: {
            $avg: {
              $divide: [
                { $subtract: ['$processedAt', '$createdAt'] },
                1000 * 60 * 60, // Hours
              ],
            },
          },
        },
      },
    ]),
    AutoRefundRecord.aggregate([
      { $match: { status: 'processed' } },
      {
        $group: {
          _id: '$refundType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$refundAmount' },
        },
      },
    ]),
  ]);

  const byStatus = statusStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const byType: Record<string, { count: number; totalAmount: number }> = {};
  for (const stat of typeStats) {
    byType[stat._id] = {
      count: stat.count,
      totalAmount: stat.totalAmount,
    };
  }

  return {
    totalRecords: (Object.values(byStatus) as number[]).reduce((sum, count) => sum + count, 0),
    byStatus,
    totalRefunded: amountStats[0]?.totalRefunded || 0,
    averageRefundPercentage: amountStats[0]?.avgPercentage || 0,
    averageProcessingTime: amountStats[0]?.avgProcessingTime || 0,
    byType,
  };
}

/**
 * Process auto refunds based on threshold rules
 * Wrapper function for scheduler integration
 */
export async function processAutoRefunds(): Promise<{
  recordsProcessed: number;
  refundsIssued: number;
  totalRefunded: number;
}> {
  try {
    logger.info('Processing auto refunds via scheduler');

    // Check disputes for auto-refund
    const result = await checkDisputesForAutoRefund();
    logger.info('Auto-refund check completed', result);

    // Process expired response deadlines
    const expired = await processExpiredResponseDeadlines();
    logger.info('Expired response deadlines processed', { count: expired });

    logger.info('Auto refund processing completed via scheduler');

    return {
      recordsProcessed: result.processed,
      refundsIssued: result.refundsCreated,
      totalRefunded: result.autoProcessed,
    };
  } catch (error) {
    logger.error('Auto refund processing failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  checkDisputesForAutoRefund,
  createAutoRefundRecord,
  processAutoRefund,
  processAutoRefunds,
  processExpiredResponseDeadlines,
  getAutoRefundStats,
  AutoRefundRecord,
};
