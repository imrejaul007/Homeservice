import Stripe from 'stripe';
import mongoose, { Types } from 'mongoose';
import Payout from '../models/payout.model';
import Settlement from '../models/settlement.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { creditWallet } from './wallet.service';
import { eventBus, EVENT_TYPES } from '../event-bus';
import { getSocketServer } from '../socket';
import { calculateCommission } from './settlement.service';
import { NotificationService } from './notification.service';
import { withLockOrSkip } from '../utils/redisLock';
import { redis, isRedisAvailable } from '../config/redis';

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required for payout processing');
}
const stripe = new Stripe(stripeKey);

// ===================================
// TYPES & INTERFACES
// ===================================

export interface PayoutSchedule {
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly, 0 for bi-weekly
  dayOfMonth?: number; // 1-28 for monthly
  minPayoutAmount: number;
  maxPayoutAmount?: number;
}

export interface ProviderPayoutConfig {
  providerId: string;
  schedule: PayoutSchedule;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    iban?: string;
    swiftCode?: string;
    routingNumber?: string;
  };
  enabled: boolean;
}

export interface ProcessPayoutResult {
  success: boolean;
  payoutId?: string;
  stripePayoutId?: string;
  error?: string;
  errorCode?: string;
}

export interface EarningsBreakdown {
  periodStart: Date;
  periodEnd: Date;
  grossAmount: number;
  completedBookings: number;
  refundedAmount: number;
  chargebackAmount: number;
  commission: number;
  platformFee: number;
  otherDeductions: number;
  netPayable: number;
}

// Idempotency key map for fallback when Redis is unavailable
const processedPayouts: Map<string, { success: boolean; timestamp: number }> = new Map();

// Redis-based idempotency TTL (24 hours in seconds)
const IDEMPOTENCY_TTL = 24 * 60 * 60;

/**
 * Check idempotency using Redis for distributed deployments
 * Falls back to in-memory Map if Redis is unavailable
 */
