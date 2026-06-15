import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import {
  mapLegacyBookingSource,
} from '../utils/bookingAttribution';
import { rollupProviderMetricsForDate } from '../services/providerMetricsRollup.service';
import logger from '../utils/logger';

/**
 * Backfill provider analytics data:
 * 1. Attribution from metadata.bookingSource for bookings missing attribution
 * 2. providerMetricsDaily rollups for the last 90 days
 *
 * Does NOT fabricate impression data.
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-provider-analytics.ts
 *   npx ts-node src/scripts/backfill-provider-analytics.ts --days=60
 */

async function backfillBookingAttribution(): Promise<number> {
  const bookings = await Booking.find({
    $or: [
      { attribution: { $exists: false } },
      { 'attribution.source': { $exists: false } },
      { 'attribution.source': null },
      { 'attribution.source': '' },
    ],
    'metadata.bookingSource': { $exists: true, $nin: [null, ''] },
  })
    .select('_id metadata.bookingSource attribution')
    .lean();

  let updated = 0;

  for (const booking of bookings) {
    const mapped = mapLegacyBookingSource(booking.metadata?.bookingSource);
    if (!mapped) continue;

    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          attribution: {
            ...(booking.attribution || {}),
            source: mapped,
          },
        },
      },
    );
    updated += 1;
  }

  return updated;
}

async function backfillProviderMetricsDaily(days: number): Promise<number> {
  let totalUpdated = 0;
  const today = new Date();

  for (let offset = 0; offset < days; offset += 1) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - offset);
    const updated = await rollupProviderMetricsForDate(targetDate);
    totalUpdated += updated;
  }

  return totalUpdated;
}

async function main(): Promise<void> {
  const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
  const days = daysArg ? Math.max(1, parseInt(daysArg.split('=')[1], 10) || 90) : 90;
  const dbName = process.env.MONGODB_DB || 'nilin';

  console.log('='.repeat(60));
  console.log('Provider Analytics Backfill');
  console.log('='.repeat(60));

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    await mongoose.connect(`${mongoUri}/${dbName}`);
    console.log(`Connected to MongoDB: ${mongoUri}/${dbName}`);

    console.log('\nBackfilling booking attribution from metadata.bookingSource...');
    const attributionUpdated = await backfillBookingAttribution();
    console.log(`Updated attribution on ${attributionUpdated} bookings`);

    console.log(`\nBackfilling providerMetricsDaily for last ${days} days...`);
    const rollupProvidersTouched = await backfillProviderMetricsDaily(days);
    console.log(`Updated daily metrics for ${rollupProvidersTouched} provider-day records`);

    console.log('\nBackfill complete.');
  } catch (error) {
    logger.error('Provider analytics backfill failed', { error });
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
