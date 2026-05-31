/**
 * Negative Review Recovery Automation
 *
 * Handles negative reviews with proactive recovery:
 * - Detect negative reviews (1-2 stars)
 * - Immediate alert to operations team
 * - Auto-respond with empathy
 * - Escalation path for severe cases
 * - Resolution tracking
 */

import mongoose, { Document, Schema } from 'mongoose';
import Review from '../models/review.model';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Dispute from '../models/dispute.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface INegativeReviewRecovery extends Document {
  reviewId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  originalRating: number;
  recoveryStatus: 'detected' | 'responding' | 'in_progress' | 'resolved' | 'escalated' | 'failed';
  alertSentAt?: Date;
  alertSentTo: string[];
  responseSentAt?: Date;
  responseMessage?: string;
  escalation?: {
    escalatedAt: Date;
    escalatedTo: mongoose.Types.ObjectId;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  };
  resolution?: {
    resolvedAt: Date;
    type: 'provider_response' | 'refund_offered' | 'partial_refund' | 'full_refund' | 'no_action';
    description: string;
    ratingChanged?: boolean;
    newRating?: number;
  };
  timeline: Array<{
    action: string;
    timestamp: Date;
    performedBy: 'system' | mongoose.Types.ObjectId;
    details?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const negativeReviewRecoverySchema = new Schema<INegativeReviewRecovery>(
  {
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originalRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    recoveryStatus: {
      type: String,
      enum: ['detected', 'responding', 'in_progress', 'resolved', 'escalated', 'failed'],
      default: 'detected',
      index: true,
    },
    alertSentAt: Date,
    alertSentTo: [{
      type: String,
    }],
    responseSentAt: Date,
    responseMessage: String,
    escalation: {
      escalatedAt: Date,
      escalatedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      reason: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
      },
    },
    resolution: {
      resolvedAt: Date,
      type: {
        type: String,
        enum: ['provider_response', 'refund_offered', 'partial_refund', 'full_refund', 'no_action'],
      },
      description: String,
      ratingChanged: Boolean,
      newRating: Number,
    },
    timeline: [{
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
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
negativeReviewRecoverySchema.index({ recoveryStatus: 1, createdAt: -1 });
negativeReviewRecoverySchema.index({ providerId: 1, recoveryStatus: 1 });
negativeReviewRecoverySchema.index({ escalation: 1 });

const NegativeReviewRecovery = mongoose.model<INegativeReviewRecovery>('NegativeReviewRecovery', negativeReviewRecoverySchema);

// Configuration
const CONFIG = {
  // Rating threshold for negative reviews
  negativeThreshold: 3, // 3 stars and below

  // Alert recipients (ops team emails)
  alertRecipients: [
    'ops@nilin.com',
    'support@nilin.com',
  ],

  // Auto-response templates
  templates: {
    urgent: {
      subject: 'URGENT: Critical Review Requires Immediate Attention',
      body: `Dear {providerName},

We noticed you received a {rating}-star review for booking #{bookingNumber}. We take this seriously and want to help resolve the issue.

Please contact the customer directly within 24 hours to address their concerns. Our support team is ready to assist if needed.

Best regards,
NILIN Operations Team`,
    },
    standard: {
      subject: 'Customer Feedback Received - Action Required',
      body: `Dear {providerName},

You recently received a {rating}-star review for booking #{bookingNumber}. We value your service and want to help improve the customer experience.

Please take a moment to respond professionally to the customer. A thoughtful response can help rebuild trust.

If the issue involves a service problem, please let us know how we can help.

Best regards,
NILIN Operations Team`,
    },
  },

  // Escalation rules
  escalationRules: {
    // Auto-escalate if rating is 1 star
    urgentRating: 1,
    // Auto-escalate if review mentions certain keywords
    triggerKeywords: ['safety', 'danger', 'scam', 'fraud', 'stole', 'police', 'lawyer'],
    // Escalate if no response within 24 hours
    responseDeadlineHours: 24,
  },

  // Refund thresholds
  refundThresholds: {
    // If customer explicitly requests refund
    customerRequested: 0.5, // 50% refund max auto-approved
    // Partial refund for service issues
    serviceIssue: 0.25, // 25% refund max
  },
};

/**
 * Detect and process new negative reviews
 * Called when a review is created or its status changes
 */
export async function detectNegativeReview(reviewId: mongoose.Types.ObjectId): Promise<INegativeReviewRecovery | null> {
  try {
    const review = await Review.findById(reviewId)
      .populate('bookingId')
      .populate('reviewerId', 'firstName email')
      .populate('revieweeId', 'firstName email');

    if (!review) {
      logger.error('detectNegativeReview: Review not found', { reviewId: reviewId.toString() });
      return null;
    }

    // Only process customer reviews of providers (1-way review system)
    if (review.reviewerType !== 'customer' || review.revieweeType !== 'provider') {
      return null;
    }

    // Check if rating is negative
    if (review.rating > CONFIG.negativeThreshold) {
      logger.debug('detectNegativeReview: Rating not negative', {
        reviewId: reviewId.toString(),
        rating: review.rating,
      });
      return null;
    }

    // Check if recovery already exists
    const existingRecovery = await NegativeReviewRecovery.findOne({ reviewId });
    if (existingRecovery) {
      return existingRecovery;
    }

    const booking = review.bookingId as unknown as {
      _id: mongoose.Types.ObjectId;
      bookingNumber: string;
      customerId: mongoose.Types.ObjectId;
      providerId: mongoose.Types.ObjectId;
    };

    const customer = review.reviewerId as unknown as {
      _id: mongoose.Types.ObjectId;
      firstName: string;
      email: string;
    };

    const provider = review.revieweeId as unknown as {
      _id: mongoose.Types.ObjectId;
      firstName: string;
      email: string;
    };

    // Determine if this needs urgent escalation
    const isUrgent = review.rating <= CONFIG.escalationRules.urgentRating ||
      CONFIG.escalationRules.triggerKeywords.some(keyword =>
        review.comment.toLowerCase().includes(keyword)
      );

    // Create recovery record
    const recovery = await NegativeReviewRecovery.create({
      reviewId,
      bookingId: booking._id,
      customerId: customer._id,
      providerId: provider._id,
      originalRating: review.rating,
      recoveryStatus: 'detected',
      alertSentTo: CONFIG.alertRecipients,
      timeline: [{
        action: 'detected',
        timestamp: new Date(),
        performedBy: 'system',
        details: `Negative review detected: ${review.rating} stars`,
      }],
    });

    logger.info('detectNegativeReview: Negative review detected', {
      reviewId: reviewId.toString(),
      bookingId: booking._id.toString(),
      rating: review.rating,
      isUrgent,
    });

    // Send alerts
    await sendRecoveryAlerts(recovery, review, { customer, provider, booking }, isUrgent);

    // Send auto-response to provider
    await sendProviderAutoResponse(recovery, provider, booking, review.rating, isUrgent);

    // If urgent, escalate immediately
    if (isUrgent) {
      await escalateRecovery(recovery._id, {
        reason: review.rating === 1
          ? 'Critical 1-star review requiring immediate attention'
          : 'Review contains concerning keywords',
        priority: review.rating === 1 ? 'urgent' : 'high',
      });
    }

    return recovery;
  } catch (error) {
    logger.error('detectNegativeReview: Failed', {
      reviewId: reviewId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Send alerts to ops team
 */
async function sendRecoveryAlerts(
  recovery: INegativeReviewRecovery,
  review: typeof Review.prototype,
  parties: {
    customer: { firstName: string; email: string };
    provider: { firstName: string; email: string };
    booking: { bookingNumber: string };
  },
  isUrgent: boolean
): Promise<void> {
  try {
    const alertData = {
      to: CONFIG.alertRecipients,
      subject: isUrgent
        ? CONFIG.templates.urgent.subject
        : CONFIG.templates.standard.subject,
      template: 'negative_review_alert',
      data: {
        reviewId: recovery.reviewId.toString(),
        bookingNumber: parties.booking.bookingNumber,
        rating: recovery.originalRating,
        comment: review.comment,
        customerName: parties.customer.firstName,
        providerName: parties.provider.firstName,
        isUrgent,
        recoveryId: recovery._id.toString(),
        alertTime: new Date().toISOString(),
      },
    };

    await addJob('notification-queue', 'send_alert', alertData);

    // Send push notification to ops
    await addJob('notification-queue', 'send_notification', {
      userId: 'ops_team',
      type: 'negative_review_alert',
      title: isUrgent ? 'URGENT: Critical Review' : 'New Negative Review',
      message: `${parties.provider.firstName} received a ${recovery.originalRating}-star review`,
      data: {
        recoveryId: recovery._id.toString(),
        priority: isUrgent ? 'urgent' : 'normal',
      },
    });

    await recovery.updateOne({
      alertSentAt: new Date(),
      recoveryStatus: 'responding',
    });

    logger.info('sendRecoveryAlerts: Alerts sent', {
      recoveryId: recovery._id.toString(),
      alertRecipients: CONFIG.alertRecipients,
    });
  } catch (error) {
    logger.error('sendRecoveryAlerts: Failed', {
      recoveryId: recovery._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Send auto-response to provider
 */
async function sendProviderAutoResponse(
  recovery: INegativeReviewRecovery,
  provider: { _id: mongoose.Types.ObjectId; firstName: string; email: string },
  booking: { bookingNumber: string },
  rating: number,
  isUrgent: boolean
): Promise<void> {
  try {
    const template = isUrgent ? CONFIG.templates.urgent : CONFIG.templates.standard;
    const message = template.body
      .replace('{providerName}', provider.firstName)
      .replace('{bookingNumber}', booking.bookingNumber)
      .replace('{rating}', rating.toString());

    // Queue email to provider
    await addJob('email-queue', 'send_email', {
      to: provider.email,
      subject: template.subject,
      body: message,
      template: 'provider_negative_review_response',
    });

    await recovery.updateOne({
      responseSentAt: new Date(),
      responseMessage: message,
      'timeline.action': 'auto_response_sent',
      'timeline.details': 'Auto-response sent to provider',
    });

    logger.info('sendProviderAutoResponse: Response sent', {
      recoveryId: recovery._id.toString(),
      providerId: provider._id.toString(),
    });
  } catch (error) {
    logger.error('sendProviderAutoResponse: Failed', {
      recoveryId: recovery._id.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Escalate recovery to ops team
 */
export async function escalateRecovery(
  recoveryId: mongoose.Types.ObjectId,
  options: {
    reason: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }
): Promise<void> {
  try {
    const recovery = await NegativeReviewRecovery.findById(recoveryId);
    if (!recovery) {
      throw new Error(`Recovery not found: ${recoveryId}`);
    }

    // Find an available ops team member
    const opsUser = await User.findOne({
      role: 'admin',
      accountStatus: 'active',
    }).select('_id');

    recovery.escalation = {
      escalatedAt: new Date(),
      escalatedTo: opsUser?._id || new mongoose.Types.ObjectId(),
      reason: options.reason,
      priority: options.priority || 'medium',
    };
    recovery.recoveryStatus = 'escalated';

    recovery.timeline.push({
      action: 'escalated',
      timestamp: new Date(),
      performedBy: 'system',
      details: `Escalated: ${options.reason}`,
    });

    await recovery.save();

    // Send escalation notification
    await addJob('notification-queue', 'send_notification', {
      userId: recovery.escalation.escalatedTo.toString(),
      type: 'recovery_escalated',
      title: 'Review Recovery Escalated',
      message: `A negative review requires your attention. Priority: ${options.priority}`,
      data: {
        recoveryId: recovery._id.toString(),
        priority: options.priority,
      },
    });

    logger.info('escalateRecovery: Recovery escalated', {
      recoveryId: recoveryId.toString(),
      priority: options.priority,
    });
  } catch (error) {
    logger.error('escalateRecovery: Failed', {
      recoveryId: recoveryId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Mark recovery as resolved
 */
export async function resolveRecovery(
  recoveryId: mongoose.Types.ObjectId,
  resolution: {
    type: 'provider_response' | 'refund_offered' | 'partial_refund' | 'full_refund' | 'no_action';
    description: string;
    ratingChanged?: boolean;
    newRating?: number;
  }
): Promise<void> {
  try {
    const recovery = await NegativeReviewRecovery.findById(recoveryId);
    if (!recovery) {
      throw new Error(`Recovery not found: ${recoveryId}`);
    }

    recovery.resolution = {
      resolvedAt: new Date(),
      ...resolution,
    };
    recovery.recoveryStatus = 'resolved';

    recovery.timeline.push({
      action: 'resolved',
      timestamp: new Date(),
      performedBy: 'system',
      details: `Resolved with: ${resolution.type}`,
    });

    await recovery.save();

    // If rating was updated, update the review
    if (resolution.ratingChanged && resolution.newRating) {
      await Review.findByIdAndUpdate(recovery.reviewId, {
        rating: resolution.newRating,
      });
    }

    logger.info('resolveRecovery: Recovery resolved', {
      recoveryId: recoveryId.toString(),
      resolutionType: resolution.type,
    });

    // Publish resolution event
    await addJob('analytics-queue', 'track_event', {
      event: 'negative_review_resolved',
      recoveryId: recoveryId.toString(),
      bookingId: recovery.bookingId.toString(),
      providerId: recovery.providerId.toString(),
      originalRating: recovery.originalRating,
      newRating: resolution.newRating,
      resolutionType: resolution.type,
      resolutionTime: Date.now() - recovery.createdAt.getTime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('resolveRecovery: Failed', {
      recoveryId: recoveryId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Check for overdue responses and escalate
 * Called daily by scheduled job
 */
export async function checkOverdueRecoveries(): Promise<number> {
  try {
    const deadline = new Date(
      Date.now() - CONFIG.escalationRules.responseDeadlineHours * 60 * 60 * 1000
    );

    const overdueRecoveries = await NegativeReviewRecovery.find({
      recoveryStatus: { $in: ['detected', 'responding'] },
      createdAt: { $lt: deadline },
    });

    let escalatedCount = 0;

    for (const recovery of overdueRecoveries) {
      await escalateRecovery(recovery._id, {
        reason: `No response within ${CONFIG.escalationRules.responseDeadlineHours} hours`,
        priority: 'high',
      });
      escalatedCount++;
    }

    logger.info('checkOverdueRecoveries: Checked overdue recoveries', {
      overdueCount: overdueRecoveries.length,
      escalatedCount,
    });

    return escalatedCount;
  } catch (error) {
    logger.error('checkOverdueRecoveries: Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get recovery statistics
 */
export async function getRecoveryStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  averageResolutionTime: number;
  escalationRate: number;
  successfulRecoveryRate: number;
}> {
  const statusStats = await NegativeReviewRecovery.aggregate([
    {
      $group: {
        _id: '$recoveryStatus',
        count: { $sum: 1 },
      },
    },
  ]);

  const resolutionTimeStats = await NegativeReviewRecovery.aggregate([
    {
      $match: {
        recoveryStatus: 'resolved',
        'resolution.resolvedAt': { $exists: true },
      },
    },
    {
      $project: {
        resolutionTime: {
          $divide: [
            { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
            1000 * 60 * 60, // Convert to hours
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgResolutionTime: { $avg: '$resolutionTime' },
      },
    },
  ]);

  const byStatus = statusStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const total = (Object.values(byStatus) as number[]).reduce((sum, count) => sum + count, 0);
  const escalated = byStatus['escalated'] || 0;
  const resolved = byStatus['resolved'] || 0;

  return {
    total,
    byStatus,
    averageResolutionTime: resolutionTimeStats[0]?.avgResolutionTime || 0,
    escalationRate: total > 0 ? (escalated / total) * 100 : 0,
    successfulRecoveryRate: total > 0 ? (resolved / total) * 100 : 0,
  };
}

/**
 * Process negative reviews and send recovery outreach
 * Wrapper function for scheduler integration
 */
export async function processNegativeReviews(): Promise<{
  detected: number;
  processed: number;
  recoveriesInitiated: number;
}> {
  try {
    logger.info('Processing negative reviews via scheduler');

    // Check for overdue recoveries
    const overdueCount = await checkOverdueRecoveries();
    logger.info('Overdue recoveries checked', { count: overdueCount });

    logger.info('Negative review processing completed via scheduler');

    return {
      detected: overdueCount,
      processed: overdueCount,
      recoveriesInitiated: overdueCount,
    };
  } catch (error) {
    logger.error('Negative review processing failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  detectNegativeReview,
  escalateRecovery,
  resolveRecovery,
  checkOverdueRecoveries,
  getRecoveryStats,
  processNegativeReviews,
  NegativeReviewRecovery,
};
