import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import logger from '../utils/logger';

/**
 * Get booking amount - checks booking.pricing first, then falls back to service price
 */
async function getBookingAmount(booking: any): Promise<number> {
  // If booking has pricing, use it
  if (booking.pricing?.totalAmount) {
    return booking.pricing.totalAmount;
  }

  // Fallback: look up service price
  if (booking.serviceId) {
    const service = await Service.findById(booking.serviceId);
    if (service?.price?.amount) {
      return service.price.amount;
    }
  }

  return 0;
}

/**
 * Update booking with pricing data if missing (for data consistency)
 */
async function ensureBookingHasPricing(booking: any): Promise<void> {
  if (!booking.pricing?.totalAmount && booking.serviceId) {
    const service = await Service.findById(booking.serviceId);
    if (service?.price?.amount) {
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            pricing: {
              totalAmount: service.price.amount,
              currency: service.price.currency || 'AED',
              breakdown: [],
            },
          },
        }
      );
      logger.info('Updated booking with service pricing', {
        context: 'EarningsSyncService',
        action: 'UPDATE_BOOKING_PRICING',
        bookingId: booking._id.toString(),
        amount: service.price.amount,
      });
    }
  }
}

/**
 * Recalculates and syncs all revenue stats for a provider
 * Use for backfilling data or fixing inconsistencies
 */
export async function syncProviderEarnings(providerId: string): Promise<void> {
  try {
    const bookings = await Booking.find({ providerId: new mongoose.Types.ObjectId(providerId) });

    // First, ensure all completed bookings have pricing data
    for (const booking of bookings) {
      if (booking.status === 'completed') {
        await ensureBookingHasPricing(booking);
      }
    }

    // Re-fetch bookings to get updated pricing
    const updatedBookings = await Booking.find({ providerId: new mongoose.Types.ObjectId(providerId) });

    // Calculate earnings from completed bookings
    let totalEarnings = 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let currentMonthEarnings = 0;

    for (const booking of updatedBookings) {
      if (booking.status === 'completed') {
        const amount = await getBookingAmount(booking);
        totalEarnings += amount;

        if (booking.completedAt && new Date(booking.completedAt) >= startOfMonth) {
          currentMonthEarnings += amount;
        }
      }
    }

    // Calculate pending balance from incomplete bookings
    let pendingBalance = 0;
    for (const booking of updatedBookings) {
      if (['confirmed', 'in_progress'].includes(booking.status)) {
        pendingBalance += await getBookingAmount(booking);
      }
    }

    await ProviderProfile.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(providerId) },
      {
        $set: {
          'analytics.revenueStats.totalEarnings': totalEarnings,
          'analytics.revenueStats.currentMonthEarnings': currentMonthEarnings,
        },
      }
    );

    logger.info('Provider earnings synced', {
      context: 'EarningsSyncService',
      action: 'SYNC_SUCCESS',
      providerId,
      totalEarnings,
      currentMonthEarnings,
      pendingBalance,
    });
  } catch (error) {
    logger.error('Failed to sync provider earnings', {
      context: 'EarningsSyncService',
      action: 'SYNC_ERROR',
      providerId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Backfill earnings for all providers
 * Run this once to fix existing data
 */
export async function backfillAllProviderEarnings(): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const profiles = await ProviderProfile.find({});
  const results = {
    total: profiles.length,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  };

  logger.info('Starting earnings backfill', {
    context: 'EarningsSyncService',
    action: 'BACKFILL_START',
    totalProviders: profiles.length,
  });

  for (const profile of profiles) {
    try {
      await syncProviderEarnings(profile.userId.toString());
      results.succeeded++;
    } catch (error) {
      results.failed++;
      const errorMsg = `Provider ${profile.userId}: ${error instanceof Error ? error.message : String(error)}`;
      results.errors.push(errorMsg);
      logger.warn('Failed to backfill earnings for provider', {
        context: 'EarningsSyncService',
        action: 'BACKFILL_PROVIDER_ERROR',
        providerId: profile.userId.toString(),
        error: errorMsg,
      });
    }
  }

  logger.info('Backfill complete', {
    context: 'EarningsSyncService',
    action: 'BACKFILL_COMPLETE',
    total: results.total,
    succeeded: results.succeeded,
    failed: results.failed,
  });

  return results;
}

/**
 * Verify earnings data integrity for a provider
 */
export async function verifyProviderEarnings(providerId: string): Promise<{
  isValid: boolean;
  storedTotalEarnings: number;
  calculatedTotalEarnings: number;
  difference: number;
  storedMonthEarnings: number;
  calculatedMonthEarnings: number;
}> {
  const profile = await ProviderProfile.findOne({ userId: new mongoose.Types.ObjectId(providerId) });
  if (!profile) {
    throw new Error('Provider profile not found');
  }

  const bookings = await Booking.find({ providerId: new mongoose.Types.ObjectId(providerId) });

  let calculatedTotalEarnings = 0;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let calculatedMonthEarnings = 0;

  for (const booking of bookings) {
    if (booking.status === 'completed') {
      const amount = await getBookingAmount(booking);
      calculatedTotalEarnings += amount;

      if (booking.completedAt && new Date(booking.completedAt) >= startOfMonth) {
        calculatedMonthEarnings += amount;
      }
    }
  }

  return {
    isValid: profile.analytics.revenueStats.totalEarnings === calculatedTotalEarnings,
    storedTotalEarnings: profile.analytics.revenueStats.totalEarnings,
    calculatedTotalEarnings,
    difference: profile.analytics.revenueStats.totalEarnings - calculatedTotalEarnings,
    storedMonthEarnings: profile.analytics.revenueStats.currentMonthEarnings,
    calculatedMonthEarnings,
  };
}

export default {
  syncProviderEarnings,
  backfillAllProviderEarnings,
  verifyProviderEarnings,
};
