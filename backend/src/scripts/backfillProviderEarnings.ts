import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { syncProviderEarnings, backfillAllProviderEarnings, verifyProviderEarnings } from '../services/earningsSync.service';

/**
 * Backfill and verify provider earnings data
 *
 * This script:
 * 1. Calculates earnings from all completed bookings for each provider
 * 2. Updates the analytics.revenueStats with the correct values
 * 3. Verifies data integrity
 *
 * Usage:
 *   - Backfill all: npx ts-node src/scripts/backfillProviderEarnings.ts backfill
 *   - Verify one: npx ts-node src/scripts/backfillProviderEarnings.ts verify <providerId>
 *   - Sync one: npx ts-node src/scripts/backfillProviderEarnings.ts sync <providerId>
 */

async function main() {
  const action = process.argv[2];
  const providerId = process.argv[3];

  // Get database name from command line argument
  const dbName = process.argv[4] || process.env.MONGODB_DB || 'nilin';

  console.log('='.repeat(60));
  console.log('Provider Earnings Backfill Script');
  console.log('='.repeat(60));
  console.log();

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    await mongoose.connect(`${mongoUri}/${dbName}`);
    console.log(`✓ Connected to MongoDB: ${mongoUri}/${dbName}`);
    console.log();

    switch (action) {
      case 'backfill': {
        console.log('Starting backfill for all providers...');
        console.log();

        const results = await backfillAllProviderEarnings();

        console.log();
        console.log('='.repeat(60));
        console.log('Backfill Results');
        console.log('='.repeat(60));
        console.log(`Total providers: ${results.total}`);
        console.log(`Succeeded: ${results.succeeded}`);
        console.log(`Failed: ${results.failed}`);

        if (results.errors.length > 0) {
          console.log();
          console.log('Errors:');
          results.errors.forEach(err => console.log(`  - ${err}`));
        }

        break;
      }

      case 'verify': {
        if (!providerId) {
          console.error('❌ Error: Provider ID is required for verify action');
          console.log('Usage: npx ts-node src/scripts/backfillProviderEarnings.ts verify <providerId>');
          process.exit(1);
        }

        console.log(`Verifying earnings for provider: ${providerId}`);
        console.log();

        const verification = await verifyProviderEarnings(providerId);

        console.log('='.repeat(60));
        console.log('Verification Results');
        console.log('='.repeat(60));
        console.log(`Data Valid: ${verification.isValid ? '✓ YES' : '✗ NO'}`);
        console.log();
        console.log(`Stored Total Earnings:   AED ${verification.storedTotalEarnings}`);
        console.log(`Calculated Total:        AED ${verification.calculatedTotalEarnings}`);
        console.log(`Difference:              AED ${verification.difference}`);
        console.log();
        console.log(`Stored Month Earnings:    AED ${verification.storedMonthEarnings}`);
        console.log(`Calculated Month:        AED ${verification.calculatedMonthEarnings}`);

        if (!verification.isValid) {
          console.log();
          console.log('⚠️  Data mismatch detected! Run sync to fix.');
        }

        break;
      }

      case 'sync': {
        if (!providerId) {
          console.error('❌ Error: Provider ID is required for sync action');
          console.log('Usage: npx ts-node src/scripts/backfillProviderEarnings.ts sync <providerId>');
          process.exit(1);
        }

        console.log(`Syncing earnings for provider: ${providerId}`);
        console.log();

        await syncProviderEarnings(providerId);

        console.log();
        console.log('✓ Sync completed successfully!');

        // Verify after sync
        const verification = await verifyProviderEarnings(providerId);
        console.log();
        console.log(`Verified: Stored = Calculated = ${verification.isValid ? '✓' : '✗'}`);

        break;
      }

      default: {
        console.log('Usage:');
        console.log('  Backfill all:  npx ts-node src/scripts/backfillProviderEarnings.ts backfill');
        console.log('  Verify one:   npx ts-node src/scripts/backfillProviderEarnings.ts verify <providerId> [dbName]');
        console.log('  Sync one:     npx ts-node src/scripts/backfillProviderEarnings.ts sync <providerId> [dbName]');
        console.log();
        console.log('Example:');
        console.log('  npx ts-node src/scripts/backfillProviderEarnings.ts backfill nilin');
        console.log('  npx ts-node src/scripts/backfillProviderEarnings.ts verify 507f1f77bcf86cd799439011');
        console.log();
        process.exit(1);
      }
    }

  } catch (error) {
    console.error();
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log();
    console.log('Disconnected from MongoDB');
  }
}

main();
