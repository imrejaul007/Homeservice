/**
 * Migration Script: Add duration field to existing bundle services
 *
 * This script adds a default duration (60 minutes) to all existing
 * bundle services that don't have a duration field defined.
 *
 * Run: npx ts-node src/scripts/migrateBundleServiceDuration.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/homeservice';

async function migrate() {
  console.log('🔄 Starting bundle service duration migration...');
  console.log(`📦 Connecting to: ${MONGO_URI}`);

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const bundles = db.collection('bundles');

    // Find bundles that don't have duration in services
    const cursor = bundles.find({
      'services.duration': { $exists: false }
    });

    let count = 0;
    let totalUpdated = 0;

    console.log('\n📋 Processing bundles without duration field...\n');

    while (await cursor.hasNext()) {
      const bundle = await cursor.next();
      if (!bundle) continue;
      count++;

      // For each service without duration, add default duration
      const services = (bundle.services || []).map((service: any) => ({
        ...service,
        duration: service.duration || 60 // Default 60 minutes
      }));

      await bundles.updateOne(
        { _id: bundle._id },
        { $set: { services } }
      );

      totalUpdated++;

      console.log(`  ✓ Updated bundle: ${bundle.name || bundle._id} (${services.length} services)`);

      if (count % 100 === 0) {
        console.log(`\n  ... Processed ${count} bundles so far ...\n`);
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('═'.repeat(50));
    console.log(`  Total bundles processed: ${count}`);
    console.log(`  Total bundles updated:   ${totalUpdated}`);
    console.log(`  Bundles skipped:         ${count - totalUpdated}`);
    console.log('═'.repeat(50));

    if (totalUpdated > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\n📝 Note: You may want to run the following to verify:');
      console.log('   db.bundles.find({ "services.duration": { $exists: true } }).count()');
    } else {
      console.log('\nℹ️  No bundles needed updating. All services already have duration.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
migrate().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
