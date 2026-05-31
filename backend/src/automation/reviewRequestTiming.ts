/**
 * Review Request Timing Automation
 *
 * Smart timing for review request emails:
 * - Optimal send time calculation
 * - Post-completion delay
 * - Follow-up sequence
 * - Photo review request
 * - Incentive for review
 */

import mongoose, { Document, Schema } from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Review from '../models/review.model';
import logger from '../utils/logger';
import { addJob } from '../queue';

export interface IReviewRequest extends Document {
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  sequenceNumber: number; // 1, 2, or 3
  type: 'initial' | 'follow_up' | 'final';
  scheduledFor: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'opened' | 'completed' | 'skipped' | 'failed';
  metadata?: {
    emailOpenedAt?: Date;
    linkClickedAt?: Date;
    responseTime?: number; // Minutes from send to open
    photoRequested?: boolean;
    incentiveOffered?: boolean;
    incentiveCode?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const reviewRequestSchema = new Schema<IReviewRequest>(
  {
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
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sequenceNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },
    type: {
      type: String,
      enum: ['initial', 'follow_up', 'final'],
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['pending', 'sent', 'opened', 'completed', 'skipped', 'failed'],
      default: 'pending',
      index: true,
    },
    metadata: {
      emailOpenedAt: Date,
      linkClickedAt: Date,
      responseTime: Number,
      photoRequested: Boolean,
      incentiveOffered: Boolean,
      incentiveCode: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
reviewRequestSchema.index({ status: 1, scheduledFor: 1 });
reviewRequestSchema.index({ customerId: 1, status: 1 });
reviewRequestSchema.index({ bookingId: 1, sequenceNumber: 1 }, { unique: true });

const ReviewRequest = mongoose.model<IReviewRequest>('ReviewRequest', reviewRequestSchema);

// Configuration
const CONFIG = {
  // When to send initial review request after booking completion
  initialDelayHours: 4, // 4 hours after completion

  // Follow-up timing
  followUpDelayDays: 2, // 2 days after initial if no review

  // Final reminder timing
  finalDelayDays: 5, // 5 days after follow-up if no review

  // Only send during business hours
  businessHours: {
    start: 9, // 9 AM
    end: 18, // 6 PM
    timezone: 'Asia/Dubai',
  },

  // Photo review incentive
  photoReviewIncentive: {
    points: 20,
    description: 'Get 20 bonus points for adding a photo to your review!',
  },

  // Review completion incentive
  reviewIncentive: {
    points: 10,
    description: 'Thank you for your review! You earned 10 bonus points.',
  },
};

interface SendTimeResult {
  date: Date;
  hour: number;
  reason: string;
}

/**
 * Calculate optimal send time for a review request
 */
function calculateOptimalSendTime(completionTime: Date): SendTimeResult {
  const dubaiOffset = 4 * 60; // Dubai is UTC+4
  const completionDate = new Date(completionTime);
  completionDate.setMinutes(completionDate.getMinutes() + dubaiOffset);

  // Get day of week (Dubai timezone)
  const dayOfWeek = completionDate.getUTCDay();

  // If it's Friday or Saturday (weekend in UAE), adjust to Sunday
  let sendDate = new Date(completionDate);
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    // Send on Sunday at 10 AM
    sendDate.setDate(sendDate.getDate() + (7 - dayOfWeek));
    sendDate.setUTCHours(6, 0, 0, 0); // 10 AM Dubai time = 6 AM UTC
  } else {
    // Send at 10 AM on the next business day
    sendDate.setUTCHours(6, 0, 0, 0); // 10 AM Dubai time

    // If past business hours, move to next day
    const currentHour = sendDate.getUTCHours();
    if (currentHour >= CONFIG.businessHours.end) {
      sendDate.setDate(sendDate.getDate() + 1);
    }
  }

  return {
    date: sendDate,
    hour: sendDate.getUTCHours() + dubaiOffset / 60,
    reason: 'Optimal business hours in Dubai timezone',
  };
}

/**
 * Schedule review requests for a completed booking
 */
export async function scheduleReviewRequests(bookingId: mongoose.Types.ObjectId): Promise<void> {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('customerId', 'firstName email communicationPreferences')
      .populate('providerId', 'firstName');

    if (!booking) {
      logger.error('scheduleReviewRequests: Booking not found', { bookingId: bookingId.toString() });
      return;
    }

    if (!booking.completedAt) {
      logger.warn('scheduleReviewRequests: Booking not completed', { bookingId: bookingId.toString() });
      return;
    }

    // Check if reviews already exist
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      logger.info('scheduleReviewRequests: Review already exists', { bookingId: bookingId.toString() });
      return;
    }

    const customer = booking.customerId as unknown as {
      _id: mongoose.Types.ObjectId;
      firstName: string;
      email: string;
      communicationPreferences?: { email?: { reviews?: boolean } };
    };

    const provider = booking.providerId as unknown as {
      _id: mongoose.Types.ObjectId;
      firstName: string;
    };

    // Check communication preferences
    if (customer.communicationPreferences?.email?.reviews === false) {
      logger.info('scheduleReviewRequests: Customer opted out of review requests', {
        customerId: customer._id.toString(),
      });
      return;
    }

    const completionTime = booking.completedAt;

    // Schedule initial request (4 hours after completion)
    const initialScheduledFor = new Date(completionTime);
    initialScheduledFor.setHours(initialScheduledFor.getHours() + CONFIG.initialDelayHours);

    // Adjust to business hours
    const optimalTime = calculateOptimalSendTime(completionTime);
    if (initialScheduledFor < optimalTime.date) {
      initialScheduledFor.setTime(optimalTime.date.getTime());
    }

    await ReviewRequest.create({
      bookingId,
      customerId: customer._id,
      providerId: provider._id,
      sequenceNumber: 1,
      type: 'initial',
      scheduledFor: initialScheduledFor,
      status: 'pending',
    });

    // Schedule follow-up (2 days later if no review)
    const followUpScheduledFor = new Date(initialScheduledFor);
    followUpScheduledFor.setDate(followUpScheduledFor.getDate() + CONFIG.followUpDelayDays);

    await ReviewRequest.create({
      bookingId,
      customerId: customer._id,
      providerId: provider._id,
      sequenceNumber: 2,
      type: 'follow_up',
      scheduledFor: followUpScheduledFor,
      status: 'pending',
    });

    // Schedule final reminder (5 days after follow-up)
    const finalScheduledFor = new Date(followUpScheduledFor);
    finalScheduledFor.setDate(finalScheduledFor.getDate() + CONFIG.finalDelayDays);

    await ReviewRequest.create({
      bookingId,
      customerId: customer._id,
      providerId: provider._id,
      sequenceNumber: 3,
      type: 'final',
      scheduledFor: finalScheduledFor,
      status: 'pending',
    });

    logger.info('scheduleReviewRequests: Review requests scheduled', {
      bookingId: bookingId.toString(),
      customerId: customer._id.toString(),
      initialScheduledFor: initialScheduledFor.toISOString(),
    });
  } catch (error) {
    logger.error('scheduleReviewRequests: Failed', {
      bookingId: bookingId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process pending review requests
 * Called every 15 minutes by scheduled job
 */
export async function processReviewRequests(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const result = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);

    // Find review requests ready to send
    const pendingRequests = await ReviewRequest.find({
      status: 'pending',
      scheduledFor: {
        $gte: windowStart,
        $lte: windowEnd,
      },
    }).populate('bookingId', 'bookingNumber serviceId completedAt')
      .populate('customerId', 'firstName email communicationPreferences')
      .populate('providerId', 'firstName');

    logger.info('processReviewRequests: Found pending requests', {
      count: pendingRequests.length,
    });

    for (const request of pendingRequests) {
      result.processed++;

      try {
        // Check if review was already completed
        const existingReview = await Review.findOne({ bookingId: request.bookingId });
        if (existingReview) {
          await request.updateOne({ status: 'completed' });
          result.skipped++;
          continue;
        }

        const customer = request.customerId as unknown as {
          _id: mongoose.Types.ObjectId;
          firstName: string;
          email: string;
        };

        const provider = request.providerId as unknown as {
          _id: mongoose.Types.ObjectId;
          firstName: string;
        };

        const booking = request.bookingId as unknown as {
          bookingNumber: string;
          completedAt?: Date;
        };

        // Generate incentive code for photo review
        const incentiveCode = `PHOTO${Date.now().toString(36).toUpperCase()}`;

        // Prepare email data
        const emailData = {
          to: customer.email,
          subject: request.sequenceNumber === 1
            ? `How was your experience with ${provider.firstName}?`
            : request.sequenceNumber === 2
              ? `Share your feedback - You\'re still in time!`
              : `Last chance to share your experience`,
          template: 'review_request',
          userId: customer._id.toString(),
          bookingId: request.bookingId.toString(),
          data: {
            customerName: customer.firstName,
            providerName: provider.firstName,
            bookingNumber: booking.bookingNumber,
            sequenceNumber: request.sequenceNumber,
            type: request.type,
            photoReviewPoints: CONFIG.photoReviewIncentive.points,
            reviewPoints: CONFIG.reviewIncentive.points,
            incentiveCode,
          },
        };

        // Queue the email
        await addJob('email-queue', 'send_review_request', emailData);

        // Update request status
        await request.updateOne({
          status: 'sent',
          sentAt: new Date(),
          'metadata.photoRequested': true,
          'metadata.incentiveOffered': true,
          'metadata.incentiveCode': incentiveCode,
        });

        result.sent++;
        logger.info('processReviewRequests: Review request sent', {
          requestId: request._id.toString(),
          customerId: customer._id.toString(),
          type: request.type,
        });
      } catch (error) {
        logger.error('processReviewRequests: Failed to send', {
          requestId: request._id.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        await request.updateOne({ status: 'failed' });
        result.failed++;
      }
    }

    logger.info('processReviewRequests: Completed', result);
    return result;
  } catch (error) {
    logger.error('processReviewRequests: Process failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Mark review request as completed (review was submitted)
 */
export async function markReviewRequestCompleted(
  bookingId: mongoose.Types.ObjectId,
  includePhoto: boolean
): Promise<void> {
  try {
    // Mark all pending requests as completed
    await ReviewRequest.updateMany(
      { bookingId, status: { $in: ['pending', 'sent', 'opened'] } },
      { status: 'completed' }
    );

    // If photo was included, award bonus points
    if (includePhoto) {
      const request = await ReviewRequest.findOne({ bookingId })
        .populate('customerId', '_id');

      if (request) {
        const customer = request.customerId as unknown as { _id: mongoose.Types.ObjectId };

        await addJob('loyalty-queue', 'award_review_bonus', {
          userId: customer._id.toString(),
          bonusPoints: CONFIG.photoReviewIncentive.points,
          description: CONFIG.photoReviewIncentive.description,
        });

        logger.info('markReviewRequestCompleted: Photo bonus awarded', {
          bookingId: bookingId.toString(),
          points: CONFIG.photoReviewIncentive.points,
        });
      }
    }

    logger.info('markReviewRequestCompleted: Review requests marked complete', {
      bookingId: bookingId.toString(),
      includePhoto,
    });
  } catch (error) {
    logger.error('markReviewRequestCompleted: Failed', {
      bookingId: bookingId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Track email open
 */
export async function trackReviewRequestOpen(requestId: string): Promise<void> {
  try {
    const request = await ReviewRequest.findById(requestId);
    if (!request) return;

    await request.updateOne({
      status: 'opened',
      'metadata.emailOpenedAt': new Date(),
    });

    // Calculate response time
    if (request.sentAt) {
      const responseTime = Math.floor(
        (Date.now() - request.sentAt.getTime()) / (1000 * 60)
      );
      await request.updateOne({
        'metadata.responseTime': responseTime,
      });
    }

    logger.info('trackReviewRequestOpen: Review request opened', {
      requestId,
      customerId: request.customerId.toString(),
    });
  } catch (error) {
    logger.error('trackReviewRequestOpen: Failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Skip remaining review requests for a booking
 */
export async function skipRemainingRequests(bookingId: mongoose.Types.ObjectId): Promise<void> {
  try {
    await ReviewRequest.updateMany(
      { bookingId, status: 'pending' },
      { status: 'skipped' }
    );

    logger.info('skipRemainingRequests: Remaining requests skipped', {
      bookingId: bookingId.toString(),
    });
  } catch (error) {
    logger.error('skipRemainingRequests: Failed', {
      bookingId: bookingId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get review request statistics
 */
export async function getReviewRequestStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  bySequence: Record<number, { sent: number; completed: number; conversionRate: number }>;
  averageResponseTime: number;
  photoReviewRate: number;
}> {
  const statusStats = await ReviewRequest.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const sequenceStats = await ReviewRequest.aggregate([
    {
      $group: {
        _id: '$sequenceNumber',
        sent: {
          $sum: { $cond: [{ $in: ['$status', ['sent', 'opened', 'completed']] }, 1, 0] },
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
      },
    },
  ]);

  const responseTimeStats = await ReviewRequest.aggregate([
    {
      $match: {
        'metadata.responseTime': { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: null,
        avgResponseTime: { $avg: '$metadata.responseTime' },
      },
    },
  ]);

  const photoStats = await ReviewRequest.aggregate([
    {
      $match: {
        status: 'completed',
        'metadata.incentiveOffered': true,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        withIncentive: {
          $sum: { $cond: [{ $eq: ['$metadata.photoRequested', true] }, 1, 0] },
        },
      },
    },
  ]);

  const byStatus = statusStats.reduce((acc, s) => {
    acc[s._id] = s.count;
    return acc;
  }, {} as Record<string, number>);

  const bySequence: Record<number, { sent: number; completed: number; conversionRate: number }> = {};
  for (const stat of sequenceStats) {
    bySequence[stat._id] = {
      sent: stat.sent,
      completed: stat.completed,
      conversionRate: stat.sent > 0 ? (stat.completed / stat.sent) * 100 : 0,
    };
  }

  return {
    total: (Object.values(byStatus) as number[]).reduce((sum, count) => sum + count, 0),
    byStatus,
    bySequence,
    averageResponseTime: responseTimeStats[0]?.avgResponseTime || 0,
    photoReviewRate: photoStats[0]?.total
      ? (photoStats[0].withIncentive / photoStats[0].total) * 100
      : 0,
  };
}

/**
 * Send review requests to eligible customers
 * Wrapper function for scheduler integration
 */
export async function sendReviewRequests(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  try {
    logger.info('Sending review requests via scheduler');
    const result = await processReviewRequests();
    logger.info('Review requests sent via scheduler', result);
    return result;
  } catch (error) {
    logger.error('Review requests failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  scheduleReviewRequests,
  processReviewRequests,
  sendReviewRequests,
  markReviewRequestCompleted,
  trackReviewRequestOpen,
  skipRemainingRequests,
  getReviewRequestStats,
  ReviewRequest,
};
