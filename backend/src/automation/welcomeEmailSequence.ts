/**
 * Welcome Email Sequence Automation
 *
 * Drip campaign for new user onboarding:
 * - Day 1: Welcome email
 * - Day 3: Feature highlights
 * - Day 7: First booking incentive
 * - Day 14: Re-engagement
 *
 * Tracks open/click rates for analytics
 */

import mongoose, { Document, Schema } from 'mongoose';
import User from '../models/user.model';
import logger from '../utils/logger';
import { addJob } from '../queue';
import { cache } from '../config/redis';

export interface IEmailSequence extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  sequenceType: 'welcome' | 'feature_highlight' | 'first_booking_incentive' | 'reengagement';
  step: number;
  scheduledFor: Date;
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'bounced' | 'failed';
  metadata?: {
    openCount?: number;
    clickCount?: number;
    lastInteractionAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const emailSequenceSchema = new Schema<IEmailSequence>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
    },
    sequenceType: {
      type: String,
      enum: ['welcome', 'feature_highlight', 'first_booking_incentive', 'reengagement'],
      required: true,
    },
    step: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    sentAt: Date,
    openedAt: Date,
    clickedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'sent', 'opened', 'clicked', 'bounced', 'failed'],
      default: 'pending',
      index: true,
    },
    metadata: {
      openCount: { type: Number, default: 0 },
      clickCount: { type: Number, default: 0 },
      lastInteractionAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
emailSequenceSchema.index({ status: 1, scheduledFor: 1 });
emailSequenceSchema.index({ userId: 1, sequenceType: 1 }, { unique: true });
emailSequenceSchema.index({ sentAt: 1 });

const EmailSequence = mongoose.model<IEmailSequence>('EmailSequence', emailSequenceSchema);

// Sequence configuration
const SEQUENCE_CONFIG = {
  welcome: {
    day: 1,
    subject: 'Welcome to NILIN - Your Home Services Hub',
    template: 'welcome',
    description: 'Day 1 welcome email',
  },
  feature_highlight: {
    day: 3,
    subject: 'Discover What NILIN Can Do For You',
    template: 'feature_highlights',
    description: 'Day 3 feature showcase',
  },
  first_booking_incentive: {
    day: 7,
    subject: 'Get 15% Off Your First Booking',
    template: 'first_booking_offer',
    description: 'Day 7 incentive offer',
    discountCode: 'WELCOME15',
    discountValue: 15,
  },
  reengagement: {
    day: 14,
    subject: 'We Miss You - Here\'s a Special Offer',
    template: 'reengagement',
    description: 'Day 14 re-engagement',
    discountCode: 'COMEBACK20',
    discountValue: 20,
  },
};

interface SequenceStep {
  key: keyof typeof SEQUENCE_CONFIG;
  day: number;
  subject: string;
  template: string;
  description: string;
  discountCode?: string;
  discountValue?: number;
}

const SEQUENCE_STEPS: SequenceStep[] = [
  { key: 'welcome', ...SEQUENCE_CONFIG.welcome },
  { key: 'feature_highlight', ...SEQUENCE_CONFIG.feature_highlight },
  { key: 'first_booking_incentive', ...SEQUENCE_CONFIG.first_booking_incentive },
  { key: 'reengagement', ...SEQUENCE_CONFIG.reengagement },
];

/**
 * Start email sequence for a new user
 * Called when a new user registers
 */
export async function startEmailSequence(userId: mongoose.Types.ObjectId): Promise<void> {
  try {
    const user = await User.findById(userId).select('email firstName communicationPreferences email isActive');

    if (!user) {
      logger.error('startEmailSequence: User not found', { userId: userId.toString() });
      return;
    }

    // Check if user has opted out of marketing emails
    if (!user.communicationPreferences?.email?.marketing && !user.communicationPreferences?.email?.newsletters) {
      logger.info('startEmailSequence: User opted out of marketing emails, skipping', {
        userId: userId.toString()
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      logger.info('startEmailSequence: User is not active, skipping', {
        userId: userId.toString()
      });
      return;
    }

    const now = new Date();

    // Create all sequence steps
    for (const step of SEQUENCE_STEPS) {
      const scheduledFor = new Date(now);
      scheduledFor.setDate(scheduledFor.getDate() + step.day);

      // Check if sequence already exists
      const existing = await EmailSequence.findOne({
        userId,
        sequenceType: step.key,
      });

      if (existing) {
        logger.debug('startEmailSequence: Step already exists', {
          userId: userId.toString(),
          step: step.key,
        });
        continue;
      }

      await EmailSequence.create({
        userId,
        email: user.email,
        sequenceType: step.key,
        step: SEQUENCE_STEPS.indexOf(step) + 1,
        scheduledFor,
        status: 'pending',
      });

      logger.info('startEmailSequence: Created sequence step', {
        userId: userId.toString(),
        step: step.key,
        scheduledFor: scheduledFor.toISOString(),
      });
    }

    // Publish event for analytics
    logger.info('Email sequence started for new user', {
      userId: userId.toString(),
      email: user.email,
      totalSteps: SEQUENCE_STEPS.length,
    });
  } catch (error) {
    logger.error('startEmailSequence: Failed to start sequence', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process and send pending emails in the sequence
 * Called by scheduled job every 15 minutes
 */
export async function processEmailSequence(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const result = {
    processed: 0,
    sent: 0,
    failed: 0,
  };

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000); // Last 15 minutes
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000); // Next 15 minutes

    // Find emails ready to send
    const pendingEmails = await EmailSequence.find({
      status: 'pending',
      scheduledFor: {
        $gte: windowStart,
        $lte: windowEnd,
      },
    }).populate('userId', 'firstName email isActive communicationPreferences');

    logger.info('processEmailSequence: Found pending emails', {
      count: pendingEmails.length,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });

    for (const emailSeq of pendingEmails) {
      result.processed++;

      try {
        // Verify user is still active and opted in
        const user = emailSeq.userId as unknown as {
          isActive: boolean;
          email: string;
          communicationPreferences?: { email?: { marketing?: boolean; newsletters?: boolean } };
        };

        if (!user || !user.isActive) {
          await emailSeq.updateOne({ status: 'failed' });
          result.failed++;
          continue;
        }

        if (!user.communicationPreferences?.email?.marketing &&
            !user.communicationPreferences?.email?.newsletters) {
          await emailSeq.updateOne({ status: 'failed' });
          result.failed++;
          continue;
        }

        // Get step configuration
        const stepConfig = SEQUENCE_CONFIG[emailSeq.sequenceType as keyof typeof SEQUENCE_CONFIG];
        if (!stepConfig) {
          logger.error('processEmailSequence: Unknown sequence type', {
            sequenceType: emailSeq.sequenceType,
          });
          await emailSeq.updateOne({ status: 'failed' });
          result.failed++;
          continue;
        }

        // Queue the email job
        const jobData = {
          to: user.email,
          subject: stepConfig.subject,
          template: stepConfig.template,
          userId: emailSeq.userId.toString(),
          sequenceId: emailSeq._id.toString(),
          data: {
            discountCode: 'discountCode' in stepConfig ? stepConfig.discountCode : undefined,
            discountValue: 'discountValue' in stepConfig ? stepConfig.discountValue : undefined,
          },
        };

        await addJob('email-queue', 'send_email', jobData);

        // Update status to sent
        await emailSeq.updateOne({
          status: 'sent',
          sentAt: new Date(),
        });

        result.sent++;
        logger.info('processEmailSequence: Email sent', {
          emailSequenceId: emailSeq._id.toString(),
          email: user.email,
          sequenceType: emailSeq.sequenceType,
        });

        // Cache tracking info
        await cache.set(
          `email:sequence:${emailSeq._id}`,
          JSON.stringify({
            userId: emailSeq.userId.toString(),
            type: emailSeq.sequenceType,
            sentAt: new Date().toISOString(),
          }),
          30 * 24 * 60 * 60 // 30 days
        );
      } catch (error) {
        logger.error('processEmailSequence: Failed to process email', {
          emailSequenceId: emailSeq._id.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        await emailSeq.updateOne({ status: 'failed' });
        result.failed++;
      }
    }

    logger.info('processEmailSequence: Completed', result);
    return result;
  } catch (error) {
    logger.error('processEmailSequence: Process failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Track email open event
 * Called when email tracking pixel is loaded
 */
export async function trackEmailOpen(
  sequenceId: string,
  metadata?: { userAgent?: string; ip?: string }
): Promise<void> {
  try {
    const emailSeq = await EmailSequence.findById(sequenceId);

    if (!emailSeq) {
      logger.warn('trackEmailOpen: Sequence not found', { sequenceId });
      return;
    }

    const updateData: Record<string, unknown> = {
      status: 'opened',
      openedAt: new Date(),
    };

    if (emailSeq.metadata) {
      updateData['metadata.openCount'] = (emailSeq.metadata.openCount || 0) + 1;
      updateData['metadata.lastInteractionAt'] = new Date();
    }

    await emailSeq.updateOne(updateData);

    logger.info('trackEmailOpen: Email opened', {
      sequenceId,
      userId: emailSeq.userId.toString(),
    });

    // Publish event for analytics
    await addJob('analytics-queue', 'track_event', {
      event: 'email_opened',
      userId: emailSeq.userId.toString(),
      sequenceType: emailSeq.sequenceType,
      sequenceId,
      timestamp: new Date().toISOString(),
      metadata,
    });
  } catch (error) {
    logger.error('trackEmailOpen: Failed', {
      sequenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Track email click event
 * Called when user clicks a link in the email
 */
export async function trackEmailClick(
  sequenceId: string,
  linkId: string,
  metadata?: { userAgent?: string; ip?: string }
): Promise<void> {
  try {
    const emailSeq = await EmailSequence.findById(sequenceId);

    if (!emailSeq) {
      logger.warn('trackEmailClick: Sequence not found', { sequenceId });
      return;
    }

    const updateData: Record<string, unknown> = {
      status: 'clicked',
      clickedAt: new Date(),
    };

    if (emailSeq.metadata) {
      updateData['metadata.clickCount'] = (emailSeq.metadata.clickCount || 0) + 1;
      updateData['metadata.lastInteractionAt'] = new Date();
    }

    await emailSeq.updateOne(updateData);

    logger.info('trackEmailClick: Email clicked', {
      sequenceId,
      userId: emailSeq.userId.toString(),
      linkId,
    });

    // Publish event for analytics
    await addJob('analytics-queue', 'track_event', {
      event: 'email_clicked',
      userId: emailSeq.userId.toString(),
      sequenceType: emailSeq.sequenceType,
      sequenceId,
      linkId,
      timestamp: new Date().toISOString(),
      metadata,
    });
  } catch (error) {
    logger.error('trackEmailClick: Failed', {
      sequenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get sequence statistics for analytics
 */
export async function getSequenceStats(): Promise<{
  byType: Record<string, { pending: number; sent: number; opened: number; clicked: number; failed: number }>;
  overall: { total: number; sent: number; opened: number; clicked: number; bounceRate: number; clickRate: number };
}> {
  const stats = await EmailSequence.aggregate([
    {
      $group: {
        _id: {
          sequenceType: '$sequenceType',
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const byType: Record<string, { pending: number; sent: number; opened: number; clicked: number; failed: number; bounced: number }> = {};
  let totalSent = 0;
  let totalOpened = 0;
  let totalClicked = 0;
  let totalBounced = 0;

  for (const stat of stats) {
    const { sequenceType, status } = stat._id as { sequenceType: string; status: string };

    if (!byType[sequenceType]) {
      byType[sequenceType] = { pending: 0, sent: 0, opened: 0, clicked: 0, failed: 0, bounced: 0 };
    }

    byType[sequenceType][status as keyof typeof byType[string]] = stat.count;

    if (status === 'sent') totalSent += stat.count;
    if (status === 'opened') totalOpened += stat.count;
    if (status === 'clicked') totalClicked += stat.count;
    if (status === 'bounced') totalBounced += stat.count;
  }

  return {
    byType,
    overall: {
      total: totalSent + totalBounced,
      sent: totalSent,
      opened: totalOpened,
      clicked: totalClicked,
      bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
    },
  };
}

/**
 * Cancel email sequence for a user
 * Called when user unsubscribes or is deleted
 */
export async function cancelEmailSequence(userId: mongoose.Types.ObjectId): Promise<void> {
  try {
    await EmailSequence.updateMany(
      { userId, status: 'pending' },
      { $set: { status: 'failed' } }
    );

    logger.info('cancelEmailSequence: Sequence cancelled', {
      userId: userId.toString(),
    });
  } catch (error) {
    logger.error('cancelEmailSequence: Failed', {
      userId: userId.toString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Run the welcome email sequence processor
 * Wrapper function for scheduler integration
 */
export async function runWelcomeEmailSequence(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  try {
    logger.info('Running welcome email sequence via scheduler');
    const result = await processEmailSequence();
    logger.info('Welcome email sequence completed via scheduler', result);
    return result;
  } catch (error) {
    logger.error('Welcome email sequence failed via scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export default {
  startEmailSequence,
  processEmailSequence,
  runWelcomeEmailSequence,
  trackEmailOpen,
  trackEmailClick,
  getSequenceStats,
  cancelEmailSequence,
  EmailSequence,
};