const checkIdempotency = async (payoutId: string): Promise<{ isDuplicate: boolean; previousResult?: ProcessPayoutResult }> => {
  const key = `payout:idempotency:${payoutId}`;

  // Try Redis first
  if (redis && isRedisAvailable()) {
    try {
      const existing = await redis.get(key);
      if (existing) {
        const data = JSON.parse(existing);
        logger.info('Payout already processed (idempotency check via Redis)', {
          payoutId,
          timestamp: new Date(data.timestamp).toISOString(),
          action: 'IDEMPOTENT_SKIP',
        });
        return {
          isDuplicate: true,
          previousResult: {
            success: data.success,
            payoutId,
          },
        };
      }
      return { isDuplicate: false };
    } catch (error) {
      logger.warn('Redis idempotency check failed, falling back to in-memory', {
        payoutId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fall back to in-memory check
  const inMemory = processedPayouts.get(payoutId);
  if (inMemory) {
    const age = Date.now() - inMemory.timestamp;
    if (age < IDEMPOTENCY_TTL * 1000) {
      return { isDuplicate: true, previousResult: { success: inMemory.success, payoutId } };
    }
    // Expired entry, clean it up
    processedPayouts.delete(payoutId);
  }
  return { isDuplicate: false };
};

/**
 * Record payout result for idempotency using Redis
 * Falls back to in-memory Map if Redis is unavailable
 */
const recordPayoutResult = async (payoutId: string, success: boolean): Promise<void> => {
  const key = `payout:idempotency:${payoutId}`;

  // Record in Redis first
  if (redis && isRedisAvailable()) {
    try {
      await redis.setex(key, IDEMPOTENCY_TTL, JSON.stringify({
        success,
        timestamp: Date.now(),
      }));
      // Remove from in-memory fallback if it exists
      processedPayouts.delete(payoutId);
      return;
    } catch (error) {
      logger.warn('Redis idempotency record failed, using in-memory fallback', {
        payoutId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fall back to in-memory storage
  processedPayouts.set(payoutId, { success, timestamp: Date.now() });

  // Periodic cleanup of old entries
  if (processedPayouts.size > 10000) {
    const now = Date.now();
    for (const [mapKey, value] of processedPayouts) {
      if (now - value.timestamp > IDEMPOTENCY_TTL * 1000) {
        processedPayouts.delete(mapKey);
      }
    }
  }
};

// Default payout configuration
const DEFAULT_PAYOUT_CONFIG: PayoutSchedule = {
  frequency: 'weekly',
  dayOfWeek: 5, // Friday
  minPayoutAmount: 100,
  maxPayoutAmount: 50000,
};

// ===================================
// PROVIDER PAYOUT CONFIG (In-memory for MVP)
// ===================================

const providerPayoutConfigs: Map<string, ProviderPayoutConfig> = new Map();

// ===================================
// HELPER FUNCTIONS
// ===================================


/**
 * Calculate earnings breakdown for a provider within a period
 */
export const calculateEarningsBreakdown = async (
  providerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<EarningsBreakdown> => {
  // Get completed bookings in the period
  const bookings = await Booking.find({
    providerId: new Types.ObjectId(providerId),
    status: 'completed',
    completedAt: { $gte: periodStart, $lte: periodEnd },
  });

  // Get refunds and chargebacks
  const refunds = await mongoose.model('Booking').find({
    providerId: new Types.ObjectId(providerId),
    'cancellationDetails.refundStatus': 'processed',
    'cancellationDetails.cancelledAt': { $gte: periodStart, $lte: periodEnd },
  });

  const totalGross = bookings.reduce((sum, b) => sum + b.pricing.totalAmount, 0);
  const totalRefunded = refunds.reduce((sum, r) => sum + (r.cancellationDetails?.refundAmount || 0), 0);

  // SECURITY FIX: Calculate commission per-booking using the proper settlement service
  // instead of hardcoded rates to ensure consistency
  let totalCommission = 0;
  let totalPlatformFee = 0;

  for (const booking of bookings) {
    try {
      const commissionResult = await calculateCommission(booking._id);
      totalCommission += commissionResult.commission;
      totalPlatformFee += commissionResult.platformFee;
    } catch (error) {
      // Fallback to default rates if commission calculation fails
      logger.warn('Commission calculation failed, using default rates', {
        bookingId: booking._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      // Default rates: 15% commission, 2% platform fee
      totalCommission += booking.pricing.totalAmount * 0.15;
      totalPlatformFee += booking.pricing.totalAmount * 0.02;
    }
  }

  const grossAmount = totalGross - totalRefunded;
  const otherDeductions = 0;
  const netPayable = grossAmount - totalCommission - totalPlatformFee - otherDeductions;

  return {
    periodStart,
    periodEnd,
    grossAmount,
    completedBookings: bookings.length,
    refundedAmount: totalRefunded,
    chargebackAmount: 0, // Placeholder
    commission: totalCommission,
    platformFee: totalPlatformFee,
    otherDeductions,
    netPayable: Math.max(0, netPayable),
  };
};

/**
 * Get the next scheduled payout date based on frequency
 */
export const getNextScheduledDate = (
  frequency: 'weekly' | 'bi-weekly' | 'monthly',
  fromDate: Date = new Date()
): Date => {
  const date = new Date(fromDate);

  switch (frequency) {
    case 'weekly': {
      // Schedule for next Friday
      const dayOfWeek = date.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntilFriday);
      date.setHours(0, 0, 0, 0);
      break;
    }

    case 'bi-weekly': {
      // Schedule for next Friday, two weeks out
      const dayOfWeek = date.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntilFriday + 7);
      date.setHours(0, 0, 0, 0);
      break;
    }

    case 'monthly': {
      // Schedule for 1st of next month
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      break;
    }
  }

  return date;
};

/**
 * Get pending earnings for a provider
 */
export const getPendingEarnings = async (providerId: string): Promise<number> => {
  // Sum of all approved settlements not yet paid out
  const settlements = await Settlement.find({
    providerId: new Types.ObjectId(providerId),
    status: 'approved',
    payoutId: { $exists: false },
  });

  return settlements.reduce((sum, s) => sum + s.netAmount, 0);
};

/**
 * Get total paid out to a provider
 */
export const getTotalPaidOut = async (providerId: string): Promise<number> => {
  const result = await Payout.aggregate([
    {
      $match: {
        providerId: new Types.ObjectId(providerId),
        status: 'completed',
      },
    },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: '$amount' },
      },
    },
  ]);

  return result[0]?.totalPaid || 0;
};

// ===================================
// PAYOUT SCHEDULING
// ===================================

/**
 * Create scheduled payout for a provider
 */
export const schedulePayout = async (
  providerId: string,
  amount: number,
  settlementId?: string
): Promise<mongoose.Document> => {
  const config = providerPayoutConfigs.get(providerId) || {
    providerId,
    schedule: DEFAULT_PAYOUT_CONFIG,
    enabled: true,
  };

  const scheduledDate = getNextScheduledDate(config.schedule.frequency);

  const payout = new Payout({
    providerId: new Types.ObjectId(providerId),
    amount,
    currency: 'AED',
    status: 'scheduled',
    method: config.bankDetails ? 'bank_transfer' : 'wallet',
    bankDetails: config.bankDetails,
    scheduledDate,
    settlementId: settlementId ? new Types.ObjectId(settlementId) : undefined,
    earningsBreakdown: {
      grossAmount: amount, // Will be updated with actual breakdown
      commission: 0,
      platformFee: 0,
      deductions: 0,
      netAmount: amount,
    },
    maxRetries: 3,
    currentRetryCount: 0,
  });

  await payout.save();

  logger.info('Payout scheduled', {
    payoutId: payout._id,
    payoutNumber: payout.payoutNumber,
    providerId,
    amount,
    scheduledDate,
    action: 'PAYOUT_SCHEDULED',
  });

  return payout;
};

/**
 * Bulk schedule payouts for all eligible providers
 */
export const scheduleBulkPayouts = async (): Promise<{
  scheduled: number;
  skipped: number;
  totalAmount: number;
}> => {
  const now = new Date();
  const results = {
    scheduled: 0,
    skipped: 0,
    totalAmount: 0,
  };

  // Find all providers with pending settlements
  const settlements = await Settlement.find({
    status: 'approved',
    payoutId: { $exists: false },
  }).populate('providerId');

  // Group by provider
  const byProvider = new Map<string, { settlements: typeof settlements; total: number }>();

  for (const settlement of settlements) {
    const providerId = (settlement.providerId as any)._id.toString();
    if (!byProvider.has(providerId)) {
      byProvider.set(providerId, { settlements: [], total: 0 });
    }
    byProvider.get(providerId)!.settlements.push(settlement);
    byProvider.get(providerId)!.total += settlement.netAmount;
  }

  // Schedule payouts for each provider
  for (const [providerId, data] of byProvider) {
    const config = providerPayoutConfigs.get(providerId);

    // Skip if payouts disabled for this provider
    if (config && !config.enabled) {
      results.skipped++;
      continue;
    }

    // Check minimum payout amount
    const minAmount = config?.schedule.minPayoutAmount || DEFAULT_PAYOUT_CONFIG.minPayoutAmount;
    if (data.total < minAmount) {
      results.skipped++;
      continue;
    }

    try {
      const settlementIds = data.settlements.map(s => s._id.toString());
      await schedulePayout(providerId, data.total, settlementIds[0]);
      results.scheduled++;
      results.totalAmount += data.total;
    } catch (error: any) {
      logger.error('Failed to schedule payout', {
        providerId,
        error: error.message,
        action: 'PAYOUT_SCHEDULE_ERROR',
      });
      results.skipped++;
    }
  }

  return results;
};

// ===================================
// PAYOUT PROCESSING
// ===================================

/**
 * Process a single payout with atomic status check and transaction safety
 * CRITICAL FIX: Prevents double payout by using atomic operations
 */
export const processPayout = async (
  payoutId: string,
  processedBy?: Types.ObjectId,
  idempotencyKey?: string
): Promise<ProcessPayoutResult> => {
  // Check idempotency first (Redis-based for multi-instance support)
  if (idempotencyKey) {
    const idempotencyCheck = await checkIdempotency(idempotencyKey);
    if (idempotencyCheck.isDuplicate && idempotencyCheck.previousResult) {
      return idempotencyCheck.previousResult;
    }
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // CRITICAL FIX: Use atomic findOneAndUpdate with status condition
    // This prevents race conditions where multiple processes could process the same payout
    const payout = await Payout.findOneAndUpdate(
      {
        _id: new Types.ObjectId(payoutId),
        status: { $in: ['pending', 'scheduled', 'failed'] },
      },
      {
        $set: {
          status: 'processing',
          processedBy,
          processedAt: new Date(),
        },
      },
      { new: true, session }
    );

    if (!payout) {
      // Either payout doesn't exist or is already being processed/completed
      await session.abortTransaction();
      return {
        success: false,
        payoutId,
        error: 'Payout already processed or invalid status',
        errorCode: 'PAYOUT_ALREADY_PROCESSED',
      };
    }

    logger.info('Payout status updated to processing (atomic)', {
      payoutId: payout._id.toString(),
      payoutNumber: payout.payoutNumber,
      previousStatus: ['pending', 'scheduled', 'failed'],
      action: 'PAYOUT_PROCESSING_STARTED',
    });

    logger.info('PAYOUT_INITIATED', {
      payoutId: payout._id.toString(),
      providerId: payout.providerId.toString(),
      amount: payout.earningsBreakdown?.netAmount ?? payout.amount,
      currency: payout.currency || 'AED',
      method: payout.method,
      action: 'PAYOUT_INITIATED',
    });

    let stripePayoutId: string | undefined;

    if (payout.method === 'wallet') {
      // Credit to wallet directly with transaction support
      const result = await creditWallet(
        {
          userId: payout.providerId.toString(),
          type: 'credit',
          amount: payout.amount,
          description: `Payout #${payout.payoutNumber}`,
          reference: payoutId,
          referenceType: 'payout',
          metadata: {
            payoutNumber: payout.payoutNumber,
            payoutId: payout._id.toString(),
          },
        },
        undefined, // No request context
        {
          preventDuplicateReference: {
            reference: payoutId,
            referenceType: 'payout',
          },
        },
        session
      );

      if (!result.success) {
        throw ApiError.internal(result.error || 'Wallet credit failed');
      }

      // Mark payout as completed within the transaction
      payout.status = 'completed';
      payout.processedDate = new Date();
      await payout.save({ session });

      // HIGH SEVERITY FIX: Link settlements to payout after completion
      const Settlement = mongoose.model('Settlement');
      await Settlement.updateMany(
        { payoutId: payout._id },
        { $set: { status: 'paid', paidAt: new Date() } },
        { session }
      );

      // Also link any approved settlements for this provider that were included in this payout
      await Settlement.updateMany(
        {
          providerId: payout.providerId,
          status: 'approved',
          payoutId: { $exists: false },
        },
        {
          $set: {
            status: 'paid',
            paidAt: new Date(),
            payoutId: payout._id,
          },
        },
        { session }
      );

      await session.commitTransaction();

      logger.info('Payout completed (wallet)', {
        payoutId: payout._id.toString(),
        payoutNumber: payout.payoutNumber,
        amount: payout.amount,
        providerId: payout.providerId.toString(),
        action: 'PAYOUT_COMPLETED_WALLET',
      });

      // Record for idempotency
      if (idempotencyKey) {
        await recordPayoutResult(idempotencyKey, true);
      }

      // Emit socket event for real-time payout status update
      const socketServer = getSocketServer();
      if (socketServer) {
        socketServer.emitWithdrawalApproved(
          payout.providerId.toString(),
          payoutId,
          payout.amount,
          payout.currency
        );
      }

      // Send notification to provider about payout completion (outside transaction)
      sendPayoutNotification(payout, 'completed').catch((notifError) => {
        logger.error('Failed to send payout completion notification', {
          payoutId,
          error: notifError instanceof Error ? notifError.message : String(notifError),
        });
      });

      return { success: true, payoutId: payout._id.toString() };
    } else {
      // Bank transfer via Stripe - needs compensation logic
      try {
        const stripePayout = await createStripePayout(payout);

        if (!stripePayout) {
          throw ApiError.internal('Stripe payout creation failed');
        }

        stripePayoutId = stripePayout.id;

        // Mark payout as completed within the transaction
        payout.status = 'completed';
        payout.processedDate = new Date();
        payout.stripePayoutId = stripePayoutId;
        await payout.save({ session });

        // HIGH SEVERITY FIX: Link settlements to payout after completion
        const Settlement = mongoose.model('Settlement');
        await Settlement.updateMany(
          { payoutId: payout._id },
          { $set: { status: 'paid', paidAt: new Date() } },
          { session }
        );

        // Also link any approved settlements for this provider that were included in this payout
        await Settlement.updateMany(
          {
            providerId: payout.providerId,
            status: 'approved',
            payoutId: { $exists: false },
          },
          {
            $set: {
              status: 'paid',
              paidAt: new Date(),
              payoutId: payout._id,
            },
          },
          { session }
        );

        await session.commitTransaction();
      } catch (stripeError: unknown) {
        // Abort transaction first
        await session.abortTransaction();

        // Mark payout as failed with proper error
        const stripeErrorMessage = stripeError instanceof Error ? stripeError.message : 'Stripe payout creation failed';
        await Payout.findByIdAndUpdate(payoutId, {
          status: 'failed',
          failureReason: stripeErrorMessage,
          failureCode: 'STRIPE_ERROR',
        });

        // Re-throw for the outer catch handler to handle idempotency and notifications
        throw stripeError;
      }

      logger.info('Payout completed (bank transfer)', {
        payoutId: payout._id.toString(),
        payoutNumber: payout.payoutNumber,
        stripePayoutId,
        amount: payout.amount,
        providerId: payout.providerId.toString(),
        action: 'PAYOUT_COMPLETED_BANK',
      });

      // Record for idempotency
      if (idempotencyKey) {
        await recordPayoutResult(idempotencyKey, true);
      }

      // Emit socket event for real-time payout status update
      const socketServer = getSocketServer();
      if (socketServer) {
        socketServer.emitWithdrawalApproved(
          payout.providerId.toString(),
          payoutId,
          payout.amount,
          payout.currency
        );
      }

      // Send notification to provider about payout completion (outside transaction)
      sendPayoutNotification(payout, 'completed').catch((notifError) => {
        logger.error('Failed to send payout completion notification', {
          payoutId,
          error: notifError instanceof Error ? notifError.message : String(notifError),
        });
      });

      return {
        success: true,
        payoutId: payout._id.toString(),
        stripePayoutId,
      };
    }
  } catch (error: any) {
    await session.abortTransaction();

    logger.error('Failed to process payout', {
      payoutId,
      error: error.message,
      stack: error.stack,
      action: 'PAYOUT_PROCESSING_ERROR',
    });

    // Try to record the failure, but don't fail the whole operation
    try {
      // Use atomic update to record failure
      await Payout.findOneAndUpdate(
        { _id: new Types.ObjectId(payoutId), status: 'processing' },
        {
          $set: { status: 'failed' },
          $push: {
            failures: {
              reason: error.message || 'Unknown error',
              date: new Date(),
              retryAttempt: 1, // Will be incremented by addFailure
            },
          },
        }
      );
    } catch (updateError) {
      logger.error('Failed to update payout status to failed', {
        payoutId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }

    // Record for idempotency (even on failure, to prevent retries)
    if (idempotencyKey) {
      await recordPayoutResult(idempotencyKey, false);
    }

    // Emit socket event for payout rejection - fetch payout first to get providerId
    const socketServer = getSocketServer();
    if (socketServer) {
      try {
        const failedPayout = await Payout.findById(payoutId);
        socketServer.emitWithdrawalRejected(
          failedPayout?.providerId?.toString() || payoutId,
          payoutId,
          0,
          'AED',
          error.message || 'Payout processing failed'
        );
      } catch (socketError) {
        logger.error('Failed to emit withdrawal rejected event', {
          payoutId,
          error: socketError instanceof Error ? socketError.message : String(socketError),
        });
      }
    }

    // Send notification to provider about payout failure (outside transaction)
    sendPayoutFailureNotification(payoutId, error.message).catch((notifError) => {
      logger.error('Failed to send payout failure notification', {
        payoutId,
        error: notifError instanceof Error ? notifError.message : String(notifError),
      });
    });

    return {
      success: false,
      payoutId,
      error: error.message,
      errorCode: 'PROCESSING_ERROR',
    };
  } finally {
    if (session && session.hasEnded === false) {
      await session.endSession();
    }
  }
};

/**
 * Send payout completion notification
 */
const sendPayoutNotification = async (payout: any, type: 'completed' | 'failed'): Promise<void> => {
  const notificationService = new NotificationService();

  if (type === 'completed') {
    await notificationService.createNotification({
      recipientId: payout.providerId.toString(),
      type: 'withdrawal_approved',
      title: 'Payout Completed',
      message: `Your payout of ${payout.amount} ${payout.currency} has been completed.`,
      metadata: {
        payoutId: payout._id.toString(),
        payoutNumber: payout.payoutNumber,
        amount: payout.amount,
        currency: payout.currency,
      },
    });

    // Send withdrawal approved email notification
    try {
      const { default: emailServiceModule } = await import('./email.service');
      const emailService = emailServiceModule;

      // Get provider details for email
      const User = mongoose.model('User');
      const provider = await User.findById(payout.providerId);

      if (provider?.email) {
        await emailService.sendWithdrawalApproved({
          to: provider.email,
          providerName: `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Provider',
          amount: payout.amount,
          currency: payout.currency || 'AED',
          payoutNumber: payout.payoutNumber,
        });
      }
    } catch (emailError) {
      logger.error('Failed to send withdrawal approved email', {
        context: 'PayoutEngine',
        action: 'WITHDRAWAL_EMAIL_ERROR',
        payoutId: payout._id.toString(),
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    }
  }
};

/**
 * Send payout failure notification
 */
const sendPayoutFailureNotification = async (payoutId: string, errorMessage: string): Promise<void> => {
  try {
    // Fetch payout to get providerId
    const payout = await Payout.findById(payoutId);
    if (!payout) return;

    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipientId: payout.providerId.toString(),
      type: 'withdrawal_rejected',
      title: 'Payout Failed',
      message: `Your payout of ${payout.amount} ${payout.currency} could not be processed. Reason: ${errorMessage}`,
      metadata: {
        payoutId: payout._id.toString(),
        payoutNumber: payout.payoutNumber,
        amount: payout.amount,
        currency: payout.currency,
        error: errorMessage,
      },
    });
  } catch (error) {
    logger.error('Failed to send payout failure notification', {
      payoutId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Create a Stripe payout for bank transfer
 */
const createStripePayout = async (payout: any): Promise<Stripe.Payout | null> => {
  try {
    // In production, this would use Stripe Connect
    // For now, return a mock payout
    const payoutParams: Stripe.PayoutCreateParams = {
      amount: Math.round(payout.amount * 100), // Convert to cents
      currency: payout.currency.toLowerCase(),
      metadata: {
        payoutId: payout._id.toString(),
        payoutNumber: payout.payoutNumber,
        providerId: payout.providerId.toString(),
      },
      description: `NILIN Payout #${payout.payoutNumber}`,
    };

    const stripePayout = await stripe.payouts.create(payoutParams);

    logger.info('Stripe payout created', {
      payoutId: payout._id,
      stripePayoutId: stripePayout.id,
      amount: payout.amount,
      action: 'STRIPE_PAYOUT_CREATED',
    });

    return stripePayout;
  } catch (error: any) {
    logger.error('Failed to create Stripe payout', {
      payoutId: payout._id,
      error: error.message,
      action: 'STRIPE_PAYOUT_ERROR',
    });
    throw error;
  }
};

/**
 * Process due payouts (for scheduled job)
 * CRITICAL FIX: Uses Redis distributed lock to prevent double processing
 */
export const processDuePayouts = async (batchSize: number = 100): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  totalAmount: number;
  errors: string[];
}> => {
  const startTime = Date.now();
  const results = {
    processed: 0,
    failed: 0,
    skipped: 0,
    totalAmount: 0,
    errors: [] as string[],
  };

  const duePayouts = await Payout.findDuePayouts(batchSize);

  logger.info('Processing due payouts batch', {
    batchSize,
    dueCount: duePayouts.length,
    action: 'PAYOUT_BATCH_START',
  });

  for (const payout of duePayouts) {
    const payoutId = payout._id.toString();

    // CRITICAL FIX: Acquire Redis distributed lock before processing
    // This prevents the same payout from being processed by multiple workers
    const lockResult = await withLockOrSkip(
      `payout:process:${payoutId}`,
      async () => {
        return await processPayout(payoutId, undefined, `batch:${payoutId}`);
      },
      300 // 5 minutes TTL for batch processing
    );

    if (!lockResult.success) {
      // Lock not acquired - either another worker has it or Redis is down
      if (lockResult.error?.includes('Lock not available')) {
        logger.debug('Payout skipped - already being processed by another worker', {
          payoutId,
          action: 'PAYOUT_SKIPPED_LOCKED',
        });
        results.skipped++;
      } else {
        logger.warn('Payout processing failed', {
          payoutId,
          error: lockResult.error,
          action: 'PAYOUT_PROCESS_FAILED',
        });
        results.failed++;
        results.errors.push(`Payout ${payoutId}: ${lockResult.error}`);
      }
      continue;
    }

    if (lockResult.result?.success) {
      results.processed++;
      results.totalAmount += payout.amount;

      // Publish event
      await eventBus.publish(EVENT_TYPES.PAYOUT_COMPLETED, {
        payoutId: lockResult.result.payoutId,
        providerId: (payout as any).providerId?._id?.toString() || payout.providerId.toString(),
        amount: payout.amount,
        stripePayoutId: lockResult.result.stripePayoutId,
      });
    } else {
      results.failed++;
      if (lockResult.result?.error) {
        results.errors.push(`Payout ${payoutId}: ${lockResult.result.error}`);
      }
    }
  }

  logger.info('Batch payout processing complete', {
    total: duePayouts.length,
    successful: results.processed,
    failed: results.failed,
    skipped: results.skipped,
    totalAmount: results.totalAmount,
    duration: Date.now() - startTime,
    action: 'PAYOUT_BATCH_COMPLETE',
  });

  return results;
};

// ===================================
// FAILED PAYOUT RECOVERY
// ===================================

/**
 * Retry failed payouts
 */
export const retryFailedPayouts = async (batchSize: number = 50): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
  totalAmount: number;
}> => {
  const results = {
    retried: 0,
    succeeded: 0,
    failed: 0,
    totalAmount: 0,
  };

  const failedPayouts = await Payout.findRetriablePayouts(batchSize);

  for (const payout of failedPayouts) {
    if (!payout.isRetryable) continue;

    results.retried++;

    const result = await processPayout(payout._id.toString(), undefined, `retry:${payout._id.toString()}`);

    if (result.success) {
      results.succeeded++;
      results.totalAmount += payout.amount;
    } else {
      results.failed++;
    }
  }

  return results;
};

/**
 * Cancel a payout
 */
export const cancelPayout = async (
  payoutId: string,
  reason: string,
  cancelledBy?: string
): Promise<void> => {
  // Use atomic status check for cancellation too
  const payout = await Payout.findOneAndUpdate(
    {
      _id: new Types.ObjectId(payoutId),
      status: { $in: ['pending', 'scheduled'] },
    },
    {
      $set: {
        status: 'cancelled',
        notes: reason,
        processedBy: cancelledBy ? new Types.ObjectId(cancelledBy) : undefined,
      },
    },
    { new: true }
  );

  if (!payout) {
    const existing = await Payout.findById(payoutId);
    if (!existing) {
      throw new ApiError(404, 'Payout not found');
    }
    throw new ApiError(400, `Cannot cancel payout in status: ${existing.status}`);
  }

  logger.info('Payout cancelled', {
    payoutId,
    reason,
    cancelledBy,
    action: 'PAYOUT_CANCELLED',
  });
};

// ===================================
// PAYOUT HISTORY & QUERIES
// ===================================

/**
 * Get payout history for a provider
 */
export const getPayoutHistory = async (
  providerId: string,
  options: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
) => {
  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate,
  } = options;

  const query: Record<string, unknown> = { providerId: new Types.ObjectId(providerId) };

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) (query.createdAt as Record<string, Date>).$gte = startDate;
    if (endDate) (query.createdAt as Record<string, Date>).$lte = endDate;
  }

  const [payouts, total] = await Promise.all([
    Payout.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('settlementId'),
    Payout.countDocuments(query),
  ]);

  return {
    payouts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get upcoming payouts for a provider
 */
export const getUpcomingPayouts = async (providerId: string): Promise<any[]> => {
  return Payout.find({
    providerId: new Types.ObjectId(providerId),
    status: { $in: ['pending', 'scheduled'] },
    scheduledDate: { $gte: new Date() },
  })
    .sort({ scheduledDate: 1 })
    .limit(5);
};

/**
 * Get payout statistics for a provider
 */
export const getPayoutStats = async (
  providerId: string,
  period: 'week' | 'month' | 'year' = 'month'
): Promise<{
  totalPaid: number;
  pendingAmount: number;
  failedAmount: number;
  payoutCount: number;
  avgPayoutAmount: number;
}> => {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
  }

  const stats = await Payout.aggregate([
    {
      $match: {
        providerId: new Types.ObjectId(providerId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    totalPaid: 0,
    pendingAmount: 0,
    failedAmount: 0,
    payoutCount: 0,
    avgPayoutAmount: 0,
  };

  for (const stat of stats) {
    switch (stat._id) {
      case 'completed':
        result.totalPaid = stat.totalAmount;
        result.payoutCount = stat.count;
        result.avgPayoutAmount = stat.count > 0 ? stat.totalAmount / stat.count : 0;
        break;
      case 'pending':
      case 'scheduled':
        result.pendingAmount += stat.totalAmount;
        break;
      case 'failed':
        result.failedAmount += stat.totalAmount;
        break;
    }
  }

  return result;
};

// ===================================
// PROVIDER PAYOUT CONFIGURATION
// ===================================

/**
 * Get payout configuration for a provider
 */
export const getProviderPayoutConfig = (providerId: string): ProviderPayoutConfig | null => {
  return providerPayoutConfigs.get(providerId) || null;
};

/**
 * Update payout configuration for a provider
 */
export const updateProviderPayoutConfig = (
  providerId: string,
  config: Partial<ProviderPayoutConfig>
): ProviderPayoutConfig => {
  const existing = providerPayoutConfigs.get(providerId) || {
    providerId,
    schedule: DEFAULT_PAYOUT_CONFIG,
    enabled: true,
  };

  const updated = {
    ...existing,
    ...config,
  };

  providerPayoutConfigs.set(providerId, updated);

  logger.info('Provider payout config updated', {
    providerId,
    config: updated,
    action: 'PAYOUT_CONFIG_UPDATED',
  });

  return updated;
};

// ===================================
// PROVIDER PAYOUT REQUEST
// ===================================

/**
 * Request a payout from pending balance
 * This is the main function providers use to withdraw their earnings
 */
export const requestPayout = async (
  providerId: string,
  amount: number,
  options?: {
    method?: 'bank_transfer' | 'wallet';
    bankDetails?: ProviderPayoutConfig['bankDetails'];
    notes?: string;
  }
): Promise<{
  success: boolean;
  payoutId?: string;
  payoutNumber?: string;
  amount?: number;
  message?: string;
}> => {
  const Wallet = mongoose.model('Wallet');

  // Validate amount
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid payout amount');
  }

  // Minimum payout amount (50 AED)
  const MIN_PAYOUT_AMOUNT = 50;
  if (amount < MIN_PAYOUT_AMOUNT) {
    throw new ApiError(400, `Minimum payout amount is ${MIN_PAYOUT_AMOUNT} AED`);
  }

  // Get provider wallet
  const wallet = await Wallet.findOne({ userId: new Types.ObjectId(providerId) });

  if (!wallet) {
    throw new ApiError(404, 'Wallet not found for provider');
  }

  // Check pending balance
  if ((wallet.pendingBalance || 0) < amount) {
    throw new ApiError(
      400,
      `Insufficient pending balance. Available: ${wallet.pendingBalance || 0} AED, Requested: ${amount} AED`
    );
  }

  // Check if provider already has a pending payout request
  const existingPending = await Payout.findOne({
    providerId: new Types.ObjectId(providerId),
    status: { $in: ['pending', 'scheduled', 'processing'] },
  });

  if (existingPending) {
    throw new ApiError(
      400,
      'You already have a payout request in progress. Please wait for it to be processed.'
    );
  }

  // Deduct from pending balance and add to main balance
  await Wallet.findOneAndUpdate(
    { userId: new Types.ObjectId(providerId) },
    {
      $inc: {
        pendingBalance: -amount,
        balance: amount,
      },
      $push: {
        transactions: {
          $each: [{
            id: new Types.ObjectId().toString(),
            type: 'debit',
            amount: amount,
            description: `Payout requested`,
            reference: '',
            referenceType: 'payout',
            status: 'pending',
            balanceAfter: (wallet.balance || 0) + amount,
            createdAt: new Date(),
          }],
          $position: 0,
        },
      },
    }
  );

  // Create payout record
  const payout = new Payout({
    providerId: new Types.ObjectId(providerId),
    amount,
    currency: 'AED',
    status: 'pending',
    method: options?.method || (options?.bankDetails ? 'bank_transfer' : 'wallet'),
    bankDetails: options?.bankDetails,
    notes: options?.notes,
    requestedAt: new Date(),
    earningsBreakdown: {
      grossAmount: amount,
      commission: 0,
      platformFee: 0,
      deductions: 0,
      netAmount: amount,
    },
    maxRetries: 3,
    currentRetryCount: 0,
  });

  await payout.save();

  // Emit event for notifications
  eventBus.publish(EVENT_TYPES.WITHDRAWAL_REQUESTED, {
    payoutId: payout._id,
    payoutNumber: payout.payoutNumber,
    providerId,
    amount,
    method: payout.method,
  });

  logger.info('Payout requested by provider', {
    payoutId: payout._id.toString(),
    payoutNumber: payout.payoutNumber,
    providerId,
    amount,
    method: payout.method,
    pendingBalanceBefore: wallet.pendingBalance,
    action: 'PAYOUT_REQUESTED',
  });

  return {
    success: true,
    payoutId: payout._id.toString(),
    payoutNumber: payout.payoutNumber,
    amount,
    message: 'Payout request submitted successfully',
  };
};

/**
 * Get available balance for payout
 */
export const getAvailablePayoutBalance = async (providerId: string): Promise<{
  pendingBalance: number;
  availableForPayout: number;
  minPayoutAmount: number;
  hasPendingRequest: boolean;
}> => {
  const Wallet = mongoose.model('Wallet');

  const wallet = await Wallet.findOne({ userId: new Types.ObjectId(providerId) });

  const pendingBalance = wallet?.pendingBalance || 0;

  // Check if provider already has a pending payout request
  const existingPending = await Payout.findOne({
    providerId: new Types.ObjectId(providerId),
    status: { $in: ['pending', 'scheduled', 'processing'] },
  });

  const hasPendingRequest = !!existingPending;

  // Available is pending balance minus any already scheduled payouts
  let scheduledAmount = 0;
  if (hasPendingRequest && existingPending) {
    scheduledAmount = existingPending.amount;
  }

  return {
    pendingBalance,
    availableForPayout: Math.max(0, pendingBalance - scheduledAmount),
    minPayoutAmount: 50,
    hasPendingRequest,
  };
};

// ===================================
// EXPORTS
// ===================================

export default {
  // Earnings calculation
  calculateEarningsBreakdown,
  getPendingEarnings,
  getTotalPaidOut,

  // Scheduling
  schedulePayout,
  scheduleBulkPayouts,
  getNextScheduledDate,

  // Processing
  processPayout,
  processDuePayouts,

  // Recovery
  retryFailedPayouts,
  cancelPayout,

  // Payout request
  requestPayout,
  getAvailablePayoutBalance,

  // Queries
  getPayoutHistory,
  getUpcomingPayouts,
  getPayoutStats,

  // Configuration
  getProviderPayoutConfig,
  updateProviderPayoutConfig,
};
