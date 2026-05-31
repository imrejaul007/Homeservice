import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { backfillBookingLocations } from '../services/bookingLocation.service';

/**
 * Backfill missing booking city/location data from customer addresses,
 * saved addresses, and provider service areas.
 *
 * Usage:
 *   npx ts-node src/scripts/enrich-booking-locations.ts
 *   npx ts-node src/scripts/enrich-booking-locations.ts nilin
 */

async function main() {
  const dbName = process.argv[2] || process.env.MONGODB_DB || 'nilin';
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

  console.log('='.repeat(60));
  console.log('Booking Location Enrichment');
  console.log('='.repeat(60));

  try {
    await mongoose.connect(`${mongoUri}/${dbName}`);
    console.log(`Connected to MongoDB: ${mongoUri}/${dbName}`);

    const result = await backfillBookingLocations();

    console.log();
    console.log('Results:');
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Skipped: ${result.skipped}`);
    console.log(`  Errors:  ${result.errors}`);
  } catch (error) {
    console.error('Enrichment failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
